import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireApiPermission } from '@/lib/auth';
import { logAudit } from '@/lib/audit';
import { parseCidr, validateHostIp } from '@/lib/ipam';
import { Prisma } from '@prisma/client';

const SubnetCreateSchema = z.object({
  name: z.string().trim().min(2, 'Nama subnet minimal 2 karakter').max(100),
  cidr: z.string().trim().min(7, 'CIDR wajib diisi (contoh: 192.168.1.0/24)'),
  siteId: z.number().int().positive().optional().nullable(),
  gatewayIp: z.string().trim().optional().nullable(),
  vlanId: z.number().int().min(1).max(4094).optional().nullable(),
  purpose: z.enum([
    'management',
    'loopback',
    'point_to_point',
    'access',
    'server',
    'public',
    'other',
  ]).default('management'),
  status: z.enum(['active', 'reserved', 'deprecated']).default('active'),
  description: z.string().max(500).optional().nullable(),
});

export async function GET(req: Request) {
  const { errorResponse } = await requireApiPermission('ipam.view');
  if (errorResponse) return errorResponse;

  const url = new URL(req.url);
  const siteId = url.searchParams.get('siteId');
  const purpose = url.searchParams.get('purpose');
  const status = url.searchParams.get('status');
  const q = url.searchParams.get('q')?.trim();

  const whereClause: any = {
    AND: [
      siteId ? { siteId: parseInt(siteId, 10) } : {},
      purpose ? { purpose } : {},
      status ? { status } : {},
      q
        ? {
            OR: [
              { name: { contains: q, mode: 'insensitive' } },
              { cidr: { contains: q, mode: 'insensitive' } },
              { description: { contains: q, mode: 'insensitive' } },
            ],
          }
        : {},
    ],
  };

  const subnets = await prisma.subnet.findMany({
    where: whereClause,
    include: {
      site: { select: { id: true, name: true, siteCode: true } },
      _count: {
        select: {
          ipAddresses: {
            where: { allocationStatus: 'ALLOCATED' },
          },
        },
      },
    },
    orderBy: { cidr: 'asc' },
  });

  // Tambahkan kalkulasi CIDR (total, usable hosts, dsb)
  const formatted = subnets.map((sub) => {
    try {
      const cidrInfo = parseCidr(sub.cidr);
      return {
        ...sub,
        cidrInfo,
        allocatedCount: sub._count.ipAddresses,
        availableCount: Math.max(0, cidrInfo.usableHosts - sub._count.ipAddresses),
      };
    } catch {
      return {
        ...sub,
        cidrInfo: null,
        allocatedCount: sub._count.ipAddresses,
        availableCount: 0,
      };
    }
  });

  return NextResponse.json({ data: formatted });
}

export async function POST(req: Request) {
  const { user, errorResponse } = await requireApiPermission('ipam.manage', req);
  if (errorResponse) return errorResponse;

  const body = await req.json().catch(() => null);
  const parsed = SubnetCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { message: 'Validasi form gagal', errors: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  // Validasi bitwise CIDR
  let cidrInfo;
  try {
    cidrInfo = parseCidr(parsed.data.cidr);
  } catch (err: unknown) {
    return NextResponse.json(
      { message: err instanceof Error ? err.message : 'Format CIDR tidak valid' },
      { status: 400 }
    );
  }

  // Jika gatewayIp diisi, validasi apakah host IP valid di subnet ini
  if (parsed.data.gatewayIp) {
    const gatewayCheck = validateHostIp(parsed.data.gatewayIp, cidrInfo.cidr);
    if (!gatewayCheck.valid) {
      return NextResponse.json(
        { message: `Gateway IP tidak valid: ${gatewayCheck.error}` },
        { status: 400 }
      );
    }
  }

  try {
    const subnet = await prisma.subnet.create({
      data: {
        name: parsed.data.name,
        cidr: cidrInfo.cidr, // gunakan canonical format dari parseCidr
        siteId: parsed.data.siteId || null,
        gatewayIp: parsed.data.gatewayIp || null,
        vlanId: parsed.data.vlanId || null,
        purpose: parsed.data.purpose,
        status: parsed.data.status,
        description: parsed.data.description || null,
      },
    });

    await logAudit({
      userId: user.id,
      action: 'CREATE_SUBNET',
      entityType: 'Subnet',
      entityId: subnet.id,
      afterData: subnet,
      req,
    });

    return NextResponse.json({
      message: `Subnet '${subnet.name}' (${subnet.cidr}) berhasil dibuat`,
      data: { ...subnet, cidrInfo },
    }, { status: 201 });
  } catch (err: unknown) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      return NextResponse.json(
        { message: `Subnet dengan CIDR '${cidrInfo.cidr}' sudah terdaftar` },
        { status: 409 }
      );
    }
    throw err;
  }
}
