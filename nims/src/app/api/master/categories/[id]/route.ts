import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireApiPermission } from '@/lib/auth';
import { logAudit } from '@/lib/audit';

const CategoryUpdateSchema = z.object({
  name: z.string().trim().min(2).max(100).optional(),
  code: z.string().trim().min(2).max(50).toLowerCase().optional(),
  description: z.string().max(500).optional().nullable(),
});

export async function GET(req: Request, props: { params: Promise<{ id: string }> }) {
  const { errorResponse } = await requireApiPermission('device.view');
  if (errorResponse) return errorResponse;

  const params = await props.params;
  const id = parseInt(params.id, 10);
  if (isNaN(id)) return NextResponse.json({ message: 'ID tidak valid' }, { status: 400 });

  const category = await prisma.deviceCategory.findUnique({
    where: { id },
    include: {
      models: {
        include: { vendor: true },
        orderBy: { modelName: 'asc' },
      },
    },
  });

  if (!category) return NextResponse.json({ message: 'Kategori tidak ditemukan' }, { status: 404 });
  return NextResponse.json({ data: category });
}

export async function PUT(req: Request, props: { params: Promise<{ id: string }> }) {
  const { user, errorResponse } = await requireApiPermission('vendor.manage', req);
  if (errorResponse) return errorResponse;

  const params = await props.params;
  const id = parseInt(params.id, 10);
  if (isNaN(id)) return NextResponse.json({ message: 'ID tidak valid' }, { status: 400 });

  const current = await prisma.deviceCategory.findUnique({ where: { id } });
  if (!current) return NextResponse.json({ message: 'Kategori tidak ditemukan' }, { status: 404 });

  const body = await req.json().catch(() => null);
  const parsed = CategoryUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ message: 'Validasi gagal', errors: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  if (parsed.data.code && parsed.data.code !== current.code) {
    const duplicate = await prisma.deviceCategory.findUnique({ where: { code: parsed.data.code } });
    if (duplicate) {
      return NextResponse.json({ message: `Kode kategori '${parsed.data.code}' sudah digunakan` }, { status: 409 });
    }
  }

  const updated = await prisma.deviceCategory.update({
    where: { id },
    data: parsed.data,
  });

  await logAudit({
    userId: user.id,
    action: 'UPDATE',
    entityType: 'DeviceCategory',
    entityId: id,
    beforeData: current,
    afterData: updated,
    req,
  });

  return NextResponse.json({ message: 'Kategori berhasil diperbarui', data: updated });
}

export async function DELETE(req: Request, props: { params: Promise<{ id: string }> }) {
  const { user, errorResponse } = await requireApiPermission('vendor.manage', req);
  if (errorResponse) return errorResponse;

  const params = await props.params;
  const id = parseInt(params.id, 10);
  if (isNaN(id)) return NextResponse.json({ message: 'ID tidak valid' }, { status: 400 });

  const current = await prisma.deviceCategory.findUnique({
    where: { id },
    include: {
      _count: { select: { models: true, devices: true } },
    },
  });

  if (!current) return NextResponse.json({ message: 'Kategori tidak ditemukan' }, { status: 404 });

  if (current._count.models > 0 || current._count.devices > 0) {
    return NextResponse.json(
      {
        message: `Tidak dapat menghapus kategori '${current.name}' karena masih digunakan oleh ${current._count.models} model dan ${current._count.devices} perangkat.`,
      },
      { status: 409 }
    );
  }

  try {
    await prisma.deviceCategory.delete({ where: { id } });
  } catch {
    return NextResponse.json({ message: 'Gagal menghapus kategori: data masih terkait di sistem' }, { status: 409 });
  }

  await logAudit({
    userId: user.id,
    action: 'DELETE',
    entityType: 'DeviceCategory',
    entityId: id,
    beforeData: current,
    req,
  });

  return NextResponse.json({ message: 'Kategori berhasil dihapus' });
}
