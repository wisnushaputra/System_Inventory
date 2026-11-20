import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { verifyPassword } from '@/lib/password';
import { getSession } from '@/lib/session';
import { logAudit } from '@/lib/audit';
import { checkRateLimit, recordFailedAttempt, resetRateLimit } from '@/lib/rate-limit';

const Schema = z.object({
  username: z.string().trim().min(1),
  password: z.string().min(1),
});

export async function POST(req: Request) {
  const origin = req.headers.get('origin');
  if (!origin || new URL(origin).host !== req.headers.get('host')) {
    return NextResponse.json({ message: 'Permintaan ditolak' }, { status: 403 });
  }

  // T9.1 Rate limiting login (5 percobaan gagal dalam 15 menit)
  const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || '127.0.0.1';
  const rateLimitKey = `login:${clientIp}`;
  const limitCheck = checkRateLimit(rateLimitKey, 5, 15 * 60 * 1000);

  if (!limitCheck.allowed) {
    return NextResponse.json(
      {
        message: `Terlalu banyak percobaan login gagal. Akses dibatasi sementara. Silakan coba kembali dalam ${limitCheck.retryAfterSeconds} detik.`,
        retryAfterSeconds: limitCheck.retryAfterSeconds,
      },
      {
        status: 429,
        headers: {
          'Retry-After': limitCheck.retryAfterSeconds.toString(),
        },
      }
    );
  }

  const parsed = Schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    recordFailedAttempt(rateLimitKey);
    return NextResponse.json({ message: 'Username atau password salah' }, { status: 401 });
  }

  const user = await prisma.user.findUnique({ where: { username: parsed.data.username } });
  const ok = user && user.isActive && (await verifyPassword(parsed.data.password, user.passwordHash));

  if (!ok) {
    recordFailedAttempt(rateLimitKey);
    return NextResponse.json({ message: 'Username atau password salah' }, { status: 401 });
  }

  // Reset rate limit jika berhasil login
  resetRateLimit(rateLimitKey);

  const session = await getSession();
  session.userId = user.id;
  await session.save();

  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  await logAudit({
    userId: user.id,
    action: 'LOGIN',
    entityType: 'User',
    entityId: user.id,
    req,
  });

  return NextResponse.json({ message: 'Login berhasil' });
}
