import { requirePermission, hasPermission } from '@/lib/auth';
import { getDashboardStats } from '@/lib/dashboard-stats';
import { DashboardClient } from './DashboardClient';

export const instant = false;

export default async function DashboardPage() {
  const user = await requirePermission('dashboard.view');

  const canCreateDevice = hasPermission(user, 'device.create');
  const canViewAudit = hasPermission(user, 'audit.view');
  const initialStats = await getDashboardStats();

  return (
    <DashboardClient
      initialStats={initialStats}
      user={{ name: user.name, role: { name: user.role.name } }}
      canCreateDevice={canCreateDevice}
      canViewAudit={canViewAudit}
    />
  );
}
