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
      documents: {
        where: { archivedAt: null },
        include: { uploader: { select: { id: true, name: true, username: true } } },
        orderBy: { uploadedAt: 'desc' },
      },
      interfaces: {
        include: {
          ipAddresses: {
            include: { subnet: true },
          },
        },
        orderBy: { name: 'asc' },
      },
      ipAddresses: {
        include: {
          subnet: true,
          interface: { select: { id: true, name: true, label: true } },
        },
        orderBy: { address: 'asc' },
      },
    },
  });

  if (!device) notFound();

  const [history, connections] = await Promise.all([
    prisma.auditLog.findMany({
      where: { entityType: 'Device', entityId: id },
      include: { user: { select: { name: true, username: true } } },
      orderBy: { createdAt: 'desc' },
      take: 50,
    }),
    prisma.networkConnection.findMany({
      where: {
        OR: [
          { endpointAInterface: { deviceId: id } },
          { endpointBInterface: { deviceId: id } },
        ],
      },
      include: {
        endpointAInterface: {
          include: {
            device: { select: { id: true, hostname: true, deviceCode: true, archivedAt: true } },
          },
        },
        endpointBInterface: {
          include: {
            device: { select: { id: true, hostname: true, deviceCode: true, archivedAt: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  const canEdit = hasPermission(user, 'device.update') || hasPermission(user, 'interface.manage');
  const canArchive = hasPermission(user, 'device.archive');
  const canUploadDoc = hasPermission(user, 'document.upload');

  const managementIpObj = device.ipAddresses.find(
    (ip) => ip.purpose === 'management' && ip.allocationStatus === 'ALLOCATED'
  );

  const serializedDevice = {
    ...device,
    managementIp: managementIpObj?.address ?? null,
    installedAt: device.installedAt ? device.installedAt.toISOString() : null,
    warrantyExpiry: device.warrantyExpiry ? device.warrantyExpiry.toISOString() : null,
    archivedAt: device.archivedAt ? device.archivedAt.toISOString() : null,
    createdAt: device.createdAt.toISOString(),
    updatedAt: device.updatedAt.toISOString(),
    interfaces: device.interfaces.map((i) => ({
      ...i,
      createdAt: i.createdAt.toISOString(),
      updatedAt: i.updatedAt.toISOString(),
      ipAddresses: i.ipAddresses.map((ip) => ({
        ...ip,
        assignedAt: ip.assignedAt ? ip.assignedAt.toISOString() : null,
        releasedAt: ip.releasedAt ? ip.releasedAt.toISOString() : null,
      })),
    })),
    documents: device.documents.map((d) => ({
      id: d.id,
      deviceId: d.deviceId,
      originalFilename: d.originalFilename,
      mimeType: d.mimeType,
      fileSize: d.fileSize,
      checksum: d.checksum,
      category: d.category,
      sensitivityLevel: d.sensitivityLevel,
      description: d.description,
      uploadedAt: d.uploadedAt.toISOString(),
      uploader: d.uploader,
    })),
    ipAddresses: device.ipAddresses.map((ip) => ({
      ...ip,
      assignedAt: ip.assignedAt ? ip.assignedAt.toISOString() : null,
      releasedAt: ip.releasedAt ? ip.releasedAt.toISOString() : null,
    })),
    connections: connections.map((c) => ({
      ...c,
      createdAt: c.createdAt.toISOString(),
      updatedAt: c.updatedAt.toISOString(),
      archivedAt: c.archivedAt ? c.archivedAt.toISOString() : null,
      endpointAInterface: {
        ...c.endpointAInterface,
        device: {
          ...c.endpointAInterface.device,
          archivedAt: c.endpointAInterface.device.archivedAt
            ? c.endpointAInterface.device.archivedAt.toISOString()
            : null,
        },
      },
      endpointBInterface: {
        ...c.endpointBInterface,
        device: {
          ...c.endpointBInterface.device,
          archivedAt: c.endpointBInterface.device.archivedAt
            ? c.endpointBInterface.device.archivedAt.toISOString()
            : null,
        },
      },
    })),
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
      canUploadDoc={canUploadDoc}
    />
  );
}
