import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireApiPermission } from '@/lib/auth';

export async function GET(req: Request) {
  const { errorResponse } = await requireApiPermission('device.view');
  if (errorResponse) return errorResponse;

  const url = new URL(req.url);
  const q = url.searchParams.get('q')?.trim() || '';
  const excludeDeviceId = url.searchParams.get('excludeDeviceId');

  const devices = await prisma.device.findMany({
    where: {
      archivedAt: null,
      id: excludeDeviceId ? { not: parseInt(excludeDeviceId, 10) } : undefined,
      OR: q
        ? [
            { hostname: { contains: q, mode: 'insensitive' } },
            { deviceCode: { contains: q, mode: 'insensitive' } },
          ]
        : undefined,
    },
    include: {
      interfaces: {
        select: {
          id: true,
          name: true,
          label: true,
          interfaceType: true,
          speedMbps: true,
          adminStatus: true,
        },
        orderBy: { name: 'asc' },
      },
    },
    take: 20,
    orderBy: { hostname: 'asc' },
  });

  return NextResponse.json({ data: devices });
}
