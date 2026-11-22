'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import QRCode from 'qrcode';
import { IconClose, IconPrinter, IconQrCode } from '@/components/Icons';

export interface QrLabelDeviceItem {
  id: number;
  deviceCode: string;
  hostname: string;
  serialNumber?: string | null;
  managementIp?: string | null;
  inventoryStatus: string;
  siteCode: string;
  siteName?: string | null;
  roomName?: string | null;
  rackName?: string | null;
  vendorName?: string | null;
  modelName?: string | null;
}

interface QrLabelModalProps {
  devices: QrLabelDeviceItem[];
  onClose: () => void;
}

function StickerCard({
  device,
  svgMarkup,
  compact,
  showIp,
  showSerial,
  forPrint = false,
}: {
  device: QrLabelDeviceItem;
  svgMarkup?: string;
  compact: boolean;
  showIp: boolean;
  showSerial: boolean;
  forPrint?: boolean;
}) {
  const locationText = [device.siteCode, device.roomName, device.rackName]
    .filter(Boolean)
    .join(' / ');

  return (
    <div
      className={`flex items-center gap-3 rounded-lg border border-slate-300 bg-white text-slate-900 ${
        compact ? 'p-2.5' : 'p-3.5'
      } ${forPrint ? 'break-inside-avoid' : 'shadow-xs'}`}
    >
      <div
        className={`shrink-0 rounded border border-slate-200 bg-white p-1 ${
          compact ? 'h-[76px] w-[76px]' : 'h-[92px] w-[92px]'
        } flex items-center justify-center`}
      >
        {svgMarkup ? (
          <div
            className="h-full w-full [&>svg]:h-full [&>svg]:w-full"
            aria-label={`QR Code untuk ${device.deviceCode}`}
            dangerouslySetInnerHTML={{ __html: svgMarkup }}
          />
        ) : (
          <span className="text-[10px] font-mono text-slate-500">QR...</span>
        )}
      </div>

      <div className="min-w-0 flex-1 space-y-0.5 leading-tight">
        <div className="flex items-center justify-between gap-1.5">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
            PASSNET ASSET TAG
          </span>
          <span className="rounded border border-slate-300 px-1.5 py-0.5 text-[9px] font-bold text-slate-700">
            {device.inventoryStatus}
          </span>
        </div>
        <p className="truncate font-mono text-xs font-bold text-slate-900">{device.deviceCode}</p>
        <p className="truncate text-xs font-semibold text-slate-800">{device.hostname}</p>
        <p className="truncate text-[10px] text-slate-600">{locationText || device.siteCode}</p>
        {device.vendorName && (
          <p className="truncate text-[10px] text-slate-500">
            {device.vendorName}
            {device.modelName ? ` ${device.modelName}` : ''}
          </p>
        )}
        {showIp && device.managementIp && (
          <p className="truncate font-mono text-[10px] font-semibold text-slate-800">
            IP: {device.managementIp}
          </p>
        )}
        {showSerial && device.serialNumber && (
          <p className="truncate font-mono text-[10px] text-slate-600">
            S/N: {device.serialNumber}
          </p>
        )}
      </div>
    </div>
  );
}

export function QrLabelModal({ devices, onClose }: QrLabelModalProps) {
  const [svgMap, setSvgMap] = useState<Record<number, string>>({});
  const [qrError, setQrError] = useState<string | null>(null);
  const [compact, setCompact] = useState(true);
  const [showIp, setShowIp] = useState(true);
  const [showSerial, setShowSerial] = useState(true);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  useEffect(() => {
    let cancelled = false;
    const origin = typeof window !== 'undefined' ? window.location.origin : '';

    async function generateAll() {
      try {
        const entries = await Promise.all(
          devices.map(async (dev) => {
            const targetUrl = `${origin}/devices/${dev.id}`;
            const svg = await QRCode.toString(targetUrl, {
              type: 'svg',
              margin: 1,
              width: 140,
              errorCorrectionLevel: 'M',
              color: {
                dark: '#0f172a',
                light: '#ffffff',
              },
            });
            return [dev.id, svg] as const;
          })
        );
        if (!cancelled) {
          setSvgMap(Object.fromEntries(entries));
          setQrError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setQrError(err instanceof Error ? err.message : 'Gagal membuat kode QR');
        }
      }
    }

    if (devices.length > 0) {
      void generateAll();
    }

    return () => {
      cancelled = true;
    };
  }, [devices]);

  useEffect(() => {
    // Tandai body selama modal label QR terbuka agar Ctrl+P maupun tombol Cetak hanya mencetak #nims-qr-print-root
    document.body.classList.add('nims-print-qr');
    return () => {
      document.body.classList.remove('nims-print-qr');
    };
  }, []);

  const handlePrint = () => {
    document.body.classList.add('nims-print-qr');
    requestAnimationFrame(() => {
      window.print();
    });
  };

  const printPortal =
    typeof document !== 'undefined'
      ? createPortal(
          <div id="nims-qr-print-root" className="hidden print:block" aria-hidden="true">
            <div
              className={`grid gap-3 ${
                compact ? 'grid-cols-3' : 'grid-cols-2'
              }`}
            >
              {devices.map((dev) => (
                <StickerCard
                  key={`print-${dev.id}`}
                  device={dev}
                  svgMarkup={svgMap[dev.id]}
                  compact={compact}
                  showIp={showIp}
                  showSerial={showSerial}
                  forPrint
                />
              ))}
            </div>
          </div>,
          document.body
        )
      : null;

  const isGenerating = devices.length > 0 && Object.keys(svgMap).length === 0 && !qrError;

  return (
    <>
      {printPortal}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="qr-modal-title"
        className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/65 p-4 animate-backdrop print:hidden"
        onMouseDown={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        <div className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-xl border border-line bg-elevated shadow-2xl animate-modal">
          <div className="flex items-start justify-between gap-3 border-b border-line px-5 py-4">
            <div className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent-soft text-accent-ink">
                <IconQrCode className="h-5 w-5" />
              </span>
              <div>
                <h2 id="qr-modal-title" className="text-sm font-bold text-ink">
                  Cetak Label QR Aset ({devices.length} Perangkat)
                </h2>
                <p className="text-xs text-ink-secondary">
                  Setiap label memuat URL langsung ke halaman detail perangkat untuk audit fisik di rak/POP.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Tutup pratinjau label QR"
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-line bg-surface text-ink-secondary hover:bg-subtle hover:text-ink"
            >
              <IconClose className="h-4 w-4" />
            </button>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-subtle/60 px-5 py-3 text-xs">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold text-ink-secondary">Ukuran Stiker:</span>
              <button
                type="button"
                onClick={() => setCompact(true)}
                className={`min-h-[34px] rounded-md border px-2.5 py-1 font-semibold transition-colors ${
                  compact
                    ? 'border-accent bg-accent text-accent-fg'
                    : 'border-line bg-surface text-ink-secondary hover:text-ink'
                }`}
              >
                Standar (3 Kolom)
              </button>
              <button
                type="button"
                onClick={() => setCompact(false)}
                className={`min-h-[34px] rounded-md border px-2.5 py-1 font-semibold transition-colors ${
                  !compact
                    ? 'border-accent bg-accent text-accent-fg'
                    : 'border-line bg-surface text-ink-secondary hover:text-ink'
                }`}
              >
                Besar (2 Kolom)
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-4">
              <label className="inline-flex items-center gap-2 text-ink cursor-pointer">
                <input
                  type="checkbox"
                  checked={showIp}
                  onChange={(e) => setShowIp(e.target.checked)}
                  className="h-4 w-4 rounded border-line text-accent focus:ring-accent"
                />
                <span>Tampilkan IP Manajemen</span>
              </label>
              <label className="inline-flex items-center gap-2 text-ink cursor-pointer">
                <input
                  type="checkbox"
                  checked={showSerial}
                  onChange={(e) => setShowSerial(e.target.checked)}
                  className="h-4 w-4 rounded border-line text-accent focus:ring-accent"
                />
                <span>Tampilkan Serial Number</span>
              </label>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto bg-canvas p-5">
            {qrError ? (
              <div className="rounded-lg border border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/60 p-4 text-xs text-rose-800 dark:text-rose-200">
                Gagal menghasilkan kode QR: {qrError}
              </div>
            ) : isGenerating ? (
              <div className="flex h-40 items-center justify-center text-xs text-ink-secondary">
                Menghasilkan matriks kode QR...
              </div>
            ) : (
              <div
                className={`grid grid-cols-1 gap-3 ${
                  compact ? 'sm:grid-cols-2 lg:grid-cols-3' : 'sm:grid-cols-2'
                }`}
              >
                {devices.map((dev) => (
                  <StickerCard
                    key={dev.id}
                    device={dev}
                    svgMarkup={svgMap[dev.id]}
                    compact={compact}
                    showIp={showIp}
                    showSerial={showSerial}
                  />
                ))}
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line bg-surface px-5 py-3.5">
            <p className="text-[11px] text-ink-muted">
              Tips cetak: Aktifkan opsi <strong className="text-ink-secondary">Background graphics</strong> pada dialog print browser untuk hasil terbaik.
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="min-h-[40px] rounded-lg border border-line bg-surface px-4 py-1.5 text-xs font-semibold text-ink-secondary hover:bg-subtle hover:text-ink"
              >
                Tutup
              </button>
              <button
                type="button"
                onClick={handlePrint}
                disabled={Boolean(qrError) || isGenerating}
                className="inline-flex min-h-[40px] items-center gap-2 rounded-lg bg-accent px-4 py-1.5 text-xs font-semibold text-accent-fg hover:bg-accent-hover disabled:opacity-50"
              >
                <IconPrinter className="h-4 w-4" />
                <span>Cetak / Simpan PDF</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
