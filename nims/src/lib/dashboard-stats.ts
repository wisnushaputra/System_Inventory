import { prisma } from '@/lib/prisma';

export interface DuplicateSerialGroup {
  serialNumber: string;
  count: number;
  devices: {
    id: number;
    deviceCode: string;
    hostname: string;
    siteCode: string;
  }[];
}

export interface DuplicateMacGroup {
  macAddress: string;
  count: number;
  interfaces: {
    id: number;
    name: string;
    deviceId: number;
    deviceCode: string;
    hostname: string;
    siteCode: string;
  }[];
}

export interface SiteMissingCoordsItem {
  id: number;
  siteCode: string;
  name: string;
  siteType: string;
}

export interface DashboardStatsData {
  overview: {
    totalActiveDevices: number;
    totalArchivedDevices: number;
    totalDevices: number;
    totalSites: number;
    totalSubnets: number;
    totalConnections: number;
    incompleteCount: number;
    completenessPercentage: number;
  };
  devicesByCategory: { id: number; code: string; name: string; count: number }[];
  devicesByStatus: { status: string; count: number }[];
  devicesBySite: { id: number; siteCode: string; name: string; count: number }[];
  incompleteDevices: {
    id: number;
    deviceCode: string;
    hostname: string;
    category: string;
    site: string;
    missingFields: string[];
  }[];
  dataHygiene: {
    duplicateSerialNumbers: DuplicateSerialGroup[];
    duplicateMacAddresses: DuplicateMacGroup[];
    anomalies: {
      activeWithoutIpCount: number;
      activeWithoutPortsCount: number;
      activeWithoutSerialCount: number;
      activeWithoutRackCount: number;
      sitesWithoutCoordsCount: number;
      sitesWithoutCoords: SiteMissingCoordsItem[];
      totalAnomalySignals: number;
    };
  };
  recentActivities: {
    id: number;
    action: string;
    entityType: string;
    entityId: number | null;
    createdAt: string;
    user: { id: number; name: string; username: string } | null;
  }[];
}

/**
 * Mengambil seluruh statistik dashboard inventaris termasuk deteksi duplikat Serial Number/MAC Address dan anomali data.
 */
export async function getDashboardStats(): Promise<DashboardStatsData> {
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
    activeInterfacesWithMac,
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
        siteType: true,
        status: true,
        latitude: true,
        longitude: true,
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
        inventoryStatus: true,
        modelId: true,
        roomId: true,
        rackId: true,
        category: { select: { name: true } },
        site: { select: { name: true, siteCode: true } },
        ipAddresses: {
          where: { purpose: 'management', allocationStatus: 'ALLOCATED' },
          select: { id: true, address: true },
        },
        _count: {
          select: { interfaces: true },
        },
      },
      orderBy: { updatedAt: 'desc' },
    }),
    prisma.interface.findMany({
      where: {
        macAddress: { not: null },
        device: { archivedAt: null },
      },
      select: {
        id: true,
        name: true,
        macAddress: true,
        device: {
          select: {
            id: true,
            deviceCode: true,
            hostname: true,
            site: { select: { siteCode: true } },
          },
        },
      },
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

  const incompleteDevices: DashboardStatsData['incompleteDevices'] = [];
  const serialGroups = new Map<string, DuplicateSerialGroup['devices']>();

  let activeWithoutIpCount = 0;
  let activeWithoutPortsCount = 0;
  let activeWithoutSerialCount = 0;
  let activeWithoutRackCount = 0;

  for (const dev of activeDevicesWithRelations) {
    const missingFields: string[] = [];
    const hasMgmtIp = dev.ipAddresses.length > 0;
    const trimmedSn = dev.serialNumber?.trim() || '';
    const hasPlacement = Boolean(dev.roomId || dev.rackId);

    if (!hasMgmtIp) missingFields.push('Management IP');
    if (!trimmedSn) missingFields.push('Serial Number');
    if (!dev.modelId) missingFields.push('Model Hardware');
    if (!hasPlacement) missingFields.push('Ruang / Rak');

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

    if (!trimmedSn) {
      activeWithoutSerialCount += 1;
    } else {
      const normSn = trimmedSn.toUpperCase();
      const group = serialGroups.get(normSn) ?? [];
      group.push({
        id: dev.id,
        deviceCode: dev.deviceCode,
        hostname: dev.hostname,
        siteCode: dev.site.siteCode,
      });
      serialGroups.set(normSn, group);
    }

    if (!hasPlacement) {
      activeWithoutRackCount += 1;
    }

    if (dev.inventoryStatus === 'ACTIVE') {
      if (!hasMgmtIp) activeWithoutIpCount += 1;
      if (dev._count.interfaces === 0) activeWithoutPortsCount += 1;
    }
  }

  const duplicateSerialNumbers: DuplicateSerialGroup[] = Array.from(serialGroups.entries())
    .filter(([, devs]) => devs.length > 1)
    .map(([serialNumber, devs]) => ({
      serialNumber,
      count: devs.length,
      devices: devs,
    }))
    .sort((a, b) => b.count - a.count || a.serialNumber.localeCompare(b.serialNumber));

  const macGroups = new Map<string, DuplicateMacGroup['interfaces']>();
  for (const iface of activeInterfacesWithMac) {
    const trimmedMac = iface.macAddress?.trim() || '';
    if (!trimmedMac) continue;
    const normMac = trimmedMac.toUpperCase();
    const group = macGroups.get(normMac) ?? [];
    group.push({
      id: iface.id,
      name: iface.name,
      deviceId: iface.device.id,
      deviceCode: iface.device.deviceCode,
      hostname: iface.device.hostname,
      siteCode: iface.device.site.siteCode,
    });
    macGroups.set(normMac, group);
  }

  const duplicateMacAddresses: DuplicateMacGroup[] = Array.from(macGroups.entries())
    .filter(([, ifaces]) => ifaces.length > 1)
    .map(([macAddress, ifaces]) => ({
      macAddress,
      count: ifaces.length,
      interfaces: ifaces,
    }))
    .sort((a, b) => b.count - a.count || a.macAddress.localeCompare(b.macAddress));

  const sitesWithoutCoordsList: SiteMissingCoordsItem[] = sites
    .filter((s) => s.status === 'active' && (s.latitude === null || s.longitude === null))
    .map((s) => ({
      id: s.id,
      siteCode: s.siteCode,
      name: s.name,
      siteType: s.siteType,
    }));

  const sitesWithoutCoordsCount = sitesWithoutCoordsList.length;
  const totalAnomalySignals =
    duplicateSerialNumbers.length +
    duplicateMacAddresses.length +
    activeWithoutIpCount +
    activeWithoutPortsCount +
    sitesWithoutCoordsCount;

  return {
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
    dataHygiene: {
      duplicateSerialNumbers,
      duplicateMacAddresses,
      anomalies: {
        activeWithoutIpCount,
        activeWithoutPortsCount,
        activeWithoutSerialCount,
        activeWithoutRackCount,
        sitesWithoutCoordsCount,
        sitesWithoutCoords: sitesWithoutCoordsList.slice(0, 8),
        totalAnomalySignals,
      },
    },
    recentActivities: recentAuditLogs.map((log) => ({
      id: log.id,
      action: log.action,
      entityType: log.entityType,
      entityId: log.entityId,
      createdAt: log.createdAt.toISOString(),
      user: log.user,
    })),
  };
}
