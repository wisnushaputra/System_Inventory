import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireApiPermission } from '@/lib/auth';
import { logAudit } from '@/lib/audit';

const RoomCreateSchema = z.object({
  siteId: z.number().int().positive(),
  name: z.string().trim().min(1).max(100),
  floor: z.string().trim().max(50).optional().nullable(),
  description: z.string().max(500).optional().nullable(),
});

export async function GET(req: Request) {
  const { errorResponse } = await requireApiPermission('site.view');
  if (errorResponse) return errorResponse;

  const url = new URL(req.url);
  const siteId = url.searchParams.get('siteId');

  const rooms = await prisma.room.findMany({
    where: siteId ? { siteId: parseInt(siteId, 10) } : {},
    include: {
      site: true,
      _count: { select: { racks: true } },
    },
    orderBy: { name: 'asc' },
  });

  return NextResponse.json({ data: rooms });
}

export async function POST(req: Request) {
  const { user, errorResponse } = await requireApiPermission('site.manage', req);
  if (errorResponse) return errorResponse;

  const body = await req.json().catch(() => null);
  const parsed = RoomCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ message: 'Validasi gagal', errors: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const site = await prisma.site.findUnique({ where: { id: parsed.data.siteId } });
  if (!site) return NextResponse.json({ message: 'Site tidak ditemukan' }, { status: 400 });

  const existing = await prisma.room.findUnique({
    where: { siteId_name: { siteId: parsed.data.siteId, name: parsed.data.name } },
  });
  if (existing) {
    return NextResponse.json({ message: `Ruangan '${parsed.data.name}' sudah ada di site ini` }, { status: 409 });
  }

  const room = await prisma.room.create({
    data: parsed.data,
    include: { site: true },
  });

  await logAudit({
    userId: user.id,
    action: 'CREATE',
    entityType: 'Room',
    entityId: room.id,
    afterData: room,
    req,
  });

  return NextResponse.json({ message: 'Ruangan berhasil ditambahkan', data: room }, { status: 201 });
}
