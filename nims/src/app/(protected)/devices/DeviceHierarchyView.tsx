'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  IconPopBuilding,
  IconSitePin,
  IconCustomerGroup,
  IconCog,
  IconServer,
  IconSearch,
  IconChevronRight,
  IconArrowLeft,
  IconArrowRight,
  IconPlus,
} from '@/components/Icons';

interface PopItem {
  id: number;
  siteCode: string;
  name: string;
  siteType: string;
  city: string | null;
  province: string | null;
  address: string | null;
  status: string;
  description: string | null;
  customerSiteCount: number;
  directDeviceCount: number;
  totalDeviceCount: number;
}

interface CustomerSiteItem {
  id: number;
  siteCode: string;
  name: string;
  siteType: string;
  address: string | null;
  city: string | null;
  province: string | null;
  status: string;
  description: string | null;
  deviceCount: number;
}

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
  canCreate: boolean;
  canArchive: boolean;
  canExport?: boolean;
  categories: { id: number; name: string }[];
  vendors: { id: number; name: string }[];
  initialPopId?: number | null;
  initialSiteId?: number | null;
}

export function DeviceHierarchyView({
  canCreate,
  canArchive,
  categories,
  vendors,
}: Props) {
  const [selectedPop, setSelectedPop] = useState<PopItem | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerSiteItem | null>(null);
  const [drillDir, setDrillDir] = useState<'forward' | 'back'>('forward');

  // Level 1: POPs
  const [pops, setPops] = useState<PopItem[]>([]);
  const [loadingPops, setLoadingPops] = useState(true);
  const [popSearch, setPopSearch] = useState('');

  // Level 2: Customer sites
  const [customerSites, setCustomerSites] = useState<CustomerSiteItem[]>([]);
  const [loadingCustomers, setLoadingCustomers] = useState(false);
  const [customerSearch, setCustomerSearch] = useState('');
  const [activeTabLevel2, setActiveTabLevel2] = useState<'customers' | 'pop_internal'>('customers');

  // Level 3: Devices
  const [devices, setDevices] = useState<DeviceItem[]>([]);
  const [loadingDevices, setLoadingDevices] = useState(false);
  const [deviceSearch, setDeviceSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterVendor, setFilterVendor] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalDevices, setTotalDevices] = useState(0);

  // Archive modal
  const [archiveTarget, setArchiveTarget] = useState<DeviceItem | null>(null);
  const [archiveReason, setArchiveReason] = useState('');
  const [archiveLoading, setArchiveLoading] = useState(false);
  const [archiveError, setArchiveError] = useState<string | null>(null);

  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!archiveTarget) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setArchiveTarget(null);
        setArchiveReason('');
        setArchiveError(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [archiveTarget]);

  const fetchPops = useCallback(async () => {
    setLoadingPops(true);
    setErrorMsg(null);
    try {
      const params = new URLSearchParams();
      if (popSearch.trim()) params.set('q', popSearch.trim());
      const res = await fetch(`/api/devices/hierarchy?${params.toString()}`);
      if (!res.ok) throw new Error('Gagal memuat daftar POP');
      const json = await res.json();
      setPops(json.data.pops || []);
    } catch (err: any) {
      setErrorMsg(err.message || 'Terjadi kesalahan sistem');
    } finally {
      setLoadingPops(false);
    }
  }, [popSearch]);

  useEffect(() => {
    fetchPops();
  }, [fetchPops]);

  const fetchCustomers = useCallback(async (popId: number) => {
    setLoadingCustomers(true);
    setErrorMsg(null);
    try {
      const params = new URLSearchParams({ popId: popId.toString() });
      if (customerSearch.trim()) params.set('q', customerSearch.trim());
      const res = await fetch(`/api/devices/hierarchy?${params.toString()}`);
      if (!res.ok) throw new Error('Gagal memuat daftar customer site');
      const json = await res.json();
      setCustomerSites(json.data.customerSites || []);
    } catch (err: any) {
      setErrorMsg(err.message || 'Gagal mengambil data pelanggan');
    } finally {
      setLoadingCustomers(false);
    }
  }, [customerSearch]);

  useEffect(() => {
    if (selectedPop) {
      fetchCustomers(selectedPop.id);
    }
  }, [selectedPop, fetchCustomers]);

  const activeTargetSiteId = selectedCustomer
    ? selectedCustomer.id
    : activeTabLevel2 === 'pop_internal' && selectedPop
    ? selectedPop.id
    : null;

  const fetchDevices = useCallback(
    async (siteId: number) => {
      setLoadingDevices(true);
      setErrorMsg(null);
      try {
        const params = new URLSearchParams({
          siteId: siteId.toString(),
          page: page.toString(),
          limit: '10',
        });
        if (deviceSearch.trim()) params.set('q', deviceSearch.trim());
        if (filterCategory) params.set('categoryId', filterCategory);
        if (filterVendor) params.set('vendorId', filterVendor);
        if (filterStatus) params.set('inventoryStatus', filterStatus);

        const res = await fetch(`/api/devices?${params.toString()}`);
        if (!res.ok) throw new Error('Gagal memuat daftar perangkat');
        const json = await res.json();
        setDevices(json.data || []);
        setTotalPages(json.pagination?.totalPages || 1);
        setTotalDevices(json.pagination?.total || 0);
      } catch (err: any) {
        setErrorMsg(err.message || 'Gagal memuat perangkat');
      } finally {
        setLoadingDevices(false);
      }
    },
    [page, deviceSearch, filterCategory, filterVendor, filterStatus]
  );

  useEffect(() => {
    if (activeTargetSiteId) {
      fetchDevices(activeTargetSiteId);
    }
  }, [activeTargetSiteId, fetchDevices]);

  const handleArchiveSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!archiveTarget || !archiveReason.trim()) return;
    setArchiveLoading(true);
    setArchiveError(null);
    try {
      const res = await fetch(`/api/devices/${archiveTarget.id}/archive`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: archiveReason.trim() }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.message || 'Gagal mengarsipkan perangkat');
      }
      setArchiveTarget(null);
      setArchiveReason('');
      if (activeTargetSiteId) fetchDevices(activeTargetSiteId);
      if (selectedPop) fetchCustomers(selectedPop.id);
      fetchPops();
    } catch (err: any) {
      setArchiveError(err.message);
    } finally {
      setArchiveLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'ACTIVE':
        return (
          <span className="inline-flex items-center rounded-md bg-emerald-100 dark:bg-emerald-950/70 px-2 py-0.5 text-[11px] font-semibold text-emerald-900 dark:text-emerald-300">
            Aktif
          </span>
        );
      case 'MAINTENANCE':
        return (
          <span className="inline-flex items-center rounded-md bg-amber-100 dark:bg-amber-950/70 px-2 py-0.5 text-[11px] font-semibold text-amber-900 dark:text-amber-300">
            Perawatan
          </span>
        );
      case 'PLANNED':
        return (
          <span className="inline-flex items-center rounded-md bg-sky-100 dark:bg-sky-950/70 px-2 py-0.5 text-[11px] font-semibold text-sky-900 dark:text-sky-300">
            Direncanakan
          </span>
        );
      case 'RETIRED':
        return (
          <span className="inline-flex items-center rounded-md bg-subtle px-2 py-0.5 text-[11px] font-semibold text-ink-secondary">
            Pensiun
          </span>
        );
      case 'LOST':
        return (
          <span className="inline-flex items-center rounded-md bg-rose-100 dark:bg-rose-950/70 px-2 py-0.5 text-[11px] font-semibold text-rose-900 dark:text-rose-300">
            Hilang
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center rounded-md bg-subtle px-2 py-0.5 text-[11px] font-semibold text-ink-secondary">
            {status}
          </span>
        );
    }
  };

  const drillAnimClass = drillDir === 'forward' ? 'animate-drill-forward' : 'animate-drill-back';

  return (
    <div className="space-y-6">
      {/* Breadcrumb Navigation Hierarchy */}
      <nav
        aria-label="Hierarki Lokasi"
        className="flex items-center flex-wrap gap-2 text-xs sm:text-sm bg-surface p-3 rounded-xl border border-line shadow-xs"
      >
        <button
          type="button"
          onClick={() => {
            setDrillDir('back');
            setSelectedPop(null);
            setSelectedCustomer(null);
            setActiveTabLevel2('customers');
          }}
          className={`inline-flex min-h-[36px] items-center gap-1.5 rounded-md px-2.5 py-1 font-medium transition-colors duration-150 ${
            !selectedPop
              ? 'bg-accent-soft text-accent-ink font-semibold'
              : 'text-ink-secondary hover:bg-subtle hover:text-ink'
          }`}
        >
          <IconPopBuilding className="h-4 w-4 shrink-0" />
          <span>Semua POP</span>
        </button>

        {selectedPop && (
          <>
            <IconChevronRight className="h-4 w-4 text-ink-muted shrink-0" />
            <button
              type="button"
              onClick={() => {
                setDrillDir('back');
                setSelectedCustomer(null);
                setActiveTabLevel2('customers');
              }}
              className={`inline-flex min-h-[36px] items-center gap-1.5 rounded-md px-2.5 py-1 font-medium transition-colors duration-150 ${
                selectedPop && !selectedCustomer && activeTabLevel2 !== 'pop_internal'
                  ? 'bg-accent-soft text-accent-ink font-semibold'
                  : 'text-ink-secondary hover:bg-subtle hover:text-ink'
              }`}
            >
              <IconSitePin className="h-4 w-4 shrink-0" />
              <span>
                {selectedPop.name} ({selectedPop.siteCode})
              </span>
            </button>
          </>
        )}

        {selectedCustomer && (
          <>
            <IconChevronRight className="h-4 w-4 text-ink-muted shrink-0" />
            <span className="inline-flex min-h-[36px] items-center gap-1.5 rounded-md bg-accent-soft px-2.5 py-1 text-xs font-semibold text-accent-ink">
              <IconCustomerGroup className="h-4 w-4 shrink-0" />
              <span>
                {selectedCustomer.name} ({selectedCustomer.siteCode})
              </span>
            </span>
          </>
        )}

        {selectedPop && activeTabLevel2 === 'pop_internal' && !selectedCustomer && (
          <>
            <IconChevronRight className="h-4 w-4 text-ink-muted shrink-0" />
            <span className="inline-flex min-h-[36px] items-center gap-1.5 rounded-md bg-accent-soft px-2.5 py-1 text-xs font-semibold text-accent-ink">
              <IconCog className="h-4 w-4 shrink-0" />
              <span>Perangkat Internal POP</span>
            </span>
          </>
        )}
      </nav>

      {errorMsg && (
        <div className="rounded-xl bg-rose-50 dark:bg-rose-950/50 p-4 border border-rose-200 dark:border-rose-900/60 text-xs font-medium text-rose-800 dark:text-rose-200">
          {errorMsg}
        </div>
      )}

      {/* LEVEL 1: DAFTAR POP */}
      {!selectedPop && (
        <div key="level-1-pops" className={`space-y-4 ${drillAnimClass}`}>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-ink">Pilih Point of Presence (POP)</h2>
              <p className="text-xs text-ink-secondary">
                Pilih lokasi POP induk untuk melihat daftar pelanggan dan perangkat terpasang di area tersebut.
              </p>
            </div>
            <div className="relative w-full sm:w-72">
              <label htmlFor="pop-search" className="sr-only">
                Cari POP
              </label>
              <IconSearch className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-muted" />
              <input
                id="pop-search"
                type="text"
                placeholder="Cari nama POP, kode, atau kota..."
                value={popSearch}
                onChange={(e) => setPopSearch(e.target.value)}
                className="min-h-[44px] w-full rounded-lg border border-line bg-surface pl-9 pr-3 text-xs text-ink placeholder-ink-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
              />
            </div>
          </div>

          {loadingPops ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3].map((n) => (
                <div
                  key={n}
                  className="h-44 rounded-xl border border-line bg-surface p-5 opacity-70"
                >
                  <div className="h-4 w-24 rounded bg-subtle" />
                  <div className="mt-3 h-5 w-48 rounded bg-subtle" />
                  <div className="mt-2 h-3 w-36 rounded bg-subtle" />
                </div>
              ))}
            </div>
          ) : pops.length === 0 ? (
            <div className="text-center py-12 rounded-xl border border-dashed border-line-strong bg-surface p-8">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-subtle text-ink-secondary">
                <IconPopBuilding className="h-6 w-6" />
              </div>
              <h3 className="mt-3 text-sm font-semibold text-ink">Tidak ada POP ditemukan</h3>
              <p className="mt-1 text-xs text-ink-secondary">
                {popSearch
                  ? 'Tidak ada POP yang cocok dengan kata kunci pencarian. Ubah atau hapus filter pencarian.'
                  : 'Belum ada data master POP terdaftar. Tambahkan site bertipe POP melalui menu Master Data.'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {pops.map((pop, idx) => (
                <button
                  type="button"
                  key={pop.id}
                  onClick={() => {
                    setDrillDir('forward');
                    setSelectedPop(pop);
                    setSelectedCustomer(null);
                    setCustomerSearch('');
                  }}
                  style={{ animationDelay: `${Math.min(idx, 5) * 40}ms` }}
                  className="animate-enter group text-left rounded-xl border border-line bg-surface p-5 shadow-xs transition-[border-color,box-shadow,transform] duration-150 hover:border-accent hover:shadow-md hover:-translate-y-0.5 active:scale-[0.99] flex flex-col justify-between"
                >
                  <div className="w-full">
                    <div className="flex items-center justify-between mb-3">
                      <span className="inline-flex items-center rounded-md bg-accent-soft px-2.5 py-1 text-xs font-mono font-semibold text-accent-ink">
                        {pop.siteCode}
                      </span>
                      <span className="inline-flex items-center rounded-md bg-emerald-100 dark:bg-emerald-950/70 px-2 py-0.5 text-[11px] font-semibold text-emerald-900 dark:text-emerald-300">
                        {pop.status === 'active' ? 'Aktif' : pop.status}
                      </span>
                    </div>

                    <h3 className="text-base font-bold text-ink group-hover:text-accent-ink transition-colors duration-150">
                      {pop.name}
                    </h3>
                    <p className="mt-1 flex items-center gap-1.5 text-xs text-ink-secondary">
                      <IconSitePin className="h-3.5 w-3.5 shrink-0 text-ink-muted" />
                      <span>
                        {pop.city || 'Kota belum diatur'}
                        {pop.province ? `, ${pop.province}` : ''}
                      </span>
                    </p>
                    {pop.address && (
                      <p className="mt-1 text-xs text-ink-muted line-clamp-1">{pop.address}</p>
                    )}
                  </div>

                  <div className="mt-5 w-full pt-4 border-t border-line">
                    <div className="grid grid-cols-2 gap-2 text-center mb-3">
                      <div className="rounded-lg bg-subtle p-2.5">
                        <span className="block text-[11px] text-ink-secondary font-medium">
                          Site Pelanggan
                        </span>
                        <span className="mt-0.5 inline-flex items-center gap-1 text-sm font-bold font-mono text-ink tabular-nums-data">
                          <IconCustomerGroup className="h-3.5 w-3.5 text-ink-muted" />
                          <span>{pop.customerSiteCount}</span>
                        </span>
                      </div>
                      <div className="rounded-lg bg-accent-soft p-2.5">
                        <span className="block text-[11px] text-accent-ink font-medium">
                          Total Perangkat
                        </span>
                        <span className="mt-0.5 inline-flex items-center gap-1 text-sm font-bold font-mono text-accent-ink tabular-nums-data">
                          <IconServer className="h-3.5 w-3.5" />
                          <span>{pop.totalDeviceCount}</span>
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-xs font-semibold text-accent-ink">
                      <span>Buka Daftar Customer</span>
                      <IconArrowRight className="h-4 w-4 transition-transform duration-150 group-hover:translate-x-1" />
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* LEVEL 2: DAFTAR CUSTOMER SITE DI BAWAH POP TERPILIH */}
      {selectedPop && !selectedCustomer && (
        <div key={`level-2-${selectedPop.id}`} className={`space-y-5 ${drillAnimClass}`}>
          <div className="rounded-xl border border-line bg-surface p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-accent-ink bg-accent-soft px-2 py-0.5 rounded">
                  POP Induk
                </span>
                <span className="text-xs font-mono text-ink-muted">[{selectedPop.siteCode}]</span>
              </div>
              <h2 className="text-xl font-bold text-ink mt-1.5">{selectedPop.name}</h2>
              <p className="mt-1 flex items-center gap-1.5 text-xs text-ink-secondary">
                <IconSitePin className="h-3.5 w-3.5 shrink-0 text-ink-muted" />
                <span>
                  {selectedPop.address ? `${selectedPop.address}, ` : ''}
                  {selectedPop.city || 'Kota'}
                  {selectedPop.province ? `, ${selectedPop.province}` : ''}
                </span>
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setDrillDir('back');
                  setSelectedPop(null);
                }}
                className="inline-flex min-h-[44px] items-center gap-1.5 rounded-lg border border-line bg-surface px-3.5 py-2 text-xs font-medium text-ink-secondary hover:bg-subtle hover:text-ink"
              >
                <IconArrowLeft className="h-3.5 w-3.5" />
                <span>Ganti POP</span>
              </button>
              {canCreate && (
                <Link
                  href={`/devices/new?siteId=${selectedPop.id}`}
                  className="inline-flex min-h-[44px] items-center gap-1.5 rounded-lg bg-accent px-3.5 py-2 text-xs font-semibold text-accent-fg shadow-xs hover:bg-accent-hover"
                >
                  <IconPlus className="h-3.5 w-3.5" />
                  <span>Tambah Perangkat ke POP</span>
                </Link>
              )}
            </div>
          </div>

          {/* Sub-tabs */}
          <div className="flex items-center justify-between border-b border-line pb-3 flex-wrap gap-3">
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setActiveTabLevel2('customers')}
                className={`inline-flex min-h-[40px] items-center gap-2 px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-colors duration-150 ${
                  activeTabLevel2 === 'customers'
                    ? 'bg-accent text-accent-fg'
                    : 'bg-subtle text-ink-secondary hover:text-ink'
                }`}
              >
                <IconCustomerGroup className="h-4 w-4" />
                <span>Site Pelanggan ({customerSites.length})</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTabLevel2('pop_internal')}
                className={`inline-flex min-h-[40px] items-center gap-2 px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-colors duration-150 ${
                  activeTabLevel2 === 'pop_internal'
                    ? 'bg-accent text-accent-fg'
                    : 'bg-subtle text-ink-secondary hover:text-ink'
                }`}
              >
                <IconCog className="h-4 w-4" />
                <span>Perangkat Internal POP ({selectedPop.directDeviceCount})</span>
              </button>
            </div>

            {activeTabLevel2 === 'customers' && (
              <div className="relative w-full sm:w-64">
                <label htmlFor="customer-search" className="sr-only">
                  Cari pelanggan
                </label>
                <IconSearch className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-muted" />
                <input
                  id="customer-search"
                  type="text"
                  placeholder="Cari nama pelanggan atau kode site..."
                  value={customerSearch}
                  onChange={(e) => setCustomerSearch(e.target.value)}
                  className="min-h-[40px] w-full rounded-lg border border-line bg-surface pl-9 pr-3 text-xs text-ink placeholder-ink-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
                />
              </div>
            )}
          </div>

          {activeTabLevel2 === 'customers' && (
            <div>
              {loadingCustomers ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {[1, 2, 3].map((n) => (
                    <div
                      key={n}
                      className="h-36 rounded-xl border border-line bg-surface p-4 opacity-70"
                    />
                  ))}
                </div>
              ) : customerSites.length === 0 ? (
                <div className="text-center py-10 rounded-xl border border-dashed border-line-strong bg-surface p-6">
                  <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-subtle text-ink-secondary">
                    <IconCustomerGroup className="h-5 w-5" />
                  </div>
                  <h3 className="mt-2.5 text-sm font-semibold text-ink">Belum ada Site Pelanggan</h3>
                  <p className="mt-1 text-xs text-ink-secondary max-w-md mx-auto">
                    {customerSearch
                      ? 'Tidak ada site pelanggan yang cocok dengan kata kunci.'
                      : 'Belum ada site pelanggan terdaftar di bawah POP ini. Tambahkan site baru melalui menu Master Data.'}
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {customerSites.map((cust) => (
                    <button
                      type="button"
                      key={cust.id}
                      onClick={() => {
                        setDrillDir('forward');
                        setSelectedCustomer(cust);
                        setDeviceSearch('');
                        setPage(1);
                      }}
                      className="group text-left rounded-xl border border-line bg-surface p-5 shadow-xs transition-[border-color,box-shadow,transform] duration-150 hover:border-accent hover:shadow-md hover:-translate-y-0.5 active:scale-[0.99] flex flex-col justify-between"
                    >
                      <div className="w-full">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-mono text-xs font-semibold text-ink-secondary bg-subtle px-2 py-0.5 rounded">
                            {cust.siteCode}
                          </span>
                          <span className="inline-flex items-center rounded-md bg-emerald-100 dark:bg-emerald-950/70 px-2 py-0.5 text-[11px] font-semibold text-emerald-900 dark:text-emerald-300">
                            {cust.status === 'active' ? 'Aktif' : cust.status}
                          </span>
                        </div>
                        <h4 className="text-base font-bold text-ink group-hover:text-accent-ink transition-colors duration-150">
                          {cust.name}
                        </h4>
                        <p className="mt-1 flex items-center gap-1.5 text-xs text-ink-secondary line-clamp-1">
                          <IconSitePin className="h-3.5 w-3.5 shrink-0 text-ink-muted" />
                          <span>{cust.address || cust.city || 'Alamat belum diatur'}</span>
                        </p>
                      </div>

                      <div className="mt-4 w-full pt-3 border-t border-line flex items-center justify-between">
                        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-ink bg-subtle px-2.5 py-1 rounded-md font-mono tabular-nums-data">
                          <IconServer className="h-3.5 w-3.5 text-ink-muted" />
                          <span>{cust.deviceCount} Unit</span>
                        </span>
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-accent-ink">
                          <span>Lihat Perangkat</span>
                          <IconArrowRight className="h-3.5 w-3.5 transition-transform duration-150 group-hover:translate-x-1" />
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTabLevel2 === 'pop_internal' && (
            <div className="space-y-4">
              <div className="rounded-xl border border-amber-200 dark:border-amber-900/60 bg-amber-50 dark:bg-amber-950/40 p-3.5 text-xs text-amber-900 dark:text-amber-200 flex flex-wrap items-center justify-between gap-2">
                <span>
                  Menampilkan perangkat yang terpasang langsung di ruang server POP ini (core router, agregasi, atau OLT).
                </span>
                {canCreate && (
                  <Link
                    href={`/devices/new?siteId=${selectedPop.id}`}
                    className="font-semibold underline hover:no-underline"
                  >
                    + Tambah Perangkat POP
                  </Link>
                )}
              </div>

              {renderDeviceTable(selectedPop.id, selectedPop.name, selectedPop.siteCode)}
            </div>
          )}
        </div>
      )}

      {/* LEVEL 3: DAFTAR PERANGKAT PADA SITE PELANGGAN TERPILIH */}
      {selectedPop && selectedCustomer && (
        <div key={`level-3-${selectedCustomer.id}`} className={`space-y-5 ${drillAnimClass}`}>
          <div className="rounded-xl border border-line bg-surface p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-accent-ink bg-accent-soft px-2 py-0.5 rounded">
                  Site Pelanggan
                </span>
                <span className="text-xs font-mono text-ink-muted">[{selectedCustomer.siteCode}]</span>
                <span className="text-xs text-ink-secondary">di bawah POP {selectedPop.name}</span>
              </div>
              <h2 className="text-xl font-bold text-ink mt-1.5">{selectedCustomer.name}</h2>
              <p className="mt-1 flex items-center gap-1.5 text-xs text-ink-secondary">
                <IconSitePin className="h-3.5 w-3.5 shrink-0 text-ink-muted" />
                <span>
                  {selectedCustomer.address ? `${selectedCustomer.address}, ` : ''}
                  {selectedCustomer.city || selectedPop.city || ''}
                </span>
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setDrillDir('back');
                  setSelectedCustomer(null);
                }}
                className="inline-flex min-h-[44px] items-center gap-1.5 rounded-lg border border-line bg-surface px-3.5 py-2 text-xs font-medium text-ink-secondary hover:bg-subtle hover:text-ink"
              >
                <IconArrowLeft className="h-3.5 w-3.5" />
                <span>Ganti Customer</span>
              </button>
              {canCreate && (
                <Link
                  href={`/devices/new?siteId=${selectedCustomer.id}`}
                  className="inline-flex min-h-[44px] items-center gap-1.5 rounded-lg bg-accent px-3.5 py-2 text-xs font-semibold text-accent-fg shadow-xs hover:bg-accent-hover"
                >
                  <IconPlus className="h-3.5 w-3.5" />
                  <span>Tambah Perangkat ke Site Ini</span>
                </Link>
              )}
            </div>
          </div>

          {renderDeviceTable(selectedCustomer.id, selectedCustomer.name, selectedCustomer.siteCode)}
        </div>
      )}

      {/* Archive Modal */}
      {archiveTarget && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="hierarchy-archive-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 animate-backdrop"
        >
          <div className="w-full max-w-md rounded-xl border border-line bg-elevated p-6 shadow-2xl animate-modal">
            <h3 id="hierarchy-archive-title" className="text-base font-bold text-ink">
              Arsipkan Perangkat
            </h3>
            <p className="mt-2 text-xs text-ink-secondary">
              Konfirmasi pengarsipan perangkat{' '}
              <strong className="text-ink font-mono">{archiveTarget.deviceCode}</strong> ({archiveTarget.hostname}). Perangkat terarsip tidak tampil di topologi aktif.
            </p>

            {archiveError && (
              <div className="mt-3 rounded-lg bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900/60 p-3 text-xs text-rose-800 dark:text-rose-200">
                {archiveError}
              </div>
            )}

            <form onSubmit={handleArchiveSubmit} className="mt-4 space-y-4">
              <div>
                <label
                  htmlFor="hierarchy-archive-reason"
                  className="block text-xs font-semibold text-ink-secondary mb-1.5"
                >
                  Alasan Pengarsipan <span className="text-rose-600">*</span>
                </label>
                <textarea
                  id="hierarchy-archive-reason"
                  required
                  rows={3}
                  value={archiveReason}
                  onChange={(e) => setArchiveReason(e.target.value)}
                  placeholder="Contoh: Unit diganti model baru atau kontrak selesai..."
                  className="w-full rounded-lg border border-line bg-canvas p-2.5 text-xs text-ink placeholder-ink-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setArchiveTarget(null);
                    setArchiveReason('');
                    setArchiveError(null);
                  }}
                  className="min-h-[40px] rounded-lg border border-line bg-surface px-3.5 py-2 text-xs font-medium text-ink-secondary hover:bg-subtle hover:text-ink"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={archiveLoading || !archiveReason.trim()}
                  className="min-h-[40px] rounded-lg bg-rose-600 px-4 py-2 text-xs font-semibold text-white hover:bg-rose-500 disabled:opacity-50"
                >
                  {archiveLoading ? 'Menyimpan...' : 'Konfirmasi Arsip'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );

  function renderDeviceTable(siteId: number, siteName: string, siteCode: string) {
    return (
      <div className="space-y-4 bg-surface rounded-xl border border-line p-4 sm:p-5 shadow-xs">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div>
            <label
              htmlFor="hier-dev-search"
              className="block text-[11px] font-semibold text-ink-secondary mb-1"
            >
              Cari Perangkat
            </label>
            <input
              id="hier-dev-search"
              type="text"
              placeholder="Hostname, IP, atau Serial..."
              value={deviceSearch}
              onChange={(e) => {
                setDeviceSearch(e.target.value);
                setPage(1);
              }}
              className="min-h-[40px] w-full rounded-lg border border-line bg-canvas px-3 py-1.5 text-xs text-ink placeholder-ink-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
            />
          </div>

          <div>
            <label
              htmlFor="hier-dev-cat"
              className="block text-[11px] font-semibold text-ink-secondary mb-1"
            >
              Kategori
            </label>
            <select
              id="hier-dev-cat"
              value={filterCategory}
              onChange={(e) => {
                setFilterCategory(e.target.value);
                setPage(1);
              }}
              className="min-h-[40px] w-full rounded-lg border border-line bg-canvas px-3 py-1.5 text-xs text-ink focus:border-accent focus:outline-none"
            >
              <option value="">Semua Kategori</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id.toString()}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="hier-dev-vendor"
              className="block text-[11px] font-semibold text-ink-secondary mb-1"
            >
              Vendor
            </label>
            <select
              id="hier-dev-vendor"
              value={filterVendor}
              onChange={(e) => {
                setFilterVendor(e.target.value);
                setPage(1);
              }}
              className="min-h-[40px] w-full rounded-lg border border-line bg-canvas px-3 py-1.5 text-xs text-ink focus:border-accent focus:outline-none"
            >
              <option value="">Semua Vendor</option>
              {vendors.map((v) => (
                <option key={v.id} value={v.id.toString()}>
                  {v.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="hier-dev-status"
              className="block text-[11px] font-semibold text-ink-secondary mb-1"
            >
              Status Inventaris
            </label>
            <select
              id="hier-dev-status"
              value={filterStatus}
              onChange={(e) => {
                setFilterStatus(e.target.value);
                setPage(1);
              }}
              className="min-h-[40px] w-full rounded-lg border border-line bg-canvas px-3 py-1.5 text-xs text-ink focus:border-accent focus:outline-none"
            >
              <option value="">Semua Status</option>
              <option value="ACTIVE">Aktif</option>
              <option value="MAINTENANCE">Perawatan</option>
              <option value="PLANNED">Direncanakan</option>
              <option value="RETIRED">Pensiun</option>
              <option value="LOST">Hilang</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto rounded-lg border border-line">
          <table className="min-w-full divide-y divide-line text-left text-xs">
            <thead className="bg-subtle font-semibold text-ink-secondary uppercase text-[11px]">
              <tr>
                <th className="px-4 py-3">Kode / Hostname</th>
                <th className="px-4 py-3">Kategori</th>
                <th className="px-4 py-3">Vendor / Model</th>
                <th className="px-4 py-3">No. Seri</th>
                <th className="px-4 py-3">IP Manajemen</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Tindakan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line bg-surface">
              {loadingDevices ? (
                <tr>
                  <td colSpan={7} className="text-center py-8 text-ink-secondary">
                    Memuat data perangkat untuk site ini...
                  </td>
                </tr>
              ) : devices.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-10">
                    <p className="text-sm font-semibold text-ink">Belum ada perangkat di site ini</p>
                    <p className="text-xs text-ink-secondary mt-1">
                      {deviceSearch || filterCategory || filterVendor || filterStatus
                        ? 'Tidak ada perangkat yang cocok dengan filter pencarian.'
                        : `Site ${siteName} (${siteCode}) belum memiliki perangkat terdaftar.`}
                    </p>
                    {canCreate && !deviceSearch && (
                      <Link
                        href={`/devices/new?siteId=${siteId}`}
                        className="mt-3 inline-flex min-h-[40px] items-center gap-1.5 rounded-lg bg-accent px-3.5 py-2 text-xs font-semibold text-accent-fg hover:bg-accent-hover"
                      >
                        <IconPlus className="h-3.5 w-3.5" />
                        <span>Tambah Perangkat Sekarang</span>
                      </Link>
                    )}
                  </td>
                </tr>
              ) : (
                devices.map((device) => (
                  <tr key={device.id} className="transition-colors duration-100 hover:bg-subtle/60">
                    <td className="px-4 py-3 font-medium">
                      <Link
                        href={`/devices/${device.id}`}
                        className="text-accent-ink hover:underline font-semibold"
                      >
                        {device.hostname}
                      </Link>
                      <span className="block font-mono text-[11px] text-ink-muted mt-0.5">
                        {device.deviceCode}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-ink-secondary">{device.category?.name || '-'}</td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-ink">{device.vendor?.name || '-'}</div>
                      <div className="text-[11px] text-ink-muted">{device.model?.modelName || '-'}</div>
                    </td>
                    <td className="px-4 py-3 font-mono text-ink-secondary">
                      {device.serialNumber || '-'}
                    </td>
                    <td className="px-4 py-3 font-mono">
                      {device.managementIp ? (
                        <span className="bg-accent-soft text-accent-ink px-2 py-0.5 rounded text-[11px] font-medium">
                          {device.managementIp}
                        </span>
                      ) : (
                        <span className="text-ink-muted italic">Belum diatur</span>
                      )}
                    </td>
                    <td className="px-4 py-3">{getStatusBadge(device.inventoryStatus)}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Link
                          href={`/devices/${device.id}`}
                          className="rounded-md border border-line bg-canvas px-2.5 py-1 text-[11px] font-medium text-ink hover:bg-subtle"
                        >
                          Detail
                        </Link>
                        {canArchive && !device.archivedAt && (
                          <button
                            type="button"
                            onClick={() => {
                              setArchiveTarget(device);
                              setArchiveReason('');
                            }}
                            className="rounded-md border border-rose-200 dark:border-rose-900/60 bg-rose-50 dark:bg-rose-950/60 px-2.5 py-1 text-[11px] font-medium text-rose-800 dark:text-rose-200 hover:bg-rose-100 dark:hover:bg-rose-900/60"
                          >
                            Arsip
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 text-xs text-ink-secondary">
            <span className="tabular-nums-data">
              Menampilkan {devices.length} dari {totalDevices} perangkat
            </span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="min-h-[36px] rounded-md border border-line bg-surface px-3 py-1 font-medium text-ink hover:bg-subtle disabled:opacity-40"
              >
                Sebelumnya
              </button>
              <span className="px-2 font-medium tabular-nums-data">
                Halaman {page} dari {totalPages}
              </span>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="min-h-[36px] rounded-md border border-line bg-surface px-3 py-1 font-medium text-ink hover:bg-subtle disabled:opacity-40"
              >
                Selanjutnya
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }
}
