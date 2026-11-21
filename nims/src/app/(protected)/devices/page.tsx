import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { requirePermission, hasPermission } from '@/lib/auth';
import { DevicesPageClient } from './DevicesPageClient';
import { IconDownload, IconUpload, IconPlus } from '@/components/Icons';

export const instant = false;

export default async function DevicesPage() {
  const user = await requirePermission('device.view');

  const [categories, vendors, sites] = await Promise.all([
    prisma.deviceCategory.findMany({ orderBy: { name: 'asc' } }),
    prisma.vendor.findMany({ orderBy: { name: 'asc' } }),
    prisma.site.findMany({ orderBy: { siteCode: 'asc' } }),
  ]);

  const canCreate = hasPermission(user, 'device.create');
  const canArchive = hasPermission(user, 'device.archive');
  const canExport = hasPermission(user, 'report.export');

  return (
    <div className="space-y-6">
      <div className="animate-enter flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-ink">Inventaris Perangkat</h1>
          <p className="mt-1 text-sm text-ink-secondary">
            Navigasi bertingkat dari Point of Presence (POP) ke Site Pelanggan dan unit perangkat.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {canExport && (
            <a
              href="/api/export/devices"
              className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg border border-line bg-surface px-3.5 py-2 text-xs font-semibold text-ink-secondary shadow-xs transition-[background-color,border-color,color] duration-150 hover:border-line-strong hover:bg-subtle hover:text-ink"
            >
              <IconDownload className="h-4 w-4" />
              <span>Ekspor CSV</span>
            </a>
          )}
          {canCreate && (
            <Link
              href="/devices/import"
              className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg border border-line bg-surface px-3.5 py-2 text-xs font-semibold text-ink-secondary shadow-xs transition-[background-color,border-color,color] duration-150 hover:border-line-strong hover:bg-subtle hover:text-ink"
            >
              <IconUpload className="h-4 w-4" />
              <span>Impor CSV</span>
            </Link>
          )}
          {canCreate && (
            <Link
              href="/devices/new"
              className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg bg-accent px-4 py-2 text-xs font-semibold text-accent-fg shadow-xs transition-[background-color,transform] duration-150 hover:bg-accent-hover active:scale-[0.97]"
            >
              <IconPlus className="h-4 w-4" />
              <span>Tambah Perangkat</span>
            </Link>
          )}
        </div>
      </div>

      <DevicesPageClient
        categories={categories}
        vendors={vendors}
        sites={sites}
        canCreate={canCreate}
        canArchive={canArchive}
        canExport={canExport}
      />
    </div>
  );
}
