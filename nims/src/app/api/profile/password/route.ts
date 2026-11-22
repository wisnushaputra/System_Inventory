import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';
import { hashPassword, verifyPassword } from '@/lib/password';
import { logAudit } from '@/lib/audit';

const ChangeOwnPasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Kata sandi saat ini wajib diisi'),
    newPassword: z
      .string()
      .min(8, 'Kata sandi baru minimal 8 karakter')
      .max(100, 'Kata sandi baru maksimal 100 karakter'),
    confirmPassword: z.string().min(1, 'Konfirmasi kata sandi wajib diisi'),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'Konfirmasi kata sandi baru tidak cocok',
    path: ['confirmPassword'],
  })
  .refine((data) => data.newPassword !== data.currentPassword, {
    message: 'Kata sandi baru harus berbeda dengan kata sandi saat ini',
    path: ['newPassword'],
  });

export async function POST(req: Request) {
  const origin = req.headers.get('origin');
  const host = req.headers.get('host');
  if (!origin || (host && new URL(origin).host !== host)) {
    return NextResponse.json({ message: 'Permintaan ditolak: origin tidak valid' }, { status: 403 });
  }

  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return NextResponse.json({ message: 'Autentikasi diperlukan' }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const parsed = ChangeOwnPasswordSchema.safeParse(body);
  if (!parsed.success) {
    const flattened = parsed.error.flatten().fieldErrors;
    const firstMsg =
      flattened.currentPassword?.[0] ||
      flattened.newPassword?.[0] ||
      flattened.confirmPassword?.[0] ||
      'Validasi perubahan kata sandi gagal';
    return NextResponse.json({ message: firstMsg, errors: flattened }, { status: 400 });
  }

  const validCurrent = await verifyPassword(parsed.data.currentPassword, currentUser.passwordHash);
  if (!validCurrent) {
    return NextResponse.json(
      { message: 'Kata sandi saat ini tidak sesuai.' },
      { status: 400 }
    );
  }

  const nextHash = await hashPassword(parsed.data.newPassword);
  await prisma.user.update({
    where: { id: currentUser.id },
    data: { passwordHash: nextHash },
  });

  await logAudit({
    userId: currentUser.id,
    action: 'UPDATE',
    entityType: 'User',
    entityId: currentUser.id,
    afterData: {
      id: currentUser.id,
      username: currentUser.username,
      selfPasswordChange: true,
    },
    req,
  });

  return NextResponse.json({
    message: 'Kata sandi akun Anda berhasil diperbarui.',
  });
}
