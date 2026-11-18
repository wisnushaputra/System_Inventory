import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireApiPermission } from '@/lib/auth';
import { logAudit } from '@/lib/audit';

const CategoryCreateSchema = z.object({
  name: z.string().trim().min(2).max(100),
  code: z.string().trim().min(2).max(50).toLowerCase(),
  description: z.string().max(500).optional().nullable(),
});

export async function GET(req: Request) {
  const { errorResponse } = await requireApiPermission('device.view');
  if (errorResponse) return errorResponse;

  const url = new URL(req.url);
  const q = url.searchParams.get('q')?.trim();

  const categories = await prisma.deviceCategory.findMany({
    where: q
      ? {
          OR: [
            { name: { contains: q, mode: 'insensitive' } },
            { code: { contains: q, mode: 'insensitive' } },
          ],
        }
      : {},
    include: {
      _count: { select: { models: true } },
    },
    orderBy: { name: 'asc' },
  });

  return NextResponse.json({ data: categories });
}

export async function POST(req: Request) {
  const { user, errorResponse } = await requireApiPermission('vendor.manage', req);
  if (errorResponse) return errorResponse;

  const body = await req.json().catch(() => null);
  const parsed = CategoryCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ message: 'Validasi gagal', errors: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const existing = await prisma.deviceCategory.findUnique({ where: { code: parsed.data.code } });
  if (existing) {
    return NextResponse.json({ message: `Kode kategori '${parsed.data.code}' sudah terdaftar` }, { status: 409 });
  }

  const category = await prisma.deviceCategory.create({
    data: parsed.data,
  });

  await logAudit({
    userId: user.id,
    action: 'CREATE',
    entityType: 'DeviceCategory',
    entityId: category.id,
    afterData: category,
    req,
  });

  return NextResponse.json({ message: 'Kategori berhasil ditambahkan', data: category }, { status: 201 });
}
