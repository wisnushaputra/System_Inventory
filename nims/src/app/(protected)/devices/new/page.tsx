import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/auth';
import { DeviceForm } from '../DeviceForm';

export const instant = false;

export default async function NewDevicePage({
  searchParams,
}: {
  searchParams?: Promise<{ siteId?: string }>;
}) {
  await requirePermission('device.create');

  const resolvedParams = searchParams ? await searchParams : {};
  const prefillSiteId = resolvedParams.siteId ? parseInt(resolvedParams.siteId, 10) : undefined;

  const [categories, vendors, models, sites, rooms, racks] = await Promise.all([
    prisma.deviceCategory.findMany({ select: { id: true, name: true }, orderBy: { name: 'asc' } }),
    prisma.vendor.findMany({ select: { id: true, name: true }, orderBy: { name: 'asc' } }),
    prisma.deviceModel.findMany({
      select: { id: true, modelName: true, vendorId: true, modelCode: true },
      orderBy: { modelName: 'asc' },
    }),
    prisma.site.findMany({ select: { id: true, name: true, siteCode: true }, orderBy: { siteCode: 'asc' } }),
    prisma.room.findMany({ select: { id: true, name: true, siteId: true }, orderBy: { name: 'asc' } }),
    prisma.rack.findMany({ select: { id: true, name: true, siteId: true, roomId: true }, orderBy: { name: 'asc' } }),
  ]);

  const mappedModels = models.map((m) => ({
    id: m.id,
    name: m.modelName,
    vendorId: m.vendorId,
    modelCode: m.modelCode,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Tambah Perangkat Baru</h1>
        <p className="text-sm text-slate-500">
          Daftarkan perangkat baru ke dalam inventaris jaringan NIMS.
        </p>
      </div>

      <DeviceForm
        initialData={prefillSiteId ? { siteId: prefillSiteId } : undefined}
        categories={categories}
        vendors={vendors}
        models={mappedModels}
        sites={sites}
        rooms={rooms}
        racks={racks}
      />
    </div>
  );
}
