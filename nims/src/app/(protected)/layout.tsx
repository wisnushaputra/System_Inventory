import { requireUser, hasPermission } from '@/lib/auth';
import { AppShell } from '@/components/AppShell';

export const instant = false;

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const canViewAudit = hasPermission(user, 'audit.view');
  const canManageUsers = hasPermission(user, 'user.manage');

  return (
    <AppShell
      user={{ name: user.name, roleName: user.role.name }}
      canViewAudit={canViewAudit}
      canManageUsers={canManageUsers}
    >
      {children}
    </AppShell>
  );
}
