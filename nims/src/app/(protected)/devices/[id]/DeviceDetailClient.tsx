'use client';

import { useState } from 'react';
import Link from 'next/link';

interface AuditItem {
  id: number;
  action: string;
  createdAt: string;
  user: { name: string; username: string } | null;
  beforeData: any;
  afterData: any;
}

interface DeviceDetailProps {
  device: {
    id: number;
    deviceCode: string;
    hostname: string;
    serialNumber: string | null;
    networkRole: string | null;
    inventoryStatus: string;
    managementNotes: string | null;
    description: string | null;
    installedAt: string | null;
    warrantyExpiry: string | null;
    ownerTeam: string | null;
    archivedAt: string | null;
    archiveReason: string | null;
    createdAt: string;
    updatedAt: string;
    category: { id: number; name: string; code: string };
    vendor: { id: number; name: string; website: string | null };
    model: { id: number; modelName: string; modelCode: string } | null;
    site: { id: number; name: string; siteCode: string; address: string | null; city: string | null };
    room: { id: number; name: string; floor: string | null } | null;
    rack: { id: number; name: string; unitCapacity: number } | null;
    creator: { id: number; name: string; username: string } | null;
    updater: { id: number; name: string; username: string } | null;
  };
  history: AuditItem[];
  canEdit: boolean;
  canArchive: boolean;
}

export function DeviceDetailClient({ device, history, canEdit, canArchive }: DeviceDetailProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'network' | 'ports' | 'connections' | 'documents' | 'history'>('overview');
  const [showArchiveModal, setShowArchiveModal] = useState(false);
  const [archiveReason, setArchiveReason] = useState('');
  const [loadingArchive, setLoadingArchive] = useState(false);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'ACTIVE':
        return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      case 'PLANNED':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'MAINTENANCE':
        return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'RETIRED':
        return 'bg-slate-200 text-slate-800 border-slate-300';
      case 'LOST':
        return 'bg-rose-100 text-rose-800 border-rose-200';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  const handleArchive = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!archiveReason.trim()) return;
    setLoadingArchive(true);
    try {
      const res = await fetch(`/api/devices/${device.id}/archive`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: archiveReason.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Gagal mengarsipkan perangkat');
      window.location.reload();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setLoadingArchive(false);
    }
  };

  const handleRestore = async () => {
    if (!confirm('Pulihkan perangkat ini ke inventaris aktif?')) return;
    try {
      const res = await fetch(`/api/devices/${device.id}/restore`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Gagal memulihkan perangkat');
      window.location.reload();
    } catch (err: any) {
      alert(err.message);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner if Archived */}
      {device.archivedAt && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-xs text-amber-900 shadow-sm flex items-center justify-between">
          <div>
            <p className="font-bold">⚠️ Perangkat Ini Sedang Diarsipkan</p>
            <p className="mt-0.5">
              Waktu arsip: {new Date(device.archivedAt).toLocaleString('id-ID')} | Alasan: <em>"{device.archiveReason}"</em>
            </p>
          </div>
          {canArchive && (
            <button
              onClick={handleRestore}
              className="rounded bg-amber-600 px-3 py-1 text-xs font-semibold text-white hover:bg-amber-500"
            >
              Pulihkan ke Aktif
            </button>
          )}
        </div>
      )}

      {/* Header Info */}
      <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">{device.hostname}</h1>
            <span className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${getStatusBadge(device.inventoryStatus)}`}>
              {device.inventoryStatus}
            </span>
          </div>
          <p className="mt-1 font-mono text-xs text-indigo-700 font-medium">
            {device.deviceCode}
          </p>
          <p className="text-xs text-slate-500 mt-0.5">
            {device.category.name} &bull; {device.vendor.name} {device.model ? `(${device.model.modelName})` : ''} &bull; Lokasi: {device.site.siteCode} - {device.site.name}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {canEdit && (
            <Link
              href={`/devices/${device.id}/edit`}
              className="rounded border border-slate-300 bg-white px-3.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              Ubah Data
            </Link>
          )}
          {canArchive && !device.archivedAt && (
            <button
              onClick={() => setShowArchiveModal(true)}
              className="rounded bg-rose-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-rose-500"
            >
              Arsipkan
            </button>
          )}
        </div>
      </div>

      {/* Tabs Header */}
      <div className="flex border-b border-slate-200 text-xs font-medium overflow-x-auto">
        <button
          onClick={() => setActiveTab('overview')}
          className={`border-b-2 px-4 py-2.5 transition whitespace-nowrap ${
            activeTab === 'overview'
              ? 'border-indigo-600 text-indigo-600 font-semibold'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          1. Overview
        </button>
        <button
          onClick={() => setActiveTab('network')}
          className={`border-b-2 px-4 py-2.5 transition whitespace-nowrap ${
            activeTab === 'network'
              ? 'border-indigo-600 text-indigo-600 font-semibold'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          2. Network (IP & Subnet)
        </button>
        <button
          onClick={() => setActiveTab('ports')}
          className={`border-b-2 px-4 py-2.5 transition whitespace-nowrap ${
            activeTab === 'ports'
              ? 'border-indigo-600 text-indigo-600 font-semibold'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          3. Ports (Interfaces)
        </button>
        <button
          onClick={() => setActiveTab('connections')}
          className={`border-b-2 px-4 py-2.5 transition whitespace-nowrap ${
            activeTab === 'connections'
              ? 'border-indigo-600 text-indigo-600 font-semibold'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          4. Connections (Relasi)
        </button>
        <button
          onClick={() => setActiveTab('documents')}
          className={`border-b-2 px-4 py-2.5 transition whitespace-nowrap ${
            activeTab === 'documents'
              ? 'border-indigo-600 text-indigo-600 font-semibold'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          5. Documents (Lampiran)
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`border-b-2 px-4 py-2.5 transition whitespace-nowrap ${
            activeTab === 'history'
              ? 'border-indigo-600 text-indigo-600 font-semibold'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          6. History (Audit Log) ({history.length})
        </button>
      </div>

      {/* TAB 1: OVERVIEW */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {/* Box 1: Identitas & Hardware */}
          <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 border-b pb-2">
              Identitas & Spesifikasi
            </h3>
            <dl className="divide-y divide-slate-100 text-xs">
              <div className="py-2 flex justify-between">
                <dt className="text-slate-500">Kode Perangkat</dt>
                <dd className="font-mono font-bold text-slate-800">{device.deviceCode}</dd>
              </div>
              <div className="py-2 flex justify-between">
                <dt className="text-slate-500">Hostname</dt>
                <dd className="font-semibold text-slate-800">{device.hostname}</dd>
              </div>
              <div className="py-2 flex justify-between">
                <dt className="text-slate-500">Kategori</dt>
                <dd className="text-slate-800">{device.category.name}</dd>
              </div>
              <div className="py-2 flex justify-between">
                <dt className="text-slate-500">Vendor</dt>
                <dd className="text-slate-800 font-medium">{device.vendor.name}</dd>
              </div>
              <div className="py-2 flex justify-between">
                <dt className="text-slate-500">Model</dt>
                <dd className="text-slate-800">{device.model ? `${device.model.modelName} (${device.model.modelCode})` : '-'}</dd>
              </div>
              <div className="py-2 flex justify-between">
                <dt className="text-slate-500">Serial Number</dt>
                <dd className="font-mono text-slate-800">{device.serialNumber || '-'}</dd>
              </div>
              <div className="py-2 flex justify-between">
                <dt className="text-slate-500">Network Role</dt>
                <dd className="uppercase font-mono text-slate-800">{device.networkRole || '-'}</dd>
              </div>
            </dl>
          </div>

          {/* Box 2: Penempatan & Lokasi Fisik */}
          <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 border-b pb-2">
              Lokasi & Manajemen
            </h3>
            <dl className="divide-y divide-slate-100 text-xs">
              <div className="py-2 flex justify-between">
                <dt className="text-slate-500">Site / Lokasi</dt>
                <dd className="font-semibold text-slate-800">{device.site.siteCode} - {device.site.name}</dd>
              </div>
              <div className="py-2 flex justify-between">
                <dt className="text-slate-500">Ruangan</dt>
                <dd className="text-slate-800">{device.room ? `${device.room.name} (${device.room.floor || 'Lantai ?'})` : '-'}</dd>
              </div>
              <div className="py-2 flex justify-between">
                <dt className="text-slate-500">Rak</dt>
                <dd className="text-slate-800">{device.rack ? `${device.rack.name} (${device.rack.unitCapacity}U)` : '-'}</dd>
              </div>
              <div className="py-2 flex justify-between">
                <dt className="text-slate-500">Tim Penanggung Jawab</dt>
                <dd className="text-slate-800">{device.ownerTeam || '-'}</dd>
              </div>
              <div className="py-2 flex justify-between">
                <dt className="text-slate-500">Tanggal Pasang</dt>
                <dd className="text-slate-800">{device.installedAt ? new Date(device.installedAt).toLocaleDateString('id-ID') : '-'}</dd>
              </div>
              <div className="py-2 flex justify-between">
                <dt className="text-slate-500">Batas Garansi</dt>
                <dd className="text-slate-800">{device.warrantyExpiry ? new Date(device.warrantyExpiry).toLocaleDateString('id-ID') : '-'}</dd>
              </div>
              <div className="py-2 flex justify-between">
                <dt className="text-slate-500">Didaftarkan Oleh</dt>
                <dd className="text-slate-800">{device.creator ? `${device.creator.name} (${device.creator.username})` : 'System'}</dd>
              </div>
            </dl>
          </div>

          {/* Box 3: Keterangan & Catatan */}
          <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm md:col-span-2 space-y-2 text-xs">
            <h3 className="font-bold text-slate-700">Deskripsi & Catatan Manajemen</h3>
            <p className="text-slate-600 bg-slate-50 p-3 rounded border border-slate-200">
              {device.description || 'Tidak ada deskripsi perangkat.'}
            </p>
            {device.managementNotes && (
              <div className="mt-2">
                <span className="font-semibold text-slate-700">Catatan Manajemen Internal:</span>
                <p className="text-slate-600 bg-amber-50/50 p-3 rounded border border-amber-200 mt-1">
                  {device.managementNotes}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: NETWORK */}
      {activeTab === 'network' && (
        <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm space-y-4 text-xs">
          <div className="flex items-center justify-between border-b pb-3">
            <div>
              <h3 className="text-sm font-semibold text-slate-800">Alokasi IP Address & Subnet (IPAM)</h3>
              <p className="text-slate-500 mt-0.5">
                Sesuai Keputusan D2, Management IP perangkat tidak diduplikasi di tabel devices dan dikelola dari modul IPAM.
              </p>
            </div>
            <span className="rounded bg-indigo-50 border border-indigo-200 px-2.5 py-1 text-indigo-700 font-medium">
              Fase 3: IPAM
            </span>
          </div>
          <div className="rounded-md border border-dashed border-slate-300 p-8 text-center text-slate-500">
            <p className="font-semibold">Modul IPAM & Alokasi IP dijadwalkan pada Fase 3 (Minggu 5–6)</p>
            <p className="text-[11px] text-slate-400 mt-1">
              Alamat IP manajemen, loopback, gateway, dan subnet akan terhubung otomatis ke interface perangkat ini.
            </p>
          </div>
        </div>
      )}

      {/* TAB 3: PORTS */}
      {activeTab === 'ports' && (
        <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm space-y-4 text-xs">
          <div className="flex items-center justify-between border-b pb-3">
            <div>
              <h3 className="text-sm font-semibold text-slate-800">Daftar Interface & Port</h3>
              <p className="text-slate-500 mt-0.5">
                Daftar port fisik/logis (Ethernet, SFP, GPON, dsb) untuk perangkat {device.hostname}.
              </p>
            </div>
            <span className="rounded bg-indigo-50 border border-indigo-200 px-2.5 py-1 text-indigo-700 font-medium">
              Fase 3: Port & IPAM
            </span>
          </div>
          <div className="rounded-md border border-dashed border-slate-300 p-8 text-center text-slate-500">
            <p className="font-semibold">Manajemen Interface & Port dijadwalkan pada Fase 3</p>
            <p className="text-[11px] text-slate-400 mt-1">
              Tabel interfaces dengan constraint unik (device_id, name) dan status link administratif.
            </p>
          </div>
        </div>
      )}

      {/* TAB 4: CONNECTIONS */}
      {activeTab === 'connections' && (
        <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm space-y-4 text-xs">
          <div className="flex items-center justify-between border-b pb-3">
            <div>
              <h3 className="text-sm font-semibold text-slate-800">Relasi Jaringan (Koneksi Antarperangkat)</h3>
              <p className="text-slate-500 mt-0.5">
                Hubungan koneksi fisik/logis dari port perangkat ini ke port perangkat tetangga.
              </p>
            </div>
            <span className="rounded bg-indigo-50 border border-indigo-200 px-2.5 py-1 text-indigo-700 font-medium">
              Fase 4: Relasi Jaringan
            </span>
          </div>
          <div className="rounded-md border border-dashed border-slate-300 p-8 text-center text-slate-500">
            <p className="font-semibold">Relasi Jaringan & Topologi tetangga dijadwalkan pada Fase 4</p>
            <p className="text-[11px] text-slate-400 mt-1">
              Pencegahan konflik port ganda, tipe koneksi fisik/logis, dan visualisasi neighbor satu level.
            </p>
          </div>
        </div>
      )}

      {/* TAB 5: DOCUMENTS */}
      {activeTab === 'documents' && (
        <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm space-y-4 text-xs">
          <div className="flex items-center justify-between border-b pb-3">
            <div>
              <h3 className="text-sm font-semibold text-slate-800">Dokumen & Lampiran Perangkat</h3>
              <p className="text-slate-500 mt-0.5">
                Foto perangkat, diagram rak, konfigurasi, dan dokumen garansi.
              </p>
            </div>
            <span className="rounded bg-indigo-50 border border-indigo-200 px-2.5 py-1 text-indigo-700 font-medium">
              Fase 5: Dokumen
            </span>
          </div>
          <div className="rounded-md border border-dashed border-slate-300 p-8 text-center text-slate-500">
            <p className="font-semibold">Penyimpanan Dokumen Privat Berizin dijadwalkan pada Fase 5</p>
            <p className="text-[11px] text-slate-400 mt-1">
              Validasi MIME aman, proteksi direktori langsung, dan audit unduhan.
            </p>
          </div>
        </div>
      )}

      {/* TAB 6: HISTORY / AUDIT LOG */}
      {activeTab === 'history' && (
        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm space-y-4 text-xs">
          <h3 className="text-sm font-semibold text-slate-800 border-b pb-2">
            Riwayat Perubahan & Audit Trail Perangkat
          </h3>

          {history.length === 0 ? (
            <p className="text-slate-400 text-center py-6">Belum ada catatan histori perubahan.</p>
          ) : (
            <div className="space-y-3">
              {history.map((log) => (
                <div key={log.id} className="rounded border border-slate-200 p-3 bg-slate-50 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-indigo-700 uppercase tracking-wide">
                      Aksi: {log.action}
                    </span>
                    <span className="text-[11px] text-slate-400">
                      {new Date(log.createdAt).toLocaleString('id-ID')}
                    </span>
                  </div>
                  <p className="text-slate-600">
                    Oleh: <strong>{log.user ? `${log.user.name} (@${log.user.username})` : 'System'}</strong>
                  </p>
                  {log.action === 'ARCHIVE' && (
                    <p className="text-amber-800 bg-amber-50 p-2 rounded border border-amber-200">
                      Alasan Arsip: <em>{log.afterData?.archiveReason || '-'}</em>
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Archive Modal */}
      {showArchiveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-md rounded-lg bg-white p-5 shadow-xl space-y-4">
            <h3 className="text-sm font-bold text-slate-900">
              Konfirmasi Pengarsipan: {device.hostname}
            </h3>
            <p className="text-xs text-slate-600">
              Sesuai aturan inventaris, pengarsipan wajib menyertakan alasan. Perangkat tidak akan muncul di daftar aktif default.
            </p>
            {device.inventoryStatus === 'ACTIVE' && (
              <div className="rounded border border-amber-200 bg-amber-50 p-2.5 text-xs text-amber-800">
                ⚠️ Status saat ini adalah <strong>ACTIVE</strong>. Pastikan perangkat memang sudah tidak beroperasi di lapangan.
              </div>
            )}
            <form onSubmit={handleArchive} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-700">
                  Alasan Pengarsipan <span className="text-rose-500">*</span>
                </label>
                <textarea
                  required
                  rows={3}
                  placeholder="Contoh: Perangkat decommissioned, diganti dengan unit baru."
                  value={archiveReason}
                  onChange={(e) => setArchiveReason(e.target.value)}
                  className="mt-1 block w-full rounded border border-slate-300 p-2 text-xs focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                />
              </div>
              <div className="flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setShowArchiveModal(false)}
                  className="rounded border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={loadingArchive}
                  className="rounded bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-rose-500 disabled:opacity-50"
                >
                  {loadingArchive ? 'Mengarsipkan...' : 'Konfirmasi Arsipkan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
