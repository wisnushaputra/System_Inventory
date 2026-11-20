import { requirePermission, hasPermission } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { AuditLogClient } from './AuditLogClient';

export const instant = false;

export default async function AuditLogsPage() {
  const user = await requirePermission('audit.view');
  const canExport = hasPermission(user, 'report.export');

  const users = await prisma.user.findMany({
    select: {
      id: true,
      name: true,
      username: true,
    },
    orderBy: { name: 'asc' },
  });

  return (
    <AuditLogClient
      users={users}
      canExport={canExport}
    />
  );
}
