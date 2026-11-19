import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/auth';
import { DeviceForm } from '../../DeviceForm';

export const instant = false;

export default async function EditDevicePage(props: { params: Promise<{ id: string }> }) {
  await requirePermission('device.update');

  const params = await props.params;
  const id = parseInt(params.id, 10);
  if (isNaN(id)) notFound();

  const device = await prisma.device.findUnique({ where: { id } });
  if (!device) notFound();

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

  const initialData = {
    id: device.id,
    deviceCode: device.deviceCode,
    hostname: device.hostname,
    categoryId: device.categoryId,
    vendorId: device.vendorId,
    modelId: device.modelId,
    siteId: device.siteId,
    roomId: device.roomId,
    rackId: device.rackId,
    serialNumber: device.serialNumber,
    networkRole: device.networkRole,
    inventoryStatus: device.inventoryStatus,
    managementNotes: device.managementNotes,
    description: device.description,
    installedAt: device.installedAt ? device.installedAt.toISOString() : null,
    warrantyExpiry: device.warrantyExpiry ? device.warrantyExpiry.toISOString() : null,
    ownerTeam: device.ownerTeam,
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          Ubah Data Perangkat: {device.hostname}
        </h1>
        <p className="text-sm text-slate-500">
          Perbarui atribut identitas, lokasi, atau status perangkat inventaris.
        </p>
      </div>

      <DeviceForm
        initialData={initialData}
        categories={categories}
        vendors={vendors}
        models={mappedModels}
        sites={sites}
        rooms={rooms}
        racks={racks}
        isEdit={true}
      />
    </div>
  );
}
