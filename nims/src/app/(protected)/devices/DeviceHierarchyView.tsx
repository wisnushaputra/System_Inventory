'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';

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
  canExport = false,
  categories,
  vendors,
  initialPopId = null,
  initialSiteId = null,
}: Props) {
  // Navigation hierarchy state
  const [selectedPop, setSelectedPop] = useState<PopItem | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerSiteItem | null>(null);

  // Level 1: POPs state
  const [pops, setPops] = useState<PopItem[]>([]);
  const [loadingPops, setLoadingPops] = useState(true);
  const [popSearch, setPopSearch] = useState('');

  // Level 2: Customers under selected POP state
  const [customerSites, setCustomerSites] = useState<CustomerSiteItem[]>([]);
  const [loadingCustomers, setLoadingCustomers] = useState(false);
  const [customerSearch, setCustomerSearch] = useState('');
  const [activeTabLevel2, setActiveTabLevel2] = useState<'customers' | 'pop_internal'>('customers');

  // Level 3: Devices under selected Site state
  const [devices, setDevices] = useState<DeviceItem[]>([]);
  const [loadingDevices, setLoadingDevices] = useState(false);
  const [deviceSearch, setDeviceSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterVendor, setFilterVendor] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalDevices, setTotalDevices] = useState(0);

  // Archive modal state
  const [archiveTarget, setArchiveTarget] = useState<DeviceItem | null>(null);
  const [archiveReason, setArchiveReason] = useState('');
  const [archiveLoading, setArchiveLoading] = useState(false);
  const [archiveError, setArchiveError] = useState<string | null>(null);

  // Error notifications
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // 1. Fetch POPs list (Level 1)
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

  // 2. Fetch Customers under selected POP (Level 2)
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

  // 3. Fetch Devices for active customer / internal POP (Level 3)
  const activeTargetSiteId = selectedCustomer ? selectedCustomer.id : activeTabLevel2 === 'pop_internal' && selectedPop ? selectedPop.id : null;

  const fetchDevices = useCallback(async (siteId: number) => {
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
  }, [page, deviceSearch, filterCategory, filterVendor, filterStatus]);

  useEffect(() => {
    if (activeTargetSiteId) {
      fetchDevices(activeTargetSiteId);
    }
  }, [activeTargetSiteId, fetchDevices]);

  // Handle Archive device
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
        return <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700 ring-1 ring-inset ring-emerald-600/20">Aktif</span>;
      case 'MAINTENANCE':
        return <span className="inline-flex items-center rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-700 ring-1 ring-inset ring-amber-600/20">Perawatan</span>;
      case 'PLANNED':
        return <span className="inline-flex items-center rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700 ring-1 ring-inset ring-blue-600/20">Direncanakan</span>;
      case 'RETIRED':
        return <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600 ring-1 ring-inset ring-slate-500/20">Pensiun</span>;
      case 'LOST':
        return <span className="inline-flex items-center rounded-full bg-rose-50 px-2.5 py-0.5 text-xs font-medium text-rose-700 ring-1 ring-inset ring-rose-600/20">Hilang</span>;
      default:
        return <span className="inline-flex items-center rounded-full bg-slate-50 px-2.5 py-0.5 text-xs font-medium text-slate-600">{status}</span>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Breadcrumb Navigation Hierarchy */}
      <nav aria-label="Hierarki Lokasi" className="flex items-center flex-wrap gap-2 text-sm bg-slate-50 p-3 rounded-lg border border-slate-200">
        <button
          type="button"
          onClick={() => {
            setSelectedPop(null);
            setSelectedCustomer(null);
            setActiveTabLevel2('customers');
          }}
          className={`font-medium transition-colors ${
            !selectedPop
              ? 'text-indigo-600 font-semibold'
              : 'text-slate-600 hover:text-indigo-600'
          }`}
        >
          🏢 Semua POP
        </button>

        {selectedPop && (
          <>
            <span className="text-slate-400 font-bold">/</span>
            <button
              type="button"
              onClick={() => {
                setSelectedCustomer(null);
                setActiveTabLevel2('customers');
              }}
              className={`font-medium transition-colors ${
                selectedPop && !selectedCustomer
                  ? 'text-indigo-600 font-semibold'
                  : 'text-slate-600 hover:text-indigo-600'
              }`}
            >
              📍 {selectedPop.name} ({selectedPop.siteCode})
            </button>
          </>
        )}

        {selectedCustomer && (
          <>
            <span className="text-slate-400 font-bold">/</span>
            <span className="text-indigo-900 font-semibold bg-indigo-100/70 px-2 py-0.5 rounded text-xs">
              👥 {selectedCustomer.name} ({selectedCustomer.siteCode})
            </span>
          </>
        )}

        {selectedPop && activeTabLevel2 === 'pop_internal' && !selectedCustomer && (
          <>
            <span className="text-slate-400 font-bold">/</span>
            <span className="text-indigo-900 font-semibold bg-indigo-100/70 px-2 py-0.5 rounded text-xs">
              ⚙️ Perangkat Internal POP
            </span>
          </>
        )}
      </nav>

      {errorMsg && (
        <div className="rounded-md bg-rose-50 p-4 border border-rose-200 text-sm text-rose-700">
          {errorMsg}
        </div>
      )}

      {/* LEVEL 1: DAFTAR POP (POINT OF PRESENCE) */}
      {!selectedPop && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Pilih Point of Presence (POP)</h2>
              <p className="text-xs text-slate-500">
                Pilih lokasi POP utama untuk melihat daftar pelanggan dan perangkat yang terpasang di area tersebut.
              </p>
            </div>
            <div className="w-full sm:w-72">
              <input
                type="text"
                placeholder="Cari nama POP, kode, atau kota..."
                value={popSearch}
                onChange={(e) => setPopSearch(e.target.value)}
                className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
          </div>

          {loadingPops ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3].map((n) => (
                <div key={n} className="h-44 rounded-xl border border-slate-200 bg-slate-50 animate-pulse p-5" />
              ))}
            </div>
          ) : pops.length === 0 ? (
            <div className="text-center py-12 rounded-xl border border-dashed border-slate-300 bg-white p-8">
              <span className="text-4xl">🏢</span>
              <h3 className="mt-2 text-sm font-semibold text-slate-900">Tidak ada POP ditemukan</h3>
              <p className="mt-1 text-xs text-slate-500">
                {popSearch ? 'Tidak ada POP yang cocok dengan kata kunci pencarian.' : 'Belum ada data master POP terdaftar di sistem.'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {pops.map((pop) => (
                <div
                  key={pop.id}
                  onClick={() => {
                    setSelectedPop(pop);
                    setSelectedCustomer(null);
                    setCustomerSearch('');
                  }}
                  className="group relative cursor-pointer rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-all hover:border-indigo-400 hover:shadow-md hover:ring-2 hover:ring-indigo-100 flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="inline-flex items-center rounded-md bg-indigo-50 px-2 py-1 text-xs font-semibold text-indigo-700 ring-1 ring-inset ring-indigo-700/10">
                        {pop.siteCode}
                      </span>
                      <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700 ring-1 ring-inset ring-emerald-600/20">
                        {pop.status === 'active' ? 'Aktif' : pop.status}
                      </span>
                    </div>

                    <h3 className="text-base font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">
                      {pop.name}
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      📍 {pop.city || 'Kota belum diatur'}{pop.province ? `, ${pop.province}` : ''}
                    </p>
                    {pop.address && (
                      <p className="text-xs text-slate-400 mt-1 line-clamp-1">
                        {pop.address}
                      </p>
                    )}
                  </div>

                  <div className="mt-5 pt-4 border-t border-slate-100">
                    <div className="grid grid-cols-2 gap-2 text-center mb-3">
                      <div className="rounded-lg bg-slate-50 p-2">
                        <span className="block text-xs text-slate-400 font-medium">Customer Sites</span>
                        <span className="block text-sm font-bold text-slate-800">👥 {pop.customerSiteCount}</span>
                      </div>
                      <div className="rounded-lg bg-indigo-50/50 p-2">
                        <span className="block text-xs text-indigo-500 font-medium">Total Perangkat</span>
                        <span className="block text-sm font-bold text-indigo-900">🖥️ {pop.totalDeviceCount}</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-xs font-semibold text-indigo-600 group-hover:text-indigo-800">
                      <span>Buka Daftar Customer</span>
                      <span className="transform transition-transform group-hover:translate-x-1">→</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* LEVEL 2: DAFTAR CUSTOMER SITE DI BAWAH POP TERPILIH */}
      {selectedPop && !selectedCustomer && (
        <div className="space-y-5">
          {/* POP Header Info Card */}
          <div className="rounded-xl border border-indigo-100 bg-gradient-to-r from-indigo-50/60 to-white p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-indigo-700 bg-indigo-100/80 px-2 py-0.5 rounded">
                  Point of Presence (POP Induk)
                </span>
                <span className="text-xs font-mono text-slate-500">[{selectedPop.siteCode}]</span>
              </div>
              <h2 className="text-xl font-bold text-slate-900 mt-1">{selectedPop.name}</h2>
              <p className="text-xs text-slate-600 mt-0.5">
                📍 {selectedPop.address ? `${selectedPop.address}, ` : ''}{selectedPop.city || 'Kota'}{selectedPop.province ? `, ${selectedPop.province}` : ''}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setSelectedPop(null)}
                className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 shadow-sm"
              >
                ← Ganti POP
              </button>
              {canCreate && (
                <Link
                  href={`/devices/new?siteId=${selectedPop.id}`}
                  className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-500 shadow-sm"
                >
                  + Tambah Perangkat ke POP
                </Link>
              )}
            </div>
          </div>

          {/* Sub-tabs: Customer Sites vs Perangkat Internal POP */}
          <div className="flex items-center justify-between border-b border-slate-200 pb-2 flex-wrap gap-3">
            <div className="flex space-x-2">
              <button
                type="button"
                onClick={() => setActiveTabLevel2('customers')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                  activeTabLevel2 === 'customers'
                    ? 'bg-indigo-600 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                👥 Site Pelanggan / Customer ({customerSites.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveTabLevel2('pop_internal')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                  activeTabLevel2 === 'pop_internal'
                    ? 'bg-indigo-600 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                ⚙️ Perangkat Internal POP ({selectedPop.directDeviceCount})
              </button>
            </div>

            {activeTabLevel2 === 'customers' && (
              <div className="w-full sm:w-64">
                <input
                  type="text"
                  placeholder="Cari nama pelanggan / site..."
                  value={customerSearch}
                  onChange={(e) => setCustomerSearch(e.target.value)}
                  className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
            )}
          </div>

          {/* Tab Content 1: Customer Sites Cards */}
          {activeTabLevel2 === 'customers' && (
            <div>
              {loadingCustomers ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {[1, 2, 3].map((n) => (
                    <div key={n} className="h-36 rounded-xl border border-slate-200 bg-slate-50 animate-pulse p-4" />
                  ))}
                </div>
              ) : customerSites.length === 0 ? (
                <div className="text-center py-10 rounded-xl border border-dashed border-slate-300 bg-white p-6">
                  <span className="text-3xl">👥</span>
                  <h3 className="mt-2 text-sm font-semibold text-slate-900">Belum ada Site Pelanggan</h3>
                  <p className="mt-1 text-xs text-slate-500 max-w-md mx-auto">
                    {customerSearch
                      ? 'Tidak ada site pelanggan yang cocok dengan kata kunci.'
                      : 'Belum ada site pelanggan terdaftar di bawah POP ini. Anda dapat menambahkan site baru di Master Site.'}
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {customerSites.map((cust) => (
                    <div
                      key={cust.id}
                      onClick={() => {
                        setSelectedCustomer(cust);
                        setDeviceSearch('');
                        setPage(1);
                      }}
                      className="group relative cursor-pointer rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-all hover:border-indigo-400 hover:shadow-md hover:ring-2 hover:ring-indigo-100 flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-mono text-xs font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
                            {cust.siteCode}
                          </span>
                          <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
                            {cust.status === 'active' ? 'Aktif' : cust.status}
                          </span>
                        </div>
                        <h4 className="text-base font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">
                          {cust.name}
                        </h4>
                        <p className="text-xs text-slate-500 mt-1 line-clamp-1">
                          📍 {cust.address || cust.city || 'Alamat belum diatur'}
                        </p>
                      </div>

                      <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                        <span className="text-xs font-medium text-slate-700 bg-slate-50 px-2.5 py-1 rounded-md border border-slate-200">
                          🖥️ {cust.deviceCount} Perangkat
                        </span>
                        <span className="text-xs font-semibold text-indigo-600 group-hover:text-indigo-800 flex items-center gap-1">
                          Lihat Perangkat <span>→</span>
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Tab Content 2: Perangkat Internal POP */}
          {activeTabLevel2 === 'pop_internal' && (
            <div className="space-y-4">
              <div className="bg-amber-50 border border-amber-200 p-3 rounded-lg text-xs text-amber-800 flex items-center justify-between">
                <span>
                  Menampilkan perangkat jaringan yang terpasang langsung di rak/ruang server POP ini (seperti core router, agregasi, atau OLT).
                </span>
                {canCreate && (
                  <Link
                    href={`/devices/new?siteId=${selectedPop.id}`}
                    className="font-semibold text-amber-900 underline hover:no-underline ml-2"
                  >
                    + Tambah Perangkat POP
                  </Link>
                )}
              </div>

              {/* Tampilkan tabel perangkat site internal POP */}
              {renderDeviceTable(selectedPop.id, selectedPop.name, selectedPop.siteCode)}
            </div>
          )}
        </div>
      )}

      {/* LEVEL 3: DAFTAR PERANGKAT PADA SITE PELANGGAN TERPILIH */}
      {selectedPop && selectedCustomer && (
        <div className="space-y-5">
          {/* Customer Header Info Card */}
          <div className="rounded-xl border border-indigo-100 bg-gradient-to-r from-slate-50 via-indigo-50/40 to-white p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-600 bg-slate-200/80 px-2 py-0.5 rounded">
                  Site Pelanggan
                </span>
                <span className="text-xs font-mono text-slate-500">[{selectedCustomer.siteCode}]</span>
                <span className="text-xs text-slate-400">di bawah POP {selectedPop.name}</span>
              </div>
              <h2 className="text-xl font-bold text-slate-900 mt-1">{selectedCustomer.name}</h2>
              <p className="text-xs text-slate-600 mt-0.5">
                📍 {selectedCustomer.address ? `${selectedCustomer.address}, ` : ''}{selectedCustomer.city || selectedPop.city || ''}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setSelectedCustomer(null)}
                className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 shadow-sm"
              >
                ← Ganti Customer
              </button>
              {canCreate && (
                <Link
                  href={`/devices/new?siteId=${selectedCustomer.id}`}
                  className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-500 shadow-sm"
                >
                  + Tambah Perangkat ke Site Ini
                </Link>
              )}
            </div>
          </div>

          {/* Tampilkan tabel perangkat pelanggan */}
          {renderDeviceTable(selectedCustomer.id, selectedCustomer.name, selectedCustomer.siteCode)}
        </div>
      )}

      {/* Archive Modal */}
      {archiveTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-bold text-slate-900">Arsipkan Perangkat</h3>
            <p className="mt-2 text-xs text-slate-600">
              Apakah Anda yakin ingin mengarsipkan perangkat{' '}
              <strong className="text-slate-900 font-mono">{archiveTarget.deviceCode}</strong> ({archiveTarget.hostname})?
              Perangkat terarsip tidak akan aktif dalam topologi.
            </p>

            {archiveError && (
              <div className="mt-3 rounded-md bg-rose-50 p-3 text-xs text-rose-700">
                {archiveError}
              </div>
            )}

            <form onSubmit={handleArchiveSubmit} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Alasan Pengarsipan <span className="text-rose-500">*</span>
                </label>
                <textarea
                  required
                  rows={3}
                  value={archiveReason}
                  onChange={(e) => setArchiveReason(e.target.value)}
                  placeholder="Contoh: Perangkat rusak / diganti model baru / kontrak pelanggan selesai..."
                  className="w-full rounded-md border border-slate-300 p-2 text-xs focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
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
                  className="rounded-md border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={archiveLoading || !archiveReason.trim()}
                  className="rounded-md bg-rose-600 px-3 py-2 text-xs font-semibold text-white hover:bg-rose-500 disabled:opacity-50"
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

  // Helper untuk me-render tabel perangkat
  function renderDeviceTable(siteId: number, siteName: string, siteCode: string) {
    return (
      <div className="space-y-4 bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
        {/* Search & Filter Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
          <div>
            <label className="block text-[11px] font-medium text-slate-600 mb-1">Cari Perangkat</label>
            <input
              type="text"
              placeholder="Hostname, IP, atau Serial..."
              value={deviceSearch}
              onChange={(e) => {
                setDeviceSearch(e.target.value);
                setPage(1);
              }}
              className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-[11px] font-medium text-slate-600 mb-1">Kategori</label>
            <select
              value={filterCategory}
              onChange={(e) => {
                setFilterCategory(e.target.value);
                setPage(1);
              }}
              className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-xs text-slate-800 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
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
            <label className="block text-[11px] font-medium text-slate-600 mb-1">Vendor</label>
            <select
              value={filterVendor}
              onChange={(e) => {
                setFilterVendor(e.target.value);
                setPage(1);
              }}
              className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-xs text-slate-800 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
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
            <label className="block text-[11px] font-medium text-slate-600 mb-1">Status Inventaris</label>
            <select
              value={filterStatus}
              onChange={(e) => {
                setFilterStatus(e.target.value);
                setPage(1);
              }}
              className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-xs text-slate-800 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
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

        {/* Tabel Data Perangkat */}
        <div className="overflow-x-auto rounded-lg border border-slate-200">
          <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
            <thead className="bg-slate-50 font-semibold text-slate-700">
              <tr>
                <th className="px-3.5 py-3">Kode / Hostname</th>
                <th className="px-3.5 py-3">Kategori</th>
                <th className="px-3.5 py-3">Vendor / Model</th>
                <th className="px-3.5 py-3">No. Seri</th>
                <th className="px-3.5 py-3">IP Manajemen</th>
                <th className="px-3.5 py-3">Status</th>
                <th className="px-3.5 py-3 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {loadingDevices ? (
                <tr>
                  <td colSpan={7} className="text-center py-8 text-slate-500">
                    Memuat data perangkat...
                  </td>
                </tr>
              ) : devices.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-10">
                    <p className="text-sm font-semibold text-slate-700">Belum ada perangkat di site ini</p>
                    <p className="text-xs text-slate-500 mt-1">
                      {deviceSearch || filterCategory || filterVendor || filterStatus
                        ? 'Tidak ada perangkat yang sesuai dengan filter.'
                        : `Site ${siteName} (${siteCode}) belum memiliki perangkat terdaftar.`}
                    </p>
                    {canCreate && !deviceSearch && (
                      <Link
                        href={`/devices/new?siteId=${siteId}`}
                        className="mt-3 inline-flex items-center rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-500"
                      >
                        + Tambah Perangkat Sekarang
                      </Link>
                    )}
                  </td>
                </tr>
              ) : (
                devices.map((device) => (
                  <tr key={device.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-3.5 py-3 font-medium text-slate-900">
                      <Link href={`/devices/${device.id}`} className="text-indigo-600 hover:text-indigo-900 font-semibold">
                        {device.hostname}
                      </Link>
                      <span className="block font-mono text-[11px] text-slate-500 mt-0.5">
                        {device.deviceCode}
                      </span>
                    </td>
                    <td className="px-3.5 py-3 text-slate-700">
                      {device.category?.name || '-'}
                    </td>
                    <td className="px-3.5 py-3 text-slate-700">
                      <div className="font-medium text-slate-900">{device.vendor?.name || '-'}</div>
                      <div className="text-[11px] text-slate-500">{device.model?.modelName || '-'}</div>
                    </td>
                    <td className="px-3.5 py-3 font-mono text-slate-600">
                      {device.serialNumber || '-'}
                    </td>
                    <td className="px-3.5 py-3 font-mono text-slate-700">
                      {device.managementIp ? (
                        <span className="bg-slate-100 px-2 py-0.5 rounded text-[11px]">
                          {device.managementIp}
                        </span>
                      ) : (
                        <span className="text-slate-400 italic">Belum diatur</span>
                      )}
                    </td>
                    <td className="px-3.5 py-3">
                      {getStatusBadge(device.inventoryStatus)}
                    </td>
                    <td className="px-3.5 py-3 text-right">
                      <div className="flex items-center justify-end space-x-2">
                        <Link
                          href={`/devices/${device.id}`}
                          className="rounded border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-50"
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
                            className="rounded border border-rose-200 bg-rose-50 px-2 py-1 text-[11px] font-medium text-rose-700 hover:bg-rose-100"
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

        {/* Pagination bar */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between pt-2 text-xs text-slate-600">
            <span>
              Menampilkan {devices.length} dari {totalDevices} perangkat
            </span>
            <div className="flex items-center space-x-1">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="rounded border border-slate-300 px-2 py-1 disabled:opacity-40"
              >
                Sebelumnya
              </button>
              <span className="px-2 font-medium">
                Halaman {page} dari {totalPages}
              </span>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="rounded border border-slate-300 px-2 py-1 disabled:opacity-40"
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
