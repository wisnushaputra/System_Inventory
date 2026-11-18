import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireApiPermission } from '@/lib/auth';
import { logAudit } from '@/lib/audit';

const ModelCreateSchema = z.object({
  vendorId: z.number().int().positive(),
  categoryId: z.number().int().positive(),
  modelName: z.string().trim().min(2).max(100),
  modelCode: z.string().trim().min(2).max(100),
  description: z.string().max(500).optional().nullable(),
  specifications: z.record(z.string(), z.unknown()).optional().nullable(),
});

export async function GET(req: Request) {
  const { errorResponse } = await requireApiPermission('device.view');
  if (errorResponse) return errorResponse;

  const url = new URL(req.url);
  const q = url.searchParams.get('q')?.trim();
  const vendorId = url.searchParams.get('vendorId');
  const categoryId = url.searchParams.get('categoryId');

  const models = await prisma.deviceModel.findMany({
    where: {
      AND: [
        q
          ? {
              OR: [
                { modelName: { contains: q, mode: 'insensitive' } },
                { modelCode: { contains: q, mode: 'insensitive' } },
              ],
            }
          : {},
        vendorId ? { vendorId: parseInt(vendorId, 10) } : {},
        categoryId ? { categoryId: parseInt(categoryId, 10) } : {},
      ],
    },
    include: {
      vendor: true,
      category: true,
    },
    orderBy: { modelName: 'asc' },
  });

  return NextResponse.json({ data: models });
}

export async function POST(req: Request) {
  const { user, errorResponse } = await requireApiPermission('vendor.manage', req);
  if (errorResponse) return errorResponse;

  const body = await req.json().catch(() => null);
  const parsed = ModelCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ message: 'Validasi gagal', errors: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const existing = await prisma.deviceModel.findUnique({ where: { modelCode: parsed.data.modelCode } });
  if (existing) {
    return NextResponse.json({ message: `Kode model '${parsed.data.modelCode}' sudah terdaftar` }, { status: 409 });
  }

  // Cek keberadaan vendor dan category
  const [vendor, category] = await Promise.all([
    prisma.vendor.findUnique({ where: { id: parsed.data.vendorId } }),
    prisma.deviceCategory.findUnique({ where: { id: parsed.data.categoryId } }),
  ]);

  if (!vendor) return NextResponse.json({ message: 'Vendor yang dipilih tidak valid' }, { status: 400 });
  if (!category) return NextResponse.json({ message: 'Kategori yang dipilih tidak valid' }, { status: 400 });

  const model = await prisma.deviceModel.create({
    data: {
      vendorId: parsed.data.vendorId,
      categoryId: parsed.data.categoryId,
      modelName: parsed.data.modelName,
      modelCode: parsed.data.modelCode,
      description: parsed.data.description,
      specifications: (parsed.data.specifications as any) ?? undefined,
    },
    include: { vendor: true, category: true },
  });

  await logAudit({
    userId: user.id,
    action: 'CREATE',
    entityType: 'DeviceModel',
    entityId: model.id,
    afterData: model,
    req,
  });

  return NextResponse.json({ message: 'Model berhasil ditambahkan', data: model }, { status: 201 });
}
