import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { verifyPassword } from '@/lib/password';
import { getSession } from '@/lib/session';
import { logAudit } from '@/lib/audit';

const Schema = z.object({
  username: z.string().trim().min(1),
  password: z.string().min(1),
});

export async function POST(req: Request) {
  const origin = req.headers.get('origin');
  if (!origin || new URL(origin).host !== req.headers.get('host')) {
    return NextResponse.json({ message: 'Permintaan ditolak' }, { status: 403 });
  }

  const parsed = Schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ message: 'Username atau password salah' }, { status: 401 });
  }

  const user = await prisma.user.findUnique({ where: { username: parsed.data.username } });
  const ok = user && user.isActive && (await verifyPassword(parsed.data.password, user.passwordHash));

  if (!ok) {
    return NextResponse.json({ message: 'Username atau password salah' }, { status: 401 });
  }

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
