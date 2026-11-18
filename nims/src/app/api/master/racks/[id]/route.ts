import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireApiPermission } from '@/lib/auth';
import { logAudit } from '@/lib/audit';

const RackUpdateSchema = z.object({
  roomId: z.number().int().positive().optional().nullable(),
  name: z.string().trim().min(1).max(100).optional(),
  unitCapacity: z.number().int().min(1).max(100).optional(),
  description: z.string().max(500).optional().nullable(),
});

export async function PUT(req: Request, props: { params: Promise<{ id: string }> }) {
  const { user, errorResponse } = await requireApiPermission('site.manage', req);
  if (errorResponse) return errorResponse;

  const params = await props.params;
  const id = parseInt(params.id, 10);
  if (isNaN(id)) return NextResponse.json({ message: 'ID tidak valid' }, { status: 400 });

  const current = await prisma.rack.findUnique({ where: { id } });
  if (!current) return NextResponse.json({ message: 'Rak tidak ditemukan' }, { status: 404 });

  const body = await req.json().catch(() => null);
  const parsed = RackUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ message: 'Validasi gagal', errors: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  if (parsed.data.name && parsed.data.name !== current.name) {
    const duplicate = await prisma.rack.findUnique({
      where: { siteId_name: { siteId: current.siteId, name: parsed.data.name } },
    });
    if (duplicate) {
      return NextResponse.json({ message: `Rak '${parsed.data.name}' sudah ada di site ini` }, { status: 409 });
    }
  }

  const updated = await prisma.rack.update({
    where: { id },
    data: parsed.data,
  });

  await logAudit({
    userId: user.id,
    action: 'UPDATE',
    entityType: 'Rack',
    entityId: id,
    beforeData: current,
    afterData: updated,
    req,
  });

  return NextResponse.json({ message: 'Rak berhasil diperbarui', data: updated });
}

export async function DELETE(req: Request, props: { params: Promise<{ id: string }> }) {
  const { user, errorResponse } = await requireApiPermission('site.manage', req);
  if (errorResponse) return errorResponse;

  const params = await props.params;
  const id = parseInt(params.id, 10);
  if (isNaN(id)) return NextResponse.json({ message: 'ID tidak valid' }, { status: 400 });

  const current = await prisma.rack.findUnique({ where: { id } });
  if (!current) return NextResponse.json({ message: 'Rak tidak ditemukan' }, { status: 404 });

  await prisma.rack.delete({ where: { id } });

  await logAudit({
    userId: user.id,
    action: 'DELETE',
    entityType: 'Rack',
    entityId: id,
    beforeData: current,
    req,
  });

  return NextResponse.json({ message: 'Rak berhasil dihapus' });
}
