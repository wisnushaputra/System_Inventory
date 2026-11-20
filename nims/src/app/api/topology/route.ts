import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireApiPermission } from '@/lib/auth';

export async function GET(req: Request) {
  const { user, errorResponse } = await requireApiPermission('topology.view', req);
  if (errorResponse) return errorResponse;

  const url = new URL(req.url);
  const popId = url.searchParams.get('popId');
  const siteId = url.searchParams.get('siteId');
  const isInternalOnly = url.searchParams.get('isInternalOnly') === 'true';
  const categoryId = url.searchParams.get('categoryId');
  const relationType = url.searchParams.get('relationType');
  const medium = url.searchParams.get('medium');

  // Query filter untuk perangkat
  const deviceWhere: any = {
    archivedAt: null, // Sesuai BR-009: Perangkat terarsip tidak muncul di topologi default
  };

  if (siteId) {
    const sid = parseInt(siteId, 10);
    if (!isNaN(sid)) deviceWhere.siteId = sid;
  } else if (popId) {
    const pid = parseInt(popId, 10);
    if (!isNaN(pid)) {
      if (isInternalOnly) {
        deviceWhere.siteId = pid;
      } else {
        // Ambil perangkat yang langsung di POP tersebut ATAU di customer sites di bawah POP tersebut
        deviceWhere.OR = [
          { siteId: pid },
          { site: { parentSiteId: pid } },
        ];
      }
    }
  }

  if (categoryId) {
    const cid = parseInt(categoryId, 10);
    if (!isNaN(cid)) deviceWhere.categoryId = cid;
  }

  // Ambil perangkat yang cocok
  const devices = await prisma.device.findMany({
    where: deviceWhere,
    include: {
      category: { select: { id: true, code: true, name: true } },
      vendor: { select: { id: true, name: true } },
      model: { select: { id: true, modelName: true, modelCode: true } },
      site: {
        select: {
          id: true,
          siteCode: true,
          name: true,
          siteType: true,
          parentSiteId: true,
          parentSite: {
            select: { id: true, siteCode: true, name: true, siteType: true },
          },
        },
      },
      ipAddresses: {
        where: { purpose: 'management', allocationStatus: 'ALLOCATED' },
        select: { id: true, address: true },
      },
    },
    orderBy: { hostname: 'asc' },
  });

  const deviceIds = new Set(devices.map((d) => d.id));

  // Query relasi koneksi aktif antar perangkat
  const connWhere: any = {
    archivedAt: null, // Sesuai T4.4 & BR-009: Relasi terarsip disaring keluar
    endpointAInterface: { device: { archivedAt: null } },
    endpointBInterface: { device: { archivedAt: null } },
  };

  if (relationType) {
    connWhere.relationType = relationType;
  }

  if (medium) {
    connWhere.medium = medium;
  }

  const connections = await prisma.networkConnection.findMany({
    where: connWhere,
    include: {
      endpointAInterface: {
        include: {
          device: { select: { id: true, hostname: true, deviceCode: true } },
        },
      },
      endpointBInterface: {
        include: {
          device: { select: { id: true, hostname: true, deviceCode: true } },
        },
      },
    },
  });

  // Filter koneksi yang kedua ujung perangkatnya ada dalam filter devices
  const visibleConnections = connections.filter((conn) => {
    return (
      deviceIds.has(conn.endpointAInterface.deviceId) &&
      deviceIds.has(conn.endpointBInterface.deviceId)
    );
  });

  // Bentuk node data untuk React Flow
  const nodes = devices.map((dev, index) => {
    // Posisi awal melingkar / grid jika belum ada layout
    const cols = Math.ceil(Math.sqrt(devices.length)) || 1;
    const col = index % cols;
    const row = Math.floor(index / cols);

    const isPopCore = dev.site.siteType === 'pop' || dev.site.parentSiteId === null;
    const parentPop = dev.site.parentSite ?? (isPopCore ? { id: dev.site.id, siteCode: dev.site.siteCode, name: dev.site.name } : null);

    return {
      id: dev.id.toString(),
      type: 'deviceNode',
      position: { x: col * 260 + 50, y: row * 180 + 50 },
      data: {
        id: dev.id,
        hostname: dev.hostname,
        deviceCode: dev.deviceCode,
        category: dev.category.name,
        categoryCode: dev.category.code,
        vendor: dev.vendor.name,
        model: dev.model ? `${dev.model.modelName} (${dev.model.modelCode})` : null,
        site: dev.site.name,
        siteCode: dev.site.siteCode,
        siteType: dev.site.siteType,
        parentPop,
        isPopCore,
        managementIp: dev.ipAddresses[0]?.address || null,
        inventoryStatus: dev.inventoryStatus,
        networkRole: dev.networkRole,
      },
    };
  });

  // Bentuk edge data untuk React Flow
  const edges = visibleConnections.map((conn) => {
    const isPhysical = conn.relationType === 'physical';
    const isFiber = conn.medium === 'fiber';

    return {
      id: `conn-${conn.id}`,
      source: conn.endpointAInterface.deviceId.toString(),
      target: conn.endpointBInterface.deviceId.toString(),
      type: 'default',
      animated: isFiber, // Garis bergerak untuk fiber optic
      style: {
        stroke: isPhysical ? '#4f46e5' : '#0ea5e9', // Indigo untuk physical, Sky untuk logical
        strokeWidth: 2,
        strokeDasharray: isPhysical ? undefined : '5,5', // Garis putus-putus untuk logical
      },
      data: {
        id: conn.id,
        endpointA: {
          deviceId: conn.endpointAInterface.deviceId,
          hostname: conn.endpointAInterface.device.hostname,
          deviceCode: conn.endpointAInterface.device.deviceCode,
          portName: conn.endpointAInterface.name,
        },
        endpointB: {
          deviceId: conn.endpointBInterface.deviceId,
          hostname: conn.endpointBInterface.device.hostname,
          deviceCode: conn.endpointBInterface.device.deviceCode,
          portName: conn.endpointBInterface.name,
        },
        relationType: conn.relationType,
        medium: conn.medium,
        capacityMbps: conn.capacityMbps,
        label: conn.label,
        status: conn.status,
      },
    };
  });

  return NextResponse.json({
    nodes,
    edges,
    metadata: {
      totalNodes: nodes.length,
      totalEdges: edges.length,
    },
  });
}
