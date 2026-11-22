import { prisma } from '@/lib/prisma';
import { requirePermission, hasPermission } from '@/lib/auth';
import { MasterDataClient } from './MasterDataClient';

export const instant = false;

type MasterTab = 'sites' | 'vendors' | 'categories' | 'models';

const VALID_MASTER_TABS = new Set<MasterTab>(['sites', 'vendors', 'categories', 'models']);

export default async function MasterDataPage(props: {
  searchParams?: Promise<{ tab?: string }>;
}) {
  const user = await requirePermission('site.view');
  const sp = props.searchParams ? await props.searchParams : {};
  const rawTab = sp.tab as MasterTab | undefined;
  const initialTab: MasterTab = rawTab && VALID_MASTER_TABS.has(rawTab) ? rawTab : 'sites';

  const [sites, vendors, categories, models] = await Promise.all([
    prisma.site.findMany({
      include: {
        parentSite: { select: { id: true, siteCode: true, name: true } },
        rooms: { include: { racks: true } },
        _count: { select: { racks: true } },
      },
      orderBy: { siteCode: 'asc' },
    }),
    prisma.vendor.findMany({
      include: { _count: { select: { models: true } } },
      orderBy: { name: 'asc' },
    }),
    prisma.deviceCategory.findMany({
      include: { _count: { select: { models: true } } },
      orderBy: { name: 'asc' },
    }),
    prisma.deviceModel.findMany({
      include: { vendor: true, category: true },
      orderBy: { modelName: 'asc' },
    }),
  ]);

  const canManageSites = hasPermission(user, 'site.manage');
  const canManageVendors = hasPermission(user, 'vendor.manage');

  return (
    <div className="space-y-6">
      <div className="animate-enter">
        <h1 className="text-2xl font-bold tracking-tight text-ink">Master Data</h1>
        <p className="text-sm text-ink-secondary mt-1">
          Kelola lokasi (site, ruangan, rak), vendor perangkat, kategori, dan model perangkat jaringan.
        </p>
      </div>

      <MasterDataClient
        sites={sites}
        vendors={vendors}
        categories={categories}
        models={models}
        canManageSites={canManageSites}
        canManageVendors={canManageVendors}
        initialTab={initialTab}
      />
    </div>
  );
}
