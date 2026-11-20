import { requirePermission, hasPermission } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { DashboardClient } from './DashboardClient';

export const instant = false;

export default async function DashboardPage() {
  const user = await requirePermission('dashboard.view');

  const canCreateDevice = hasPermission(user, 'device.create');
  const canViewAudit = hasPermission(user, 'audit.view');

  // Load data awal langsung dari database di server-side
  const [
    totalActiveDevices,
    totalArchivedDevices,
    totalSites,
    totalSubnets,
    totalConnections,
    categories,
    statusGroups,
    sites,
    recentAuditLogs,
    activeDevicesWithRelations,
  ] = await Promise.all([
    prisma.device.count({ where: { archivedAt: null } }),
    prisma.device.count({ where: { archivedAt: { not: null } } }),
    prisma.site.count(),
    prisma.subnet.count(),
    prisma.networkConnection.count({ where: { archivedAt: null } }),
    prisma.deviceCategory.findMany({
      select: {
        id: true,
        code: true,
        name: true,
        _count: {
          select: { devices: { where: { archivedAt: null } } },
        },
      },
      orderBy: { name: 'asc' },
    }),
    prisma.device.groupBy({
      by: ['inventoryStatus'],
      where: { archivedAt: null },
      _count: { _all: true },
    }),
    prisma.site.findMany({
      select: {
        id: true,
        siteCode: true,
        name: true,
        _count: {
          select: { devices: { where: { archivedAt: null } } },
        },
      },
      orderBy: { name: 'asc' },
    }),
    prisma.auditLog.findMany({
      take: 10,
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { id: true, name: true, username: true } },
      },
    }),
    prisma.device.findMany({
      where: { archivedAt: null },
      select: {
        id: true,
        deviceCode: true,
        hostname: true,
        serialNumber: true,
        modelId: true,
        roomId: true,
        rackId: true,
        category: { select: { name: true } },
        site: { select: { name: true, siteCode: true } },
        ipAddresses: {
          where: { purpose: 'management', allocationStatus: 'ALLOCATED' },
          select: { id: true, address: true },
        },
      },
      orderBy: { updatedAt: 'desc' },
    }),
  ]);

  const devicesByCategory = categories.map((cat) => ({
    id: cat.id,
    code: cat.code,
    name: cat.name,
    count: cat._count.devices,
  }));

  const statusCountMap: Record<string, number> = {
    ACTIVE: 0,
    PLANNED: 0,
    MAINTENANCE: 0,
    RETIRED: 0,
    LOST: 0,
  };
  statusGroups.forEach((g) => {
    statusCountMap[g.inventoryStatus] = g._count._all;
  });

  const devicesByStatus = Object.entries(statusCountMap).map(([status, count]) => ({
    status,
    count,
  }));

  const devicesBySite = sites.map((s) => ({
    id: s.id,
    siteCode: s.siteCode,
    name: s.name,
    count: s._count.devices,
  }));

  const incompleteDevices = [];
  for (const dev of activeDevicesWithRelations) {
    const missingFields: string[] = [];
    if (dev.ipAddresses.length === 0) missingFields.push('Management IP');
    if (!dev.serialNumber || dev.serialNumber.trim() === '') missingFields.push('Serial Number');
    if (!dev.modelId) missingFields.push('Model Hardware');
    if (!dev.roomId && !dev.rackId) missingFields.push('Ruang / Rak');

    if (missingFields.length > 0) {
      incompleteDevices.push({
        id: dev.id,
        deviceCode: dev.deviceCode,
        hostname: dev.hostname,
        category: dev.category.name,
        site: `${dev.site.siteCode} - ${dev.site.name}`,
        missingFields,
      });
    }
  }

  const initialStats = {
    overview: {
      totalActiveDevices,
      totalArchivedDevices,
      totalDevices: totalActiveDevices + totalArchivedDevices,
      totalSites,
      totalSubnets,
      totalConnections,
      incompleteCount: incompleteDevices.length,
      completenessPercentage:
        totalActiveDevices > 0
          ? Math.round(((totalActiveDevices - incompleteDevices.length) / totalActiveDevices) * 100)
          : 100,
    },
    devicesByCategory,
    devicesByStatus,
    devicesBySite,
    incompleteDevices: incompleteDevices.slice(0, 10),
    recentActivities: recentAuditLogs.map((log) => ({
      id: log.id,
      action: log.action,
      entityType: log.entityType,
      entityId: log.entityId,
      createdAt: log.createdAt.toISOString(),
      user: log.user,
    })),
  };

  return (
    <DashboardClient
      initialStats={initialStats}
      user={{ name: user.name, role: { name: user.role.name } }}
      canCreateDevice={canCreateDevice}
      canViewAudit={canViewAudit}
    />
  );
}
