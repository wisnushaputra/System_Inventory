import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireApiPermission } from '@/lib/auth';
import { logAudit } from '@/lib/audit';
import { parseCidr, validateHostIp } from '@/lib/ipam';
import { Prisma } from '@prisma/client';

const SubnetUpdateSchema = z.object({
  name: z.string().trim().min(2).max(100).optional(),
  siteId: z.number().int().positive().optional().nullable(),
  gatewayIp: z.string().trim().optional().nullable(),
  vlanId: z.number().int().min(1).max(4094).optional().nullable(),
  purpose: z.enum([
    'management',
    'loopback',
    'point_to_point',
    'access',
    'server',
    'public',
    'other',
  ]).optional(),
  status: z.enum(['active', 'reserved', 'deprecated']).optional(),
  description: z.string().max(500).optional().nullable(),
});

export async function GET(req: Request, props: { params: Promise<{ id: string }> }) {
  const { errorResponse } = await requireApiPermission('ipam.view');
  if (errorResponse) return errorResponse;

  const params = await props.params;
  const id = parseInt(params.id, 10);
  if (isNaN(id)) return NextResponse.json({ message: 'ID tidak valid' }, { status: 400 });

  const subnet = await prisma.subnet.findUnique({
    where: { id },
    include: {
      site: true,
      ipAddresses: {
        include: {
          device: { select: { id: true, hostname: true, deviceCode: true } },
          interface: { select: { id: true, name: true } },
        },
        orderBy: { address: 'asc' },
      },
    },
  });

  if (!subnet) return NextResponse.json({ message: 'Subnet tidak ditemukan' }, { status: 404 });

  let cidrInfo = null;
  try {
    cidrInfo = parseCidr(subnet.cidr);
  } catch {
    // ignore
  }

  return NextResponse.json({
    data: {
      ...subnet,
      cidrInfo,
    },
  });
}

export async function PUT(req: Request, props: { params: Promise<{ id: string }> }) {
  const { user, errorResponse } = await requireApiPermission('ipam.manage', req);
  if (errorResponse) return errorResponse;

  const params = await props.params;
  const id = parseInt(params.id, 10);
  if (isNaN(id)) return NextResponse.json({ message: 'ID tidak valid' }, { status: 400 });

  const current = await prisma.subnet.findUnique({ where: { id } });
  if (!current) return NextResponse.json({ message: 'Subnet tidak ditemukan' }, { status: 404 });

  const body = await req.json().catch(() => null);
  const parsed = SubnetUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { message: 'Validasi form gagal', errors: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  if (parsed.data.gatewayIp) {
    const gatewayCheck = validateHostIp(parsed.data.gatewayIp, current.cidr);
    if (!gatewayCheck.valid) {
      return NextResponse.json(
        { message: `Gateway IP tidak valid: ${gatewayCheck.error}` },
        { status: 400 }
      );
    }
  }

  const updated = await prisma.subnet.update({
    where: { id },
    data: parsed.data,
  });

  await logAudit({
    userId: user.id,
    action: 'UPDATE_SUBNET',
    entityType: 'Subnet',
    entityId: id,
    beforeData: current,
    afterData: updated,
    req,
  });

  return NextResponse.json({
    message: 'Subnet berhasil diperbarui',
    data: updated,
  });
}

export async function DELETE(req: Request, props: { params: Promise<{ id: string }> }) {
  const { user, errorResponse } = await requireApiPermission('ipam.manage', req);
  if (errorResponse) return errorResponse;

  const params = await props.params;
  const id = parseInt(params.id, 10);
  if (isNaN(id)) return NextResponse.json({ message: 'ID tidak valid' }, { status: 400 });

  const current = await prisma.subnet.findUnique({
    where: { id },
    include: {
      _count: {
        select: {
          ipAddresses: {
            where: { allocationStatus: 'ALLOCATED' },
          },
        },
      },
    },
  });

  if (!current) return NextResponse.json({ message: 'Subnet tidak ditemukan' }, { status: 404 });

  if (current._count.ipAddresses > 0) {
    return NextResponse.json(
      {
        message: `Tidak dapat menghapus subnet: masih ada ${current._count.ipAddresses} IP address yang dialokasikan`,
      },
      { status: 409 }
    );
  }

  // Hapus semua IP history jika statusnya RELEASED/AVAILABLE
  await prisma.ipAddress.deleteMany({ where: { subnetId: id } });
  await prisma.subnet.delete({ where: { id } });

  await logAudit({
    userId: user.id,
    action: 'DELETE_SUBNET',
    entityType: 'Subnet',
    entityId: id,
    beforeData: current,
    req,
  });

  return NextResponse.json({ message: `Subnet '${current.name}' (${current.cidr}) berhasil dihapus` });
}
