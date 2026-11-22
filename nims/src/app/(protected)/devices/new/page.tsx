import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/auth';
import { DeviceForm } from '../DeviceForm';

export const instant = false;

export default async function NewDevicePage({
  searchParams,
}: {
  searchParams?: Promise<{ siteId?: string; cloneFrom?: string }>;
}) {
  await requirePermission('device.create');

  const resolvedParams = searchParams ? await searchParams : {};
  const prefillSiteId = resolvedParams.siteId ? parseInt(resolvedParams.siteId, 10) : undefined;
  const cloneFromId = resolvedParams.cloneFrom ? parseInt(resolvedParams.cloneFrom, 10) : undefined;

  const [categories, vendors, models, sites, rooms, racks, sourceDevice] = await Promise.all([
    prisma.deviceCategory.findMany({ select: { id: true, name: true }, orderBy: { name: 'asc' } }),
    prisma.vendor.findMany({ select: { id: true, name: true }, orderBy: { name: 'asc' } }),
    prisma.deviceModel.findMany({
      select: { id: true, modelName: true, vendorId: true, modelCode: true },
      orderBy: { modelName: 'asc' },
    }),
    prisma.site.findMany({ select: { id: true, name: true, siteCode: true }, orderBy: { siteCode: 'asc' } }),
    prisma.room.findMany({ select: { id: true, name: true, siteId: true }, orderBy: { name: 'asc' } }),
    prisma.rack.findMany({ select: { id: true, name: true, siteId: true, roomId: true }, orderBy: { name: 'asc' } }),
    cloneFromId && !isNaN(cloneFromId)
      ? prisma.device.findUnique({
          where: { id: cloneFromId },
          include: {
            interfaces: {
              select: { name: true, interfaceType: true },
              orderBy: { name: 'asc' },
            },
          },
        })
      : Promise.resolve(null),
  ]);

  const mappedModels = models.map((m) => ({
    id: m.id,
    name: m.modelName,
    vendorId: m.vendorId,
    modelCode: m.modelCode,
  }));

  const targetSiteId =
    prefillSiteId && !isNaN(prefillSiteId) ? prefillSiteId : sourceDevice?.siteId;
  const sameSiteAsSource = Boolean(sourceDevice && targetSiteId === sourceDevice.siteId);

  const initialData = sourceDevice
    ? {
        deviceCode: '',
        hostname: '',
        serialNumber: '',
        categoryId: sourceDevice.categoryId,
        vendorId: sourceDevice.vendorId,
        modelId: sourceDevice.modelId,
        siteId: targetSiteId,
        roomId: sameSiteAsSource ? sourceDevice.roomId : null,
        rackId: sameSiteAsSource ? sourceDevice.rackId : null,
        networkRole: sourceDevice.networkRole,
        inventoryStatus: 'PLANNED',
        ownerTeam: sourceDevice.ownerTeam,
        description: sourceDevice.description,
        managementNotes: sourceDevice.managementNotes,
      }
    : targetSiteId
    ? { siteId: targetSiteId }
    : undefined;

  const cloneSource = sourceDevice
    ? {
        id: sourceDevice.id,
        deviceCode: sourceDevice.deviceCode,
        hostname: sourceDevice.hostname,
        interfaces: sourceDevice.interfaces,
      }
    : undefined;

  return (
    <div className="space-y-6">
      <div className="animate-enter">
        <h1 className="text-2xl font-bold tracking-tight text-ink">
          {cloneSource ? 'Duplikat Perangkat sebagai Unit Baru' : 'Tambah Perangkat Baru'}
        </h1>
        <p className="text-sm text-ink-secondary mt-1">
          {cloneSource
            ? `Menyalin spesifikasi hardware, role, dan struktur port dari ${cloneSource.hostname} (${cloneSource.deviceCode}) untuk rollout cepat.`
            : 'Daftarkan perangkat baru ke dalam inventaris jaringan Passnet Inventory Sistem.'}
        </p>
      </div>

      <DeviceForm
        initialData={initialData}
        cloneSource={cloneSource}
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
