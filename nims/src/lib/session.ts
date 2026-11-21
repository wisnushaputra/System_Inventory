import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { connection } from 'next/server';

export type SessionData = { userId?: number };

export async function getSession() {
  await connection();
  return getIronSession<SessionData>(await cookies(), {
    cookieName: 'nims_session',
    password: process.env.SESSION_SECRET ?? '',
    cookieOptions: {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
    },
  });
}
