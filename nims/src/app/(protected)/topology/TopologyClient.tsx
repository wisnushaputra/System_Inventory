'use client';

import { useState, useCallback, useEffect, useMemo } from 'react';
import Link from 'next/link';
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  Panel,
  Handle,
  Position,
  BackgroundVariant,
  Node,
  Edge,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

interface SiteOption {
  id: number;
  siteCode: string;
  name: string;
  siteType: string;
  parentSiteId: number | null;
  parentSite?: { id: number; siteCode: string; name: string } | null;
}

interface CategoryOption {
  id: number;
  code: string;
  name: string;
}

interface Props {
  sites: SiteOption[];
  categories: CategoryOption[];
}

const CATEGORY_ICONS: Record<string, string> = {
  router: '🔀',
  switch: '🔄',
  olt: '💡',
  ont: '🔌',
  server: '🖥️',
  radio: '📡',
  firewall: '🛡️',
  other: '📦',
};

const STATUS_BADGES: Record<string, string> = {
  ACTIVE: 'bg-emerald-100 text-emerald-800',
  PLANNED: 'bg-blue-100 text-blue-800',
  MAINTENANCE: 'bg-amber-100 text-amber-800',
  RETIRED: 'bg-slate-200 text-slate-700',
  LOST: 'bg-rose-100 text-rose-800',
};

// =========================================================================
// CUSTOM REACT FLOW NODES
// =========================================================================

// 1. Simpul Pusat (NOC / Backbone Network)
function RootCustomNode({ data }: any) {
  return (
    <div className="rounded-2xl border-2 border-indigo-400 bg-gradient-to-br from-indigo-950 via-indigo-900 to-slate-900 text-white p-5 shadow-2xl w-80 text-center select-none ring-4 ring-indigo-500/20">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-indigo-500/30 text-2xl mb-2">
        🌐
      </div>
      <h3 className="font-bold text-sm text-white tracking-wide">{data.title}</h3>
      <p className="text-[11px] text-indigo-200/80 mt-0.5 leading-snug">{data.subtitle}</p>
      <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-indigo-500/20 px-3 py-1 text-[11px] font-semibold text-indigo-300 border border-indigo-400/30">
        <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
        <span>{data.popCount} Point of Presence Terhubung</span>
      </div>
      <Handle type="source" position={Position.Bottom} className="w-3 h-3 !bg-indigo-400 !border-2 !border-white" />
    </div>
  );
}

// 2. Simpul POP pada Level 1
function PopCustomNode({ data }: any) {
  return (
    <div
      onClick={() => data.onSelect?.(data.id, data.name, data.siteCode)}
      className="group relative rounded-xl border-2 border-indigo-200 bg-white p-4 shadow-md w-64 transition-all duration-200 hover:border-indigo-600 hover:shadow-xl hover:-translate-y-1 cursor-pointer select-none ring-2 ring-transparent hover:ring-indigo-100"
    >
      <Handle type="target" position={Position.Top} className="w-2.5 h-2.5 !bg-indigo-500" />

      <div className="flex items-center justify-between mb-1.5">
        <span className="font-mono text-xs font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200/60">
          {data.siteCode}
        </span>
        <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
          Aktif
        </span>
      </div>

      <h4 className="text-sm font-bold text-slate-900 group-hover:text-indigo-600 transition-colors line-clamp-1">
        🏢 {data.name}
      </h4>
      <p className="text-[11px] text-slate-500 mt-0.5">
        📍 {data.city}{data.province ? `, ${data.province}` : ''}
      </p>

      <div className="mt-3 pt-2.5 border-t border-slate-100 grid grid-cols-2 gap-2 text-center text-xs">
        <div className="bg-slate-50 rounded p-1.5 border border-slate-100">
          <span className="block text-[10px] text-slate-400">Site Pelanggan</span>
          <span className="font-bold text-slate-800">👥 {data.customerSiteCount}</span>
        </div>
        <div className="bg-indigo-50/60 rounded p-1.5 border border-indigo-100">
          <span className="block text-[10px] text-indigo-500">Total Perangkat</span>
          <span className="font-bold text-indigo-950">🖥️ {data.totalDeviceCount}</span>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between text-[11px] font-bold text-indigo-600 group-hover:text-indigo-800 bg-indigo-50/80 p-2 rounded-lg transition-colors">
        <span>Buka Site Pelanggan</span>
        <span className="transform transition-transform group-hover:translate-x-1 font-bold">→</span>
      </div>
    </div>
  );
}

// 3. Simpul Header POP Induk pada Level 2
function PopParentNode({ data }: any) {
  return (
    <div className="rounded-2xl border-2 border-indigo-300 bg-gradient-to-r from-indigo-50 via-white to-indigo-50/80 p-4 shadow-lg w-72 text-center select-none ring-2 ring-indigo-200">
      <div className="text-xs font-semibold text-indigo-700 uppercase tracking-wider mb-1">
        Point of Presence (POP Induk)
      </div>
      <h3 className="font-bold text-base text-slate-900">📍 {data.name}</h3>
      <p className="font-mono text-xs text-indigo-600 mt-0.5">[{data.siteCode}] &bull; {data.city}</p>
      <div className="mt-2 text-[11px] text-slate-600">
        Menghubungkan <strong>{data.customerSiteCount}</strong> Site Pelanggan
      </div>
      <Handle type="source" position={Position.Bottom} className="w-3 h-3 !bg-indigo-500 !border-2 !border-white" />
    </div>
  );
}

// 4. Simpul Customer Site pada Level 2
function SiteCustomNode({ data }: any) {
  const isInternal = data.isInternalOnly;

  return (
    <div
      onClick={() => data.onSelect?.(data.id, data.name, data.siteCode, data.isInternalOnly)}
      className={`group relative rounded-xl border-2 bg-white p-4 shadow-md w-64 transition-all duration-200 hover:shadow-xl hover:-translate-y-1 cursor-pointer select-none ${
        isInternal
          ? 'border-purple-200 hover:border-purple-500 hover:ring-2 hover:ring-purple-100'
          : 'border-sky-200 hover:border-sky-500 hover:ring-2 hover:ring-sky-100'
      }`}
    >
      <Handle type="target" position={Position.Top} className={`w-2.5 h-2.5 ${isInternal ? '!bg-purple-500' : '!bg-sky-500'}`} />

      <div className="flex items-center justify-between mb-1.5">
        <span className={`font-mono text-xs font-bold px-2 py-0.5 rounded border ${
          isInternal
            ? 'text-purple-700 bg-purple-50 border-purple-200/60'
            : 'text-sky-700 bg-sky-50 border-sky-200/60'
        }`}>
          {data.siteCode}
        </span>
        <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
          Aktif
        </span>
      </div>

      <h4 className={`text-sm font-bold text-slate-900 transition-colors line-clamp-1 ${
        isInternal ? 'group-hover:text-purple-600' : 'group-hover:text-sky-600'
      }`}>
        {isInternal ? '⚙️ ' : '👥 '}{data.name}
      </h4>
      <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-1">
        📍 {data.address || data.city}
      </p>

      <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs">
        <span className="text-[11px] text-slate-500 font-medium">Perangkat Site:</span>
        <span className="font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
          🖥️ {data.deviceCount} Unit
        </span>
      </div>

      <div className={`mt-3 flex items-center justify-between text-[11px] font-bold p-2 rounded-lg transition-colors ${
        isInternal
          ? 'text-purple-700 bg-purple-50 group-hover:bg-purple-100'
          : 'text-sky-700 bg-sky-50 group-hover:bg-sky-100'
      }`}>
        <span>Lihat Topologi & List Perangkat</span>
        <span className="transform transition-transform group-hover:translate-x-1 font-bold">→</span>
      </div>
    </div>
  );
}

// 5. Simpul Perangkat pada Level 3 & Flat View
function DeviceCustomNode({ data, selected }: any) {
  const icon = CATEGORY_ICONS[data.categoryCode] || '📦';
  const statusColor = STATUS_BADGES[data.inventoryStatus] || 'bg-slate-100 text-slate-700';

  return (
    <div
      className={`rounded-lg border bg-white p-3 shadow-md w-60 text-xs transition cursor-pointer select-none ${
        selected ? 'border-indigo-600 ring-2 ring-indigo-400' : 'border-slate-200 hover:border-slate-400'
      }`}
    >
      <Handle type="target" position={Position.Top} className="w-2.5 h-2.5 !bg-indigo-500" />
      <Handle type="target" position={Position.Left} className="w-2.5 h-2.5 !bg-indigo-500" />

      {/* Header Node: Ikon & Hostname */}
      <div className="flex items-center space-x-2 border-b border-slate-100 pb-2">
        <span className="text-xl leading-none">{icon}</span>
        <div className="min-w-0 flex-1">
          <div className="font-bold text-slate-900 truncate" title={data.hostname}>
            {data.hostname}
          </div>
          <div className="font-mono text-[10px] text-slate-400">{data.deviceCode}</div>
        </div>
      </div>

      {/* Badge Hierarki Lokasi */}
      <div className="mt-2 mb-1.5">
        {data.isPopCore ? (
          <span className="inline-flex items-center rounded-md bg-purple-50 px-2 py-0.5 text-[10px] font-semibold text-purple-700 ring-1 ring-inset ring-purple-600/20 truncate max-w-full">
            📍 Core POP: {data.siteCode}
          </span>
        ) : (
          <span
            className="inline-flex items-center rounded-md bg-sky-50 px-2 py-0.5 text-[10px] font-semibold text-sky-700 ring-1 ring-inset ring-sky-600/20 truncate max-w-full"
            title={`${data.parentPop?.name || 'POP'} > ${data.site}`}
          >
            👥 Pelanggan: {data.siteCode}
          </span>
        )}
      </div>

      <div className="space-y-1 text-[11px] text-slate-600">
        <div className="flex justify-between">
          <span className="text-slate-400">IP Mgmt:</span>
          <span className="font-mono font-medium text-slate-800">
            {data.managementIp || '-'}
          </span>
        </div>
        <div className="flex justify-between items-center pt-0.5">
          <span className="text-slate-400">Status:</span>
          <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${statusColor}`}>
            {data.inventoryStatus}
          </span>
        </div>
      </div>

      <Handle type="source" position={Position.Bottom} className="w-2.5 h-2.5 !bg-indigo-500" />
      <Handle type="source" position={Position.Right} className="w-2.5 h-2.5 !bg-indigo-500" />
    </div>
  );
}

// =========================================================================
// MAIN COMPONENT
// =========================================================================

export function TopologyClient({ sites, categories }: Props) {
  // Mode Navigasi: 'drilldown' (Default, sesuai request) vs 'global' (flat semua perangkat)
  const [navMode, setNavMode] = useState<'drilldown' | 'global'>('drilldown');

  // Level Drill-Down: 'pops' (Level 1) | 'sites' (Level 2) | 'devices' (Level 3)
  const [currentLevel, setCurrentLevel] = useState<'pops' | 'sites' | 'devices'>('pops');

  // Hierarchy Selection Context
  const [activePop, setActivePop] = useState<{ id: number; name: string; siteCode: string } | null>(null);
  const [activeSite, setActiveSite] = useState<{ id: number; name: string; siteCode: string; isInternalOnly?: boolean } | null>(null);

  // React Flow state
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Global filters (aktif di level devices atau global view)
  const [categoryId, setCategoryId] = useState('');
  const [relationType, setRelationType] = useState('');
  const [medium, setMedium] = useState('');

  // Selected Detail Panel states (DoD T7.1)
  const [selectedNode, setSelectedNode] = useState<any | null>(null);
  const [selectedEdge, setSelectedEdge] = useState<any | null>(null);

  // Layout save state (DoD T7.2)
  const [savingLayout, setSavingLayout] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);

  // Daftar perangkat untuk ditampilkan dalam tabel pada Level 3
  const [siteDeviceList, setSiteDeviceList] = useState<any[]>([]);

  // Registrasi custom node types
  const nodeTypes = useMemo(
    () => ({
      rootNode: RootCustomNode,
      popNode: PopCustomNode,
      popParentNode: PopParentNode,
      siteNode: SiteCustomNode,
      deviceNode: DeviceCustomNode,
    }),
    []
  );

  // Handler transisi level
  const handleSelectPop = useCallback((id: number, name: string, siteCode: string) => {
    setActivePop({ id, name, siteCode });
    setActiveSite(null);
    setCurrentLevel('sites');
    setSelectedNode(null);
    setSelectedEdge(null);
  }, []);

  const handleSelectSite = useCallback((id: number, name: string, siteCode: string, isInternalOnly?: boolean) => {
    setActiveSite({ id, name, siteCode, isInternalOnly });
    setCurrentLevel('devices');
    setSelectedNode(null);
    setSelectedEdge(null);
  }, []);

  const handleBackToPops = useCallback(() => {
    setActivePop(null);
    setActiveSite(null);
    setCurrentLevel('pops');
    setSelectedNode(null);
    setSelectedEdge(null);
  }, []);

  const handleBackToSites = useCallback(() => {
    setActiveSite(null);
    setCurrentLevel('sites');
    setSelectedNode(null);
    setSelectedEdge(null);
  }, []);

  // Fetch data topologi sesuai level dan parameter
  const fetchTopology = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const params = new URLSearchParams();

      if (navMode === 'drilldown') {
        params.set('level', currentLevel);
        if (currentLevel === 'sites' && activePop) {
          params.set('popId', activePop.id.toString());
        } else if (currentLevel === 'devices') {
          if (activeSite?.isInternalOnly && activePop) {
            params.set('popId', activePop.id.toString());
            params.set('isInternalOnly', 'true');
          } else if (activeSite) {
            params.set('siteId', activeSite.id.toString());
          }
        }
      }

      if (categoryId) params.set('categoryId', categoryId);
      if (relationType) params.set('relationType', relationType);
      if (medium) params.set('medium', medium);

      // Tentukan scope layout
      let scope = 'default';
      if (navMode === 'drilldown') {
        if (currentLevel === 'pops') scope = 'level-pops';
        else if (currentLevel === 'sites' && activePop) scope = `level-sites-pop-${activePop.id}`;
        else if (currentLevel === 'devices' && activeSite) scope = `level-devices-site-${activeSite.id}`;
      }

      const [resTopo, resLayout] = await Promise.all([
        fetch(`/api/topology?${params.toString()}`),
        fetch(`/api/topology/layout?scope=${scope}`),
      ]);

      if (!resTopo.ok) throw new Error('Gagal memuat visualisasi topologi');
      const topoData = await resTopo.json();
      const layoutData = resLayout.ok ? await resLayout.json() : { positions: {} };

      const positions = layoutData.positions || {};

      // Injeksi callback onSelect ke dalam node data agar dapat merespons klik
      const appliedNodes = topoData.nodes.map((node: any) => {
        let nodeData = { ...node.data };
        if (node.type === 'popNode') {
          nodeData.onSelect = handleSelectPop;
        } else if (node.type === 'siteNode') {
          nodeData.onSelect = handleSelectSite;
        }

        if (positions[node.id]) {
          return {
            ...node,
            data: nodeData,
            position: positions[node.id],
          };
        }
        return {
          ...node,
          data: nodeData,
        };
      });

      setNodes(appliedNodes);
      setEdges(topoData.edges || []);

      // Simpan data perangkat jika sedang di Level 3 untuk ditampilkan di tabel bawah kanvas
      if (navMode === 'drilldown' && currentLevel === 'devices') {
        setSiteDeviceList(topoData.nodes.map((n: any) => n.data));
      } else {
        setSiteDeviceList([]);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Terjadi kesalahan sistem');
    } finally {
      setLoading(false);
    }
  }, [navMode, currentLevel, activePop, activeSite, categoryId, relationType, medium, handleSelectPop, handleSelectSite, setNodes, setEdges]);

  useEffect(() => {
    fetchTopology();
  }, [fetchTopology]);

  // Handler klik node kanvas
  const onNodeClick = (_: any, node: Node) => {
    const data = node.data as any;
    if (node.type === 'popNode') {
      handleSelectPop(Number(data.id), String(data.name), String(data.siteCode));
    } else if (node.type === 'siteNode') {
      handleSelectSite(Number(data.id), String(data.name), String(data.siteCode), Boolean(data.isInternalOnly));
    } else if (node.type === 'deviceNode') {
      setSelectedNode(data);
      setSelectedEdge(null);
    }
  };

  // Handler klik edge kanvas (DoD T7.1)
  const onEdgeClick = (_: any, edge: Edge) => {
    if (edge.data?.endpointA && edge.data?.endpointB) {
      setSelectedEdge(edge.data);
      setSelectedNode(null);
    }
  };

  // Handler Simpan Layout (DoD T7.2)
  const handleSaveLayout = async () => {
    setSavingLayout(true);
    setSaveSuccessMsg(null);
    try {
      const positions: Record<string, { x: number; y: number }> = {};
      nodes.forEach((n) => {
        positions[n.id] = { x: Math.round(n.position.x), y: Math.round(n.position.y) };
      });

      let scope = 'default';
      if (navMode === 'drilldown') {
        if (currentLevel === 'pops') scope = 'level-pops';
        else if (currentLevel === 'sites' && activePop) scope = `level-sites-pop-${activePop.id}`;
        else if (currentLevel === 'devices' && activeSite) scope = `level-devices-site-${activeSite.id}`;
      }

      const res = await fetch('/api/topology/layout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Origin: window.location.origin },
        body: JSON.stringify({
          scope,
          positions,
        }),
      });

      if (!res.ok) throw new Error('Gagal menyimpan tata letak.');
      setSaveSuccessMsg('Tata letak simpul berhasil disimpan!');
      setTimeout(() => setSaveSuccessMsg(null), 3500);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSavingLayout(false);
    }
  };

  // Handler Auto Layout (Rapikan Posisi)
  const handleAutoLayout = () => {
    if (currentLevel === 'pops') {
      const rootX = Math.max(1, nodes.length - 2) * 150 + 40;
      setNodes((prev) =>
        prev.map((n, idx) => {
          if (n.id === 'root-noc') {
            return { ...n, position: { x: rootX, y: 30 } };
          }
          return { ...n, position: { x: (idx - 1) * 300 + 40, y: 220 } };
        })
      );
    } else if (currentLevel === 'sites') {
      const parentX = Math.max(1, nodes.length - 2) * 150 + 40;
      setNodes((prev) =>
        prev.map((n, idx) => {
          if (n.type === 'popParentNode') {
            return { ...n, position: { x: parentX, y: 30 } };
          }
          return { ...n, position: { x: (idx - 1) * 300 + 40, y: 220 } };
        })
      );
    } else {
      const cols = Math.ceil(Math.sqrt(nodes.length)) || 1;
      setNodes((prev) =>
        prev.map((n, idx) => ({
          ...n,
          position: {
            x: (idx % cols) * 280 + 80,
            y: Math.floor(idx / cols) * 200 + 80,
          },
        }))
      );
    }
  };

  return (
    <div className="space-y-4">
      {/* Top Header Mode Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-200 pb-3">
        <div className="flex space-x-2">
          <button
            type="button"
            onClick={() => {
              setNavMode('drilldown');
              setCurrentLevel('pops');
              setActivePop(null);
              setActiveSite(null);
            }}
            className={`flex items-center gap-2 px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
              navMode === 'drilldown'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <span>🗂️</span>
            <span>Navigasi Graf Bertingkat (POP → Site → Perangkat)</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setNavMode('global');
              setSelectedNode(null);
              setSelectedEdge(null);
            }}
            className={`flex items-center gap-2 px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
              navMode === 'global'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <span>🌐</span>
            <span>Topologi Global (Semua Perangkat)</span>
          </button>
        </div>

        {/* Action Controls */}
        <div className="flex items-center space-x-2">
          <button
            type="button"
            onClick={handleAutoLayout}
            className="rounded border border-slate-300 bg-white px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-50 font-medium shadow-sm"
          >
            🔄 Rapikan Posisi
          </button>
          <button
            type="button"
            disabled={savingLayout}
            onClick={handleSaveLayout}
            className="rounded bg-indigo-600 px-3 py-1 text-xs font-semibold text-white hover:bg-indigo-500 disabled:opacity-50 shadow-sm"
          >
            {savingLayout ? 'Menyimpan...' : '💾 Simpan Layout'}
          </button>
        </div>
      </div>

      {/* Breadcrumb Navigasi In-Canvas Graf Bertingkat */}
      {navMode === 'drilldown' && (
        <nav aria-label="Hierarki Topologi" className="flex items-center flex-wrap justify-between gap-3 text-xs bg-slate-50 p-3 rounded-xl border border-slate-200">
          <div className="flex items-center flex-wrap gap-2">
            <button
              type="button"
              onClick={handleBackToPops}
              className={`font-medium transition-colors ${
                currentLevel === 'pops'
                  ? 'text-indigo-600 font-bold'
                  : 'text-slate-600 hover:text-indigo-600'
              }`}
            >
              🏢 Seluruh POP (Level 1)
            </button>

            {activePop && (
              <>
                <span className="text-slate-400 font-bold">/</span>
                <button
                  type="button"
                  onClick={handleBackToSites}
                  className={`font-medium transition-colors ${
                    currentLevel === 'sites'
                      ? 'text-indigo-600 font-bold'
                      : 'text-slate-600 hover:text-indigo-600'
                  }`}
                >
                  📍 {activePop.name} ({activePop.siteCode})
                </button>
              </>
            )}

            {activeSite && (
              <>
                <span className="text-slate-400 font-bold">/</span>
                <span className="text-indigo-900 font-bold bg-indigo-100 px-2 py-0.5 rounded text-[11px] border border-indigo-200">
                  {activeSite.isInternalOnly ? '⚙️ ' : '👥 '}{activeSite.name} ({activeSite.siteCode})
                </span>
              </>
            )}
          </div>

          {/* Tombol kembali ke tingkat sebelumnya */}
          <div className="flex items-center gap-2">
            {currentLevel === 'sites' && (
              <button
                type="button"
                onClick={handleBackToPops}
                className="rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100 shadow-sm"
              >
                ← Kembali ke Level POP
              </button>
            )}
            {currentLevel === 'devices' && (
              <button
                type="button"
                onClick={handleBackToSites}
                className="rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100 shadow-sm"
              >
                ← Kembali ke Daftar Site Pelanggan
              </button>
            )}
            {saveSuccessMsg && (
              <span className="font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 text-xs">
                {saveSuccessMsg}
              </span>
            )}
          </div>
        </nav>
      )}

      {/* Filter Tambahan (Khusus Mode Global atau Level Perangkat) */}
      {(navMode === 'global' || currentLevel === 'devices') && (
        <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block font-medium text-slate-700 mb-1">Filter Kategori</label>
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="w-full rounded border border-slate-300 p-1.5 focus:border-indigo-500 focus:outline-none"
              >
                <option value="">Semua Kategori</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-medium text-slate-700 mb-1">Tipe Relasi Kabel</label>
              <select
                value={relationType}
                onChange={(e) => setRelationType(e.target.value)}
                className="w-full rounded border border-slate-300 p-1.5 focus:border-indigo-500 focus:outline-none"
              >
                <option value="">Semua Tipe Relasi</option>
                <option value="physical">Physical (Kabel Fisik)</option>
                <option value="logical">Logical (Tunnel / VLAN / L3)</option>
                <option value="parent_child">Parent-Child (Sasis / Modul)</option>
                <option value="service">Service (Layanan Pelanggan)</option>
              </select>
            </div>

            <div>
              <label className="block font-medium text-slate-700 mb-1">Media Transmisi</label>
              <select
                value={medium}
                onChange={(e) => setMedium(e.target.value)}
                className="w-full rounded border border-slate-300 p-1.5 focus:border-indigo-500 focus:outline-none"
              >
                <option value="">Semua Media</option>
                <option value="fiber">Fiber Optic</option>
                <option value="copper">Copper / Tembaga (UTP)</option>
                <option value="wireless">Wireless Radio</option>
                <option value="logical">Logical Virtual</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {errorMsg && (
        <div className="rounded-md border border-rose-200 bg-rose-50 p-4 text-xs text-rose-800">
          {errorMsg}
        </div>
      )}

      {/* Kanvas React Flow */}
      <div className="relative h-[620px] w-full rounded-xl border border-slate-200 bg-slate-50 overflow-hidden shadow-sm">
        {loading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/70 backdrop-blur-sm">
            <div className="text-center">
              <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-r-transparent" />
              <p className="mt-2 text-xs font-semibold text-slate-700">Memuat visualisasi topologi...</p>
            </div>
          </div>
        )}

        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeClick={onNodeClick}
          onEdgeClick={onEdgeClick}
          nodeTypes={nodeTypes}
          fitView
          minZoom={0.2}
          maxZoom={2}
          defaultViewport={{ x: 0, y: 0, zoom: 1 }}
        >
          <Background variant={BackgroundVariant.Dots} gap={16} size={1} color="#cbd5e1" />
          <Controls position="bottom-left" />
          <MiniMap
            position="bottom-right"
            nodeColor={(node: any) => {
              if (node.type === 'rootNode') return '#312e81';
              if (node.type === 'popNode' || node.type === 'popParentNode') return '#4f46e5';
              if (node.type === 'siteNode') return '#0284c7';
              return '#10b981';
            }}
            className="!border !border-slate-200 !bg-white/90 !shadow-sm"
          />

          {/* Legenda Topologi Jaringan (DoD T7.1) */}
          <Panel position="top-left" className="bg-white/95 backdrop-blur-sm p-3 rounded-lg border border-slate-200 shadow-sm text-[11px] space-y-1.5 select-none">
            <div className="font-bold text-slate-800 text-xs border-b pb-1">Petunjuk Navigasi</div>
            {navMode === 'drilldown' && currentLevel === 'pops' && (
              <div className="text-slate-600">
                👉 Klik pada salah satu kotak <strong>POP</strong> untuk masuk ke daftar site pelanggan.
              </div>
            )}
            {navMode === 'drilldown' && currentLevel === 'sites' && (
              <div className="text-slate-600">
                👉 Klik pada salah satu kotak <strong>Site Pelanggan</strong> untuk melihat graf dan daftar perangkatnya.
              </div>
            )}
            {navMode === 'drilldown' && currentLevel === 'devices' && (
              <div className="text-slate-600">
                👉 Klik simpul perangkat untuk melihat spesifikasi detail, atau klik kabel untuk melihat port terhubung.
              </div>
            )}
            <div className="pt-1.5 border-t border-slate-100 flex items-center space-x-2">
              <span className="w-4 h-0.5 bg-indigo-600 inline-block" />
              <span className="text-slate-600">Physical (Kabel Fisik)</span>
            </div>
            <div className="flex items-center space-x-2">
              <span className="w-4 h-0.5 border-t border-dashed border-sky-500 inline-block" />
              <span className="text-slate-600">Logical (VLAN / Tunnel)</span>
            </div>
          </Panel>
        </ReactFlow>

        {/* Panel Detail Node Perangkat (Klik Node → Detail Perangkat Lengkap) (DoD T7.1) */}
        {selectedNode && (
          <div className="absolute top-3 right-3 z-20 w-80 rounded-xl border border-slate-200 bg-white p-4 shadow-xl text-xs space-y-3">
            <div className="flex items-center justify-between border-b pb-2">
              <div className="flex items-center space-x-2">
                <span className="text-xl">{CATEGORY_ICONS[selectedNode.categoryCode] || '📦'}</span>
                <div>
                  <h3 className="font-bold text-slate-900 leading-tight">{selectedNode.hostname}</h3>
                  <p className="font-mono text-[10px] text-slate-400">{selectedNode.deviceCode}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedNode(null)}
                className="text-slate-400 hover:text-slate-600 text-lg leading-none"
              >
                &times;
              </button>
            </div>

            <dl className="divide-y divide-slate-100 text-[11px]">
              <div className="py-1.5 flex justify-between">
                <dt className="text-slate-400">Lingkup Lokasi</dt>
                <dd className="font-semibold text-slate-800">
                  {selectedNode.isPopCore ? 'Infrastruktur Core POP' : 'Site Pelanggan / Customer'}
                </dd>
              </div>
              <div className="py-1.5 flex justify-between">
                <dt className="text-slate-400">POP Induk</dt>
                <dd className="font-medium text-slate-700">
                  {selectedNode.parentPop?.name || selectedNode.site} ({selectedNode.parentPop?.siteCode || selectedNode.siteCode})
                </dd>
              </div>
              {!selectedNode.isPopCore && (
                <div className="py-1.5 flex justify-between">
                  <dt className="text-slate-400">Nama Pelanggan</dt>
                  <dd className="font-medium text-slate-700">
                    {selectedNode.site} ({selectedNode.siteCode})
                  </dd>
                </div>
              )}
              <div className="py-1.5 flex justify-between">
                <dt className="text-slate-400">Kategori</dt>
                <dd className="font-medium text-slate-700">{selectedNode.category}</dd>
              </div>
              <div className="py-1.5 flex justify-between">
                <dt className="text-slate-400">Vendor & Model</dt>
                <dd className="font-medium text-slate-700 text-right">
                  <div>{selectedNode.vendor}</div>
                  <div className="text-[10px] text-slate-400">{selectedNode.model || '-'}</div>
                </dd>
              </div>
              <div className="py-1.5 flex justify-between">
                <dt className="text-slate-400">IP Manajemen</dt>
                <dd className="font-mono font-bold text-slate-800">{selectedNode.managementIp || 'Belum diatur'}</dd>
              </div>
              <div className="py-1.5 flex justify-between">
                <dt className="text-slate-400">Role Jaringan</dt>
                <dd className="uppercase font-mono text-slate-700">{selectedNode.networkRole || '-'}</dd>
              </div>
              <div className="py-1.5 flex justify-between items-center">
                <dt className="text-slate-400">Status Inventaris</dt>
                <dd>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${STATUS_BADGES[selectedNode.inventoryStatus] || 'bg-slate-100 text-slate-700'}`}>
                    {selectedNode.inventoryStatus}
                  </span>
                </dd>
              </div>
            </dl>

            <div className="pt-2 border-t flex justify-end">
              <Link
                href={`/devices/${selectedNode.id}`}
                className="rounded bg-indigo-600 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-indigo-500 shadow-sm"
              >
                Buka Detail Lengkap Perangkat &rarr;
              </Link>
            </div>
          </div>
        )}

        {/* Panel Detail Edge (Klik Edge → Detail Dua Port Terhubung) (DoD T7.1) */}
        {selectedEdge && (
          <div className="absolute top-3 right-3 z-20 w-80 rounded-xl border border-slate-200 bg-white p-4 shadow-xl text-xs space-y-3">
            <div className="flex items-center justify-between border-b pb-2">
              <div className="flex items-center space-x-2">
                <span className="text-xl">🔗</span>
                <div>
                  <h3 className="font-bold text-slate-900 leading-tight">Detail Relasi Koneksi</h3>
                  <p className="text-[10px] text-slate-400">Dokumentasi Antarport</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedEdge(null)}
                className="text-slate-400 hover:text-slate-600 text-lg leading-none"
              >
                &times;
              </button>
            </div>

            {/* Dua Port yang Terhubung (DoD T7.1) */}
            <div className="rounded-md border border-slate-200 bg-slate-50 p-2.5 space-y-2 text-[11px]">
              <div>
                <span className="text-[10px] font-semibold text-indigo-700 uppercase tracking-wide">Endpoint A:</span>
                <div className="font-medium text-slate-900">{selectedEdge.endpointA?.hostname}</div>
                <div className="font-mono text-slate-600 font-bold">Port: {selectedEdge.endpointA?.portName}</div>
              </div>
              <div className="border-t border-dashed border-slate-300 pt-1.5">
                <span className="text-[10px] font-semibold text-emerald-700 uppercase tracking-wide">Endpoint B:</span>
                <div className="font-medium text-slate-900">{selectedEdge.endpointB?.hostname}</div>
                <div className="font-mono text-slate-600 font-bold">Port: {selectedEdge.endpointB?.portName}</div>
              </div>
            </div>

            <dl className="divide-y divide-slate-100 text-[11px]">
              <div className="py-1 flex justify-between">
                <dt className="text-slate-400">Tipe Relasi</dt>
                <dd className="font-semibold text-slate-700 uppercase">{selectedEdge.relationType}</dd>
              </div>
              <div className="py-1 flex justify-between">
                <dt className="text-slate-400">Media Transmisi</dt>
                <dd className="font-medium text-slate-700 capitalize">{selectedEdge.medium || 'Unknown'}</dd>
              </div>
              <div className="py-1 flex justify-between">
                <dt className="text-slate-400">Kapasitas Link</dt>
                <dd className="font-medium text-slate-700">
                  {selectedEdge.capacityMbps ? `${selectedEdge.capacityMbps} Mbps` : 'Tidak dicatat'}
                </dd>
              </div>
              {selectedEdge.label && (
                <div className="py-1 flex justify-between">
                  <dt className="text-slate-400">Label Link</dt>
                  <dd className="font-medium text-slate-700">{selectedEdge.label}</dd>
                </div>
              )}
            </dl>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* LEVEL 3: DAFTAR PERANGKAT SITE (Di bawah kanvas topologi)                */}
      {/* ========================================================================= */}
      {navMode === 'drilldown' && currentLevel === 'devices' && activeSite && (
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                📋 Daftar Perangkat di Site {activeSite.name} ({activeSite.siteCode})
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Total {siteDeviceList.length} unit perangkat terpasang di site ini.
              </p>
            </div>
            <Link
              href={`/devices/new?siteId=${activeSite.id}`}
              className="rounded bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-500 shadow-sm"
            >
              + Tambah Perangkat ke Site Ini
            </Link>
          </div>

          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
              <thead className="bg-slate-50 font-semibold text-slate-700">
                <tr>
                  <th className="px-3 py-2.5">Kode / Hostname</th>
                  <th className="px-3 py-2.5">Kategori</th>
                  <th className="px-3 py-2.5">Vendor / Model</th>
                  <th className="px-3 py-2.5">IP Manajemen</th>
                  <th className="px-3 py-2.5">Status</th>
                  <th className="px-3 py-2.5 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {siteDeviceList.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-6 text-slate-500">
                      Belum ada perangkat terpasang di site ini.
                    </td>
                  </tr>
                ) : (
                  siteDeviceList.map((dev: any) => (
                    <tr key={dev.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-3 py-2.5">
                        <Link href={`/devices/${dev.id}`} className="font-semibold text-indigo-600 hover:text-indigo-900">
                          {dev.hostname}
                        </Link>
                        <div className="font-mono text-[10px] text-slate-400">{dev.deviceCode}</div>
                      </td>
                      <td className="px-3 py-2.5 text-slate-700">{dev.category}</td>
                      <td className="px-3 py-2.5 text-slate-700">
                        <div>{dev.vendor}</div>
                        <div className="text-[10px] text-slate-400">{dev.model || '-'}</div>
                      </td>
                      <td className="px-3 py-2.5 font-mono text-slate-700">
                        {dev.managementIp ? (
                          <span className="bg-slate-100 px-2 py-0.5 rounded text-[11px]">{dev.managementIp}</span>
                        ) : (
                          <span className="text-slate-400 italic">Belum diatur</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${STATUS_BADGES[dev.inventoryStatus] || 'bg-slate-100 text-slate-700'}`}>
                          {dev.inventoryStatus}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        <Link
                          href={`/devices/${dev.id}`}
                          className="rounded border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-50 shadow-sm"
                        >
                          Detail &rarr;
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
