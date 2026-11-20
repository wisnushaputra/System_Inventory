import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireApiPermission } from '@/lib/auth';
import { logAudit } from '@/lib/audit';

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
  if (!current.archivedAt) {
    return NextResponse.json({ message: 'Koneksi ini tidak sedang diarsipkan' }, { status: 400 });
  }

  // Jika koneksi fisik, periksa apakah salah satu port sudah memiliki koneksi fisik aktif lain
  if (current.relationType === 'physical') {
    const [conflictA, conflictB] = await Promise.all([
      prisma.networkConnection.findFirst({
        where: {
          id: { not: id },
          OR: [{ endpointAInterfaceId: current.endpointAInterfaceId }, { endpointBInterfaceId: current.endpointAInterfaceId }],
          relationType: 'physical',
          archivedAt: null,
        },
      }),
      prisma.networkConnection.findFirst({
        where: {
          id: { not: id },
          OR: [{ endpointAInterfaceId: current.endpointBInterfaceId }, { endpointBInterfaceId: current.endpointBInterfaceId }],
          relationType: 'physical',
          archivedAt: null,
        },
      }),
    ]);

    if (conflictA || conflictB) {
      return NextResponse.json(
        {
          message:
            'Tidak dapat memulihkan koneksi: salah satu port sudah memiliki koneksi fisik aktif yang lain',
        },
        { status: 409 }
      );
    }
  }

  const updated = await prisma.networkConnection.update({
    where: { id },
    data: {
      archivedAt: null,
      archiveReason: null,
      status: 'documented',
      updatedBy: user.id,
    },
  });

  await logAudit({
    userId: user.id,
    action: 'RESTORE_CONNECTION',
    entityType: 'NetworkConnection',
    entityId: id,
    beforeData: current,
    afterData: updated,
    req,
  });

  return NextResponse.json({
    message: 'Koneksi berhasil dipulihkan dari arsip',
    data: updated,
  });
}
