import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireApiPermission } from '@/lib/auth';
import { hashPassword } from '@/lib/password';
import { logAudit } from '@/lib/audit';

const UserCreateSchema = z.object({
  name: z.string().trim().min(2, 'Nama minimal 2 karakter').max(100, 'Nama maksimal 100 karakter'),
  username: z
    .string()
    .trim()
    .min(3, 'Username minimal 3 karakter')
    .max(50, 'Username maksimal 50 karakter')
    .regex(/^[a-zA-Z0-9_-]+$/, 'Username hanya boleh huruf, angka, garis bawah, dan tanda hubung'),
  email: z
    .string()
    .trim()
    .email('Format email tidak valid')
    .max(100)
    .optional()
    .nullable()
    .or(z.literal(''))
    .transform((v) => (v ? v.toLowerCase() : null)),
  password: z.string().min(8, 'Password minimal 8 karakter').max(100, 'Password maksimal 100 karakter'),
  roleId: z.number().int().positive('Role ID harus dipilih'),
  isActive: z.boolean().default(true),
});

export async function GET(req: Request) {
  const { errorResponse } = await requireApiPermission('user.manage', req);
  if (errorResponse) return errorResponse;

  const url = new URL(req.url);
  const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
  const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') || '10', 10)));
  const skip = (page - 1) * limit;

  const q = url.searchParams.get('q')?.trim();
  const roleId = url.searchParams.get('roleId');
  const isActiveParam = url.searchParams.get('isActive');

  const whereClause: any = {
    AND: [
      q
        ? {
            OR: [
              { name: { contains: q, mode: 'insensitive' } },
              { username: { contains: q, mode: 'insensitive' } },
              { email: { contains: q, mode: 'insensitive' } },
            ],
          }
        : {},
      roleId && !isNaN(parseInt(roleId, 10)) ? { roleId: parseInt(roleId, 10) } : {},
      isActiveParam !== null && isActiveParam !== '' ? { isActive: isActiveParam === 'true' } : {},
    ],
  };

  const [total, users] = await Promise.all([
    prisma.user.count({ where: whereClause }),
    prisma.user.findMany({
      where: whereClause,
      select: {
        id: true,
        name: true,
        username: true,
        email: true,
        isActive: true,
        lastLoginAt: true,
        roleId: true,
        role: {
          select: { id: true, name: true, description: true },
        },
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
  ]);

  return NextResponse.json({
    data: users,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    },
  });
}

export async function POST(req: Request) {
  const { user, errorResponse } = await requireApiPermission('user.manage', req);
  if (errorResponse) return errorResponse;

  const body = await req.json().catch(() => null);
  const parsed = UserCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { message: 'Validasi gagal', errors: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const { name, username, email, password, roleId, isActive } = parsed.data;

  // Cek apakah username sudah digunakan
  const existingUsername = await prisma.user.findUnique({
    where: { username },
  });
  if (existingUsername) {
    return NextResponse.json(
      { message: `Username '${username}' sudah digunakan.` },
      { status: 409 }
    );
  }

  // Cek apakah email sudah digunakan
  if (email) {
    const existingEmail = await prisma.user.findUnique({
      where: { email },
    });
    if (existingEmail) {
      return NextResponse.json(
        { message: `Email '${email}' sudah digunakan oleh pengguna lain.` },
        { status: 409 }
      );
    }
  }

  // Verifikasi role valid
  const roleExists = await prisma.role.findUnique({
    where: { id: roleId },
  });
  if (!roleExists) {
    return NextResponse.json(
      { message: 'Role yang dipilih tidak valid.' },
      { status: 400 }
    );
  }

  const passwordHash = await hashPassword(password);

  const newUser = await prisma.user.create({
    data: {
      name,
      username,
      email,
      passwordHash,
      roleId,
      isActive,
    },
    select: {
      id: true,
      name: true,
      username: true,
      email: true,
      roleId: true,
      role: { select: { id: true, name: true } },
      isActive: true,
      createdAt: true,
    },
  });

  await logAudit({
    userId: user.id,
    action: 'CREATE',
    entityType: 'User',
    entityId: newUser.id,
    afterData: newUser,
    req,
  });

  return NextResponse.json(
    { message: 'Pengguna baru berhasil ditambahkan.', data: newUser },
    { status: 201 }
  );
}
