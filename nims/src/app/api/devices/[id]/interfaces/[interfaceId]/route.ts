import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireApiPermission } from '@/lib/auth';
import { logAudit } from '@/lib/audit';
import { Prisma } from '@prisma/client';

const InterfaceUpdateSchema = z.object({
  name: z.string().trim().min(1).max(50).optional(),
  label: z.string().trim().max(100).optional().nullable(),
  interfaceType: z.enum([
    'ethernet',
    'sfp',
    'sfp_plus',
    'qsfp',
    'pon',
    'wireless',
    'loopback',
    'vlan',
    'lag',
    'management',
    'other',
  ]).optional(),
  mediaType: z.enum(['copper', 'fiber_single_mode', 'fiber_multi_mode', 'wireless']).optional().nullable(),
  speedMbps: z.number().int().positive().optional().nullable(),
  adminStatus: z.enum(['enabled', 'disabled']).optional(),
  operStatus: z.enum(['up', 'down', 'testing', 'unknown']).optional(),
  macAddress: z.string().trim().max(50).optional().nullable(),
  portMode: z.enum(['access', 'trunk', 'routed']).optional().nullable(),
  vlanId: z.number().int().min(1).max(4094).optional().nullable(),
  description: z.string().max(500).optional().nullable(),
});

export async function GET(
  req: Request,
  props: { params: Promise<{ id: string; interfaceId: string }> }
) {
  const { errorResponse } = await requireApiPermission('interface.view');
  if (errorResponse) return errorResponse;

  const params = await props.params;
  const deviceId = parseInt(params.id, 10);
  const interfaceId = parseInt(params.interfaceId, 10);
  if (isNaN(deviceId) || isNaN(interfaceId)) {
    return NextResponse.json({ message: 'Parameter ID tidak valid' }, { status: 400 });
  }

  const iface = await prisma.interface.findFirst({
    where: { id: interfaceId, deviceId },
    include: {
      ipAddresses: {
        include: { subnet: true },
      },
    },
  });

  if (!iface) return NextResponse.json({ message: 'Port tidak ditemukan' }, { status: 404 });
  return NextResponse.json({ data: iface });
}

export async function PUT(
  req: Request,
  props: { params: Promise<{ id: string; interfaceId: string }> }
) {
  const { user, errorResponse } = await requireApiPermission('interface.manage', req);
  if (errorResponse) return errorResponse;

  const params = await props.params;
  const deviceId = parseInt(params.id, 10);
  const interfaceId = parseInt(params.interfaceId, 10);
  if (isNaN(deviceId) || isNaN(interfaceId)) {
    return NextResponse.json({ message: 'Parameter ID tidak valid' }, { status: 400 });
  }

  const current = await prisma.interface.findFirst({
    where: { id: interfaceId, deviceId },
  });
  if (!current) return NextResponse.json({ message: 'Port tidak ditemukan' }, { status: 404 });

  const body = await req.json().catch(() => null);
  const parsed = InterfaceUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { message: 'Validasi gagal', errors: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  try {
    const updated = await prisma.interface.update({
      where: { id: interfaceId },
      data: parsed.data,
    });

    await logAudit({
      userId: user.id,
      action: 'UPDATE_INTERFACE',
      entityType: 'Interface',
      entityId: interfaceId,
      beforeData: current,
      afterData: updated,
      req,
    });

    return NextResponse.json({ message: 'Port berhasil diperbarui', data: updated });
  } catch (err: unknown) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      return NextResponse.json(
        { message: `Nama port '${parsed.data.name}' sudah digunakan pada perangkat ini` },
        { status: 409 }
      );
    }
    throw err;
  }
}

export async function DELETE(
  req: Request,
  props: { params: Promise<{ id: string; interfaceId: string }> }
) {
  const { user, errorResponse } = await requireApiPermission('interface.manage', req);
  if (errorResponse) return errorResponse;

  const params = await props.params;
  const deviceId = parseInt(params.id, 10);
  const interfaceId = parseInt(params.interfaceId, 10);
  if (isNaN(deviceId) || isNaN(interfaceId)) {
    return NextResponse.json({ message: 'Parameter ID tidak valid' }, { status: 400 });
  }

  const current = await prisma.interface.findFirst({
    where: { id: interfaceId, deviceId },
  });
  if (!current) return NextResponse.json({ message: 'Port tidak ditemukan' }, { status: 404 });

  await prisma.interface.delete({
    where: { id: interfaceId },
  });

  await logAudit({
    userId: user.id,
    action: 'DELETE_INTERFACE',
    entityType: 'Interface',
    entityId: interfaceId,
    beforeData: current,
    req,
  });

  return NextResponse.json({ message: `Port '${current.name}' berhasil dihapus` });
}
