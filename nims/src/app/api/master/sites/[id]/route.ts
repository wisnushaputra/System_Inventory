import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireApiPermission } from '@/lib/auth';
import { logAudit } from '@/lib/audit';

const SiteUpdateSchema = z.object({
  siteCode: z.string().trim().min(2).max(50).toUpperCase().optional(),
  name: z.string().trim().min(2).max(100).optional(),
  siteType: z.enum(['pop', 'dc', 'office', 'customer_site', 'other']).optional(),
  address: z.string().trim().max(255).optional().nullable(),
  city: z.string().trim().max(100).optional().nullable(),
  province: z.string().trim().max(100).optional().nullable(),
  latitude: z.number().min(-90).max(90).optional().nullable(),
  longitude: z.number().min(-180).max(180).optional().nullable(),
  status: z.enum(['active', 'inactive', 'maintenance']).optional(),
  description: z.string().max(500).optional().nullable(),
});

export async function GET(req: Request, props: { params: Promise<{ id: string }> }) {
  const { errorResponse } = await requireApiPermission('site.view');
  if (errorResponse) return errorResponse;

  const params = await props.params;
  const id = parseInt(params.id, 10);
  if (isNaN(id)) return NextResponse.json({ message: 'ID tidak valid' }, { status: 400 });

  const site = await prisma.site.findUnique({
    where: { id },
    include: {
      rooms: {
        include: { racks: true },
        orderBy: { name: 'asc' },
      },
      racks: {
        where: { roomId: null },
        orderBy: { name: 'asc' },
      },
    },
  });

  if (!site) return NextResponse.json({ message: 'Site tidak ditemukan' }, { status: 404 });
  return NextResponse.json({ data: site });
}

export async function PUT(req: Request, props: { params: Promise<{ id: string }> }) {
  const { user, errorResponse } = await requireApiPermission('site.manage', req);
  if (errorResponse) return errorResponse;

  const params = await props.params;
  const id = parseInt(params.id, 10);
  if (isNaN(id)) return NextResponse.json({ message: 'ID tidak valid' }, { status: 400 });

  const current = await prisma.site.findUnique({ where: { id } });
  if (!current) return NextResponse.json({ message: 'Site tidak ditemukan' }, { status: 404 });

  const body = await req.json().catch(() => null);
  const parsed = SiteUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ message: 'Validasi gagal', errors: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  if (parsed.data.siteCode && parsed.data.siteCode !== current.siteCode) {
    const duplicate = await prisma.site.findUnique({ where: { siteCode: parsed.data.siteCode } });
    if (duplicate) {
      return NextResponse.json({ message: `Kode site '${parsed.data.siteCode}' sudah digunakan` }, { status: 409 });
    }
  }

  const updated = await prisma.site.update({
    where: { id },
    data: parsed.data,
  });

  await logAudit({
    userId: user.id,
    action: 'UPDATE',
    entityType: 'Site',
    entityId: id,
    beforeData: current,
    afterData: updated,
    req,
  });

  return NextResponse.json({ message: 'Site berhasil diperbarui', data: updated });
}

export async function DELETE(req: Request, props: { params: Promise<{ id: string }> }) {
  const { user, errorResponse } = await requireApiPermission('site.manage', req);
  if (errorResponse) return errorResponse;

  const params = await props.params;
  const id = parseInt(params.id, 10);
  if (isNaN(id)) return NextResponse.json({ message: 'ID tidak valid' }, { status: 400 });

  const current = await prisma.site.findUnique({
    where: { id },
    include: {
      _count: { select: { rooms: true, racks: true } },
    },
  });

  if (!current) return NextResponse.json({ message: 'Site tidak ditemukan' }, { status: 404 });

  if (current._count.rooms > 0 || current._count.racks > 0) {
    return NextResponse.json(
      {
        message: `Tidak dapat menghapus site '${current.name}' karena masih memiliki ${current._count.rooms} ruang dan ${current._count.racks} rak aktif.`,
      },
      { status: 409 }
    );
  }

  try {
    await prisma.site.delete({ where: { id } });
  } catch (err: any) {
    return NextResponse.json({ message: 'Gagal menghapus site: masih terkait dengan data lain di sistem' }, { status: 409 });
  }

  await logAudit({
    userId: user.id,
    action: 'DELETE',
    entityType: 'Site',
    entityId: id,
    beforeData: current,
    req,
  });

  return NextResponse.json({ message: 'Site berhasil dihapus' });
}
