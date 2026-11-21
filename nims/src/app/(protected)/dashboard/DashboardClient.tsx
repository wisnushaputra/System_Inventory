'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { AnimatedNumber } from '@/components/AnimatedNumber';
import {
  IconServer,
  IconPopBuilding,
  IconSubnetGlobe,
  IconLinkCable,
  IconPlus,
  IconRefresh,
  IconArrowRight,
  IconCheckCircle,
  IconAlertTriangle,
  IconAudit,
} from '@/components/Icons';

interface DashboardStats {
  overview: {
    totalActiveDevices: number;
    totalArchivedDevices: number;
    totalDevices: number;
    totalSites: number;
    totalSubnets: number;
    totalConnections: number;
    incompleteCount: number;
    completenessPercentage: number;
  };
  devicesByCategory: { id: number; code: string; name: string; count: number }[];
  devicesByStatus: { status: string; count: number }[];
  devicesBySite: { id: number; siteCode: string; name: string; count: number }[];
  incompleteDevices: {
    id: number;
    deviceCode: string;
    hostname: string;
    category: string;
    site: string;
    missingFields: string[];
  }[];
  recentActivities: {
    id: number;
    action: string;
    entityType: string;
    entityId: number | null;
    createdAt: string;
    user: { id: number; name: string; username: string } | null;
  }[];
}

interface Props {
  initialStats: DashboardStats | null;
  user: { name: string; role: { name: string } };
  canCreateDevice: boolean;
  canViewAudit: boolean;
}

const ACTION_COLORS: Record<string, string> = {
  CREATE:
    'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800/70',
  UPDATE:
    'bg-sky-50 text-sky-800 border-sky-200 dark:bg-sky-950/60 dark:text-sky-300 dark:border-sky-800/70',
  DELETE:
    'bg-rose-50 text-rose-800 border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800/70',
  ARCHIVE:
    'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800/70',
  RESTORE:
    'bg-teal-50 text-teal-800 border-teal-200 dark:bg-teal-950/60 dark:text-teal-300 dark:border-teal-800/70',
  UPLOAD_DOCUMENT:
    'bg-cyan-50 text-cyan-800 border-cyan-200 dark:bg-cyan-950/60 dark:text-cyan-300 dark:border-cyan-800/70',
  DOWNLOAD_DOCUMENT:
    'bg-cyan-50 text-cyan-800 border-cyan-200 dark:bg-cyan-950/60 dark:text-cyan-300 dark:border-cyan-800/70',
  EXPORT:
    'bg-slate-100 text-slate-800 border-slate-300 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700',
  ACCESS_DENIED:
    'bg-rose-100 text-rose-900 border-rose-300 dark:bg-rose-950 dark:text-rose-200 dark:border-rose-800',
};

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950/70 dark:text-emerald-300',
  PLANNED: 'bg-sky-100 text-sky-900 dark:bg-sky-950/70 dark:text-sky-300',
  MAINTENANCE: 'bg-amber-100 text-amber-900 dark:bg-amber-950/70 dark:text-amber-300',
  RETIRED: 'bg-subtle text-ink-secondary',
  LOST: 'bg-rose-100 text-rose-900 dark:bg-rose-950/70 dark:text-rose-300',
};

export function DashboardClient({ initialStats, user, canCreateDevice, canViewAudit }: Props) {
  const [stats, setStats] = useState<DashboardStats | null>(initialStats);
  const [loading, setLoading] = useState(!initialStats);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/dashboard/stats');
      if (!res.ok) throw new Error('Gagal mengambil data dashboard');
      const data = await res.json();
      setStats(data);
    } catch (err: any) {
      setError(err.message || 'Terjadi kesalahan sistem');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!initialStats) {
      fetchStats();
    }
  }, [initialStats]);

  if (loading && !stats) {
    return (
      <div className="flex h-64 items-center justify-center rounded-xl border border-line bg-surface text-xs text-ink-secondary">
        Memuat ringkasan statistik inventaris...
      </div>
    );
  }

  if (error && !stats) {
    return (
      <div className="rounded-xl border border-rose-200 dark:border-rose-900/60 bg-rose-50 dark:bg-rose-950/50 p-5 text-xs text-rose-900 dark:text-rose-200 space-y-3">
        <p className="font-semibold">Gagal memuat statistik dashboard</p>
        <p>{error}</p>
        <button
          type="button"
          onClick={fetchStats}
          className="min-h-[44px] rounded-lg bg-rose-600 px-4 py-2 text-xs font-semibold text-white hover:bg-rose-500"
        >
          Muat Ulang Data
        </button>
      </div>
    );
  }

  const {
    overview,
    devicesByCategory,
    devicesByStatus,
    devicesBySite,
    incompleteDevices,
    recentActivities,
  } = stats!;

  const ringRadius = 38;
  const ringCircumference = 2 * Math.PI * ringRadius;
  const clampedPct = Math.max(0, Math.min(100, overview.completenessPercentage));
  const ringOffset = ringCircumference - (clampedPct / 100) * ringCircumference;
  const isHealthyCompleteness = clampedPct >= 80;
  const completeUnitCount = Math.max(0, overview.totalActiveDevices - overview.incompleteCount);

  return (
    <div className="space-y-6">
      {/* Top Action Header */}
      <section className="animate-enter flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between rounded-xl border border-line bg-surface p-5 shadow-xs">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-ink sm:text-2xl">
            Selamat Datang, {user.name}
          </h1>
          <p className="mt-1 text-xs text-ink-secondary flex flex-wrap items-center gap-2">
            <span>Peran aktif:</span>
            <span className="inline-flex items-center rounded-md bg-accent-soft px-2 py-0.5 text-[11px] font-semibold text-accent-ink">
              {user.role.name}
            </span>
            <span className="text-ink-muted">Ringkasan inventaris jaringan terkini</span>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {canCreateDevice && (
            <Link
              href="/devices/new"
              className="inline-flex min-h-[44px] items-center gap-2 rounded-lg bg-accent px-4 py-2 text-xs font-semibold text-accent-fg shadow-xs transition-[background-color,transform] duration-150 hover:bg-accent-hover active:scale-[0.97]"
            >
              <IconPlus className="h-4 w-4" />
              <span>Daftarkan Perangkat</span>
            </Link>
          )}
          <Link
            href="/devices"
            className="inline-flex min-h-[44px] items-center gap-1.5 rounded-lg border border-line bg-surface px-3.5 py-2 text-xs font-medium text-ink-secondary transition-[background-color,border-color,color] duration-150 hover:border-line-strong hover:bg-subtle hover:text-ink"
          >
            <span>Buka Inventaris</span>
          </Link>
          {canViewAudit && (
            <Link
              href="/audit-logs"
              className="inline-flex min-h-[44px] items-center gap-1.5 rounded-lg border border-line bg-surface px-3.5 py-2 text-xs font-medium text-ink-secondary transition-[background-color,border-color,color] duration-150 hover:border-line-strong hover:bg-subtle hover:text-ink"
            >
              <IconAudit className="h-4 w-4" />
              <span>Audit Log</span>
            </Link>
          )}
          <button
            type="button"
            onClick={fetchStats}
            disabled={loading}
            aria-label="Muat ulang statistik dashboard"
            title="Muat ulang data statistik"
            className="inline-flex min-h-[44px] items-center gap-1.5 rounded-lg border border-line bg-surface px-3 py-2 text-xs font-medium text-ink-secondary transition-[background-color,border-color,color,transform] duration-150 hover:border-line-strong hover:bg-subtle hover:text-ink active:scale-[0.97] disabled:opacity-60"
          >
            <IconRefresh className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            <span>Muat Ulang</span>
          </button>
        </div>
      </section>

      {/* Focal Asymmetric KPI Section */}
      <section className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        {/* Focal Hero Card: Data Completeness Ring */}
        <div className="animate-enter stagger-1 lg:col-span-5 rounded-xl border border-line bg-surface p-5 shadow-xs flex flex-col justify-between gap-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-bold text-ink">Audit Kelengkapan Inventaris</h2>
              <p className="mt-0.5 text-xs text-ink-secondary">
                Rasio perangkat aktif dengan IP manajemen, nomor seri, model, dan penempatan fisik lengkap.
              </p>
            </div>
            <span
              className={`shrink-0 rounded-md px-2 py-0.5 text-[11px] font-semibold ${
                isHealthyCompleteness
                  ? 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950/70 dark:text-emerald-300'
                  : 'bg-amber-100 text-amber-900 dark:bg-amber-950/70 dark:text-amber-300'
              }`}
            >
              {isHealthyCompleteness ? 'Siap Audit' : 'Perlu Lengkapi'}
            </span>
          </div>

          <div className="flex items-center gap-5 py-1">
            <div className="relative flex h-24 w-24 shrink-0 items-center justify-center">
              <svg viewBox="0 0 96 96" className="h-24 w-24 -rotate-90" aria-hidden="true">
                <circle
                  cx="48"
                  cy="48"
                  r={ringRadius}
                  fill="none"
                  strokeWidth="8"
                  className="stroke-subtle"
                />
                <circle
                  cx="48"
                  cy="48"
                  r={ringRadius}
                  fill="none"
                  strokeWidth="8"
                  strokeLinecap="round"
                  strokeDasharray={ringCircumference}
                  strokeDashoffset={ringOffset}
                  className={`transition-[stroke-dashoffset] duration-700 ease-out ${
                    isHealthyCompleteness
                      ? 'stroke-emerald-600 dark:stroke-emerald-400'
                      : 'stroke-amber-600 dark:stroke-amber-400'
                  }`}
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <AnimatedNumber
                  value={overview.completenessPercentage}
                  suffix="%"
                  className="text-xl font-bold font-mono text-ink"
                />
              </div>
            </div>

            <div className="flex-1 space-y-2 text-xs">
              <div className="flex items-center justify-between rounded-lg bg-subtle px-3 py-2">
                <span className="text-ink-secondary">Atribut Lengkap</span>
                <span className="font-mono font-bold text-ink tabular-nums-data">
                  {completeUnitCount} unit
                </span>
              </div>
              <div className="flex items-center justify-between rounded-lg bg-subtle px-3 py-2">
                <span className="text-ink-secondary">Belum Lengkap</span>
                <span
                  className={`font-mono font-bold tabular-nums-data ${
                    overview.incompleteCount > 0
                      ? 'text-amber-700 dark:text-amber-300'
                      : 'text-emerald-700 dark:text-emerald-300'
                  }`}
                >
                  {overview.incompleteCount} unit
                </span>
              </div>
            </div>
          </div>

          {overview.incompleteCount > 0 ? (
            <a
              href="#audit-kelengkapan"
              className="inline-flex items-center justify-between rounded-lg border border-line bg-canvas px-3.5 py-2.5 text-xs font-semibold text-accent-ink transition-colors duration-150 hover:border-accent"
            >
              <span>Tinjau {overview.incompleteCount} perangkat yang perlu dilengkapi</span>
              <IconArrowRight className="h-4 w-4" />
            </a>
          ) : (
            <div className="inline-flex items-center gap-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 px-3.5 py-2.5 text-xs font-medium text-emerald-800 dark:text-emerald-300">
              <IconCheckCircle className="h-4 w-4 shrink-0" />
              <span>Seluruh data perangkat aktif telah lengkap.</span>
            </div>
          )}
        </div>

        {/* Right Asymmetric Metric Cluster */}
        <div className="lg:col-span-7 flex flex-col gap-4">
          {/* Primary Active Devices Banner Card */}
          <div className="animate-enter stagger-2 rounded-xl border border-line bg-surface p-5 shadow-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent-ink">
                <IconServer className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs font-semibold text-ink-secondary">Perangkat Aktif Terkelola</p>
                <div className="mt-1 flex items-baseline gap-2.5">
                  <AnimatedNumber
                    value={overview.totalActiveDevices}
                    className="text-3xl font-bold font-mono text-ink"
                  />
                  <span className="text-xs text-ink-muted tabular-nums-data">
                    dari {overview.totalDevices} total terdaftar ({overview.totalArchivedDevices} arsip)
                  </span>
                </div>
              </div>
            </div>

            <Link
              href="/devices"
              className="inline-flex min-h-[44px] shrink-0 items-center gap-1.5 rounded-lg border border-line bg-canvas px-3.5 py-2 text-xs font-semibold text-ink transition-[border-color,background-color] duration-150 hover:border-accent hover:bg-accent-soft hover:text-accent-ink"
            >
              <span>Kelola Perangkat</span>
              <IconArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          {/* Three Compact Infrastructure Metric Cards */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 flex-1">
            <div className="animate-enter stagger-3 rounded-xl border border-line bg-surface p-4 shadow-xs flex flex-col justify-between transition-[border-color,transform] duration-150 hover:-translate-y-0.5 hover:border-line-strong">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-ink-secondary">Site & POP</span>
                <span className="flex h-8 w-8 items-center justify-center rounded-md bg-subtle text-ink-secondary">
                  <IconPopBuilding className="h-4 w-4" />
                </span>
              </div>
              <div className="mt-3">
                <AnimatedNumber
                  value={overview.totalSites}
                  className="text-2xl font-bold font-mono text-ink"
                />
                <div className="mt-1 flex items-center justify-between gap-2 text-[11px]">
                  <span className="text-ink-muted truncate">POP & lokasi pelanggan</span>
                  <Link href="/master" className="font-semibold text-accent-ink hover:underline whitespace-nowrap shrink-0">
                    Master Data
                  </Link>
                </div>
              </div>
            </div>

            <div className="animate-enter stagger-4 rounded-xl border border-line bg-surface p-4 shadow-xs flex flex-col justify-between transition-[border-color,transform] duration-150 hover:-translate-y-0.5 hover:border-line-strong">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-ink-secondary">Subnet IPAM</span>
                <span className="flex h-8 w-8 items-center justify-center rounded-md bg-subtle text-ink-secondary">
                  <IconSubnetGlobe className="h-4 w-4" />
                </span>
              </div>
              <div className="mt-3">
                <AnimatedNumber
                  value={overview.totalSubnets}
                  className="text-2xl font-bold font-mono text-ink"
                />
                <p className="mt-1 text-[11px] text-ink-muted">Blok CIDR & alokasi IP</p>
              </div>
            </div>

            <div className="animate-enter stagger-5 rounded-xl border border-line bg-surface p-4 shadow-xs flex flex-col justify-between transition-[border-color,transform] duration-150 hover:-translate-y-0.5 hover:border-line-strong">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-ink-secondary">Relasi Koneksi</span>
                <span className="flex h-8 w-8 items-center justify-center rounded-md bg-subtle text-ink-secondary">
                  <IconLinkCable className="h-4 w-4" />
                </span>
              </div>
              <div className="mt-3">
                <AnimatedNumber
                  value={overview.totalConnections}
                  className="text-2xl font-bold font-mono text-ink"
                />
                <div className="mt-1 flex items-center justify-between gap-2 text-[11px]">
                  <span className="text-ink-muted truncate">Tautan port aktif</span>
                  <Link href="/topology" className="font-semibold text-accent-ink hover:underline whitespace-nowrap shrink-0">
                    Topologi
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Incomplete Data Audit Table */}
      <section
        id="audit-kelengkapan"
        className="animate-enter stagger-4 rounded-xl border border-line bg-surface p-5 shadow-xs space-y-4"
      >
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-line pb-3">
          <div>
            <h2 className="text-sm font-bold text-ink">Daftar Perangkat Perlu Dilengkapi</h2>
            <p className="text-xs text-ink-secondary mt-0.5">
              Perangkat aktif yang belum memiliki Management IP, Serial Number, Model Hardware, atau Penempatan Ruang dan Rak.
            </p>
          </div>
          <span
            className={`self-start sm:self-auto rounded-md px-2.5 py-1 text-xs font-semibold tabular-nums-data ${
              incompleteDevices.length === 0
                ? 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950/70 dark:text-emerald-300'
                : 'bg-amber-100 text-amber-900 dark:bg-amber-950/70 dark:text-amber-300'
            }`}
          >
            {overview.incompleteCount} Perangkat
          </span>
        </div>

        {incompleteDevices.length === 0 ? (
          <div className="rounded-lg border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50 dark:bg-emerald-950/40 p-6 text-center">
            <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300">
              <IconCheckCircle className="h-5 w-5" />
            </div>
            <p className="mt-2 text-sm font-semibold text-emerald-900 dark:text-emerald-200">
              Semua data perangkat aktif telah lengkap 100%.
            </p>
            <p className="mt-1 text-xs text-emerald-800 dark:text-emerald-300">
              Setiap unit tercatat dengan Management IP, Serial Number, model, dan lokasi fisik.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-line">
            <table className="min-w-full divide-y divide-line text-left text-xs">
              <thead className="bg-subtle text-[11px] font-semibold uppercase tracking-wide text-ink-secondary">
                <tr>
                  <th className="py-3 px-4">Kode & Hostname</th>
                  <th className="py-3 px-4">Kategori</th>
                  <th className="py-3 px-4">Lokasi (Site)</th>
                  <th className="py-3 px-4">Atribut Belum Lengkap</th>
                  <th className="py-3 px-4 text-right">Tindakan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line bg-surface">
                {incompleteDevices.map((dev) => (
                  <tr key={dev.id} className="transition-colors duration-100 hover:bg-subtle/60">
                    <td className="py-3 px-4">
                      <div className="font-semibold text-ink">{dev.hostname}</div>
                      <div className="font-mono text-[11px] text-ink-muted">{dev.deviceCode}</div>
                    </td>
                    <td className="py-3 px-4 text-ink-secondary">{dev.category}</td>
                    <td className="py-3 px-4 text-ink-secondary">{dev.site}</td>
                    <td className="py-3 px-4">
                      <div className="flex flex-wrap gap-1.5">
                        {dev.missingFields.map((field) => (
                          <span
                            key={field}
                            className="inline-flex items-center gap-1 rounded border border-rose-200 dark:border-rose-900/60 bg-rose-50 dark:bg-rose-950/60 px-2 py-0.5 text-[11px] font-medium text-rose-800 dark:text-rose-200"
                          >
                            <IconAlertTriangle className="h-3 w-3 shrink-0" />
                            <span>Tanpa {field}</span>
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <Link
                        href={`/devices/${dev.id}`}
                        className="inline-flex items-center gap-1 rounded-md border border-line bg-canvas px-3 py-1.5 text-xs font-semibold text-accent-ink transition-colors duration-150 hover:border-accent hover:bg-accent-soft"
                      >
                        <span>Lengkapi Data</span>
                        <IconArrowRight className="h-3.5 w-3.5" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Bottom Split: Distribution Breakdown (5 cols) + Recent Activities (7 cols) */}
      <section className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left Column: Category + Status + Sites */}
        <div className="lg:col-span-5 space-y-5">
          <div className="animate-enter stagger-5 rounded-xl border border-line bg-surface p-5 shadow-xs space-y-3.5">
            <div className="flex items-center justify-between border-b border-line pb-2.5">
              <h2 className="text-xs font-bold uppercase tracking-wider text-ink-secondary">
                Sebaran per Kategori
              </h2>
              <span className="text-xs font-mono text-ink-muted tabular-nums-data">
                {devicesByCategory.length} kategori
              </span>
            </div>
            <div className="space-y-2.5 text-xs">
              {devicesByCategory.map((cat) => {
                const pct =
                  overview.totalActiveDevices > 0
                    ? Math.round((cat.count / overview.totalActiveDevices) * 100)
                    : 0;
                return (
                  <div key={cat.id} className="space-y-1">
                    <div className="flex justify-between text-ink">
                      <span className="font-medium">{cat.name}</span>
                      <span className="font-mono text-ink-secondary tabular-nums-data">
                        {cat.count} ({pct}%)
                      </span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-subtle overflow-hidden">
                      <div
                        className="animate-bar-grow h-full rounded-full bg-accent"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="animate-enter stagger-6 rounded-xl border border-line bg-surface p-5 shadow-xs space-y-4">
            <div>
              <div className="flex items-center justify-between border-b border-line pb-2.5">
                <h2 className="text-xs font-bold uppercase tracking-wider text-ink-secondary">
                  Status Inventaris
                </h2>
                <span className="text-xs text-ink-muted">Administratif</span>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                {devicesByStatus.map((st) => (
                  <div
                    key={st.status}
                    className="flex items-center justify-between rounded-lg border border-line bg-canvas px-3 py-2"
                  >
                    <span
                      className={`rounded px-2 py-0.5 text-[11px] font-semibold ${
                        STATUS_COLORS[st.status] || 'bg-subtle text-ink-secondary'
                      }`}
                    >
                      {st.status}
                    </span>
                    <span className="font-mono font-bold text-ink tabular-nums-data">
                      {st.count}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="border-t border-line pt-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-ink-secondary mb-2.5">
                Unit per Site
              </h3>
              <div className="space-y-1.5 text-xs max-h-44 overflow-y-auto pr-1">
                {devicesBySite.map((s) => (
                  <div
                    key={s.id}
                    className="flex items-center justify-between py-1.5 border-b border-line/70 last:border-0"
                  >
                    <span className="text-ink font-medium truncate max-w-[210px]">
                      {s.siteCode} - {s.name}
                    </span>
                    <span className="font-mono text-ink-secondary font-semibold tabular-nums-data">
                      {s.count} unit
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Recent Activity Feed */}
        <div className="animate-enter stagger-5 lg:col-span-7 rounded-xl border border-line bg-surface p-5 shadow-xs space-y-3.5">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-line pb-3">
            <div>
              <h2 className="text-sm font-bold text-ink">Aktivitas Sistem Terkini</h2>
              <p className="text-xs text-ink-secondary">
                Riwayat pembaruan perangkat, alokasi IP, relasi port, dan dokumen lampiran.
              </p>
            </div>
            {canViewAudit && (
              <Link
                href="/audit-logs"
                className="inline-flex items-center gap-1 text-xs font-semibold text-accent-ink hover:underline"
              >
                <span>Semua Audit Log</span>
                <IconArrowRight className="h-3.5 w-3.5" />
              </Link>
            )}
          </div>

          {recentActivities.length === 0 ? (
            <div className="rounded-lg border border-dashed border-line p-8 text-center text-xs text-ink-secondary">
              Belum ada aktivitas mutasi data yang tercatat.
            </div>
          ) : (
            <div className="divide-y divide-line text-xs">
              {recentActivities.map((log) => (
                <div
                  key={log.id}
                  className="py-3 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex items-center flex-wrap gap-2">
                    <span
                      className={`inline-block rounded border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                        ACTION_COLORS[log.action] ||
                        'bg-subtle text-ink-secondary border-line'
                      }`}
                    >
                      {log.action}
                    </span>
                    <span className="font-semibold text-ink">{log.entityType}</span>
                    {log.entityId && (
                      <span className="font-mono text-[11px] text-ink-muted">
                        #{log.entityId}
                      </span>
                    )}
                    <span className="text-ink-secondary">
                      oleh{' '}
                      <strong className="text-ink">
                        {log.user ? `${log.user.name} (@${log.user.username})` : 'System'}
                      </strong>
                    </span>
                  </div>
                  <span className="text-[11px] text-ink-muted font-mono tabular-nums-data">
                    {new Date(log.createdAt).toLocaleString('id-ID')}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
