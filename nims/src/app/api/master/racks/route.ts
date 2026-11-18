import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireApiPermission } from '@/lib/auth';
import { logAudit } from '@/lib/audit';

const RackCreateSchema = z.object({
  siteId: z.number().int().positive(),
  roomId: z.number().int().positive().optional().nullable(),
  name: z.string().trim().min(1).max(100),
  unitCapacity: z.number().int().min(1).max(100).default(42),
  description: z.string().max(500).optional().nullable(),
});

export async function GET(req: Request) {
  const { errorResponse } = await requireApiPermission('site.view');
  if (errorResponse) return errorResponse;

  const url = new URL(req.url);
  const siteId = url.searchParams.get('siteId');
  const roomId = url.searchParams.get('roomId');

  const racks = await prisma.rack.findMany({
    where: {
      AND: [
        siteId ? { siteId: parseInt(siteId, 10) } : {},
        roomId ? { roomId: parseInt(roomId, 10) } : {},
      ],
    },
    include: {
      site: true,
      room: true,
    },
    orderBy: { name: 'asc' },
  });

  return NextResponse.json({ data: racks });
}

export async function POST(req: Request) {
  const { user, errorResponse } = await requireApiPermission('site.manage', req);
  if (errorResponse) return errorResponse;

  const body = await req.json().catch(() => null);
  const parsed = RackCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ message: 'Validasi gagal', errors: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const site = await prisma.site.findUnique({ where: { id: parsed.data.siteId } });
  if (!site) return NextResponse.json({ message: 'Site tidak ditemukan' }, { status: 400 });

  if (parsed.data.roomId) {
    const room = await prisma.room.findUnique({ where: { id: parsed.data.roomId } });
    if (!room || room.siteId !== parsed.data.siteId) {
      return NextResponse.json({ message: 'Ruangan tidak sesuai dengan site yang dipilih' }, { status: 400 });
    }
  }

  const existing = await prisma.rack.findUnique({
    where: { siteId_name: { siteId: parsed.data.siteId, name: parsed.data.name } },
  });
  if (existing) {
    return NextResponse.json({ message: `Rak '${parsed.data.name}' sudah ada di site ini` }, { status: 409 });
  }

  const rack = await prisma.rack.create({
    data: parsed.data,
    include: { site: true, room: true },
  });

  await logAudit({
    userId: user.id,
    action: 'CREATE',
    entityType: 'Rack',
    entityId: rack.id,
    afterData: rack,
    req,
  });

  return NextResponse.json({ message: 'Rak berhasil ditambahkan', data: rack }, { status: 201 });
}
