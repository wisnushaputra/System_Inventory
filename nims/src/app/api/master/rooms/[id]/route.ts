import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireApiPermission } from '@/lib/auth';
import { logAudit } from '@/lib/audit';

const RoomUpdateSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  floor: z.string().trim().max(50).optional().nullable(),
  description: z.string().max(500).optional().nullable(),
});

export async function PUT(req: Request, props: { params: Promise<{ id: string }> }) {
  const { user, errorResponse } = await requireApiPermission('site.manage', req);
  if (errorResponse) return errorResponse;

  const params = await props.params;
  const id = parseInt(params.id, 10);
  if (isNaN(id)) return NextResponse.json({ message: 'ID tidak valid' }, { status: 400 });

  const current = await prisma.room.findUnique({ where: { id } });
  if (!current) return NextResponse.json({ message: 'Ruangan tidak ditemukan' }, { status: 404 });

  const body = await req.json().catch(() => null);
  const parsed = RoomUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ message: 'Validasi gagal', errors: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  if (parsed.data.name && parsed.data.name !== current.name) {
    const duplicate = await prisma.room.findUnique({
      where: { siteId_name: { siteId: current.siteId, name: parsed.data.name } },
    });
    if (duplicate) {
      return NextResponse.json({ message: `Ruangan '${parsed.data.name}' sudah ada di site ini` }, { status: 409 });
    }
  }

  const updated = await prisma.room.update({
    where: { id },
    data: parsed.data,
  });

  await logAudit({
    userId: user.id,
    action: 'UPDATE',
    entityType: 'Room',
    entityId: id,
    beforeData: current,
    afterData: updated,
    req,
  });

  return NextResponse.json({ message: 'Ruangan berhasil diperbarui', data: updated });
}

export async function DELETE(req: Request, props: { params: Promise<{ id: string }> }) {
  const { user, errorResponse } = await requireApiPermission('site.manage', req);
  if (errorResponse) return errorResponse;

  const params = await props.params;
  const id = parseInt(params.id, 10);
  if (isNaN(id)) return NextResponse.json({ message: 'ID tidak valid' }, { status: 400 });

  const current = await prisma.room.findUnique({
    where: { id },
    include: { _count: { select: { racks: true } } },
  });
  if (!current) return NextResponse.json({ message: 'Ruangan tidak ditemukan' }, { status: 404 });

  if (current._count.racks > 0) {
    return NextResponse.json(
      { message: `Tidak dapat menghapus ruangan '${current.name}' karena masih memuat ${current._count.racks} rak.` },
      { status: 409 }
    );
  }

  await prisma.room.delete({ where: { id } });

  await logAudit({
    userId: user.id,
    action: 'DELETE',
    entityType: 'Room',
    entityId: id,
    beforeData: current,
    req,
  });

  return NextResponse.json({ message: 'Ruangan berhasil dihapus' });
}
