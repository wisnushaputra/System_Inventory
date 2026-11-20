import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireApiPermission } from '@/lib/auth';
import { logAudit } from '@/lib/audit';

const DeviceUpdateSchema = z.object({
  deviceCode: z.string().trim().min(2).max(50).toUpperCase().optional(),
  hostname: z.string().trim().min(2).max(100).optional(),
  categoryId: z.number().int().positive().optional(),
  vendorId: z.number().int().positive().optional(),
  modelId: z.number().int().positive().optional().nullable(),
  siteId: z.number().int().positive().optional(),
  roomId: z.number().int().positive().optional().nullable(),
  rackId: z.number().int().positive().optional().nullable(),
  serialNumber: z.string().trim().max(100).optional().nullable(),
  networkRole: z.enum(['core', 'distribution', 'access', 'aggregation', 'cpe', 'server', 'other']).optional().nullable(),
  inventoryStatus: z.enum(['PLANNED', 'ACTIVE', 'MAINTENANCE', 'RETIRED', 'LOST']).optional(),
  managementNotes: z.string().max(1000).optional().nullable(),
  description: z.string().max(1000).optional().nullable(),
  installedAt: z.string().datetime().optional().nullable().or(z.literal('')).transform((v) => (v ? new Date(v) : null)),
  warrantyExpiry: z.string().datetime().optional().nullable().or(z.literal('')).transform((v) => (v ? new Date(v) : null)),
  ownerTeam: z.string().trim().max(100).optional().nullable(),
});

export async function GET(req: Request, props: { params: Promise<{ id: string }> }) {
  const { errorResponse } = await requireApiPermission('device.view');
  if (errorResponse) return errorResponse;

  const params = await props.params;
  const id = parseInt(params.id, 10);
  if (isNaN(id)) return NextResponse.json({ message: 'ID tidak valid' }, { status: 400 });

  const device = await prisma.device.findUnique({
    where: { id },
    include: {
      category: true,
      vendor: true,
      model: true,
      site: true,
      room: true,
      rack: true,
      creator: { select: { id: true, name: true, username: true } },
      updater: { select: { id: true, name: true, username: true } },
      interfaces: {
        include: {
          ipAddresses: {
            include: { subnet: true },
          },
        },
        orderBy: { name: 'asc' },
      },
      ipAddresses: {
        include: {
          subnet: true,
          interface: { select: { id: true, name: true } },
        },
        orderBy: { address: 'asc' },
      },
    },
  });

  if (!device) return NextResponse.json({ message: 'Perangkat tidak ditemukan' }, { status: 404 });

  const managementIpObj = device.ipAddresses.find(
    (ip) => ip.purpose === 'management' && ip.allocationStatus === 'ALLOCATED'
  );

  const formattedDevice = {
    ...device,
    managementIp: managementIpObj?.address ?? null,
  };

  // Ambil histori audit log khusus untuk perangkat ini
  const history = await prisma.auditLog.findMany({
    where: { entityType: 'Device', entityId: id },
    include: { user: { select: { name: true, username: true } } },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });

  return NextResponse.json({ data: formattedDevice, history });
}

export async function PUT(req: Request, props: { params: Promise<{ id: string }> }) {
  const { user, errorResponse } = await requireApiPermission('device.update', req);
  if (errorResponse) return errorResponse;

  const params = await props.params;
  const id = parseInt(params.id, 10);
  if (isNaN(id)) return NextResponse.json({ message: 'ID tidak valid' }, { status: 400 });

  const current = await prisma.device.findUnique({ where: { id } });
  if (!current) return NextResponse.json({ message: 'Perangkat tidak ditemukan' }, { status: 404 });

  const body = await req.json().catch(() => null);
  const parsed = DeviceUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { message: 'Validasi form gagal', errors: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  // Jika mengubah deviceCode, periksa duplikasi
  if (parsed.data.deviceCode && parsed.data.deviceCode !== current.deviceCode) {
    const duplicate = await prisma.device.findUnique({
      where: { deviceCode: parsed.data.deviceCode },
    });
    if (duplicate) {
      return NextResponse.json(
        { message: `Kode perangkat '${parsed.data.deviceCode}' sudah digunakan` },
        { status: 409 }
      );
    }
  }

  const updated = await prisma.device.update({
    where: { id },
    data: {
      ...parsed.data,
      updatedBy: user.id,
    },
    include: {
      category: true,
      vendor: true,
      model: true,
      site: true,
      room: true,
      rack: true,
    },
  });

  await logAudit({
    userId: user.id,
    action: 'UPDATE',
    entityType: 'Device',
    entityId: id,
    beforeData: current,
    afterData: updated,
    req,
  });

  return NextResponse.json({ message: 'Perangkat berhasil diperbarui', data: updated });
}

export async function DELETE(req: Request, props: { params: Promise<{ id: string }> }) {
  const { user, errorResponse } = await requireApiPermission('device.update', req);
  if (errorResponse) return errorResponse;

  const params = await props.params;
  const id = parseInt(params.id, 10);
  if (isNaN(id)) return NextResponse.json({ message: 'ID tidak valid' }, { status: 400 });

  const current = await prisma.device.findUnique({ where: { id } });
  if (!current) return NextResponse.json({ message: 'Perangkat tidak ditemukan' }, { status: 404 });

  await prisma.device.delete({ where: { id } });

  await logAudit({
    userId: user.id,
    action: 'DELETE',
    entityType: 'Device',
    entityId: id,
    beforeData: current,
    req,
  });

  return NextResponse.json({ message: 'Perangkat berhasil dihapus' });
}
