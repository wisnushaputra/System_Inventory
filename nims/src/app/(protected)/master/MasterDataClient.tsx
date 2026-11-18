'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface SiteItem {
  id: number;
  siteCode: string;
  name: string;
  siteType: string;
  city: string | null;
  status: string;
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

  // Form states
  const [showAddSite, setShowAddSite] = useState(false);
  const [siteForm, setSiteForm] = useState({ siteCode: '', name: '', siteType: 'pop', city: '', address: '' });

  const [showAddVendor, setShowAddVendor] = useState(false);
  const [vendorForm, setVendorForm] = useState({ name: '', website: '', supportContact: '', notes: '' });

  const [showAddModel, setShowAddModel] = useState(false);
  const [modelForm, setModelForm] = useState({ modelName: '', modelCode: '', vendorId: '', categoryId: '', description: '' });

  const clearAlerts = () => {
    setErrorMsg(null);
    setSuccessMsg(null);
  };

  const handleCreateSite = async (e: React.FormEvent) => {
    e.preventDefault();
    clearAlerts();
    setLoading(true);
    try {
      const res = await fetch('/api/master/sites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(siteForm),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Gagal menambahkan site');
      setSuccessMsg(data.message);
      setShowAddSite(false);
      setSiteForm({ siteCode: '', name: '', siteType: 'pop', city: '', address: '' });
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
      setModelForm({ modelName: '', modelCode: '', vendorId: '', categoryId: '', description: '' });
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
    <div className="space-y-4">
      {/* Feedback Alerts */}
      {errorMsg && (
        <div className="rounded-md border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
          <p className="font-medium">Perhatian</p>
          <p>{errorMsg}</p>
        </div>
      )}
      {successMsg && (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
          <p>{successMsg}</p>
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-slate-200">
        <button
          onClick={() => { setTab('sites'); clearAlerts(); }}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition ${
            tab === 'sites'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          Sites / Lokasi ({sites.length})
        </button>
        <button
          onClick={() => { setTab('vendors'); clearAlerts(); }}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition ${
            tab === 'vendors'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          Vendors ({vendors.length})
        </button>
        <button
          onClick={() => { setTab('categories'); clearAlerts(); }}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition ${
            tab === 'categories'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          Kategori ({categories.length})
        </button>
        <button
          onClick={() => { setTab('models'); clearAlerts(); }}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition ${
            tab === 'models'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          Model Perangkat ({models.length})
        </button>
      </div>

      {/* SITES TAB */}
      {tab === 'sites' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-800">Daftar Lokasi & Site</h2>
            {canManageSites && (
              <button
                onClick={() => setShowAddSite(!showAddSite)}
                className="rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-indigo-500"
              >
                {showAddSite ? 'Batal' : '+ Tambah Site'}
              </button>
            )}
          </div>

          {showAddSite && (
            <form onSubmit={handleCreateSite} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm space-y-3">
              <h3 className="text-sm font-semibold text-slate-800">Form Tambah Site</h3>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600">Kode Site *</label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: POP-SBY-01"
                    value={siteForm.siteCode}
                    onChange={(e) => setSiteForm({ ...siteForm, siteCode: e.target.value })}
                    className="mt-1 block w-full rounded border border-slate-300 px-2.5 py-1.5 text-xs focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600">Nama Site *</label>
                  <input
                    type="text"
                    required
                    placeholder="POP Surabaya Barat"
                    value={siteForm.name}
                    onChange={(e) => setSiteForm({ ...siteForm, name: e.target.value })}
                    className="mt-1 block w-full rounded border border-slate-300 px-2.5 py-1.5 text-xs focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600">Tipe Site</label>
                  <select
                    value={siteForm.siteType}
                    onChange={(e) => setSiteForm({ ...siteForm, siteType: e.target.value })}
                    className="mt-1 block w-full rounded border border-slate-300 px-2.5 py-1.5 text-xs focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                  >
                    <option value="pop">POP (Point of Presence)</option>
                    <option value="dc">Data Center</option>
                    <option value="office">Office</option>
                    <option value="customer_site">Customer Site</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600">Kota</label>
                  <input
                    type="text"
                    placeholder="Surabaya"
                    value={siteForm.city}
                    onChange={(e) => setSiteForm({ ...siteForm, city: e.target.value })}
                    className="mt-1 block w-full rounded border border-slate-300 px-2.5 py-1.5 text-xs focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-slate-600">Alamat</label>
                  <input
                    type="text"
                    placeholder="Jl. Raya No. 12"
                    value={siteForm.address}
                    onChange={(e) => setSiteForm({ ...siteForm, address: e.target.value })}
                    className="mt-1 block w-full rounded border border-slate-300 px-2.5 py-1.5 text-xs focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
              </div>
              <div className="flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setShowAddSite(false)}
                  className="rounded border border-slate-300 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="rounded bg-indigo-600 px-3 py-1 text-xs font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
                >
                  {loading ? 'Menyimpan...' : 'Simpan Site'}
                </button>
              </div>
            </form>
          )}

          <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
            <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-semibold">
                <tr>
                  <th className="px-4 py-3">Kode Site</th>
                  <th className="px-4 py-3">Nama</th>
                  <th className="px-4 py-3">Tipe</th>
                  <th className="px-4 py-3">Kota</th>
                  <th className="px-4 py-3">Ruang / Rak</th>
                  <th className="px-4 py-3">Status</th>
                  {canManageSites && <th className="px-4 py-3 text-right">Aksi</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-slate-800">
                {sites.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-mono font-medium text-indigo-700">{s.siteCode}</td>
                    <td className="px-4 py-3 font-medium">{s.name}</td>
                    <td className="px-4 py-3 uppercase text-slate-500">{s.siteType}</td>
                    <td className="px-4 py-3 text-slate-600">{s.city || '-'}</td>
                    <td className="px-4 py-3 text-slate-600">
                      {s.rooms.length} ruang / {s._count.racks} rak
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-800">
                        {s.status}
                      </span>
                    </td>
                    {canManageSites && (
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => handleDeleteSite(s.id, s.name)}
                          className="text-rose-600 hover:text-rose-800 font-medium"
                        >
                          Hapus
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
                {sites.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-6 text-center text-slate-400">
                      Belum ada data site terdaftar.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* VENDORS TAB */}
      {tab === 'vendors' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-800">Daftar Vendor Perangkat</h2>
            {canManageVendors && (
              <button
                onClick={() => setShowAddVendor(!showAddVendor)}
                className="rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-indigo-500"
              >
                {showAddVendor ? 'Batal' : '+ Tambah Vendor'}
              </button>
            )}
          </div>

          {showAddVendor && (
            <form onSubmit={handleCreateVendor} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm space-y-3">
              <h3 className="text-sm font-semibold text-slate-800">Form Tambah Vendor</h3>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-medium text-slate-600">Nama Vendor *</label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: Juniper Networks"
                    value={vendorForm.name}
                    onChange={(e) => setVendorForm({ ...vendorForm, name: e.target.value })}
                    className="mt-1 block w-full rounded border border-slate-300 px-2.5 py-1.5 text-xs focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600">Website</label>
                  <input
                    type="url"
                    placeholder="https://www.juniper.net"
                    value={vendorForm.website}
                    onChange={(e) => setVendorForm({ ...vendorForm, website: e.target.value })}
                    className="mt-1 block w-full rounded border border-slate-300 px-2.5 py-1.5 text-xs focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600">Kontak Support</label>
                  <input
                    type="text"
                    placeholder="support@juniper.net"
                    value={vendorForm.supportContact}
                    onChange={(e) => setVendorForm({ ...vendorForm, supportContact: e.target.value })}
                    className="mt-1 block w-full rounded border border-slate-300 px-2.5 py-1.5 text-xs focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600">Catatan</label>
                  <input
                    type="text"
                    placeholder="Catatan tambahan"
                    value={vendorForm.notes}
                    onChange={(e) => setVendorForm({ ...vendorForm, notes: e.target.value })}
                    className="mt-1 block w-full rounded border border-slate-300 px-2.5 py-1.5 text-xs focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
              </div>
              <div className="flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setShowAddVendor(false)}
                  className="rounded border border-slate-300 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="rounded bg-indigo-600 px-3 py-1 text-xs font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
                >
                  {loading ? 'Menyimpan...' : 'Simpan Vendor'}
                </button>
              </div>
            </form>
          )}

          <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
            <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-semibold">
                <tr>
                  <th className="px-4 py-3">Nama Vendor</th>
                  <th className="px-4 py-3">Website</th>
                  <th className="px-4 py-3">Kontak Support</th>
                  <th className="px-4 py-3">Model Terdaftar</th>
                  {canManageVendors && <th className="px-4 py-3 text-right">Aksi</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-slate-800">
                {vendors.map((v) => (
                  <tr key={v.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-semibold text-slate-900">{v.name}</td>
                    <td className="px-4 py-3 text-slate-600">
                      {v.website ? (
                        <a href={v.website} target="_blank" rel="noreferrer" className="text-indigo-600 hover:underline">
                          {v.website}
                        </a>
                      ) : (
                        '-'
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{v.supportContact || '-'}</td>
                    <td className="px-4 py-3 text-slate-600">
                      <span className="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium">
                        {v._count.models} model
                      </span>
                    </td>
                    {canManageVendors && (
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => handleDeleteVendor(v.id, v.name)}
                          className="text-rose-600 hover:text-rose-800 font-medium"
                        >
                          Hapus
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* CATEGORIES TAB */}
      {tab === 'categories' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-800">Kategori Perangkat Jaringan</h2>
          </div>

          <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
            <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-semibold">
                <tr>
                  <th className="px-4 py-3">Kode Kategori</th>
                  <th className="px-4 py-3">Nama Kategori</th>
                  <th className="px-4 py-3">Deskripsi</th>
                  <th className="px-4 py-3">Model Terdaftar</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-slate-800">
                {categories.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-mono font-medium text-slate-700">{c.code}</td>
                    <td className="px-4 py-3 font-semibold text-slate-900">{c.name}</td>
                    <td className="px-4 py-3 text-slate-600">{c.description || '-'}</td>
                    <td className="px-4 py-3 text-slate-600">{c._count.models} model</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODELS TAB */}
      {tab === 'models' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-800">Model Perangkat</h2>
            {canManageVendors && (
              <button
                onClick={() => setShowAddModel(!showAddModel)}
                className="rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-indigo-500"
              >
                {showAddModel ? 'Batal' : '+ Tambah Model'}
              </button>
            )}
          </div>

          {showAddModel && (
            <form onSubmit={handleCreateModel} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm space-y-3">
              <h3 className="text-sm font-semibold text-slate-800">Form Tambah Model</h3>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-medium text-slate-600">Vendor *</label>
                  <select
                    required
                    value={modelForm.vendorId}
                    onChange={(e) => setModelForm({ ...modelForm, vendorId: e.target.value })}
                    className="mt-1 block w-full rounded border border-slate-300 px-2.5 py-1.5 text-xs focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                  >
                    <option value="">Pilih Vendor</option>
                    {vendors.map((v) => (
                      <option key={v.id} value={v.id}>{v.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600">Kategori *</label>
                  <select
                    required
                    value={modelForm.categoryId}
                    onChange={(e) => setModelForm({ ...modelForm, categoryId: e.target.value })}
                    className="mt-1 block w-full rounded border border-slate-300 px-2.5 py-1.5 text-xs focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                  >
                    <option value="">Pilih Kategori</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600">Nama Model *</label>
                  <input
                    type="text"
                    required
                    placeholder="Cloud Core Router 1036"
                    value={modelForm.modelName}
                    onChange={(e) => setModelForm({ ...modelForm, modelName: e.target.value })}
                    className="mt-1 block w-full rounded border border-slate-300 px-2.5 py-1.5 text-xs focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600">Kode Model *</label>
                  <input
                    type="text"
                    required
                    placeholder="CCR1036-8G-2S+"
                    value={modelForm.modelCode}
                    onChange={(e) => setModelForm({ ...modelForm, modelCode: e.target.value })}
                    className="mt-1 block w-full rounded border border-slate-300 px-2.5 py-1.5 text-xs focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-slate-600">Deskripsi / Spesifikasi</label>
                  <input
                    type="text"
                    placeholder="Spesifikasi port atau ringkasan hardware"
                    value={modelForm.description}
                    onChange={(e) => setModelForm({ ...modelForm, description: e.target.value })}
                    className="mt-1 block w-full rounded border border-slate-300 px-2.5 py-1.5 text-xs focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
              </div>
              <div className="flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setShowAddModel(false)}
                  className="rounded border border-slate-300 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="rounded bg-indigo-600 px-3 py-1 text-xs font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
                >
                  {loading ? 'Menyimpan...' : 'Simpan Model'}
                </button>
              </div>
            </form>
          )}

          <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
            <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-semibold">
                <tr>
                  <th className="px-4 py-3">Kode Model</th>
                  <th className="px-4 py-3">Nama Model</th>
                  <th className="px-4 py-3">Vendor</th>
                  <th className="px-4 py-3">Kategori</th>
                  <th className="px-4 py-3">Deskripsi</th>
                  {canManageVendors && <th className="px-4 py-3 text-right">Aksi</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-slate-800">
                {models.map((m) => (
                  <tr key={m.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-mono font-medium text-indigo-700">{m.modelCode}</td>
                    <td className="px-4 py-3 font-semibold text-slate-900">{m.modelName}</td>
                    <td className="px-4 py-3 text-slate-700">{m.vendor.name}</td>
                    <td className="px-4 py-3 text-slate-600">
                      <span className="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-xs">
                        {m.category.name}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-500">{m.description || '-'}</td>
                    {canManageVendors && (
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => handleDeleteModel(m.id, m.modelName)}
                          className="text-rose-600 hover:text-rose-800 font-medium"
                        >
                          Hapus
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
