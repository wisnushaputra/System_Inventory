import type { Metadata } from 'next';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/auth';
import { ProfileClient } from './ProfileClient';

export const metadata: Metadata = {
  title: 'Profil & Keamanan Akun',
};

export const instant = false;

export default async function ProfilePage() {
  const user = await requireUser();

  const recentLogs = await prisma.auditLog.findMany({
    where: {
      userId: user.id,
      OR: [
        { action: { in: ['LOGIN', 'LOGOUT'] } },
        { entityType: 'User', entityId: user.id },
      ],
    },
    select: {
      id: true,
      action: true,
      entityType: true,
      ipAddress: true,
      userAgent: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'desc' },
    take: 10,
  });

  return (
    <ProfileClient
      user={{
        id: user.id,
        name: user.name,
        username: user.username,
        email: user.email,
        roleName: user.role.name,
        roleDescription: user.role.description,
        permissionCount: user.role.permissions.length,
        createdAt: user.createdAt.toISOString(),
      }}
      recentLogs={recentLogs.map((log) => ({
        ...log,
        createdAt: log.createdAt.toISOString(),
      }))}
    />
  );
}
