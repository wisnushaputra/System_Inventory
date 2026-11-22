import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireApiPermission } from '@/lib/auth';

export async function GET(req: Request) {
  const { user, errorResponse } = await requireApiPermission('topology.view', req);
  if (errorResponse) return errorResponse;

  const url = new URL(req.url);
  const level = url.searchParams.get('level');
  const popId = url.searchParams.get('popId');
  const siteId = url.searchParams.get('siteId');
  const isInternalOnly = url.searchParams.get('isInternalOnly') === 'true';
  const categoryId = url.searchParams.get('categoryId');
  const relationType = url.searchParams.get('relationType');
  const medium = url.searchParams.get('medium');

  // ========================================================
  // LEVEL 1: TOPOLOGI POP (Root Pusat -> Simpul-Simpul POP)
  // ========================================================
  if (level === 'pops') {
    const pops = await prisma.site.findMany({
      where: {
        OR: [{ siteType: 'pop' }, { parentSiteId: null }],
      },
      include: {
        childSites: {
          select: {
            id: true,
            _count: { select: { devices: { where: { archivedAt: null } } } },
          },
        },
        _count: {
          select: { devices: { where: { archivedAt: null } } },
        },
      },
      orderBy: { siteCode: 'asc' },
    });

    const rootX = Math.max(1, pops.length - 1) * 150 + 40;
    const rootNode = {
      id: 'root-noc',
      type: 'rootNode',
      position: { x: rootX, y: 30 },
      data: {
        title: 'NOC / Core Backbone Network',
        subtitle: 'Pusat Distribusi Jaringan & Gateway Utama',
        popCount: pops.length,
      },
    };

    const popNodes = pops.map((pop, idx) => {
      const directDeviceCount = pop._count.devices;
      const childDeviceCount = pop.childSites.reduce((acc, cs) => acc + cs._count.devices, 0);
      const totalDeviceCount = directDeviceCount + childDeviceCount;

      return {
        id: `pop-${pop.id}`,
        type: 'popNode',
        position: { x: idx * 300 + 40, y: 220 },
        data: {
          id: pop.id,
          siteCode: pop.siteCode,
          name: pop.name,
          city: pop.city || 'Kota belum diatur',
          province: pop.province || '',
          customerSiteCount: pop.childSites.length,
          directDeviceCount,
          totalDeviceCount,
          status: pop.status,
        },
      };
    });

    const edges = pops.map((pop) => ({
      id: `edge-root-pop-${pop.id}`,
      source: 'root-noc',
      target: `pop-${pop.id}`,
      type: 'default',
      animated: true,
      style: { stroke: '#1d4ed8', strokeWidth: 2 },
      data: {
        label: 'Backbone Link',
      },
    }));

    return NextResponse.json({
      nodes: [rootNode, ...popNodes],
      edges,
      metadata: {
        level: 'pops',
        totalNodes: popNodes.length + 1,
        totalEdges: edges.length,
      },
    });
  }

  // ========================================================
  // LEVEL 2: TOPOLOGI SITE (POP Induk -> Simpul-Simpul Customer)
  // ========================================================
  if (level === 'sites') {
    const pid = parseInt(popId || '', 10);
    if (isNaN(pid)) {
      return NextResponse.json({ message: 'popId diperlukan untuk level sites' }, { status: 400 });
    }

    const pop = await prisma.site.findUnique({
      where: { id: pid },
      include: {
        _count: {
          select: { devices: { where: { archivedAt: null } } },
        },
      },
    });

    if (!pop) {
      return NextResponse.json({ message: 'POP tidak ditemukan' }, { status: 404 });
    }

    const childSites = await prisma.site.findMany({
      where: { parentSiteId: pid },
      include: {
        _count: {
          select: { devices: { where: { archivedAt: null } } },
        },
      },
      orderBy: { siteCode: 'asc' },
    });

    const parentNode = {
      id: `pop-parent-${pop.id}`,
      type: 'popParentNode',
      position: { x: Math.max(1, childSites.length) * 150 + 40, y: 30 },
      data: {
        id: pop.id,
        siteCode: pop.siteCode,
        name: pop.name,
        city: pop.city,
        customerSiteCount: childSites.length,
        directDeviceCount: pop._count.devices,
      },
    };

    const customerNodes = childSites.map((cs, idx) => ({
      id: `site-${cs.id}`,
      type: 'siteNode',
      position: { x: idx * 300 + 40, y: 220 },
      data: {
        id: cs.id,
        popId: pop.id,
        siteCode: cs.siteCode,
        name: cs.name,
        siteType: cs.siteType,
        address: cs.address || cs.city || 'Alamat belum diatur',
        city: cs.city,
        status: cs.status,
        deviceCount: cs._count.devices,
        popName: pop.name,
      },
    }));

    const customerEdges = childSites.map((cs) => ({
      id: `edge-pop-site-${cs.id}`,
      source: `pop-parent-${pop.id}`,
      target: `site-${cs.id}`,
      type: 'default',
      animated: true,
      style: { stroke: '#0ea5e9', strokeWidth: 2 },
      data: {
        label: 'Akses Pelanggan',
      },
    }));

    const allNodes: any[] = [parentNode, ...customerNodes];
    const allEdges: any[] = [...customerEdges];

    if (pop._count.devices > 0) {
      const internalNode = {
        id: `site-internal-${pop.id}`,
        type: 'siteNode',
        position: { x: childSites.length * 300 + 40, y: 220 },
        data: {
          id: pop.id,
          popId: pop.id,
          siteCode: `${pop.siteCode}-INT`,
          name: `Infrastruktur Internal ${pop.name}`,
          siteType: 'pop_internal',
          isInternalOnly: true,
          address: pop.address || pop.city || '',
          city: pop.city,
          status: pop.status,
          deviceCount: pop._count.devices,
          popName: pop.name,
        },
      };
      allNodes.push(internalNode);
      allEdges.push({
        id: `edge-pop-internal-${pop.id}`,
        source: `pop-parent-${pop.id}`,
        target: `site-internal-${pop.id}`,
        type: 'default',
        animated: true,
        style: { stroke: '#d97706', strokeWidth: 2, strokeDasharray: '4,4' },
        data: {
          label: 'Internal POP',
        },
      });
    }

    return NextResponse.json({
      nodes: allNodes,
      edges: allEdges,
      metadata: {
        level: 'sites',
        pop: { id: pop.id, siteCode: pop.siteCode, name: pop.name },
        totalNodes: allNodes.length,
        totalEdges: allEdges.length,
      },
    });
  }

  // ========================================================
  // LEVEL 3 / DEFAULT: TOPOLOGI PERANGKAT & KONEKSI KABEL
  // ========================================================

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
        stroke: isPhysical ? '#1d4ed8' : '#0284c7', // Cobalt untuk physical, Sky untuk logical
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
      level: 'devices',
      totalNodes: nodes.length,
      totalEdges: edges.length,
    },
  });
}
