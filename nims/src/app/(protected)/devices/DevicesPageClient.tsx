'use client';

import { useState, useRef, useCallback } from 'react';
import Link from 'next/link';
import {
  DeviceHierarchyView,
  type DeviceHierarchyViewHandle,
  type HierarchyHeaderContext,
} from './DeviceHierarchyView';
import { DeviceListClient } from './DeviceListClient';
import { IconLayers, IconTable, IconDownload, IconUpload, IconPlus } from '@/components/Icons';

export interface DeviceListInitialFilters {
  view?: string;
  q?: string;
  categoryId?: string;
  vendorId?: string;
  siteId?: string;
  inventoryStatus?: string;
  anomaly?: string;
  isArchived?: boolean;
  page?: number;
}

interface Props {
  categories: { id: number; name: string }[];
  vendors: { id: number; name: string }[];
  sites: { id: number; name: string; siteCode: string }[];
  canCreate: boolean;
  canUpdate?: boolean;
  canArchive: boolean;
  canExport?: boolean;
  canManageSites?: boolean;
  initialFilters?: DeviceListInitialFilters;
}

export function DevicesPageClient({
  categories,
  vendors,
  sites,
  canCreate,
  canUpdate = false,
  canArchive,
  canExport = false,
  canManageSites = false,
  initialFilters,
}: Props) {
  const hasGlobalFilterParams = Boolean(
    initialFilters?.view === 'global' ||
      initialFilters?.q ||
      initialFilters?.categoryId ||
      initialFilters?.vendorId ||
      initialFilters?.siteId ||
      initialFilters?.inventoryStatus ||
      initialFilters?.anomaly ||
      initialFilters?.isArchived ||
      (initialFilters?.page && initialFilters.page > 1)
  );
  const [activeTab, setActiveTab] = useState<'hierarchy' | 'global'>(
    hasGlobalFilterParams ? 'global' : 'hierarchy'
  );
  const [hierarchyCtx, setHierarchyCtx] = useState<HierarchyHeaderContext>({ level: 'pop' });
  const hierarchyRef = useRef<DeviceHierarchyViewHandle>(null);

  const handleContextChange = useCallback((ctx: HierarchyHeaderContext) => {
    setHierarchyCtx(ctx);
  }, []);

  const primaryBtnClass =
    'inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg bg-accent px-4 py-2 text-xs font-semibold text-accent-fg shadow-xs transition-[background-color,transform] duration-150 hover:bg-accent-hover active:scale-[0.97]';

  function renderPrimaryActionButton() {
    if (activeTab === 'hierarchy') {
      if (hierarchyCtx.level === 'pop' && canManageSites) {
        return (
          <button
            type="button"
            onClick={() => hierarchyRef.current?.openAddPopModal()}
            className={primaryBtnClass}
          >
            <IconPlus className="h-4 w-4" />
            <span>Tambahkan POP</span>
          </button>
        );
      }
      if (hierarchyCtx.level === 'site' && canManageSites) {
        return (
          <button
            type="button"
            onClick={() => hierarchyRef.current?.openAddCustomerModal()}
            className={primaryBtnClass}
          >
            <IconPlus className="h-4 w-4" />
            <span>Tambahkan Site</span>
          </button>
        );
      }
      if (hierarchyCtx.level === 'devices' && canCreate) {
        const href = hierarchyCtx.siteId
          ? `/devices/new?siteId=${hierarchyCtx.siteId}`
          : '/devices/new';
        return (
          <Link href={href} className={primaryBtnClass}>
            <IconPlus className="h-4 w-4" />
            <span>Tambahkan Perangkat</span>
          </Link>
        );
      }
    }

    if (!canCreate) return null;

    return (
      <Link href="/devices/new" className={primaryBtnClass}>
        <IconPlus className="h-4 w-4" />
        <span>Tambahkan Perangkat</span>
      </Link>
    );
  }

  return (
    <div className="space-y-6">
      <div className="animate-enter flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-ink">Inventaris Perangkat</h1>
          <p className="mt-1 text-sm text-ink-secondary">
            Navigasi bertingkat dari Point of Presence (POP) ke Site Pelanggan dan unit perangkat.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {canExport && (
            <a
              href="/api/export/devices"
              className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg border border-line bg-surface px-3.5 py-2 text-xs font-semibold text-ink-secondary shadow-xs transition-[background-color,border-color,color] duration-150 hover:border-line-strong hover:bg-subtle hover:text-ink"
            >
              <IconDownload className="h-4 w-4" />
              <span>Ekspor CSV</span>
            </a>
          )}
          {canCreate && (
            <Link
              href="/devices/import"
              className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg border border-line bg-surface px-3.5 py-2 text-xs font-semibold text-ink-secondary shadow-xs transition-[background-color,border-color,color] duration-150 hover:border-line-strong hover:bg-subtle hover:text-ink"
            >
              <IconUpload className="h-4 w-4" />
              <span>Impor CSV</span>
            </Link>
          )}
          {renderPrimaryActionButton()}
        </div>
      </div>

      {/* Mode Switcher Tabs */}
      <div className="border-b border-line overflow-x-auto">
        <nav
          role="tablist"
          aria-label="Mode Tampilan Inventaris"
          className="-mb-px flex space-x-6"
        >
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'hierarchy'}
            onClick={() => {
              setActiveTab('hierarchy');
              if (typeof window !== 'undefined') {
                window.history.replaceState(null, '', '/devices');
              }
            }}
            className={`inline-flex min-h-[44px] items-center gap-2 border-b-2 py-2.5 px-1 text-sm font-semibold whitespace-nowrap transition-[color,border-color] duration-150 ${
              activeTab === 'hierarchy'
                ? 'border-accent text-accent-ink'
                : 'border-transparent text-ink-secondary hover:border-line-strong hover:text-ink'
            }`}
          >
            <IconLayers className="h-4 w-4" />
            <span>Navigasi Hierarki (POP ke Site ke Perangkat)</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'global'}
            onClick={() => setActiveTab('global')}
            className={`inline-flex min-h-[44px] items-center gap-2 border-b-2 py-2.5 px-1 text-sm font-semibold whitespace-nowrap transition-[color,border-color] duration-150 ${
              activeTab === 'global'
                ? 'border-accent text-accent-ink'
                : 'border-transparent text-ink-secondary hover:border-line-strong hover:text-ink'
            }`}
          >
            <IconTable className="h-4 w-4" />
            <span>Semua Perangkat (Tabel Global)</span>
          </button>
        </nav>
      </div>

      {/* Tab Panels */}
      {activeTab === 'hierarchy' ? (
        <div key="tab-hierarchy" className="animate-enter">
          <DeviceHierarchyView
            ref={hierarchyRef}
            categories={categories}
            vendors={vendors}
            canCreate={canCreate}
            canArchive={canArchive}
            canExport={canExport}
            canManageSites={canManageSites}
            onContextChange={handleContextChange}
          />
        </div>
      ) : (
        <div key="tab-global" className="animate-enter">
          <DeviceListClient
            categories={categories}
            vendors={vendors}
            sites={sites}
            canCreate={canCreate}
            canUpdate={canUpdate}
            canArchive={canArchive}
            canExport={canExport}
            initialFilters={initialFilters}
          />
        </div>
      )}
    </div>
  );
}
