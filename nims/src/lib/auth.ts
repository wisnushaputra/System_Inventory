import { redirect } from 'next/navigation';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/session';

export async function getCurrentUser() {
  const session = await getSession();
  if (!session.userId) return null;

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    include: {
      role: {
        include: {
          permissions: {
            include: { permission: true },
          },
        },
      },
    },
  });

  if (!user || !user.isActive) return null;
  return user;
}

export type CurrentUser = NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>;

export function hasPermission(user: CurrentUser, code: string): boolean {
  return user.role.permissions.some((rp) => rp.permission.code === code);
}

export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  return user;
}

export async function requirePermission(permissionCode: string): Promise<CurrentUser> {
  const user = await requireUser();
  if (!hasPermission(user, permissionCode)) {
    redirect('/dashboard?error=unauthorized');
  }
  return user;
}

export async function requireApiPermission(
  permissionCode: string,
  req?: Request
): Promise<{ user: CurrentUser; errorResponse: null } | { user: null; errorResponse: NextResponse }> {
  // Verifikasi CSRF Origin untuk mutasi (POST, PUT, PATCH, DELETE)
  if (req && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
    const origin = req.headers.get('origin');
    const host = req.headers.get('host');
    if (!origin || (host && new URL(origin).host !== host)) {
      return {
        user: null,
        errorResponse: NextResponse.json({ message: 'Permintaan ditolak: origin tidak valid' }, { status: 403 }),
      };
    }
  }

  const user = await getCurrentUser();
  if (!user) {
    return {
      user: null,
      errorResponse: NextResponse.json({ message: 'Autentikasi diperlukan' }, { status: 401 }),
    };
  }

  if (!hasPermission(user, permissionCode)) {
    return {
      user: null,
      errorResponse: NextResponse.json(
        { message: `Akses ditolak: izin '${permissionCode}' tidak dimiliki` },
        { status: 403 }
      ),
    };
  }

  return { user, errorResponse: null };
}
