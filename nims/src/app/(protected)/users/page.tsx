import { requirePermission } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { UserListClient } from './UserListClient';

export const instant = false;

export default async function UsersPage() {
  const currentUser = await requirePermission('user.manage');

  const roles = await prisma.role.findMany({
    select: {
      id: true,
      name: true,
      description: true,
    },
    orderBy: { id: 'asc' },
  });

  return (
    <UserListClient
      initialRoles={roles}
      currentUserId={currentUser.id}
    />
  );
}
