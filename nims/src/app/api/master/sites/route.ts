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
  parentSiteId: z.number().int().positive().optional().nullable(),
});

export async function GET(req: Request) {
  const { user, errorResponse } = await requireApiPermission('site.view');
  if (errorResponse) return errorResponse;

  const url = new URL(req.url);
  const q = url.searchParams.get('q')?.trim();
  const siteType = url.searchParams.get('siteType')?.trim();
  const status = url.searchParams.get('status')?.trim();
  const parentParam = url.searchParams.get('parentSiteId')?.trim();

  let parentFilter: object = {};
  if (parentParam === 'null') {
    parentFilter = { parentSiteId: null };
  } else if (parentParam && !isNaN(Number(parentParam))) {
    parentFilter = { parentSiteId: Number(parentParam) };
  }

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
        parentFilter,
      ],
    },
    include: {
      parentSite: {
        select: { id: true, siteCode: true, name: true, siteType: true },
      },
      _count: {
        select: { rooms: true, racks: true, devices: true, childSites: true },
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

  if (parsed.data.siteType === 'customer_site' && !parsed.data.parentSiteId) {
    return NextResponse.json({ message: 'Site pelanggan wajib memilih POP Induk.' }, { status: 400 });
  }
  if (parsed.data.siteType === 'pop' && parsed.data.parentSiteId) {
    return NextResponse.json({ message: 'POP Induk (Level 1) tidak boleh memiliki site induk.' }, { status: 400 });
  }
  if (parsed.data.parentSiteId) {
    const parent = await prisma.site.findUnique({ where: { id: parsed.data.parentSiteId } });
    if (!parent) {
      return NextResponse.json({ message: 'POP Induk yang dipilih tidak ditemukan.' }, { status: 400 });
    }
    if (parent.parentSiteId !== null) {
      return NextResponse.json({ message: 'Site induk harus berupa lokasi Level 1 (POP).' }, { status: 400 });
    }
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
