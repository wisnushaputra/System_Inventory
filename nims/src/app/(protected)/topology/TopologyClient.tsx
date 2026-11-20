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

// Custom Node Component untuk Perangkat Jaringan (T7.1)
function DeviceCustomNode({ data, selected }: any) {
  const icon = CATEGORY_ICONS[data.categoryCode] || '📦';
  const statusColor = STATUS_BADGES[data.inventoryStatus] || 'bg-slate-100 text-slate-700';

  return (
    <div
      className={`rounded-lg border bg-white p-3 shadow-md w-56 text-xs transition cursor-pointer ${
        selected ? 'border-indigo-600 ring-2 ring-indigo-400' : 'border-slate-200 hover:border-slate-400'
      }`}
    >
      <Handle type="target" position={Position.Top} className="w-2.5 h-2.5 !bg-indigo-500" />
      <Handle type="target" position={Position.Left} className="w-2.5 h-2.5 !bg-indigo-500" />

      <div className="flex items-center space-x-2 border-b border-slate-100 pb-2">
        <span className="text-xl leading-none">{icon}</span>
        <div className="min-w-0 flex-1">
          <div className="font-bold text-slate-900 truncate" title={data.hostname}>
            {data.hostname}
          </div>
          <div className="font-mono text-[10px] text-slate-400">{data.deviceCode}</div>
        </div>
      </div>

      <div className="mt-2 space-y-1 text-[11px] text-slate-600">
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

export function TopologyClient({ sites, categories }: Props) {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Filter states
  const [siteId, setSiteId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [relationType, setRelationType] = useState('');
  const [medium, setMedium] = useState('');

  // Selected Detail Panel states
  const [selectedNode, setSelectedNode] = useState<any | null>(null);
  const [selectedEdge, setSelectedEdge] = useState<any | null>(null);

  // Layout save state
  const [savingLayout, setSavingLayout] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);

  const nodeTypes = useMemo(() => ({ deviceNode: DeviceCustomNode }), []);

  const fetchTopology = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const params = new URLSearchParams();
      if (siteId) params.set('siteId', siteId);
      if (categoryId) params.set('categoryId', categoryId);
      if (relationType) params.set('relationType', relationType);
      if (medium) params.set('medium', medium);

      const [resTopo, resLayout] = await Promise.all([
        fetch(`/api/topology?${params.toString()}`),
        fetch(`/api/topology/layout?scope=${siteId ? `site-${siteId}` : 'default'}`),
      ]);

      if (!resTopo.ok) throw new Error('Gagal memuat data relasi topologi');
      const topoData = await resTopo.json();
      const layoutData = resLayout.ok ? await resLayout.json() : { positions: {} };

      // Pasang posisi tersimpan jika ada (T7.2)
      const positions = layoutData.positions || {};
      const appliedNodes = topoData.nodes.map((node: any) => {
        if (positions[node.id]) {
          return {
            ...node,
            position: positions[node.id],
          };
        }
        return node;
      });

      setNodes(appliedNodes);
      setEdges(topoData.edges);
    } catch (err: any) {
      setErrorMsg(err.message || 'Terjadi kesalahan sistem');
    } finally {
      setLoading(false);
    }
  }, [siteId, categoryId, relationType, medium, setNodes, setEdges]);

  useEffect(() => {
    fetchTopology();
  }, [fetchTopology]);

  // Handler klik node: Tampilkan detail perangkat (DoD T7.1)
  const onNodeClick = (_: any, node: Node) => {
    setSelectedNode(node.data);
    setSelectedEdge(null);
  };

  // Handler klik edge: Tampilkan dua port terhubung (DoD T7.1)
  const onEdgeClick = (_: any, edge: Edge) => {
    setSelectedEdge(edge.data);
    setSelectedNode(null);
  };

  // Handler Simpan Layout (T7.2)
  const handleSaveLayout = async () => {
    setSavingLayout(true);
    setSaveSuccessMsg(null);
    try {
      const positions: Record<string, { x: number; y: number }> = {};
      nodes.forEach((n) => {
        positions[n.id] = { x: Math.round(n.position.x), y: Math.round(n.position.y) };
      });

      const res = await fetch('/api/topology/layout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scope: siteId ? `site-${siteId}` : 'default',
          positions,
        }),
      });

      if (!res.ok) throw new Error('Gagal menyimpan tata letak.');
      setSaveSuccessMsg('Tata letak node berhasil disimpan!');
      setTimeout(() => setSaveSuccessMsg(null), 3500);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSavingLayout(false);
    }
  };

  // Handler Atur Posisi Otomatis (Auto Layout)
  const handleAutoLayout = () => {
    const cols = Math.ceil(Math.sqrt(nodes.length)) || 1;
    setNodes((prevNodes) =>
      prevNodes.map((n, idx) => ({
        ...n,
        position: {
          x: (idx % cols) * 280 + 80,
          y: Math.floor(idx / cols) * 200 + 80,
        },
      }))
    );
  };

  return (
    <div className="space-y-4">
      {/* Filter Bar Topologi */}
      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm text-xs">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
          <div>
            <label className="block font-medium text-slate-600 mb-1">Filter Site / POP</label>
            <select
              value={siteId}
              onChange={(e) => setSiteId(e.target.value)}
              className="w-full rounded border border-slate-300 p-1.5 focus:border-indigo-500"
            >
              <option value="">Semua Site / POP</option>
              {sites.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.siteCode} - {s.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block font-medium text-slate-600 mb-1">Kategori Perangkat</label>
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="w-full rounded border border-slate-300 p-1.5 focus:border-indigo-500"
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
            <label className="block font-medium text-slate-600 mb-1">Tipe Relasi</label>
            <select
              value={relationType}
              onChange={(e) => setRelationType(e.target.value)}
              className="w-full rounded border border-slate-300 p-1.5 focus:border-indigo-500"
            >
              <option value="">Semua Tipe Relasi</option>
              <option value="physical">Physical (Kabel Fisik)</option>
              <option value="logical">Logical (Tunnel / VLAN / L3)</option>
              <option value="parent_child">Parent-Child (Sasis / Modul)</option>
              <option value="service">Service (Layanan Pelanggan)</option>
            </select>
          </div>

          <div>
            <label className="block font-medium text-slate-600 mb-1">Media Transmisi</label>
            <select
              value={medium}
              onChange={(e) => setMedium(e.target.value)}
              className="w-full rounded border border-slate-300 p-1.5 focus:border-indigo-500"
            >
              <option value="">Semua Media</option>
              <option value="fiber">Fiber Optic</option>
              <option value="copper">Copper / Tembaga (UTP)</option>
              <option value="wireless">Wireless Radio</option>
              <option value="logical">Logical Virtual</option>
            </select>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 mt-3 pt-3 border-t border-slate-100">
          <div className="flex items-center space-x-2 text-[11px] text-slate-500">
            <span>
              Menampilkan <strong>{nodes.length}</strong> perangkat &bull; <strong>{edges.length}</strong> relasi koneksi
            </span>
            {saveSuccessMsg && (
              <span className="font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                {saveSuccessMsg}
              </span>
            )}
          </div>

          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={handleAutoLayout}
              className="rounded border border-slate-300 bg-white px-2.5 py-1 text-slate-600 hover:bg-slate-50 font-medium"
            >
              🔄 Rapikan Posisi
            </button>
            <button
              type="button"
              disabled={savingLayout}
              onClick={handleSaveLayout}
              className="rounded bg-indigo-600 px-3 py-1 font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
            >
              {savingLayout ? 'Menyimpan...' : '💾 Simpan Layout'}
            </button>
          </div>
        </div>
      </div>

      {errorMsg && (
        <div className="rounded-md border border-rose-200 bg-rose-50 p-4 text-xs text-rose-800">
          {errorMsg}
        </div>
      )}

      {/* Kanvas React Flow & Sidebar Detail */}
      <div className="relative h-[620px] w-full rounded-lg border border-slate-200 bg-slate-50 overflow-hidden shadow-sm">
        {loading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/70 backdrop-blur-xs text-xs font-semibold text-slate-600">
            Memuat diagram topologi...
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
          maxZoom={2.5}
        >
          <Background color="#cbd5e1" gap={20} size={1} variant={BackgroundVariant.Dots} />
          <Controls position="bottom-right" className="!bg-white !border-slate-200 shadow-md" />
          <MiniMap
            position="bottom-left"
            className="!bg-white !border-slate-200 shadow-md rounded-md overflow-hidden"
            zoomable
            pannable
          />

          {/* Legenda Topologi (DoD T7.1) */}
          <Panel position="top-left" className="!m-3">
            <div className="rounded-lg border border-slate-200 bg-white/95 backdrop-blur-xs p-3 shadow-md text-[11px] space-y-2 max-w-xs">
              <div className="font-bold text-slate-800 border-b pb-1">Legenda Relasi Topologi</div>
              <div className="space-y-1">
                <div className="flex items-center space-x-2">
                  <span className="w-5 h-0.5 bg-indigo-600 inline-block" />
                  <span className="text-slate-600">Physical (Kabel Fisik)</span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="w-5 h-0.5 border-b-2 border-dashed border-sky-500 inline-block" />
                  <span className="text-slate-600">Logical (Virtual / Tunnel)</span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="w-5 h-0.5 bg-indigo-600 inline-block ring-2 ring-indigo-200" />
                  <span className="text-slate-600">Fiber Optic (Animasi)</span>
                </div>
              </div>
              <div className="border-t pt-1.5 text-[10px] text-slate-400">
                ⚠️ <em>Status node merupakan status inventaris administratif. Tidak ada label status up/down real-time (DoD T7.1).</em>
              </div>
            </div>
          </Panel>
        </ReactFlow>

        {/* Panel Detail Node (Klik Node → Detail Perangkat) (DoD T7.1) */}
        {selectedNode && (
          <div className="absolute top-3 right-3 z-20 w-80 rounded-lg border border-slate-200 bg-white p-4 shadow-xl text-xs space-y-3">
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
                <dt className="text-slate-400">Kategori</dt>
                <dd className="font-medium text-slate-700">{selectedNode.category}</dd>
              </div>
              <div className="py-1.5 flex justify-between">
                <dt className="text-slate-400">Vendor / Model</dt>
                <dd className="text-slate-700">{selectedNode.vendor} {selectedNode.model ? `(${selectedNode.model})` : ''}</dd>
              </div>
              <div className="py-1.5 flex justify-between">
                <dt className="text-slate-400">Management IP</dt>
                <dd className="font-mono font-bold text-indigo-700">{selectedNode.managementIp || '-'}</dd>
              </div>
              <div className="py-1.5 flex justify-between">
                <dt className="text-slate-400">Lokasi / Site</dt>
                <dd className="font-medium text-slate-700">{selectedNode.siteCode} - {selectedNode.site}</dd>
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
          <div className="absolute top-3 right-3 z-20 w-80 rounded-lg border border-slate-200 bg-white p-4 shadow-xl text-xs space-y-3">
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
                <div className="font-medium text-slate-900">{selectedEdge.endpointA.hostname}</div>
                <div className="font-mono text-slate-600 font-bold">Port: {selectedEdge.endpointA.portName}</div>
              </div>
              <div className="border-t border-dashed border-slate-300 pt-1.5">
                <span className="text-[10px] font-semibold text-emerald-700 uppercase tracking-wide">Endpoint B:</span>
                <div className="font-medium text-slate-900">{selectedEdge.endpointB.hostname}</div>
                <div className="font-mono text-slate-600 font-bold">Port: {selectedEdge.endpointB.portName}</div>
              </div>
            </div>

            <dl className="divide-y divide-slate-100 text-[11px]">
              <div className="py-1 flex justify-between">
                <dt className="text-slate-400">Tipe Relasi</dt>
                <dd className="font-semibold text-slate-700 uppercase">{selectedEdge.relationType}</dd>
              </div>
              <div className="py-1 flex justify-between">
                <dt className="text-slate-400">Media Transmisi</dt>
                <dd className="font-medium text-slate-700 uppercase">{selectedEdge.medium || 'Unknown'}</dd>
              </div>
              <div className="py-1 flex justify-between">
                <dt className="text-slate-400">Kapasitas Link</dt>
                <dd className="font-mono font-medium text-slate-700">
                  {selectedEdge.capacityMbps ? `${selectedEdge.capacityMbps} Mbps` : '-'}
                </dd>
              </div>
              <div className="py-1 flex justify-between">
                <dt className="text-slate-400">Status Dokumentasi</dt>
                <dd className="font-medium text-slate-700 uppercase">{selectedEdge.status || 'Documented'}</dd>
              </div>
              {selectedEdge.label && (
                <div className="py-1 flex justify-between">
                  <dt className="text-slate-400">Label / Tag</dt>
                  <dd className="text-slate-700 italic">{selectedEdge.label}</dd>
                </div>
              )}
            </dl>
          </div>
        )}
      </div>
    </div>
  );
}
