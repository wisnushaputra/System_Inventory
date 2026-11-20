import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireApiPermission } from '@/lib/auth';
import { logAudit } from '@/lib/audit';

const IpUpdateSchema = z.object({
  purpose: z.enum([
    'management',
    'loopback',
    'point_to_point',
    'nat',
    'carp',
    'other',
  ]).optional(),
  hostname: z.string().trim().max(100).optional().nullable(),
  description: z.string().max(500).optional().nullable(),
});

export async function GET(req: Request, props: { params: Promise<{ id: string }> }) {
  const { errorResponse } = await requireApiPermission('ipam.view');
  if (errorResponse) return errorResponse;

  const params = await props.params;
  const id = parseInt(params.id, 10);
  if (isNaN(id)) return NextResponse.json({ message: 'ID tidak valid' }, { status: 400 });

  const ip = await prisma.ipAddress.findUnique({
    where: { id },
    include: {
      subnet: true,
      device: true,
      interface: true,
    },
  });

  if (!ip) return NextResponse.json({ message: 'Alamat IP tidak ditemukan' }, { status: 404 });
  return NextResponse.json({ data: ip });
}

export async function PUT(req: Request, props: { params: Promise<{ id: string }> }) {
  const { user, errorResponse } = await requireApiPermission('ipam.manage', req);
  if (errorResponse) return errorResponse;

  const params = await props.params;
  const id = parseInt(params.id, 10);
  if (isNaN(id)) return NextResponse.json({ message: 'ID tidak valid' }, { status: 400 });

  const current = await prisma.ipAddress.findUnique({ where: { id } });
  if (!current) return NextResponse.json({ message: 'Alamat IP tidak ditemukan' }, { status: 404 });

  const body = await req.json().catch(() => null);
  const parsed = IpUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { message: 'Validasi gagal', errors: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const updated = await prisma.ipAddress.update({
    where: { id },
    data: parsed.data,
    include: { subnet: true, device: true, interface: true },
  });

  await logAudit({
    userId: user.id,
    action: 'UPDATE_IP',
    entityType: 'IpAddress',
    entityId: id,
    beforeData: current,
    afterData: updated,
    req,
  });

  return NextResponse.json({ message: 'Alamat IP berhasil diperbarui', data: updated });
}

export async function DELETE(req: Request, props: { params: Promise<{ id: string }> }) {
  const { user, errorResponse } = await requireApiPermission('ipam.manage', req);
  if (errorResponse) return errorResponse;

  const params = await props.params;
  const id = parseInt(params.id, 10);
  if (isNaN(id)) return NextResponse.json({ message: 'ID tidak valid' }, { status: 400 });

  const current = await prisma.ipAddress.findUnique({ where: { id } });
  if (!current) return NextResponse.json({ message: 'Alamat IP tidak ditemukan' }, { status: 404 });

  if (current.allocationStatus === 'ALLOCATED') {
    return NextResponse.json(
      { message: 'Alamat IP yang masih berstatus ALLOCATED tidak dapat dihapus. Silakan lakukan Release terlebih dahulu.' },
      { status: 409 }
    );
  }

  await prisma.ipAddress.delete({ where: { id } });

  await logAudit({
    userId: user.id,
    action: 'DELETE_IP',
    entityType: 'IpAddress',
    entityId: id,
    beforeData: current,
    req,
  });

  return NextResponse.json({ message: `Alamat IP ${current.address} berhasil dihapus dari sistem` });
}
