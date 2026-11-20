import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireApiPermission } from '@/lib/auth';
import { logAudit } from '@/lib/audit';
import { Prisma } from '@prisma/client';

const ConnectionCreateSchema = z.object({
  endpointAInterfaceId: z.number().int().positive('Port sumber wajib dipilih'),
  endpointBInterfaceId: z.number().int().positive('Port tujuan wajib dipilih'),
  relationType: z.enum(['physical', 'logical', 'parent_child', 'service']).default('physical'),
  medium: z.enum(['fiber', 'copper', 'wireless', 'logical', 'unknown']).optional().nullable(),
  label: z.string().trim().max(100).optional().nullable(),
  capacityMbps: z.number().int().positive().optional().nullable(),
  description: z.string().max(500).optional().nullable(),
});

export async function GET(req: Request) {
  const { errorResponse } = await requireApiPermission('device.view');
  if (errorResponse) return errorResponse;

  const url = new URL(req.url);
  const deviceId = url.searchParams.get('deviceId');
  const interfaceId = url.searchParams.get('interfaceId');
  const relationType = url.searchParams.get('relationType');
  const status = url.searchParams.get('status');
  const isArchived = url.searchParams.get('isArchived') === 'true';
  const q = url.searchParams.get('q')?.trim();

  const whereClause: any = {
    AND: [
      isArchived
        ? { archivedAt: { not: null } }
        : {
            archivedAt: null,
            // Sesuai T4.4: Relasi perangkat terarsip tidak muncul di tampilan default
            endpointAInterface: { device: { archivedAt: null } },
            endpointBInterface: { device: { archivedAt: null } },
          },
      deviceId
        ? {
            OR: [
              { endpointAInterface: { deviceId: parseInt(deviceId, 10) } },
              { endpointBInterface: { deviceId: parseInt(deviceId, 10) } },
            ],
          }
        : {},
      interfaceId
        ? {
            OR: [
              { endpointAInterfaceId: parseInt(interfaceId, 10) },
              { endpointBInterfaceId: parseInt(interfaceId, 10) },
            ],
          }
        : {},
      relationType ? { relationType } : {},
      status ? { status } : {},
      q
        ? {
            OR: [
              { label: { contains: q, mode: 'insensitive' } },
              { description: { contains: q, mode: 'insensitive' } },
              { endpointAInterface: { name: { contains: q, mode: 'insensitive' } } },
              { endpointBInterface: { name: { contains: q, mode: 'insensitive' } } },
              { endpointAInterface: { device: { hostname: { contains: q, mode: 'insensitive' } } } },
              { endpointBInterface: { device: { hostname: { contains: q, mode: 'insensitive' } } } },
            ],
          }
        : {},
    ],
  };

  const connections = await prisma.networkConnection.findMany({
    where: whereClause,
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
      creator: { select: { id: true, name: true, username: true } },
      updater: { select: { id: true, name: true, username: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json({ data: connections });
}

export async function POST(req: Request) {
  // Network Engineer & Admin memiliki izin topology.manage / device.update
  const { user, errorResponse } = await requireApiPermission('device.update', req);
  if (errorResponse) return errorResponse;

  const body = await req.json().catch(() => null);
  const parsed = ConnectionCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { message: 'Validasi form gagal', errors: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const { endpointAInterfaceId, endpointBInterfaceId, relationType, medium, label, capacityMbps, description } =
    parsed.data;

  // ── ATURAN 1 (T4.1 DoD): Endpoint A ≠ Endpoint B ──────────────────────────
  if (endpointAInterfaceId === endpointBInterfaceId) {
    return NextResponse.json(
      { message: 'Port sumber dan tujuan tidak boleh sama (loopback port diri sendiri ditolak)' },
      { status: 400 }
    );
  }

  // Ambil kedua interface untuk verifikasi keberadaan dan device
  const [ifaceA, ifaceB] = await Promise.all([
    prisma.interface.findUnique({
      where: { id: endpointAInterfaceId },
      include: { device: { select: { id: true, hostname: true, archivedAt: true } } },
    }),
    prisma.interface.findUnique({
      where: { id: endpointBInterfaceId },
      include: { device: { select: { id: true, hostname: true, archivedAt: true } } },
    }),
  ]);

  if (!ifaceA || !ifaceB) {
    return NextResponse.json(
      { message: 'Salah satu atau kedua port interface tidak ditemukan' },
      { status: 404 }
    );
  }

  // Validasi: Perangkat yang diarsipkan tidak boleh disambung koneksi baru
  if (ifaceA.device.archivedAt || ifaceB.device.archivedAt) {
    return NextResponse.json(
      { message: 'Tidak dapat membuat relasi koneksi pada perangkat yang sedang diarsipkan' },
      { status: 400 }
    );
  }

  // ── ATURAN 2 (T4.1 DoD): Anti-duplikat A-B & B-A via Canonical Ordering ──
  const canonA = Math.min(endpointAInterfaceId, endpointBInterfaceId);
  const canonB = Math.max(endpointAInterfaceId, endpointBInterfaceId);

  // Cek apakah relasi antara kedua port ini sudah pernah dibuat
  const existingPair = await prisma.networkConnection.findUnique({
    where: {
      endpointAInterfaceId_endpointBInterfaceId: {
        endpointAInterfaceId: canonA,
        endpointBInterfaceId: canonB,
      },
    },
  });

  if (existingPair) {
    if (existingPair.archivedAt === null) {
      return NextResponse.json(
        { message: 'Koneksi antara kedua port ini sudah terdaftar dan masih aktif' },
        { status: 409 }
      );
    }
  }

  // ── ATURAN 3 (T4.1 DoD): Satu Port Satu Koneksi Fisik Aktif ──────────────
  if (relationType === 'physical') {
    // Cek apakah port A sudah punya koneksi fisik aktif lain
    const activeA = await prisma.networkConnection.findFirst({
      where: {
        OR: [{ endpointAInterfaceId: canonA }, { endpointBInterfaceId: canonA }],
        relationType: 'physical',
        archivedAt: null,
      },
      include: {
        endpointAInterface: { select: { name: true, device: { select: { hostname: true } } } },
        endpointBInterface: { select: { name: true, device: { select: { hostname: true } } } },
      },
    });

    if (activeA) {
      const portName = ifaceA.id === canonA ? ifaceA.name : ifaceB.name;
      const devName = ifaceA.id === canonA ? ifaceA.device.hostname : ifaceB.device.hostname;
      return NextResponse.json(
        {
          message: `Konflik koneksi: Port '${portName}' pada perangkat '${devName}' sudah memiliki koneksi fisik aktif`,
        },
        { status: 409 }
      );
    }

    // Cek apakah port B sudah punya koneksi fisik aktif lain
    const activeB = await prisma.networkConnection.findFirst({
      where: {
        OR: [{ endpointAInterfaceId: canonB }, { endpointBInterfaceId: canonB }],
        relationType: 'physical',
        archivedAt: null,
      },
      include: {
        endpointAInterface: { select: { name: true, device: { select: { hostname: true } } } },
        endpointBInterface: { select: { name: true, device: { select: { hostname: true } } } },
      },
    });

    if (activeB) {
      const portName = ifaceB.id === canonB ? ifaceB.name : ifaceA.name;
      const devName = ifaceB.id === canonB ? ifaceB.device.hostname : ifaceA.device.hostname;
      return NextResponse.json(
        {
          message: `Konflik koneksi: Port '${portName}' pada perangkat '${devName}' sudah memiliki koneksi fisik aktif`,
        },
        { status: 409 }
      );
    }
  }

  try {
    const connection = await prisma.networkConnection.create({
      data: {
        endpointAInterfaceId: canonA,
        endpointBInterfaceId: canonB,
        relationType,
        medium: medium || null,
        label: label || null,
        capacityMbps: capacityMbps || null,
        description: description || null,
        createdBy: user.id,
      },
      include: {
        endpointAInterface: {
          include: { device: { select: { id: true, hostname: true, deviceCode: true } } },
        },
        endpointBInterface: {
          include: { device: { select: { id: true, hostname: true, deviceCode: true } } },
        },
      },
    });

    await logAudit({
      userId: user.id,
      action: 'CREATE_CONNECTION',
      entityType: 'NetworkConnection',
      entityId: connection.id,
      afterData: connection,
      req,
    });

    return NextResponse.json(
      {
        message: `Relasi koneksi antara '${ifaceA.device.hostname}:${ifaceA.name}' dan '${ifaceB.device.hostname}:${ifaceB.name}' berhasil dibuat`,
        data: connection,
      },
      { status: 201 }
    );
  } catch (err: unknown) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      return NextResponse.json(
        { message: 'Koneksi antara kedua port ini sudah terdaftar di database' },
        { status: 409 }
      );
    }
    throw err;
  }
}
