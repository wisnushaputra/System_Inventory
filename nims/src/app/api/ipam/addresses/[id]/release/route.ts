import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireApiPermission } from '@/lib/auth';
import { logAudit } from '@/lib/audit';

export async function POST(req: Request, props: { params: Promise<{ id: string }> }) {
  const { user, errorResponse } = await requireApiPermission('ipam.manage', req);
  if (errorResponse) return errorResponse;

  const params = await props.params;
  const id = parseInt(params.id, 10);
  if (isNaN(id)) return NextResponse.json({ message: 'ID tidak valid' }, { status: 400 });

  const current = await prisma.ipAddress.findUnique({
    where: { id },
    include: {
      subnet: true,
      device: true,
      interface: true,
    },
  });

  if (!current) return NextResponse.json({ message: 'Alamat IP tidak ditemukan' }, { status: 404 });

  if (current.allocationStatus === 'RELEASED') {
    return NextResponse.json({
      message: `Alamat IP ${current.address} sudah dalam status dilepas (RELEASED)`,
      data: current,
    });
  }

  const updated = await prisma.ipAddress.update({
    where: { id },
    data: {
      allocationStatus: 'RELEASED',
      releasedAt: new Date(),
      deviceId: null,
      interfaceId: null,
    },
    include: {
      subnet: true,
    },
  });

  await logAudit({
    userId: user.id,
    action: 'RELEASE_IP',
    entityType: 'IpAddress',
    entityId: id,
    beforeData: current,
    afterData: updated,
    req,
  });

  return NextResponse.json({
    message: `Alamat IP ${current.address} berhasil dilepas (status RELEASED)`,
    data: updated,
  });
}
