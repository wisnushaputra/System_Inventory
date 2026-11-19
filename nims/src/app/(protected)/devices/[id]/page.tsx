import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { requirePermission, hasPermission } from '@/lib/auth';
import { DeviceDetailClient } from './DeviceDetailClient';

export const instant = false;

export default async function DeviceDetailPage(props: { params: Promise<{ id: string }> }) {
  const user = await requirePermission('device.view');

  const params = await props.params;
  const id = parseInt(params.id, 10);
  if (isNaN(id)) notFound();

  const device = await prisma.device.findUnique({
    where: { id },
    include: {
      category: true,
      vendor: true,
      model: true,
      site: true,
      room: true,
      rack: true,
      creator: { select: { id: true, name: true, username: true } },
      updater: { select: { id: true, name: true, username: true } },
    },
  });

  if (!device) notFound();

  const history = await prisma.auditLog.findMany({
    where: { entityType: 'Device', entityId: id },
    include: { user: { select: { name: true, username: true } } },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });

  const canEdit = hasPermission(user, 'device.update');
  const canArchive = hasPermission(user, 'device.archive');

  const serializedDevice = {
    ...device,
    installedAt: device.installedAt ? device.installedAt.toISOString() : null,
    warrantyExpiry: device.warrantyExpiry ? device.warrantyExpiry.toISOString() : null,
    archivedAt: device.archivedAt ? device.archivedAt.toISOString() : null,
    createdAt: device.createdAt.toISOString(),
    updatedAt: device.updatedAt.toISOString(),
  };

  const serializedHistory = history.map((h) => ({
    id: h.id,
    action: h.action,
    createdAt: h.createdAt.toISOString(),
    user: h.user,
    beforeData: h.beforeData,
    afterData: h.afterData,
  }));

  return (
    <DeviceDetailClient
      device={serializedDevice}
      history={serializedHistory}
      canEdit={canEdit}
      canArchive={canArchive}
    />
  );
}
