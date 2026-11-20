import Link from 'next/link';
import { requireUser, hasPermission } from '@/lib/auth';

export const instant = false;

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const canViewAudit = hasPermission(user, 'audit.view');

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
          <div className="flex items-center space-x-6">
            <Link href="/dashboard" className="text-lg font-bold tracking-tight text-slate-800">
              NIMS <span className="text-xs font-normal text-slate-500">v0.1</span>
            </Link>
            <nav className="flex space-x-4 text-sm font-medium">
              <Link
                href="/dashboard"
                className="text-slate-600 transition hover:text-slate-900"
              >
                Dashboard
              </Link>
              <Link
                href="/devices"
                className="text-slate-600 transition hover:text-slate-900"
              >
                Perangkat
              </Link>
              <Link
                href="/master"
                className="text-slate-600 transition hover:text-slate-900"
              >
                Master Data
              </Link>
              <Link
                href="/topology"
                className="text-slate-600 transition hover:text-slate-900"
              >
                Topologi
              </Link>
              {canViewAudit && (
                <Link
                  href="/audit-logs"
                  className="text-slate-600 transition hover:text-slate-900"
                >
                  Audit Log
                </Link>
              )}
            </nav>
          </div>
          <div className="flex items-center space-x-4 text-sm">
            <div className="text-right">
              <p className="font-medium text-slate-800">{user.name}</p>
              <p className="text-xs text-slate-500">{user.role.name}</p>
            </div>
            <form action="/api/auth/logout" method="post">
              <button
                type="submit"
                className="rounded border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-slate-400"
              >
                Logout
              </button>
            </form>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">{children}</main>
    </div>
  );
}
