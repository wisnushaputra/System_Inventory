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
import { useTheme } from '@/components/ThemeProvider';
import {
  NimsBrandMark,
  DeviceCategoryIcon,
  IconPopBuilding,
  IconSitePin,
  IconCustomerGroup,
  IconCog,
  IconLinkCable,
  IconLayers,
  IconSubnetGlobe,
  IconLayoutAuto,
  IconSave,
  IconTable,
  IconArrowLeft,
  IconArrowRight,
  IconChevronRight,
  IconClose,
  IconPlus,
} from '@/components/Icons';
import { AddCustomerSiteModal } from '@/components/AddCustomerSiteModal';

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
  canManageSites?: boolean;
}

const STATUS_BADGES: Record<string, string> = {
  ACTIVE: 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950/70 dark:text-emerald-300',
  PLANNED: 'bg-sky-100 text-sky-900 dark:bg-sky-950/70 dark:text-sky-300',
  MAINTENANCE: 'bg-amber-100 text-amber-900 dark:bg-amber-950/70 dark:text-amber-300',
  RETIRED: 'bg-subtle text-ink-secondary',
  LOST: 'bg-rose-100 text-rose-900 dark:bg-rose-950/70 dark:text-rose-300',
};

// 1. Simpul Pusat (NOC / Backbone Network)
function RootCustomNode({ data }: any) {
  return (
    <div className="rounded-xl border-2 border-[#1D4ED8] dark:border-[#60A5FA] bg-[#0F1E36] dark:bg-[#111E33] text-white p-5 shadow-md w-80 text-center select-none">
      <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-lg bg-[#162B4D] mb-2.5">
        <NimsBrandMark className="h-7 w-7" />
      </div>
      <h3 className="font-bold text-sm text-white tracking-wide">{data.title}</h3>
      <p className="text-[11px] text-slate-200 mt-1 leading-snug">{data.subtitle}</p>
      <div className="mt-3 inline-flex items-center gap-2 rounded-md bg-[#0B172B] px-3 py-1 text-[11px] font-semibold text-blue-100 border border-blue-600/50">
        <span className="h-2 w-2 rounded-full bg-blue-300" aria-hidden="true" />
        <span className="font-mono tabular-nums-data">{data.popCount} Point of Presence</span>
      </div>
      <Handle
        type="source"
        position={Position.Bottom}
        className="w-3 h-3 !bg-[#60A5FA] !border-2 !border-[#0F1E36]"
      />
    </div>
  );
}

// 2. Simpul POP pada Level 1
function PopCustomNode({ data }: any) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        data.onSelect?.(data.id, data.name, data.siteCode);
      }}
      className="group relative text-left rounded-xl border border-line-strong bg-surface p-4 shadow-sm w-64 transition-[border-color,box-shadow,transform] duration-150 hover:border-accent hover:shadow-md hover:-translate-y-0.5 select-none"
    >
      <Handle type="target" position={Position.Top} className="w-2.5 h-2.5 !bg-accent" />

      <div className="flex items-center justify-between mb-2">
        <span className="font-mono text-xs font-semibold text-accent-ink bg-accent-soft px-2 py-0.5 rounded">
          {data.siteCode}
        </span>
        <span className="inline-flex items-center rounded-md bg-emerald-100 dark:bg-emerald-950/70 px-2 py-0.5 text-[10px] font-semibold text-emerald-900 dark:text-emerald-300">
          Aktif
        </span>
      </div>

      <h4 className="flex items-center gap-1.5 text-sm font-bold text-ink group-hover:text-accent-ink transition-colors duration-150 truncate">
        <IconPopBuilding className="h-4 w-4 shrink-0 text-accent" />
        <span className="truncate">{data.name}</span>
      </h4>
      <p className="mt-1 flex items-center gap-1 text-[11px] text-ink-secondary truncate">
        <IconSitePin className="h-3.5 w-3.5 shrink-0 text-ink-muted" />
        <span className="truncate">
          {data.city}
          {data.province ? `, ${data.province}` : ''}
        </span>
      </p>

      <div className="mt-3 pt-2.5 border-t border-line grid grid-cols-2 gap-2 text-center text-xs">
        <div className="bg-subtle rounded-lg p-1.5">
          <span className="block text-[10px] text-ink-secondary">Site Pelanggan</span>
          <span className="font-mono font-bold text-ink tabular-nums-data">
            {data.customerSiteCount}
          </span>
        </div>
        <div className="bg-accent-soft rounded-lg p-1.5">
          <span className="block text-[10px] text-accent-ink">Total Perangkat</span>
          <span className="font-mono font-bold text-accent-ink tabular-nums-data">
            {data.totalDeviceCount}
          </span>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between text-[11px] font-semibold text-accent-ink bg-accent-soft px-2.5 py-1.5 rounded-lg">
        <span>Buka Site Pelanggan</span>
        <IconArrowRight className="h-3.5 w-3.5 transition-transform duration-150 group-hover:translate-x-1" />
      </div>
    </button>
  );
}

// 3. Simpul Header POP Induk pada Level 2
function PopParentNode({ data }: any) {
  return (
    <div className="rounded-xl border-2 border-accent bg-surface p-4 shadow-md w-72 text-center select-none">
      <div className="inline-block rounded bg-accent-soft px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-accent-ink mb-1.5">
        POP Induk
      </div>
      <h3 className="flex items-center justify-center gap-1.5 font-bold text-base text-ink">
        <IconPopBuilding className="h-4 w-4 shrink-0 text-accent" />
        <span>{data.name}</span>
      </h3>
      <p className="font-mono text-xs text-accent-ink mt-0.5">
        [{data.siteCode}] {data.city}
      </p>
      <div className="mt-2 text-[11px] text-ink-secondary">
        Menghubungkan <strong className="text-ink">{data.customerSiteCount}</strong> Site Pelanggan
      </div>
      <Handle
        type="source"
        position={Position.Bottom}
        className="w-3 h-3 !bg-accent !border-2 !border-surface"
      />
    </div>
  );
}

// 4. Simpul Customer Site pada Level 2
function SiteCustomNode({ data }: any) {
  const isInternal = data.isInternalOnly;

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        data.onSelect?.(data.id, data.name, data.siteCode, data.isInternalOnly);
      }}
      className={`group relative text-left rounded-xl border bg-surface p-4 shadow-sm w-64 transition-[border-color,box-shadow,transform] duration-150 hover:shadow-md hover:-translate-y-0.5 select-none ${
        isInternal
          ? 'border-amber-300 dark:border-amber-800 hover:border-amber-600'
          : 'border-sky-300 dark:border-sky-800 hover:border-sky-600'
      }`}
    >
      <Handle
        type="target"
        position={Position.Top}
        className={`w-2.5 h-2.5 ${isInternal ? '!bg-amber-600' : '!bg-sky-600'}`}
      />

      <div className="flex items-center justify-between mb-1.5">
        <span
          className={`font-mono text-xs font-semibold px-2 py-0.5 rounded ${
            isInternal
              ? 'text-amber-900 bg-amber-100 dark:text-amber-300 dark:bg-amber-950/70'
              : 'text-sky-900 bg-sky-100 dark:text-sky-300 dark:bg-sky-950/70'
          }`}
        >
          {data.siteCode}
        </span>
        <span className="inline-flex items-center rounded-md bg-emerald-100 dark:bg-emerald-950/70 px-2 py-0.5 text-[10px] font-semibold text-emerald-900 dark:text-emerald-300">
          Aktif
        </span>
      </div>

      <h4
        className={`flex items-center gap-1.5 text-sm font-bold text-ink transition-colors duration-150 truncate ${
          isInternal ? 'group-hover:text-amber-700 dark:group-hover:text-amber-300' : 'group-hover:text-sky-700 dark:group-hover:text-sky-300'
        }`}
      >
        {isInternal ? (
          <IconCog className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
        ) : (
          <IconCustomerGroup className="h-4 w-4 shrink-0 text-sky-600 dark:text-sky-400" />
        )}
        <span className="truncate">{data.name}</span>
      </h4>
      <p className="mt-1 flex items-center gap-1 text-[11px] text-ink-secondary truncate">
        <IconSitePin className="h-3.5 w-3.5 shrink-0 text-ink-muted" />
        <span className="truncate">{data.address || data.city}</span>
      </p>

      <div className="mt-3 pt-2.5 border-t border-line flex items-center justify-between text-xs">
        <span className="text-[11px] text-ink-secondary font-medium">Perangkat Site</span>
        <span className="font-mono font-bold text-ink bg-subtle px-2 py-0.5 rounded tabular-nums-data">
          {data.deviceCount} Unit
        </span>
      </div>

      <div
        className={`mt-3 flex items-center justify-between text-[11px] font-semibold px-2.5 py-1.5 rounded-lg ${
          isInternal
            ? 'text-amber-900 bg-amber-100 dark:text-amber-200 dark:bg-amber-950/70'
            : 'text-sky-900 bg-sky-100 dark:text-sky-200 dark:bg-sky-950/70'
        }`}
      >
        <span>Lihat Graf & Daftar Perangkat</span>
        <IconArrowRight className="h-3.5 w-3.5 transition-transform duration-150 group-hover:translate-x-1" />
      </div>
    </button>
  );
}

// 5. Simpul Perangkat pada Level 3 & Flat View
function DeviceCustomNode({ data, selected }: any) {
  const statusColor = STATUS_BADGES[data.inventoryStatus] || 'bg-subtle text-ink-secondary';

  return (
    <div
      className={`rounded-xl border bg-surface p-3.5 shadow-sm w-60 text-xs transition-[border-color,box-shadow] duration-150 cursor-pointer select-none ${
        selected
          ? 'border-accent ring-2 ring-accent/30 shadow-md'
          : 'border-line hover:border-line-strong'
      }`}
    >
      <Handle type="target" position={Position.Top} className="w-2.5 h-2.5 !bg-accent" />
      <Handle type="target" position={Position.Left} className="w-2.5 h-2.5 !bg-accent" />

      <div className="flex items-center gap-2.5 border-b border-line pb-2">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent-ink">
          <DeviceCategoryIcon code={data.categoryCode} className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-bold text-ink truncate" title={data.hostname}>
            {data.hostname}
          </div>
          <div className="font-mono text-[10px] text-ink-muted">{data.deviceCode}</div>
        </div>
      </div>

      <div className="mt-2 mb-2">
        {data.isPopCore ? (
          <span className="inline-flex items-center gap-1 rounded-md bg-amber-100 dark:bg-amber-950/70 px-2 py-0.5 text-[10px] font-semibold text-amber-900 dark:text-amber-300 truncate max-w-full">
            <IconPopBuilding className="h-3 w-3 shrink-0" />
            <span>Core POP: {data.siteCode}</span>
          </span>
        ) : (
          <span
            className="inline-flex items-center gap-1 rounded-md bg-sky-100 dark:bg-sky-950/70 px-2 py-0.5 text-[10px] font-semibold text-sky-900 dark:text-sky-300 truncate max-w-full"
            title={`${data.parentPop?.name || 'POP'} > ${data.site}`}
          >
            <IconCustomerGroup className="h-3 w-3 shrink-0" />
            <span>Pelanggan: {data.siteCode}</span>
          </span>
        )}
      </div>

      <div className="space-y-1 text-[11px] text-ink-secondary">
        <div className="flex justify-between">
          <span className="text-ink-muted">IP Mgmt</span>
          <span className="font-mono font-medium text-ink">
            {data.managementIp || '-'}
          </span>
        </div>
        <div className="flex justify-between items-center pt-0.5">
          <span className="text-ink-muted">Status</span>
          <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${statusColor}`}>
            {data.inventoryStatus}
          </span>
        </div>
      </div>

      <Handle type="source" position={Position.Bottom} className="w-2.5 h-2.5 !bg-accent" />
      <Handle type="source" position={Position.Right} className="w-2.5 h-2.5 !bg-accent" />
    </div>
  );
}

export function TopologyClient({ categories, canManageSites = false }: Props) {
  const { theme, mounted } = useTheme();
  const [navMode, setNavMode] = useState<'drilldown' | 'global'>('drilldown');
  const [currentLevel, setCurrentLevel] = useState<'pops' | 'sites' | 'devices'>('pops');

  const [activePop, setActivePop] = useState<{ id: number; name: string; siteCode: string } | null>(null);
  const [activeSite, setActiveSite] = useState<{
    id: number;
    name: string;
    siteCode: string;
    isInternalOnly?: boolean;
  } | null>(null);

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [categoryId, setCategoryId] = useState('');
  const [relationType, setRelationType] = useState('');
  const [medium, setMedium] = useState('');

  const [selectedNode, setSelectedNode] = useState<any | null>(null);
  const [selectedEdge, setSelectedEdge] = useState<any | null>(null);

  const [savingLayout, setSavingLayout] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);
  const [showAddCustomerModal, setShowAddCustomerModal] = useState(false);

  const [siteDeviceList, setSiteDeviceList] = useState<any[]>([]);

  useEffect(() => {
    if (!selectedNode && !selectedEdge) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSelectedNode(null);
        setSelectedEdge(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedNode, selectedEdge]);

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

  const handleSelectPop = useCallback((id: number, name: string, siteCode: string) => {
    setActivePop({ id, name, siteCode });
    setActiveSite(null);
    setCurrentLevel('sites');
    setSelectedNode(null);
    setSelectedEdge(null);
  }, []);

  const handleSelectSite = useCallback(
    (id: number, name: string, siteCode: string, isInternalOnly?: boolean) => {
      setActiveSite({ id, name, siteCode, isInternalOnly });
      setCurrentLevel('devices');
      setSelectedNode(null);
      setSelectedEdge(null);
    },
    []
  );

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

      const appliedNodes = topoData.nodes.map((node: any) => {
        const nodeData = { ...node.data };
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
  }, [
    navMode,
    currentLevel,
    activePop,
    activeSite,
    categoryId,
    relationType,
    medium,
    handleSelectPop,
    handleSelectSite,
    setNodes,
    setEdges,
  ]);

  useEffect(() => {
    fetchTopology();
  }, [fetchTopology]);

  const onNodeClick = (_: any, node: Node) => {
    const data = node.data as any;
    if (node.type === 'popNode') {
      handleSelectPop(Number(data.id), String(data.name), String(data.siteCode));
    } else if (node.type === 'siteNode') {
      handleSelectSite(
        Number(data.id),
        String(data.name),
        String(data.siteCode),
        Boolean(data.isInternalOnly)
      );
    } else if (node.type === 'deviceNode') {
      setSelectedNode(data);
      setSelectedEdge(null);
    }
  };

  const onEdgeClick = (_: any, edge: Edge) => {
    if (edge.data?.endpointA && edge.data?.endpointB) {
      setSelectedEdge(edge.data);
      setSelectedNode(null);
    }
  };

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
      setSaveSuccessMsg('Tata letak simpul berhasil disimpan.');
      setTimeout(() => setSaveSuccessMsg(null), 3500);
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setSavingLayout(false);
    }
  };

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

  const isDark = mounted && theme === 'dark';

  return (
    <div className="space-y-4">
      {/* Mode Switcher & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-line pb-3">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              setNavMode('drilldown');
              setCurrentLevel('pops');
              setActivePop(null);
              setActiveSite(null);
            }}
            className={`inline-flex min-h-[40px] items-center gap-2 px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-colors duration-150 ${
              navMode === 'drilldown'
                ? 'bg-accent text-accent-fg shadow-xs'
                : 'bg-subtle text-ink-secondary hover:text-ink'
            }`}
          >
            <IconLayers className="h-4 w-4" />
            <span>Graf Bertingkat (POP ke Site ke Perangkat)</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setNavMode('global');
              setSelectedNode(null);
              setSelectedEdge(null);
            }}
            className={`inline-flex min-h-[40px] items-center gap-2 px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-colors duration-150 ${
              navMode === 'global'
                ? 'bg-accent text-accent-fg shadow-xs'
                : 'bg-subtle text-ink-secondary hover:text-ink'
            }`}
          >
            <IconSubnetGlobe className="h-4 w-4" />
            <span>Topologi Global (Semua Perangkat)</span>
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleAutoLayout}
            className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg border border-line bg-surface px-3 py-1.5 text-xs font-medium text-ink-secondary hover:bg-subtle hover:text-ink shadow-xs"
          >
            <IconLayoutAuto className="h-4 w-4" />
            <span>Rapikan Posisi</span>
          </button>
          <button
            type="button"
            disabled={savingLayout}
            onClick={handleSaveLayout}
            className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg bg-accent px-3.5 py-1.5 text-xs font-semibold text-accent-fg hover:bg-accent-hover disabled:opacity-50 shadow-xs"
          >
            <IconSave className="h-4 w-4" />
            <span>{savingLayout ? 'Menyimpan...' : 'Simpan Layout'}</span>
          </button>
        </div>
      </div>

      {/* Breadcrumb Bar */}
      {navMode === 'drilldown' && (
        <nav
          aria-label="Hierarki Topologi"
          className="flex items-center flex-wrap justify-between gap-3 text-xs bg-surface p-3 rounded-xl border border-line shadow-xs"
        >
          <div className="flex items-center flex-wrap gap-2">
            <button
              type="button"
              onClick={handleBackToPops}
              className={`inline-flex min-h-[34px] items-center gap-1.5 rounded-md px-2.5 py-1 font-medium transition-colors duration-150 ${
                currentLevel === 'pops'
                  ? 'bg-accent-soft text-accent-ink font-semibold'
                  : 'text-ink-secondary hover:bg-subtle hover:text-ink'
              }`}
            >
              <IconPopBuilding className="h-3.5 w-3.5" />
              <span>Seluruh POP (Level 1)</span>
            </button>

            {activePop && (
              <>
                <IconChevronRight className="h-3.5 w-3.5 text-ink-muted" />
                <button
                  type="button"
                  onClick={handleBackToSites}
                  className={`inline-flex min-h-[34px] items-center gap-1.5 rounded-md px-2.5 py-1 font-medium transition-colors duration-150 ${
                    currentLevel === 'sites'
                      ? 'bg-accent-soft text-accent-ink font-semibold'
                      : 'text-ink-secondary hover:bg-subtle hover:text-ink'
                  }`}
                >
                  <IconSitePin className="h-3.5 w-3.5" />
                  <span>
                    {activePop.name} ({activePop.siteCode})
                  </span>
                </button>
              </>
            )}

            {activeSite && (
              <>
                <IconChevronRight className="h-3.5 w-3.5 text-ink-muted" />
                <span className="inline-flex min-h-[34px] items-center gap-1.5 rounded-md bg-accent-soft px-2.5 py-1 text-[11px] font-semibold text-accent-ink">
                  {activeSite.isInternalOnly ? (
                    <IconCog className="h-3.5 w-3.5" />
                  ) : (
                    <IconCustomerGroup className="h-3.5 w-3.5" />
                  )}
                  <span>
                    {activeSite.name} ({activeSite.siteCode})
                  </span>
                </span>
              </>
            )}
          </div>

          <div className="flex items-center flex-wrap gap-2">
            {currentLevel === 'sites' && activePop && canManageSites && (
              <button
                type="button"
                onClick={() => setShowAddCustomerModal(true)}
                className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg bg-accent px-3 py-1 text-xs font-semibold text-accent-fg shadow-xs hover:bg-accent-hover"
              >
                <IconPlus className="h-3.5 w-3.5" />
                <span>Tambah Site Pelanggan</span>
              </button>
            )}
            {currentLevel === 'sites' && (
              <button
                type="button"
                onClick={handleBackToPops}
                className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border border-line bg-canvas px-3 py-1 text-xs font-medium text-ink hover:bg-subtle"
              >
                <IconArrowLeft className="h-3.5 w-3.5" />
                <span>Kembali ke POP</span>
              </button>
            )}
            {currentLevel === 'devices' && (
              <button
                type="button"
                onClick={handleBackToSites}
                className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border border-line bg-canvas px-3 py-1 text-xs font-medium text-ink hover:bg-subtle"
              >
                <IconArrowLeft className="h-3.5 w-3.5" />
                <span>Kembali ke Daftar Site</span>
              </button>
            )}
            {saveSuccessMsg && (
              <span className="font-semibold text-emerald-800 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-950/70 px-2.5 py-1 rounded-md text-xs">
                {saveSuccessMsg}
              </span>
            )}
          </div>
        </nav>
      )}

      {/* Filter Bar */}
      {(navMode === 'global' || currentLevel === 'devices') && (
        <div className="rounded-xl border border-line bg-surface p-3.5 shadow-xs text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label htmlFor="topo-cat" className="block font-semibold text-ink-secondary mb-1">
                Filter Kategori
              </label>
              <select
                id="topo-cat"
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="min-h-[38px] w-full rounded-lg border border-line bg-canvas p-1.5 text-ink focus:border-accent focus:outline-none"
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
              <label htmlFor="topo-rel" className="block font-semibold text-ink-secondary mb-1">
                Tipe Relasi Kabel
              </label>
              <select
                id="topo-rel"
                value={relationType}
                onChange={(e) => setRelationType(e.target.value)}
                className="min-h-[38px] w-full rounded-lg border border-line bg-canvas p-1.5 text-ink focus:border-accent focus:outline-none"
              >
                <option value="">Semua Tipe Relasi</option>
                <option value="physical">Physical (Kabel Fisik)</option>
                <option value="logical">Logical (Tunnel / VLAN / L3)</option>
                <option value="parent_child">Parent-Child (Sasis / Modul)</option>
                <option value="service">Service (Layanan Pelanggan)</option>
              </select>
            </div>

            <div>
              <label htmlFor="topo-medium" className="block font-semibold text-ink-secondary mb-1">
                Media Transmisi
              </label>
              <select
                id="topo-medium"
                value={medium}
                onChange={(e) => setMedium(e.target.value)}
                className="min-h-[38px] w-full rounded-lg border border-line bg-canvas p-1.5 text-ink focus:border-accent focus:outline-none"
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
        <div className="rounded-xl border border-rose-200 dark:border-rose-900/60 bg-rose-50 dark:bg-rose-950/60 p-4 text-xs text-rose-800 dark:text-rose-200">
          {errorMsg}
        </div>
      )}

      {/* React Flow Canvas */}
      <div className="relative h-[580px] sm:h-[620px] w-full rounded-xl border border-line bg-subtle overflow-hidden shadow-xs">
        {loading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-canvas/85">
            <div className="text-center">
              <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-accent border-r-transparent" />
              <p className="mt-2 text-xs font-semibold text-ink">
                Memuat visualisasi topologi...
              </p>
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
          <Background
            variant={BackgroundVariant.Dots}
            gap={18}
            size={1}
            color={isDark ? '#263345' : '#cbd5e1'}
          />
          <Controls position="bottom-left" />
          <MiniMap
            position="bottom-right"
            maskColor={isDark ? 'rgba(12, 17, 24, 0.72)' : 'rgba(246, 248, 251, 0.72)'}
            nodeColor={(node: any) => {
              if (node.type === 'rootNode') return '#0f1e36';
              if (node.type === 'popNode' || node.type === 'popParentNode') {
                return isDark ? '#60a5fa' : '#1d4ed8';
              }
              if (node.type === 'siteNode') return '#0284c7';
              return isDark ? '#93c5fd' : '#3b82f6';
            }}
          />

          <Panel
            position="top-left"
            className="bg-surface p-3 rounded-xl border border-line shadow-sm text-[11px] space-y-2 select-none max-w-xs"
          >
            <div className="font-bold text-ink text-xs border-b border-line pb-1.5">
              Petunjuk Navigasi
            </div>
            {navMode === 'drilldown' && currentLevel === 'pops' && (
              <div className="text-ink-secondary leading-relaxed">
                Klik simpul <strong className="text-ink">POP</strong> untuk masuk ke daftar site pelanggan.
              </div>
            )}
            {navMode === 'drilldown' && currentLevel === 'sites' && (
              <div className="text-ink-secondary leading-relaxed">
                Klik simpul <strong className="text-ink">Site Pelanggan</strong> untuk melihat graf dan daftar perangkatnya.
              </div>
            )}
            {(navMode === 'global' || currentLevel === 'devices') && (
              <div className="text-ink-secondary leading-relaxed">
                Klik simpul perangkat untuk spesifikasi detail, atau klik kabel untuk melihat port terhubung.
              </div>
            )}
            <div className="pt-1.5 border-t border-line space-y-1">
              <div className="flex items-center gap-2">
                <span className="w-4 h-0.5 bg-[#1d4ed8] dark:bg-[#60a5fa] inline-block" />
                <span className="text-ink-secondary">Backbone / Kabel Fisik</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-4 h-0.5 border-t-2 border-dashed border-sky-500 inline-block" />
                <span className="text-ink-secondary">Akses / Logical (VLAN)</span>
              </div>
            </div>
          </Panel>
        </ReactFlow>

        {/* Node Detail Floating Inspector */}
        {selectedNode && (
          <div className="animate-drill-forward absolute top-3 right-3 z-20 w-80 max-w-[calc(100%-1.5rem)] rounded-xl border border-line bg-elevated p-4 shadow-xl text-xs space-y-3">
            <div className="flex items-center justify-between border-b border-line pb-2.5">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent-ink">
                  <DeviceCategoryIcon code={selectedNode.categoryCode} className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <h3 className="font-bold text-ink truncate leading-tight">
                    {selectedNode.hostname}
                  </h3>
                  <p className="font-mono text-[10px] text-ink-muted">{selectedNode.deviceCode}</p>
                </div>
              </div>
              <button
                type="button"
                aria-label="Tutup detail perangkat"
                onClick={() => setSelectedNode(null)}
                className="flex h-8 w-8 items-center justify-center rounded-md text-ink-muted hover:bg-subtle hover:text-ink"
              >
                <IconClose className="h-4 w-4" />
              </button>
            </div>

            <dl className="divide-y divide-line text-[11px]">
              <div className="py-1.5 flex justify-between gap-2">
                <dt className="text-ink-muted">Lingkup Lokasi</dt>
                <dd className="font-semibold text-ink text-right">
                  {selectedNode.isPopCore ? 'Infrastruktur Core POP' : 'Site Pelanggan'}
                </dd>
              </div>
              <div className="py-1.5 flex justify-between gap-2">
                <dt className="text-ink-muted">POP Induk</dt>
                <dd className="font-medium text-ink text-right">
                  {selectedNode.parentPop?.name || selectedNode.site} (
                  {selectedNode.parentPop?.siteCode || selectedNode.siteCode})
                </dd>
              </div>
              {!selectedNode.isPopCore && (
                <div className="py-1.5 flex justify-between gap-2">
                  <dt className="text-ink-muted">Nama Pelanggan</dt>
                  <dd className="font-medium text-ink text-right">
                    {selectedNode.site} ({selectedNode.siteCode})
                  </dd>
                </div>
              )}
              <div className="py-1.5 flex justify-between gap-2">
                <dt className="text-ink-muted">Kategori</dt>
                <dd className="font-medium text-ink">{selectedNode.category}</dd>
              </div>
              <div className="py-1.5 flex justify-between gap-2">
                <dt className="text-ink-muted">Vendor & Model</dt>
                <dd className="font-medium text-ink text-right">
                  <div>{selectedNode.vendor}</div>
                  <div className="text-[10px] text-ink-muted">{selectedNode.model || '-'}</div>
                </dd>
              </div>
              <div className="py-1.5 flex justify-between gap-2">
                <dt className="text-ink-muted">IP Manajemen</dt>
                <dd className="font-mono font-bold text-ink">
                  {selectedNode.managementIp || 'Belum diatur'}
                </dd>
              </div>
              <div className="py-1.5 flex justify-between gap-2">
                <dt className="text-ink-muted">Role Jaringan</dt>
                <dd className="uppercase font-mono text-ink">{selectedNode.networkRole || '-'}</dd>
              </div>
              <div className="py-1.5 flex justify-between items-center gap-2">
                <dt className="text-ink-muted">Status Inventaris</dt>
                <dd>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                      STATUS_BADGES[selectedNode.inventoryStatus] || 'bg-subtle text-ink-secondary'
                    }`}
                  >
                    {selectedNode.inventoryStatus}
                  </span>
                </dd>
              </div>
            </dl>

            <div className="pt-2 border-t border-line flex justify-end">
              <Link
                href={`/devices/${selectedNode.id}`}
                className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-[11px] font-semibold text-accent-fg hover:bg-accent-hover shadow-xs"
              >
                <span>Buka Detail Lengkap</span>
                <IconArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>
        )}

        {/* Edge Detail Floating Inspector */}
        {selectedEdge && (
          <div className="animate-drill-forward absolute top-3 right-3 z-20 w-80 max-w-[calc(100%-1.5rem)] rounded-xl border border-line bg-elevated p-4 shadow-xl text-xs space-y-3">
            <div className="flex items-center justify-between border-b border-line pb-2.5">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent-ink">
                  <IconLinkCable className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="font-bold text-ink leading-tight">Detail Relasi Koneksi</h3>
                  <p className="text-[10px] text-ink-muted">Dokumentasi Antarport</p>
                </div>
              </div>
              <button
                type="button"
                aria-label="Tutup detail relasi"
                onClick={() => setSelectedEdge(null)}
                className="flex h-8 w-8 items-center justify-center rounded-md text-ink-muted hover:bg-subtle hover:text-ink"
              >
                <IconClose className="h-4 w-4" />
              </button>
            </div>

            <div className="rounded-lg border border-line bg-subtle p-3 space-y-2 text-[11px]">
              <div>
                <span className="text-[10px] font-semibold text-accent-ink uppercase tracking-wide">
                  Endpoint A:
                </span>
                <div className="font-medium text-ink">{selectedEdge.endpointA?.hostname}</div>
                <div className="font-mono text-ink-secondary font-bold">
                  Port: {selectedEdge.endpointA?.portName}
                </div>
              </div>
              <div className="border-t border-dashed border-line-strong pt-2">
                <span className="text-[10px] font-semibold text-emerald-700 dark:text-emerald-300 uppercase tracking-wide">
                  Endpoint B:
                </span>
                <div className="font-medium text-ink">{selectedEdge.endpointB?.hostname}</div>
                <div className="font-mono text-ink-secondary font-bold">
                  Port: {selectedEdge.endpointB?.portName}
                </div>
              </div>
            </div>

            <dl className="divide-y divide-line text-[11px]">
              <div className="py-1.5 flex justify-between">
                <dt className="text-ink-muted">Tipe Relasi</dt>
                <dd className="font-semibold text-ink uppercase">{selectedEdge.relationType}</dd>
              </div>
              <div className="py-1.5 flex justify-between">
                <dt className="text-ink-muted">Media Transmisi</dt>
                <dd className="font-medium text-ink capitalize">
                  {selectedEdge.medium || 'Unknown'}
                </dd>
              </div>
              <div className="py-1.5 flex justify-between">
                <dt className="text-ink-muted">Kapasitas Link</dt>
                <dd className="font-mono font-medium text-ink">
                  {selectedEdge.capacityMbps
                    ? `${selectedEdge.capacityMbps} Mbps`
                    : 'Tidak dicatat'}
                </dd>
              </div>
              {selectedEdge.label && (
                <div className="py-1.5 flex justify-between">
                  <dt className="text-ink-muted">Label Link</dt>
                  <dd className="font-medium text-ink">{selectedEdge.label}</dd>
                </div>
              )}
            </dl>
          </div>
        )}
      </div>

      {/* Level 3 Site Devices Table */}
      {navMode === 'drilldown' && currentLevel === 'devices' && activeSite && (
        <div className="animate-enter rounded-xl border border-line bg-surface p-5 shadow-xs space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-line pb-3">
            <div>
              <h3 className="flex items-center gap-2 text-sm font-bold text-ink">
                <IconTable className="h-4 w-4 text-accent" />
                <span>
                  Daftar Perangkat di Site {activeSite.name} ({activeSite.siteCode})
                </span>
              </h3>
              <p className="text-xs text-ink-secondary mt-0.5 tabular-nums-data">
                Total {siteDeviceList.length} unit perangkat terpasang di lokasi ini.
              </p>
            </div>
            <Link
              href={`/devices/new?siteId=${activeSite.id}`}
              className="inline-flex min-h-[38px] items-center gap-1.5 rounded-lg bg-accent px-3.5 py-1.5 text-xs font-semibold text-accent-fg hover:bg-accent-hover shadow-xs"
            >
              <IconPlus className="h-3.5 w-3.5" />
              <span>Tambah Perangkat ke Site Ini</span>
            </Link>
          </div>

          <div className="overflow-x-auto rounded-lg border border-line">
            <table className="min-w-full divide-y divide-line text-left text-xs">
              <thead className="bg-subtle font-semibold text-ink-secondary uppercase text-[11px]">
                <tr>
                  <th className="px-3.5 py-2.5">Kode / Hostname</th>
                  <th className="px-3.5 py-2.5">Kategori</th>
                  <th className="px-3.5 py-2.5">Vendor / Model</th>
                  <th className="px-3.5 py-2.5">IP Manajemen</th>
                  <th className="px-3.5 py-2.5">Status</th>
                  <th className="px-3.5 py-2.5 text-right">Tindakan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line bg-surface">
                {siteDeviceList.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-8 text-ink-secondary">
                      Belum ada perangkat terpasang di site ini.
                    </td>
                  </tr>
                ) : (
                  siteDeviceList.map((dev: any) => (
                    <tr key={dev.id} className="transition-colors duration-100 hover:bg-subtle/60">
                      <td className="px-3.5 py-3">
                        <Link
                          href={`/devices/${dev.id}`}
                          className="font-semibold text-accent-ink hover:underline"
                        >
                          {dev.hostname}
                        </Link>
                        <div className="font-mono text-[10px] text-ink-muted">{dev.deviceCode}</div>
                      </td>
                      <td className="px-3.5 py-3 text-ink-secondary">{dev.category}</td>
                      <td className="px-3.5 py-3 text-ink">
                        <div>{dev.vendor}</div>
                        <div className="text-[10px] text-ink-muted">{dev.model || '-'}</div>
                      </td>
                      <td className="px-3.5 py-3 font-mono">
                        {dev.managementIp ? (
                          <span className="bg-accent-soft text-accent-ink px-2 py-0.5 rounded text-[11px] font-medium">
                            {dev.managementIp}
                          </span>
                        ) : (
                          <span className="text-ink-muted italic">Belum diatur</span>
                        )}
                      </td>
                      <td className="px-3.5 py-3">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                            STATUS_BADGES[dev.inventoryStatus] || 'bg-subtle text-ink-secondary'
                          }`}
                        >
                          {dev.inventoryStatus}
                        </span>
                      </td>
                      <td className="px-3.5 py-3 text-right">
                        <Link
                          href={`/devices/${dev.id}`}
                          className="inline-flex items-center gap-1 rounded-md border border-line bg-canvas px-2.5 py-1 text-[11px] font-medium text-ink hover:bg-subtle"
                        >
                          <span>Detail</span>
                          <IconArrowRight className="h-3 w-3" />
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

      <AddCustomerSiteModal
        open={showAddCustomerModal && !!activePop}
        pop={activePop}
        onClose={() => setShowAddCustomerModal(false)}
        onCreated={(created) => {
          setSaveSuccessMsg(`Site '${created.name}' (${created.siteCode}) ditambahkan`);
          setTimeout(() => setSaveSuccessMsg(null), 4000);
          fetchTopology();
        }}
      />
    </div>
  );
}
