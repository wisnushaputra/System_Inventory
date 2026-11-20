'use client';

import { useState, useCallback, useEffect } from 'react';

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
  CREATE: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  UPDATE: 'bg-blue-50 text-blue-700 border-blue-200',
  DELETE: 'bg-rose-50 text-rose-700 border-rose-200',
  ARCHIVE: 'bg-amber-50 text-amber-700 border-amber-200',
  RESTORE: 'bg-teal-50 text-teal-700 border-teal-200',
  UPLOAD_DOCUMENT: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  DOWNLOAD_DOCUMENT: 'bg-cyan-50 text-cyan-700 border-cyan-200',
  EXPORT: 'bg-purple-50 text-purple-700 border-purple-200',
  LOGIN: 'bg-slate-100 text-slate-700 border-slate-200',
  LOGOUT: 'bg-slate-100 text-slate-500 border-slate-200',
  ACCESS_DENIED: 'bg-rose-100 text-rose-800 border-rose-300 font-bold',
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

export function AuditLogClient({ users, canExport }: Props) {
  const [logs, setLogs] = useState<AuditItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Filter states
  const [userId, setUserId] = useState('');
  const [entityType, setEntityType] = useState('');
  const [action, setAction] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [q, setQ] = useState('');

  // Pagination states
  const [page, setPage] = useState(1);
  const [limit] = useState(25);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);

  // Detail Modal state
  const [selectedLog, setSelectedLog] = useState<AuditItem | null>(null);

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
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Riwayat Perubahan & Audit Trail
          </h1>
          <p className="text-sm text-slate-500">
            Pencatatan aktivitas mutasi data secara permanen, terperinci, dan read-only (FR-AUD-005).
          </p>
        </div>
        <div className="flex items-center space-x-2">
          {canExport && (
            <a
              href={exportUrl}
              className="inline-flex items-center rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
            >
              📥 Ekspor Audit CSV
            </a>
          )}
          <button
            onClick={fetchLogs}
            className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
          >
            ↻ Refresh
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <form
        onSubmit={handleFilterSubmit}
        className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm space-y-3 text-xs"
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {/* Filter Pengguna */}
          <div>
            <label className="block font-medium text-slate-600 mb-1">Pengguna</label>
            <select
              value={userId}
              onChange={(e) => {
                setUserId(e.target.value);
                setPage(1);
              }}
              className="w-full rounded border border-slate-300 p-1.5 text-xs focus:border-indigo-500"
            >
              <option value="">Semua Pengguna</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} (@{u.username})
                </option>
              ))}
            </select>
          </div>

          {/* Filter Tipe Entitas */}
          <div>
            <label className="block font-medium text-slate-600 mb-1">Entitas / Objek</label>
            <select
              value={entityType}
              onChange={(e) => {
                setEntityType(e.target.value);
                setPage(1);
              }}
              className="w-full rounded border border-slate-300 p-1.5 text-xs focus:border-indigo-500"
            >
              <option value="">Semua Entitas</option>
              {ENTITY_OPTIONS.map((ent) => (
                <option key={ent} value={ent}>
                  {ent}
                </option>
              ))}
            </select>
          </div>

          {/* Filter Aksi */}
          <div>
            <label className="block font-medium text-slate-600 mb-1">Jenis Aksi</label>
            <select
              value={action}
              onChange={(e) => {
                setAction(e.target.value);
                setPage(1);
              }}
              className="w-full rounded border border-slate-300 p-1.5 text-xs focus:border-indigo-500"
            >
              <option value="">Semua Aksi</option>
              {ACTION_OPTIONS.map((act) => (
                <option key={act} value={act}>
                  {act}
                </option>
              ))}
            </select>
          </div>

          {/* Dari Tanggal */}
          <div>
            <label className="block font-medium text-slate-600 mb-1">Dari Tanggal</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                setPage(1);
              }}
              className="w-full rounded border border-slate-300 p-1.5 text-xs focus:border-indigo-500"
            />
          </div>

          {/* Sampai Tanggal */}
          <div>
            <label className="block font-medium text-slate-600 mb-1">Sampai Tanggal</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value);
                setPage(1);
              }}
              className="w-full rounded border border-slate-300 p-1.5 text-xs focus:border-indigo-500"
            />
          </div>

          {/* Kata Kunci Pencarian */}
          <div>
            <label className="block font-medium text-slate-600 mb-1">Pencarian IP / Teks</label>
            <input
              type="text"
              placeholder="Cari IP atau nama..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="w-full rounded border border-slate-300 p-1.5 text-xs focus:border-indigo-500"
            />
          </div>
        </div>

        <div className="flex justify-between items-center pt-2 border-t border-slate-100">
          <span className="text-slate-500 text-[11px]">
            Menampilkan {logs.length} dari {totalItems} total log
          </span>
          <div className="flex space-x-2">
            <button
              type="button"
              onClick={handleResetFilters}
              className="rounded border border-slate-300 px-3 py-1 text-slate-600 hover:bg-slate-50"
            >
              Reset Filter
            </button>
            <button
              type="submit"
              className="rounded bg-indigo-600 px-3 py-1 font-semibold text-white hover:bg-indigo-500"
            >
              Terapkan Filter
            </button>
          </div>
        </div>
      </form>

      {/* Error message */}
      {errorMsg && (
        <div className="rounded-md border border-rose-200 bg-rose-50 p-4 text-xs text-rose-800">
          {errorMsg}
        </div>
      )}

      {/* Audit Log Table */}
      <div className="rounded-lg border border-slate-200 bg-white shadow-sm overflow-hidden text-xs">
        {loading ? (
          <div className="p-8 text-center text-slate-400">Memuat catatan audit log...</div>
        ) : logs.length === 0 ? (
          <div className="p-8 text-center text-slate-500">
            Tidak ada catatan audit log yang sesuai dengan filter pencarian.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left divide-y divide-slate-200">
              <thead className="bg-slate-50 text-[11px] font-semibold text-slate-600 uppercase tracking-wider">
                <tr>
                  <th className="py-2.5 px-3">Waktu</th>
                  <th className="py-2.5 px-3">Aktor / Pengguna</th>
                  <th className="py-2.5 px-3">Aksi</th>
                  <th className="py-2.5 px-3">Entitas & ID</th>
                  <th className="py-2.5 px-3">IP Address</th>
                  <th className="py-2.5 px-3 text-right">Detail</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/70">
                    <td className="py-2.5 px-3 font-mono text-[11px] text-slate-500 whitespace-nowrap">
                      {new Date(log.createdAt).toLocaleString('id-ID')}
                    </td>
                    <td className="py-2.5 px-3">
                      <div className="font-medium text-slate-900">
                        {log.user ? log.user.name : 'System'}
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono">
                        {log.user ? `@${log.user.username}` : '-'}
                      </div>
                    </td>
                    <td className="py-2.5 px-3">
                      <span
                        className={`inline-block rounded border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                          ACTION_COLORS[log.action] || 'bg-slate-100 text-slate-700 border-slate-200'
                        }`}
                      >
                        {log.action}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 font-medium text-slate-800">
                      <span>{log.entityType}</span>
                      {log.entityId && (
                        <span className="font-mono text-slate-400 text-[11px] ml-1">
                          #{log.entityId}
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-[11px] text-slate-500">
                      {log.ipAddress || '-'}
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      {(log.beforeData || log.afterData) ? (
                        <button
                          type="button"
                          onClick={() => setSelectedLog(log)}
                          className="rounded border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-[11px] font-semibold text-indigo-700 hover:bg-indigo-100"
                        >
                          Lihat Diff
                        </button>
                      ) : (
                        <span className="text-[11px] text-slate-400">-</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination footer */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3 bg-slate-50 text-xs text-slate-600">
            <div>
              Halaman <strong>{page}</strong> dari <strong>{totalPages}</strong>
            </div>
            <div className="flex space-x-1.5">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="rounded border border-slate-300 bg-white px-2.5 py-1 text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                &larr; Sebelumnya
              </button>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="rounded border border-slate-300 bg-white px-2.5 py-1 text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                Berikutnya &rarr;
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Diff Modal */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-2xl rounded-lg bg-white p-5 shadow-xl space-y-4 text-xs">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Detail Perubahan: {selectedLog.entityType} #{selectedLog.entityId || ''}
                </h3>
                <p className="text-[11px] text-slate-500">
                  Aksi: <strong>{selectedLog.action}</strong> &bull; Oleh:{' '}
                  {selectedLog.user ? selectedLog.user.name : 'System'} &bull;{' '}
                  {new Date(selectedLog.createdAt).toLocaleString('id-ID')}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedLog(null)}
                className="text-slate-400 hover:text-slate-600 text-lg leading-none"
              >
                &times;
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-96 overflow-y-auto">
              <div className="space-y-1.5">
                <span className="font-semibold text-slate-700 block">
                  Data Sebelum (Before):
                </span>
                <pre className="rounded bg-slate-100 p-3 font-mono text-[11px] text-slate-800 overflow-x-auto whitespace-pre-wrap border border-slate-200">
                  {selectedLog.beforeData
                    ? JSON.stringify(selectedLog.beforeData, null, 2)
                    : '(Kosong / Data Baru)'}
                </pre>
              </div>

              <div className="space-y-1.5">
                <span className="font-semibold text-slate-700 block">
                  Data Sesudah (After):
                </span>
                <pre className="rounded bg-slate-100 p-3 font-mono text-[11px] text-slate-800 overflow-x-auto whitespace-pre-wrap border border-slate-200">
                  {selectedLog.afterData
                    ? JSON.stringify(selectedLog.afterData, null, 2)
                    : '(Kosong / Dihapus)'}
                </pre>
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t">
              <button
                type="button"
                onClick={() => setSelectedLog(null)}
                className="rounded border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
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
