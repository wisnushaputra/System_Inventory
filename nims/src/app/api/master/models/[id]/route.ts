import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireApiPermission } from '@/lib/auth';
import { logAudit } from '@/lib/audit';

const ModelUpdateSchema = z.object({
  vendorId: z.number().int().positive().optional(),
  categoryId: z.number().int().positive().optional(),
  modelName: z.string().trim().min(2).max(100).optional(),
  modelCode: z.string().trim().min(2).max(100).optional(),
  description: z.string().max(500).optional().nullable(),
  specifications: z.record(z.string(), z.unknown()).optional().nullable(),
});

export async function GET(req: Request, props: { params: Promise<{ id: string }> }) {
  const { errorResponse } = await requireApiPermission('device.view');
  if (errorResponse) return errorResponse;

  const params = await props.params;
  const id = parseInt(params.id, 10);
  if (isNaN(id)) return NextResponse.json({ message: 'ID tidak valid' }, { status: 400 });

  const model = await prisma.deviceModel.findUnique({
    where: { id },
    include: { vendor: true, category: true },
  });

  if (!model) return NextResponse.json({ message: 'Model tidak ditemukan' }, { status: 404 });
  return NextResponse.json({ data: model });
}

export async function PUT(req: Request, props: { params: Promise<{ id: string }> }) {
  const { user, errorResponse } = await requireApiPermission('vendor.manage', req);
  if (errorResponse) return errorResponse;

  const params = await props.params;
  const id = parseInt(params.id, 10);
  if (isNaN(id)) return NextResponse.json({ message: 'ID tidak valid' }, { status: 400 });

  const current = await prisma.deviceModel.findUnique({ where: { id } });
  if (!current) return NextResponse.json({ message: 'Model tidak ditemukan' }, { status: 404 });

  const body = await req.json().catch(() => null);
  const parsed = ModelUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ message: 'Validasi gagal', errors: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  if (parsed.data.modelCode && parsed.data.modelCode !== current.modelCode) {
    const duplicate = await prisma.deviceModel.findUnique({ where: { modelCode: parsed.data.modelCode } });
    if (duplicate) {
      return NextResponse.json({ message: `Kode model '${parsed.data.modelCode}' sudah digunakan` }, { status: 409 });
    }
  }

  const updated = await prisma.deviceModel.update({
    where: { id },
    data: {
      ...parsed.data,
      specifications: (parsed.data.specifications as any) ?? undefined,
    },
    include: { vendor: true, category: true },
  });

  await logAudit({
    userId: user.id,
    action: 'UPDATE',
    entityType: 'DeviceModel',
    entityId: id,
    beforeData: current,
    afterData: updated,
    req,
  });

  return NextResponse.json({ message: 'Model berhasil diperbarui', data: updated });
}

export async function DELETE(req: Request, props: { params: Promise<{ id: string }> }) {
  const { user, errorResponse } = await requireApiPermission('vendor.manage', req);
  if (errorResponse) return errorResponse;

  const params = await props.params;
  const id = parseInt(params.id, 10);
  if (isNaN(id)) return NextResponse.json({ message: 'ID tidak valid' }, { status: 400 });

  const current = await prisma.deviceModel.findUnique({ where: { id } });
  if (!current) return NextResponse.json({ message: 'Model tidak ditemukan' }, { status: 404 });

  try {
    await prisma.deviceModel.delete({ where: { id } });
  } catch (err: any) {
    return NextResponse.json({ message: 'Gagal menghapus model: data masih berelasi di sistem' }, { status: 409 });
  }

  await logAudit({
    userId: user.id,
    action: 'DELETE',
    entityType: 'DeviceModel',
    entityId: id,
    beforeData: current,
    req,
  });

  return NextResponse.json({ message: 'Model berhasil dihapus' });
}
