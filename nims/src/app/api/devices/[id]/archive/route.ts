import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireApiPermission } from '@/lib/auth';
import { logAudit } from '@/lib/audit';

const ArchiveSchema = z.object({
  reason: z.string().trim().min(3, 'Alasan pengarsipan wajib diisi (minimal 3 karakter)').max(500),
});

export async function POST(req: Request, props: { params: Promise<{ id: string }> }) {
  const { user, errorResponse } = await requireApiPermission('device.archive', req);
  if (errorResponse) return errorResponse;

  const params = await props.params;
  const id = parseInt(params.id, 10);
  if (isNaN(id)) return NextResponse.json({ message: 'ID tidak valid' }, { status: 400 });

  const current = await prisma.device.findUnique({ where: { id } });
  if (!current) return NextResponse.json({ message: 'Perangkat tidak ditemukan' }, { status: 404 });

  if (current.archivedAt) {
    return NextResponse.json({ message: 'Perangkat ini sudah diarsipkan sebelumnya' }, { status: 400 });
  }

  const body = await req.json().catch(() => null);
  const parsed = ArchiveSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { message: 'Validasi gagal', errors: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const now = new Date();
  const updated = await prisma.device.update({
    where: { id },
    data: {
      archivedAt: now,
      archiveReason: parsed.data.reason,
      updatedBy: user.id,
    },
  });

  await logAudit({
    userId: user.id,
    action: 'ARCHIVE',
    entityType: 'Device',
    entityId: id,
    beforeData: current,
    afterData: updated,
    req,
  });

  return NextResponse.json({ message: 'Perangkat berhasil diarsipkan', data: updated });
}
