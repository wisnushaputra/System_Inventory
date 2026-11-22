'use client';

import { useEffect, useState } from 'react';
import { IconAlertTriangle, IconClose, IconPopBuilding } from '@/components/Icons';
import { CoordinateFields } from '@/components/CoordinateFields';
import { parseGeoInputs } from '@/lib/geo';

export interface ParentPopContext {
  id: number;
  siteCode: string;
  name: string;
  city?: string | null;
}

interface Props {
  open: boolean;
  mode?: 'customer' | 'pop';
  pop?: ParentPopContext | null;
  onClose: () => void;
  onCreated: (site: { id: number; siteCode: string; name: string }) => void;
}

/** Modal tambah POP Induk (Level 1) atau Site Pelanggan (Level 2) di bawah POP Induk. */
export function AddCustomerSiteModal({
  open,
  mode = 'customer',
  pop = null,
  onClose,
  onCreated,
}: Props) {
  const isPopMode = mode === 'pop';
  if (!open || (!isPopMode && !pop)) return null;

  return (
    <AddCustomerSiteDialog
      key={`${mode}-${pop?.id ?? 'pop'}`}
      isPopMode={isPopMode}
      pop={pop}
      onClose={onClose}
      onCreated={onCreated}
    />
  );
}

function AddCustomerSiteDialog({
  isPopMode,
  pop,
  onClose,
  onCreated,
}: {
  isPopMode: boolean;
  pop: ParentPopContext | null;
  onClose: () => void;
  onCreated: (site: { id: number; siteCode: string; name: string }) => void;
}) {
  const [siteCode, setSiteCode] = useState('');
  const [name, setName] = useState('');
  const [popSiteType, setPopSiteType] = useState<'pop' | 'dc' | 'office'>('pop');
  const [city, setCity] = useState(isPopMode ? '' : pop?.city || '');
  const [address, setAddress] = useState('');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [status, setStatus] = useState<'active' | 'inactive' | 'maintenance'>('active');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !submitting) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [submitting, onClose]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const geo = parseGeoInputs(latitude, longitude);
    if (geo.error) {
      setError(geo.error);
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch('/api/master/sites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          siteCode: siteCode.trim().toUpperCase(),
          name: name.trim(),
          siteType: isPopMode ? popSiteType : 'customer_site',
          parentSiteId: isPopMode ? null : pop!.id,
          city: city.trim() || null,
          address: address.trim() || null,
          latitude: geo.latitude,
          longitude: geo.longitude,
          status,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(
          json.message || (isPopMode ? 'Gagal menambahkan POP.' : 'Gagal menambahkan site pelanggan.')
        );
      }
      onCreated(json.data);
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Terjadi kesalahan saat menyimpan.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 animate-backdrop"
      onClick={() => {
        if (!submitting) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-customer-site-title"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg rounded-xl border border-line bg-elevated p-5 shadow-2xl animate-modal space-y-4"
      >
        <div className="flex items-start justify-between gap-3 border-b border-line pb-3">
          <div>
            <h3 id="add-customer-site-title" className="text-base font-bold text-ink">
              {isPopMode ? 'Tambahkan POP Induk (Level 1)' : 'Tambahkan Site Pelanggan (Level 2)'}
            </h3>
            <p className="mt-0.5 text-xs text-ink-secondary">
              {isPopMode
                ? 'Daftarkan lokasi Point of Presence (POP), Data Center, atau hub baru.'
                : 'Daftarkan lokasi pelanggan baru yang terhubung langsung ke POP induk ini.'}
            </p>
          </div>
          <button
            type="button"
            disabled={submitting}
            onClick={onClose}
            aria-label="Tutup dialog"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-ink-muted hover:bg-subtle hover:text-ink disabled:opacity-50"
          >
            <IconClose className="h-4 w-4" />
          </button>
        </div>

        {!isPopMode && pop && (
          <div className="flex items-center gap-2.5 rounded-lg border border-line bg-accent-soft px-3.5 py-2.5 text-xs text-accent-ink">
            <IconPopBuilding className="h-4 w-4 shrink-0" />
            <span>
              POP Induk: <strong className="font-semibold">{pop.name}</strong>{' '}
              <span className="font-mono">({pop.siteCode})</span>
            </span>
          </div>
        )}

        {error && (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-lg border border-rose-200 dark:border-rose-900/60 bg-rose-50 dark:bg-rose-950/50 p-3 text-xs text-rose-800 dark:text-rose-200"
          >
            <IconAlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
            <div>
              <label htmlFor="cust-site-code" className="block text-xs font-semibold text-ink-secondary">
                {isPopMode ? 'Kode POP *' : 'Kode Site *'}
              </label>
              <input
                id="cust-site-code"
                type="text"
                required
                minLength={2}
                maxLength={50}
                placeholder={isPopMode ? 'Contoh: POP-SBY-01' : 'Contoh: CUST-ABC-01'}
                value={siteCode}
                onChange={(e) => setSiteCode(e.target.value)}
                className="mt-1 min-h-[40px] block w-full rounded-lg border border-line bg-canvas px-3 py-1.5 text-xs font-mono uppercase text-ink placeholder-ink-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
              />
            </div>

            <div>
              <label htmlFor="cust-site-status" className="block text-xs font-semibold text-ink-secondary">
                Status Operasional
              </label>
              <select
                id="cust-site-status"
                value={status}
                onChange={(e) => setStatus(e.target.value as 'active' | 'inactive' | 'maintenance')}
                className="mt-1 min-h-[40px] block w-full rounded-lg border border-line bg-canvas px-3 py-1.5 text-xs text-ink focus:border-accent focus:outline-none"
              >
                <option value="active">Aktif</option>
                <option value="maintenance">Maintenance</option>
                <option value="inactive">Nonaktif</option>
              </select>
            </div>
          </div>

          {isPopMode && (
            <div>
              <label htmlFor="pop-site-type" className="block text-xs font-semibold text-ink-secondary">
                Tipe Lokasi Induk
              </label>
              <select
                id="pop-site-type"
                value={popSiteType}
                onChange={(e) => setPopSiteType(e.target.value as 'pop' | 'dc' | 'office')}
                className="mt-1 min-h-[40px] block w-full rounded-lg border border-line bg-canvas px-3 py-1.5 text-xs text-ink focus:border-accent focus:outline-none"
              >
                <option value="pop">Point of Presence (POP)</option>
                <option value="dc">Data Center (DC)</option>
                <option value="office">Kantor / Hub</option>
              </select>
            </div>
          )}

          <div>
            <label htmlFor="cust-site-name" className="block text-xs font-semibold text-ink-secondary">
              {isPopMode ? 'Nama Lokasi POP *' : 'Nama Site Pelanggan *'}
            </label>
            <input
              id="cust-site-name"
              type="text"
              required
              minLength={2}
              maxLength={100}
              placeholder={
                isPopMode ? 'Contoh: POP Surabaya Timur' : 'Contoh: PT Nusantara Cabang Jakarta'
              }
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 min-h-[40px] block w-full rounded-lg border border-line bg-canvas px-3 py-1.5 text-xs text-ink placeholder-ink-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
            />
          </div>

          <div>
            <label htmlFor="cust-site-city" className="block text-xs font-semibold text-ink-secondary">
              Kota
            </label>
            <input
              id="cust-site-city"
              type="text"
              maxLength={100}
              placeholder="Contoh: Jakarta Selatan"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              className="mt-1 min-h-[40px] block w-full rounded-lg border border-line bg-canvas px-3 py-1.5 text-xs text-ink placeholder-ink-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
            />
          </div>

          <div>
            <label htmlFor="cust-site-address" className="block text-xs font-semibold text-ink-secondary">
              Alamat Lengkap
            </label>
            <input
              id="cust-site-address"
              type="text"
              maxLength={255}
              placeholder="Contoh: Jl. Jenderal Sudirman No. 10"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="mt-1 min-h-[40px] block w-full rounded-lg border border-line bg-canvas px-3 py-1.5 text-xs text-ink placeholder-ink-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
            />
          </div>

          <CoordinateFields
            latId="modal-site-lat"
            lngId="modal-site-lng"
            latitude={latitude}
            longitude={longitude}
            onChange={({ latitude: nextLat, longitude: nextLng }) => {
              setLatitude(nextLat);
              setLongitude(nextLng);
            }}
            disabled={submitting}
          />

          <div className="flex justify-end gap-2 border-t border-line pt-3">
            <button
              type="button"
              disabled={submitting}
              onClick={onClose}
              className="min-h-[40px] rounded-lg border border-line bg-surface px-4 py-1.5 text-xs font-medium text-ink-secondary hover:bg-subtle hover:text-ink disabled:opacity-50"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="min-h-[40px] rounded-lg bg-accent px-4 py-1.5 text-xs font-semibold text-accent-fg hover:bg-accent-hover disabled:opacity-50"
            >
              {submitting ? 'Menyimpan...' : isPopMode ? 'Simpan POP' : 'Simpan Site Pelanggan'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
