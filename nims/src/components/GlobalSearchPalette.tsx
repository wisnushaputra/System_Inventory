'use client';

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  IconSearch,
  IconClose,
  IconArrowRight,
  IconSubnetGlobe,
  IconSitePin,
  IconLinkCable,
  IconGeoMap,
  DeviceCategoryIcon,
} from './Icons';

interface DeviceHit {
  id: number;
  deviceCode: string;
  hostname: string;
  serialNumber: string | null;
  inventoryStatus: string;
  archived: boolean;
  categoryCode: string;
  categoryName: string;
  siteCode: string;
  siteName: string;
  managementIp: string | null;
}

interface IpHit {
  id: number;
  address: string;
  allocationStatus: string;
  purpose: string;
  hostname: string | null;
  deviceId: number | null;
  device: { id: number; hostname: string; deviceCode: string } | null;
  subnet: { id: number; name: string; cidr: string };
}

interface SubnetHit {
  id: number;
  name: string;
  cidr: string;
  purpose: string;
  status: string;
  vlanId: number | null;
  site: { siteCode: string; name: string } | null;
}

interface SiteHit {
  id: number;
  siteCode: string;
  name: string;
  siteType: string;
  city: string | null;
  parentSite: { siteCode: string; name: string } | null;
}

interface PortHit {
  id: number;
  name: string;
  label: string | null;
  macAddress: string | null;
  vlanId: number | null;
  deviceId: number;
  device: { id: number; hostname: string; deviceCode: string };
}

interface SearchResults {
  devices: DeviceHit[];
  ipAddresses: IpHit[];
  subnets: SubnetHit[];
  sites: SiteHit[];
  ports: PortHit[];
}

interface PaletteEntry {
  key: string;
  group: string;
  href: string;
  title: string;
  subtitle: string;
  badge?: string;
  icon: React.ReactNode;
}

interface Props {
  onClose: () => void;
  canViewIpam: boolean;
  canViewAudit: boolean;
  canManageUsers: boolean;
}

const EMPTY_RESULTS: SearchResults = {
  devices: [],
  ipAddresses: [],
  subnets: [],
  sites: [],
  ports: [],
};

export function GlobalSearchPalette({
  onClose,
  canViewIpam,
  canViewAudit,
  canManageUsers,
}: Props) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResults>(EMPTY_RESULTS);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    const focusTimer = window.setTimeout(() => {
      inputRef.current?.focus();
    }, 20);
    return () => window.clearTimeout(focusTimer);
  }, []);

  const handleQueryChange = (nextQuery: string) => {
    setQuery(nextQuery);
    setActiveIndex(0);
    if (nextQuery.trim().length < 2) {
      setResults(EMPTY_RESULTS);
      setLoading(false);
      setError(null);
    }
  };

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) return;

    const controller = new AbortController();
    const debounce = window.setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(trimmed)}`, {
          signal: controller.signal,
        });
        if (!res.ok) {
          throw new Error('Gagal mencari data inventaris.');
        }
        const json = await res.json();
        setResults(json.results || EMPTY_RESULTS);
        setActiveIndex(0);
      } catch (err: unknown) {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        setError(err instanceof Error ? err.message : 'Terjadi kesalahan saat pencarian.');
      } finally {
        setLoading(false);
      }
    }, 180);

    return () => {
      window.clearTimeout(debounce);
      controller.abort();
    };
  }, [query]);

  const quickNavEntries = useMemo<PaletteEntry[]>(() => {
    const items: PaletteEntry[] = [
      {
        key: 'nav-dashboard',
        group: 'Navigasi Cepat',
        href: '/dashboard',
        title: 'Dashboard Operasional',
        subtitle: 'Ringkasan aset jaringan dan audit kelengkapan',
        icon: <IconArrowRight className="h-4 w-4" />,
      },
      {
        key: 'nav-devices',
        group: 'Navigasi Cepat',
        href: '/devices',
        title: 'Inventaris Perangkat',
        subtitle: 'Daftar router, switch, OLT, ONT, dan radio POP/Customer',
        icon: <DeviceCategoryIcon code="router" className="h-4 w-4" />,
      },
    ];
    if (canViewIpam) {
      items.push({
        key: 'nav-ipam',
        group: 'Navigasi Cepat',
        href: '/ipam',
        title: 'Manajemen IPAM & Subnet',
        subtitle: 'Kelola blok CIDR, utilisasi, dan alokasi alamat IP',
        icon: <IconSubnetGlobe className="h-4 w-4" />,
      });
    }
    items.push(
      {
        key: 'nav-topology',
        group: 'Navigasi Cepat',
        href: '/topology',
        title: 'Topologi Relasi Jaringan',
        subtitle: 'Peta koneksi POP, site pelanggan, dan port fisik/logis',
        icon: <IconLinkCable className="h-4 w-4" />,
      },
      {
        key: 'nav-map',
        group: 'Navigasi Cepat',
        href: '/map',
        title: 'Peta Koordinat Lokasi POP & Site',
        subtitle: 'Visualisasi koordinat GPS POP, site pelanggan, dan jarak lurus',
        icon: <IconGeoMap className="h-4 w-4" />,
      },
      {
        key: 'nav-master',
        group: 'Navigasi Cepat',
        href: '/master',
        title: 'Master Data Infrastruktur',
        subtitle: 'Site POP/Customer, ruangan, rak, vendor, dan model',
        icon: <IconSitePin className="h-4 w-4" />,
      }
    );
    if (canManageUsers) {
      items.push({
        key: 'nav-users',
        group: 'Navigasi Cepat',
        href: '/users',
        title: 'Manajemen Pengguna',
        subtitle: 'Kelola akun operator, role, dan reset kata sandi',
        icon: <IconArrowRight className="h-4 w-4" />,
      });
    }
    if (canViewAudit) {
      items.push({
        key: 'nav-audit',
        group: 'Navigasi Cepat',
        href: '/audit-logs',
        title: 'Jejak Audit Sistem',
        subtitle: 'Log perubahan inventaris, IPAM, dan otorisasi',
        icon: <IconArrowRight className="h-4 w-4" />,
      });
    }
    return items;
  }, [canViewIpam, canViewAudit, canManageUsers]);

  const searchEntries = useMemo<PaletteEntry[]>(() => {
    const entries: PaletteEntry[] = [];

    for (const d of results.devices) {
      entries.push({
        key: `dev-${d.id}`,
        group: 'Perangkat',
        href: `/devices/${d.id}`,
        title: `${d.hostname} (${d.deviceCode})`,
        subtitle: `${d.categoryName} | ${d.siteCode} - ${d.siteName}${
          d.managementIp ? ` | IP: ${d.managementIp}` : ''
        }${d.serialNumber ? ` | SN: ${d.serialNumber}` : ''}`,
        badge: d.archived ? 'ARSIP' : d.inventoryStatus,
        icon: <DeviceCategoryIcon code={d.categoryCode} className="h-4 w-4" />,
      });
    }

    for (const ip of results.ipAddresses) {
      entries.push({
        key: `ip-${ip.id}`,
        group: 'Alamat IP',
        href: ip.deviceId
          ? `/devices/${ip.deviceId}?tab=network`
          : `/ipam?tab=addresses&q=${encodeURIComponent(ip.address)}`,
        title: ip.address,
        subtitle: `${ip.subnet.cidr} (${ip.subnet.name})${
          ip.device ? ` -> ${ip.device.hostname}` : ''
        }${ip.hostname ? ` | ${ip.hostname}` : ''}`,
        badge: ip.allocationStatus,
        icon: <IconSubnetGlobe className="h-4 w-4" />,
      });
    }

    for (const s of results.subnets) {
      entries.push({
        key: `sub-${s.id}`,
        group: 'Subnet IPAM',
        href: `/ipam?tab=addresses&subnetId=${s.id}`,
        title: `${s.cidr} - ${s.name}`,
        subtitle: `${s.purpose.toUpperCase()}${s.vlanId ? ` | VLAN ${s.vlanId}` : ''}${
          s.site ? ` | ${s.site.siteCode}` : ''
        }`,
        badge: s.status.toUpperCase(),
        icon: <IconSubnetGlobe className="h-4 w-4" />,
      });
    }

    for (const p of results.ports) {
      entries.push({
        key: `port-${p.id}`,
        group: 'Port & Interface',
        href: `/devices/${p.deviceId}?tab=ports`,
        title: `${p.name} pada ${p.device.hostname}`,
        subtitle: `${p.device.deviceCode}${p.label ? ` | ${p.label}` : ''}${
          p.macAddress ? ` | MAC: ${p.macAddress}` : ''
        }${p.vlanId ? ` | VLAN ${p.vlanId}` : ''}`,
        icon: <IconLinkCable className="h-4 w-4" />,
      });
    }

    for (const site of results.sites) {
      entries.push({
        key: `site-${site.id}`,
        group: 'Site & POP',
        href: '/master',
        title: `${site.siteCode} - ${site.name}`,
        subtitle: `${site.siteType === 'pop' ? 'POP Induk' : 'Site Pelanggan'}${
          site.parentSite ? ` (${site.parentSite.siteCode})` : ''
        }${site.city ? ` | ${site.city}` : ''}`,
        icon: <IconSitePin className="h-4 w-4" />,
      });
    }

    return entries;
  }, [results]);

  const isSearchMode = query.trim().length >= 2;
  const visibleEntries = isSearchMode ? searchEntries : quickNavEntries;

  const groupedEntries = useMemo(() => {
    const groups: { name: string; items: { entry: PaletteEntry; flatIndex: number }[] }[] = [];
    const map = new Map<string, { entry: PaletteEntry; flatIndex: number }[]>();
    visibleEntries.forEach((entry, idx) => {
      const list = map.get(entry.group);
      const item = { entry, flatIndex: idx };
      if (list) {
        list.push(item);
      } else {
        const nextList = [item];
        map.set(entry.group, nextList);
        groups.push({ name: entry.group, items: nextList });
      }
    });
    return groups;
  }, [visibleEntries]);

  const navigateToEntry = useCallback(
    (entry: PaletteEntry) => {
      onClose();
      router.push(entry.href);
    },
    [onClose, router]
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
      return;
    }
    if (visibleEntries.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((prev) => (prev + 1) % visibleEntries.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((prev) => (prev - 1 + visibleEntries.length) % visibleEntries.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const target = visibleEntries[activeIndex] || visibleEntries[0];
      if (target) navigateToEntry(target);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[75] flex items-start justify-center bg-slate-950/60 p-4 pt-12 sm:pt-20 animate-backdrop"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Pencarian Global Passnet Inventory Sistem"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
        className="w-full max-w-2xl overflow-hidden rounded-xl border border-line bg-elevated shadow-2xl animate-modal text-xs"
      >
        <div className="flex items-center gap-2.5 border-b border-line px-4 py-3">
          <IconSearch className="h-4 w-4 shrink-0 text-accent" />
          <label htmlFor="global-search-input" className="sr-only">
            Cari perangkat, IP, subnet, port, atau site
          </label>
          <input
            ref={inputRef}
            id="global-search-input"
            type="text"
            value={query}
            onChange={(e) => handleQueryChange(e.target.value)}
            placeholder="Cari IP address, hostname, SN, CIDR, nama port, atau site..."
            className="min-h-[36px] w-full bg-transparent text-sm text-ink placeholder-ink-muted focus:outline-none"
          />
          {query && (
            <button
              type="button"
              onClick={() => handleQueryChange('')}
              className="rounded-md px-2 py-1 text-[11px] font-medium text-ink-muted hover:bg-subtle hover:text-ink"
            >
              Bersihkan
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup pencarian"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-ink-muted hover:bg-subtle hover:text-ink"
          >
            <IconClose className="h-4 w-4" />
          </button>
        </div>

        <div className="max-h-[60vh] overflow-y-auto p-2.5 space-y-3">
          {error ? (
            <div
              role="alert"
              className="rounded-lg border border-rose-200 dark:border-rose-900/60 bg-rose-50 dark:bg-rose-950/50 p-3 text-rose-800 dark:text-rose-200"
            >
              {error}
            </div>
          ) : loading ? (
            <div className="py-8 text-center text-ink-secondary">
              Mencari di seluruh inventaris...
            </div>
          ) : isSearchMode && visibleEntries.length === 0 ? (
            <div className="py-8 px-4 text-center text-ink-secondary space-y-1">
              <p className="font-semibold text-ink">
                Tidak ada hasil untuk &ldquo;{query.trim()}&rdquo;.
              </p>
              <p className="text-[11px] text-ink-muted">
                Coba kata kunci lain seperti alamat IP, kode perangkat, nomor seri, CIDR, atau kode site.
              </p>
            </div>
          ) : (
            groupedEntries.map((group) => (
              <div key={group.name} className="space-y-1">
                <p className="px-2.5 text-[10px] font-bold uppercase tracking-wider text-ink-muted">
                  {group.name}
                </p>
                <div className="space-y-0.5">
                  {group.items.map(({ entry, flatIndex }) => {
                    const isActive = flatIndex === activeIndex;
                    return (
                      <button
                        key={entry.key}
                        type="button"
                        onMouseEnter={() => setActiveIndex(flatIndex)}
                        onClick={() => navigateToEntry(entry)}
                        className={`flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left transition-colors duration-100 ${
                          isActive
                            ? 'bg-accent-soft text-accent-ink'
                            : 'text-ink hover:bg-subtle'
                        }`}
                      >
                        <div className="flex min-w-0 items-center gap-3">
                          <span
                            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md ${
                              isActive
                                ? 'bg-surface text-accent border border-accent/25'
                                : 'bg-subtle text-ink-secondary'
                            }`}
                          >
                            {entry.icon}
                          </span>
                          <div className="min-w-0">
                            <p className="truncate text-xs font-semibold text-ink">
                              {entry.title}
                            </p>
                            <p className="truncate text-[11px] text-ink-secondary">
                              {entry.subtitle}
                            </p>
                          </div>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          {entry.badge && (
                            <span className="rounded bg-surface px-1.5 py-0.5 font-mono text-[10px] font-semibold text-ink-secondary border border-line">
                              {entry.badge}
                            </span>
                          )}
                          <IconArrowRight className="h-3.5 w-3.5 text-ink-muted" />
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line bg-subtle/60 px-4 py-2 text-[11px] text-ink-muted">
          <span>
            {isSearchMode
              ? `Menampilkan ${visibleEntries.length} hasil cocok`
              : 'Ketik minimal 2 karakter untuk mencari lintas modul'}
          </span>
          <span className="hidden sm:inline font-mono">
            Navigasi: Panah Atas/Bawah | Buka: Enter | Tutup: Esc
          </span>
        </div>
      </div>
    </div>
  );
}
