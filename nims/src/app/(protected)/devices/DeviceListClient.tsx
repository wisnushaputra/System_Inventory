'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { IconDownload, IconAlertTriangle } from '@/components/Icons';

interface DeviceItem {
  id: number;
  deviceCode: string;
  hostname: string;
  serialNumber: string | null;
  networkRole: string | null;
  managementIp?: string | null;
  inventoryStatus: string;
  archivedAt: string | null;
  archiveReason: string | null;
  updatedAt: string;
  category: { id: number; name: string };
  vendor: { id: number; name: string };
  model: { id: number; modelName: string; modelCode: string } | null;
  site: { id: number; name: string; siteCode: string };
  room: { id: number; name: string } | null;
  rack: { id: number; name: string } | null;
}

interface Props {
  categories: { id: number; name: string }[];
  vendors: { id: number; name: string }[];
  sites: { id: number; name: string; siteCode: string }[];
  canCreate: boolean;
  canArchive: boolean;
  canExport?: boolean;
}

export function DeviceListClient({
  categories,
  vendors,
  sites,
  canArchive,
  canExport = false,
}: Props) {
  const [devices, setDevices] = useState<DeviceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [q, setQ] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [vendorId, setVendorId] = useState('');
  const [siteId, setSiteId] = useState('');
  const [inventoryStatus, setInventoryStatus] = useState('');
  const [isArchived, setIsArchived] = useState(false);

  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);

  const [archiveTarget, setArchiveTarget] = useState<DeviceItem | null>(null);
  const [archiveReason, setArchiveReason] = useState('');
  const [archiveLoading, setArchiveLoading] = useState(false);

  useEffect(() => {
    if (!archiveTarget) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setArchiveTarget(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [archiveTarget]);

  const fetchDevices = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
        isArchived: isArchived.toString(),
      });
      if (q) params.set('q', q);
      if (categoryId) params.set('categoryId', categoryId);
      if (vendorId) params.set('vendorId', vendorId);
      if (siteId) params.set('siteId', siteId);
      if (inventoryStatus) params.set('inventoryStatus', inventoryStatus);

      const res = await fetch(`/api/devices?${params.toString()}`);
      if (!res.ok) throw new Error('Gagal memuat data perangkat');
      const json = await res.json();
      setDevices(json.data);
      setTotalPages(json.pagination.totalPages || 1);
      setTotalItems(json.pagination.total || 0);
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  }, [page, limit, isArchived, q, categoryId, vendorId, siteId, inventoryStatus]);

  useEffect(() => {
    fetchDevices();
  }, [fetchDevices]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchDevices();
  };

  const handleArchiveConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!archiveTarget || !archiveReason.trim()) return;
    setArchiveLoading(true);
    try {
      const res = await fetch(`/api/devices/${archiveTarget.id}/archive`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: archiveReason.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Gagal mengarsipkan perangkat');
      setArchiveTarget(null);
      setArchiveReason('');
      fetchDevices();
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setArchiveLoading(false);
    }
  };

  const handleRestore = async (device: DeviceItem) => {
    if (!confirm(`Pulihkan perangkat '${device.hostname}' dari arsip?`)) return;
    try {
      const res = await fetch(`/api/devices/${device.id}/restore`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Gagal memulihkan perangkat');
      fetchDevices();
    } catch (err: any) {
      setErrorMsg(err.message);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'ACTIVE':
        return 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950/70 dark:text-emerald-300';
      case 'PLANNED':
        return 'bg-sky-100 text-sky-900 dark:bg-sky-950/70 dark:text-sky-300';
      case 'MAINTENANCE':
        return 'bg-amber-100 text-amber-900 dark:bg-amber-950/70 dark:text-amber-300';
      case 'RETIRED':
        return 'bg-subtle text-ink-secondary';
      case 'LOST':
        return 'bg-rose-100 text-rose-900 dark:bg-rose-950/70 dark:text-rose-300';
      default:
        return 'bg-subtle text-ink-secondary';
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex border-b border-line">
        <button
          type="button"
          onClick={() => {
            setIsArchived(false);
            setPage(1);
          }}
          className={`min-h-[40px] border-b-2 px-4 py-2 text-xs sm:text-sm font-semibold transition-colors duration-150 ${
            !isArchived
              ? 'border-accent text-accent-ink'
              : 'border-transparent text-ink-secondary hover:text-ink'
          }`}
        >
          Perangkat Aktif
        </button>
        <button
          type="button"
          onClick={() => {
            setIsArchived(true);
            setPage(1);
          }}
          className={`min-h-[40px] border-b-2 px-4 py-2 text-xs sm:text-sm font-semibold transition-colors duration-150 ${
            isArchived
              ? 'border-accent text-accent-ink'
              : 'border-transparent text-ink-secondary hover:text-ink'
          }`}
        >
          Perangkat Diarsipkan
        </button>
      </div>

      <div className="rounded-xl border border-line bg-surface p-4 shadow-xs space-y-3">
        <form onSubmit={handleSearchSubmit} className="flex flex-col gap-2 sm:flex-row">
          <label htmlFor="global-device-search" className="sr-only">
            Cari perangkat
          </label>
          <input
            id="global-device-search"
            type="text"
            placeholder="Cari hostname, kode perangkat, nomor seri, atau model..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="min-h-[40px] flex-1 rounded-lg border border-line bg-canvas px-3 py-1.5 text-xs text-ink placeholder-ink-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
          />
          <div className="flex gap-2">
            <button
              type="submit"
              className="min-h-[40px] rounded-lg bg-accent px-4 py-1.5 text-xs font-semibold text-accent-fg hover:bg-accent-hover"
            >
              Cari
            </button>
            {q && (
              <button
                type="button"
                onClick={() => {
                  setQ('');
                  setPage(1);
                }}
                className="min-h-[40px] rounded-lg border border-line bg-surface px-3 py-1.5 text-xs font-medium text-ink-secondary hover:bg-subtle hover:text-ink"
              >
                Reset
              </button>
            )}
          </div>
        </form>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 text-xs">
          <div>
            <label htmlFor="global-cat" className="block font-semibold text-ink-secondary mb-1">
              Kategori
            </label>
            <select
              id="global-cat"
              value={categoryId}
              onChange={(e) => {
                setCategoryId(e.target.value);
                setPage(1);
              }}
              className="min-h-[40px] w-full rounded-lg border border-line bg-canvas px-2.5 py-1.5 text-ink focus:border-accent focus:outline-none"
            >
              <option value="">Semua Kategori</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="global-vendor" className="block font-semibold text-ink-secondary mb-1">
              Vendor
            </label>
            <select
              id="global-vendor"
              value={vendorId}
              onChange={(e) => {
                setVendorId(e.target.value);
                setPage(1);
              }}
              className="min-h-[40px] w-full rounded-lg border border-line bg-canvas px-2.5 py-1.5 text-ink focus:border-accent focus:outline-none"
            >
              <option value="">Semua Vendor</option>
              {vendors.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="global-site" className="block font-semibold text-ink-secondary mb-1">
              Site / Lokasi
            </label>
            <select
              id="global-site"
              value={siteId}
              onChange={(e) => {
                setSiteId(e.target.value);
                setPage(1);
              }}
              className="min-h-[40px] w-full rounded-lg border border-line bg-canvas px-2.5 py-1.5 text-ink focus:border-accent focus:outline-none"
            >
              <option value="">Semua Lokasi</option>
              {sites.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.siteCode} - {s.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="global-status" className="block font-semibold text-ink-secondary mb-1">
              Status Inventaris
            </label>
            <select
              id="global-status"
              value={inventoryStatus}
              onChange={(e) => {
                setInventoryStatus(e.target.value);
                setPage(1);
              }}
              className="min-h-[40px] w-full rounded-lg border border-line bg-canvas px-2.5 py-1.5 text-ink focus:border-accent focus:outline-none"
            >
              <option value="">Semua Status</option>
              <option value="ACTIVE">ACTIVE</option>
              <option value="PLANNED">PLANNED</option>
              <option value="MAINTENANCE">MAINTENANCE</option>
              <option value="RETIRED">RETIRED</option>
              <option value="LOST">LOST</option>
            </select>
          </div>
        </div>

        {canExport && (
          <div className="flex justify-end pt-2 border-t border-line">
            <a
              href={`/api/export/devices?isArchived=${isArchived}${
                q ? `&q=${encodeURIComponent(q)}` : ''
              }${categoryId ? `&categoryId=${categoryId}` : ''}${
                vendorId ? `&vendorId=${vendorId}` : ''
              }${siteId ? `&siteId=${siteId}` : ''}${
                inventoryStatus ? `&inventoryStatus=${inventoryStatus}` : ''
              }`}
              className="inline-flex min-h-[38px] items-center gap-2 rounded-lg border border-line bg-canvas px-3.5 py-1.5 text-xs font-semibold text-ink hover:bg-subtle transition-colors duration-150"
            >
              <IconDownload className="h-3.5 w-3.5" />
              <span>Ekspor Hasil Filter Ini ke CSV</span>
            </a>
          </div>
        )}
      </div>

      {errorMsg && (
        <div className="rounded-xl border border-rose-200 dark:border-rose-900/60 bg-rose-50 dark:bg-rose-950/60 p-4 text-xs text-rose-800 dark:text-rose-200">
          {errorMsg}
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-line bg-surface shadow-xs">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-line text-left text-xs">
            <thead className="bg-subtle text-ink-secondary font-semibold uppercase text-[11px]">
              <tr>
                <th className="px-4 py-3">Kode Perangkat</th>
                <th className="px-4 py-3">Hostname</th>
                <th className="px-4 py-3">IP Manajemen</th>
                <th className="px-4 py-3">Kategori</th>
                <th className="px-4 py-3">Vendor / Model</th>
                <th className="px-4 py-3">Site & Posisi</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Status</th>
                {isArchived && <th className="px-4 py-3">Alasan Arsip</th>}
                <th className="px-4 py-3 text-right">Tindakan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line text-ink">
              {loading ? (
                <tr>
                  <td colSpan={isArchived ? 10 : 9} className="px-4 py-8 text-center text-ink-secondary">
                    Memuat data perangkat...
                  </td>
                </tr>
              ) : devices.length === 0 ? (
                <tr>
                  <td colSpan={isArchived ? 10 : 9} className="px-4 py-8 text-center text-ink-secondary">
                    {isArchived
                      ? 'Tidak ada perangkat yang diarsipkan sesuai filter saat ini.'
                      : 'Belum ada perangkat terdaftar atau tidak cocok dengan filter.'}
                  </td>
                </tr>
              ) : (
                devices.map((d) => (
                  <tr key={d.id} className="transition-colors duration-100 hover:bg-subtle/60">
                    <td className="px-4 py-3 font-mono font-semibold text-accent-ink whitespace-nowrap">
                      <Link href={`/devices/${d.id}`} className="hover:underline">
                        {d.deviceCode}
                      </Link>
                    </td>
                    <td className="px-4 py-3 font-semibold text-ink">
                      <Link href={`/devices/${d.id}`} className="hover:underline">
                        {d.hostname}
                      </Link>
                      {d.serialNumber && (
                        <span className="block text-[11px] font-mono text-ink-muted font-normal">
                          SN: {d.serialNumber}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">
                      {d.managementIp ? (
                        <span className="bg-accent-soft text-accent-ink rounded px-2 py-0.5 font-medium">
                          {d.managementIp}
                        </span>
                      ) : (
                        <span className="text-ink-muted italic">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-ink-secondary">{d.category.name}</td>
                    <td className="px-4 py-3 text-ink">
                      <span className="font-medium">{d.vendor.name}</span>
                      {d.model && (
                        <span className="block text-[11px] text-ink-muted">{d.model.modelName}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-ink-secondary">
                      <span className="font-medium text-ink">{d.site.siteCode}</span>
                      <span className="block text-[11px] text-ink-muted">
                        {d.room?.name || '-'}
                        {d.rack ? ` / ${d.rack.name}` : ''}
                      </span>
                    </td>
                    <td className="px-4 py-3 uppercase text-ink-muted font-mono text-[11px]">
                      {d.networkRole || '-'}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-md px-2 py-0.5 text-[10px] font-semibold ${getStatusBadge(
                          d.inventoryStatus
                        )}`}
                      >
                        {d.inventoryStatus}
                      </span>
                    </td>
                    {isArchived && (
                      <td className="px-4 py-3 text-ink-secondary italic text-[11px]">
                        {d.archiveReason || '-'}
                      </td>
                    )}
                    <td className="px-4 py-3 text-right space-x-2 whitespace-nowrap">
                      <Link
                        href={`/devices/${d.id}`}
                        className="text-accent-ink hover:underline font-semibold"
                      >
                        Detail
                      </Link>
                      <Link
                        href={`/devices/${d.id}/edit`}
                        className="text-ink-secondary hover:text-ink font-medium"
                      >
                        Edit
                      </Link>
                      {canArchive &&
                        (isArchived ? (
                          <button
                            type="button"
                            onClick={() => handleRestore(d)}
                            className="text-emerald-700 dark:text-emerald-300 hover:underline font-medium"
                          >
                            Pulihkan
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              setArchiveTarget(d);
                              setArchiveReason('');
                            }}
                            className="text-rose-700 dark:text-rose-300 hover:underline font-medium"
                          >
                            Arsip
                          </button>
                        ))}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {!loading && totalItems > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line bg-subtle/50 px-4 py-3 text-xs text-ink-secondary">
            <div className="tabular-nums-data">
              Menampilkan <span className="font-semibold text-ink">{(page - 1) * limit + 1}</span> -{' '}
              <span className="font-semibold text-ink">{Math.min(page * limit, totalItems)}</span>{' '}
              dari <span className="font-semibold text-ink">{totalItems}</span> perangkat
            </div>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
                className="min-h-[36px] rounded-md border border-line bg-surface px-3 py-1 text-xs font-medium text-ink hover:bg-subtle disabled:opacity-40"
              >
                Sebelumnya
              </button>
              <span className="px-2 text-ink tabular-nums-data">
                Halaman {page} dari {totalPages}
              </span>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage(page + 1)}
                className="min-h-[36px] rounded-md border border-line bg-surface px-3 py-1 text-xs font-medium text-ink hover:bg-subtle disabled:opacity-40"
              >
                Berikutnya
              </button>
            </div>
          </div>
        )}
      </div>

      {archiveTarget && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="global-archive-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 animate-backdrop"
        >
          <div className="w-full max-w-md rounded-xl border border-line bg-elevated p-5 shadow-2xl space-y-4 animate-modal">
            <h3 id="global-archive-title" className="text-sm font-bold text-ink">
              Konfirmasi Arsip Perangkat: {archiveTarget.hostname} ({archiveTarget.deviceCode})
            </h3>
            <p className="text-xs text-ink-secondary">
              Perangkat yang diarsipkan tidak tampil pada daftar aktif default, namun riwayat dan relasi tetap tersimpan aman.
            </p>
            {archiveTarget.inventoryStatus === 'ACTIVE' && (
              <div className="flex items-start gap-2 rounded-lg border border-amber-200 dark:border-amber-900/60 bg-amber-50 dark:bg-amber-950/50 p-3 text-xs text-amber-900 dark:text-amber-200">
                <IconAlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>
                  <strong>Peringatan:</strong> Status perangkat saat ini adalah <strong>ACTIVE</strong>. Pastikan perangkat sudah tidak beroperasi di lapangan.
                </span>
              </div>
            )}
            <form onSubmit={handleArchiveConfirm} className="space-y-3">
              <div>
                <label
                  htmlFor="global-archive-reason"
                  className="block text-xs font-semibold text-ink-secondary"
                >
                  Alasan Pengarsipan *
                </label>
                <textarea
                  id="global-archive-reason"
                  required
                  rows={3}
                  placeholder="Contoh: Unit diganti baru atau kontrak pelanggan berakhir."
                  value={archiveReason}
                  onChange={(e) => setArchiveReason(e.target.value)}
                  className="mt-1.5 block w-full rounded-lg border border-line bg-canvas p-2.5 text-xs text-ink placeholder-ink-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
                />
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setArchiveTarget(null)}
                  className="min-h-[40px] rounded-lg border border-line bg-surface px-3.5 py-1.5 text-xs font-medium text-ink-secondary hover:bg-subtle hover:text-ink"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={archiveLoading}
                  className="min-h-[40px] rounded-lg bg-rose-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-rose-500 disabled:opacity-50"
                >
                  {archiveLoading ? 'Mengarsipkan...' : 'Arsipkan Sekarang'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
