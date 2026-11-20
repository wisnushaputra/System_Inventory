import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireApiPermission } from '@/lib/auth';
import { logAudit } from '@/lib/audit';
import { Prisma } from '@prisma/client';

const SingleInterfaceSchema = z.object({
  name: z.string().trim().min(1, 'Nama port wajib diisi').max(50),
  label: z.string().trim().max(100).optional().nullable(),
  interfaceType: z.enum([
    'ethernet',
    'sfp',
    'sfp_plus',
    'qsfp',
    'pon',
    'wireless',
    'loopback',
    'vlan',
    'lag',
    'management',
    'other',
  ]).default('ethernet'),
  mediaType: z.enum(['copper', 'fiber_single_mode', 'fiber_multi_mode', 'wireless']).optional().nullable(),
  speedMbps: z.number().int().positive().optional().nullable(),
  adminStatus: z.enum(['enabled', 'disabled']).default('enabled'),
  operStatus: z.enum(['up', 'down', 'testing', 'unknown']).default('unknown'),
  macAddress: z.string().trim().max(50).optional().nullable(),
  portMode: z.enum(['access', 'trunk', 'routed']).optional().nullable(),
  vlanId: z.number().int().min(1).max(4094).optional().nullable(),
  description: z.string().max(500).optional().nullable(),
});

const BatchInterfaceSchema = z.object({
  mode: z.literal('batch'),
  prefix: z.string().trim().min(1).max(20).default('ether'),
  startNumber: z.number().int().min(0).default(1),
  count: z.number().int().min(1, 'Jumlah port minimal 1').max(96, 'Jumlah port maksimal 96'),
  interfaceType: z.enum([
    'ethernet',
    'sfp',
    'sfp_plus',
    'qsfp',
    'pon',
    'wireless',
    'loopback',
    'vlan',
    'lag',
    'management',
    'other',
  ]).default('ethernet'),
  mediaType: z.enum(['copper', 'fiber_single_mode', 'fiber_multi_mode', 'wireless']).optional().nullable(),
  speedMbps: z.number().int().positive().optional().nullable(),
  adminStatus: z.enum(['enabled', 'disabled']).default('enabled'),
});

const InterfaceCreateRequestSchema = z.union([
  SingleInterfaceSchema,
  BatchInterfaceSchema,
]);

export async function GET(req: Request, props: { params: Promise<{ id: string }> }) {
  const { errorResponse } = await requireApiPermission('interface.view');
  if (errorResponse) return errorResponse;

  const params = await props.params;
  const deviceId = parseInt(params.id, 10);
  if (isNaN(deviceId)) return NextResponse.json({ message: 'ID perangkat tidak valid' }, { status: 400 });

  const device = await prisma.device.findUnique({
    where: { id: deviceId },
    select: { id: true, hostname: true, deviceCode: true },
  });
  if (!device) return NextResponse.json({ message: 'Perangkat tidak ditemukan' }, { status: 404 });

  const interfaces = await prisma.interface.findMany({
    where: { deviceId },
    include: {
      ipAddresses: {
        include: {
          subnet: { select: { id: true, name: true, cidr: true } },
        },
      },
    },
    orderBy: { name: 'asc' },
  });

  return NextResponse.json({ data: interfaces, device });
}

export async function POST(req: Request, props: { params: Promise<{ id: string }> }) {
  const { user, errorResponse } = await requireApiPermission('interface.manage', req);
  if (errorResponse) return errorResponse;

  const params = await props.params;
  const deviceId = parseInt(params.id, 10);
  if (isNaN(deviceId)) return NextResponse.json({ message: 'ID perangkat tidak valid' }, { status: 400 });

  const device = await prisma.device.findUnique({ where: { id: deviceId } });
  if (!device) return NextResponse.json({ message: 'Perangkat tidak ditemukan' }, { status: 404 });

  const body = await req.json().catch(() => null);
  const parsed = InterfaceCreateRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { message: 'Validasi form gagal', errors: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  // Cek apakah mode batch
  if ('mode' in parsed.data && parsed.data.mode === 'batch') {
    const { prefix, startNumber, count, interfaceType, mediaType, speedMbps, adminStatus } = parsed.data;

    const namesToCreate: string[] = [];
    for (let i = 0; i < count; i++) {
      namesToCreate.push(`${prefix}${startNumber + i}`);
    }

    // Cek apakah sudah ada nama port yang bentrok
    const existing = await prisma.interface.findMany({
      where: {
        deviceId,
        name: { in: namesToCreate },
      },
      select: { name: true },
    });

    if (existing.length > 0) {
      const conflictNames = existing.map((e) => e.name).join(', ');
      return NextResponse.json(
        { message: `Port berikut sudah ada di perangkat ini: ${conflictNames}` },
        { status: 409 }
      );
    }

    // Buat port secara batch
    const createdList = await prisma.$transaction(
      namesToCreate.map((name) =>
        prisma.interface.create({
          data: {
            deviceId,
            name,
            interfaceType,
            mediaType: mediaType || null,
            speedMbps: speedMbps || null,
            adminStatus,
          },
        })
      )
    );

    await logAudit({
      userId: user.id,
      action: 'BATCH_CREATE_INTERFACES',
      entityType: 'Device',
      entityId: deviceId,
      afterData: { count, ports: namesToCreate },
      req,
    });

    return NextResponse.json({
      message: `Berhasil menambahkan ${createdList.length} port berpola`,
      data: createdList,
    }, { status: 201 });
  }

  // Mode Single Port — narrow the union manually
  if (!('mode' in parsed.data)) {
    const single = parsed.data;
    try {
      const newInterface = await prisma.interface.create({
        data: {
          deviceId,
          name: single.name,
          label: single.label || null,
          interfaceType: single.interfaceType,
          mediaType: single.mediaType || null,
          speedMbps: single.speedMbps || null,
          adminStatus: single.adminStatus,
          operStatus: single.operStatus,
          macAddress: single.macAddress || null,
          portMode: single.portMode || null,
          vlanId: single.vlanId || null,
          description: single.description || null,
        },
      });

      await logAudit({
        userId: user.id,
        action: 'CREATE_INTERFACE',
        entityType: 'Interface',
        entityId: newInterface.id,
        afterData: newInterface,
        req,
      });

      return NextResponse.json({
        message: `Port '${newInterface.name}' berhasil ditambahkan`,
        data: newInterface,
      }, { status: 201 });
    } catch (err: unknown) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        return NextResponse.json(
          { message: `Port '${single.name}' sudah ada di perangkat ini (nama port harus unik per perangkat)` },
          { status: 409 }
        );
      }
      throw err;
    }
  }

  return NextResponse.json({ message: 'Request tidak dikenali' }, { status: 400 });
}
