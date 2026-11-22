import { prisma } from '@/lib/prisma';
import { requirePermission, hasPermission } from '@/lib/auth';
import { SiteMapClient, type MapSiteItem } from './SiteMapClient';

export const instant = false;

export default async function SiteMapPage(props: {
  searchParams?: Promise<{ siteId?: string }>;
}) {
  const user = await requirePermission('site.view');
  const sp = props.searchParams ? await props.searchParams : {};
  const parsedSiteId = sp.siteId ? parseInt(sp.siteId, 10) : NaN;
  const initialSiteId = !isNaN(parsedSiteId) && parsedSiteId > 0 ? parsedSiteId : null;

  const sites = await prisma.site.findMany({
    include: {
      parentSite: {
        select: {
          id: true,
          siteCode: true,
          name: true,
          latitude: true,
          longitude: true,
        },
      },
      _count: {
        select: {
          devices: { where: { archivedAt: null } },
          racks: true,
          childSites: true,
        },
      },
    },
    orderBy: { siteCode: 'asc' },
  });

  const serializedSites: MapSiteItem[] = sites.map((s) => ({
    id: s.id,
    siteCode: s.siteCode,
    name: s.name,
    siteType: s.siteType,
    address: s.address,
    city: s.city,
    province: s.province,
    latitude: s.latitude,
    longitude: s.longitude,
    status: s.status,
    parentSiteId: s.parentSiteId,
    parentSite: s.parentSite,
    deviceCount: s._count.devices,
    rackCount: s._count.racks,
    childSiteCount: s._count.childSites,
  }));

  const canManageSites = hasPermission(user, 'site.manage');

  return (
    <SiteMapClient
      initialSites={serializedSites}
      canManageSites={canManageSites}
      initialSiteId={initialSiteId}
    />
  );
}
