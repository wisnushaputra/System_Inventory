import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireApiPermission } from '@/lib/auth';
import { logAudit } from '@/lib/audit';

const VendorCreateSchema = z.object({
  name: z.string().trim().min(2).max(100),
  website: z.string().trim().url().optional().nullable().or(z.literal('')),
  supportContact: z.string().trim().max(150).optional().nullable(),
  notes: z.string().max(500).optional().nullable(),
});

export async function GET(req: Request) {
  const { errorResponse } = await requireApiPermission('site.view');
  if (errorResponse) return errorResponse;

  const url = new URL(req.url);
  const q = url.searchParams.get('q')?.trim();

  const vendors = await prisma.vendor.findMany({
    where: q ? { name: { contains: q, mode: 'insensitive' } } : {},
    include: {
      _count: { select: { models: true } },
    },
    orderBy: { name: 'asc' },
  });

  return NextResponse.json({ data: vendors });
}

export async function POST(req: Request) {
  const { user, errorResponse } = await requireApiPermission('vendor.manage', req);
  if (errorResponse) return errorResponse;

  const body = await req.json().catch(() => null);
  const parsed = VendorCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ message: 'Validasi gagal', errors: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const existing = await prisma.vendor.findUnique({ where: { name: parsed.data.name } });
  if (existing) {
    return NextResponse.json({ message: `Vendor '${parsed.data.name}' sudah ada` }, { status: 409 });
  }

  const vendor = await prisma.vendor.create({
    data: {
      name: parsed.data.name,
      website: parsed.data.website || null,
      supportContact: parsed.data.supportContact || null,
      notes: parsed.data.notes || null,
    },
  });

  await logAudit({
    userId: user.id,
    action: 'CREATE',
    entityType: 'Vendor',
    entityId: vendor.id,
    afterData: vendor,
    req,
  });

  return NextResponse.json({ message: 'Vendor berhasil ditambahkan', data: vendor }, { status: 201 });
}
