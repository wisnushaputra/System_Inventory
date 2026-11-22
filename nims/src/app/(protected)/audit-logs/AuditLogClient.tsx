'use client';

import { useState, useCallback, useEffect } from 'react';
import Link from 'next/link';
import {
  IconDownload,
  IconRefresh,
  IconClose,
  IconArrowLeft,
  IconArrowRight,
  IconExternalLink,
} from '@/components/Icons';

interface AuditItem {
  id: number;
  userId: number | null;
  action: string;
  entityType: string;
  entityId: number | null;
  beforeData: any;
  afterData: any;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
  user: { id: number; name: string; username: string } | null;
}

interface UserOption {
  id: number;
  name: string;
  username: string;
}

interface Props {
  users: UserOption[];
  canExport: boolean;
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
    'bg-indigo-50 text-indigo-800 border-indigo-200 dark:bg-indigo-950/60 dark:text-indigo-300 dark:border-indigo-800/70',
  UPLOAD_DOCUMENT:
    'bg-cyan-50 text-cyan-800 border-cyan-200 dark:bg-cyan-950/60 dark:text-cyan-300 dark:border-cyan-800/70',
  DOWNLOAD_DOCUMENT:
    'bg-cyan-50 text-cyan-800 border-cyan-200 dark:bg-cyan-950/60 dark:text-cyan-300 dark:border-cyan-800/70',
  EXPORT:
    'bg-subtle text-ink-secondary border-line',
  LOGIN:
    'bg-subtle text-ink border-line',
  LOGOUT:
    'bg-subtle text-ink-muted border-line',
  ACCESS_DENIED:
    'bg-rose-100 text-rose-900 border-rose-300 dark:bg-rose-950 dark:text-rose-200 dark:border-rose-800 font-bold',
};

const ENTITY_OPTIONS = [
  'Device',
  'Interface',
  'Subnet',
  'IpAddress',
  'NetworkConnection',
  'Document',
  'Site',
  'Room',
  'Rack',
  'Vendor',
  'DeviceModel',
  'DeviceCategory',
  'User',
  'AuditLog',
];

const ACTION_OPTIONS = [
  'CREATE',
  'UPDATE',
  'DELETE',
  'ARCHIVE',
  'RESTORE',
  'UPLOAD_DOCUMENT',
  'DOWNLOAD_DOCUMENT',
  'EXPORT',
  'LOGIN',
  'LOGOUT',
  'ACCESS_DENIED',
];

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function getPositiveInt(value: unknown): number | null {
  if (typeof value === 'number' && Number.isInteger(value) && value > 0) return value;
  if (typeof value === 'string') {
    const parsed = Number.parseInt(value, 10);
    if (Number.isInteger(parsed) && parsed > 0) return parsed;
  }
  return null;
}

function extractEntityLabel(log: AuditItem): string | null {
  const src = asRecord(log.afterData) ?? asRecord(log.beforeData);
  if (!src) return null;
  const candidate =
    src.hostname ??
    src.deviceCode ??
    src.siteCode ??
    src.cidr ??
    src.address ??
    src.modelCode ??
    src.originalFilename ??
    src.name ??
    src.username;
  return typeof candidate === 'string' && candidate.trim() ? candidate.trim() : null;
}

function resolveAuditEntityLink(log: AuditItem): { href: string; label: string } | null {
  const after = asRecord(log.afterData);
  const before = asRecord(log.beforeData);
  const meta = after ?? before;
  const isDeleted = log.action === 'DELETE';

  switch (log.entityType) {
    case 'Device':
      if (!log.entityId || isDeleted) return null;
      return { href: `/devices/${log.entityId}`, label: 'Buka Perangkat' };
    case 'Interface': {
      const devId = getPositiveInt(meta?.deviceId ?? before?.deviceId);
      if (!devId) return null;
      return { href: `/devices/${devId}?tab=ports`, label: 'Lihat Port' };
    }
    case 'Document': {
      const devId = getPositiveInt(meta?.deviceId ?? before?.deviceId);
      if (!devId) return null;
      return { href: `/devices/${devId}?tab=documents`, label: 'Lihat Dokumen' };
    }
    case 'NetworkConnection': {
      const devId = getPositiveInt(
        meta?.deviceId ?? meta?.endpointADeviceId ?? before?.deviceId ?? before?.endpointADeviceId
      );
      if (devId) {
        return { href: `/devices/${devId}?tab=connections`, label: 'Lihat Koneksi' };
      }
      return { href: '/topology', label: 'Buka Topologi' };
    }
    case 'Site':
      if (log.entityId && !isDeleted) {
        return { href: `/map?siteId=${log.entityId}`, label: 'Lihat di Peta' };
      }
      return { href: '/master?tab=sites', label: 'Master Site' };
    case 'Room':
    case 'Rack':
      return { href: '/master?tab=sites', label: 'Master Lokasi' };
    case 'Vendor':
      return { href: '/master?tab=vendors', label: 'Master Vendor' };
    case 'DeviceCategory':
      return { href: '/master?tab=categories', label: 'Master Kategori' };
    case 'DeviceModel':
      return { href: '/master?tab=models', label: 'Master Model' };
    case 'Subnet':
      if (log.entityId && !isDeleted) {
        return { href: `/ipam?subnetId=${log.entityId}`, label: 'Lihat Subnet' };
      }
      return { href: '/ipam', label: 'Buka IPAM' };
    case 'IpAddress': {
      const devId = getPositiveInt(meta?.deviceId ?? before?.deviceId);
      if (devId) {
        return { href: `/devices/${devId}?tab=network`, label: 'Jaringan Perangkat' };
      }
      const subId = getPositiveInt(meta?.subnetId ?? before?.subnetId);
      if (subId) {
        return { href: `/ipam?tab=addresses&subnetId=${subId}`, label: 'Lihat IPAM' };
      }
      const addr = typeof meta?.address === 'string' ? meta.address : null;
      if (addr) {
        return { href: `/ipam?tab=addresses&q=${encodeURIComponent(addr)}`, label: 'Cari di IPAM' };
      }
      return { href: '/ipam?tab=addresses', label: 'Buka IPAM' };
    }
    case 'User':
      return { href: '/users', label: 'Kelola Pengguna' };
    default:
      return null;
  }
}

export function AuditLogClient({ users, canExport }: Props) {
  const [logs, setLogs] = useState<AuditItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [userId, setUserId] = useState('');
  const [entityType, setEntityType] = useState('');
  const [action, setAction] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [q, setQ] = useState('');

  const [page, setPage] = useState(1);
  const [limit] = useState(25);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);

  const [selectedLog, setSelectedLog] = useState<AuditItem | null>(null);

  useEffect(() => {
    if (!selectedLog) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSelectedLog(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedLog]);

  const buildQueryString = useCallback(() => {
    const params = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString(),
    });
    if (userId) params.set('userId', userId);
    if (entityType) params.set('entityType', entityType);
    if (action) params.set('action', action);
    if (startDate) params.set('startDate', startDate);
    if (endDate) params.set('endDate', endDate);
    if (q) params.set('q', q);
    return params.toString();
  }, [page, limit, userId, entityType, action, startDate, endDate, q]);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/audit-logs?${buildQueryString()}`);
      if (!res.ok) throw new Error('Gagal memuat catatan audit log');
      const json = await res.json();
      setLogs(json.data);
      setTotalPages(json.pagination.totalPages || 1);
      setTotalItems(json.pagination.total || 0);
    } catch (err: any) {
      setErrorMsg(err.message || 'Terjadi kesalahan sistem');
    } finally {
      setLoading(false);
    }
  }, [buildQueryString]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const handleFilterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchLogs();
  };

  const handleResetFilters = () => {
    setUserId('');
    setEntityType('');
    setAction('');
    setStartDate('');
    setEndDate('');
    setQ('');
    setPage(1);
  };

  const exportUrl = `/api/export/audit-logs?${buildQueryString()}`;

  return (
    <div className="space-y-6">
      <div className="animate-enter flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-ink">
            Riwayat Perubahan & Audit Trail
          </h1>
          <p className="text-sm text-ink-secondary mt-1">
            Pencatatan aktivitas mutasi data sistem secara permanen, terperinci, dan bersifat baca-saja.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {canExport && (
            <a
              href={exportUrl}
              className="inline-flex min-h-[42px] items-center gap-2 rounded-lg border border-line bg-surface px-3.5 py-1.5 text-xs font-semibold text-ink-secondary shadow-xs hover:border-line-strong hover:bg-subtle hover:text-ink"
            >
              <IconDownload className="h-4 w-4" />
              <span>Ekspor Audit CSV</span>
            </a>
          )}
          <button
            type="button"
            onClick={fetchLogs}
            className="inline-flex min-h-[42px] items-center gap-1.5 rounded-lg border border-line bg-surface px-3.5 py-1.5 text-xs font-medium text-ink-secondary hover:border-line-strong hover:bg-subtle hover:text-ink"
          >
            <IconRefresh className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            <span>Muat Ulang</span>
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <form
        onSubmit={handleFilterSubmit}
        className="animate-enter stagger-1 rounded-xl border border-line bg-surface p-4 shadow-xs space-y-3 text-xs"
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <div>
            <label htmlFor="audit-user" className="block font-semibold text-ink-secondary mb-1">
              Pengguna
            </label>
            <select
              id="audit-user"
              value={userId}
              onChange={(e) => {
                setUserId(e.target.value);
                setPage(1);
              }}
              className="min-h-[38px] w-full rounded-lg border border-line bg-canvas p-1.5 text-xs text-ink focus:border-accent focus:outline-none"
            >
              <option value="">Semua Pengguna</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} (@{u.username})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="audit-entity" className="block font-semibold text-ink-secondary mb-1">
              Entitas / Objek
            </label>
            <select
              id="audit-entity"
              value={entityType}
              onChange={(e) => {
                setEntityType(e.target.value);
                setPage(1);
              }}
              className="min-h-[38px] w-full rounded-lg border border-line bg-canvas p-1.5 text-xs text-ink focus:border-accent focus:outline-none"
            >
              <option value="">Semua Entitas</option>
              {ENTITY_OPTIONS.map((ent) => (
                <option key={ent} value={ent}>
                  {ent}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="audit-action" className="block font-semibold text-ink-secondary mb-1">
              Jenis Aksi
            </label>
            <select
              id="audit-action"
              value={action}
              onChange={(e) => {
                setAction(e.target.value);
                setPage(1);
              }}
              className="min-h-[38px] w-full rounded-lg border border-line bg-canvas p-1.5 text-xs text-ink focus:border-accent focus:outline-none"
            >
              <option value="">Semua Aksi</option>
              {ACTION_OPTIONS.map((act) => (
                <option key={act} value={act}>
                  {act}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="audit-start" className="block font-semibold text-ink-secondary mb-1">
              Dari Tanggal
            </label>
            <input
              id="audit-start"
              type="date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                setPage(1);
              }}
              className="min-h-[38px] w-full rounded-lg border border-line bg-canvas p-1.5 text-xs text-ink focus:border-accent focus:outline-none"
            />
          </div>

          <div>
            <label htmlFor="audit-end" className="block font-semibold text-ink-secondary mb-1">
              Sampai Tanggal
            </label>
            <input
              id="audit-end"
              type="date"
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value);
                setPage(1);
              }}
              className="min-h-[38px] w-full rounded-lg border border-line bg-canvas p-1.5 text-xs text-ink focus:border-accent focus:outline-none"
            />
          </div>

          <div>
            <label htmlFor="audit-q" className="block font-semibold text-ink-secondary mb-1">
              Pencarian IP / Teks
            </label>
            <input
              id="audit-q"
              type="text"
              placeholder="Cari IP atau nama..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="min-h-[38px] w-full rounded-lg border border-line bg-canvas p-1.5 px-2.5 text-xs text-ink placeholder-ink-muted focus:border-accent focus:outline-none"
            />
          </div>
        </div>

        <div className="flex flex-wrap justify-between items-center gap-2 pt-2.5 border-t border-line">
          <span className="text-ink-muted text-[11px] tabular-nums-data">
            Menampilkan {logs.length} dari {totalItems} total log
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleResetFilters}
              className="min-h-[36px] rounded-lg border border-line bg-surface px-3 py-1 text-ink-secondary hover:bg-subtle hover:text-ink"
            >
              Reset Filter
            </button>
            <button
              type="submit"
              className="min-h-[36px] rounded-lg bg-accent px-3.5 py-1 font-semibold text-accent-fg hover:bg-accent-hover"
            >
              Terapkan Filter
            </button>
          </div>
        </div>
      </form>

      {errorMsg && (
        <div className="rounded-xl border border-rose-200 dark:border-rose-900/60 bg-rose-50 dark:bg-rose-950/60 p-4 text-xs text-rose-800 dark:text-rose-200">
          {errorMsg}
        </div>
      )}

      {/* Audit Table */}
      <div className="animate-enter stagger-2 rounded-xl border border-line bg-surface shadow-xs overflow-hidden text-xs">
        {loading ? (
          <div className="p-8 text-center text-ink-secondary">Memuat catatan audit log...</div>
        ) : logs.length === 0 ? (
          <div className="p-8 text-center text-ink-secondary">
            Tidak ada catatan audit log yang sesuai dengan filter pencarian.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left divide-y divide-line">
              <thead className="bg-subtle text-[11px] font-semibold text-ink-secondary uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">Waktu</th>
                  <th className="py-3 px-4">Aktor / Pengguna</th>
                  <th className="py-3 px-4">Aksi</th>
                  <th className="py-3 px-4">Entitas & ID</th>
                  <th className="py-3 px-4">IP Address</th>
                  <th className="py-3 px-4 text-right">Detail</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {logs.map((log) => {
                  const entityLink = resolveAuditEntityLink(log);
                  const entityLabel = extractEntityLabel(log);
                  return (
                    <tr key={log.id} className="transition-colors duration-100 hover:bg-subtle/60">
                      <td className="py-3 px-4 font-mono text-[11px] text-ink-secondary whitespace-nowrap tabular-nums-data">
                        {new Date(log.createdAt).toLocaleString('id-ID')}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-semibold text-ink">
                          {log.user ? log.user.name : 'System'}
                        </div>
                        <div className="text-[10px] text-ink-muted font-mono">
                          {log.user ? `@${log.user.username}` : '-'}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`inline-block rounded border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                            ACTION_COLORS[log.action] || 'bg-subtle text-ink-secondary border-line'
                          }`}
                        >
                          {log.action}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-medium text-ink">
                        <div className="flex flex-wrap items-center gap-1.5">
                          {entityLink ? (
                            <Link
                              href={entityLink.href}
                              title={entityLink.label}
                              className="inline-flex items-center gap-1 rounded px-1 -mx-1 font-semibold text-accent-ink hover:underline"
                            >
                              <span>{log.entityType}</span>
                              {log.entityId && (
                                <span className="font-mono text-[11px]">#{log.entityId}</span>
                              )}
                              <IconExternalLink className="h-3 w-3 shrink-0" />
                            </Link>
                          ) : (
                            <>
                              <span>{log.entityType}</span>
                              {log.entityId && (
                                <span className="font-mono text-ink-muted text-[11px]">
                                  #{log.entityId}
                                </span>
                              )}
                            </>
                          )}
                        </div>
                        {entityLabel && (
                          <div className="mt-0.5 truncate max-w-[220px] font-mono text-[10px] text-ink-muted">
                            {entityLabel}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4 font-mono text-[11px] text-ink-secondary">
                        {log.ipAddress || '-'}
                      </td>
                      <td className="py-3 px-4 text-right">
                        {log.beforeData || log.afterData ? (
                          <button
                            type="button"
                            onClick={() => setSelectedLog(log)}
                            className="rounded-md border border-accent/30 bg-accent-soft px-2.5 py-1 text-[11px] font-semibold text-accent-ink hover:opacity-90"
                          >
                            Lihat Diff
                          </button>
                        ) : (
                          <span className="text-[11px] text-ink-muted">-</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line px-4 py-3 bg-subtle/50 text-xs text-ink-secondary">
            <div className="tabular-nums-data">
              Halaman <strong className="text-ink">{page}</strong> dari{' '}
              <strong className="text-ink">{totalPages}</strong>
            </div>
            <div className="flex gap-1.5">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="inline-flex min-h-[36px] items-center gap-1 rounded-md border border-line bg-surface px-3 py-1 text-ink hover:bg-subtle disabled:opacity-40"
              >
                <IconArrowLeft className="h-3.5 w-3.5" />
                <span>Sebelumnya</span>
              </button>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="inline-flex min-h-[36px] items-center gap-1 rounded-md border border-line bg-surface px-3 py-1 text-ink hover:bg-subtle disabled:opacity-40"
              >
                <span>Berikutnya</span>
                <IconArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Diff Modal */}
      {selectedLog && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="audit-diff-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 animate-backdrop"
        >
          <div className="w-full max-w-2xl rounded-xl border border-line bg-elevated p-5 shadow-2xl space-y-4 text-xs animate-modal">
            <div className="flex items-center justify-between border-b border-line pb-3">
              <div>
                <h3 id="audit-diff-title" className="text-sm font-bold text-ink">
                  Detail Perubahan: {selectedLog.entityType} #{selectedLog.entityId || ''}
                </h3>
                <p className="text-[11px] text-ink-secondary mt-0.5">
                  Aksi: <strong className="text-ink">{selectedLog.action}</strong> | Oleh:{' '}
                  {selectedLog.user ? selectedLog.user.name : 'System'} |{' '}
                  {new Date(selectedLog.createdAt).toLocaleString('id-ID')}
                </p>
              </div>
              <button
                type="button"
                aria-label="Tutup detail perubahan"
                onClick={() => setSelectedLog(null)}
                className="flex h-9 w-9 items-center justify-center rounded-md text-ink-muted hover:bg-subtle hover:text-ink"
              >
                <IconClose className="h-4 w-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-96 overflow-y-auto">
              <div className="space-y-1.5">
                <span className="font-semibold text-ink-secondary block">
                  Data Sebelum (Before):
                </span>
                <pre className="rounded-lg bg-canvas p-3 font-mono text-[11px] text-ink overflow-x-auto whitespace-pre-wrap border border-line">
                  {selectedLog.beforeData
                    ? JSON.stringify(selectedLog.beforeData, null, 2)
                    : '(Kosong / Data Baru)'}
                </pre>
              </div>

              <div className="space-y-1.5">
                <span className="font-semibold text-ink-secondary block">
                  Data Sesudah (After):
                </span>
                <pre className="rounded-lg bg-canvas p-3 font-mono text-[11px] text-ink overflow-x-auto whitespace-pre-wrap border border-line">
                  {selectedLog.afterData
                    ? JSON.stringify(selectedLog.afterData, null, 2)
                    : '(Kosong / Dihapus)'}
                </pre>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2 pt-2 border-t border-line">
              {(() => {
                const modalLink = resolveAuditEntityLink(selectedLog);
                return modalLink ? (
                  <Link
                    href={modalLink.href}
                    className="inline-flex min-h-[38px] items-center gap-1.5 rounded-lg border border-accent/40 bg-accent-soft px-3.5 py-1.5 text-xs font-semibold text-accent-ink hover:opacity-90"
                  >
                    <span>{modalLink.label}</span>
                    <IconExternalLink className="h-3.5 w-3.5" />
                  </Link>
                ) : null;
              })()}
              <button
                type="button"
                onClick={() => setSelectedLog(null)}
                className="min-h-[38px] rounded-lg border border-line bg-surface px-4 py-1.5 text-xs font-medium text-ink hover:bg-subtle"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
