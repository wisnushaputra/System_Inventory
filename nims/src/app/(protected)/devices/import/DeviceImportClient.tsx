'use client';

import { useState, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

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
  const router = useRouter();
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
      {/* Breadcrumb & Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
            <Link href="/devices" className="hover:text-blue-600 transition-colors">
              Perangkat
            </Link>
            <span>/</span>
            <span className="text-gray-900 font-medium">Impor CSV</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Impor Perangkat CSV</h1>
          <p className="text-sm text-gray-600">
            Unggah berkas CSV untuk mendaftarkan banyak perangkat jaringan sekaligus secara valid dan aman.
          </p>
        </div>

        <button
          type="button"
          onClick={handleDownloadTemplate}
          className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 shadow-sm transition-colors"
        >
          <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          Unduh Template CSV
        </button>
      </div>

      {/* Panduan Referensi Singkat */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-900">
        <h2 className="font-semibold mb-2 flex items-center gap-2">
          <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Aturan Pengisian Kolom CSV
        </h2>
        <ul className="list-disc list-inside space-y-1 text-xs sm:text-sm text-blue-800">
          <li>
            <span className="font-medium">Kolom wajib:</span> <code className="bg-blue-100 px-1 rounded">device_code</code> (unik), <code className="bg-blue-100 px-1 rounded">hostname</code>, <code className="bg-blue-100 px-1 rounded">category</code>, <code className="bg-blue-100 px-1 rounded">vendor</code>, <code className="bg-blue-100 px-1 rounded">site_code</code>.
          </li>
          <li>
            <span className="font-medium">Kategori terdaftar:</span> {categories.map((c) => c.code).join(', ')}.
          </li>
          <li>
            <span className="font-medium">Vendor terdaftar:</span> {vendors.map((v) => v.name).join(', ')}.
          </li>
          <li>
            <span className="font-medium">Kode Site terdaftar:</span> {sites.map((s) => s.siteCode).join(', ')}.
          </li>
          <li>
            <span className="font-medium">Perilaku parsial:</span> Jika ada baris yang tidak valid, baris yang lolos validasi tetap akan tersimpan, dan baris yang ditolak akan dilaporkan nomor baris beserta penyebabnya.
          </li>
        </ul>
      </div>

      {/* Error Banner */}
      {errorMsg && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-800 flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-red-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>{errorMsg}</span>
          </div>
          <button onClick={() => setErrorMsg(null)} className="text-red-600 hover:text-red-800 font-bold">
            &times;
          </button>
        </div>
      )}

      {/* Upload Zone jika belum selesai eksekusi */}
      {!executeResult && (
        <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm space-y-5">
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
            className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center hover:border-blue-500 bg-gray-50/50 transition-colors cursor-pointer"
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept=".csv"
              className="hidden"
            />
            <svg className="w-12 h-12 mx-auto text-gray-400 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            <p className="text-base font-medium text-gray-800">
              {file ? file.name : 'Klik untuk memilih berkas atau seret & lepas berkas CSV ke sini'}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              {file ? `${(file.size / 1024).toFixed(1)} KB` : 'Format berkas harus .csv (UTF-8 didukung)'}
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-xs text-gray-500">
              {file && (
                <span className="text-green-700 bg-green-50 border border-green-200 px-2.5 py-1 rounded-md">
                  ✓ Berkas siap: {file.name}
                </span>
              )}
            </div>

            <div className="flex items-center gap-3">
              {file && (
                <button
                  type="button"
                  onClick={handleReset}
                  disabled={loading}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                >
                  Batal / Ganti Berkas
                </button>
              )}
              <button
                type="button"
                onClick={handlePreview}
                disabled={!file || loading}
                className="px-5 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center gap-2"
              >
                {loading && (
                  <svg className="w-4 h-4 animate-spin text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                )}
                Pratinjau & Validasi Data
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Panel Pratinjau (Preview) */}
      {preview && !executeResult && (
        <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-gray-200 pb-4">
            <div>
              <h2 className="text-lg font-bold text-gray-900">Hasil Validasi & Pratinjau</h2>
              <p className="text-xs text-gray-500">
                Periksa data sebelum menyimpannya ke basis data.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <span className="bg-gray-100 text-gray-800 text-xs font-semibold px-2.5 py-1 rounded">
                Total: {preview.totalRows} baris
              </span>
              <span className="bg-green-100 text-green-800 text-xs font-semibold px-2.5 py-1 rounded">
                Siap Simpan: {preview.validCount} baris
              </span>
              {preview.invalidCount > 0 && (
                <span className="bg-red-100 text-red-800 text-xs font-semibold px-2.5 py-1 rounded">
                  Gagal: {preview.invalidCount} baris
                </span>
              )}
            </div>
          </div>

          {/* Laporan Error per Baris jika ada */}
          {preview.errors.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-red-700 flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                Daftar Baris Tidak Lolos Validasi ({preview.errors.length} baris):
              </h3>
              <div className="overflow-x-auto border border-red-200 rounded-lg">
                <table className="min-w-full divide-y divide-red-200 text-xs">
                  <thead className="bg-red-50 text-red-900">
                    <tr>
                      <th className="px-4 py-2 text-left font-semibold">Baris</th>
                      <th className="px-4 py-2 text-left font-semibold">Kode Perangkat</th>
                      <th className="px-4 py-2 text-left font-semibold">Hostname</th>
                      <th className="px-4 py-2 text-left font-semibold">Alasan Penolakan</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-red-100 bg-white">
                    {preview.errors.map((err, idx) => (
                      <tr key={idx} className="hover:bg-red-50/50">
                        <td className="px-4 py-2 font-mono font-bold text-red-700">Baris {err.rowNumber}</td>
                        <td className="px-4 py-2 text-gray-700 font-mono">{err.deviceCode || '-'}</td>
                        <td className="px-4 py-2 text-gray-700">{err.hostname || '-'}</td>
                        <td className="px-4 py-2 text-red-600 font-medium">{err.error}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Pratinjau Baris Valid */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-green-700 flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Pratinjau Data Valid yang Akan Disimpan ({preview.previewRows.length} baris):
            </h3>

            {preview.previewRows.length === 0 ? (
              <p className="text-xs text-gray-500 italic p-4 bg-gray-50 rounded-lg">
                Tidak ada data valid yang dapat disimpan dari berkas ini. Perbaiki kesalahan berkas di atas lalu unggah kembali.
              </p>
            ) : (
              <div className="overflow-x-auto border border-gray-200 rounded-lg">
                <table className="min-w-full divide-y divide-gray-200 text-xs">
                  <thead className="bg-gray-50 text-gray-700">
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
                  <tbody className="divide-y divide-gray-100 bg-white">
                    {preview.previewRows.map((r, idx) => (
                      <tr key={idx} className="hover:bg-gray-50">
                        <td className="px-3 py-2 font-mono text-gray-500">#{r.rowNumber}</td>
                        <td className="px-3 py-2 font-mono font-bold text-gray-900">{r.deviceCode}</td>
                        <td className="px-3 py-2 text-gray-900">{r.hostname}</td>
                        <td className="px-3 py-2 text-gray-700">{r.categoryName}</td>
                        <td className="px-3 py-2 text-gray-700">
                          {r.vendorName} {r.modelName ? `(${r.modelName})` : ''}
                        </td>
                        <td className="px-3 py-2 font-mono text-blue-600">{r.managementIp || '-'}</td>
                        <td className="px-3 py-2 text-gray-700">{r.siteName}</td>
                        <td className="px-3 py-2 text-gray-700">{r.networkRole || '-'}</td>
                        <td className="px-3 py-2">
                          <span className="bg-green-100 text-green-800 text-[10px] font-semibold px-2 py-0.5 rounded">
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

          {/* Konfirmasi Eksekusi */}
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={handleReset}
              disabled={loading}
              className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Batal
            </button>
            <button
              type="button"
              onClick={handleExecute}
              disabled={loading || preview.validCount === 0}
              className="px-6 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50 transition-colors flex items-center gap-2"
            >
              {loading && (
                <svg className="w-4 h-4 animate-spin text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
              )}
              Konfirmasi & Simpan {preview.validCount} Perangkat
            </button>
          </div>
        </div>
      )}

      {/* Panel Hasil Eksekusi */}
      {executeResult && (
        <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm space-y-6">
          <div className="text-center py-4">
            <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-3">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-gray-900">Proses Impor Selesai</h2>
            <p className="text-sm text-gray-600 mt-1">{executeResult.message}</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-center">
              <span className="text-xs font-medium text-gray-500 uppercase">Total Baris CSV</span>
              <p className="text-2xl font-bold text-gray-900 mt-1">{executeResult.totalRows}</p>
            </div>
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
              <span className="text-xs font-medium text-green-700 uppercase">Berhasil Disimpan</span>
              <p className="text-2xl font-bold text-green-700 mt-1">{executeResult.successCount}</p>
            </div>
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-center">
              <span className="text-xs font-medium text-red-700 uppercase">Gagal / Ditolak</span>
              <p className="text-2xl font-bold text-red-700 mt-1">{executeResult.failedCount}</p>
            </div>
          </div>

          {/* Tabel detail error eksekusi jika ada */}
          {executeResult.errors.length > 0 && (
            <div className="space-y-3 pt-2">
              <h3 className="text-sm font-semibold text-red-700">
                Detail Baris Gagal ({executeResult.errors.length}):
              </h3>
              <div className="overflow-x-auto border border-red-200 rounded-lg">
                <table className="min-w-full divide-y divide-red-200 text-xs">
                  <thead className="bg-red-50 text-red-900">
                    <tr>
                      <th className="px-4 py-2 text-left font-semibold">Baris</th>
                      <th className="px-4 py-2 text-left font-semibold">Kode</th>
                      <th className="px-4 py-2 text-left font-semibold">Hostname</th>
                      <th className="px-4 py-2 text-left font-semibold">Alasan Penolakan</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-red-100 bg-white">
                    {executeResult.errors.map((err, idx) => (
                      <tr key={idx} className="hover:bg-red-50/50">
                        <td className="px-4 py-2 font-mono font-bold text-red-700">Baris {err.rowNumber}</td>
                        <td className="px-4 py-2 text-gray-700 font-mono">{err.deviceCode || '-'}</td>
                        <td className="px-4 py-2 text-gray-700">{err.hostname || '-'}</td>
                        <td className="px-4 py-2 text-red-600">{err.error}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="flex flex-col sm:flex-row justify-center gap-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={handleReset}
              className="px-5 py-2.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Impor Berkas Lain
            </button>
            <Link
              href="/devices"
              className="px-6 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors text-center"
            >
              Buka Daftar Perangkat
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
