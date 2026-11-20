import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireApiPermission } from '@/lib/auth';

export async function GET(req: Request) {
  const { errorResponse } = await requireApiPermission('user.manage', req);
  if (errorResponse) return errorResponse;

  const roles = await prisma.role.findMany({
    include: {
      permissions: {
        include: {
          permission: {
            select: { id: true, code: true, name: true },
          },
        },
      },
      _count: {
        select: { users: true },
      },
    },
    orderBy: { name: 'asc' },
  });

  const formatted = roles.map((r) => ({
    id: r.id,
    name: r.name,
    description: r.description,
    userCount: r._count.users,
    permissions: r.permissions.map((rp) => rp.permission.code),
  }));

  return NextResponse.json({ data: formatted });
}
