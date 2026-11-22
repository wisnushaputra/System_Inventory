import { prisma } from '@/lib/prisma';
import { requirePermission, hasPermission } from '@/lib/auth';
import { DevicesPageClient } from './DevicesPageClient';

export const instant = false;

export default async function DevicesPage(props: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requirePermission('device.view');
  const sp = props.searchParams ? await props.searchParams : {};
  const pick = (k: string) => (typeof sp[k] === 'string' ? sp[k] : '');

  const initialFilters = {
    view: pick('view'),
    q: pick('q'),
    categoryId: pick('categoryId'),
    vendorId: pick('vendorId'),
    siteId: pick('siteId'),
    inventoryStatus: pick('inventoryStatus'),
    anomaly: pick('anomaly'),
    isArchived: pick('isArchived') === 'true',
    page: Math.max(1, parseInt(pick('page') || '1', 10) || 1),
  };

  const [categories, vendors, sites] = await Promise.all([
    prisma.deviceCategory.findMany({ orderBy: { name: 'asc' } }),
    prisma.vendor.findMany({ orderBy: { name: 'asc' } }),
    prisma.site.findMany({ orderBy: { siteCode: 'asc' } }),
  ]);

  const canCreate = hasPermission(user, 'device.create');
  const canUpdate = hasPermission(user, 'device.update');
  const canArchive = hasPermission(user, 'device.archive');
  const canExport = hasPermission(user, 'report.export');
  const canManageSites = hasPermission(user, 'site.manage');

  return (
    <DevicesPageClient
      categories={categories}
      vendors={vendors}
      sites={sites}
      canCreate={canCreate}
      canUpdate={canUpdate}
      canArchive={canArchive}
      canExport={canExport}
      canManageSites={canManageSites}
      initialFilters={initialFilters}
    />
  );
}
