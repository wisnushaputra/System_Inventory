import { requirePermission } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { TopologyClient } from './TopologyClient';

export const instant = false;

export default async function TopologyPage() {
  await requirePermission('topology.view');

  const [sites, categories] = await Promise.all([
    prisma.site.findMany({
      select: {
        id: true,
        siteCode: true,
        name: true,
        siteType: true,
        parentSiteId: true,
        parentSite: { select: { id: true, siteCode: true, name: true } },
      },
      orderBy: { siteCode: 'asc' },
    }),
    prisma.deviceCategory.findMany({
      select: { id: true, code: true, name: true },
      orderBy: { name: 'asc' },
    }),
  ]);

  return (
    <div className="space-y-4">
      <div className="animate-enter">
        <h1 className="text-2xl font-bold tracking-tight text-ink">
          Topologi Relasi Jaringan
        </h1>
        <p className="text-xs text-ink-secondary mt-1">
          Visualisasi graf keterhubungan infrastruktur berdasarkan dokumentasi port dan relasi aktif antarperangkat.
        </p>
      </div>

      <TopologyClient sites={sites} categories={categories} />
    </div>
  );
}
