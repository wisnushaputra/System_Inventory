'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface Option {
  id: number;
  name: string;
}

interface SiteOption extends Option {
  siteCode: string;
}

interface ModelOption extends Option {
  vendorId: number;
  modelCode: string;
}

interface RoomOption extends Option {
  siteId: number;
}

interface RackOption extends Option {
  siteId: number;
  roomId: number | null;
}

interface DeviceInitialData {
  id?: number;
  deviceCode: string;
  hostname: string;
  categoryId: number;
  vendorId: number;
  modelId?: number | null;
  siteId: number;
  roomId?: number | null;
  rackId?: number | null;
  serialNumber?: string | null;
  networkRole?: string | null;
  inventoryStatus: string;
  managementNotes?: string | null;
  description?: string | null;
  installedAt?: string | null;
  warrantyExpiry?: string | null;
  ownerTeam?: string | null;
  version?: number;
}

interface Props {
  initialData?: DeviceInitialData;
  categories: Option[];
  vendors: Option[];
  models: ModelOption[];
  sites: SiteOption[];
  rooms: RoomOption[];
  racks: RackOption[];
  isEdit?: boolean;
}

export function DeviceForm({
  initialData,
  categories,
  vendors,
  models,
  sites,
  rooms,
  racks,
  isEdit = false,
}: Props) {
  const router = useRouter();
  const [formData, setFormData] = useState({
    deviceCode: initialData?.deviceCode || '',
    hostname: initialData?.hostname || '',
    categoryId: initialData?.categoryId?.toString() || '',
    vendorId: initialData?.vendorId?.toString() || '',
    modelId: initialData?.modelId?.toString() || '',
    siteId: initialData?.siteId?.toString() || '',
    roomId: initialData?.roomId?.toString() || '',
    rackId: initialData?.rackId?.toString() || '',
    serialNumber: initialData?.serialNumber || '',
    networkRole: initialData?.networkRole || '',
    inventoryStatus: initialData?.inventoryStatus || 'PLANNED',
    managementNotes: initialData?.managementNotes || '',
    description: initialData?.description || '',
    installedAt: initialData?.installedAt ? initialData.installedAt.substring(0, 10) : '',
    warrantyExpiry: initialData?.warrantyExpiry ? initialData.warrantyExpiry.substring(0, 10) : '',
    ownerTeam: initialData?.ownerTeam || '',
  });

  const [loading, setLoading] = useState(false);
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

  // Filter models based on selected vendor
  const availableModels = formData.vendorId
    ? models.filter((m) => m.vendorId === parseInt(formData.vendorId, 10))
    : models;

  // Filter rooms based on selected site
  const availableRooms = formData.siteId
    ? rooms.filter((r) => r.siteId === parseInt(formData.siteId, 10))
    : rooms;

  // Filter racks based on selected site
  const availableRacks = formData.siteId
    ? racks.filter((rk) => rk.siteId === parseInt(formData.siteId, 10))
    : racks;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setGeneralError(null);
    setFieldErrors({});

    try {
      const payload: any = {
        deviceCode: formData.deviceCode.trim().toUpperCase(),
        hostname: formData.hostname.trim(),
        categoryId: parseInt(formData.categoryId, 10),
        vendorId: parseInt(formData.vendorId, 10),
        siteId: parseInt(formData.siteId, 10),
        inventoryStatus: formData.inventoryStatus,
      };

      if (formData.modelId) payload.modelId = parseInt(formData.modelId, 10);
      if (formData.roomId) payload.roomId = parseInt(formData.roomId, 10);
      if (formData.rackId) payload.rackId = parseInt(formData.rackId, 10);
      if (formData.serialNumber) payload.serialNumber = formData.serialNumber.trim();
      if (formData.networkRole) payload.networkRole = formData.networkRole;
      if (formData.managementNotes) payload.managementNotes = formData.managementNotes.trim();
      if (formData.description) payload.description = formData.description.trim();
      if (formData.ownerTeam) payload.ownerTeam = formData.ownerTeam.trim();
      if (formData.installedAt) payload.installedAt = new Date(formData.installedAt).toISOString();
      if (formData.warrantyExpiry) payload.warrantyExpiry = new Date(formData.warrantyExpiry).toISOString();
      if (isEdit && initialData?.version) payload.version = initialData.version;

      const url = isEdit ? `/api/devices/${initialData?.id}` : '/api/devices';
      const method = isEdit ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        if (data.errors) {
          setFieldErrors(data.errors);
        }
        throw new Error(data.message || 'Terjadi kesalahan saat menyimpan perangkat');
      }

      router.push(`/devices/${data.data.id}`);
      router.refresh();
    } catch (err: any) {
      setGeneralError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="max-w-4xl space-y-6">
      {generalError && (
        <div className="rounded-md border border-rose-200 bg-rose-50 p-4 text-xs text-rose-800">
          <p className="font-semibold">Gagal Menyimpan:</p>
          <p>{generalError}</p>
        </div>
      )}

      {/* Bagian 1: Identitas Pokok */}
      <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm space-y-4">
        <h2 className="text-sm font-semibold text-slate-800 border-b pb-2">Identitas Perangkat Jaringan</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-xs font-medium text-slate-700">
              Kode Perangkat / Asset Tag <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="Contoh: RTR-POPBDG-001"
              value={formData.deviceCode}
              onChange={(e) => setFormData({ ...formData, deviceCode: e.target.value })}
              className={`mt-1 block w-full rounded border px-3 py-1.5 text-xs uppercase font-mono ${
                fieldErrors.deviceCode ? 'border-rose-500 bg-rose-50' : 'border-slate-300'
              } focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500`}
            />
            {fieldErrors.deviceCode && (
              <p className="mt-1 text-[11px] text-rose-600">{fieldErrors.deviceCode[0]}</p>
            )}
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700">
              Hostname <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="Contoh: core-rtr-dago.net"
              value={formData.hostname}
              onChange={(e) => setFormData({ ...formData, hostname: e.target.value })}
              className={`mt-1 block w-full rounded border px-3 py-1.5 text-xs ${
                fieldErrors.hostname ? 'border-rose-500 bg-rose-50' : 'border-slate-300'
              } focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500`}
            />
            {fieldErrors.hostname && (
              <p className="mt-1 text-[11px] text-rose-600">{fieldErrors.hostname[0]}</p>
            )}
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700">
              Kategori Perangkat <span className="text-rose-500">*</span>
            </label>
            <select
              required
              value={formData.categoryId}
              onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
              className="mt-1 block w-full rounded border border-slate-300 px-3 py-1.5 text-xs focus:border-indigo-500"
            >
              <option value="">Pilih Kategori</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            {fieldErrors.categoryId && (
              <p className="mt-1 text-[11px] text-rose-600">{fieldErrors.categoryId[0]}</p>
            )}
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700">
              Role Jaringan (Network Role)
            </label>
            <select
              value={formData.networkRole}
              onChange={(e) => setFormData({ ...formData, networkRole: e.target.value })}
              className="mt-1 block w-full rounded border border-slate-300 px-3 py-1.5 text-xs focus:border-indigo-500"
            >
              <option value="">Pilih Role (Opsional)</option>
              <option value="core">Core</option>
              <option value="distribution">Distribution</option>
              <option value="access">Access</option>
              <option value="aggregation">Aggregation</option>
              <option value="cpe">CPE (Customer Premise)</option>
              <option value="server">Server Host</option>
              <option value="other">Other</option>
            </select>
          </div>
        </div>
      </div>

      {/* Bagian 2: Spesifikasi Hardware */}
      <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm space-y-4">
        <h2 className="text-sm font-semibold text-slate-800 border-b pb-2">Spesifikasi Hardware & Model</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <label className="block text-xs font-medium text-slate-700">
              Vendor <span className="text-rose-500">*</span>
            </label>
            <select
              required
              value={formData.vendorId}
              onChange={(e) => setFormData({ ...formData, vendorId: e.target.value, modelId: '' })}
              className="mt-1 block w-full rounded border border-slate-300 px-3 py-1.5 text-xs focus:border-indigo-500"
            >
              <option value="">Pilih Vendor</option>
              {vendors.map((v) => (
                <option key={v.id} value={v.id}>{v.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700">Model Perangkat</label>
            <select
              value={formData.modelId}
              onChange={(e) => setFormData({ ...formData, modelId: e.target.value })}
              className="mt-1 block w-full rounded border border-slate-300 px-3 py-1.5 text-xs focus:border-indigo-500"
            >
              <option value="">Pilih Model (Opsional)</option>
              {availableModels.map((m) => (
                <option key={m.id} value={m.id}>{m.name} ({m.modelCode})</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700">Serial Number</label>
            <input
              type="text"
              placeholder="Contoh: SN-829102-X"
              value={formData.serialNumber}
              onChange={(e) => setFormData({ ...formData, serialNumber: e.target.value })}
              className="mt-1 block w-full rounded border border-slate-300 px-3 py-1.5 text-xs focus:border-indigo-500"
            />
          </div>
        </div>
      </div>

      {/* Bagian 3: Lokasi & Penempatan */}
      <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm space-y-4">
        <h2 className="text-sm font-semibold text-slate-800 border-b pb-2">Lokasi & Penempatan Fisik</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <label className="block text-xs font-medium text-slate-700">
              Site / Lokasi <span className="text-rose-500">*</span>
            </label>
            <select
              required
              value={formData.siteId}
              onChange={(e) => setFormData({ ...formData, siteId: e.target.value, roomId: '', rackId: '' })}
              className="mt-1 block w-full rounded border border-slate-300 px-3 py-1.5 text-xs focus:border-indigo-500"
            >
              <option value="">Pilih Site</option>
              {sites.map((s) => (
                <option key={s.id} value={s.id}>{s.siteCode} - {s.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700">Ruangan</label>
            <select
              value={formData.roomId}
              onChange={(e) => setFormData({ ...formData, roomId: e.target.value })}
              className="mt-1 block w-full rounded border border-slate-300 px-3 py-1.5 text-xs focus:border-indigo-500"
            >
              <option value="">Pilih Ruangan (Opsional)</option>
              {availableRooms.map((r) => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700">Rak</label>
            <select
              value={formData.rackId}
              onChange={(e) => setFormData({ ...formData, rackId: e.target.value })}
              className="mt-1 block w-full rounded border border-slate-300 px-3 py-1.5 text-xs focus:border-indigo-500"
            >
              <option value="">Pilih Rak (Opsional)</option>
              {availableRacks.map((rk) => (
                <option key={rk.id} value={rk.id}>{rk.name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Bagian 4: Status Inventaris & Pemeliharaan */}
      <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm space-y-4">
        <h2 className="text-sm font-semibold text-slate-800 border-b pb-2">Status Inventaris & Manajemen</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <label className="block text-xs font-medium text-slate-700">
              Status Inventaris <span className="text-rose-500">*</span>
            </label>
            <select
              required
              value={formData.inventoryStatus}
              onChange={(e) => setFormData({ ...formData, inventoryStatus: e.target.value })}
              className="mt-1 block w-full rounded border border-slate-300 px-3 py-1.5 text-xs font-medium focus:border-indigo-500"
            >
              <option value="PLANNED">PLANNED (Direncanakan)</option>
              <option value="ACTIVE">ACTIVE (Digunakan/Operasional)</option>
              <option value="MAINTENANCE">MAINTENANCE (Pemeliharaan)</option>
              <option value="RETIRED">RETIRED (Dipensiunkan)</option>
              <option value="LOST">LOST (Hilang / Tidak Ditemukan)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700">Tim Penanggung Jawab</label>
            <input
              type="text"
              placeholder="Contoh: NOC Core / Backbone"
              value={formData.ownerTeam}
              onChange={(e) => setFormData({ ...formData, ownerTeam: e.target.value })}
              className="mt-1 block w-full rounded border border-slate-300 px-3 py-1.5 text-xs focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700">Tanggal Instalasi</label>
            <input
              type="date"
              value={formData.installedAt}
              onChange={(e) => setFormData({ ...formData, installedAt: e.target.value })}
              className="mt-1 block w-full rounded border border-slate-300 px-3 py-1.5 text-xs focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700">Batas Garansi</label>
            <input
              type="date"
              value={formData.warrantyExpiry}
              onChange={(e) => setFormData({ ...formData, warrantyExpiry: e.target.value })}
              className="mt-1 block w-full rounded border border-slate-300 px-3 py-1.5 text-xs focus:border-indigo-500"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-slate-700">Deskripsi / Keterangan</label>
            <input
              type="text"
              placeholder="Keterangan singkat fungsi perangkat..."
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="mt-1 block w-full rounded border border-slate-300 px-3 py-1.5 text-xs focus:border-indigo-500"
            />
          </div>

          <div className="sm:col-span-3">
            <label className="block text-xs font-medium text-slate-700">Catatan Manajemen Internal</label>
            <textarea
              rows={2}
              placeholder="Catatan khusus pemeliharaan atau referensi dokumen PO..."
              value={formData.managementNotes}
              onChange={(e) => setFormData({ ...formData, managementNotes: e.target.value })}
              className="mt-1 block w-full rounded border border-slate-300 p-2 text-xs focus:border-indigo-500"
            />
          </div>
        </div>
      </div>

      <div className="flex items-center justify-end space-x-3 pt-2">
        <Link
          href={isEdit ? `/devices/${initialData?.id}` : '/devices'}
          className="rounded border border-slate-300 bg-white px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
        >
          Batal
        </Link>
        <button
          type="submit"
          disabled={loading}
          className="rounded bg-indigo-600 px-5 py-2 text-xs font-semibold text-white shadow-sm hover:bg-indigo-500 disabled:opacity-50"
        >
          {loading ? 'Menyimpan Perangkat...' : isEdit ? 'Simpan Perubahan' : 'Tambahkan Perangkat'}
        </button>
      </div>
    </form>
  );
}
