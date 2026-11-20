import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireApiPermission } from '@/lib/auth';
import { logAudit } from '@/lib/audit';
import { validateHostIp } from '@/lib/ipam';
import { Prisma } from '@prisma/client';

const IpAllocateSchema = z.object({
  subnetId: z.number().int().positive('ID subnet wajib diisi'),
  address: z.string().trim().min(7, 'Alamat IP wajib diisi'),
  deviceId: z.number().int().positive().optional().nullable(),
  interfaceId: z.number().int().positive().optional().nullable(),
  purpose: z.enum([
    'management',
    'loopback',
    'point_to_point',
    'nat',
    'carp',
    'other',
  ]).default('management'),
  allocationStatus: z.enum(['AVAILABLE', 'ALLOCATED', 'RESERVED', 'RELEASED']).default('ALLOCATED'),
  hostname: z.string().trim().max(100).optional().nullable(),
  description: z.string().max(500).optional().nullable(),
});

export async function GET(req: Request) {
  const { errorResponse } = await requireApiPermission('ipam.view');
  if (errorResponse) return errorResponse;

  const url = new URL(req.url);
  const subnetId = url.searchParams.get('subnetId');
  const deviceId = url.searchParams.get('deviceId');
  const interfaceId = url.searchParams.get('interfaceId');
  const allocationStatus = url.searchParams.get('allocationStatus');
  const purpose = url.searchParams.get('purpose');
  const q = url.searchParams.get('q')?.trim();

  const whereClause: any = {
    AND: [
      subnetId ? { subnetId: parseInt(subnetId, 10) } : {},
      deviceId ? { deviceId: parseInt(deviceId, 10) } : {},
      interfaceId ? { interfaceId: parseInt(interfaceId, 10) } : {},
      allocationStatus ? { allocationStatus } : {},
      purpose ? { purpose } : {},
      q
        ? {
            OR: [
              { address: { contains: q } },
              { hostname: { contains: q, mode: 'insensitive' } },
              { description: { contains: q, mode: 'insensitive' } },
            ],
          }
        : {},
    ],
  };

  const addresses = await prisma.ipAddress.findMany({
    where: whereClause,
    include: {
      subnet: { select: { id: true, name: true, cidr: true, gatewayIp: true } },
      device: { select: { id: true, hostname: true, deviceCode: true } },
      interface: { select: { id: true, name: true, label: true } },
    },
    orderBy: { address: 'asc' },
  });

  return NextResponse.json({ data: addresses });
}

export async function POST(req: Request) {
  const { user, errorResponse } = await requireApiPermission('ipam.manage', req);
  if (errorResponse) return errorResponse;

  const body = await req.json().catch(() => null);
  const parsed = IpAllocateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { message: 'Validasi form gagal', errors: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const { subnetId, address, deviceId, interfaceId, purpose, allocationStatus, hostname, description } = parsed.data;

  // 1. Cek keberadaan Subnet
  const subnet = await prisma.subnet.findUnique({ where: { id: subnetId } });
  if (!subnet) {
    return NextResponse.json({ message: 'Subnet tidak ditemukan' }, { status: 404 });
  }

  // 2. Validasi bitwise CIDR: tolak Network & Broadcast Address untuk host (DoD T3.4)
  const validation = validateHostIp(address, subnet.cidr);
  if (!validation.valid) {
    return NextResponse.json(
      { message: validation.error },
      { status: 400 }
    );
  }

  // 3. Jika deviceId diisi, cek keberadaan Device
  if (deviceId) {
    const dev = await prisma.device.findUnique({ where: { id: deviceId } });
    if (!dev) {
      return NextResponse.json({ message: 'Perangkat tidak ditemukan' }, { status: 404 });
    }
  }

  // 4. Jika interfaceId diisi, cek apakah interface milik device tersebut
  if (interfaceId) {
    const iface = await prisma.interface.findUnique({ where: { id: interfaceId } });
    if (!iface) {
      return NextResponse.json({ message: 'Port interface tidak ditemukan' }, { status: 404 });
    }
    if (deviceId && iface.deviceId !== deviceId) {
      return NextResponse.json({ message: 'Port interface tidak cocok dengan perangkat' }, { status: 400 });
    }
  }

  // 5. Cek apakah IP sudah ada di subnet ini
  const existing = await prisma.ipAddress.findUnique({
    where: {
      subnetId_address: {
        subnetId,
        address,
      },
    },
  });

  if (existing) {
    if (existing.allocationStatus === 'ALLOCATED') {
      return NextResponse.json(
        { message: `Alamat IP ${address} sudah dialokasikan pada subnet ini` },
        { status: 409 }
      );
    }

    // Jika sebelumnya RELEASED atau AVAILABLE, alokasikan ulang (re-claim)
    const updated = await prisma.ipAddress.update({
      where: { id: existing.id },
      data: {
        deviceId: deviceId || null,
        interfaceId: interfaceId || null,
        purpose,
        allocationStatus: allocationStatus || 'ALLOCATED',
        hostname: hostname || null,
        description: description || null,
        assignedAt: new Date(),
        releasedAt: null,
      },
      include: {
        subnet: true,
        device: true,
        interface: true,
      },
    });

    await logAudit({
      userId: user.id,
      action: 'REALLOCATE_IP',
      entityType: 'IpAddress',
      entityId: updated.id,
      beforeData: existing,
      afterData: updated,
      req,
    });

    return NextResponse.json({
      message: `Alamat IP ${address} berhasil dialokasikan kembali`,
      data: updated,
    }, { status: 200 });
  }

  // 6. Buat alokasi baru
  try {
    const newIp = await prisma.ipAddress.create({
      data: {
        subnetId,
        address,
        deviceId: deviceId || null,
        interfaceId: interfaceId || null,
        purpose,
        allocationStatus,
        hostname: hostname || null,
        description: description || null,
        assignedAt: new Date(),
      },
      include: {
        subnet: true,
        device: true,
        interface: true,
      },
    });

    await logAudit({
      userId: user.id,
      action: 'ALLOCATE_IP',
      entityType: 'IpAddress',
      entityId: newIp.id,
      afterData: newIp,
      req,
    });

    return NextResponse.json({
      message: `Alamat IP ${newIp.address} berhasil dialokasikan`,
      data: newIp,
    }, { status: 201 });
  } catch (err: unknown) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      return NextResponse.json(
        { message: `Alamat IP ${address} sudah dialokasikan pada subnet ini (level DB constraint)` },
        { status: 409 }
      );
    }
    throw err;
  }
}
