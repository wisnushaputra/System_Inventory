import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireApiPermission } from '@/lib/auth';
import { logAudit } from '@/lib/audit';
import { parsePointToPointHost } from '@/lib/ipam';
import { Prisma } from '@prisma/client';

const P2pManualSchema = z.object({
  deviceId: z.number().int().positive('ID perangkat wajib diisi'),
  address: z.string().trim().min(7, 'Alamat IPv4 wajib diisi'),
  prefix: z.union([z.literal(30), z.literal(31)], {
    message: 'Prefix wajib /30 atau /31 (Point-to-Point)',
  }),
  interfaceId: z.number().int().positive().optional().nullable(),
  description: z.string().trim().max(500).optional().nullable(),
});

export async function POST(req: Request) {
  const { user, errorResponse } = await requireApiPermission('ipam.manage', req);
  if (errorResponse) return errorResponse;

  const body = await req.json().catch(() => null);
  const parsed = P2pManualSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        message: parsed.error.issues[0]?.message || 'Validasi form gagal',
        errors: parsed.error.flatten().fieldErrors,
      },
      { status: 400 }
    );
  }

  const { deviceId, address, prefix, interfaceId, description } = parsed.data;

  const device = await prisma.device.findUnique({
    where: { id: deviceId },
    include: {
      site: {
        include: {
          parentSite: {
            select: { id: true, siteCode: true, name: true },
          },
        },
      },
    },
  });

  if (!device) {
    return NextResponse.json({ message: 'Perangkat tidak ditemukan' }, { status: 404 });
  }

  const isEligible =
    device.site.siteType === 'pop' ||
    (device.site.siteType === 'customer_site' && device.site.parentSiteId !== null);

  if (!isEligible) {
    return NextResponse.json(
      {
        message:
          'Input Management IP manual hanya diperbolehkan untuk link Point-to-Point antara POP Induk dan Site Pelanggan (End User).',
      },
      { status: 400 }
    );
  }

  const p2p = parsePointToPointHost(address, prefix);
  if (!p2p.valid || !p2p.hostIp || !p2p.peerIp || !p2p.cidrInfo) {
    return NextResponse.json(
      { message: p2p.error || 'Alamat IP Point-to-Point tidak valid' },
      { status: 400 }
    );
  }

  if (interfaceId) {
    const iface = await prisma.interface.findUnique({ where: { id: interfaceId } });
    if (!iface) {
      return NextResponse.json({ message: 'Port interface tidak ditemukan' }, { status: 404 });
    }
    if (iface.deviceId !== device.id) {
      return NextResponse.json(
        { message: 'Port interface tidak cocok dengan perangkat' },
        { status: 400 }
      );
    }
  }

  let subnet = await prisma.subnet.findUnique({
    where: { cidr: p2p.cidrInfo.cidr },
  });

  if (subnet && subnet.purpose !== 'point_to_point') {
    return NextResponse.json(
      {
        message: `Subnet ${subnet.cidr} sudah terdaftar dengan tujuan '${subnet.purpose}', bukan Point-to-Point.`,
      },
      { status: 409 }
    );
  }

  if (!subnet) {
    const subnetName =
      device.site.siteType === 'customer_site'
        ? `P2P ${device.site.parentSite?.siteCode ?? 'POP'} - ${device.site.siteCode}`
        : `P2P ${device.site.siteCode} (${p2p.cidrInfo.cidr})`;

    subnet = await prisma.subnet.create({
      data: {
        name: subnetName,
        cidr: p2p.cidrInfo.cidr,
        siteId: device.site.parentSiteId ?? device.site.id,
        gatewayIp: device.site.siteType === 'customer_site' ? p2p.peerIp : p2p.hostIp,
        purpose: 'point_to_point',
        status: 'active',
        description: `Link Point-to-Point POP ke End User (${p2p.cidrInfo.firstUsableIp} - ${p2p.cidrInfo.lastUsableIp})`,
      },
    });

    await logAudit({
      userId: user.id,
      action: 'CREATE_SUBNET',
      entityType: 'Subnet',
      entityId: subnet.id,
      afterData: subnet,
      req,
    });
  }

  const existing = await prisma.ipAddress.findUnique({
    where: {
      subnetId_address: {
        subnetId: subnet.id,
        address: p2p.hostIp,
      },
    },
  });

  if (existing && existing.allocationStatus === 'ALLOCATED') {
    return NextResponse.json(
      { message: `Alamat IP ${p2p.hostIp} sudah dialokasikan pada subnet ${subnet.cidr}.` },
      { status: 409 }
    );
  }

  const cleanDesc = description?.trim() || '';
  const finalDescription = cleanDesc
    ? cleanDesc.includes('Peer:')
      ? cleanDesc
      : `${cleanDesc} (Peer: ${p2p.peerIp}/${prefix})`
    : `P2P POP ke End User (Peer: ${p2p.peerIp}/${prefix})`;

  if (existing) {
    const updated = await prisma.ipAddress.update({
      where: { id: existing.id },
      data: {
        deviceId: device.id,
        interfaceId: interfaceId ?? null,
        purpose: 'management',
        allocationStatus: 'ALLOCATED',
        hostname: device.hostname,
        description: finalDescription,
        assignedAt: new Date(),
        releasedAt: null,
      },
      include: {
        subnet: { select: { id: true, name: true, cidr: true, gatewayIp: true, purpose: true } },
        device: { select: { id: true, hostname: true, deviceCode: true } },
        interface: { select: { id: true, name: true, label: true } },
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

    return NextResponse.json(
      {
        message: `Management IP P2P ${updated.address}/${prefix} berhasil dialokasikan kembali.`,
        data: updated,
        peerIp: p2p.peerIp,
        subnet,
      },
      { status: 200 }
    );
  }

  try {
    const created = await prisma.ipAddress.create({
      data: {
        subnetId: subnet.id,
        address: p2p.hostIp,
        deviceId: device.id,
        interfaceId: interfaceId ?? null,
        purpose: 'management',
        allocationStatus: 'ALLOCATED',
        hostname: device.hostname,
        description: finalDescription,
        assignedAt: new Date(),
      },
      include: {
        subnet: { select: { id: true, name: true, cidr: true, gatewayIp: true, purpose: true } },
        device: { select: { id: true, hostname: true, deviceCode: true } },
        interface: { select: { id: true, name: true, label: true } },
      },
    });

    await logAudit({
      userId: user.id,
      action: 'ALLOCATE_IP',
      entityType: 'IpAddress',
      entityId: created.id,
      afterData: created,
      req,
    });

    return NextResponse.json(
      {
        message: `Management IP P2P ${created.address}/${prefix} berhasil ditambahkan.`,
        data: created,
        peerIp: p2p.peerIp,
        subnet,
      },
      { status: 201 }
    );
  } catch (err: unknown) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      return NextResponse.json(
        { message: `Alamat IP ${p2p.hostIp} sudah dialokasikan pada subnet ${subnet.cidr}.` },
        { status: 409 }
      );
    }
    throw err;
  }
}
