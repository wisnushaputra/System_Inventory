'use client';

import { useState } from 'react';
import { DeviceHierarchyView } from './DeviceHierarchyView';
import { DeviceListClient } from './DeviceListClient';
import { IconLayers, IconTable } from '@/components/Icons';

interface Props {
  categories: { id: number; name: string }[];
  vendors: { id: number; name: string }[];
  sites: { id: number; name: string; siteCode: string }[];
  canCreate: boolean;
  canArchive: boolean;
  canExport?: boolean;
  canManageSites?: boolean;
}

export function DevicesPageClient({
  categories,
  vendors,
  sites,
  canCreate,
  canArchive,
  canExport = false,
  canManageSites = false,
}: Props) {
  const [activeTab, setActiveTab] = useState<'hierarchy' | 'global'>('hierarchy');

  return (
    <div className="space-y-6">
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
            onClick={() => setActiveTab('hierarchy')}
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
            categories={categories}
            vendors={vendors}
            canCreate={canCreate}
            canArchive={canArchive}
            canExport={canExport}
            canManageSites={canManageSites}
          />
        </div>
      ) : (
        <div key="tab-global" className="animate-enter">
          <DeviceListClient
            categories={categories}
            vendors={vendors}
            sites={sites}
            canCreate={canCreate}
            canArchive={canArchive}
            canExport={canExport}
          />
        </div>
      )}
    </div>
  );
}
