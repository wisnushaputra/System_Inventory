import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireApiPermission } from '@/lib/auth';
import { logAudit } from '@/lib/audit';

const ArchiveSchema = z.object({
  reason: z.string().trim().min(3, 'Alasan arsip minimal 3 karakter').max(500),
});

export async function POST(req: Request, props: { params: Promise<{ id: string }> }) {
  const { user, errorResponse } = await requireApiPermission('device.update', req);
  if (errorResponse) return errorResponse;

  const params = await props.params;
  const id = parseInt(params.id, 10);
  if (isNaN(id)) return NextResponse.json({ message: 'ID tidak valid' }, { status: 400 });

  const current = await prisma.networkConnection.findUnique({
    where: { id },
    include: {
      endpointAInterface: { include: { device: true } },
      endpointBInterface: { include: { device: true } },
    },
  });

  if (!current) return NextResponse.json({ message: 'Koneksi tidak ditemukan' }, { status: 404 });
  if (current.archivedAt) {
    return NextResponse.json({ message: 'Koneksi ini sudah berstatus diarsipkan' }, { status: 400 });
  }

  const body = await req.json().catch(() => null);
  const parsed = ArchiveSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { message: 'Validasi gagal', errors: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const updated = await prisma.networkConnection.update({
    where: { id },
    data: {
      archivedAt: new Date(),
      archiveReason: parsed.data.reason,
      status: 'archived',
      updatedBy: user.id,
    },
  });

  await logAudit({
    userId: user.id,
    action: 'ARCHIVE_CONNECTION',
    entityType: 'NetworkConnection',
    entityId: id,
    beforeData: current,
    afterData: updated,
    req,
  });

  return NextResponse.json({
    message: 'Koneksi berhasil diarsipkan',
    data: updated,
  });
}
