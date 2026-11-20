'use client';

import { useState } from 'react';
import { DeviceHierarchyView } from './DeviceHierarchyView';
import { DeviceListClient } from './DeviceListClient';

interface Props {
  categories: { id: number; name: string }[];
  vendors: { id: number; name: string }[];
  sites: { id: number; name: string; siteCode: string }[];
  canCreate: boolean;
  canArchive: boolean;
  canExport?: boolean;
}

export function DevicesPageClient({
  categories,
  vendors,
  sites,
  canCreate,
  canArchive,
  canExport = false,
}: Props) {
  const [activeTab, setActiveTab] = useState<'hierarchy' | 'global'>('hierarchy');

  return (
    <div className="space-y-6">
      {/* Navigation Mode Switcher */}
      <div className="border-b border-slate-200">
        <nav aria-label="Mode Tampilan" className="-mb-px flex space-x-6">
          <button
            type="button"
            onClick={() => setActiveTab('hierarchy')}
            className={`flex items-center gap-2 border-b-2 py-3 px-1 text-sm font-semibold transition-colors ${
              activeTab === 'hierarchy'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700'
            }`}
          >
            <span>🗂️</span>
            <span>Navigasi Hierarki (POP → Customer → Perangkat)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('global')}
            className={`flex items-center gap-2 border-b-2 py-3 px-1 text-sm font-semibold transition-colors ${
              activeTab === 'global'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700'
            }`}
          >
            <span>📋</span>
            <span>Semua Perangkat (Tabel Global)</span>
          </button>
        </nav>
      </div>

      {/* Tab Panels */}
      {activeTab === 'hierarchy' ? (
        <DeviceHierarchyView
          categories={categories}
          vendors={vendors}
          canCreate={canCreate}
          canArchive={canArchive}
          canExport={canExport}
        />
      ) : (
        <DeviceListClient
          categories={categories}
          vendors={vendors}
          sites={sites}
          canCreate={canCreate}
          canArchive={canArchive}
          canExport={canExport}
        />
      )}
    </div>
  );
}
