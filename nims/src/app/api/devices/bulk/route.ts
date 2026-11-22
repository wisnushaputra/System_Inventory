import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireApiPermission } from '@/lib/auth';
import { logAudit } from '@/lib/audit';

const DeviceIdsSchema = z
  .array(z.number().int().positive())
  .min(1, 'Pilih minimal 1 perangkat')
  .max(100, 'Maksimal 100 perangkat dalam satu aksi massal');

const BulkDeviceSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('UPDATE_STATUS'),
    deviceIds: DeviceIdsSchema,
    inventoryStatus: z.enum(['PLANNED', 'ACTIVE', 'MAINTENANCE', 'RETIRED', 'LOST']),
  }),
  z.object({
    action: z.literal('MOVE_SITE'),
    deviceIds: DeviceIdsSchema,
    siteId: z.number().int().positive('Site tujuan wajib dipilih'),
  }),
  z.object({
    action: z.literal('ARCHIVE'),
    deviceIds: DeviceIdsSchema,
    reason: z
      .string()
      .trim()
      .min(3, 'Alasan pengarsipan massal wajib diisi (minimal 3 karakter)')
      .max(500),
  }),
  z.object({
    action: z.literal('RESTORE'),
    deviceIds: DeviceIdsSchema,
  }),
]);

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = BulkDeviceSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { message: 'Validasi aksi massal gagal', errors: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const input = parsed.data;
  const requiredPerm =
    input.action === 'ARCHIVE' || input.action === 'RESTORE' ? 'device.archive' : 'device.update';

  const { user, errorResponse } = await requireApiPermission(requiredPerm, req);
  if (errorResponse) return errorResponse;

  const uniqueIds = Array.from(new Set(input.deviceIds));

  const existingDevices = await prisma.device.findMany({
    where: { id: { in: uniqueIds } },
    orderBy: { id: 'asc' },
  });

  if (existingDevices.length !== uniqueIds.length) {
    return NextResponse.json(
      { message: 'Sebagian perangkat yang dipilih tidak ditemukan atau telah dihapus.' },
      { status: 404 }
    );
  }

  if (input.action === 'UPDATE_STATUS') {
    const targetDevices = existingDevices.filter((d) => !d.archivedAt);
    if (targetDevices.length === 0) {
      return NextResponse.json(
        { message: 'Tidak ada perangkat aktif yang dipilih untuk diubah statusnya.' },
        { status: 400 }
      );
    }

    const updatedRows = await prisma.$transaction(async (tx) => {
      const results = [];
      for (const dev of targetDevices) {
        const updated = await tx.device.update({
          where: { id: dev.id },
          data: {
            inventoryStatus: input.inventoryStatus,
            updatedBy: user.id,
            version: { increment: 1 },
          },
        });
        results.push({ before: dev, after: updated });
      }
      return results;
    });

    await Promise.all(
      updatedRows.map((row) =>
        logAudit({
          userId: user.id,
          action: 'UPDATE',
          entityType: 'Device',
          entityId: row.after.id,
          beforeData: row.before,
          afterData: row.after,
          req,
        })
      )
    );

    return NextResponse.json({
      message: `Status ${updatedRows.length} perangkat berhasil diubah ke ${input.inventoryStatus}.`,
      count: updatedRows.length,
    });
  }

  if (input.action === 'MOVE_SITE') {
    const targetSite = await prisma.site.findUnique({ where: { id: input.siteId } });
    if (!targetSite) {
      return NextResponse.json({ message: 'Site tujuan tidak ditemukan' }, { status: 404 });
    }

    const targetDevices = existingDevices.filter((d) => !d.archivedAt);
    if (targetDevices.length === 0) {
      return NextResponse.json(
        { message: 'Tidak ada perangkat aktif yang dipilih untuk dipindahkan.' },
        { status: 400 }
      );
    }

    const updatedRows = await prisma.$transaction(async (tx) => {
      const results = [];
      for (const dev of targetDevices) {
        const siteChanged = dev.siteId !== input.siteId;
        const updated = await tx.device.update({
          where: { id: dev.id },
          data: {
            siteId: input.siteId,
            ...(siteChanged ? { roomId: null, rackId: null } : {}),
            updatedBy: user.id,
            version: { increment: 1 },
          },
        });
        results.push({ before: dev, after: updated });
      }
      return results;
    });

    await Promise.all(
      updatedRows.map((row) =>
        logAudit({
          userId: user.id,
          action: 'UPDATE',
          entityType: 'Device',
          entityId: row.after.id,
          beforeData: row.before,
          afterData: row.after,
          req,
        })
      )
    );

    return NextResponse.json({
      message: `${updatedRows.length} perangkat berhasil dipindahkan ke ${targetSite.siteCode} (${targetSite.name}).`,
      count: updatedRows.length,
    });
  }

  if (input.action === 'ARCHIVE') {
    const activeDevices = existingDevices.filter((d) => !d.archivedAt);
    if (activeDevices.length === 0) {
      return NextResponse.json(
        { message: 'Semua perangkat yang dipilih sudah berada di arsip.' },
        { status: 400 }
      );
    }

    const now = new Date();
    const updatedRows = await prisma.$transaction(async (tx) => {
      const results = [];
      for (const dev of activeDevices) {
        const updated = await tx.device.update({
          where: { id: dev.id },
          data: {
            archivedAt: now,
            archiveReason: input.reason,
            updatedBy: user.id,
            version: { increment: 1 },
          },
        });
        results.push({ before: dev, after: updated });
      }
      return results;
    });

    await Promise.all(
      updatedRows.map((row) =>
        logAudit({
          userId: user.id,
          action: 'ARCHIVE',
          entityType: 'Device',
          entityId: row.after.id,
          beforeData: row.before,
          afterData: row.after,
          req,
        })
      )
    );

    return NextResponse.json({
      message: `${updatedRows.length} perangkat berhasil diarsipkan.`,
      count: updatedRows.length,
    });
  }

  // action === 'RESTORE'
  const archivedDevices = existingDevices.filter((d) => Boolean(d.archivedAt));
  if (archivedDevices.length === 0) {
    return NextResponse.json(
      { message: 'Tidak ada perangkat terarsip yang dipilih untuk dipulihkan.' },
      { status: 400 }
    );
  }

  const updatedRows = await prisma.$transaction(async (tx) => {
    const results = [];
    for (const dev of archivedDevices) {
      const updated = await tx.device.update({
        where: { id: dev.id },
        data: {
          archivedAt: null,
          archiveReason: null,
          updatedBy: user.id,
          version: { increment: 1 },
        },
      });
      results.push({ before: dev, after: updated });
    }
    return results;
  });

  await Promise.all(
    updatedRows.map((row) =>
      logAudit({
        userId: user.id,
        action: 'RESTORE',
        entityType: 'Device',
        entityId: row.after.id,
        beforeData: row.before,
        afterData: row.after,
        req,
      })
    )
  );

  return NextResponse.json({
    message: `${updatedRows.length} perangkat berhasil dipulihkan ke daftar aktif.`,
    count: updatedRows.length,
  });
}
