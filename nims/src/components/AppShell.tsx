'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ThemeToggle } from './ThemeProvider';
import {
  NimsBrandMark,
  IconDashboard,
  IconServer,
  IconTopology,
  IconDatabase,
  IconUsers,
  IconAudit,
  IconMenu,
  IconClose,
  IconPanelCollapse,
  IconLogout,
} from './Icons';

interface Props {
  user: {
    name: string;
    roleName: string;
  };
  canViewAudit: boolean;
  canManageUsers: boolean;
  children: React.ReactNode;
}

interface NavItem {
  href: string;
  label: string;
  group: 'operational' | 'admin';
  icon: (props: { className?: string }) => React.ReactNode;
  visible: boolean;
}

const ROUTE_TITLES: { prefix: string; title: string }[] = [
  { prefix: '/dashboard', title: 'Ringkasan Operasional' },
  { prefix: '/devices/import', title: 'Impor Inventaris CSV' },
  { prefix: '/devices/new', title: 'Pendaftaran Perangkat' },
  { prefix: '/devices', title: 'Inventaris Perangkat' },
  { prefix: '/topology', title: 'Topologi Relasi Jaringan' },
  { prefix: '/master', title: 'Master Data Infrastruktur' },
  { prefix: '/users', title: 'Manajemen Pengguna' },
  { prefix: '/audit-logs', title: 'Jejak Audit Sistem' },
];

export function AppShell({ user, canViewAudit, canManageUsers, children }: Props) {
  const pathname = usePathname() || '/dashboard';
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('nims-sidebar-collapsed');
      if (saved === 'true') setCollapsed(true);
    } catch {
      // Abaikan
    }
  }, []);

  const toggleCollapse = () => {
    const next = !collapsed;
    setCollapsed(next);
    try {
      localStorage.setItem('nims-sidebar-collapsed', next ? 'true' : 'false');
    } catch {
      // Abaikan
    }
  };

  const closeMobile = useCallback(() => {
    setMobileOpen(false);
  }, []);

  useEffect(() => {
    closeMobile();
  }, [pathname, closeMobile]);

  useEffect(() => {
    if (!mobileOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeMobile();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [mobileOpen, closeMobile]);

  const navItems: NavItem[] = [
    {
      href: '/dashboard',
      label: 'Dashboard',
      group: 'operational',
      icon: (p) => <IconDashboard {...p} />,
      visible: true,
    },
    {
      href: '/devices',
      label: 'Perangkat',
      group: 'operational',
      icon: (p) => <IconServer {...p} />,
      visible: true,
    },
    {
      href: '/topology',
      label: 'Topologi',
      group: 'operational',
      icon: (p) => <IconTopology {...p} />,
      visible: true,
    },
    {
      href: '/master',
      label: 'Master Data',
      group: 'admin',
      icon: (p) => <IconDatabase {...p} />,
      visible: true,
    },
    {
      href: '/users',
      label: 'Pengguna',
      group: 'admin',
      icon: (p) => <IconUsers {...p} />,
      visible: canManageUsers,
    },
    {
      href: '/audit-logs',
      label: 'Audit Log',
      group: 'admin',
      icon: (p) => <IconAudit {...p} />,
      visible: canViewAudit,
    },
  ];

  const isActiveRoute = (href: string) =>
    pathname === href || pathname.startsWith(`${href}/`);

  const currentTitle =
    ROUTE_TITLES.find((r) => pathname.startsWith(r.prefix))?.title || 'NIMS Portal';

  const initials = user.name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || '')
    .join('') || 'OP';

  const operationalItems = navItems.filter((i) => i.group === 'operational' && i.visible);
  const adminItems = navItems.filter((i) => i.group === 'admin' && i.visible);

  const renderNavLinks = (isCollapsed: boolean) => (
    <div className="flex flex-1 flex-col justify-between gap-6 overflow-y-auto px-3 py-4">
      <div className="space-y-6">
        <div>
          {!isCollapsed && (
            <p className="mb-2 px-2.5 text-[11px] font-semibold tracking-wide text-ink-muted">
              Operasional
            </p>
          )}
          <ul className="space-y-1">
            {operationalItems.map((item) => {
              const active = isActiveRoute(item.href);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    title={isCollapsed ? item.label : undefined}
                    aria-current={active ? 'page' : undefined}
                    className={`group relative flex min-h-[44px] items-center gap-3 rounded-lg px-2.5 text-sm font-medium transition-[background-color,color] duration-150 ${
                      active
                        ? 'bg-accent-soft text-accent-ink font-semibold'
                        : 'text-ink-secondary hover:bg-subtle hover:text-ink'
                    } ${isCollapsed ? 'justify-center px-0' : ''}`}
                  >
                    {active && (
                      <span
                        aria-hidden="true"
                        className="absolute left-0 top-2 bottom-2 w-1 rounded-r-full bg-accent"
                      />
                    )}
                    {item.icon({
                      className: `h-[18px] w-[18px] shrink-0 ${
                        active ? 'text-accent' : 'text-ink-muted group-hover:text-ink'
                      }`,
                    })}
                    {!isCollapsed && <span className="truncate">{item.label}</span>}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>

        {adminItems.length > 0 && (
          <div>
            {!isCollapsed && (
              <p className="mb-2 px-2.5 text-[11px] font-semibold tracking-wide text-ink-muted">
                Administrasi
              </p>
            )}
            <ul className="space-y-1">
              {adminItems.map((item) => {
                const active = isActiveRoute(item.href);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      title={isCollapsed ? item.label : undefined}
                      aria-current={active ? 'page' : undefined}
                      className={`group relative flex min-h-[44px] items-center gap-3 rounded-lg px-2.5 text-sm font-medium transition-[background-color,color] duration-150 ${
                        active
                          ? 'bg-accent-soft text-accent-ink font-semibold'
                          : 'text-ink-secondary hover:bg-subtle hover:text-ink'
                      } ${isCollapsed ? 'justify-center px-0' : ''}`}
                    >
                      {active && (
                        <span
                          aria-hidden="true"
                          className="absolute left-0 top-2 bottom-2 w-1 rounded-r-full bg-accent"
                        />
                      )}
                      {item.icon({
                        className: `h-[18px] w-[18px] shrink-0 ${
                          active ? 'text-accent' : 'text-ink-muted group-hover:text-ink'
                        }`,
                      })}
                      {!isCollapsed && <span className="truncate">{item.label}</span>}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>

      {/* User Footer inside Sidebar */}
      <div className="border-t border-line pt-4 space-y-2">
        <div
          className={`flex items-center gap-3 rounded-lg border border-line bg-subtle/60 p-2.5 ${
            isCollapsed ? 'justify-center px-1.5' : ''
          }`}
        >
          <span
            aria-hidden="true"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-accent text-xs font-bold text-accent-fg"
          >
            {initials}
          </span>
          {!isCollapsed && (
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold text-ink">{user.name}</p>
              <p className="truncate text-[11px] text-ink-secondary">{user.roleName}</p>
            </div>
          )}
        </div>

        <form action="/api/auth/logout" method="post">
          <button
            type="submit"
            title={isCollapsed ? 'Keluar dari sistem' : undefined}
            className={`flex min-h-[44px] w-full items-center gap-2.5 rounded-lg border border-line bg-surface px-3 text-xs font-semibold text-ink-secondary transition-[background-color,border-color,color,transform] duration-150 hover:border-line-strong hover:bg-subtle hover:text-ink active:scale-[0.98] ${
              isCollapsed ? 'justify-center px-0' : ''
            }`}
          >
            <IconLogout className="h-4 w-4 shrink-0" />
            {!isCollapsed && <span>Keluar</span>}
          </button>
        </form>
      </div>
    </div>
  );

  return (
    <div className="min-h-dvh bg-canvas text-ink flex flex-col lg:flex-row">
      {/* Skip to Main Content */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-lg focus:bg-accent focus:px-4 focus:py-2 focus:text-xs focus:font-semibold focus:text-accent-fg focus:shadow-lg"
      >
        Lewati ke konten utama
      </a>

      {/* Desktop Sidebar */}
      <aside
        aria-label="Navigasi Utama"
        className={`hidden lg:flex lg:flex-col lg:shrink-0 lg:sticky lg:top-0 lg:h-dvh border-r border-line bg-surface transition-[width] duration-200 ease-out ${
          collapsed ? 'w-[74px]' : 'w-64'
        }`}
      >
        <div
          className={`flex h-14 items-center border-b border-line px-3.5 ${
            collapsed ? 'justify-center' : 'justify-between'
          }`}
        >
          <Link
            href="/dashboard"
            className="flex items-center gap-2.5 text-ink hover:opacity-90 transition-opacity"
          >
            <NimsBrandMark className="h-7 w-7 shrink-0" />
            {!collapsed && (
              <div className="leading-tight">
                <span className="block text-sm font-bold tracking-tight text-ink">NIMS</span>
                <span className="block text-[10px] font-mono text-ink-muted">Inventory Ops</span>
              </div>
            )}
          </Link>

          {!collapsed && (
            <button
              type="button"
              onClick={toggleCollapse}
              aria-label="Ciutkan sidebar"
              title="Ciutkan sidebar"
              className="flex h-9 w-9 items-center justify-center rounded-lg text-ink-muted transition-[background-color,color] duration-150 hover:bg-subtle hover:text-ink"
            >
              <IconPanelCollapse className="h-4 w-4" />
            </button>
          )}
        </div>

        {collapsed && (
          <div className="flex justify-center border-b border-line py-2">
            <button
              type="button"
              onClick={toggleCollapse}
              aria-label="Luaskan sidebar"
              title="Luaskan sidebar"
              className="flex h-9 w-9 items-center justify-center rounded-lg text-ink-muted transition-[background-color,color] duration-150 hover:bg-subtle hover:text-ink"
            >
              <IconPanelCollapse className="h-4 w-4 rotate-180" />
            </button>
          </div>
        )}

        <nav className="flex flex-1 flex-col overflow-hidden">{renderNavLinks(collapsed)}</nav>
      </aside>

      {/* Mobile Drawer Overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div
            className="fixed inset-0 bg-slate-950/60 animate-backdrop"
            onClick={closeMobile}
            aria-hidden="true"
          />
          <aside
            aria-label="Menu Navigasi Seluler"
            className="relative z-10 flex w-72 max-w-[85vw] flex-col border-r border-line bg-surface shadow-2xl animate-drawer"
          >
            <div className="flex h-14 items-center justify-between border-b border-line px-4">
              <Link
                href="/dashboard"
                onClick={closeMobile}
                className="flex items-center gap-2.5 text-ink"
              >
                <NimsBrandMark className="h-7 w-7" />
                <div className="leading-tight">
                  <span className="block text-sm font-bold tracking-tight">NIMS</span>
                  <span className="block text-[10px] font-mono text-ink-muted">Inventory Ops</span>
                </div>
              </Link>
              <button
                type="button"
                onClick={closeMobile}
                aria-label="Tutup menu navigasi"
                className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg text-ink-secondary hover:bg-subtle hover:text-ink"
              >
                <IconClose className="h-5 w-5" />
              </button>
            </div>
            <nav className="flex flex-1 flex-col overflow-hidden">{renderNavLinks(false)}</nav>
          </aside>
        </div>
      )}

      {/* Right Column: Header Bar + Main Content */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-3 border-b border-line bg-surface px-4 sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              aria-label="Buka menu navigasi"
              className="inline-flex min-h-[44px] items-center gap-2 rounded-lg border border-line bg-surface px-3 text-xs font-semibold text-ink transition-[background-color,border-color] duration-150 hover:bg-subtle lg:hidden"
            >
              <IconMenu className="h-4 w-4" />
              <span>Menu</span>
            </button>

            <Link
              href="/dashboard"
              className="flex items-center gap-2 lg:hidden"
            >
              <NimsBrandMark className="h-6 w-6 shrink-0" />
              <span className="text-sm font-bold tracking-tight text-ink">NIMS</span>
            </Link>

            <div className="hidden lg:flex lg:items-center lg:gap-2">
              <span className="text-xs font-medium text-ink-muted">Ruang Kerja:</span>
              <span className="text-sm font-semibold text-ink truncate">{currentTitle}</span>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <div className="hidden sm:block text-right">
              <p className="text-xs font-semibold text-ink leading-tight">{user.name}</p>
              <p className="text-[11px] text-ink-secondary leading-tight">{user.roleName}</p>
            </div>
            <ThemeToggle compact />
          </div>
        </header>

        <main
          id="main-content"
          className="mx-auto w-full max-w-7xl flex-1 px-4 py-5 sm:px-6 lg:px-8 lg:py-7"
        >
          {children}
        </main>
      </div>
    </div>
  );
}
