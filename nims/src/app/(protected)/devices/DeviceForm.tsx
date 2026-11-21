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
  deviceCode?: string;
  hostname?: string;
  categoryId?: number;
  vendorId?: number;
  modelId?: number | null;
  siteId?: number;
  roomId?: number | null;
  rackId?: number | null;
  serialNumber?: string | null;
  networkRole?: string | null;
  inventoryStatus?: string;
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

  const availableModels = formData.vendorId
    ? models.filter((m) => m.vendorId === parseInt(formData.vendorId, 10))
    : models;

  const availableRooms = formData.siteId
    ? rooms.filter((r) => r.siteId === parseInt(formData.siteId, 10))
    : rooms;

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
    <form onSubmit={handleSubmit} className="animate-enter max-w-4xl space-y-6">
      {generalError && (
        <div
          role="alert"
          className="rounded-xl border border-rose-200 dark:border-rose-900/60 bg-rose-50 dark:bg-rose-950/60 p-4 text-xs text-rose-800 dark:text-rose-200"
        >
          <p className="font-semibold">Gagal Menyimpan:</p>
          <p>{generalError}</p>
        </div>
      )}

      {/* Bagian 1 */}
      <div className="rounded-xl border border-line bg-surface p-5 shadow-xs space-y-4">
        <h2 className="text-sm font-bold text-ink border-b border-line pb-2.5">
          Identitas Perangkat Jaringan
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="dev-code" className="block text-xs font-semibold text-ink-secondary">
              Kode Perangkat / Asset Tag <span className="text-rose-600">*</span>
            </label>
            <input
              id="dev-code"
              type="text"
              required
              placeholder="Contoh: RTR-POPBDG-001"
              value={formData.deviceCode}
              onChange={(e) => setFormData({ ...formData, deviceCode: e.target.value })}
              className={`mt-1 min-h-[38px] block w-full rounded-lg border px-3 py-1.5 text-xs text-ink placeholder-ink-muted uppercase font-mono focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20 ${
                fieldErrors.deviceCode
                  ? 'border-rose-500 bg-rose-50 dark:bg-rose-950/40'
                  : 'border-line bg-canvas'
              }`}
            />
            {fieldErrors.deviceCode && (
              <p className="mt-1 text-[11px] text-rose-600 dark:text-rose-300">
                {fieldErrors.deviceCode[0]}
              </p>
            )}
          </div>

          <div>
            <label htmlFor="dev-hostname" className="block text-xs font-semibold text-ink-secondary">
              Hostname <span className="text-rose-600">*</span>
            </label>
            <input
              id="dev-hostname"
              type="text"
              required
              placeholder="Contoh: core-rtr-dago.net"
              value={formData.hostname}
              onChange={(e) => setFormData({ ...formData, hostname: e.target.value })}
              className={`mt-1 min-h-[38px] block w-full rounded-lg border px-3 py-1.5 text-xs text-ink placeholder-ink-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20 ${
                fieldErrors.hostname
                  ? 'border-rose-500 bg-rose-50 dark:bg-rose-950/40'
                  : 'border-line bg-canvas'
              }`}
            />
            {fieldErrors.hostname && (
              <p className="mt-1 text-[11px] text-rose-600 dark:text-rose-300">
                {fieldErrors.hostname[0]}
              </p>
            )}
          </div>

          <div>
            <label htmlFor="dev-cat" className="block text-xs font-semibold text-ink-secondary">
              Kategori Perangkat <span className="text-rose-600">*</span>
            </label>
            <select
              id="dev-cat"
              required
              value={formData.categoryId}
              onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
              className="mt-1 min-h-[38px] block w-full rounded-lg border border-line bg-canvas px-3 py-1.5 text-xs text-ink focus:border-accent focus:outline-none"
            >
              <option value="">Pilih Kategori</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            {fieldErrors.categoryId && (
              <p className="mt-1 text-[11px] text-rose-600 dark:text-rose-300">
                {fieldErrors.categoryId[0]}
              </p>
            )}
          </div>

          <div>
            <label htmlFor="dev-role" className="block text-xs font-semibold text-ink-secondary">
              Role Jaringan (Network Role)
            </label>
            <select
              id="dev-role"
              value={formData.networkRole}
              onChange={(e) => setFormData({ ...formData, networkRole: e.target.value })}
              className="mt-1 min-h-[38px] block w-full rounded-lg border border-line bg-canvas px-3 py-1.5 text-xs text-ink focus:border-accent focus:outline-none"
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

      {/* Bagian 2 */}
      <div className="rounded-xl border border-line bg-surface p-5 shadow-xs space-y-4">
        <h2 className="text-sm font-bold text-ink border-b border-line pb-2.5">
          Spesifikasi Hardware & Model
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <label htmlFor="dev-vendor" className="block text-xs font-semibold text-ink-secondary">
              Vendor <span className="text-rose-600">*</span>
            </label>
            <select
              id="dev-vendor"
              required
              value={formData.vendorId}
              onChange={(e) => setFormData({ ...formData, vendorId: e.target.value, modelId: '' })}
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
            <label htmlFor="dev-model" className="block text-xs font-semibold text-ink-secondary">
              Model Perangkat
            </label>
            <select
              id="dev-model"
              value={formData.modelId}
              onChange={(e) => setFormData({ ...formData, modelId: e.target.value })}
              className="mt-1 min-h-[38px] block w-full rounded-lg border border-line bg-canvas px-3 py-1.5 text-xs text-ink focus:border-accent focus:outline-none"
            >
              <option value="">Pilih Model (Opsional)</option>
              {availableModels.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} ({m.modelCode})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="dev-serial" className="block text-xs font-semibold text-ink-secondary">
              Serial Number
            </label>
            <input
              id="dev-serial"
              type="text"
              placeholder="Contoh: SN-829102-X"
              value={formData.serialNumber}
              onChange={(e) => setFormData({ ...formData, serialNumber: e.target.value })}
              className="mt-1 min-h-[38px] block w-full rounded-lg border border-line bg-canvas px-3 py-1.5 text-xs font-mono text-ink placeholder-ink-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
            />
          </div>
        </div>
      </div>

      {/* Bagian 3 */}
      <div className="rounded-xl border border-line bg-surface p-5 shadow-xs space-y-4">
        <h2 className="text-sm font-bold text-ink border-b border-line pb-2.5">
          Lokasi & Penempatan Fisik
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <label htmlFor="dev-site" className="block text-xs font-semibold text-ink-secondary">
              Site / Lokasi <span className="text-rose-600">*</span>
            </label>
            <select
              id="dev-site"
              required
              value={formData.siteId}
              onChange={(e) =>
                setFormData({ ...formData, siteId: e.target.value, roomId: '', rackId: '' })
              }
              className="mt-1 min-h-[38px] block w-full rounded-lg border border-line bg-canvas px-3 py-1.5 text-xs text-ink focus:border-accent focus:outline-none"
            >
              <option value="">Pilih Site</option>
              {sites.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.siteCode} - {s.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="dev-room" className="block text-xs font-semibold text-ink-secondary">
              Ruangan
            </label>
            <select
              id="dev-room"
              value={formData.roomId}
              onChange={(e) => setFormData({ ...formData, roomId: e.target.value })}
              className="mt-1 min-h-[38px] block w-full rounded-lg border border-line bg-canvas px-3 py-1.5 text-xs text-ink focus:border-accent focus:outline-none"
            >
              <option value="">Pilih Ruangan (Opsional)</option>
              {availableRooms.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="dev-rack" className="block text-xs font-semibold text-ink-secondary">
              Rak
            </label>
            <select
              id="dev-rack"
              value={formData.rackId}
              onChange={(e) => setFormData({ ...formData, rackId: e.target.value })}
              className="mt-1 min-h-[38px] block w-full rounded-lg border border-line bg-canvas px-3 py-1.5 text-xs text-ink focus:border-accent focus:outline-none"
            >
              <option value="">Pilih Rak (Opsional)</option>
              {availableRacks.map((rk) => (
                <option key={rk.id} value={rk.id}>
                  {rk.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Bagian 4 */}
      <div className="rounded-xl border border-line bg-surface p-5 shadow-xs space-y-4">
        <h2 className="text-sm font-bold text-ink border-b border-line pb-2.5">
          Status Inventaris & Manajemen
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <label htmlFor="dev-status" className="block text-xs font-semibold text-ink-secondary">
              Status Inventaris <span className="text-rose-600">*</span>
            </label>
            <select
              id="dev-status"
              required
              value={formData.inventoryStatus}
              onChange={(e) => setFormData({ ...formData, inventoryStatus: e.target.value })}
              className="mt-1 min-h-[38px] block w-full rounded-lg border border-line bg-canvas px-3 py-1.5 text-xs font-medium text-ink focus:border-accent focus:outline-none"
            >
              <option value="PLANNED">PLANNED (Direncanakan)</option>
              <option value="ACTIVE">ACTIVE (Digunakan/Operasional)</option>
              <option value="MAINTENANCE">MAINTENANCE (Pemeliharaan)</option>
              <option value="RETIRED">RETIRED (Dipensiunkan)</option>
              <option value="LOST">LOST (Hilang / Tidak Ditemukan)</option>
            </select>
          </div>

          <div>
            <label htmlFor="dev-team" className="block text-xs font-semibold text-ink-secondary">
              Tim Penanggung Jawab
            </label>
            <input
              id="dev-team"
              type="text"
              placeholder="Contoh: NOC Core / Backbone"
              value={formData.ownerTeam}
              onChange={(e) => setFormData({ ...formData, ownerTeam: e.target.value })}
              className="mt-1 min-h-[38px] block w-full rounded-lg border border-line bg-canvas px-3 py-1.5 text-xs text-ink placeholder-ink-muted focus:border-accent focus:outline-none"
            />
          </div>

          <div>
            <label htmlFor="dev-installed" className="block text-xs font-semibold text-ink-secondary">
              Tanggal Instalasi
            </label>
            <input
              id="dev-installed"
              type="date"
              value={formData.installedAt}
              onChange={(e) => setFormData({ ...formData, installedAt: e.target.value })}
              className="mt-1 min-h-[38px] block w-full rounded-lg border border-line bg-canvas px-3 py-1.5 text-xs text-ink focus:border-accent focus:outline-none"
            />
          </div>

          <div>
            <label htmlFor="dev-warranty" className="block text-xs font-semibold text-ink-secondary">
              Batas Garansi
            </label>
            <input
              id="dev-warranty"
              type="date"
              value={formData.warrantyExpiry}
              onChange={(e) => setFormData({ ...formData, warrantyExpiry: e.target.value })}
              className="mt-1 min-h-[38px] block w-full rounded-lg border border-line bg-canvas px-3 py-1.5 text-xs text-ink focus:border-accent focus:outline-none"
            />
          </div>

          <div className="sm:col-span-2">
            <label htmlFor="dev-desc" className="block text-xs font-semibold text-ink-secondary">
              Deskripsi / Keterangan
            </label>
            <input
              id="dev-desc"
              type="text"
              placeholder="Keterangan singkat fungsi perangkat..."
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="mt-1 min-h-[38px] block w-full rounded-lg border border-line bg-canvas px-3 py-1.5 text-xs text-ink placeholder-ink-muted focus:border-accent focus:outline-none"
            />
          </div>

          <div className="sm:col-span-3">
            <label htmlFor="dev-notes" className="block text-xs font-semibold text-ink-secondary">
              Catatan Manajemen Internal
            </label>
            <textarea
              id="dev-notes"
              rows={2}
              placeholder="Catatan khusus pemeliharaan atau referensi dokumen pengadaan..."
              value={formData.managementNotes}
              onChange={(e) => setFormData({ ...formData, managementNotes: e.target.value })}
              className="mt-1 block w-full rounded-lg border border-line bg-canvas p-2.5 text-xs text-ink placeholder-ink-muted focus:border-accent focus:outline-none"
            />
          </div>
        </div>
      </div>

      <div className="flex items-center justify-end gap-3 pt-2">
        <Link
          href={isEdit ? `/devices/${initialData?.id}` : '/devices'}
          className="inline-flex min-h-[42px] items-center rounded-lg border border-line bg-surface px-4 py-2 text-xs font-medium text-ink-secondary hover:bg-subtle hover:text-ink"
        >
          Batal
        </Link>
        <button
          type="submit"
          disabled={loading}
          className="min-h-[42px] rounded-lg bg-accent px-5 py-2 text-xs font-semibold text-accent-fg shadow-xs hover:bg-accent-hover disabled:opacity-50"
        >
          {loading
            ? 'Menyimpan Perangkat...'
            : isEdit
            ? 'Simpan Perubahan'
            : 'Tambahkan Perangkat'}
        </button>
      </div>
    </form>
  );
}
