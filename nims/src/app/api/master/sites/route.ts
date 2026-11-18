import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireApiPermission } from '@/lib/auth';
import { logAudit } from '@/lib/audit';

const SiteCreateSchema = z.object({
  siteCode: z.string().trim().min(2).max(50).toUpperCase(),
  name: z.string().trim().min(2).max(100),
  siteType: z.enum(['pop', 'dc', 'office', 'customer_site', 'other']).default('pop'),
  address: z.string().trim().max(255).optional().nullable(),
  city: z.string().trim().max(100).optional().nullable(),
  province: z.string().trim().max(100).optional().nullable(),
  latitude: z.number().min(-90).max(90).optional().nullable(),
  longitude: z.number().min(-180).max(180).optional().nullable(),
  status: z.enum(['active', 'inactive', 'maintenance']).default('active'),
  description: z.string().max(500).optional().nullable(),
});

export async function GET(req: Request) {
  const { user, errorResponse } = await requireApiPermission('site.view');
  if (errorResponse) return errorResponse;

  const url = new URL(req.url);
  const q = url.searchParams.get('q')?.trim();
  const siteType = url.searchParams.get('siteType')?.trim();
  const status = url.searchParams.get('status')?.trim();

  const sites = await prisma.site.findMany({
    where: {
      AND: [
        q
          ? {
              OR: [
                { siteCode: { contains: q, mode: 'insensitive' } },
                { name: { contains: q, mode: 'insensitive' } },
                { city: { contains: q, mode: 'insensitive' } },
              ],
            }
          : {},
        siteType ? { siteType } : {},
        status ? { status } : {},
      ],
    },
    include: {
      _count: {
        select: { rooms: true, racks: true },
      },
    },
    orderBy: { siteCode: 'asc' },
  });

  return NextResponse.json({ data: sites });
}

export async function POST(req: Request) {
  const { user, errorResponse } = await requireApiPermission('site.manage', req);
  if (errorResponse) return errorResponse;

  const body = await req.json().catch(() => null);
  const parsed = SiteCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ message: 'Validasi gagal', errors: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const existing = await prisma.site.findUnique({ where: { siteCode: parsed.data.siteCode } });
  if (existing) {
    return NextResponse.json({ message: `Kode site '${parsed.data.siteCode}' sudah terdaftar` }, { status: 409 });
  }

  const site = await prisma.site.create({
    data: parsed.data,
  });

  await logAudit({
    userId: user.id,
    action: 'CREATE',
    entityType: 'Site',
    entityId: site.id,
    afterData: site,
    req,
  });

  return NextResponse.json({ message: 'Site berhasil ditambahkan', data: site }, { status: 201 });
}
