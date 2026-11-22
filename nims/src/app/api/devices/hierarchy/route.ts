import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireApiPermission } from '@/lib/auth';

export async function GET(req: Request) {
  const { errorResponse } = await requireApiPermission('device.view');
  if (errorResponse) return errorResponse;

  const url = new URL(req.url);
  const popIdParam = url.searchParams.get('popId');
  const siteIdParam = url.searchParams.get('siteId');
  const q = url.searchParams.get('q')?.trim();

  // 1. Level 3 Context: Site detail + Breadcrumbs
  if (siteIdParam) {
    const siteId = parseInt(siteIdParam, 10);
    if (isNaN(siteId)) {
      return NextResponse.json({ message: 'siteId tidak valid' }, { status: 400 });
    }

    const site = await prisma.site.findUnique({
      where: { id: siteId },
      include: {
        parentSite: {
          select: { id: true, siteCode: true, name: true, city: true, siteType: true },
        },
        _count: {
          select: {
            devices: { where: { archivedAt: null } },
            rooms: true,
            racks: true,
          },
        },
      },
    });

    if (!site) {
      return NextResponse.json({ message: 'Site tidak ditemukan' }, { status: 404 });
    }

    return NextResponse.json({
      data: {
        site,
        isPop: site.siteType === 'pop' || site.parentSiteId === null,
        parentPop: site.parentSite ?? (site.siteType === 'pop' ? site : null),
      },
    });
  }

  // 2. Level 2: Customer sites under a specific POP
  if (popIdParam) {
    const popId = parseInt(popIdParam, 10);
    if (isNaN(popId)) {
      return NextResponse.json({ message: 'popId tidak valid' }, { status: 400 });
    }

    const pop = await prisma.site.findUnique({
      where: { id: popId },
      include: {
        _count: {
          select: {
            devices: { where: { archivedAt: null } },
            childSites: true,
          },
        },
      },
    });

    if (!pop) {
      return NextResponse.json({ message: 'POP tidak ditemukan' }, { status: 404 });
    }

    const childSites = await prisma.site.findMany({
      where: {
        parentSiteId: popId,
        ...(q
          ? {
              OR: [
                { siteCode: { contains: q, mode: 'insensitive' } },
                { name: { contains: q, mode: 'insensitive' } },
                { address: { contains: q, mode: 'insensitive' } },
                { city: { contains: q, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      include: {
        _count: {
          select: {
            devices: { where: { archivedAt: null } },
          },
        },
      },
      orderBy: { name: 'asc' },
    });

    const formattedChildSites = childSites.map((cs) => ({
      id: cs.id,
      siteCode: cs.siteCode,
      name: cs.name,
      siteType: cs.siteType,
      address: cs.address,
      city: cs.city,
      province: cs.province,
      latitude: cs.latitude,
      longitude: cs.longitude,
      status: cs.status,
      description: cs.description,
      deviceCount: cs._count.devices,
    }));

    return NextResponse.json({
      data: {
        pop: {
          id: pop.id,
          siteCode: pop.siteCode,
          name: pop.name,
          city: pop.city,
          province: pop.province,
          address: pop.address,
          latitude: pop.latitude,
          longitude: pop.longitude,
          status: pop.status,
          description: pop.description,
          directDeviceCount: pop._count.devices,
          childSiteCount: pop._count.childSites,
        },
        customerSites: formattedChildSites,
      },
    });
  }

  // 3. Level 1: All POPs with aggregated customer sites & device counts
  const pops = await prisma.site.findMany({
    where: {
      OR: [
        { siteType: 'pop' },
        { parentSiteId: null },
      ],
      ...(q
        ? {
            OR: [
              { siteCode: { contains: q, mode: 'insensitive' } },
              { name: { contains: q, mode: 'insensitive' } },
              { city: { contains: q, mode: 'insensitive' } },
            ],
          }
        : {}),
    },
    include: {
      childSites: {
        select: {
          id: true,
          _count: {
            select: { devices: { where: { archivedAt: null } } },
          },
        },
      },
      _count: {
        select: {
          devices: { where: { archivedAt: null } },
        },
      },
    },
    orderBy: { siteCode: 'asc' },
  });

  const formattedPops = pops.map((pop) => {
    const directDeviceCount = pop._count.devices;
    const childDeviceCount = pop.childSites.reduce((acc, cs) => acc + cs._count.devices, 0);
    const totalDeviceCount = directDeviceCount + childDeviceCount;

    return {
      id: pop.id,
      siteCode: pop.siteCode,
      name: pop.name,
      siteType: pop.siteType,
      city: pop.city,
      province: pop.province,
      address: pop.address,
      latitude: pop.latitude,
      longitude: pop.longitude,
      status: pop.status,
      description: pop.description,
      customerSiteCount: pop.childSites.length,
      directDeviceCount,
      totalDeviceCount,
    };
  });

  return NextResponse.json({
    data: {
      pops: formattedPops,
      totalPops: formattedPops.length,
    },
  });
}
