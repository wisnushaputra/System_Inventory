import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireApiPermission } from '@/lib/auth';
import { logAudit } from '@/lib/audit';

const VendorUpdateSchema = z.object({
  name: z.string().trim().min(2).max(100).optional(),
  website: z.string().trim().url().optional().nullable().or(z.literal('')),
  supportContact: z.string().trim().max(150).optional().nullable(),
  notes: z.string().max(500).optional().nullable(),
});

export async function GET(req: Request, props: { params: Promise<{ id: string }> }) {
  const { errorResponse } = await requireApiPermission('site.view');
  if (errorResponse) return errorResponse;

  const params = await props.params;
  const id = parseInt(params.id, 10);
  if (isNaN(id)) return NextResponse.json({ message: 'ID tidak valid' }, { status: 400 });

  const vendor = await prisma.vendor.findUnique({
    where: { id },
    include: {
      models: {
        include: { category: true },
        orderBy: { modelName: 'asc' },
      },
    },
  });

  if (!vendor) return NextResponse.json({ message: 'Vendor tidak ditemukan' }, { status: 404 });
  return NextResponse.json({ data: vendor });
}

export async function PUT(req: Request, props: { params: Promise<{ id: string }> }) {
  const { user, errorResponse } = await requireApiPermission('vendor.manage', req);
  if (errorResponse) return errorResponse;

  const params = await props.params;
  const id = parseInt(params.id, 10);
  if (isNaN(id)) return NextResponse.json({ message: 'ID tidak valid' }, { status: 400 });

  const current = await prisma.vendor.findUnique({ where: { id } });
  if (!current) return NextResponse.json({ message: 'Vendor tidak ditemukan' }, { status: 404 });

  const body = await req.json().catch(() => null);
  const parsed = VendorUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ message: 'Validasi gagal', errors: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  if (parsed.data.name && parsed.data.name !== current.name) {
    const duplicate = await prisma.vendor.findUnique({ where: { name: parsed.data.name } });
    if (duplicate) {
      return NextResponse.json({ message: `Vendor '${parsed.data.name}' sudah terdaftar` }, { status: 409 });
    }
  }

  const updated = await prisma.vendor.update({
    where: { id },
    data: {
      name: parsed.data.name,
      website: parsed.data.website !== undefined ? parsed.data.website || null : undefined,
      supportContact: parsed.data.supportContact,
      notes: parsed.data.notes,
    },
  });

  await logAudit({
    userId: user.id,
    action: 'UPDATE',
    entityType: 'Vendor',
    entityId: id,
    beforeData: current,
    afterData: updated,
    req,
  });

  return NextResponse.json({ message: 'Vendor berhasil diperbarui', data: updated });
}

export async function DELETE(req: Request, props: { params: Promise<{ id: string }> }) {
  const { user, errorResponse } = await requireApiPermission('vendor.manage', req);
  if (errorResponse) return errorResponse;

  const params = await props.params;
  const id = parseInt(params.id, 10);
  if (isNaN(id)) return NextResponse.json({ message: 'ID tidak valid' }, { status: 400 });

  const current = await prisma.vendor.findUnique({
    where: { id },
    include: {
      _count: { select: { models: true } },
    },
  });

  if (!current) return NextResponse.json({ message: 'Vendor tidak ditemukan' }, { status: 404 });

  if (current._count.models > 0) {
    return NextResponse.json(
      {
        message: `Tidak dapat menghapus vendor '${current.name}' karena masih memiliki ${current._count.models} model perangkat terdaftar.`,
      },
      { status: 409 }
    );
  }

  try {
    await prisma.vendor.delete({ where: { id } });
  } catch (err: any) {
    return NextResponse.json({ message: 'Gagal menghapus vendor: data masih berelasi di sistem' }, { status: 409 });
  }

  await logAudit({
    userId: user.id,
    action: 'DELETE',
    entityType: 'Vendor',
    entityId: id,
    beforeData: current,
    req,
  });

  return NextResponse.json({ message: 'Vendor berhasil dihapus' });
}
