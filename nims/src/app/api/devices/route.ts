import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireApiPermission } from '@/lib/auth';
import { logAudit } from '@/lib/audit';

const DeviceCreateSchema = z.object({
  deviceCode: z.string().trim().min(2, 'Kode perangkat minimal 2 karakter').max(50, 'Kode perangkat maksimal 50 karakter').toUpperCase(),
  hostname: z.string().trim().min(2, 'Hostname minimal 2 karakter').max(100, 'Hostname maksimal 100 karakter'),
  categoryId: z.number().int().positive(),
  vendorId: z.number().int().positive(),
  modelId: z.number().int().positive().optional().nullable(),
  siteId: z.number().int().positive(),
  roomId: z.number().int().positive().optional().nullable(),
  rackId: z.number().int().positive().optional().nullable(),
  serialNumber: z.string().trim().max(100).optional().nullable(),
  networkRole: z.enum(['core', 'distribution', 'access', 'aggregation', 'cpe', 'server', 'other']).optional().nullable(),
  inventoryStatus: z.enum(['PLANNED', 'ACTIVE', 'MAINTENANCE', 'RETIRED', 'LOST']).default('PLANNED'),
  managementNotes: z.string().max(1000).optional().nullable(),
  description: z.string().max(1000).optional().nullable(),
  installedAt: z.string().datetime().optional().nullable().or(z.literal('')).transform((v) => (v ? new Date(v) : null)),
  warrantyExpiry: z.string().datetime().optional().nullable().or(z.literal('')).transform((v) => (v ? new Date(v) : null)),
  ownerTeam: z.string().trim().max(100).optional().nullable(),
  clonePortsFromDeviceId: z.number().int().positive().optional().nullable(),
});

export async function GET(req: Request) {
  const { errorResponse } = await requireApiPermission('device.view');
  if (errorResponse) return errorResponse;

  const url = new URL(req.url);
  const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
  const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') || '10', 10)));
  const skip = (page - 1) * limit;

  const q = url.searchParams.get('q')?.trim();
  const categoryId = url.searchParams.get('categoryId');
  const vendorId = url.searchParams.get('vendorId');
  const siteId = url.searchParams.get('siteId');
  const inventoryStatus = url.searchParams.get('inventoryStatus')?.trim();
  const networkRole = url.searchParams.get('networkRole')?.trim();
  const anomaly = url.searchParams.get('anomaly')?.trim();
  const isArchived = url.searchParams.get('isArchived') === 'true';

  const sortBy = url.searchParams.get('sortBy') || 'createdAt';
  const sortOrder = url.searchParams.get('sortOrder') === 'asc' ? 'asc' : 'desc';

  const whereClause: any = {
    AND: [
      isArchived ? { archivedAt: { not: null } } : { archivedAt: null },
      q
        ? {
            OR: [
              { hostname: { contains: q, mode: 'insensitive' } },
              { deviceCode: { contains: q, mode: 'insensitive' } },
              { serialNumber: { contains: q, mode: 'insensitive' } },
              { model: { modelName: { contains: q, mode: 'insensitive' } } },
              { model: { modelCode: { contains: q, mode: 'insensitive' } } },
              { site: { name: { contains: q, mode: 'insensitive' } } },
              { ipAddresses: { some: { address: { contains: q, mode: 'insensitive' } } } },
              { interfaces: { some: { macAddress: { contains: q, mode: 'insensitive' } } } },
            ],
          }
        : {},
      categoryId ? { categoryId: parseInt(categoryId, 10) } : {},
      vendorId ? { vendorId: parseInt(vendorId, 10) } : {},
      siteId ? { siteId: parseInt(siteId, 10) } : {},
      inventoryStatus ? { inventoryStatus } : {},
      networkRole ? { networkRole } : {},
      anomaly === 'no_ip'
        ? { ipAddresses: { none: { purpose: 'management', allocationStatus: 'ALLOCATED' } } }
        : anomaly === 'no_sn'
          ? { OR: [{ serialNumber: null }, { serialNumber: '' }] }
          : anomaly === 'no_rack'
            ? { AND: [{ roomId: null }, { rackId: null }] }
            : anomaly === 'no_ports'
              ? { interfaces: { none: {} } }
              : {},
    ],
  };

  const [total, devices] = await Promise.all([
    prisma.device.count({ where: whereClause }),
    prisma.device.findMany({
      where: whereClause,
      include: {
        category: true,
        vendor: true,
        model: true,
        site: true,
        room: true,
        rack: true,
        ipAddresses: {
          where: { purpose: 'management', allocationStatus: 'ALLOCATED' },
          select: { address: true, id: true, subnetId: true },
        },
      },
      orderBy: { [sortBy]: sortOrder },
      skip,
      take: limit,
    }),
  ]);

  const formattedDevices = devices.map((d) => ({
    ...d,
    managementIp: d.ipAddresses[0]?.address ?? null,
  }));

  return NextResponse.json({
    data: formattedDevices,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  });
}

export async function POST(req: Request) {
  const { user, errorResponse } = await requireApiPermission('device.create', req);
  if (errorResponse) return errorResponse;

  const body = await req.json().catch(() => null);
  const parsed = DeviceCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { message: 'Validasi form gagal', errors: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const { clonePortsFromDeviceId, ...deviceInput } = parsed.data;

  // Cek duplikat deviceCode (AC §6.1 poin 4)
  const existingCode = await prisma.device.findUnique({
    where: { deviceCode: deviceInput.deviceCode },
  });
  if (existingCode) {
    return NextResponse.json(
      { message: `Kode perangkat '${deviceInput.deviceCode}' sudah digunakan di inventaris` },
      { status: 409 }
    );
  }

  // Validasi foreign keys
  const [cat, ven, site] = await Promise.all([
    prisma.deviceCategory.findUnique({ where: { id: deviceInput.categoryId } }),
    prisma.vendor.findUnique({ where: { id: deviceInput.vendorId } }),
    prisma.site.findUnique({ where: { id: deviceInput.siteId } }),
  ]);

  if (!cat) return NextResponse.json({ message: 'Kategori tidak valid' }, { status: 400 });
  if (!ven) return NextResponse.json({ message: 'Vendor tidak valid' }, { status: 400 });
  if (!site) return NextResponse.json({ message: 'Site/Lokasi tidak valid' }, { status: 400 });

  if (deviceInput.modelId) {
    const model = await prisma.deviceModel.findUnique({ where: { id: deviceInput.modelId } });
    if (!model || model.vendorId !== deviceInput.vendorId) {
      return NextResponse.json({ message: 'Model tidak sesuai dengan vendor yang dipilih' }, { status: 400 });
    }
  }

  let sourceInterfaces: {
    name: string;
    label: string | null;
    interfaceType: string;
    mediaType: string | null;
    speedMbps: number | null;
    portMode: string | null;
    vlanId: number | null;
    description: string | null;
  }[] = [];

  if (clonePortsFromDeviceId) {
    const sourceDevice = await prisma.device.findUnique({
      where: { id: clonePortsFromDeviceId },
      include: {
        interfaces: {
          select: {
            name: true,
            label: true,
            interfaceType: true,
            mediaType: true,
            speedMbps: true,
            portMode: true,
            vlanId: true,
            description: true,
          },
          orderBy: { name: 'asc' },
        },
      },
    });
    if (!sourceDevice) {
      return NextResponse.json(
        { message: 'Perangkat sumber duplikasi port tidak ditemukan.' },
        { status: 404 }
      );
    }
    sourceInterfaces = sourceDevice.interfaces;
  }

  const device = await prisma.$transaction(async (tx) => {
    const createdDevice = await tx.device.create({
      data: {
        ...deviceInput,
        createdBy: user.id,
        updatedBy: user.id,
      },
      include: {
        category: true,
        vendor: true,
        model: true,
        site: true,
        room: true,
        rack: true,
      },
    });

    if (sourceInterfaces.length > 0) {
      await tx.interface.createMany({
        data: sourceInterfaces.map((iface) => ({
          deviceId: createdDevice.id,
          name: iface.name,
          label: iface.label,
          interfaceType: iface.interfaceType,
          mediaType: iface.mediaType,
          speedMbps: iface.speedMbps,
          adminStatus: 'enabled',
          operStatus: 'unknown',
          macAddress: null,
          portMode: iface.portMode,
          vlanId: iface.vlanId,
          description: iface.description,
        })),
      });
    }

    return createdDevice;
  });

  await logAudit({
    userId: user.id,
    action: 'CREATE',
    entityType: 'Device',
    entityId: device.id,
    afterData: device,
    req,
  });

  if (sourceInterfaces.length > 0) {
    await logAudit({
      userId: user.id,
      action: 'BATCH_CREATE_INTERFACES',
      entityType: 'Interface',
      entityId: device.id,
      afterData: {
        clonedFromDeviceId: clonePortsFromDeviceId,
        count: sourceInterfaces.length,
        names: sourceInterfaces.map((i) => i.name),
      },
      req,
    });
  }

  return NextResponse.json(
    {
      message:
        sourceInterfaces.length > 0
          ? `Perangkat berhasil ditambahkan dengan ${sourceInterfaces.length} port hasil duplikasi.`
          : 'Perangkat berhasil ditambahkan',
      data: device,
      clonedPortsCount: sourceInterfaces.length,
    },
    { status: 201 }
  );
}
