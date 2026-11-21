'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { IconPlus, IconAlertTriangle, IconCheckCircle, IconTrash, IconEdit } from '@/components/Icons';
import { RoomRackManagerModal, SiteRoomRackTarget } from '@/components/RoomRackManagerModal';

interface SiteItem {
  id: number;
  siteCode: string;
  name: string;
  siteType: string;
  city: string | null;
  address: string | null;
  status: string;
  parentSiteId: number | null;
  parentSite: { id: number; siteCode: string; name: string } | null;
  rooms: { id: number; name: string; floor: string | null }[];
  _count: { racks: number };
}

interface VendorItem {
  id: number;
  name: string;
  website: string | null;
  supportContact: string | null;
  notes: string | null;
  _count: { models: number };
}

interface CategoryItem {
  id: number;
  name: string;
  code: string;
  description: string | null;
  _count: { models: number };
}

interface ModelItem {
  id: number;
  modelName: string;
  modelCode: string;
  description: string | null;
  vendor: { id: number; name: string };
  category: { id: number; name: string };
}

interface Props {
  sites: SiteItem[];
  vendors: VendorItem[];
  categories: CategoryItem[];
  models: ModelItem[];
  canManageSites: boolean;
  canManageVendors: boolean;
}

export function MasterDataClient({
  sites,
  vendors,
  categories,
  models,
  canManageSites,
  canManageVendors,
}: Props) {
  const router = useRouter();
  const [tab, setTab] = useState<'sites' | 'vendors' | 'categories' | 'models'>('sites');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [showAddSite, setShowAddSite] = useState(false);
  const [editingSiteId, setEditingSiteId] = useState<number | null>(null);
  const [roomRackSite, setRoomRackSite] = useState<SiteRoomRackTarget | null>(null);
  const [siteForm, setSiteForm] = useState({
    siteCode: '',
    name: '',
    siteType: 'pop',
    parentSiteId: '',
    city: '',
    address: '',
    status: 'active',
  });

  const [showAddVendor, setShowAddVendor] = useState(false);
  const [vendorForm, setVendorForm] = useState({
    name: '',
    website: '',
    supportContact: '',
    notes: '',
  });

  const [showAddModel, setShowAddModel] = useState(false);
  const [modelForm, setModelForm] = useState({
    modelName: '',
    modelCode: '',
    vendorId: '',
    categoryId: '',
    description: '',
  });

  const clearAlerts = () => {
    setErrorMsg(null);
    setSuccessMsg(null);
  };

  const parentPopOptions = sites.filter(
    (s) => (s.siteType === 'pop' || s.parentSiteId === null) && s.id !== editingSiteId
  );

  const resetSiteForm = () => {
    setEditingSiteId(null);
    setSiteForm({
      siteCode: '',
      name: '',
      siteType: 'pop',
      parentSiteId: '',
      city: '',
      address: '',
      status: 'active',
    });
  };

  const startEditSite = (site: SiteItem) => {
    clearAlerts();
    setEditingSiteId(site.id);
    setSiteForm({
      siteCode: site.siteCode,
      name: site.name,
      siteType: site.siteType,
      parentSiteId: site.parentSiteId ? site.parentSiteId.toString() : '',
      city: site.city || '',
      address: site.address || '',
      status: site.status || 'active',
    });
    setShowAddSite(true);
  };

  const handleSubmitSite = async (e: React.FormEvent) => {
    e.preventDefault();
    clearAlerts();
    setLoading(true);
    const isEdit = editingSiteId !== null;
    try {
      const payload = {
        siteCode: siteForm.siteCode,
        name: siteForm.name,
        siteType: siteForm.siteType,
        parentSiteId:
          siteForm.siteType === 'pop'
            ? null
            : siteForm.parentSiteId
            ? parseInt(siteForm.parentSiteId, 10)
            : null,
        city: siteForm.city.trim() || null,
        address: siteForm.address.trim() || null,
        status: siteForm.status,
      };
      const res = await fetch(
        isEdit ? `/api/master/sites/${editingSiteId}` : '/api/master/sites',
        {
          method: isEdit ? 'PUT' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Gagal menyimpan site');
      setSuccessMsg(data.message);
      setShowAddSite(false);
      resetSiteForm();
      router.refresh();
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteSite = async (id: number, name: string) => {
    if (!confirm(`Hapus site '${name}'?`)) return;
    clearAlerts();
    try {
      const res = await fetch(`/api/master/sites/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Gagal menghapus site');
      setSuccessMsg(data.message);
      router.refresh();
    } catch (err: any) {
      setErrorMsg(err.message);
    }
  };

  const handleCreateVendor = async (e: React.FormEvent) => {
    e.preventDefault();
    clearAlerts();
    setLoading(true);
    try {
      const res = await fetch('/api/master/vendors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(vendorForm),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Gagal menambahkan vendor');
      setSuccessMsg(data.message);
      setShowAddVendor(false);
      setVendorForm({ name: '', website: '', supportContact: '', notes: '' });
      router.refresh();
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteVendor = async (id: number, name: string) => {
    if (!confirm(`Hapus vendor '${name}'?`)) return;
    clearAlerts();
    try {
      const res = await fetch(`/api/master/vendors/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Gagal menghapus vendor');
      setSuccessMsg(data.message);
      router.refresh();
    } catch (err: any) {
      setErrorMsg(err.message);
    }
  };

  const handleCreateModel = async (e: React.FormEvent) => {
    e.preventDefault();
    clearAlerts();
    setLoading(true);
    try {
      const res = await fetch('/api/master/models', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          modelName: modelForm.modelName,
          modelCode: modelForm.modelCode,
          vendorId: parseInt(modelForm.vendorId, 10),
          categoryId: parseInt(modelForm.categoryId, 10),
          description: modelForm.description || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Gagal menambahkan model');
      setSuccessMsg(data.message);
      setShowAddModel(false);
      setModelForm({
        modelName: '',
        modelCode: '',
        vendorId: '',
        categoryId: '',
        description: '',
      });
      router.refresh();
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteModel = async (id: number, name: string) => {
    if (!confirm(`Hapus model '${name}'?`)) return;
    clearAlerts();
    try {
      const res = await fetch(`/api/master/models/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Gagal menghapus model');
      setSuccessMsg(data.message);
      router.refresh();
    } catch (err: any) {
      setErrorMsg(err.message);
    }
  };

  return (
    <div className="space-y-5">
      {errorMsg && (
        <div
          role="alert"
          className="flex items-start gap-2.5 rounded-xl border border-rose-200 dark:border-rose-900/60 bg-rose-50 dark:bg-rose-950/60 p-4 text-xs sm:text-sm text-rose-900 dark:text-rose-200"
        >
          <IconAlertTriangle className="h-5 w-5 shrink-0 mt-0.5 text-rose-600 dark:text-rose-400" />
          <div>
            <p className="font-semibold">Perhatian</p>
            <p>{errorMsg}</p>
          </div>
        </div>
      )}

      {successMsg && (
        <div
          role="status"
          className="flex items-center gap-2.5 rounded-xl border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50 dark:bg-emerald-950/60 p-4 text-xs sm:text-sm text-emerald-900 dark:text-emerald-200"
        >
          <IconCheckCircle className="h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
          <p className="font-medium">{successMsg}</p>
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-line overflow-x-auto">
        <div role="tablist" aria-label="Kategori Master Data" className="-mb-px flex space-x-6">
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'sites'}
            onClick={() => {
              setTab('sites');
              clearAlerts();
            }}
            className={`min-h-[42px] px-1 py-2.5 text-sm font-semibold border-b-2 whitespace-nowrap transition-colors duration-150 ${
              tab === 'sites'
                ? 'border-accent text-accent-ink'
                : 'border-transparent text-ink-secondary hover:text-ink'
            }`}
          >
            Sites / Lokasi ({sites.length})
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'vendors'}
            onClick={() => {
              setTab('vendors');
              clearAlerts();
            }}
            className={`min-h-[42px] px-1 py-2.5 text-sm font-semibold border-b-2 whitespace-nowrap transition-colors duration-150 ${
              tab === 'vendors'
                ? 'border-accent text-accent-ink'
                : 'border-transparent text-ink-secondary hover:text-ink'
            }`}
          >
            Vendors ({vendors.length})
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'categories'}
            onClick={() => {
              setTab('categories');
              clearAlerts();
            }}
            className={`min-h-[42px] px-1 py-2.5 text-sm font-semibold border-b-2 whitespace-nowrap transition-colors duration-150 ${
              tab === 'categories'
                ? 'border-accent text-accent-ink'
                : 'border-transparent text-ink-secondary hover:text-ink'
            }`}
          >
            Kategori ({categories.length})
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'models'}
            onClick={() => {
              setTab('models');
              clearAlerts();
            }}
            className={`min-h-[42px] px-1 py-2.5 text-sm font-semibold border-b-2 whitespace-nowrap transition-colors duration-150 ${
              tab === 'models'
                ? 'border-accent text-accent-ink'
                : 'border-transparent text-ink-secondary hover:text-ink'
            }`}
          >
            Model Perangkat ({models.length})
          </button>
        </div>
      </div>

      {/* SITES TAB */}
      {tab === 'sites' && (
        <div key="tab-sites" className="animate-enter space-y-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-lg font-bold text-ink">Daftar Lokasi & Site</h2>
            {canManageSites && (
              <button
                type="button"
                onClick={() => {
                  if (showAddSite) {
                    setShowAddSite(false);
                    resetSiteForm();
                  } else {
                    resetSiteForm();
                    clearAlerts();
                    setShowAddSite(true);
                  }
                }}
                className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg bg-accent px-3.5 py-1.5 text-xs font-semibold text-accent-fg shadow-xs hover:bg-accent-hover"
              >
                {!showAddSite && <IconPlus className="h-3.5 w-3.5" />}
                <span>{showAddSite ? 'Batal' : 'Tambah Site'}</span>
              </button>
            )}
          </div>

          {showAddSite && (
            <form
              onSubmit={handleSubmitSite}
              className="animate-enter rounded-xl border border-line bg-surface p-5 shadow-xs space-y-4"
            >
              <h3 className="text-sm font-bold text-ink">
                {editingSiteId ? 'Form Edit Site' : 'Form Tambah Site'}
              </h3>
              <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-3">
                <div>
                  <label htmlFor="site-code" className="block text-xs font-semibold text-ink-secondary">
                    Kode Site *
                  </label>
                  <input
                    id="site-code"
                    type="text"
                    required
                    placeholder="Contoh: POP-SBY-01 / CUST-ABC-01"
                    value={siteForm.siteCode}
                    onChange={(e) => setSiteForm({ ...siteForm, siteCode: e.target.value })}
                    className="mt-1 min-h-[38px] block w-full rounded-lg border border-line bg-canvas px-3 py-1.5 text-xs font-mono uppercase text-ink placeholder-ink-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
                  />
                </div>
                <div>
                  <label htmlFor="site-name" className="block text-xs font-semibold text-ink-secondary">
                    Nama Site *
                  </label>
                  <input
                    id="site-name"
                    type="text"
                    required
                    placeholder="POP Surabaya Barat / PT Nusantara"
                    value={siteForm.name}
                    onChange={(e) => setSiteForm({ ...siteForm, name: e.target.value })}
                    className="mt-1 min-h-[38px] block w-full rounded-lg border border-line bg-canvas px-3 py-1.5 text-xs text-ink placeholder-ink-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
                  />
                </div>
                <div>
                  <label htmlFor="site-type" className="block text-xs font-semibold text-ink-secondary">
                    Tipe Site
                  </label>
                  <select
                    id="site-type"
                    value={siteForm.siteType}
                    onChange={(e) => {
                      const nextType = e.target.value;
                      setSiteForm({
                        ...siteForm,
                        siteType: nextType,
                        parentSiteId: nextType === 'pop' ? '' : siteForm.parentSiteId,
                      });
                    }}
                    className="mt-1 min-h-[38px] block w-full rounded-lg border border-line bg-canvas px-3 py-1.5 text-xs text-ink focus:border-accent focus:outline-none"
                  >
                    <option value="pop">POP Induk (Level 1)</option>
                    <option value="customer_site">Site Pelanggan (Level 2)</option>
                    <option value="dc">Data Center</option>
                    <option value="office">Office</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                {siteForm.siteType !== 'pop' && (
                  <div className="sm:col-span-2">
                    <label
                      htmlFor="site-parent"
                      className="block text-xs font-semibold text-ink-secondary"
                    >
                      POP Induk (Level 1) {siteForm.siteType === 'customer_site' ? '*' : ''}
                    </label>
                    <select
                      id="site-parent"
                      required={siteForm.siteType === 'customer_site'}
                      value={siteForm.parentSiteId}
                      onChange={(e) => setSiteForm({ ...siteForm, parentSiteId: e.target.value })}
                      className="mt-1 min-h-[38px] block w-full rounded-lg border border-line bg-canvas px-3 py-1.5 text-xs text-ink focus:border-accent focus:outline-none"
                    >
                      <option value="">-- Pilih POP Induk (Level 1) --</option>
                      {parentPopOptions.map((pop) => (
                        <option key={pop.id} value={pop.id}>
                          {pop.siteCode} - {pop.name}
                        </option>
                      ))}
                    </select>
                    {siteForm.siteType === 'customer_site' && (
                      <p className="mt-1 text-[11px] text-ink-muted">
                        Site pelanggan akan ditempatkan sebagai Level 2 di bawah POP Induk yang dipilih.
                      </p>
                    )}
                  </div>
                )}

                <div>
                  <label htmlFor="site-status" className="block text-xs font-semibold text-ink-secondary">
                    Status
                  </label>
                  <select
                    id="site-status"
                    value={siteForm.status}
                    onChange={(e) => setSiteForm({ ...siteForm, status: e.target.value })}
                    className="mt-1 min-h-[38px] block w-full rounded-lg border border-line bg-canvas px-3 py-1.5 text-xs text-ink focus:border-accent focus:outline-none"
                  >
                    <option value="active">Aktif</option>
                    <option value="maintenance">Maintenance</option>
                    <option value="inactive">Nonaktif</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="site-city" className="block text-xs font-semibold text-ink-secondary">
                    Kota
                  </label>
                  <input
                    id="site-city"
                    type="text"
                    placeholder="Surabaya"
                    value={siteForm.city}
                    onChange={(e) => setSiteForm({ ...siteForm, city: e.target.value })}
                    className="mt-1 min-h-[38px] block w-full rounded-lg border border-line bg-canvas px-3 py-1.5 text-xs text-ink placeholder-ink-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label htmlFor="site-addr" className="block text-xs font-semibold text-ink-secondary">
                    Alamat
                  </label>
                  <input
                    id="site-addr"
                    type="text"
                    placeholder="Jl. Raya No. 12"
                    value={siteForm.address}
                    onChange={(e) => setSiteForm({ ...siteForm, address: e.target.value })}
                    className="mt-1 min-h-[38px] block w-full rounded-lg border border-line bg-canvas px-3 py-1.5 text-xs text-ink placeholder-ink-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddSite(false);
                    resetSiteForm();
                  }}
                  className="min-h-[38px] rounded-lg border border-line bg-surface px-3.5 py-1.5 text-xs font-medium text-ink-secondary hover:bg-subtle hover:text-ink"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="min-h-[38px] rounded-lg bg-accent px-4 py-1.5 text-xs font-semibold text-accent-fg hover:bg-accent-hover disabled:opacity-50"
                >
                  {loading ? 'Menyimpan...' : editingSiteId ? 'Perbarui Site' : 'Simpan Site'}
                </button>
              </div>
            </form>
          )}

          <div className="overflow-hidden rounded-xl border border-line bg-surface shadow-xs">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-line text-left text-xs">
                <thead className="bg-subtle text-ink-secondary font-semibold uppercase text-[11px]">
                  <tr>
                    <th className="px-4 py-3">Kode Site</th>
                    <th className="px-4 py-3">Nama</th>
                    <th className="px-4 py-3">Tipe</th>
                    <th className="px-4 py-3">POP Induk</th>
                    <th className="px-4 py-3">Kota</th>
                    <th className="px-4 py-3">Ruang / Rak</th>
                    <th className="px-4 py-3">Status</th>
                    {canManageSites && <th className="px-4 py-3 text-right">Tindakan</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-line text-ink">
                  {sites.map((s) => (
                    <tr key={s.id} className="transition-colors duration-100 hover:bg-subtle/60">
                      <td className="px-4 py-3 font-mono font-semibold text-accent-ink">
                        {s.siteCode}
                      </td>
                      <td className="px-4 py-3 font-medium">{s.name}</td>
                      <td className="px-4 py-3 uppercase font-mono text-ink-muted">{s.siteType}</td>
                      <td className="px-4 py-3">
                        {s.parentSite ? (
                          <span className="text-ink-secondary">
                            <span className="font-mono text-ink font-medium">{s.parentSite.siteCode}</span>
                            {' - '}
                            {s.parentSite.name}
                          </span>
                        ) : s.siteType === 'pop' ? (
                          <span className="inline-flex rounded-md bg-accent-soft px-2 py-0.5 text-[10px] font-semibold text-accent-ink">
                            Level 1 (POP Induk)
                          </span>
                        ) : (
                          <span className="text-ink-muted">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-ink-secondary">{s.city || '-'}</td>
                      <td className="px-4 py-3 text-ink-secondary tabular-nums-data">
                        <div className="flex items-center gap-2">
                          <span>
                            {s.rooms.length} ruang / {s._count.racks} rak
                          </span>
                          {canManageSites && (
                            <button
                              type="button"
                              onClick={() =>
                                setRoomRackSite({ id: s.id, siteCode: s.siteCode, name: s.name })
                              }
                              className="inline-flex min-h-[28px] items-center rounded-md border border-line bg-canvas px-2 py-0.5 text-[11px] font-semibold text-accent-ink hover:border-accent hover:bg-accent-soft whitespace-nowrap"
                            >
                              Ruang / Rak
                            </button>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex rounded-md bg-emerald-100 dark:bg-emerald-950/70 px-2 py-0.5 text-[10px] font-semibold text-emerald-900 dark:text-emerald-300">
                          {s.status}
                        </span>
                      </td>
                      {canManageSites && (
                        <td className="px-4 py-3 text-right">
                          <div className="inline-flex items-center justify-end gap-1">
                            <button
                              type="button"
                              onClick={() => startEditSite(s)}
                              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-accent-ink hover:bg-accent-soft font-medium"
                            >
                              <IconEdit className="h-3.5 w-3.5" />
                              <span>Edit</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteSite(s.id, s.name)}
                              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-rose-700 dark:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-950/60 font-medium"
                            >
                              <IconTrash className="h-3.5 w-3.5" />
                              <span>Hapus</span>
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                  {sites.length === 0 && (
                    <tr>
                      <td colSpan={8} className="px-4 py-8 text-center text-ink-secondary">
                        Belum ada data site terdaftar.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* VENDORS TAB */}
      {tab === 'vendors' && (
        <div key="tab-vendors" className="animate-enter space-y-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-lg font-bold text-ink">Daftar Vendor Perangkat</h2>
            {canManageVendors && (
              <button
                type="button"
                onClick={() => setShowAddVendor(!showAddVendor)}
                className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg bg-accent px-3.5 py-1.5 text-xs font-semibold text-accent-fg shadow-xs hover:bg-accent-hover"
              >
                {!showAddVendor && <IconPlus className="h-3.5 w-3.5" />}
                <span>{showAddVendor ? 'Batal' : 'Tambah Vendor'}</span>
              </button>
            )}
          </div>

          {showAddVendor && (
            <form
              onSubmit={handleCreateVendor}
              className="animate-enter rounded-xl border border-line bg-surface p-5 shadow-xs space-y-4"
            >
              <h3 className="text-sm font-bold text-ink">Form Tambah Vendor</h3>
              <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
                <div>
                  <label htmlFor="vendor-name" className="block text-xs font-semibold text-ink-secondary">
                    Nama Vendor *
                  </label>
                  <input
                    id="vendor-name"
                    type="text"
                    required
                    placeholder="Contoh: Juniper Networks"
                    value={vendorForm.name}
                    onChange={(e) => setVendorForm({ ...vendorForm, name: e.target.value })}
                    className="mt-1 min-h-[38px] block w-full rounded-lg border border-line bg-canvas px-3 py-1.5 text-xs text-ink placeholder-ink-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
                  />
                </div>
                <div>
                  <label htmlFor="vendor-web" className="block text-xs font-semibold text-ink-secondary">
                    Website
                  </label>
                  <input
                    id="vendor-web"
                    type="url"
                    placeholder="https://www.juniper.net"
                    value={vendorForm.website}
                    onChange={(e) => setVendorForm({ ...vendorForm, website: e.target.value })}
                    className="mt-1 min-h-[38px] block w-full rounded-lg border border-line bg-canvas px-3 py-1.5 text-xs text-ink placeholder-ink-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
                  />
                </div>
                <div>
                  <label htmlFor="vendor-contact" className="block text-xs font-semibold text-ink-secondary">
                    Kontak Support
                  </label>
                  <input
                    id="vendor-contact"
                    type="text"
                    placeholder="support@juniper.net"
                    value={vendorForm.supportContact}
                    onChange={(e) =>
                      setVendorForm({ ...vendorForm, supportContact: e.target.value })
                    }
                    className="mt-1 min-h-[38px] block w-full rounded-lg border border-line bg-canvas px-3 py-1.5 text-xs text-ink placeholder-ink-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
                  />
                </div>
                <div>
                  <label htmlFor="vendor-notes" className="block text-xs font-semibold text-ink-secondary">
                    Catatan
                  </label>
                  <input
                    id="vendor-notes"
                    type="text"
                    placeholder="Catatan tambahan"
                    value={vendorForm.notes}
                    onChange={(e) => setVendorForm({ ...vendorForm, notes: e.target.value })}
                    className="mt-1 min-h-[38px] block w-full rounded-lg border border-line bg-canvas px-3 py-1.5 text-xs text-ink placeholder-ink-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowAddVendor(false)}
                  className="min-h-[38px] rounded-lg border border-line bg-surface px-3.5 py-1.5 text-xs font-medium text-ink-secondary hover:bg-subtle hover:text-ink"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="min-h-[38px] rounded-lg bg-accent px-4 py-1.5 text-xs font-semibold text-accent-fg hover:bg-accent-hover disabled:opacity-50"
                >
                  {loading ? 'Menyimpan...' : 'Simpan Vendor'}
                </button>
              </div>
            </form>
          )}

          <div className="overflow-hidden rounded-xl border border-line bg-surface shadow-xs">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-line text-left text-xs">
                <thead className="bg-subtle text-ink-secondary font-semibold uppercase text-[11px]">
                  <tr>
                    <th className="px-4 py-3">Nama Vendor</th>
                    <th className="px-4 py-3">Website</th>
                    <th className="px-4 py-3">Kontak Support</th>
                    <th className="px-4 py-3">Model Terdaftar</th>
                    {canManageVendors && <th className="px-4 py-3 text-right">Tindakan</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-line text-ink">
                  {vendors.map((v) => (
                    <tr key={v.id} className="transition-colors duration-100 hover:bg-subtle/60">
                      <td className="px-4 py-3 font-semibold text-ink">{v.name}</td>
                      <td className="px-4 py-3 text-ink-secondary">
                        {v.website ? (
                          <a
                            href={v.website}
                            target="_blank"
                            rel="noreferrer"
                            className="text-accent-ink hover:underline"
                          >
                            {v.website}
                          </a>
                        ) : (
                          '-'
                        )}
                      </td>
                      <td className="px-4 py-3 text-ink-secondary">{v.supportContact || '-'}</td>
                      <td className="px-4 py-3">
                        <span className="inline-flex rounded-md bg-subtle px-2 py-0.5 text-xs font-mono font-medium text-ink tabular-nums-data">
                          {v._count.models} model
                        </span>
                      </td>
                      {canManageVendors && (
                        <td className="px-4 py-3 text-right">
                          <button
                            type="button"
                            onClick={() => handleDeleteVendor(v.id, v.name)}
                            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-rose-700 dark:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-950/60 font-medium"
                          >
                            <IconTrash className="h-3.5 w-3.5" />
                            <span>Hapus</span>
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* CATEGORIES TAB */}
      {tab === 'categories' && (
        <div key="tab-categories" className="animate-enter space-y-4">
          <h2 className="text-lg font-bold text-ink">Kategori Perangkat Jaringan</h2>

          <div className="overflow-hidden rounded-xl border border-line bg-surface shadow-xs">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-line text-left text-xs">
                <thead className="bg-subtle text-ink-secondary font-semibold uppercase text-[11px]">
                  <tr>
                    <th className="px-4 py-3">Kode Kategori</th>
                    <th className="px-4 py-3">Nama Kategori</th>
                    <th className="px-4 py-3">Deskripsi</th>
                    <th className="px-4 py-3">Model Terdaftar</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line text-ink">
                  {categories.map((c) => (
                    <tr key={c.id} className="transition-colors duration-100 hover:bg-subtle/60">
                      <td className="px-4 py-3 font-mono font-medium text-ink-secondary">
                        {c.code}
                      </td>
                      <td className="px-4 py-3 font-semibold text-ink">{c.name}</td>
                      <td className="px-4 py-3 text-ink-secondary">{c.description || '-'}</td>
                      <td className="px-4 py-3 font-mono text-ink-secondary tabular-nums-data">
                        {c._count.models} model
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* MODELS TAB */}
      {tab === 'models' && (
        <div key="tab-models" className="animate-enter space-y-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-lg font-bold text-ink">Model Perangkat</h2>
            {canManageVendors && (
              <button
                type="button"
                onClick={() => setShowAddModel(!showAddModel)}
                className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg bg-accent px-3.5 py-1.5 text-xs font-semibold text-accent-fg shadow-xs hover:bg-accent-hover"
              >
                {!showAddModel && <IconPlus className="h-3.5 w-3.5" />}
                <span>{showAddModel ? 'Batal' : 'Tambah Model'}</span>
              </button>
            )}
          </div>

          {showAddModel && (
            <form
              onSubmit={handleCreateModel}
              className="animate-enter rounded-xl border border-line bg-surface p-5 shadow-xs space-y-4"
            >
              <h3 className="text-sm font-bold text-ink">Form Tambah Model</h3>
              <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
                <div>
                  <label htmlFor="model-vendor" className="block text-xs font-semibold text-ink-secondary">
                    Vendor *
                  </label>
                  <select
                    id="model-vendor"
                    required
                    value={modelForm.vendorId}
                    onChange={(e) => setModelForm({ ...modelForm, vendorId: e.target.value })}
                    className="mt-1 min-h-[38px] block w-full rounded-lg border border-line bg-canvas px-3 py-1.5 text-xs text-ink focus:border-accent focus:outline-none"
                  >
                    <option value="">Pilih Vendor</option>
                    {vendors.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="model-cat" className="block text-xs font-semibold text-ink-secondary">
                    Kategori *
                  </label>
                  <select
                    id="model-cat"
                    required
                    value={modelForm.categoryId}
                    onChange={(e) => setModelForm({ ...modelForm, categoryId: e.target.value })}
                    className="mt-1 min-h-[38px] block w-full rounded-lg border border-line bg-canvas px-3 py-1.5 text-xs text-ink focus:border-accent focus:outline-none"
                  >
                    <option value="">Pilih Kategori</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="model-name" className="block text-xs font-semibold text-ink-secondary">
                    Nama Model *
                  </label>
                  <input
                    id="model-name"
                    type="text"
                    required
                    placeholder="Cloud Core Router 1036"
                    value={modelForm.modelName}
                    onChange={(e) => setModelForm({ ...modelForm, modelName: e.target.value })}
                    className="mt-1 min-h-[38px] block w-full rounded-lg border border-line bg-canvas px-3 py-1.5 text-xs text-ink placeholder-ink-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
                  />
                </div>
                <div>
                  <label htmlFor="model-code" className="block text-xs font-semibold text-ink-secondary">
                    Kode Model *
                  </label>
                  <input
                    id="model-code"
                    type="text"
                    required
                    placeholder="CCR1036-8G-2S+"
                    value={modelForm.modelCode}
                    onChange={(e) => setModelForm({ ...modelForm, modelCode: e.target.value })}
                    className="mt-1 min-h-[38px] block w-full rounded-lg border border-line bg-canvas px-3 py-1.5 text-xs text-ink placeholder-ink-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label htmlFor="model-desc" className="block text-xs font-semibold text-ink-secondary">
                    Deskripsi / Spesifikasi
                  </label>
                  <input
                    id="model-desc"
                    type="text"
                    placeholder="Spesifikasi port atau ringkasan hardware"
                    value={modelForm.description}
                    onChange={(e) => setModelForm({ ...modelForm, description: e.target.value })}
                    className="mt-1 min-h-[38px] block w-full rounded-lg border border-line bg-canvas px-3 py-1.5 text-xs text-ink placeholder-ink-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowAddModel(false)}
                  className="min-h-[38px] rounded-lg border border-line bg-surface px-3.5 py-1.5 text-xs font-medium text-ink-secondary hover:bg-subtle hover:text-ink"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="min-h-[38px] rounded-lg bg-accent px-4 py-1.5 text-xs font-semibold text-accent-fg hover:bg-accent-hover disabled:opacity-50"
                >
                  {loading ? 'Menyimpan...' : 'Simpan Model'}
                </button>
              </div>
            </form>
          )}

          <div className="overflow-hidden rounded-xl border border-line bg-surface shadow-xs">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-line text-left text-xs">
                <thead className="bg-subtle text-ink-secondary font-semibold uppercase text-[11px]">
                  <tr>
                    <th className="px-4 py-3">Kode Model</th>
                    <th className="px-4 py-3">Nama Model</th>
                    <th className="px-4 py-3">Vendor</th>
                    <th className="px-4 py-3">Kategori</th>
                    <th className="px-4 py-3">Deskripsi</th>
                    {canManageVendors && <th className="px-4 py-3 text-right">Tindakan</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-line text-ink">
                  {models.map((m) => (
                    <tr key={m.id} className="transition-colors duration-100 hover:bg-subtle/60">
                      <td className="px-4 py-3 font-mono font-semibold text-accent-ink">
                        {m.modelCode}
                      </td>
                      <td className="px-4 py-3 font-semibold text-ink">{m.modelName}</td>
                      <td className="px-4 py-3 text-ink-secondary">{m.vendor.name}</td>
                      <td className="px-4 py-3">
                        <span className="inline-flex rounded-md bg-subtle px-2 py-0.5 text-xs text-ink">
                          {m.category.name}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-ink-secondary">{m.description || '-'}</td>
                      {canManageVendors && (
                        <td className="px-4 py-3 text-right">
                          <button
                            type="button"
                            onClick={() => handleDeleteModel(m.id, m.modelName)}
                            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-rose-700 dark:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-950/60 font-medium"
                          >
                            <IconTrash className="h-3.5 w-3.5" />
                            <span>Hapus</span>
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      <RoomRackManagerModal
        open={Boolean(roomRackSite)}
        site={roomRackSite}
        onClose={() => setRoomRackSite(null)}
        onChanged={() => router.refresh()}
      />
    </div>
  );
}
