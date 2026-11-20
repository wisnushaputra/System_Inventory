import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireApiPermission } from '@/lib/auth';
import { hashPassword } from '@/lib/password';
import { logAudit } from '@/lib/audit';

const ResetPasswordSchema = z.object({
  newPassword: z
    .string()
    .min(8, 'Password baru minimal 8 karakter')
    .max(100, 'Password maksimal 100 karakter'),
});

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { user: currentUser, errorResponse } = await requireApiPermission('user.manage', req);
  if (errorResponse) return errorResponse;

  const { id } = await params;
  const targetUserId = parseInt(id, 10);
  if (isNaN(targetUserId)) {
    return NextResponse.json({ message: 'ID pengguna tidak valid' }, { status: 400 });
  }

  const existingUser = await prisma.user.findUnique({
    where: { id: targetUserId },
  });

  if (!existingUser) {
    return NextResponse.json({ message: 'Pengguna tidak ditemukan' }, { status: 404 });
  }

  const body = await req.json().catch(() => null);
  const parsed = ResetPasswordSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { message: 'Validasi gagal', errors: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const { newPassword } = parsed.data;
  const passwordHash = await hashPassword(newPassword);

  await prisma.user.update({
    where: { id: targetUserId },
    data: { passwordHash },
  });

  await logAudit({
    userId: currentUser.id,
    action: 'UPDATE',
    entityType: 'User',
    entityId: targetUserId,
    afterData: {
      id: targetUserId,
      username: existingUser.username,
      resetPassword: true,
    },
    req,
  });

  return NextResponse.json({
    message: `Kata sandi untuk pengguna '${existingUser.username}' berhasil diperbarui.`,
  });
}
