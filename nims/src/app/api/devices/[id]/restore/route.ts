import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireApiPermission } from '@/lib/auth';
import { logAudit } from '@/lib/audit';

export async function POST(req: Request, props: { params: Promise<{ id: string }> }) {
  const { user, errorResponse } = await requireApiPermission('device.archive', req);
  if (errorResponse) return errorResponse;

  const params = await props.params;
  const id = parseInt(params.id, 10);
  if (isNaN(id)) return NextResponse.json({ message: 'ID tidak valid' }, { status: 400 });

  const current = await prisma.device.findUnique({ where: { id } });
  if (!current) return NextResponse.json({ message: 'Perangkat tidak ditemukan' }, { status: 404 });

  if (!current.archivedAt) {
    return NextResponse.json({ message: 'Perangkat ini tidak sedang diarsipkan' }, { status: 400 });
  }

  const updated = await prisma.device.update({
    where: { id },
    data: {
      archivedAt: null,
      archiveReason: null,
      updatedBy: user.id,
    },
  });

  await logAudit({
    userId: user.id,
    action: 'RESTORE',
    entityType: 'Device',
    entityId: id,
    beforeData: current,
    afterData: updated,
    req,
  });

  return NextResponse.json({ message: 'Perangkat berhasil dipulihkan dari arsip', data: updated });
}
