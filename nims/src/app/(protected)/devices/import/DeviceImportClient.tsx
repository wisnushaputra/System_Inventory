'use client';

import { useState, useRef } from 'react';
import Link from 'next/link';
import {
  IconDownload,
  IconUpload,
  IconCheckCircle,
  IconAlertTriangle,
  IconClose,
} from '@/components/Icons';

interface Props {
  categories: Array<{ code: string; name: string }>;
  vendors: Array<{ name: string }>;
  sites: Array<{ siteCode: string; name: string }>;
}

interface PreviewRow {
  rowNumber: number;
  deviceCode: string;
  hostname: string;
  categoryName: string;
  vendorName: string;
  modelName?: string;
  serialNumber?: string;
  managementIp?: string;
  siteName: string;
  networkRole?: string;
  inventoryStatus: string;
  description?: string;
}

interface ImportError {
  rowNumber: number;
  deviceCode?: string;
  hostname?: string;
  error: string;
}

interface PreviewResponse {
  headers: string[];
  totalRows: number;
  validCount: number;
  invalidCount: number;
  errors: ImportError[];
  previewRows: PreviewRow[];
}

interface ExecuteResponse {
  success: boolean;
  message: string;
  totalRows: number;
  successCount: number;
  failedCount: number;
  errors: ImportError[];
}

export default function DeviceImportClient({ categories, vendors, sites }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [csvContent, setCsvContent] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const [executeResult, setExecuteResult] = useState<ExecuteResponse | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setErrorMsg(null);
    setPreview(null);
    setExecuteResult(null);

    const selected = e.target.files?.[0];
    if (!selected) {
      setFile(null);
      setCsvContent('');
      return;
    }

    if (!selected.name.toLowerCase().endsWith('.csv')) {
      setErrorMsg('Berkas harus berformat CSV (.csv)');
      return;
    }

    setFile(selected);
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      setCsvContent(text);
    };
    reader.readAsText(selected);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setErrorMsg(null);
    setPreview(null);
    setExecuteResult(null);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const dropped = e.dataTransfer.files[0];
      if (!dropped.name.toLowerCase().endsWith('.csv')) {
        setErrorMsg('Berkas harus berformat CSV (.csv)');
        return;
      }
      setFile(dropped);
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result as string;
        setCsvContent(text);
      };
      reader.readAsText(dropped);
    }
  };

  const handleDownloadTemplate = () => {
    window.open('/api/import/devices/template', '_blank');
  };

  const handlePreview = async () => {
    if (!csvContent) {
      setErrorMsg('Pilih berkas CSV terlebih dahulu');
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    try {
      const res = await fetch('/api/import/devices/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ csvText: csvContent }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Gagal memvalidasi berkas CSV');
      }

      setPreview(data);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Terjadi kesalahan sistem');
    } finally {
      setLoading(false);
    }
  };

  const handleExecute = async () => {
    if (!csvContent) return;

    setLoading(true);
    setErrorMsg(null);

    try {
      const res = await fetch('/api/import/devices/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ csvText: csvContent }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Gagal mengeksekusi impor CSV');
      }

      setExecuteResult(data);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Terjadi kesalahan sistem');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setFile(null);
    setCsvContent('');
    setPreview(null);
    setExecuteResult(null);
    setErrorMsg(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="animate-enter flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-ink-secondary mb-1">
            <Link href="/devices" className="hover:text-accent-ink transition-colors duration-150">
              Perangkat
            </Link>
            <span>/</span>
            <span className="text-ink font-semibold">Impor CSV</span>
          </div>
          <h1 className="text-2xl font-bold text-ink">Impor Perangkat CSV</h1>
          <p className="text-sm text-ink-secondary mt-1">
            Unggah berkas CSV untuk mendaftarkan banyak perangkat jaringan sekaligus secara valid.
          </p>
        </div>

        <button
          type="button"
          onClick={handleDownloadTemplate}
          className="inline-flex min-h-[42px] items-center gap-2 px-4 py-2 border border-line rounded-lg text-xs font-semibold text-ink bg-surface hover:bg-subtle shadow-xs transition-colors duration-150"
        >
          <IconDownload className="w-4 h-4 text-accent" />
          <span>Unduh Template CSV</span>
        </button>
      </div>

      {/* Reference Rules */}
      <div className="animate-enter stagger-1 bg-accent-soft border border-accent/25 rounded-xl p-4 text-xs sm:text-sm text-ink space-y-2">
        <h2 className="font-bold text-accent-ink">Aturan Pengisian Kolom CSV</h2>
        <ul className="list-disc list-inside space-y-1 text-xs text-ink-secondary">
          <li>
            <span className="font-semibold text-ink">Kolom wajib:</span>{' '}
            <code className="bg-surface px-1.5 py-0.5 rounded font-mono text-ink">device_code</code> (unik),{' '}
            <code className="bg-surface px-1.5 py-0.5 rounded font-mono text-ink">hostname</code>,{' '}
            <code className="bg-surface px-1.5 py-0.5 rounded font-mono text-ink">category</code>,{' '}
            <code className="bg-surface px-1.5 py-0.5 rounded font-mono text-ink">vendor</code>,{' '}
            <code className="bg-surface px-1.5 py-0.5 rounded font-mono text-ink">site_code</code>.
          </li>
          <li>
            <span className="font-semibold text-ink">Kategori terdaftar:</span>{' '}
            {categories.map((c) => c.code).join(', ')}.
          </li>
          <li>
            <span className="font-semibold text-ink">Vendor terdaftar:</span>{' '}
            {vendors.map((v) => v.name).join(', ')}.
          </li>
          <li>
            <span className="font-semibold text-ink">Kode Site terdaftar:</span>{' '}
            {sites.map((s) => s.siteCode).join(', ')}.
          </li>
          <li>
            <span className="font-semibold text-ink">Perilaku parsial:</span> Baris yang valid tetap tersimpan sementara baris gagal dilaporkan nomor baris dan penyebabnya.
          </li>
        </ul>
      </div>

      {errorMsg && (
        <div
          role="alert"
          className="bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900/60 rounded-xl p-4 text-xs sm:text-sm text-rose-900 dark:text-rose-200 flex items-center justify-between gap-3"
        >
          <div className="flex items-center gap-2">
            <IconAlertTriangle className="w-5 h-5 shrink-0 text-rose-600 dark:text-rose-400" />
            <span>{errorMsg}</span>
          </div>
          <button
            type="button"
            aria-label="Tutup pesan kesalahan"
            onClick={() => setErrorMsg(null)}
            className="text-rose-700 dark:text-rose-300 hover:opacity-80"
          >
            <IconClose className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Upload Zone */}
      {!executeResult && (
        <div className="animate-enter stagger-2 bg-surface border border-line rounded-xl p-6 shadow-xs space-y-5">
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                fileInputRef.current?.click();
              }
            }}
            className="border-2 border-dashed border-line-strong rounded-xl p-8 text-center hover:border-accent bg-canvas transition-colors duration-150 cursor-pointer"
          >
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept=".csv"
              className="hidden"
            />
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-subtle text-accent mb-3">
              <IconUpload className="h-6 w-6" />
            </div>
            <p className="text-sm sm:text-base font-semibold text-ink">
              {file ? file.name : 'Klik untuk memilih berkas atau seret berkas CSV ke sini'}
            </p>
            <p className="text-xs text-ink-secondary mt-1">
              {file ? `${(file.size / 1024).toFixed(1)} KB` : 'Format berkas harus .csv (UTF-8 didukung)'}
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-xs">
              {file && (
                <span className="inline-flex items-center gap-1.5 text-emerald-900 dark:text-emerald-200 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-900/60 px-3 py-1 rounded-md font-medium">
                  <IconCheckCircle className="h-4 w-4 shrink-0" />
                  <span>Berkas siap: {file.name}</span>
                </span>
              )}
            </div>

            <div className="flex items-center gap-3">
              {file && (
                <button
                  type="button"
                  onClick={handleReset}
                  disabled={loading}
                  className="min-h-[40px] px-4 py-2 border border-line rounded-lg text-xs font-medium text-ink-secondary bg-surface hover:bg-subtle hover:text-ink"
                >
                  Batal / Ganti Berkas
                </button>
              )}
              <button
                type="button"
                onClick={handlePreview}
                disabled={!file || loading}
                className="min-h-[40px] px-5 py-2 bg-accent text-accent-fg rounded-lg text-xs font-semibold hover:bg-accent-hover disabled:opacity-50 transition-colors duration-150"
              >
                {loading ? 'Memvalidasi...' : 'Pratinjau & Validasi Data'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Preview Panel */}
      {preview && !executeResult && (
        <div className="animate-enter bg-surface border border-line rounded-xl p-6 shadow-xs space-y-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-line pb-4">
            <div>
              <h2 className="text-lg font-bold text-ink">Hasil Validasi & Pratinjau</h2>
              <p className="text-xs text-ink-secondary">
                Periksa data sebelum menyimpannya ke basis data.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 tabular-nums-data">
              <span className="bg-subtle text-ink text-xs font-semibold px-2.5 py-1 rounded-md">
                Total: {preview.totalRows} baris
              </span>
              <span className="bg-emerald-100 dark:bg-emerald-950/70 text-emerald-900 dark:text-emerald-300 text-xs font-semibold px-2.5 py-1 rounded-md">
                Siap Simpan: {preview.validCount} baris
              </span>
              {preview.invalidCount > 0 && (
                <span className="bg-rose-100 dark:bg-rose-950/70 text-rose-900 dark:text-rose-300 text-xs font-semibold px-2.5 py-1 rounded-md">
                  Gagal: {preview.invalidCount} baris
                </span>
              )}
            </div>
          </div>

          {preview.errors.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-rose-800 dark:text-rose-300 flex items-center gap-2">
                <IconAlertTriangle className="w-4 h-4 shrink-0" />
                <span>Daftar Baris Tidak Lolos Validasi ({preview.errors.length} baris):</span>
              </h3>
              <div className="overflow-x-auto border border-rose-200 dark:border-rose-900/60 rounded-lg">
                <table className="min-w-full divide-y divide-rose-200 dark:divide-rose-900/60 text-xs">
                  <thead className="bg-rose-50 dark:bg-rose-950/60 text-rose-900 dark:text-rose-200">
                    <tr>
                      <th className="px-4 py-2.5 text-left font-semibold">Baris</th>
                      <th className="px-4 py-2.5 text-left font-semibold">Kode Perangkat</th>
                      <th className="px-4 py-2.5 text-left font-semibold">Hostname</th>
                      <th className="px-4 py-2.5 text-left font-semibold">Alasan Penolakan</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line bg-surface">
                    {preview.errors.map((err, idx) => (
                      <tr key={idx} className="hover:bg-subtle/60">
                        <td className="px-4 py-2 font-mono font-bold text-rose-700 dark:text-rose-300">
                          Baris {err.rowNumber}
                        </td>
                        <td className="px-4 py-2 text-ink font-mono">{err.deviceCode || '-'}</td>
                        <td className="px-4 py-2 text-ink">{err.hostname || '-'}</td>
                        <td className="px-4 py-2 text-rose-700 dark:text-rose-300 font-medium">
                          {err.error}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-emerald-800 dark:text-emerald-300 flex items-center gap-2">
              <IconCheckCircle className="w-4 h-4 shrink-0" />
              <span>Pratinjau Data Valid ({preview.previewRows.length} baris):</span>
            </h3>

            {preview.previewRows.length === 0 ? (
              <p className="text-xs text-ink-secondary italic p-4 bg-subtle rounded-lg">
                Tidak ada data valid dari berkas ini. Perbaiki kesalahan lalu unggah kembali.
              </p>
            ) : (
              <div className="overflow-x-auto border border-line rounded-lg">
                <table className="min-w-full divide-y divide-line text-xs">
                  <thead className="bg-subtle text-ink-secondary">
                    <tr>
                      <th className="px-3 py-2 text-left font-semibold">Baris</th>
                      <th className="px-3 py-2 text-left font-semibold">Kode</th>
                      <th className="px-3 py-2 text-left font-semibold">Hostname</th>
                      <th className="px-3 py-2 text-left font-semibold">Kategori</th>
                      <th className="px-3 py-2 text-left font-semibold">Vendor / Model</th>
                      <th className="px-3 py-2 text-left font-semibold">Management IP</th>
                      <th className="px-3 py-2 text-left font-semibold">Site</th>
                      <th className="px-3 py-2 text-left font-semibold">Role</th>
                      <th className="px-3 py-2 text-left font-semibold">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line bg-surface">
                    {preview.previewRows.map((r, idx) => (
                      <tr key={idx} className="hover:bg-subtle/60">
                        <td className="px-3 py-2 font-mono text-ink-muted">#{r.rowNumber}</td>
                        <td className="px-3 py-2 font-mono font-semibold text-ink">
                          {r.deviceCode}
                        </td>
                        <td className="px-3 py-2 text-ink">{r.hostname}</td>
                        <td className="px-3 py-2 text-ink-secondary">{r.categoryName}</td>
                        <td className="px-3 py-2 text-ink-secondary">
                          {r.vendorName} {r.modelName ? `(${r.modelName})` : ''}
                        </td>
                        <td className="px-3 py-2 font-mono text-accent-ink">
                          {r.managementIp || '-'}
                        </td>
                        <td className="px-3 py-2 text-ink-secondary">{r.siteName}</td>
                        <td className="px-3 py-2 text-ink-secondary">{r.networkRole || '-'}</td>
                        <td className="px-3 py-2">
                          <span className="bg-emerald-100 dark:bg-emerald-950/70 text-emerald-900 dark:text-emerald-300 text-[10px] font-semibold px-2 py-0.5 rounded">
                            {r.inventoryStatus}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-line">
            <button
              type="button"
              onClick={handleReset}
              disabled={loading}
              className="min-h-[40px] px-4 py-2 border border-line rounded-lg text-xs font-medium text-ink-secondary hover:bg-subtle"
            >
              Batal
            </button>
            <button
              type="button"
              onClick={handleExecute}
              disabled={loading || preview.validCount === 0}
              className="min-h-[40px] px-5 py-2 bg-accent text-accent-fg rounded-lg text-xs font-semibold hover:bg-accent-hover disabled:opacity-50"
            >
              {loading ? 'Menyimpan...' : `Konfirmasi & Simpan ${preview.validCount} Perangkat`}
            </button>
          </div>
        </div>
      )}

      {/* Execute Result */}
      {executeResult && (
        <div className="animate-enter bg-surface border border-line rounded-xl p-6 shadow-xs space-y-6">
          <div className="text-center py-4">
            <div className="w-14 h-14 bg-emerald-100 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300 rounded-full flex items-center justify-center mx-auto mb-3">
              <IconCheckCircle className="w-7 h-7" />
            </div>
            <h2 className="text-xl font-bold text-ink">Proses Impor Selesai</h2>
            <p className="text-sm text-ink-secondary mt-1">{executeResult.message}</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 tabular-nums-data">
            <div className="bg-subtle border border-line rounded-lg p-4 text-center">
              <span className="text-xs font-medium text-ink-secondary uppercase">Total Baris CSV</span>
              <p className="text-2xl font-bold font-mono text-ink mt-1">{executeResult.totalRows}</p>
            </div>
            <div className="bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-900/60 rounded-lg p-4 text-center">
              <span className="text-xs font-medium text-emerald-800 dark:text-emerald-300 uppercase">
                Berhasil Disimpan
              </span>
              <p className="text-2xl font-bold font-mono text-emerald-800 dark:text-emerald-300 mt-1">
                {executeResult.successCount}
              </p>
            </div>
            <div className="bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900/60 rounded-lg p-4 text-center">
              <span className="text-xs font-medium text-rose-800 dark:text-rose-300 uppercase">
                Gagal / Ditolak
              </span>
              <p className="text-2xl font-bold font-mono text-rose-800 dark:text-rose-300 mt-1">
                {executeResult.failedCount}
              </p>
            </div>
          </div>

          {executeResult.errors.length > 0 && (
            <div className="space-y-3 pt-2">
              <h3 className="text-sm font-semibold text-rose-800 dark:text-rose-300">
                Detail Baris Gagal ({executeResult.errors.length}):
              </h3>
              <div className="overflow-x-auto border border-rose-200 dark:border-rose-900/60 rounded-lg">
                <table className="min-w-full divide-y divide-rose-200 dark:divide-rose-900/60 text-xs">
                  <thead className="bg-rose-50 dark:bg-rose-950/60 text-rose-900 dark:text-rose-200">
                    <tr>
                      <th className="px-4 py-2 text-left font-semibold">Baris</th>
                      <th className="px-4 py-2 text-left font-semibold">Kode</th>
                      <th className="px-4 py-2 text-left font-semibold">Hostname</th>
                      <th className="px-4 py-2 text-left font-semibold">Alasan Penolakan</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line bg-surface">
                    {executeResult.errors.map((err, idx) => (
                      <tr key={idx}>
                        <td className="px-4 py-2 font-mono font-bold text-rose-700 dark:text-rose-300">
                          Baris {err.rowNumber}
                        </td>
                        <td className="px-4 py-2 text-ink font-mono">{err.deviceCode || '-'}</td>
                        <td className="px-4 py-2 text-ink">{err.hostname || '-'}</td>
                        <td className="px-4 py-2 text-rose-700 dark:text-rose-300">{err.error}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="flex flex-col sm:flex-row justify-center gap-3 pt-4 border-t border-line">
            <button
              type="button"
              onClick={handleReset}
              className="min-h-[42px] px-5 py-2.5 border border-line rounded-lg text-xs font-medium text-ink bg-surface hover:bg-subtle"
            >
              Impor Berkas Lain
            </button>
            <Link
              href="/devices"
              className="inline-flex min-h-[42px] items-center justify-center px-6 py-2.5 bg-accent text-accent-fg rounded-lg text-xs font-semibold hover:bg-accent-hover"
            >
              Buka Daftar Perangkat
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
