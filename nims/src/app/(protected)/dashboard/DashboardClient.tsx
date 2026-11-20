'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

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
  CREATE: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  UPDATE: 'bg-blue-50 text-blue-700 border-blue-200',
  DELETE: 'bg-rose-50 text-rose-700 border-rose-200',
  ARCHIVE: 'bg-amber-50 text-amber-700 border-amber-200',
  RESTORE: 'bg-teal-50 text-teal-700 border-teal-200',
  UPLOAD_DOCUMENT: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  DOWNLOAD_DOCUMENT: 'bg-cyan-50 text-cyan-700 border-cyan-200',
  EXPORT: 'bg-purple-50 text-purple-700 border-purple-200',
  ACCESS_DENIED: 'bg-rose-100 text-rose-800 border-rose-300',
};

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: 'bg-emerald-100 text-emerald-800',
  PLANNED: 'bg-blue-100 text-blue-800',
  MAINTENANCE: 'bg-amber-100 text-amber-800',
  RETIRED: 'bg-slate-200 text-slate-700',
  LOST: 'bg-rose-100 text-rose-800',
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
      <div className="flex h-64 items-center justify-center text-slate-400 text-xs">
        Memuat statistik dashboard...
      </div>
    );
  }

  if (error && !stats) {
    return (
      <div className="rounded border border-rose-200 bg-rose-50 p-4 text-xs text-rose-800 space-y-2">
        <p className="font-semibold">Gagal memuat dashboard</p>
        <p>{error}</p>
        <button
          onClick={fetchStats}
          className="rounded bg-rose-600 px-3 py-1 text-white hover:bg-rose-500"
        >
          Coba Lagi
        </button>
      </div>
    );
  }

  const { overview, devicesByCategory, devicesByStatus, devicesBySite, incompleteDevices, recentActivities } = stats!;

  return (
    <div className="space-y-6">
      {/* Top Banner & Quick Actions */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between bg-white p-5 rounded-lg border border-slate-200 shadow-sm">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">
            Selamat Datang, {user.name}
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Role: <span className="font-semibold text-indigo-700">{user.role.name}</span> &bull; Network Inventory Management System (NIMS)
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {canCreateDevice && (
            <Link
              href="/devices/new"
              className="rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-indigo-500"
            >
              + Tambah Perangkat
            </Link>
          )}
          <Link
            href="/devices"
            className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
          >
            Daftar Inventaris
          </Link>
          {canViewAudit && (
            <Link
              href="/audit-logs"
              className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              Audit Log
            </Link>
          )}
          <button
            onClick={fetchStats}
            title="Muat ulang data statistik"
            className="rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
          >
            ↻ Refresh
          </button>
        </div>
      </div>

      {/* 4 Kartu Metrik Utama (T6.1) */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Card 1: Total Devices */}
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Perangkat Aktif</span>
            <span className="text-lg">🖥️</span>
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <p className="text-2xl font-bold text-slate-900">{overview.totalActiveDevices}</p>
            <span className="text-[11px] text-slate-500">
              dari {overview.totalDevices} total
            </span>
          </div>
          <p className="mt-1 text-[11px] text-slate-400">
            {overview.totalArchivedDevices} perangkat diarsipkan
          </p>
        </div>

        {/* Card 2: Total Sites */}
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Site / Lokasi POP</span>
            <span className="text-lg">🏢</span>
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <p className="text-2xl font-bold text-slate-900">{overview.totalSites}</p>
            <Link href="/master" className="text-[11px] text-indigo-600 hover:underline">
              Kelola Site &rarr;
            </Link>
          </div>
          <p className="mt-1 text-[11px] text-slate-400">Lokasi datacenter & POP terdaftar</p>
        </div>

        {/* Card 3: Total Subnets */}
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Subnet IPAM</span>
            <span className="text-lg">🌐</span>
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <p className="text-2xl font-bold text-slate-900">{overview.totalSubnets}</p>
            <span className="text-[11px] text-slate-400">Blok Alamat IP</span>
          </div>
          <p className="mt-1 text-[11px] text-slate-400">Alokasi & validasi hierarki CIDR</p>
        </div>

        {/* Card 4: Total Connections */}
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Relasi Koneksi Aktif</span>
            <span className="text-lg">🔗</span>
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <p className="text-2xl font-bold text-slate-900">{overview.totalConnections}</p>
            <span className="text-[11px] text-emerald-600 font-medium">Terdokumentasi</span>
          </div>
          <p className="mt-1 text-[11px] text-slate-400">Koneksi fisik & logis antarport</p>
        </div>
      </div>

      {/* Grid: Kategori, Status & Distribusi Site */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Kolom 1: Perangkat per Kategori */}
        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between border-b pb-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600">
              Perangkat per Kategori
            </h3>
            <span className="text-[11px] text-slate-400">{devicesByCategory.length} Kategori</span>
          </div>
          <div className="space-y-2 text-xs">
            {devicesByCategory.map((cat) => {
              const pct = overview.totalActiveDevices > 0
                ? Math.round((cat.count / overview.totalActiveDevices) * 100)
                : 0;
              return (
                <div key={cat.id} className="space-y-1">
                  <div className="flex justify-between text-slate-700">
                    <span className="font-medium">{cat.name}</span>
                    <span className="font-mono text-slate-500">{cat.count} ({pct}%)</span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-indigo-600 transition-all duration-300"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Kolom 2: Status Inventaris */}
        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between border-b pb-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600">
              Status Inventaris
            </h3>
            <span className="text-[11px] text-slate-400">Administratif</span>
          </div>
          <div className="space-y-2.5 text-xs">
            {devicesByStatus.map((st) => (
              <div key={st.status} className="flex items-center justify-between p-2 rounded border border-slate-100 bg-slate-50/50">
                <span className={`rounded px-2 py-0.5 text-[11px] font-semibold ${STATUS_COLORS[st.status] || 'bg-slate-100 text-slate-700'}`}>
                  {st.status}
                </span>
                <span className="font-mono font-bold text-slate-800">{st.count} unit</span>
              </div>
            ))}
          </div>
        </div>

        {/* Kolom 3: Lokasi & Kelengkapan Data */}
        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm space-y-4">
          <div>
            <div className="flex items-center justify-between border-b pb-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600">
                Kelengkapan Data
              </h3>
              <span className="font-mono font-bold text-indigo-600 text-xs">
                {overview.completenessPercentage}%
              </span>
            </div>
            <div className="mt-2.5 space-y-1.5">
              <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${
                    overview.completenessPercentage >= 80 ? 'bg-emerald-500' : 'bg-amber-500'
                  }`}
                  style={{ width: `${overview.completenessPercentage}%` }}
                />
              </div>
              <p className="text-[11px] text-slate-500 flex justify-between">
                <span>{overview.totalActiveDevices - overview.incompleteCount} Lengkap</span>
                <span className={overview.incompleteCount > 0 ? 'text-amber-600 font-semibold' : 'text-slate-400'}>
                  {overview.incompleteCount} Belum Lengkap
                </span>
              </p>
            </div>
          </div>

          <div className="pt-2 border-t border-slate-100">
            <h4 className="text-xs font-semibold text-slate-600 mb-2">Sebaran Perangkat per Site</h4>
            <div className="space-y-1.5 text-xs max-h-40 overflow-y-auto">
              {devicesBySite.map((s) => (
                <div key={s.id} className="flex justify-between py-1 border-b border-slate-50">
                  <span className="text-slate-700 font-medium truncate max-w-[180px]">
                    {s.siteCode} - {s.name}
                  </span>
                  <span className="font-mono text-slate-500 font-semibold">{s.count} unit</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Bagian: Data Belum Lengkap (T6.1) */}
      <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm space-y-3">
        <div className="flex items-center justify-between border-b pb-2.5">
          <div>
            <h3 className="text-sm font-bold text-slate-900">
              Audit Kelengkapan Data Perangkat
            </h3>
            <p className="text-[11px] text-slate-500">
              Perangkat aktif yang belum memiliki Management IP, Serial Number, Model, atau Ruang/Rak.
            </p>
          </div>
          <span className={`rounded px-2.5 py-0.5 text-xs font-semibold ${
            incompleteDevices.length === 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
          }`}>
            {overview.incompleteCount} Perangkat Perlu Dilengkapi
          </span>
        </div>

        {incompleteDevices.length === 0 ? (
          <div className="rounded-md border border-emerald-200 bg-emerald-50/50 p-6 text-center text-xs text-emerald-800">
            <p className="font-semibold text-sm">🎉 Luar biasa! Semua data perangkat aktif telah lengkap 100%.</p>
            <p className="text-[11px] text-emerald-600 mt-1">
              Setiap perangkat telah terisi IP manajemen, serial number, model, dan lokasi fisik.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left divide-y divide-slate-200 text-xs">
              <thead className="bg-slate-50 text-[11px] font-semibold text-slate-600 uppercase">
                <tr>
                  <th className="py-2.5 px-3">Kode & Hostname</th>
                  <th className="py-2.5 px-3">Kategori</th>
                  <th className="py-2.5 px-3">Lokasi (Site)</th>
                  <th className="py-2.5 px-3">Field Yang Belum Lengkap</th>
                  <th className="py-2.5 px-3 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {incompleteDevices.map((dev) => (
                  <tr key={dev.id} className="hover:bg-slate-50/70">
                    <td className="py-2 px-3 font-medium text-slate-900">
                      <div>{dev.hostname}</div>
                      <div className="font-mono text-[11px] text-slate-400">{dev.deviceCode}</div>
                    </td>
                    <td className="py-2 px-3 text-slate-700">{dev.category}</td>
                    <td className="py-2 px-3 text-slate-600">{dev.site}</td>
                    <td className="py-2 px-3">
                      <div className="flex flex-wrap gap-1">
                        {dev.missingFields.map((field) => (
                          <span
                            key={field}
                            className="inline-block rounded bg-rose-50 border border-rose-200 px-1.5 py-0.5 text-[10px] font-medium text-rose-700"
                          >
                            ⚠️ Tanpa {field}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="py-2 px-3 text-right">
                      <Link
                        href={`/devices/${dev.id}`}
                        className="inline-block rounded border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-[11px] font-medium text-indigo-700 hover:bg-indigo-100"
                      >
                        Lengkapi Data &rarr;
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Bagian: Aktivitas Terkini (Recent Audit Trail) */}
      <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm space-y-3">
        <div className="flex items-center justify-between border-b pb-2.5">
          <div>
            <h3 className="text-sm font-bold text-slate-900">
              Aktivitas Sistem Terkini
            </h3>
            <p className="text-[11px] text-slate-500">
              Riwayat perubahan data inventaris, alokasi IP, relasi jaringan, dan pengunggahan berkas.
            </p>
          </div>
          {canViewAudit && (
            <Link
              href="/audit-logs"
              className="text-xs font-semibold text-indigo-600 hover:text-indigo-800"
            >
              Lihat Semua Audit Log &rarr;
            </Link>
          )}
        </div>

        {recentActivities.length === 0 ? (
          <p className="text-center text-xs text-slate-400 py-6">Belum ada aktivitas tercatat.</p>
        ) : (
          <div className="divide-y divide-slate-100 text-xs">
            {recentActivities.map((log) => (
              <div key={log.id} className="py-2.5 flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <span
                    className={`inline-block rounded border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                      ACTION_COLORS[log.action] || 'bg-slate-100 text-slate-700 border-slate-200'
                    }`}
                  >
                    {log.action}
                  </span>
                  <div>
                    <span className="font-semibold text-slate-800">{log.entityType}</span>
                    {log.entityId && (
                      <span className="text-slate-400 font-mono text-[11px]"> #{log.entityId}</span>
                    )}
                    <span className="text-slate-500 ml-2">
                      oleh <strong>{log.user ? `${log.user.name} (@${log.user.username})` : 'System'}</strong>
                    </span>
                  </div>
                </div>
                <span className="text-[11px] text-slate-400 font-mono">
                  {new Date(log.createdAt).toLocaleString('id-ID')}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
