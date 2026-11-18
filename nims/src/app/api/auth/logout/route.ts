import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { logAudit } from '@/lib/audit';

export async function POST(req: Request) {
  const session = await getSession();
  if (session.userId) {
    await logAudit({
      userId: session.userId,
      action: 'LOGOUT',
      entityType: 'User',
      entityId: session.userId,
      req,
    });
  }
  session.destroy();
  return NextResponse.redirect(new URL('/login', req.url), 303);
}
