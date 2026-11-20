'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';

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

export function DeviceListClient({ categories, vendors, sites, canArchive, canExport = false }: Props) {
  const [devices, setDevices] = useState<DeviceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Filter & Search states
  const [q, setQ] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [vendorId, setVendorId] = useState('');
  const [siteId, setSiteId] = useState('');
  const [inventoryStatus, setInventoryStatus] = useState('');
  const [isArchived, setIsArchived] = useState(false);

  // Pagination states
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);

  // Archive modal states
  const [archiveTarget, setArchiveTarget] = useState<DeviceItem | null>(null);
  const [archiveReason, setArchiveReason] = useState('');
  const [archiveLoading, setArchiveLoading] = useState(false);

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
      alert(err.message);
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
      alert(err.message);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'ACTIVE':
        return 'bg-emerald-100 text-emerald-800';
      case 'PLANNED':
        return 'bg-blue-100 text-blue-800';
      case 'MAINTENANCE':
        return 'bg-amber-100 text-amber-800';
      case 'RETIRED':
        return 'bg-slate-200 text-slate-800';
      case 'LOST':
        return 'bg-rose-100 text-rose-800';
      default:
        return 'bg-slate-100 text-slate-700';
    }
  };

  return (
    <div className="space-y-4">
      {/* Active vs Archived Tabs */}
      <div className="flex border-b border-slate-200">
        <button
          onClick={() => {
            setIsArchived(false);
            setPage(1);
          }}
          className={`border-b-2 px-4 py-2 text-sm font-medium transition ${
            !isArchived ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          Perangkat Aktif
        </button>
        <button
          onClick={() => {
            setIsArchived(true);
            setPage(1);
          }}
          className={`border-b-2 px-4 py-2 text-sm font-medium transition ${
            isArchived ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          Perangkat Diarsipkan
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm space-y-3">
        <form onSubmit={handleSearchSubmit} className="flex flex-col gap-2 sm:flex-row">
          <input
            type="text"
            placeholder="Cari hostname, device code, serial number, atau model..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="flex-1 rounded border border-slate-300 px-3 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
          />
          <button
            type="submit"
            className="rounded bg-slate-800 px-4 py-1.5 text-xs font-medium text-white hover:bg-slate-700"
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
              className="rounded border border-slate-300 px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50"
            >
              Reset
            </button>
          )}
        </form>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 text-xs">
          <div>
            <label className="block text-slate-500 mb-1">Kategori</label>
            <select
              value={categoryId}
              onChange={(e) => {
                setCategoryId(e.target.value);
                setPage(1);
              }}
              className="w-full rounded border border-slate-300 px-2 py-1 focus:border-indigo-500"
            >
              <option value="">Semua Kategori</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-slate-500 mb-1">Vendor</label>
            <select
              value={vendorId}
              onChange={(e) => {
                setVendorId(e.target.value);
                setPage(1);
              }}
              className="w-full rounded border border-slate-300 px-2 py-1 focus:border-indigo-500"
            >
              <option value="">Semua Vendor</option>
              {vendors.map((v) => (
                <option key={v.id} value={v.id}>{v.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-slate-500 mb-1">Site / Lokasi</label>
            <select
              value={siteId}
              onChange={(e) => {
                setSiteId(e.target.value);
                setPage(1);
              }}
              className="w-full rounded border border-slate-300 px-2 py-1 focus:border-indigo-500"
            >
              <option value="">Semua Lokasi</option>
              {sites.map((s) => (
                <option key={s.id} value={s.id}>{s.siteCode} - {s.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-slate-500 mb-1">Status Inventaris</label>
            <select
              value={inventoryStatus}
              onChange={(e) => {
                setInventoryStatus(e.target.value);
                setPage(1);
              }}
              className="w-full rounded border border-slate-300 px-2 py-1 focus:border-indigo-500"
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
          <div className="flex justify-end pt-2 border-t border-slate-100">
            <a
              href={`/api/export/devices?isArchived=${isArchived}${q ? `&q=${encodeURIComponent(q)}` : ''}${categoryId ? `&categoryId=${categoryId}` : ''}${vendorId ? `&vendorId=${vendorId}` : ''}${siteId ? `&siteId=${siteId}` : ''}${inventoryStatus ? `&inventoryStatus=${inventoryStatus}` : ''}`}
              className="inline-flex items-center rounded border border-slate-300 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition shadow-sm"
            >
              📥 Ekspor Hasil Filter Ini ke CSV
            </a>
          </div>
        )}
      </div>

      {errorMsg && (
        <div className="rounded-md border border-rose-200 bg-rose-50 p-4 text-xs text-rose-800">
          {errorMsg}
        </div>
      )}

      {/* Table */}
      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
          <thead className="bg-slate-50 text-slate-600 font-semibold">
            <tr>
              <th className="px-4 py-3">Device Code</th>
              <th className="px-4 py-3">Hostname</th>
              <th className="px-4 py-3">Management IP</th>
              <th className="px-4 py-3">Kategori</th>
              <th className="px-4 py-3">Vendor / Model</th>
              <th className="px-4 py-3">Site & Posisi</th>
              <th className="px-4 py-3">Role</th>
              <th className="px-4 py-3">Status</th>
              {isArchived && <th className="px-4 py-3">Alasan Arsip</th>}
              <th className="px-4 py-3 text-right">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 text-slate-800">
            {loading ? (
              <tr>
                <td colSpan={isArchived ? 10 : 9} className="px-4 py-8 text-center text-slate-400">
                  Memuat data perangkat...
                </td>
              </tr>
            ) : devices.length === 0 ? (
              <tr>
                <td colSpan={isArchived ? 10 : 9} className="px-4 py-8 text-center text-slate-400">
                  {isArchived ? 'Tidak ada perangkat yang diarsipkan.' : 'Belum ada perangkat terdaftar.'}
                </td>
              </tr>
            ) : (
              devices.map((d) => (
                <tr key={d.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-mono font-medium text-indigo-700">
                    <Link href={`/devices/${d.id}`} className="hover:underline">
                      {d.deviceCode}
                    </Link>
                  </td>
                  <td className="px-4 py-3 font-semibold text-slate-900">
                    <Link href={`/devices/${d.id}`} className="hover:underline">
                      {d.hostname}
                    </Link>
                    {d.serialNumber && (
                      <span className="block text-[11px] text-slate-400 font-normal">
                        SN: {d.serialNumber}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-indigo-700">
                    {d.managementIp ? (
                      <span className="bg-indigo-50 rounded px-1.5 py-0.5">{d.managementIp}</span>
                    ) : (
                      <span className="text-slate-300 italic">-</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{d.category.name}</td>
                  <td className="px-4 py-3 text-slate-700">
                    <span className="font-medium">{d.vendor.name}</span>
                    {d.model && <span className="block text-[11px] text-slate-500">{d.model.modelName}</span>}
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    <span className="font-medium">{d.site.siteCode}</span>
                    <span className="block text-[11px] text-slate-500">
                      {d.room?.name || '-'}{d.rack ? ` / ${d.rack.name}` : ''}
                    </span>
                  </td>
                  <td className="px-4 py-3 uppercase text-slate-500 font-mono text-[11px]">
                    {d.networkRole || '-'}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${getStatusBadge(d.inventoryStatus)}`}>
                      {d.inventoryStatus}
                    </span>
                  </td>
                  {isArchived && (
                    <td className="px-4 py-3 text-slate-600 italic text-[11px]">
                      {d.archiveReason || '-'}
                    </td>
                  )}
                  <td className="px-4 py-3 text-right space-x-2">
                    <Link
                      href={`/devices/${d.id}`}
                      className="text-indigo-600 hover:text-indigo-800 font-medium"
                    >
                      Detail
                    </Link>
                    <Link
                      href={`/devices/${d.id}/edit`}
                      className="text-slate-600 hover:text-slate-800 font-medium"
                    >
                      Edit
                    </Link>
                    {canArchive && (
                      isArchived ? (
                        <button
                          onClick={() => handleRestore(d)}
                          className="text-emerald-600 hover:text-emerald-800 font-medium"
                        >
                          Pulihkan
                        </button>
                      ) : (
                        <button
                          onClick={() => {
                            setArchiveTarget(d);
                            setArchiveReason('');
                          }}
                          className="text-rose-600 hover:text-rose-800 font-medium"
                        >
                          Arsip
                        </button>
                      )
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {/* Pagination bar */}
        {!loading && totalItems > 0 && (
          <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-600">
            <div>
              Menampilkan <span className="font-medium">{(page - 1) * limit + 1}</span> -{' '}
              <span className="font-medium">{Math.min(page * limit, totalItems)}</span> dari{' '}
              <span className="font-medium">{totalItems}</span> perangkat
            </div>
            <div className="flex space-x-1">
              <button
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
                className="rounded border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-40"
              >
                Sebelumnya
              </button>
              <span className="px-2 py-1 text-slate-700">
                Halaman {page} dari {totalPages}
              </span>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage(page + 1)}
                className="rounded border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-40"
              >
                Berikutnya
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Archive Reason Modal */}
      {archiveTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-md rounded-lg bg-white p-5 shadow-xl space-y-4">
            <h3 className="text-sm font-bold text-slate-900">
              Konfirmasi Arsip Perangkat: {archiveTarget.hostname} ({archiveTarget.deviceCode})
            </h3>
            <p className="text-xs text-slate-600">
              Perangkat yang diarsipkan tidak akan muncul pada daftar aktif default, namun seluruh data histori dan relasi tetap tersimpan aman.
            </p>
            {archiveTarget.inventoryStatus === 'ACTIVE' && (
              <div className="rounded border border-amber-200 bg-amber-50 p-2.5 text-xs text-amber-800">
                ⚠️ <strong>Peringatan:</strong> Status perangkat ini saat ini adalah <strong>ACTIVE</strong>. Pastikan perangkat memang sudah tidak aktif di lapangan sebelum diarsipkan.
              </div>
            )}
            <form onSubmit={handleArchiveConfirm} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-700">
                  Alasan Pengarsipan *
                </label>
                <textarea
                  required
                  rows={3}
                  placeholder="Misal: Perangkat diganti dengan unit baru, atau site ditutup."
                  value={archiveReason}
                  onChange={(e) => setArchiveReason(e.target.value)}
                  className="mt-1 block w-full rounded border border-slate-300 p-2 text-xs focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                />
              </div>
              <div className="flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setArchiveTarget(null)}
                  className="rounded border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={archiveLoading}
                  className="rounded bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-rose-500 disabled:opacity-50"
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
