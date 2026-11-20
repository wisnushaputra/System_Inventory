import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireApiPermission } from '@/lib/auth';
import { logAudit } from '@/lib/audit';

const ConnectionUpdateSchema = z.object({
  relationType: z.enum(['physical', 'logical', 'parent_child', 'service']).optional(),
  medium: z.enum(['fiber', 'copper', 'wireless', 'logical', 'unknown']).optional().nullable(),
  label: z.string().trim().max(100).optional().nullable(),
  status: z.enum(['documented', 'under_review', 'archived']).optional(),
  capacityMbps: z.number().int().positive().optional().nullable(),
  description: z.string().max(500).optional().nullable(),
  version: z.number().int().positive().optional(),
});

export async function GET(req: Request, props: { params: Promise<{ id: string }> }) {
  const { errorResponse } = await requireApiPermission('device.view');
  if (errorResponse) return errorResponse;

  const params = await props.params;
  const id = parseInt(params.id, 10);
  if (isNaN(id)) return NextResponse.json({ message: 'ID tidak valid' }, { status: 400 });

  const connection = await prisma.networkConnection.findUnique({
    where: { id },
    include: {
      endpointAInterface: {
        include: {
          device: { select: { id: true, hostname: true, deviceCode: true, site: true } },
        },
      },
      endpointBInterface: {
        include: {
          device: { select: { id: true, hostname: true, deviceCode: true, site: true } },
        },
      },
      creator: { select: { id: true, name: true, username: true } },
      updater: { select: { id: true, name: true, username: true } },
    },
  });

  if (!connection) return NextResponse.json({ message: 'Koneksi tidak ditemukan' }, { status: 404 });
  return NextResponse.json({ data: connection });
}

export async function PUT(req: Request, props: { params: Promise<{ id: string }> }) {
  const { user, errorResponse } = await requireApiPermission('device.update', req);
  if (errorResponse) return errorResponse;

  const params = await props.params;
  const id = parseInt(params.id, 10);
  if (isNaN(id)) return NextResponse.json({ message: 'ID tidak valid' }, { status: 400 });

  const current = await prisma.networkConnection.findUnique({ where: { id } });
  if (!current) return NextResponse.json({ message: 'Koneksi tidak ditemukan' }, { status: 404 });

  const body = await req.json().catch(() => null);
  const parsed = ConnectionUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { message: 'Validasi form gagal', errors: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  // Cek Optimistic Locking (T9.2)
  if (parsed.data.version !== undefined && parsed.data.version !== current.version) {
    return NextResponse.json(
      {
        message: `Konflik pembaruan (Optimistic Locking): Data koneksi relasi ini telah diperbarui oleh pengguna/sesi lain (versi sistem: ${current.version}, versi formulir: ${parsed.data.version}). Silakan muat ulang data terbaru.`,
        code: 'CONFLICT_OPTIMISTIC_LOCK',
        currentVersion: current.version,
        formVersion: parsed.data.version,
      },
      { status: 409 }
    );
  }

  const { version: _v, ...fieldsToUpdate } = parsed.data;

  const updated = await prisma.networkConnection.update({
    where: { id },
    data: {
      ...fieldsToUpdate,
      version: { increment: 1 },
      updatedBy: user.id,
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
    action: 'UPDATE_CONNECTION',
    entityType: 'NetworkConnection',
    entityId: id,
    beforeData: current,
    afterData: updated,
    req,
  });

  return NextResponse.json({ message: 'Koneksi berhasil diperbarui', data: updated });
}

export async function DELETE(req: Request, props: { params: Promise<{ id: string }> }) {
  const { user, errorResponse } = await requireApiPermission('device.update', req);
  if (errorResponse) return errorResponse;

  const params = await props.params;
  const id = parseInt(params.id, 10);
  if (isNaN(id)) return NextResponse.json({ message: 'ID tidak valid' }, { status: 400 });

  const current = await prisma.networkConnection.findUnique({ where: { id } });
  if (!current) return NextResponse.json({ message: 'Koneksi tidak ditemukan' }, { status: 404 });

  await prisma.networkConnection.delete({ where: { id } });

  await logAudit({
    userId: user.id,
    action: 'DELETE_CONNECTION',
    entityType: 'NetworkConnection',
    entityId: id,
    beforeData: current,
    req,
  });

  return NextResponse.json({ message: 'Koneksi berhasil dihapus' });
}
