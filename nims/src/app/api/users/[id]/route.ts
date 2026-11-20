import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireApiPermission } from '@/lib/auth';
import { logAudit } from '@/lib/audit';

const UserUpdateSchema = z.object({
  name: z.string().trim().min(2, 'Nama minimal 2 karakter').max(100, 'Nama maksimal 100 karakter'),
  email: z
    .string()
    .trim()
    .email('Format email tidak valid')
    .max(100)
    .optional()
    .nullable()
    .or(z.literal(''))
    .transform((v) => (v ? v.toLowerCase() : null)),
  roleId: z.number().int().positive('Role ID harus dipilih'),
  isActive: z.boolean(),
});

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { errorResponse } = await requireApiPermission('user.manage', req);
  if (errorResponse) return errorResponse;

  const { id } = await params;
  const userId = parseInt(id, 10);
  if (isNaN(userId)) {
    return NextResponse.json({ message: 'ID pengguna tidak valid' }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      username: true,
      email: true,
      roleId: true,
      role: { select: { id: true, name: true, description: true } },
      isActive: true,
      lastLoginAt: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  if (!user) {
    return NextResponse.json({ message: 'Pengguna tidak ditemukan' }, { status: 404 });
  }

  return NextResponse.json({ data: user });
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { user: currentUser, errorResponse } = await requireApiPermission('user.manage', req);
  if (errorResponse) return errorResponse;

  const { id } = await params;
  const targetUserId = parseInt(id, 10);
  if (isNaN(targetUserId)) {
    return NextResponse.json({ message: 'ID pengguna tidak valid' }, { status: 400 });
  }

  const existingUser = await prisma.user.findUnique({
    where: { id: targetUserId },
    include: { role: true },
  });

  if (!existingUser) {
    return NextResponse.json({ message: 'Pengguna tidak ditemukan' }, { status: 404 });
  }

  const body = await req.json().catch(() => null);
  const parsed = UserUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { message: 'Validasi gagal', errors: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const { name, email, roleId, isActive } = parsed.data;

  // Proteksi Diri Sendiri: Admin tidak boleh menonaktifkan atau mengubah role dirinya sendiri
  if (targetUserId === currentUser.id) {
    if (!isActive) {
      return NextResponse.json(
        { message: 'Operasi ditolak: Anda tidak dapat menonaktifkan akun Anda sendiri.' },
        { status: 400 }
      );
    }
    if (roleId !== existingUser.roleId) {
      return NextResponse.json(
        { message: 'Operasi ditolak: Anda tidak dapat mengubah peran (role) akun Anda sendiri.' },
        { status: 400 }
      );
    }
  }

  // Cek duplikasi email jika email diubah
  if (email && email !== existingUser.email) {
    const emailConflict = await prisma.user.findUnique({
      where: { email },
    });
    if (emailConflict && emailConflict.id !== targetUserId) {
      return NextResponse.json(
        { message: `Email '${email}' sudah digunakan oleh pengguna lain.` },
        { status: 409 }
      );
    }
  }

  // Verifikasi role baru ada
  const roleExists = await prisma.role.findUnique({ where: { id: roleId } });
  if (!roleExists) {
    return NextResponse.json({ message: 'Role yang dipilih tidak valid.' }, { status: 400 });
  }

  const updatedUser = await prisma.user.update({
    where: { id: targetUserId },
    data: {
      name,
      email,
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
      updatedAt: true,
    },
  });

  await logAudit({
    userId: currentUser.id,
    action: 'UPDATE',
    entityType: 'User',
    entityId: targetUserId,
    beforeData: {
      name: existingUser.name,
      email: existingUser.email,
      roleId: existingUser.roleId,
      isActive: existingUser.isActive,
    },
    afterData: updatedUser,
    req,
  });

  return NextResponse.json({
    message: 'Data pengguna berhasil diperbarui.',
    data: updatedUser,
  });
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { user: currentUser, errorResponse } = await requireApiPermission('user.manage', req);
  if (errorResponse) return errorResponse;

  const { id } = await params;
  const targetUserId = parseInt(id, 10);
  if (isNaN(targetUserId)) {
    return NextResponse.json({ message: 'ID pengguna tidak valid' }, { status: 400 });
  }

  // Proteksi Diri Sendiri: Admin tidak boleh menghapus akunnya sendiri
  if (targetUserId === currentUser.id) {
    return NextResponse.json(
      { message: 'Operasi ditolak: Anda tidak dapat menghapus akun Anda sendiri yang sedang aktif.' },
      { status: 400 }
    );
  }

  const existingUser = await prisma.user.findUnique({
    where: { id: targetUserId },
  });

  if (!existingUser) {
    return NextResponse.json({ message: 'Pengguna tidak ditemukan' }, { status: 404 });
  }

  await prisma.user.delete({
    where: { id: targetUserId },
  });

  await logAudit({
    userId: currentUser.id,
    action: 'DELETE',
    entityType: 'User',
    entityId: targetUserId,
    beforeData: {
      id: existingUser.id,
      name: existingUser.name,
      username: existingUser.username,
      email: existingUser.email,
      roleId: existingUser.roleId,
    },
    req,
  });

  return NextResponse.json({
    message: `Pengguna '${existingUser.username}' berhasil dihapus.`,
  });
}
