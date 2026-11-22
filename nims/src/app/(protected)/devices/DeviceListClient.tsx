'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { IconDownload, IconAlertTriangle, IconQrCode, IconCopy, IconRefresh } from '@/components/Icons';
import { QrLabelModal, type QrLabelDeviceItem } from '@/components/QrLabelModal';
import { useFeedback } from '@/components/FeedbackProvider';
import type { DeviceListInitialFilters } from './DevicesPageClient';

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
  canUpdate?: boolean;
  canArchive: boolean;
  canExport?: boolean;
  initialFilters?: DeviceListInitialFilters;
}

const INVENTORY_STATUS_OPTIONS = ['ACTIVE', 'PLANNED', 'MAINTENANCE', 'RETIRED', 'LOST'] as const;

function toQrLabelDevice(d: DeviceItem): QrLabelDeviceItem {
  return {
    id: d.id,
    deviceCode: d.deviceCode,
    hostname: d.hostname,
    serialNumber: d.serialNumber,
    managementIp: d.managementIp ?? null,
    inventoryStatus: d.inventoryStatus,
    siteCode: d.site.siteCode,
    siteName: d.site.name,
    roomName: d.room?.name ?? null,
    rackName: d.rack?.name ?? null,
    vendorName: d.vendor.name,
    modelName: d.model?.modelName ?? null,
  };
}

export function DeviceListClient({
  categories,
  vendors,
  sites,
  canCreate,
  canUpdate = false,
  canArchive,
  canExport = false,
  initialFilters,
}: Props) {
  const { toast, confirm: confirmDialog } = useFeedback();
  const [devices, setDevices] = useState<DeviceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [q, setQ] = useState(initialFilters?.q || '');
  const [categoryId, setCategoryId] = useState(initialFilters?.categoryId || '');
  const [vendorId, setVendorId] = useState(initialFilters?.vendorId || '');
  const [siteId, setSiteId] = useState(initialFilters?.siteId || '');
  const [inventoryStatus, setInventoryStatus] = useState(initialFilters?.inventoryStatus || '');
  const [anomaly, setAnomaly] = useState(initialFilters?.anomaly || '');
  const [isArchived, setIsArchived] = useState(Boolean(initialFilters?.isArchived));

  const [page, setPage] = useState(
    initialFilters?.page && initialFilters.page > 0 ? initialFilters.page : 1
  );
  const [limit] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);

  const [archiveTarget, setArchiveTarget] = useState<DeviceItem | null>(null);
  const [archiveReason, setArchiveReason] = useState('');
  const [archiveLoading, setArchiveLoading] = useState(false);

  const [selectedMap, setSelectedMap] = useState<Record<number, DeviceItem>>({});
  const [bulkStatus, setBulkStatus] = useState<string>('ACTIVE');
  const [bulkSiteId, setBulkSiteId] = useState<string>(sites[0]?.id ? String(sites[0].id) : '');
  const [bulkSubmitting, setBulkSubmitting] = useState(false);
  const [bulkArchiveOpen, setBulkArchiveOpen] = useState(false);
  const [bulkArchiveReason, setBulkArchiveReason] = useState('');
  const [qrModalDevices, setQrModalDevices] = useState<QrLabelDeviceItem[] | null>(null);

  useEffect(() => {
    if (!archiveTarget && !bulkArchiveOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setArchiveTarget(null);
        setBulkArchiveOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [archiveTarget, bulkArchiveOpen]);

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
      if (anomaly) params.set('anomaly', anomaly);

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
  }, [page, limit, isArchived, q, categoryId, vendorId, siteId, inventoryStatus, anomaly]);

  useEffect(() => {
    fetchDevices();
  }, [fetchDevices]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams();
    params.set('view', 'global');
    if (q.trim()) params.set('q', q.trim());
    if (categoryId) params.set('categoryId', categoryId);
    if (vendorId) params.set('vendorId', vendorId);
    if (siteId) params.set('siteId', siteId);
    if (inventoryStatus) params.set('inventoryStatus', inventoryStatus);
    if (anomaly) params.set('anomaly', anomaly);
    if (isArchived) params.set('isArchived', 'true');
    if (page > 1) params.set('page', String(page));
    const nextUrl = `${window.location.pathname}?${params.toString()}`;
    window.history.replaceState(null, '', nextUrl);
  }, [q, categoryId, vendorId, siteId, inventoryStatus, anomaly, isArchived, page]);

  const resetAllFilters = () => {
    setQ('');
    setCategoryId('');
    setVendorId('');
    setSiteId('');
    setInventoryStatus('');
    setAnomaly('');
    setIsArchived(false);
    setPage(1);
  };

  const handleCopyFilterUrl = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      toast.success('Tautan filter pencarian berhasil disalin.');
    } catch {
      toast.error('Gagal menyalin tautan ke clipboard.');
    }
  };

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
      toast.success(data.message || `Perangkat '${archiveTarget.hostname}' berhasil diarsipkan.`);
      setArchiveTarget(null);
      setArchiveReason('');
      fetchDevices();
    } catch (err: any) {
      setErrorMsg(err.message);
      toast.error(err.message);
    } finally {
      setArchiveLoading(false);
    }
  };

  const handleRestore = async (device: DeviceItem) => {
    const confirmed = await confirmDialog({
      title: `Pulihkan Perangkat '${device.hostname}'?`,
      message: `Perangkat '${device.hostname}' (${device.deviceCode}) akan dikembalikan ke daftar inventaris aktif.`,
      confirmLabel: 'Pulihkan Perangkat',
      tone: 'primary',
    });
    if (!confirmed) return;
    try {
      const res = await fetch(`/api/devices/${device.id}/restore`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Gagal memulihkan perangkat');
      toast.success(data.message || `Perangkat '${device.hostname}' berhasil dipulihkan.`);
      fetchDevices();
    } catch (err: any) {
      setErrorMsg(err.message);
      toast.error(err.message);
    }
  };

  const selectedList = Object.values(selectedMap);
  const selectedIds = selectedList.map((d) => d.id);
  const allVisibleSelected =
    devices.length > 0 && devices.every((d) => Boolean(selectedMap[d.id]));

  const toggleSelectRow = (device: DeviceItem) => {
    setSelectedMap((prev) => {
      const next = { ...prev };
      if (next[device.id]) {
        delete next[device.id];
      } else {
        next[device.id] = device;
      }
      return next;
    });
  };

  const toggleSelectAllVisible = () => {
    setSelectedMap((prev) => {
      const next = { ...prev };
      if (allVisibleSelected) {
        for (const d of devices) delete next[d.id];
      } else {
        for (const d of devices) next[d.id] = d;
      }
      return next;
    });
  };

  const executeBulkAction = async (payload: Record<string, unknown>) => {
    setBulkSubmitting(true);
    try {
      const res = await fetch('/api/devices/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Gagal menjalankan aksi massal');
      toast.success(data.message || 'Aksi massal berhasil dijalankan.');
      setSelectedMap({});
      setBulkArchiveOpen(false);
      setBulkArchiveReason('');
      fetchDevices();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Gagal menjalankan aksi massal';
      setErrorMsg(msg);
      toast.error(msg);
    } finally {
      setBulkSubmitting(false);
    }
  };

  const handleBulkStatus = async () => {
    if (selectedIds.length === 0) return;
    const confirmed = await confirmDialog({
      title: `Ubah Status ${selectedIds.length} Perangkat?`,
      message: `Seluruh ${selectedIds.length} perangkat terpilih akan diubah status inventarisnya menjadi ${bulkStatus}.`,
      confirmLabel: 'Terapkan Status',
      tone: 'primary',
    });
    if (!confirmed) return;
    await executeBulkAction({
      action: 'UPDATE_STATUS',
      deviceIds: selectedIds,
      inventoryStatus: bulkStatus,
    });
  };

  const handleBulkMoveSite = async () => {
    const targetSiteId = parseInt(bulkSiteId, 10);
    if (selectedIds.length === 0 || isNaN(targetSiteId)) return;
    const targetSite = sites.find((s) => s.id === targetSiteId);
    const confirmed = await confirmDialog({
      title: `Pindahkan ${selectedIds.length} Perangkat?`,
      message: `Perangkat terpilih akan dipindahkan ke site ${
        targetSite ? `${targetSite.siteCode} (${targetSite.name})` : `#${targetSiteId}`
      }. Penempatan ruang/rak lama pada perangkat yang berpindah site akan direset.`,
      confirmLabel: 'Pindahkan Sekarang',
      tone: 'primary',
    });
    if (!confirmed) return;
    await executeBulkAction({
      action: 'MOVE_SITE',
      deviceIds: selectedIds,
      siteId: targetSiteId,
    });
  };

  const handleBulkRestore = async () => {
    if (selectedIds.length === 0) return;
    const confirmed = await confirmDialog({
      title: `Pulihkan ${selectedIds.length} Perangkat dari Arsip?`,
      message: `${selectedIds.length} perangkat terpilih akan dikembalikan ke daftar inventaris aktif.`,
      confirmLabel: 'Pulihkan Semua',
      tone: 'primary',
    });
    if (!confirmed) return;
    await executeBulkAction({
      action: 'RESTORE',
      deviceIds: selectedIds,
    });
  };

  const handleBulkArchiveSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedIds.length === 0 || !bulkArchiveReason.trim()) return;
    await executeBulkAction({
      action: 'ARCHIVE',
      deviceIds: selectedIds,
      reason: bulkArchiveReason.trim(),
    });
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
            setSelectedMap({});
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
            setSelectedMap({});
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
        {/* Quick Search Presets */}
        <div className="flex flex-wrap items-center gap-1.5 pb-2 border-b border-line/70 text-[11px]">
          <span className="font-semibold text-ink-secondary mr-1">Preset Cepat:</span>
          <button
            type="button"
            onClick={resetAllFilters}
            className={`min-h-[32px] rounded-full border px-2.5 py-1 font-medium transition-colors cursor-pointer ${
              !isArchived &&
              !inventoryStatus &&
              !anomaly &&
              !q &&
              !categoryId &&
              !vendorId &&
              !siteId
                ? 'border-accent bg-accent-soft text-accent-ink font-semibold'
                : 'border-line bg-canvas text-ink-secondary hover:bg-subtle hover:text-ink'
            }`}
          >
            Semua Aktif
          </button>
          <button
            type="button"
            onClick={() => {
              setIsArchived(false);
              setInventoryStatus(inventoryStatus === 'MAINTENANCE' && !anomaly ? '' : 'MAINTENANCE');
              setAnomaly('');
              setPage(1);
            }}
            className={`min-h-[32px] rounded-full border px-2.5 py-1 font-medium transition-colors cursor-pointer ${
              !isArchived && inventoryStatus === 'MAINTENANCE' && !anomaly
                ? 'border-amber-500/60 bg-amber-100 text-amber-900 dark:bg-amber-950/70 dark:text-amber-300 font-semibold'
                : 'border-line bg-canvas text-ink-secondary hover:bg-subtle hover:text-ink'
            }`}
          >
            Sedang Maintenance
          </button>
          <button
            type="button"
            onClick={() => {
              setIsArchived(false);
              setInventoryStatus(inventoryStatus === 'PLANNED' && !anomaly ? '' : 'PLANNED');
              setAnomaly('');
              setPage(1);
            }}
            className={`min-h-[32px] rounded-full border px-2.5 py-1 font-medium transition-colors cursor-pointer ${
              !isArchived && inventoryStatus === 'PLANNED' && !anomaly
                ? 'border-sky-500/60 bg-sky-100 text-sky-900 dark:bg-sky-950/70 dark:text-sky-300 font-semibold'
                : 'border-line bg-canvas text-ink-secondary hover:bg-subtle hover:text-ink'
            }`}
          >
            Status Planned
          </button>
          <button
            type="button"
            onClick={() => {
              setIsArchived(false);
              setAnomaly(anomaly === 'no_ip' ? '' : 'no_ip');
              setPage(1);
            }}
            className={`min-h-[32px] rounded-full border px-2.5 py-1 font-medium transition-colors cursor-pointer ${
              !isArchived && anomaly === 'no_ip'
                ? 'border-rose-500/60 bg-rose-100 text-rose-900 dark:bg-rose-950/70 dark:text-rose-200 font-semibold'
                : 'border-line bg-canvas text-ink-secondary hover:bg-subtle hover:text-ink'
            }`}
          >
            Tanpa IP Manajemen
          </button>
          <button
            type="button"
            onClick={() => {
              setIsArchived(false);
              setAnomaly(anomaly === 'no_sn' ? '' : 'no_sn');
              setPage(1);
            }}
            className={`min-h-[32px] rounded-full border px-2.5 py-1 font-medium transition-colors cursor-pointer ${
              !isArchived && anomaly === 'no_sn'
                ? 'border-rose-500/60 bg-rose-100 text-rose-900 dark:bg-rose-950/70 dark:text-rose-200 font-semibold'
                : 'border-line bg-canvas text-ink-secondary hover:bg-subtle hover:text-ink'
            }`}
          >
            Tanpa Serial Number
          </button>
          <button
            type="button"
            onClick={() => {
              setIsArchived(false);
              setAnomaly(anomaly === 'no_ports' ? '' : 'no_ports');
              setPage(1);
            }}
            className={`min-h-[32px] rounded-full border px-2.5 py-1 font-medium transition-colors cursor-pointer ${
              !isArchived && anomaly === 'no_ports'
                ? 'border-rose-500/60 bg-rose-100 text-rose-900 dark:bg-rose-950/70 dark:text-rose-200 font-semibold'
                : 'border-line bg-canvas text-ink-secondary hover:bg-subtle hover:text-ink'
            }`}
          >
            Tanpa Port
          </button>
          <button
            type="button"
            onClick={() => {
              setIsArchived(false);
              setAnomaly(anomaly === 'no_rack' ? '' : 'no_rack');
              setPage(1);
            }}
            className={`min-h-[32px] rounded-full border px-2.5 py-1 font-medium transition-colors cursor-pointer ${
              !isArchived && anomaly === 'no_rack'
                ? 'border-rose-500/60 bg-rose-100 text-rose-900 dark:bg-rose-950/70 dark:text-rose-200 font-semibold'
                : 'border-line bg-canvas text-ink-secondary hover:bg-subtle hover:text-ink'
            }`}
          >
            Tanpa Ruang / Rak
          </button>
        </div>

        <form onSubmit={handleSearchSubmit} className="flex flex-col gap-2 sm:flex-row">
          <label htmlFor="global-device-search" className="sr-only">
            Cari perangkat
          </label>
          <input
            id="global-device-search"
            type="text"
            placeholder="Cari hostname, kode perangkat, nomor seri, MAC port, IP, atau model..."
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(1);
            }}
            className="min-h-[40px] flex-1 rounded-lg border border-line bg-canvas px-3 py-1.5 text-xs text-ink placeholder-ink-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
          />
          <div className="flex gap-2">
            <button
              type="submit"
              className="min-h-[40px] rounded-lg bg-accent px-4 py-1.5 text-xs font-semibold text-accent-fg hover:bg-accent-hover cursor-pointer"
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
                className="min-h-[40px] rounded-lg border border-line bg-surface px-3 py-1.5 text-xs font-medium text-ink-secondary hover:bg-subtle hover:text-ink cursor-pointer"
              >
                Reset
              </button>
            )}
          </div>
        </form>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5 text-xs">
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

          <div>
            <label htmlFor="global-anomaly" className="block font-semibold text-ink-secondary mb-1">
              Kondisi Anomali Data
            </label>
            <select
              id="global-anomaly"
              value={anomaly}
              onChange={(e) => {
                setAnomaly(e.target.value);
                setPage(1);
              }}
              className="min-h-[40px] w-full rounded-lg border border-line bg-canvas px-2.5 py-1.5 text-ink focus:border-accent focus:outline-none"
            >
              <option value="">Semua Kondisi Data</option>
              <option value="no_ip">Tanpa IP Manajemen</option>
              <option value="no_sn">Tanpa Serial Number</option>
              <option value="no_ports">Tanpa Port / Interface</option>
              <option value="no_rack">Tanpa Ruang / Rak</option>
            </select>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-line">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleCopyFilterUrl}
              className="inline-flex min-h-[38px] items-center gap-1.5 rounded-lg border border-line bg-canvas px-3 py-1.5 text-xs font-semibold text-ink-secondary hover:bg-subtle hover:text-ink transition-colors duration-150 cursor-pointer"
            >
              <IconCopy className="h-3.5 w-3.5" />
              <span>Salin Tautan Filter</span>
            </button>
            {(q || categoryId || vendorId || siteId || inventoryStatus || anomaly || isArchived || page > 1) && (
              <button
                type="button"
                onClick={resetAllFilters}
                className="inline-flex min-h-[38px] items-center gap-1.5 rounded-lg border border-line bg-surface px-3 py-1.5 text-xs font-medium text-ink-secondary hover:bg-subtle hover:text-ink transition-colors duration-150 cursor-pointer"
              >
                <IconRefresh className="h-3.5 w-3.5" />
                <span>Reset Semua Filter</span>
              </button>
            )}
          </div>

          {canExport && (
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
          )}
        </div>
      </div>

      {errorMsg && (
        <div className="rounded-xl border border-rose-200 dark:border-rose-900/60 bg-rose-50 dark:bg-rose-950/60 p-4 text-xs text-rose-800 dark:text-rose-200">
          {errorMsg}
        </div>
      )}

      {selectedList.length > 0 && (
        <div
          role="region"
          aria-label="Aksi Massal Perangkat"
          className="rounded-xl border border-accent/40 bg-accent-soft/45 p-3.5 shadow-xs flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between"
        >
          <div className="flex flex-wrap items-center gap-2.5 text-xs">
            <span className="inline-flex items-center rounded-md bg-accent px-2.5 py-1 font-bold text-accent-fg tabular-nums-data">
              {selectedList.length} dipilih
            </span>
            <button
              type="button"
              onClick={() => setSelectedMap({})}
              className="min-h-[34px] rounded-md border border-line bg-surface px-2.5 py-1 text-xs font-medium text-ink-secondary hover:bg-subtle hover:text-ink"
            >
              Batal Pilih
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs">
            <button
              type="button"
              onClick={() => setQrModalDevices(selectedList.map(toQrLabelDevice))}
              className="inline-flex min-h-[38px] items-center gap-1.5 rounded-lg border border-line bg-surface px-3 py-1.5 font-semibold text-ink hover:bg-subtle"
            >
              <IconQrCode className="h-4 w-4 text-accent-ink" />
              <span>Cetak Label QR ({selectedList.length})</span>
            </button>

            {!isArchived && canUpdate && (
              <>
                <div className="flex items-center gap-1.5 rounded-lg border border-line bg-surface p-1">
                  <select
                    aria-label="Status target massal"
                    value={bulkStatus}
                    onChange={(e) => setBulkStatus(e.target.value)}
                    disabled={bulkSubmitting}
                    className="min-h-[30px] rounded border-0 bg-canvas px-2 py-1 text-xs font-medium text-ink focus:outline-none"
                  >
                    {INVENTORY_STATUS_OPTIONS.map((st) => (
                      <option key={st} value={st}>
                        {st}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    disabled={bulkSubmitting}
                    onClick={handleBulkStatus}
                    className="min-h-[30px] rounded-md bg-accent px-2.5 py-1 text-xs font-semibold text-accent-fg hover:bg-accent-hover disabled:opacity-50"
                  >
                    Ubah Status
                  </button>
                </div>

                {sites.length > 0 && (
                  <div className="flex items-center gap-1.5 rounded-lg border border-line bg-surface p-1">
                    <select
                      aria-label="Site tujuan massal"
                      value={bulkSiteId}
                      onChange={(e) => setBulkSiteId(e.target.value)}
                      disabled={bulkSubmitting}
                      className="max-w-[190px] min-h-[30px] rounded border-0 bg-canvas px-2 py-1 text-xs font-medium text-ink focus:outline-none"
                    >
                      {sites.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.siteCode} - {s.name}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      disabled={bulkSubmitting || !bulkSiteId}
                      onClick={handleBulkMoveSite}
                      className="min-h-[30px] rounded-md border border-line bg-canvas px-2.5 py-1 text-xs font-semibold text-ink hover:bg-subtle disabled:opacity-50"
                    >
                      Pindah Site
                    </button>
                  </div>
                )}
              </>
            )}

            {canArchive &&
              (isArchived ? (
                <button
                  type="button"
                  disabled={bulkSubmitting}
                  onClick={handleBulkRestore}
                  className="min-h-[38px] rounded-lg bg-emerald-600 px-3 py-1.5 font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
                >
                  Pulihkan ({selectedList.length})
                </button>
              ) : (
                <button
                  type="button"
                  disabled={bulkSubmitting}
                  onClick={() => {
                    setBulkArchiveReason('');
                    setBulkArchiveOpen(true);
                  }}
                  className="min-h-[38px] rounded-lg bg-rose-600 px-3 py-1.5 font-semibold text-white hover:bg-rose-500 disabled:opacity-50"
                >
                  Arsipkan ({selectedList.length})
                </button>
              ))}
          </div>
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-line bg-surface shadow-xs">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-line text-left text-xs">
            <thead className="bg-subtle text-ink-secondary font-semibold uppercase text-[11px]">
              <tr>
                <th className="w-10 px-3 py-3 text-center">
                  <input
                    type="checkbox"
                    aria-label="Pilih semua perangkat di halaman ini"
                    checked={allVisibleSelected}
                    onChange={toggleSelectAllVisible}
                    className="h-4 w-4 rounded border-line accent-[var(--accent)] cursor-pointer"
                  />
                </th>
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
                  <td colSpan={isArchived ? 11 : 10} className="px-4 py-8 text-center text-ink-secondary">
                    Memuat data perangkat...
                  </td>
                </tr>
              ) : devices.length === 0 ? (
                <tr>
                  <td colSpan={isArchived ? 11 : 10} className="px-4 py-8 text-center text-ink-secondary">
                    {isArchived
                      ? 'Tidak ada perangkat yang diarsipkan sesuai filter saat ini.'
                      : 'Belum ada perangkat terdaftar atau tidak cocok dengan filter.'}
                  </td>
                </tr>
              ) : (
                devices.map((d) => {
                  const isSelected = Boolean(selectedMap[d.id]);
                  return (
                  <tr
                    key={d.id}
                    className={`transition-colors duration-100 hover:bg-subtle/60 ${
                      isSelected ? 'bg-accent-soft/35' : ''
                    }`}
                  >
                    <td className="px-3 py-3 text-center">
                      <input
                        type="checkbox"
                        aria-label={`Pilih perangkat ${d.hostname}`}
                        checked={isSelected}
                        onChange={() => toggleSelectRow(d)}
                        className="h-4 w-4 rounded border-line accent-[var(--accent)] cursor-pointer"
                      />
                    </td>
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
                      {canCreate && !isArchived && (
                        <Link
                          href={`/devices/new?cloneFrom=${d.id}`}
                          className="text-ink-secondary hover:text-accent-ink font-medium"
                        >
                          Duplikat
                        </Link>
                      )}
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
                  );
                })
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

      {bulkArchiveOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="bulk-archive-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 animate-backdrop"
        >
          <div className="w-full max-w-md rounded-xl border border-line bg-elevated p-5 shadow-2xl space-y-4 animate-modal">
            <h3 id="bulk-archive-title" className="text-sm font-bold text-ink">
              Arsipkan {selectedList.length} Perangkat Secara Massal
            </h3>
            <p className="text-xs text-ink-secondary">
              Seluruh {selectedList.length} perangkat terpilih akan dipindahkan ke arsip dengan alasan yang sama dan tercatat di Audit Log masing-masing unit.
            </p>
            <form onSubmit={handleBulkArchiveSubmit} className="space-y-3">
              <div>
                <label
                  htmlFor="bulk-archive-reason"
                  className="block text-xs font-semibold text-ink-secondary"
                >
                  Alasan Pengarsipan Massal *
                </label>
                <textarea
                  id="bulk-archive-reason"
                  required
                  minLength={3}
                  rows={3}
                  placeholder="Contoh: Decommission batch POP lama Q4."
                  value={bulkArchiveReason}
                  onChange={(e) => setBulkArchiveReason(e.target.value)}
                  className="mt-1.5 block w-full rounded-lg border border-line bg-canvas p-2.5 text-xs text-ink placeholder-ink-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
                />
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  disabled={bulkSubmitting}
                  onClick={() => setBulkArchiveOpen(false)}
                  className="min-h-[40px] rounded-lg border border-line bg-surface px-3.5 py-1.5 text-xs font-medium text-ink-secondary hover:bg-subtle hover:text-ink disabled:opacity-50"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={bulkSubmitting}
                  className="min-h-[40px] rounded-lg bg-rose-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-rose-500 disabled:opacity-50"
                >
                  {bulkSubmitting ? 'Mengarsipkan...' : `Arsipkan ${selectedList.length} Unit`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {qrModalDevices && (
        <QrLabelModal
          devices={qrModalDevices}
          onClose={() => setQrModalDevices(null)}
        />
      )}
    </div>
  );
}
