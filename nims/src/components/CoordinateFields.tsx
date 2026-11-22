'use client';

import { useState } from 'react';
import { IconExternalLink, IconSitePin } from '@/components/Icons';
import { buildGoogleMapsUrl, parseGeoInputs, splitCoordinatePair } from '@/lib/geo';

interface CoordinateFieldsProps {
  latId?: string;
  lngId?: string;
  latitude: string;
  longitude: string;
  onChange: (next: { latitude: string; longitude: string }) => void;
  disabled?: boolean;
}

export function CoordinateFields({
  latId = 'site-lat',
  lngId = 'site-lng',
  latitude,
  longitude,
  onChange,
  disabled = false,
}: CoordinateFieldsProps) {
  const [geoLoading, setGeoLoading] = useState(false);
  const [geoStatus, setGeoStatus] = useState<string | null>(null);

  const parsed = parseGeoInputs(latitude, longitude);
  const hasValidPair =
    !parsed.error && parsed.latitude !== null && parsed.longitude !== null;

  const handleUseBrowserGps = () => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setGeoStatus('Browser tidak mendukung akses lokasi GPS.');
      return;
    }
    setGeoLoading(true);
    setGeoStatus(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        onChange({
          latitude: pos.coords.latitude.toFixed(6),
          longitude: pos.coords.longitude.toFixed(6),
        });
        setGeoLoading(false);
        setGeoStatus('Koordinat GPS berhasil diambil dari perangkat ini.');
      },
      (err) => {
        setGeoLoading(false);
        setGeoStatus(`Gagal mengambil GPS (${err.message}). Silakan isi manual.`);
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  return (
    <div className="space-y-2 rounded-lg border border-line bg-subtle/40 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-ink-secondary">
          <IconSitePin className="h-3.5 w-3.5 text-accent-ink" />
          <span>Koordinat GPS (Opsional)</span>
        </span>
        <div className="flex flex-wrap items-center gap-2">
          {hasValidPair && parsed.latitude !== null && parsed.longitude !== null && (
            <a
              href={buildGoogleMapsUrl(parsed.latitude, parsed.longitude)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[11px] font-semibold text-accent-ink hover:underline"
            >
              <span>Buka Google Maps</span>
              <IconExternalLink className="h-3 w-3" />
            </a>
          )}
          <button
            type="button"
            disabled={disabled || geoLoading}
            onClick={handleUseBrowserGps}
            className="min-h-[28px] rounded-md border border-line bg-surface px-2 py-0.5 text-[11px] font-semibold text-ink-secondary hover:bg-subtle hover:text-ink disabled:opacity-50"
          >
            {geoLoading ? 'Mengambil GPS...' : 'Ambil GPS Perangkat'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor={latId} className="block text-[11px] font-semibold text-ink-secondary">
            Latitude (-90 s/d 90)
          </label>
          <input
            id={latId}
            type="text"
            inputMode="decimal"
            disabled={disabled}
            placeholder="Contoh: -6.89150 atau paste lat, lng"
            value={latitude}
            onChange={(e) => {
              const split = splitCoordinatePair(e.target.value);
              if (split) {
                onChange({ latitude: split[0], longitude: split[1] });
              } else {
                onChange({ latitude: e.target.value, longitude });
              }
            }}
            className="mt-1 min-h-[38px] block w-full rounded-lg border border-line bg-canvas px-3 py-1.5 text-xs font-mono text-ink placeholder-ink-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
          />
        </div>

        <div>
          <label htmlFor={lngId} className="block text-[11px] font-semibold text-ink-secondary">
            Longitude (-180 s/d 180)
          </label>
          <input
            id={lngId}
            type="text"
            inputMode="decimal"
            disabled={disabled}
            placeholder="Contoh: 107.61070"
            value={longitude}
            onChange={(e) => onChange({ latitude, longitude: e.target.value })}
            className="mt-1 min-h-[38px] block w-full rounded-lg border border-line bg-canvas px-3 py-1.5 text-xs font-mono text-ink placeholder-ink-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
          />
        </div>
      </div>

      {parsed.error && (
        <p className="text-[11px] font-medium text-rose-700 dark:text-rose-300">{parsed.error}</p>
      )}
      {geoStatus && !parsed.error && (
        <p className="text-[11px] text-ink-secondary">{geoStatus}</p>
      )}
    </div>
  );
}
