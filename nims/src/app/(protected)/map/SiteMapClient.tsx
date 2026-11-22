'use client';

import { useMemo, useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  IconClose,
  IconEdit,
  IconExternalLink,
  IconGeoMap,
  IconPlus,
  IconPopBuilding,
  IconServer,
  IconSitePin,
} from '@/components/Icons';
import { CoordinateFields } from '@/components/CoordinateFields';
import { useFeedback } from '@/components/FeedbackProvider';
import {
  buildGoogleMapsUrl,
  formatCoordinates,
  haversineDistanceKm,
  parseGeoInputs,
} from '@/lib/geo';

export interface MapSiteItem {
  id: number;
  siteCode: string;
  name: string;
  siteType: string;
  address: string | null;
  city: string | null;
  province: string | null;
  latitude: number | null;
  longitude: number | null;
  status: string;
  parentSiteId: number | null;
  parentSite: {
    id: number;
    siteCode: string;
    name: string;
    latitude: number | null;
    longitude: number | null;
  } | null;
  deviceCount: number;
  rackCount: number;
  childSiteCount: number;
}

interface Props {
  initialSites: MapSiteItem[];
  canManageSites: boolean;
  initialSiteId?: number | null;
}

const SITE_TYPE_LABELS: Record<string, string> = {
  pop: 'POP Induk',
  customer_site: 'Site Pelanggan',
  dc: 'Data Center',
  office: 'Kantor',
  other: 'Lainnya',
};

function formatLatLabel(lat: number): string {
  return `${Math.abs(lat).toFixed(2)}° ${lat < 0 ? 'LS' : 'LU'}`;
}

function formatLngLabel(lng: number): string {
  return `${Math.abs(lng).toFixed(2)}° ${lng < 0 ? 'BB' : 'BT'}`;
}

export function SiteMapClient({
  initialSites,
  canManageSites,
  initialSiteId = null,
}: Props) {
  const router = useRouter();
  const { toast } = useFeedback();
  const [sites, setSites] = useState<MapSiteItem[]>(initialSites);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [popFilter, setPopFilter] = useState('');
  const [listTab, setListTab] = useState<'mapped' | 'unmapped'>(() => {
    const initial = initialSiteId
      ? initialSites.find((s) => s.id === initialSiteId)
      : null;
    if (initial && (initial.latitude == null || initial.longitude == null)) {
      return 'unmapped';
    }
    return 'mapped';
  });

  const [selectedSiteId, setSelectedSiteId] = useState<number | null>(() => {
    if (initialSiteId && initialSites.some((s) => s.id === initialSiteId)) {
      return initialSiteId;
    }
    const firstMapped = initialSites.find((s) => s.latitude != null && s.longitude != null);
    return firstMapped?.id ?? initialSites[0]?.id ?? null;
  });

  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState<{
    startX: number;
    startY: number;
    originX: number;
    originY: number;
  } | null>(null);

  const [editingSite, setEditingSite] = useState<MapSiteItem | null>(null);
  const [editLat, setEditLat] = useState('');
  const [editLng, setEditLng] = useState('');
  const [savingCoords, setSavingCoords] = useState(false);

  useEffect(() => {
    if (!editingSite) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !savingCoords) {
        setEditingSite(null);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [editingSite, savingCoords]);

  const popOptions = useMemo(
    () => sites.filter((s) => s.siteType === 'pop' || s.parentSiteId === null),
    [sites]
  );

  const filteredSites = useMemo(() => {
    const q = search.trim().toLowerCase();
    return sites.filter((s) => {
      if (typeFilter && s.siteType !== typeFilter) return false;
      if (popFilter) {
        const pid = Number(popFilter);
        if (s.id !== pid && s.parentSiteId !== pid) return false;
      }
      if (q) {
        const hay = `${s.siteCode} ${s.name} ${s.city || ''} ${s.address || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [sites, search, typeFilter, popFilter]);

  const mappedSites = useMemo(
    () => filteredSites.filter((s) => s.latitude != null && s.longitude != null),
    [filteredSites]
  );

  const unmappedSites = useMemo(
    () => filteredSites.filter((s) => s.latitude == null || s.longitude == null),
    [filteredSites]
  );

  const siteById = useMemo(() => new Map(sites.map((s) => [s.id, s])), [sites]);

  const selectedSite = selectedSiteId ? siteById.get(selectedSiteId) ?? null : null;

  const selectedParentDistanceKm = useMemo(() => {
    if (!selectedSite || selectedSite.latitude == null || selectedSite.longitude == null) {
      return null;
    }
    const parent = selectedSite.parentSiteId ? siteById.get(selectedSite.parentSiteId) : null;
    if (!parent || parent.latitude == null || parent.longitude == null) {
      return null;
    }
    return haversineDistanceKm(
      parent.latitude,
      parent.longitude,
      selectedSite.latitude,
      selectedSite.longitude
    );
  }, [selectedSite, siteById]);

  const mappedConnectionsCount = useMemo(() => {
    return mappedSites.filter((s) => {
      if (!s.parentSiteId) return false;
      const parent = siteById.get(s.parentSiteId);
      return Boolean(parent && parent.latitude != null && parent.longitude != null);
    }).length;
  }, [mappedSites, siteById]);

  // Hitung bounding box terkalibrasi cos(meanLat) agar proporsi geografis realistis
  const mapBounds = useMemo(() => {
    const SVG_W = 860;
    const SVG_H = 520;
    const PAD_X = 68;
    const PAD_Y = 54;

    if (mappedSites.length === 0) {
      return {
        width: SVG_W,
        height: SVG_H,
        minLat: -7.5,
        maxLat: -6.0,
        minLng: 106.5,
        maxLng: 108.5,
        project: (lat: number, lng: number) => ({
          x: PAD_X + ((lng - 106.5) / 2.0) * (SVG_W - PAD_X * 2),
          y: PAD_Y + (( -6.0 - lat) / 1.5) * (SVG_H - PAD_Y * 2),
        }),
      };
    }

    let minLat = Math.min(...mappedSites.map((s) => s.latitude!));
    let maxLat = Math.max(...mappedSites.map((s) => s.latitude!));
    let minLng = Math.min(...mappedSites.map((s) => s.longitude!));
    let maxLng = Math.max(...mappedSites.map((s) => s.longitude!));

    const latSpanRaw = maxLat - minLat;
    const lngSpanRaw = maxLng - minLng;

    // Tambahkan bantalan minimal saat hanya 1 titik atau titik berdekatan di satu kota
    const padLat = Math.max(latSpanRaw * 0.18, 0.03);
    const padLng = Math.max(lngSpanRaw * 0.18, 0.04);

    minLat -= padLat;
    maxLat += padLat;
    minLng -= padLng;
    maxLng += padLng;

    const meanLat = (minLat + maxLat) / 2;
    const cosLat = Math.max(Math.cos((meanLat * Math.PI) / 180), 0.25);

    const spanLngScaled = (maxLng - minLng) * cosLat;
    const spanLat = maxLat - minLat;

    const drawW = SVG_W - PAD_X * 2;
    const drawH = SVG_H - PAD_Y * 2;
    const scale = Math.min(drawW / spanLngScaled, drawH / spanLat);

    const usedW = spanLngScaled * scale;
    const usedH = spanLat * scale;
    const offsetX = PAD_X + (drawW - usedW) / 2;
    const offsetY = PAD_Y + (drawH - usedH) / 2;

    return {
      width: SVG_W,
      height: SVG_H,
      minLat,
      maxLat,
      minLng,
      maxLng,
      project: (lat: number, lng: number) => ({
        x: offsetX + (lng - minLng) * cosLat * scale,
        y: offsetY + (maxLat - lat) * scale,
      }),
    };
  }, [mappedSites]);

  const openEditCoords = (site: MapSiteItem) => {
    setSelectedSiteId(site.id);
    setEditingSite(site);
    setEditLat(site.latitude != null ? String(site.latitude) : '');
    setEditLng(site.longitude != null ? String(site.longitude) : '');
  };

  const handleSaveCoords = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSite) return;
    const geo = parseGeoInputs(editLat, editLng);
    if (geo.error) {
      toast.error(geo.error);
      return;
    }

    setSavingCoords(true);
    try {
      const res = await fetch(`/api/master/sites/${editingSite.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          latitude: geo.latitude,
          longitude: geo.longitude,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || 'Gagal memperbarui koordinat site');

      setSites((prev) =>
        prev.map((item) =>
          item.id === editingSite.id
            ? {
                ...item,
                latitude: geo.latitude,
                longitude: geo.longitude,
              }
            : item
        )
      );
      toast.success(`Koordinat '${editingSite.name}' berhasil disimpan.`);
      if (geo.latitude != null && geo.longitude != null) {
        setListTab('mapped');
      }
      setEditingSite(null);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Gagal menyimpan koordinat');
    } finally {
      setSavingCoords(false);
    }
  };

  const totalMapped = sites.filter((s) => s.latitude != null && s.longitude != null).length;
  const totalUnmapped = sites.length - totalMapped;

  const activeDirectoryList = listTab === 'mapped' ? mappedSites : unmappedSites;

  return (
    <div className="space-y-5">
      <div className="animate-enter flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-ink">
            Peta Koordinat Lokasi POP & Site
          </h1>
          <p className="mt-1 text-sm text-ink-secondary">
            Pantau sebaran koordinat GPS POP induk, site pelanggan, jarak lurus antar titik, dan tautan Google Maps.
          </p>
        </div>
        <Link
          href="/master"
          className="inline-flex min-h-[42px] items-center gap-2 rounded-lg border border-line bg-surface px-3.5 py-2 text-xs font-semibold text-ink hover:bg-subtle"
        >
          <IconSitePin className="h-4 w-4 text-accent-ink" />
          <span>Kelola Master Site</span>
        </Link>
      </div>

      {/* Ringkasan KPI */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="rounded-xl border border-line bg-surface p-4 shadow-xs">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-muted">
            Total Site Terdaftar
          </p>
          <p className="mt-1 text-2xl font-bold text-ink tabular-nums-data">{sites.length}</p>
        </div>
        <div className="rounded-xl border border-line bg-surface p-4 shadow-xs">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-muted">
            Sudah Terpetakan
          </p>
          <p className="mt-1 text-2xl font-bold text-accent-ink tabular-nums-data">{totalMapped}</p>
        </div>
        <div className="rounded-xl border border-line bg-surface p-4 shadow-xs">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-muted">
            Belum Ada Koordinat
          </p>
          <p className="mt-1 text-2xl font-bold text-amber-600 dark:text-amber-400 tabular-nums-data">
            {totalUnmapped}
          </p>
        </div>
        <div className="rounded-xl border border-line bg-surface p-4 shadow-xs">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-muted">
            Relasi POP-Site di Peta
          </p>
          <p className="mt-1 text-2xl font-bold text-ink tabular-nums-data">
            {mappedConnectionsCount}
          </p>
        </div>
      </div>

      {/* Bar Filter */}
      <div className="grid grid-cols-1 gap-3 rounded-xl border border-line bg-surface p-4 shadow-xs sm:grid-cols-3 text-xs">
        <div>
          <label htmlFor="map-search" className="block font-semibold text-ink-secondary mb-1">
            Cari Lokasi
          </label>
          <input
            id="map-search"
            type="text"
            placeholder="Kode site, nama, kota, alamat..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="min-h-[40px] w-full rounded-lg border border-line bg-canvas px-3 py-1.5 text-ink placeholder-ink-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
          />
        </div>
        <div>
          <label htmlFor="map-type" className="block font-semibold text-ink-secondary mb-1">
            Tipe Lokasi
          </label>
          <select
            id="map-type"
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="min-h-[40px] w-full rounded-lg border border-line bg-canvas px-3 py-1.5 text-ink focus:border-accent focus:outline-none"
          >
            <option value="">Semua Tipe</option>
            <option value="pop">POP Induk</option>
            <option value="customer_site">Site Pelanggan</option>
            <option value="dc">Data Center</option>
            <option value="office">Kantor</option>
          </select>
        </div>
        <div>
          <label htmlFor="map-pop" className="block font-semibold text-ink-secondary mb-1">
            Filter POP Induk
          </label>
          <select
            id="map-pop"
            value={popFilter}
            onChange={(e) => setPopFilter(e.target.value)}
            className="min-h-[40px] w-full rounded-lg border border-line bg-canvas px-3 py-1.5 text-ink focus:border-accent focus:outline-none"
          >
            <option value="">Semua POP</option>
            {popOptions.map((pop) => (
              <option key={pop.id} value={pop.id}>
                {pop.siteCode} - {pop.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Layout Utama: Peta SVG + Inspector & Daftar Site */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        {/* Peta Koordinat Interaktif */}
        <div className="lg:col-span-8 flex flex-col overflow-hidden rounded-xl border border-line bg-surface shadow-xs">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line bg-subtle/50 px-4 py-2.5 text-xs">
            <div className="flex flex-wrap items-center gap-3">
              <span className="inline-flex items-center gap-1.5 font-semibold text-ink">
                <IconGeoMap className="h-4 w-4 text-accent-ink" />
                <span>Bidang Koordinat ({mappedSites.length} titik)</span>
              </span>
              <span className="inline-flex items-center gap-1.5 text-[11px] text-ink-secondary">
                <span className="h-2.5 w-2.5 rounded-sm bg-accent" />
                POP / DC
              </span>
              <span className="inline-flex items-center gap-1.5 text-[11px] text-ink-secondary">
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-600" />
                Site Pelanggan
              </span>
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                aria-label="Perbesar peta"
                onClick={() => setZoom((z) => Math.min(4, Number((z * 1.25).toFixed(2))))}
                className="min-h-[32px] min-w-[32px] rounded-md border border-line bg-surface px-2 font-bold text-ink hover:bg-subtle"
              >
                +
              </button>
              <button
                type="button"
                aria-label="Perkecil peta"
                onClick={() => setZoom((z) => Math.max(0.6, Number((z / 1.25).toFixed(2))))}
                className="min-h-[32px] min-w-[32px] rounded-md border border-line bg-surface px-2 font-bold text-ink hover:bg-subtle"
              >
                -
              </button>
              <button
                type="button"
                onClick={() => {
                  setZoom(1);
                  setPan({ x: 0, y: 0 });
                }}
                className="min-h-[32px] rounded-md border border-line bg-surface px-2.5 text-[11px] font-semibold text-ink-secondary hover:bg-subtle hover:text-ink"
              >
                Reset Tampilan
              </button>
            </div>
          </div>

          <div
            className="relative flex-1 min-h-[380px] select-none overflow-hidden bg-canvas"
            onPointerDown={(e) => {
              if ((e.target as HTMLElement).closest('[data-pin="true"]')) return;
              setDragging({
                startX: e.clientX,
                startY: e.clientY,
                originX: pan.x,
                originY: pan.y,
              });
            }}
            onPointerMove={(e) => {
              if (!dragging) return;
              setPan({
                x: dragging.originX + (e.clientX - dragging.startX),
                y: dragging.originY + (e.clientY - dragging.startY),
              });
            }}
            onPointerUp={() => setDragging(null)}
            onPointerLeave={() => setDragging(null)}
          >
            <svg
              viewBox={`0 0 ${mapBounds.width} ${mapBounds.height}`}
              role="img"
              aria-label="Peta sebaran koordinat POP dan Site Pelanggan"
              className={`h-full w-full ${dragging ? 'cursor-grabbing' : 'cursor-grab'}`}
            >
              {/* Grid Graticule Lat/Lng */}
              {[0.2, 0.4, 0.6, 0.8].map((ratio) => {
                const gx = 68 + ratio * (mapBounds.width - 136);
                const gy = 54 + ratio * (mapBounds.height - 108);
                const lngVal = mapBounds.minLng + ratio * (mapBounds.maxLng - mapBounds.minLng);
                const latVal = mapBounds.maxLat - ratio * (mapBounds.maxLat - mapBounds.minLat);
                return (
                  <g key={ratio}>
                    <line
                      x1={gx}
                      y1={24}
                      x2={gx}
                      y2={mapBounds.height - 26}
                      stroke="currentColor"
                      className="text-line"
                      strokeDasharray="4 4"
                      strokeWidth="1"
                    />
                    <text
                      x={gx}
                      y={mapBounds.height - 8}
                      textAnchor="middle"
                      className="fill-ink-muted text-[10px] font-mono"
                    >
                      {formatLngLabel(lngVal)}
                    </text>
                    <line
                      x1={52}
                      y1={gy}
                      x2={mapBounds.width - 16}
                      y2={gy}
                      stroke="currentColor"
                      className="text-line"
                      strokeDasharray="4 4"
                      strokeWidth="1"
                    />
                    <text
                      x={46}
                      y={gy + 3}
                      textAnchor="end"
                      className="fill-ink-muted text-[10px] font-mono"
                    >
                      {formatLatLabel(latVal)}
                    </text>
                  </g>
                );
              })}

              <g
                transform={`translate(${mapBounds.width / 2 + pan.x}, ${
                  mapBounds.height / 2 + pan.y
                }) scale(${zoom}) translate(${-mapBounds.width / 2}, ${-mapBounds.height / 2})`}
              >
                {/* Garis Koneksi POP Induk ke Site Pelanggan */}
                {mappedSites.map((site) => {
                  if (!site.parentSiteId || site.latitude == null || site.longitude == null) {
                    return null;
                  }
                  const parent = siteById.get(site.parentSiteId);
                  if (!parent || parent.latitude == null || parent.longitude == null) {
                    return null;
                  }
                  const p1 = mapBounds.project(parent.latitude, parent.longitude);
                  const p2 = mapBounds.project(site.latitude, site.longitude);
                  const isHighlighted =
                    selectedSiteId === site.id || selectedSiteId === parent.id;
                  const distKm = haversineDistanceKm(
                    parent.latitude,
                    parent.longitude,
                    site.latitude,
                    site.longitude
                  );
                  return (
                    <g key={`link-${parent.id}-${site.id}`}>
                      <line
                        x1={p1.x}
                        y1={p1.y}
                        x2={p2.x}
                        y2={p2.y}
                        stroke="currentColor"
                        className={isHighlighted ? 'text-accent' : 'text-line-strong'}
                        strokeWidth={isHighlighted ? 2.4 / zoom : 1.5 / zoom}
                        strokeDasharray="5 4"
                      />
                      {isHighlighted && (
                        <text
                          x={(p1.x + p2.x) / 2}
                          y={(p1.y + p2.y) / 2 - 6 / zoom}
                          textAnchor="middle"
                          fontSize={10 / zoom}
                          className="fill-accent-ink font-mono font-bold"
                        >
                          {distKm.toFixed(1)} km
                        </text>
                      )}
                    </g>
                  );
                })}

                {/* Penanda Lokasi Site */}
                {mappedSites.map((site) => {
                  if (site.latitude == null || site.longitude == null) return null;
                  const pos = mapBounds.project(site.latitude, site.longitude);
                  const isPop = site.siteType === 'pop' || site.siteType === 'dc';
                  const isSelected = selectedSiteId === site.id;
                  const invScale = 1 / zoom;

                  return (
                    <g
                      key={site.id}
                      data-pin="true"
                      role="button"
                      tabIndex={0}
                      aria-label={`Pilih lokasi ${site.name} (${site.siteCode})`}
                      transform={`translate(${pos.x}, ${pos.y}) scale(${invScale})`}
                      onClick={() => setSelectedSiteId(site.id)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          setSelectedSiteId(site.id);
                        }
                      }}
                      className="cursor-pointer focus:outline-none"
                    >
                      {isSelected && (
                        <circle
                          r={16}
                          fill="none"
                          stroke="currentColor"
                          strokeWidth={2}
                          className="text-accent"
                        />
                      )}
                      {isPop ? (
                        <rect
                          x={-8}
                          y={-8}
                          width={16}
                          height={16}
                          rx={4}
                          className="fill-accent stroke-white dark:stroke-slate-950"
                          strokeWidth={2}
                        />
                      ) : (
                        <circle
                          r={7}
                          className="fill-emerald-600 stroke-white dark:stroke-slate-950"
                          strokeWidth={2}
                        />
                      )}
                      <text
                        y={-13}
                        textAnchor="middle"
                        className={`text-[11px] font-mono ${
                          isSelected ? 'fill-accent-ink font-bold' : 'fill-ink font-semibold'
                        }`}
                      >
                        {site.siteCode}
                      </text>
                    </g>
                  );
                })}
              </g>
            </svg>

            {mappedSites.length === 0 && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-canvas/85 p-6 text-center">
                <IconGeoMap className="h-10 w-10 text-ink-muted" />
                <p className="mt-2 text-sm font-semibold text-ink">
                  Belum ada site terpetakan sesuai filter ini
                </p>
                <p className="mt-1 max-w-md text-xs text-ink-secondary">
                  Pilih site pada panel sebelah kanan tab <strong>Belum Ada Koordinat</strong> lalu atur Latitude & Longitude untuk memunculkan titik lokasi di peta.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Panel Kanan: Inspector + Daftar Terpetakan / Belum Ada Koordinat */}
        <div className="lg:col-span-4 space-y-4">
          {selectedSite && (
            <div className="rounded-xl border border-line bg-surface p-4 shadow-xs space-y-3">
              <div className="flex items-start justify-between gap-2 border-b border-line pb-2.5">
                <div>
                  <span className="inline-flex rounded bg-accent-soft px-2 py-0.5 font-mono text-[11px] font-semibold text-accent-ink">
                    {selectedSite.siteCode}
                  </span>
                  <h2 className="mt-1 text-base font-bold text-ink">{selectedSite.name}</h2>
                  <p className="text-xs text-ink-secondary">
                    {SITE_TYPE_LABELS[selectedSite.siteType] || selectedSite.siteType}
                    {selectedSite.parentSite
                      ? ` di bawah ${selectedSite.parentSite.siteCode}`
                      : ''}
                  </p>
                </div>
                {canManageSites && (
                  <button
                    type="button"
                    onClick={() => openEditCoords(selectedSite)}
                    className="inline-flex min-h-[34px] items-center gap-1 rounded-md border border-line bg-canvas px-2.5 py-1 text-[11px] font-semibold text-accent-ink hover:border-accent hover:bg-accent-soft"
                  >
                    <IconEdit className="h-3.5 w-3.5" />
                    <span>
                      {selectedSite.latitude != null ? 'Edit GPS' : 'Atur GPS'}
                    </span>
                  </button>
                )}
              </div>

              <dl className="space-y-1.5 text-xs">
                <div className="flex justify-between gap-2">
                  <dt className="text-ink-muted">Alamat</dt>
                  <dd className="text-right text-ink">
                    {[selectedSite.address, selectedSite.city, selectedSite.province]
                      .filter(Boolean)
                      .join(', ') || '-'}
                  </dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-ink-muted">Koordinat GPS</dt>
                  <dd className="font-mono text-ink">
                    {formatCoordinates(selectedSite.latitude, selectedSite.longitude) || (
                      <span className="font-sans italic text-ink-muted">Belum diatur</span>
                    )}
                  </dd>
                </div>
                {selectedParentDistanceKm !== null && (
                  <div className="flex justify-between gap-2">
                    <dt className="text-ink-muted">Jarak ke POP Induk</dt>
                    <dd className="font-mono font-semibold text-accent-ink">
                      {selectedParentDistanceKm.toFixed(2)} km
                    </dd>
                  </div>
                )}
                <div className="flex justify-between gap-2">
                  <dt className="text-ink-muted">Aset Terpasang</dt>
                  <dd className="inline-flex items-center gap-2 text-ink tabular-nums-data">
                    <span className="inline-flex items-center gap-1">
                      <IconServer className="h-3.5 w-3.5 text-ink-muted" />
                      {selectedSite.deviceCount} perangkat
                    </span>
                    <span className="text-ink-muted">|</span>
                    <span>{selectedSite.rackCount} rak</span>
                  </dd>
                </div>
              </dl>

              <div className="flex flex-wrap gap-2 pt-1">
                {selectedSite.latitude != null && selectedSite.longitude != null && (
                  <a
                    href={buildGoogleMapsUrl(selectedSite.latitude, selectedSite.longitude)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex min-h-[38px] flex-1 items-center justify-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-accent-fg hover:bg-accent-hover"
                  >
                    <span>Buka Google Maps</span>
                    <IconExternalLink className="h-3.5 w-3.5" />
                  </a>
                )}
                <Link
                  href="/devices"
                  className="inline-flex min-h-[38px] flex-1 items-center justify-center gap-1.5 rounded-lg border border-line bg-canvas px-3 py-1.5 text-xs font-semibold text-ink hover:bg-subtle"
                >
                  <IconPopBuilding className="h-3.5 w-3.5 text-ink-muted" />
                  <span>Inventaris</span>
                </Link>
              </div>
            </div>
          )}

          {/* Daftar Site Terpetakan / Belum Ada Koordinat */}
          <div className="overflow-hidden rounded-xl border border-line bg-surface shadow-xs">
            <div className="grid grid-cols-2 border-b border-line text-xs font-semibold">
              <button
                type="button"
                onClick={() => setListTab('mapped')}
                className={`min-h-[40px] border-b-2 px-3 py-2 transition-colors ${
                  listTab === 'mapped'
                    ? 'border-accent text-accent-ink bg-accent-soft/40'
                    : 'border-transparent text-ink-secondary hover:text-ink'
                }`}
              >
                Terpetakan ({mappedSites.length})
              </button>
              <button
                type="button"
                onClick={() => setListTab('unmapped')}
                className={`min-h-[40px] border-b-2 px-3 py-2 transition-colors ${
                  listTab === 'unmapped'
                    ? 'border-accent text-accent-ink bg-accent-soft/40'
                    : 'border-transparent text-ink-secondary hover:text-ink'
                }`}
              >
                Belum Ada GPS ({unmappedSites.length})
              </button>
            </div>

            <div className="max-h-[340px] divide-y divide-line overflow-y-auto">
              {activeDirectoryList.length === 0 ? (
                <div className="p-6 text-center text-xs text-ink-secondary">
                  {listTab === 'mapped'
                    ? 'Tidak ada site yang sudah memiliki koordinat GPS.'
                    : 'Semua site sudah memiliki koordinat GPS.'}
                </div>
              ) : (
                activeDirectoryList.map((site) => {
                  const isActive = selectedSiteId === site.id;
                  const coordLabel = formatCoordinates(site.latitude, site.longitude, 4);
                  return (
                    <div
                      key={site.id}
                      className={`flex items-center justify-between gap-2 p-3 text-xs transition-colors ${
                        isActive ? 'bg-accent-soft/45' : 'hover:bg-subtle/60'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => setSelectedSiteId(site.id)}
                        className="min-w-0 flex-1 text-left"
                      >
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono font-bold text-accent-ink">
                            {site.siteCode}
                          </span>
                          <span className="text-[10px] uppercase text-ink-muted">
                            {SITE_TYPE_LABELS[site.siteType] || site.siteType}
                          </span>
                        </div>
                        <p className="truncate font-semibold text-ink">{site.name}</p>
                        <p className="truncate font-mono text-[11px] text-ink-muted">
                          {coordLabel || site.city || 'Belum ada koordinat GPS'}
                        </p>
                      </button>

                      {canManageSites && (
                        <button
                          type="button"
                          onClick={() => openEditCoords(site)}
                          className="inline-flex min-h-[32px] shrink-0 items-center gap-1 rounded-md border border-line bg-canvas px-2.5 py-1 text-[11px] font-semibold text-accent-ink hover:border-accent hover:bg-accent-soft"
                        >
                          <IconPlus className="h-3 w-3" />
                          <span>{site.latitude != null ? 'Ubah' : 'Atur'}</span>
                        </button>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Modal Edit Koordinat Site */}
      {editingSite && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="edit-coord-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 animate-backdrop"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget && !savingCoords) setEditingSite(null);
          }}
        >
          <div className="w-full max-w-md rounded-xl border border-line bg-elevated p-5 shadow-2xl space-y-4 animate-modal">
            <div className="flex items-start justify-between gap-3 border-b border-line pb-3">
              <div>
                <h2 id="edit-coord-title" className="text-sm font-bold text-ink">
                  Atur Koordinat GPS Lokasi
                </h2>
                <p className="text-xs text-ink-secondary">
                  {editingSite.name} ({editingSite.siteCode})
                </p>
              </div>
              <button
                type="button"
                disabled={savingCoords}
                onClick={() => setEditingSite(null)}
                aria-label="Tutup dialog"
                className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-muted hover:bg-subtle hover:text-ink"
              >
                <IconClose className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSaveCoords} className="space-y-4">
              <CoordinateFields
                latId="map-edit-lat"
                lngId="map-edit-lng"
                latitude={editLat}
                longitude={editLng}
                onChange={({ latitude, longitude }) => {
                  setEditLat(latitude);
                  setEditLng(longitude);
                }}
                disabled={savingCoords}
              />

              <div className="flex justify-end gap-2 border-t border-line pt-3">
                <button
                  type="button"
                  disabled={savingCoords}
                  onClick={() => setEditingSite(null)}
                  className="min-h-[38px] rounded-lg border border-line bg-surface px-3.5 py-1.5 text-xs font-medium text-ink-secondary hover:bg-subtle hover:text-ink disabled:opacity-50"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={savingCoords}
                  className="min-h-[38px] rounded-lg bg-accent px-4 py-1.5 text-xs font-semibold text-accent-fg hover:bg-accent-hover disabled:opacity-50"
                >
                  {savingCoords ? 'Menyimpan...' : 'Simpan Koordinat'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
