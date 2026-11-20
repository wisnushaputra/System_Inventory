import { prisma } from '@/lib/prisma';
import { requirePermission, hasPermission } from '@/lib/auth';
import { DeviceListClient } from './DeviceListClient';

export const instant = false;

export default async function DevicesPage() {
  const user = await requirePermission('device.view');

  const [categories, vendors, sites] = await Promise.all([
    prisma.deviceCategory.findMany({ orderBy: { name: 'asc' } }),
    prisma.vendor.findMany({ orderBy: { name: 'asc' } }),
    prisma.site.findMany({ orderBy: { name: 'asc' } }),
  ]);

  const canCreate = hasPermission(user, 'device.create');
  const canArchive = hasPermission(user, 'device.archive');
  const canExport = hasPermission(user, 'report.export');

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Inventaris Perangkat</h1>
          <p className="text-sm text-slate-500">
            Daftar perangkat jaringan aktif dan terarsip dengan filter kategori, vendor, dan lokasi.
          </p>
        </div>
        <div className="flex items-center space-x-2">
          {canExport && (
            <a
              href="/api/export/devices"
              className="inline-flex items-center justify-center rounded-md border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
            >
              📥 Ekspor CSV
            </a>
          )}
          {canCreate && (
            <a
              href="/devices/import"
              className="inline-flex items-center justify-center rounded-md border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
            >
              📤 Impor CSV
            </a>
          )}
          {canCreate && (
            <a
              href="/devices/new"
              className="inline-flex items-center justify-center rounded-md bg-indigo-600 px-3.5 py-2 text-xs font-semibold text-white shadow-sm hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-600"
            >
              + Tambah Perangkat
            </a>
          )}
        </div>
      </div>

      <DeviceListClient
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
