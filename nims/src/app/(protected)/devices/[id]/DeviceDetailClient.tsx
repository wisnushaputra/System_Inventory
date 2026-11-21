'use client';

import { useState, useCallback, useEffect } from 'react';
import Link from 'next/link';
import {
  IconAlertTriangle,
  IconFileDoc,
  IconDownload,
  IconClose,
  IconRefresh,
  IconPlus,
  IconCheckCircle,
  IconLinkCable,
  IconEdit,
} from '@/components/Icons';
import { parsePointToPointHost } from '@/lib/ipam';
import { RoomRackManagerModal } from '@/components/RoomRackManagerModal';

interface AuditItem {
  id: number;
  action: string;
  createdAt: string;
  user: { name: string; username: string } | null;
  beforeData: any;
  afterData: any;
}

interface SubnetRef {
  id: number;
  name: string;
  cidr: string;
  purpose?: string;
}
interface InterfaceRef {
  id: number;
  name: string;
  label: string | null;
}

interface IpAddressItem {
  id: number;
  address: string;
  ipVersion: string;
  subnetId: number;
  subnet: SubnetRef;
  deviceId: number | null;
  interfaceId: number | null;
  interface?: InterfaceRef | null;
  purpose: string;
  allocationStatus: string;
  hostname: string | null;
  description: string | null;
  assignedAt: string | null;
  releasedAt: string | null;
}

interface InterfaceItem {
  id: number;
  deviceId: number;
  name: string;
  label: string | null;
  interfaceType: string;
  mediaType: string | null;
  speedMbps: number | null;
  adminStatus: string;
  operStatus: string;
  macAddress: string | null;
  portMode: string | null;
  vlanId: number | null;
  description: string | null;
  createdAt: string;
  updatedAt: string;
  ipAddresses: IpAddressItem[];
}

interface ConnectionDeviceRef {
  id: number;
  hostname: string;
  deviceCode: string;
  archivedAt: string | null;
}

interface ConnectionItem {
  id: number;
  endpointAInterfaceId: number;
  endpointAInterface: {
    id: number;
    name: string;
    deviceId: number;
    device: ConnectionDeviceRef;
  };
  endpointBInterfaceId: number;
  endpointBInterface: {
    id: number;
    name: string;
    deviceId: number;
    device: ConnectionDeviceRef;
  };
  relationType: string;
  medium: string | null;
  label: string | null;
  status: string;
  capacityMbps: number | null;
  description: string | null;
  archivedAt: string | null;
  archiveReason: string | null;
  createdAt: string;
}

interface DocumentItem {
  id: number;
  deviceId: number | null;
  originalFilename: string;
  mimeType: string;
  fileSize: number;
  checksum: string;
  category: string;
  sensitivityLevel: string;
  description: string | null;
  uploadedAt: string;
  uploader: { id: number; name: string; username: string } | null;
}

interface DeviceDetailProps {
  device: {
    id: number;
    deviceCode: string;
    hostname: string;
    serialNumber: string | null;
    networkRole: string | null;
    inventoryStatus: string;
    managementNotes: string | null;
    description: string | null;
    installedAt: string | null;
    warrantyExpiry: string | null;
    ownerTeam: string | null;
    archivedAt: string | null;
    archiveReason: string | null;
    createdAt: string;
    updatedAt: string;
    version?: number;
    managementIp?: string | null;
    category: { id: number; name: string; code: string };
    vendor: { id: number; name: string; website: string | null };
    model: { id: number; modelName: string; modelCode: string } | null;
    site: {
      id: number;
      name: string;
      siteCode: string;
      siteType: string;
      parentSiteId: number | null;
      parentSite?: { id: number; siteCode: string; name: string } | null;
      address: string | null;
      city: string | null;
    };
    room: { id: number; name: string; floor: string | null } | null;
    rack: { id: number; name: string; unitCapacity: number } | null;
    creator: { id: number; name: string; username: string } | null;
    updater: { id: number; name: string; username: string } | null;
    interfaces?: InterfaceItem[];
    ipAddresses?: IpAddressItem[];
    connections?: ConnectionItem[];
    documents?: DocumentItem[];
  };
  history: AuditItem[];
  canEdit: boolean;
  canUpdateDevice?: boolean;
  canArchive: boolean;
  canUploadDoc?: boolean;
  canManageIp?: boolean;
  canManageSites?: boolean;
}

const STATUS_COLOR: Record<string, string> = {
  enabled: 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950/70 dark:text-emerald-300',
  disabled: 'bg-subtle text-ink-muted',
  up: 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950/70 dark:text-emerald-300',
  down: 'bg-rose-100 text-rose-900 dark:bg-rose-950/70 dark:text-rose-300',
  unknown: 'bg-subtle text-ink-muted',
  ALLOCATED: 'bg-sky-100 text-sky-900 dark:bg-sky-950/70 dark:text-sky-300',
  RELEASED: 'bg-subtle text-ink-muted',
  RESERVED: 'bg-amber-100 text-amber-900 dark:bg-amber-950/70 dark:text-amber-300',
  AVAILABLE: 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950/70 dark:text-emerald-300',
};

const DOC_CATEGORY_MAP: Record<string, string> = {
  photo: 'Foto Perangkat',
  topology_diagram: 'Diagram Topologi',
  config_backup: 'Backup Konfigurasi',
  warranty: 'Garansi & Servis',
  manual: 'Buku Manual',
  contract: 'Kontrak / SLA',
  other: 'Lainnya',
};

function formatBytes(bytes: number, decimals = 1) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

export function DeviceDetailClient({
  device,
  history,
  canEdit,
  canUpdateDevice = false,
  canArchive,
  canUploadDoc = false,
  canManageIp = false,
  canManageSites = false,
}: DeviceDetailProps) {
  const [activeTab, setActiveTab] = useState<
    'overview' | 'network' | 'ports' | 'connections' | 'documents' | 'history'
  >('overview');
  const [showArchiveModal, setShowArchiveModal] = useState(false);
  const [archiveReason, setArchiveReason] = useState('');
  const [loadingArchive, setLoadingArchive] = useState(false);

  const [interfaces, setInterfaces] = useState<InterfaceItem[]>(device.interfaces || []);
  const [portsLoading, setPortsLoading] = useState(false);
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [batchPrefix, setBatchPrefix] = useState('ether');
  const [batchStart, setBatchStart] = useState(1);
  const [batchCount, setBatchCount] = useState(8);
  const [batchType, setBatchType] = useState('ethernet');
  const [batchSpeed, setBatchSpeed] = useState<string>('1000');
  const [batchSubmitting, setBatchSubmitting] = useState(false);

  const [ipAddresses, setIpAddresses] = useState<IpAddressItem[]>(device.ipAddresses || []);
  const [ipLoading, setIpLoading] = useState(false);
  const [showManualIpModal, setShowManualIpModal] = useState(false);
  const [manualIpAddress, setManualIpAddress] = useState('');
  const [manualIpPrefix, setManualIpPrefix] = useState<30 | 31>(30);
  const [manualIpInterfaceId, setManualIpInterfaceId] = useState('');
  const [manualIpDescription, setManualIpDescription] = useState('');
  const [manualIpSubmitting, setManualIpSubmitting] = useState(false);
  const [manualIpError, setManualIpError] = useState<string | null>(null);
  const [ipSuccessMsg, setIpSuccessMsg] = useState<string | null>(null);

  const [currentRoom, setCurrentRoom] = useState(device.room);
  const [currentRack, setCurrentRack] = useState(device.rack);
  const [deviceVersion, setDeviceVersion] = useState(device.version ?? 1);
  const [showPlacementModal, setShowPlacementModal] = useState(false);
  const [siteRooms, setSiteRooms] = useState<{ id: number; name: string; floor: string | null }[]>([]);
  const [siteRacks, setSiteRacks] = useState<
    { id: number; name: string; roomId: number | null; unitCapacity: number }[]
  >([]);
  const [placementLoading, setPlacementLoading] = useState(false);
  const [selectedRoomId, setSelectedRoomId] = useState('');
  const [selectedRackId, setSelectedRackId] = useState('');
  const [placementSubmitting, setPlacementSubmitting] = useState(false);
  const [placementError, setPlacementError] = useState<string | null>(null);
  const [placementSuccessMsg, setPlacementSuccessMsg] = useState<string | null>(null);
  const [showRoomRackManager, setShowRoomRackManager] = useState(false);

  const currentManagementIp =
    ipAddresses.find((ip) => ip.purpose === 'management' && ip.allocationStatus === 'ALLOCATED')
      ?.address ?? null;

  const isP2pEligible =
    device.site.siteType === 'pop' ||
    (device.site.siteType === 'customer_site' && device.site.parentSiteId !== null);

  const manualIpPreview = manualIpAddress.trim()
    ? parsePointToPointHost(manualIpAddress, manualIpPrefix)
    : null;

  const [connections, setConnections] = useState<ConnectionItem[]>(device.connections || []);
  const [connectionsLoading, setConnectionsLoading] = useState(false);
  const [connIsArchived, setConnIsArchived] = useState(false);
  const [showConnModal, setShowConnModal] = useState(false);
  const [connLocalIfaceId, setConnLocalIfaceId] = useState('');
  const [connRemoteDeviceId, setConnRemoteDeviceId] = useState('');
  const [connRemoteIfaceId, setConnRemoteIfaceId] = useState('');
  const [connRelationType, setConnRelationType] = useState('physical');
  const [connMedium, setConnMedium] = useState('fiber');
  const [connCapacity, setConnCapacity] = useState('1000');
  const [connLabel, setConnLabel] = useState('');
  const [connDesc, setConnDesc] = useState('');
  const [connSubmitting, setConnSubmitting] = useState(false);
  const [lookupDevices, setLookupDevices] = useState<any[]>([]);
  const [lookupLoading, setLookupLoading] = useState(false);

  const [archiveConnTarget, setArchiveConnTarget] = useState<ConnectionItem | null>(null);
  const [archiveConnReason, setArchiveConnReason] = useState('');
  const [archiveConnLoading, setArchiveConnLoading] = useState(false);

  const [documents, setDocuments] = useState<DocumentItem[]>(device.documents || []);
  const [docsLoading, setDocsLoading] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadCategory, setUploadCategory] = useState('photo');
  const [uploadSensitivity, setUploadSensitivity] = useState('internal');
  const [uploadDescription, setUploadDescription] = useState('');
  const [uploadSubmitting, setUploadSubmitting] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [docDeletingId, setDocDeletingId] = useState<number | null>(null);

  useEffect(() => {
    const anyModal =
      showArchiveModal ||
      showBatchModal ||
      showConnModal ||
      Boolean(archiveConnTarget) ||
      showUploadModal ||
      showManualIpModal ||
      showPlacementModal;
    if (!anyModal) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showRoomRackManager) return;
        setShowArchiveModal(false);
        setShowBatchModal(false);
        setShowConnModal(false);
        setArchiveConnTarget(null);
        setShowUploadModal(false);
        if (!manualIpSubmitting) setShowManualIpModal(false);
        if (!placementSubmitting) setShowPlacementModal(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [
    showArchiveModal,
    showBatchModal,
    showConnModal,
    archiveConnTarget,
    showUploadModal,
    showManualIpModal,
    manualIpSubmitting,
    showPlacementModal,
    placementSubmitting,
    showRoomRackManager,
  ]);

  const refreshInterfaces = useCallback(async () => {
    setPortsLoading(true);
    try {
      const res = await fetch(`/api/devices/${device.id}/interfaces`);
      const data = await res.json();
      if (res.ok) setInterfaces(data.data || []);
    } finally {
      setPortsLoading(false);
    }
  }, [device.id]);

  const refreshIpAddresses = useCallback(async () => {
    setIpLoading(true);
    try {
      const res = await fetch(`/api/ipam/addresses?deviceId=${device.id}`);
      const data = await res.json();
      if (res.ok) setIpAddresses(data.data || []);
    } finally {
      setIpLoading(false);
    }
  }, [device.id]);

  const refreshConnections = useCallback(async () => {
    setConnectionsLoading(true);
    try {
      const res = await fetch(
        `/api/connections?deviceId=${device.id}&isArchived=${connIsArchived}`
      );
      const data = await res.json();
      if (res.ok) setConnections(data.data || []);
    } finally {
      setConnectionsLoading(false);
    }
  }, [device.id, connIsArchived]);

  const loadLookupDevices = useCallback(async () => {
    setLookupLoading(true);
    try {
      const res = await fetch(`/api/devices/interfaces-lookup?excludeDeviceId=${device.id}`);
      const data = await res.json();
      if (res.ok) setLookupDevices(data.data || []);
    } finally {
      setLookupLoading(false);
    }
  }, [device.id]);

  const refreshDocuments = useCallback(async () => {
    setDocsLoading(true);
    try {
      const res = await fetch(`/api/documents?deviceId=${device.id}`);
      const data = await res.json();
      if (res.ok) setDocuments(data.documents || []);
    } finally {
      setDocsLoading(false);
    }
  }, [device.id]);

  useEffect(() => {
    if (activeTab === 'ports' && interfaces.length === 0) refreshInterfaces();
    if (activeTab === 'network' && ipAddresses.length === 0) refreshIpAddresses();
    if (activeTab === 'connections') refreshConnections();
    if (activeTab === 'documents') refreshDocuments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, connIsArchived]);

  const handleUploadDocument = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadFile) {
      setUploadError('Pilih berkas file yang akan diunggah.');
      return;
    }
    setUploadSubmitting(true);
    setUploadError('');
    try {
      const formData = new FormData();
      formData.append('file', uploadFile);
      formData.append('deviceId', device.id.toString());
      formData.append('category', uploadCategory);
      formData.append('sensitivityLevel', uploadSensitivity);
      if (uploadDescription) formData.append('description', uploadDescription);

      const res = await fetch('/api/documents', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) {
        setUploadError(data.error || 'Gagal mengunggah dokumen.');
        return;
      }
      setShowUploadModal(false);
      setUploadFile(null);
      setUploadDescription('');
      refreshDocuments();
    } catch (err: any) {
      setUploadError(err.message || 'Terjadi kesalahan sistem saat unggah.');
    } finally {
      setUploadSubmitting(false);
    }
  };

  const handleDeleteDocument = async (id: number) => {
    if (!confirm('Yakin ingin menghapus dokumen ini secara permanen dari server?')) return;
    setDocDeletingId(id);
    try {
      const res = await fetch(`/api/documents/${id}`, { method: 'DELETE' });
      if (res.ok) {
        refreshDocuments();
      } else {
        const data = await res.json();
        alert(data.error || 'Gagal menghapus dokumen.');
      }
    } finally {
      setDocDeletingId(null);
    }
  };

  const handleOpenAddConnection = () => {
    setShowConnModal(true);
    loadLookupDevices();
    if (interfaces.length > 0 && !connLocalIfaceId) {
      setConnLocalIfaceId(interfaces[0].id.toString());
    }
  };

  const handleCreateConnection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!connLocalIfaceId || !connRemoteIfaceId) {
      alert('Pilih port sumber dan port tujuan');
      return;
    }
    setConnSubmitting(true);
    try {
      const res = await fetch('/api/connections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          endpointAInterfaceId: parseInt(connLocalIfaceId, 10),
          endpointBInterfaceId: parseInt(connRemoteIfaceId, 10),
          relationType: connRelationType,
          medium: connMedium || null,
          capacityMbps: parseInt(connCapacity, 10) || null,
          label: connLabel.trim() || null,
          description: connDesc.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.message || 'Gagal membuat koneksi');
        return;
      }
      setShowConnModal(false);
      setConnLabel('');
      setConnDesc('');
      await refreshConnections();
    } finally {
      setConnSubmitting(false);
    }
  };

  const handleArchiveConnectionConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!archiveConnTarget || !archiveConnReason.trim()) return;
    setArchiveConnLoading(true);
    try {
      const res = await fetch(`/api/connections/${archiveConnTarget.id}/archive`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: archiveConnReason.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.message);
        return;
      }
      setArchiveConnTarget(null);
      setArchiveConnReason('');
      await refreshConnections();
    } finally {
      setArchiveConnLoading(false);
    }
  };

  const handleRestoreConnection = async (connId: number) => {
    if (!confirm('Pulihkan relasi koneksi ini dari arsip?')) return;
    const res = await fetch(`/api/connections/${connId}/restore`, { method: 'POST' });
    const data = await res.json();
    if (!res.ok) {
      alert(data.message);
      return;
    }
    await refreshConnections();
  };

  const handleDeleteConnection = async (connId: number) => {
    if (!confirm('Hapus relasi koneksi ini secara permanen?')) return;
    const res = await fetch(`/api/connections/${connId}`, { method: 'DELETE' });
    const data = await res.json();
    if (!res.ok) {
      alert(data.message);
      return;
    }
    await refreshConnections();
  };

  const handleDeleteInterface = async (iface: InterfaceItem) => {
    if (
      !confirm(
        `Hapus port "${iface.name}"? IP address yang terhubung akan dilepas dari port ini.`
      )
    )
      return;
    const res = await fetch(`/api/devices/${device.id}/interfaces/${iface.id}`, {
      method: 'DELETE',
    });
    const data = await res.json();
    if (!res.ok) {
      alert(data.message);
      return;
    }
    await refreshInterfaces();
  };

  const handleBatchCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setBatchSubmitting(true);
    try {
      const res = await fetch(`/api/devices/${device.id}/interfaces`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'batch',
          prefix: batchPrefix,
          startNumber: batchStart,
          count: batchCount,
          interfaceType: batchType,
          speedMbps: parseInt(batchSpeed, 10) || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.message);
        return;
      }
      setShowBatchModal(false);
      await refreshInterfaces();
    } finally {
      setBatchSubmitting(false);
    }
  };

  const loadSiteRoomsAndRacks = useCallback(async () => {
    setPlacementLoading(true);
    try {
      const [resRooms, resRacks] = await Promise.all([
        fetch(`/api/master/rooms?siteId=${device.site.id}`),
        fetch(`/api/master/racks?siteId=${device.site.id}`),
      ]);
      if (resRooms.ok) {
        const jRooms = await resRooms.json();
        setSiteRooms(jRooms.data || []);
      }
      if (resRacks.ok) {
        const jRacks = await resRacks.json();
        setSiteRacks(jRacks.data || []);
      }
    } finally {
      setPlacementLoading(false);
    }
  }, [device.site.id]);

  const handleOpenPlacementModal = () => {
    setSelectedRoomId(currentRoom?.id.toString() || '');
    setSelectedRackId(currentRack?.id.toString() || '');
    setPlacementError(null);
    setShowPlacementModal(true);
    loadSiteRoomsAndRacks();
  };

  const handleSavePlacement = async (e: React.FormEvent) => {
    e.preventDefault();
    setPlacementSubmitting(true);
    setPlacementError(null);
    try {
      const res = await fetch(`/api/devices/${device.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomId: selectedRoomId ? parseInt(selectedRoomId, 10) : null,
          rackId: selectedRackId ? parseInt(selectedRackId, 10) : null,
          version: deviceVersion,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.message || 'Gagal memperbarui lokasi Ruang / Rak perangkat.');
      }
      setCurrentRoom(json.data.room || null);
      setCurrentRack(json.data.rack || null);
      if (typeof json.data.version === 'number') {
        setDeviceVersion(json.data.version);
      }
      setShowPlacementModal(false);
      setPlacementSuccessMsg('Penempatan Ruang / Rak perangkat berhasil diperbarui.');
    } catch (err: unknown) {
      setPlacementError(
        err instanceof Error ? err.message : 'Gagal memperbarui Ruang / Rak perangkat.'
      );
    } finally {
      setPlacementSubmitting(false);
    }
  };

  const handleOpenManualIpModal = () => {
    setManualIpAddress('');
    setManualIpPrefix(30);
    setManualIpInterfaceId('');
    setManualIpDescription('');
    setManualIpError(null);
    setShowManualIpModal(true);
  };

  const handleCreateManualP2pIp = async (e: React.FormEvent) => {
    e.preventDefault();
    setManualIpSubmitting(true);
    setManualIpError(null);
    try {
      const res = await fetch('/api/ipam/addresses/p2p-manual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deviceId: device.id,
          address: manualIpAddress.trim(),
          prefix: manualIpPrefix,
          interfaceId: manualIpInterfaceId ? parseInt(manualIpInterfaceId, 10) : null,
          description: manualIpDescription.trim() || null,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.message || 'Gagal menambahkan IP Point-to-Point.');
      }
      setShowManualIpModal(false);
      setIpSuccessMsg(json.message);
      await refreshIpAddresses();
    } catch (err: unknown) {
      setManualIpError(err instanceof Error ? err.message : 'Terjadi kesalahan saat menyimpan IP.');
    } finally {
      setManualIpSubmitting(false);
    }
  };

  const handleReleaseIp = async (ipId: number, address: string) => {
    if (!confirm(`Lepas alokasi IP ${address}? Status akan berubah menjadi RELEASED.`)) return;
    const res = await fetch(`/api/ipam/addresses/${ipId}/release`, { method: 'POST' });
    const data = await res.json();
    if (!res.ok) {
      alert(data.message);
      return;
    }
    await refreshIpAddresses();
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'ACTIVE':
        return 'bg-emerald-100 text-emerald-900 border-emerald-200 dark:bg-emerald-950/70 dark:text-emerald-300 dark:border-emerald-800';
      case 'PLANNED':
        return 'bg-sky-100 text-sky-900 border-sky-200 dark:bg-sky-950/70 dark:text-sky-300 dark:border-sky-800';
      case 'MAINTENANCE':
        return 'bg-amber-100 text-amber-900 border-amber-200 dark:bg-amber-950/70 dark:text-amber-300 dark:border-amber-800';
      case 'RETIRED':
        return 'bg-subtle text-ink-secondary border-line';
      case 'LOST':
        return 'bg-rose-100 text-rose-900 border-rose-200 dark:bg-rose-950/70 dark:text-rose-300 dark:border-rose-800';
      default:
        return 'bg-subtle text-ink-secondary border-line';
    }
  };

  const handleArchive = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!archiveReason.trim()) return;
    setLoadingArchive(true);
    try {
      const res = await fetch(`/api/devices/${device.id}/archive`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: archiveReason.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Gagal mengarsipkan perangkat');
      window.location.reload();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setLoadingArchive(false);
    }
  };

  const handleRestore = async () => {
    if (!confirm('Pulihkan perangkat ini ke inventaris aktif?')) return;
    try {
      const res = await fetch(`/api/devices/${device.id}/restore`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Gagal memulihkan perangkat');
      window.location.reload();
    } catch (err: any) {
      alert(err.message);
    }
  };

  return (
    <div className="space-y-6">
      {device.archivedAt && (
        <div className="rounded-xl border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/50 p-4 text-xs text-amber-900 dark:text-amber-200 shadow-xs flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-start gap-2.5">
            <IconAlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-amber-700 dark:text-amber-300" />
            <div>
              <p className="font-bold">Perangkat Ini Sedang Diarsipkan</p>
              <p className="mt-0.5">
                Waktu arsip: {new Date(device.archivedAt).toLocaleString('id-ID')} | Alasan:{' '}
                <em>&ldquo;{device.archiveReason}&rdquo;</em>
              </p>
            </div>
          </div>
          {canArchive && (
            <button
              type="button"
              onClick={handleRestore}
              className="min-h-[38px] rounded-lg bg-amber-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-amber-500"
            >
              Pulihkan ke Aktif
            </button>
          )}
        </div>
      )}

      {/* Header Info */}
      <div className="animate-enter rounded-xl border border-line bg-surface p-5 shadow-xs flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-2xl font-bold tracking-tight text-ink">{device.hostname}</h1>
            <span
              className={`rounded-md border px-2.5 py-0.5 text-xs font-semibold ${getStatusBadge(
                device.inventoryStatus
              )}`}
            >
              {device.inventoryStatus}
            </span>
          </div>
          <p className="mt-1 font-mono text-xs text-accent-ink font-semibold">
            {device.deviceCode}
          </p>
          <p className="text-xs text-ink-secondary mt-1">
            {device.category.name} | {device.vendor.name}{' '}
            {device.model ? `(${device.model.modelName})` : ''} | Lokasi: {device.site.siteCode} -{' '}
            {device.site.name}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {canEdit && (
            <Link
              href={`/devices/${device.id}/edit`}
              className="inline-flex min-h-[40px] items-center rounded-lg border border-line bg-surface px-3.5 py-1.5 text-xs font-semibold text-ink hover:bg-subtle"
            >
              Ubah Data
            </Link>
          )}
          {canArchive && !device.archivedAt && (
            <button
              type="button"
              onClick={() => setShowArchiveModal(true)}
              className="min-h-[40px] rounded-lg bg-rose-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-rose-500"
            >
              Arsipkan
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-line overflow-x-auto">
        <div role="tablist" aria-label="Detail Perangkat" className="flex space-x-2 text-xs font-medium">
          {[
            { id: 'overview', label: '1. Overview' },
            { id: 'network', label: '2. Network (IP & Subnet)' },
            { id: 'ports', label: `3. Ports (${interfaces.length})` },
            { id: 'connections', label: '4. Connections (Relasi)' },
            { id: 'documents', label: `5. Documents (${documents.length})` },
            { id: 'history', label: `6. History (${history.length})` },
          ].map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={activeTab === t.id}
              onClick={() => setActiveTab(t.id as any)}
              className={`min-h-[42px] border-b-2 px-3.5 py-2.5 transition-colors duration-150 whitespace-nowrap ${
                activeTab === t.id
                  ? 'border-accent text-accent-ink font-semibold'
                  : 'border-transparent text-ink-secondary hover:text-ink'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* TAB 1: OVERVIEW */}
      {activeTab === 'overview' && (
        <div key="tab-overview" className="animate-enter grid grid-cols-1 gap-6 md:grid-cols-2">
          <div className="rounded-xl border border-line bg-surface p-5 shadow-xs space-y-3">
            <h2 className="text-xs font-bold uppercase tracking-wider text-ink-secondary border-b border-line pb-2.5">
              Identitas & Spesifikasi
            </h2>
            <dl className="divide-y divide-line text-xs">
              <div className="py-2 flex justify-between gap-2">
                <dt className="text-ink-muted">Kode Perangkat</dt>
                <dd className="font-mono font-bold text-ink">{device.deviceCode}</dd>
              </div>
              <div className="py-2 flex justify-between gap-2">
                <dt className="text-ink-muted">Hostname</dt>
                <dd className="font-semibold text-ink">{device.hostname}</dd>
              </div>
              <div className="py-2 flex justify-between gap-2">
                <dt className="text-ink-muted">Kategori</dt>
                <dd className="text-ink">{device.category.name}</dd>
              </div>
              <div className="py-2 flex justify-between gap-2">
                <dt className="text-ink-muted">Vendor</dt>
                <dd className="text-ink font-medium">{device.vendor.name}</dd>
              </div>
              <div className="py-2 flex justify-between gap-2">
                <dt className="text-ink-muted">Model</dt>
                <dd className="text-ink">
                  {device.model ? `${device.model.modelName} (${device.model.modelCode})` : '-'}
                </dd>
              </div>
              <div className="py-2 flex justify-between gap-2">
                <dt className="text-ink-muted">Serial Number</dt>
                <dd className="font-mono text-ink">{device.serialNumber || '-'}</dd>
              </div>
              <div className="py-2 flex justify-between gap-2">
                <dt className="text-ink-muted">Network Role</dt>
                <dd className="uppercase font-mono text-ink">{device.networkRole || '-'}</dd>
              </div>
            </dl>
          </div>

          <div className="rounded-xl border border-line bg-surface p-5 shadow-xs space-y-3">
            <div className="flex items-center justify-between gap-2 border-b border-line pb-2.5">
              <h2 className="text-xs font-bold uppercase tracking-wider text-ink-secondary">
                Lokasi & Manajemen
              </h2>
              {canUpdateDevice && (
                <button
                  type="button"
                  onClick={handleOpenPlacementModal}
                  className="inline-flex min-h-[30px] items-center gap-1 rounded-md border border-line bg-canvas px-2.5 py-1 text-[11px] font-semibold text-accent-ink hover:border-accent hover:bg-accent-soft"
                >
                  <IconEdit className="h-3.5 w-3.5" />
                  <span>Ubah Ruang / Rak</span>
                </button>
              )}
            </div>
            {placementSuccessMsg && (
              <div
                role="status"
                className="flex items-center gap-2 rounded-lg border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50 dark:bg-emerald-950/50 px-3 py-2 text-[11px] font-medium text-emerald-900 dark:text-emerald-200"
              >
                <IconCheckCircle className="h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                <span>{placementSuccessMsg}</span>
              </div>
            )}
            <dl className="divide-y divide-line text-xs">
              <div className="py-2 flex justify-between gap-2">
                <dt className="text-ink-muted">Site / Lokasi</dt>
                <dd className="font-semibold text-ink">
                  {device.site.siteCode} - {device.site.name}
                </dd>
              </div>
              <div className="py-2 flex justify-between gap-2">
                <dt className="text-ink-muted">Ruangan</dt>
                <dd className="text-ink">
                  {currentRoom ? `${currentRoom.name} (${currentRoom.floor || 'Lantai ?'})` : '-'}
                </dd>
              </div>
              <div className="py-2 flex justify-between gap-2">
                <dt className="text-ink-muted">Rak</dt>
                <dd className="text-ink">
                  {currentRack ? `${currentRack.name} (${currentRack.unitCapacity}U)` : '-'}
                </dd>
              </div>
              <div className="py-2 flex justify-between gap-2">
                <dt className="text-ink-muted">Tim Penanggung Jawab</dt>
                <dd className="text-ink">{device.ownerTeam || '-'}</dd>
              </div>
              <div className="py-2 flex justify-between gap-2">
                <dt className="text-ink-muted">Tanggal Pasang</dt>
                <dd className="font-mono text-ink">
                  {device.installedAt ? new Date(device.installedAt).toLocaleDateString('id-ID') : '-'}
                </dd>
              </div>
              <div className="py-2 flex justify-between gap-2">
                <dt className="text-ink-muted">Batas Garansi</dt>
                <dd className="font-mono text-ink">
                  {device.warrantyExpiry
                    ? new Date(device.warrantyExpiry).toLocaleDateString('id-ID')
                    : '-'}
                </dd>
              </div>
              <div className="py-2 flex justify-between gap-2">
                <dt className="text-ink-muted">Didaftarkan Oleh</dt>
                <dd className="text-ink">
                  {device.creator ? `${device.creator.name} (${device.creator.username})` : 'System'}
                </dd>
              </div>
            </dl>
          </div>

          <div className="rounded-xl border border-line bg-surface p-5 shadow-xs md:col-span-2 space-y-2.5 text-xs">
            <h2 className="font-bold text-ink">Deskripsi & Catatan Manajemen</h2>
            <p className="text-ink-secondary bg-canvas p-3 rounded-lg border border-line">
              {device.description || 'Tidak ada deskripsi perangkat.'}
            </p>
            {device.managementNotes && (
              <div className="mt-2">
                <span className="font-semibold text-ink">Catatan Manajemen Internal:</span>
                <p className="text-amber-900 dark:text-amber-200 bg-amber-50 dark:bg-amber-950/40 p-3 rounded-lg border border-amber-200 dark:border-amber-900/60 mt-1">
                  {device.managementNotes}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: NETWORK */}
      {activeTab === 'network' && (
        <div key="tab-network" className="animate-enter rounded-xl border border-line bg-surface p-6 shadow-xs space-y-4 text-xs">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-3">
            <div>
              <h2 className="text-sm font-bold text-ink">Alokasi IP Address (IPAM)</h2>
              <p className="text-ink-secondary mt-0.5">
                Input IP manual dibatasi hanya untuk link Point-to-Point (/30 atau /31) antara POP Induk dan End User (Site Pelanggan).
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {canManageIp && isP2pEligible && (
                <button
                  type="button"
                  onClick={handleOpenManualIpModal}
                  className="inline-flex min-h-[38px] items-center gap-1.5 rounded-lg bg-accent px-3.5 py-1.5 text-xs font-semibold text-accent-fg shadow-xs hover:bg-accent-hover"
                >
                  <IconPlus className="h-3.5 w-3.5" />
                  <span>Tambah IP Manual (P2P)</span>
                </button>
              )}
              <button
                type="button"
                onClick={refreshIpAddresses}
                className="inline-flex min-h-[38px] items-center gap-1.5 rounded-lg border border-line bg-canvas px-3 py-1 text-ink-secondary hover:bg-subtle hover:text-ink"
              >
                <IconRefresh className={`h-3.5 w-3.5 ${ipLoading ? 'animate-spin' : ''}`} />
                <span>Muat Ulang</span>
              </button>
            </div>
          </div>

          {canManageIp && !isP2pEligible && (
            <div className="flex items-start gap-2 rounded-lg border border-amber-200 dark:border-amber-900/60 bg-amber-50 dark:bg-amber-950/40 px-3.5 py-2.5 text-xs text-amber-900 dark:text-amber-200">
              <IconAlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>
                Input IP manual Point-to-Point hanya tersedia untuk perangkat di lokasi POP Induk atau Site Pelanggan yang terhubung ke POP.
              </span>
            </div>
          )}

          {ipSuccessMsg && (
            <div
              role="status"
              className="flex items-center gap-2 rounded-lg border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50 dark:bg-emerald-950/50 px-3.5 py-2.5 text-xs font-medium text-emerald-900 dark:text-emerald-200"
            >
              <IconCheckCircle className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
              <span>{ipSuccessMsg}</span>
            </div>
          )}

          {currentManagementIp && (
            <div className="flex items-center gap-2 rounded-lg bg-accent-soft border border-accent/30 px-4 py-2.5">
              <span className="text-accent-ink font-semibold text-xs">Management IP:</span>
              <span className="font-mono font-bold text-accent-ink text-sm">
                {currentManagementIp}
              </span>
            </div>
          )}

          {ipLoading ? (
            <div className="text-center py-8 text-ink-secondary">Memuat alokasi IP...</div>
          ) : ipAddresses.length === 0 ? (
            <div className="rounded-lg border border-dashed border-line-strong p-8 text-center text-ink-secondary">
              <p className="font-medium text-ink">Belum ada IP address yang dialokasikan ke perangkat ini.</p>
              <p className="text-[11px] mt-1">
                {canManageIp && isP2pEligible
                  ? 'Tambahkan IP Point-to-Point (/30 atau /31) antara POP dan Site Pelanggan untuk mengatur Management IP perangkat ini.'
                  : 'Alokasikan IP Point-to-Point melalui halaman detail perangkat oleh Network Engineer atau Admin.'}
              </p>
              {canManageIp && isP2pEligible && (
                <button
                  type="button"
                  onClick={handleOpenManualIpModal}
                  className="mt-4 inline-flex min-h-[38px] items-center gap-1.5 rounded-lg bg-accent px-4 py-1.5 text-xs font-semibold text-accent-fg shadow-xs hover:bg-accent-hover"
                >
                  <IconPlus className="h-3.5 w-3.5" />
                  <span>Tambah IP Manual (P2P)</span>
                </button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-line">
              <table className="min-w-full divide-y divide-line text-left">
                <thead className="bg-subtle text-ink-secondary font-semibold text-[11px] uppercase">
                  <tr>
                    <th className="px-3.5 py-2.5">Alamat IP</th>
                    <th className="px-3.5 py-2.5">Subnet</th>
                    <th className="px-3.5 py-2.5">Interface</th>
                    <th className="px-3.5 py-2.5">Purpose</th>
                    <th className="px-3.5 py-2.5">Status</th>
                    <th className="px-3.5 py-2.5">Hostname / Catatan</th>
                    {canManageIp && <th className="px-3.5 py-2.5 text-right">Tindakan</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {ipAddresses.map((ip) => (
                    <tr key={ip.id} className="hover:bg-subtle/60">
                      <td className="px-3.5 py-2.5 font-mono font-bold text-accent-ink">
                        {ip.address}
                      </td>
                      <td className="px-3.5 py-2.5 font-mono text-ink-secondary text-[11px]">
                        <div className="flex items-center gap-1.5">
                          <span className="text-ink">{ip.subnet.name}</span>
                          {ip.subnet.purpose === 'point_to_point' && (
                            <span className="rounded bg-accent-soft px-1.5 py-0.5 text-[10px] font-semibold text-accent-ink">
                              P2P
                            </span>
                          )}
                        </div>
                        <span className="block text-ink-muted">{ip.subnet.cidr}</span>
                      </td>
                      <td className="px-3.5 py-2.5 text-ink-secondary">
                        {ip.interface?.name || <span className="italic text-ink-muted">-</span>}
                      </td>
                      <td className="px-3.5 py-2.5 uppercase font-mono text-ink-muted text-[11px]">
                        {ip.purpose}
                      </td>
                      <td className="px-3.5 py-2.5">
                        <span
                          className={`inline-flex rounded-md px-2 py-0.5 text-[10px] font-semibold ${
                            STATUS_COLOR[ip.allocationStatus] || 'bg-subtle text-ink-secondary'
                          }`}
                        >
                          {ip.allocationStatus}
                        </span>
                      </td>
                      <td className="px-3.5 py-2.5 text-ink-secondary">
                        <div>{ip.hostname || '-'}</div>
                        {ip.description && (
                          <div className="text-[11px] text-ink-muted">{ip.description}</div>
                        )}
                      </td>
                      {canManageIp && (
                        <td className="px-3.5 py-2.5 text-right">
                          {ip.allocationStatus === 'ALLOCATED' && (
                            <button
                              type="button"
                              onClick={() => handleReleaseIp(ip.id, ip.address)}
                              className="text-rose-700 dark:text-rose-300 hover:underline font-medium"
                            >
                              Lepas
                            </button>
                          )}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: PORTS */}
      {activeTab === 'ports' && (
        <div key="tab-ports" className="animate-enter rounded-xl border border-line bg-surface p-6 shadow-xs space-y-4 text-xs">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-3">
            <div>
              <h2 className="text-sm font-bold text-ink">
                Daftar Interface & Port ({interfaces.length})
              </h2>
              <p className="text-ink-secondary mt-0.5">
                Port fisik dan logis untuk perangkat {device.hostname}.
              </p>
            </div>
            {canEdit && (
              <button
                type="button"
                onClick={() => setShowBatchModal(true)}
                className="inline-flex min-h-[38px] items-center gap-1.5 rounded-lg bg-accent px-3.5 py-1.5 text-xs font-semibold text-accent-fg hover:bg-accent-hover"
              >
                <IconPlus className="h-3.5 w-3.5" />
                <span>Batch Port</span>
              </button>
            )}
          </div>

          {portsLoading ? (
            <div className="text-center py-8 text-ink-secondary">Memuat daftar port...</div>
          ) : interfaces.length === 0 ? (
            <div className="rounded-lg border border-dashed border-line-strong p-8 text-center text-ink-secondary">
              <p className="font-medium text-ink">Belum ada port/interface yang terdaftar.</p>
              {canEdit && (
                <button
                  type="button"
                  onClick={() => setShowBatchModal(true)}
                  className="mt-3 inline-flex min-h-[38px] items-center rounded-lg bg-accent px-4 py-1.5 text-xs font-semibold text-accent-fg hover:bg-accent-hover"
                >
                  Tambah Port Berpola
                </button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-line">
              <table className="min-w-full divide-y divide-line text-left">
                <thead className="bg-subtle text-ink-secondary font-semibold text-[11px] uppercase">
                  <tr>
                    <th className="px-3.5 py-2.5">Nama Port</th>
                    <th className="px-3.5 py-2.5">Tipe</th>
                    <th className="px-3.5 py-2.5">Kecepatan</th>
                    <th className="px-3.5 py-2.5">Admin Status</th>
                    <th className="px-3.5 py-2.5">IP Address</th>
                    <th className="px-3.5 py-2.5">Deskripsi</th>
                    {canEdit && <th className="px-3.5 py-2.5 text-right">Tindakan</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {interfaces.map((iface) => (
                    <tr key={iface.id} className="hover:bg-subtle/60">
                      <td className="px-3.5 py-2.5 font-mono font-bold text-ink">{iface.name}</td>
                      <td className="px-3.5 py-2.5 uppercase text-ink-muted font-mono text-[11px]">
                        {iface.interfaceType}
                      </td>
                      <td className="px-3.5 py-2.5 font-mono text-ink-secondary">
                        {iface.speedMbps
                          ? `${
                              iface.speedMbps >= 1000
                                ? `${iface.speedMbps / 1000}G`
                                : `${iface.speedMbps}M`
                            }`
                          : '-'}
                      </td>
                      <td className="px-3.5 py-2.5">
                        <span
                          className={`inline-flex rounded-md px-2 py-0.5 text-[10px] font-semibold ${
                            STATUS_COLOR[iface.adminStatus] || 'bg-subtle text-ink-secondary'
                          }`}
                        >
                          {iface.adminStatus}
                        </span>
                      </td>
                      <td className="px-3.5 py-2.5 font-mono text-accent-ink">
                        {iface.ipAddresses.length > 0 ? (
                          iface.ipAddresses.map((ip) => (
                            <span key={ip.id} className="block text-[11px]">
                              {ip.address}
                            </span>
                          ))
                        ) : (
                          <span className="italic text-ink-muted">-</span>
                        )}
                      </td>
                      <td className="px-3.5 py-2.5 text-ink-secondary italic">
                        {iface.description || '-'}
                      </td>
                      {canEdit && (
                        <td className="px-3.5 py-2.5 text-right">
                          <button
                            type="button"
                            onClick={() => handleDeleteInterface(iface)}
                            className="text-rose-700 dark:text-rose-300 hover:underline font-medium"
                          >
                            Hapus
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Batch Modal */}
          {showBatchModal && (
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="batch-port-title"
              className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 animate-backdrop"
            >
              <div className="bg-elevated border border-line rounded-xl shadow-2xl w-full max-w-sm p-6 space-y-4 animate-modal">
                <h3 id="batch-port-title" className="font-bold text-ink text-sm">
                  Tambah Port Berpola
                </h3>
                <form onSubmit={handleBatchCreate} className="space-y-3 text-xs">
                  <div>
                    <label htmlFor="batch-prefix" className="block text-ink-secondary font-semibold mb-1">
                      Prefix nama port
                    </label>
                    <input
                      id="batch-prefix"
                      type="text"
                      value={batchPrefix}
                      onChange={(e) => setBatchPrefix(e.target.value)}
                      className="min-h-[38px] w-full rounded-lg border border-line bg-canvas px-2.5 py-1.5 font-mono text-ink focus:border-accent focus:outline-none"
                      placeholder="ether"
                      required
                    />
                    <p className="text-ink-muted mt-1">
                      Contoh: prefix=ether, start=1, count=8 menghasilkan ether1..ether8
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label htmlFor="batch-start" className="block text-ink-secondary font-semibold mb-1">
                        Mulai dari
                      </label>
                      <input
                        id="batch-start"
                        type="number"
                        min={0}
                        value={batchStart}
                        onChange={(e) => setBatchStart(parseInt(e.target.value, 10))}
                        className="min-h-[38px] w-full rounded-lg border border-line bg-canvas px-2.5 py-1.5 text-ink"
                      />
                    </div>
                    <div>
                      <label htmlFor="batch-count" className="block text-ink-secondary font-semibold mb-1">
                        Jumlah port
                      </label>
                      <input
                        id="batch-count"
                        type="number"
                        min={1}
                        max={96}
                        value={batchCount}
                        onChange={(e) => setBatchCount(parseInt(e.target.value, 10))}
                        className="min-h-[38px] w-full rounded-lg border border-line bg-canvas px-2.5 py-1.5 text-ink"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label htmlFor="batch-type" className="block text-ink-secondary font-semibold mb-1">
                        Tipe interface
                      </label>
                      <select
                        id="batch-type"
                        value={batchType}
                        onChange={(e) => setBatchType(e.target.value)}
                        className="min-h-[38px] w-full rounded-lg border border-line bg-canvas px-2 py-1.5 text-ink"
                      >
                        <option value="ethernet">Ethernet</option>
                        <option value="sfp">SFP</option>
                        <option value="sfp_plus">SFP+</option>
                        <option value="pon">PON/GPON</option>
                        <option value="management">Management</option>
                        <option value="loopback">Loopback</option>
                      </select>
                    </div>
                    <div>
                      <label htmlFor="batch-speed" className="block text-ink-secondary font-semibold mb-1">
                        Kecepatan (Mbps)
                      </label>
                      <select
                        id="batch-speed"
                        value={batchSpeed}
                        onChange={(e) => setBatchSpeed(e.target.value)}
                        className="min-h-[38px] w-full rounded-lg border border-line bg-canvas px-2 py-1.5 text-ink"
                      >
                        <option value="">-</option>
                        <option value="10">10 Mbps</option>
                        <option value="100">100 Mbps</option>
                        <option value="1000">1 Gbps</option>
                        <option value="10000">10 Gbps</option>
                        <option value="25000">25 Gbps</option>
                        <option value="40000">40 Gbps</option>
                        <option value="100000">100 Gbps</option>
                      </select>
                    </div>
                  </div>
                  <div className="rounded-lg bg-accent-soft border border-accent/25 px-3 py-2 font-mono text-accent-ink text-[11px]">
                    Preview: {batchPrefix}
                    {batchStart} ... {batchPrefix}
                    {batchStart + batchCount - 1} ({batchCount} port)
                  </div>
                  <div className="flex gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setShowBatchModal(false)}
                      className="min-h-[38px] flex-1 rounded-lg border border-line bg-surface py-1.5 font-medium text-ink-secondary hover:bg-subtle hover:text-ink"
                    >
                      Batal
                    </button>
                    <button
                      type="submit"
                      disabled={batchSubmitting}
                      className="min-h-[38px] flex-1 rounded-lg bg-accent py-1.5 font-semibold text-accent-fg hover:bg-accent-hover disabled:opacity-60"
                    >
                      {batchSubmitting ? 'Menambahkan...' : `Tambah ${batchCount} Port`}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 4: CONNECTIONS */}
      {activeTab === 'connections' && (
        <div key="tab-connections" className="animate-enter rounded-xl border border-line bg-surface p-6 shadow-xs space-y-4 text-xs">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-line pb-3">
            <div>
              <h2 className="text-sm font-bold text-ink">
                Relasi Jaringan Antarperangkat ({connections.length})
              </h2>
              <p className="text-ink-secondary mt-0.5">
                Koneksi fisik dan logis dari port perangkat ini ke perangkat tetangga.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-1.5 text-ink-secondary cursor-pointer">
                <input
                  type="checkbox"
                  checked={connIsArchived}
                  onChange={(e) => setConnIsArchived(e.target.checked)}
                  className="rounded border-line-strong text-accent focus:ring-accent"
                />
                <span>Tampilkan Arsip</span>
              </label>
              {canEdit && (
                <button
                  type="button"
                  onClick={handleOpenAddConnection}
                  className="inline-flex min-h-[38px] items-center gap-1.5 rounded-lg bg-accent px-3.5 py-1.5 font-semibold text-accent-fg hover:bg-accent-hover"
                >
                  <IconPlus className="h-3.5 w-3.5" />
                  <span>Tambah Koneksi</span>
                </button>
              )}
            </div>
          </div>

          {connectionsLoading ? (
            <div className="text-center py-8 text-ink-secondary">Memuat relasi koneksi...</div>
          ) : connections.length === 0 ? (
            <div className="rounded-lg border border-dashed border-line-strong p-8 text-center text-ink-secondary">
              <p className="font-medium text-ink">
                {connIsArchived
                  ? 'Tidak ada relasi koneksi yang diarsipkan untuk perangkat ini.'
                  : 'Belum ada relasi koneksi aktif untuk perangkat ini.'}
              </p>
              {canEdit && !connIsArchived && (
                <button
                  type="button"
                  onClick={handleOpenAddConnection}
                  className="mt-3 inline-flex min-h-[38px] items-center rounded-lg bg-accent px-4 py-1.5 font-semibold text-accent-fg hover:bg-accent-hover"
                >
                  Hubungkan Port ke Perangkat Lain
                </button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-line">
              <table className="min-w-full divide-y divide-line text-left">
                <thead className="bg-subtle text-ink-secondary font-semibold text-[11px] uppercase">
                  <tr>
                    <th className="px-3.5 py-2.5">Port Lokal</th>
                    <th className="px-3.5 py-2.5">Tipe & Media</th>
                    <th className="px-3.5 py-2.5">Perangkat & Port Lawan</th>
                    <th className="px-3.5 py-2.5">Kapasitas</th>
                    <th className="px-3.5 py-2.5">Label / Catatan</th>
                    <th className="px-3.5 py-2.5">Status</th>
                    {connIsArchived && <th className="px-3.5 py-2.5">Alasan Arsip</th>}
                    {canEdit && <th className="px-3.5 py-2.5 text-right">Tindakan</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {connections.map((c) => {
                    const isLocalA = c.endpointAInterface.deviceId === device.id;
                    const localPort = isLocalA ? c.endpointAInterface : c.endpointBInterface;
                    const remotePort = isLocalA ? c.endpointBInterface : c.endpointAInterface;

                    return (
                      <tr key={c.id} className="hover:bg-subtle/60">
                        <td className="px-3.5 py-2.5 font-mono font-bold text-ink">
                          {localPort.name}
                        </td>
                        <td className="px-3.5 py-2.5">
                          <span className="font-semibold uppercase text-ink block">
                            {c.relationType}
                          </span>
                          <span className="text-[11px] text-ink-muted capitalize">
                            {c.medium || 'unknown'}
                          </span>
                        </td>
                        <td className="px-3.5 py-2.5">
                          <Link
                            href={`/devices/${remotePort.device.id}`}
                            className="font-semibold text-accent-ink hover:underline block"
                          >
                            {remotePort.device.hostname}
                          </Link>
                          <span className="font-mono text-ink-secondary text-[11px]">
                            Port: <strong className="text-ink">{remotePort.name}</strong> (
                            {remotePort.device.deviceCode})
                          </span>
                        </td>
                        <td className="px-3.5 py-2.5 font-mono text-ink-secondary">
                          {c.capacityMbps
                            ? c.capacityMbps >= 1000
                              ? `${c.capacityMbps / 1000} Gbps`
                              : `${c.capacityMbps} Mbps`
                            : '-'}
                        </td>
                        <td className="px-3.5 py-2.5 text-ink-secondary">
                          {c.label && <span className="font-medium text-ink block">{c.label}</span>}
                          {c.description && (
                            <span className="text-ink-muted text-[11px] block">{c.description}</span>
                          )}
                          {!c.label && !c.description && (
                            <span className="text-ink-muted italic">-</span>
                          )}
                        </td>
                        <td className="px-3.5 py-2.5">
                          <span
                            className={`inline-flex rounded-md px-2 py-0.5 text-[10px] font-semibold ${
                              c.archivedAt
                                ? 'bg-subtle text-ink-secondary'
                                : c.status === 'documented'
                                ? 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950/70 dark:text-emerald-300'
                                : 'bg-amber-100 text-amber-900 dark:bg-amber-950/70 dark:text-amber-300'
                            }`}
                          >
                            {c.archivedAt ? 'ARCHIVED' : c.status}
                          </span>
                        </td>
                        {connIsArchived && (
                          <td className="px-3.5 py-2.5 text-ink-secondary italic text-[11px]">
                            {c.archiveReason || '-'}
                          </td>
                        )}
                        {canEdit && (
                          <td className="px-3.5 py-2.5 text-right space-x-2 whitespace-nowrap">
                            {!c.archivedAt ? (
                              <button
                                type="button"
                                onClick={() => {
                                  setArchiveConnTarget(c);
                                  setArchiveConnReason('');
                                }}
                                className="text-amber-700 dark:text-amber-300 hover:underline font-medium"
                              >
                                Arsipkan
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleRestoreConnection(c.id)}
                                className="text-emerald-700 dark:text-emerald-300 hover:underline font-medium"
                              >
                                Pulihkan
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => handleDeleteConnection(c.id)}
                              className="text-rose-700 dark:text-rose-300 hover:underline font-medium"
                            >
                              Hapus
                            </button>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Modal Tambah Koneksi */}
          {showConnModal && (
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="add-conn-title"
              className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 animate-backdrop"
            >
              <div className="bg-elevated border border-line rounded-xl shadow-2xl w-full max-w-lg p-6 space-y-4 animate-modal">
                <div className="flex items-center justify-between border-b border-line pb-2.5">
                  <h3 id="add-conn-title" className="font-bold text-ink text-sm">
                    Hubungkan Port Antarperangkat
                  </h3>
                  <button
                    type="button"
                    aria-label="Tutup dialog"
                    onClick={() => setShowConnModal(false)}
                    className="flex h-8 w-8 items-center justify-center rounded-md text-ink-muted hover:bg-subtle hover:text-ink"
                  >
                    <IconClose className="h-4 w-4" />
                  </button>
                </div>

                <form onSubmit={handleCreateConnection} className="space-y-3 text-xs">
                  <div>
                    <label htmlFor="conn-local" className="block text-ink-secondary font-semibold mb-1">
                      1. Port Sumber (Perangkat: {device.hostname})
                    </label>
                    <select
                      id="conn-local"
                      value={connLocalIfaceId}
                      onChange={(e) => setConnLocalIfaceId(e.target.value)}
                      className="min-h-[38px] w-full rounded-lg border border-line bg-canvas px-2.5 py-1.5 text-ink"
                      required
                    >
                      <option value="">Pilih Port Lokal</option>
                      {interfaces.map((i) => (
                        <option key={i.id} value={i.id}>
                          {i.name} ({i.interfaceType} - {i.speedMbps ? `${i.speedMbps}M` : 'speed ?'})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label htmlFor="conn-remote-dev" className="block text-ink-secondary font-semibold mb-1">
                      2. Perangkat Tujuan (Tetangga)
                    </label>
                    {lookupLoading ? (
                      <p className="text-ink-muted">Memuat daftar perangkat...</p>
                    ) : (
                      <select
                        id="conn-remote-dev"
                        value={connRemoteDeviceId}
                        onChange={(e) => {
                          setConnRemoteDeviceId(e.target.value);
                          setConnRemoteIfaceId('');
                        }}
                        className="min-h-[38px] w-full rounded-lg border border-line bg-canvas px-2.5 py-1.5 text-ink"
                        required
                      >
                        <option value="">Pilih Perangkat Lawan</option>
                        {lookupDevices.map((d) => (
                          <option key={d.id} value={d.id}>
                            {d.hostname} ({d.deviceCode}), {d.interfaces?.length || 0} port
                          </option>
                        ))}
                      </select>
                    )}
                  </div>

                  {connRemoteDeviceId && (
                    <div>
                      <label htmlFor="conn-remote-port" className="block text-ink-secondary font-semibold mb-1">
                        3. Port Tujuan Lawan
                      </label>
                      <select
                        id="conn-remote-port"
                        value={connRemoteIfaceId}
                        onChange={(e) => setConnRemoteIfaceId(e.target.value)}
                        className="min-h-[38px] w-full rounded-lg border border-line bg-canvas px-2.5 py-1.5 text-ink"
                        required
                      >
                        <option value="">Pilih Port Lawan</option>
                        {lookupDevices
                          .find((d) => d.id === parseInt(connRemoteDeviceId, 10))
                          ?.interfaces?.map((i: any) => (
                            <option key={i.id} value={i.id}>
                              {i.name} ({i.interfaceType} - {i.speedMbps ? `${i.speedMbps}M` : 'speed ?'})
                            </option>
                          ))}
                      </select>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-line">
                    <div>
                      <label htmlFor="conn-rel-type" className="block text-ink-secondary font-semibold mb-1">
                        Tipe Relasi
                      </label>
                      <select
                        id="conn-rel-type"
                        value={connRelationType}
                        onChange={(e) => setConnRelationType(e.target.value)}
                        className="min-h-[38px] w-full rounded-lg border border-line bg-canvas px-2.5 py-1.5 text-ink"
                      >
                        <option value="physical">Physical (Fisik)</option>
                        <option value="logical">Logical (Logis / Trunk / VLAN)</option>
                        <option value="parent_child">Parent - Child</option>
                        <option value="service">Service</option>
                      </select>
                    </div>
                    <div>
                      <label htmlFor="conn-medium" className="block text-ink-secondary font-semibold mb-1">
                        Media Transmisi
                      </label>
                      <select
                        id="conn-medium"
                        value={connMedium}
                        onChange={(e) => setConnMedium(e.target.value)}
                        className="min-h-[38px] w-full rounded-lg border border-line bg-canvas px-2.5 py-1.5 text-ink"
                      >
                        <option value="fiber">Fiber Optic</option>
                        <option value="copper">Copper (UTP / STP)</option>
                        <option value="wireless">Wireless Radio</option>
                        <option value="logical">Logical Link</option>
                        <option value="unknown">Unknown</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label htmlFor="conn-cap" className="block text-ink-secondary font-semibold mb-1">
                        Kapasitas (Mbps)
                      </label>
                      <select
                        id="conn-cap"
                        value={connCapacity}
                        onChange={(e) => setConnCapacity(e.target.value)}
                        className="min-h-[38px] w-full rounded-lg border border-line bg-canvas px-2.5 py-1.5 text-ink"
                      >
                        <option value="">Tidak Ditentukan</option>
                        <option value="100">100 Mbps</option>
                        <option value="1000">1 Gbps</option>
                        <option value="10000">10 Gbps</option>
                        <option value="40000">40 Gbps</option>
                        <option value="100000">100 Gbps</option>
                      </select>
                    </div>
                    <div>
                      <label htmlFor="conn-label" className="block text-ink-secondary font-semibold mb-1">
                        Label Koneksi (Opsional)
                      </label>
                      <input
                        id="conn-label"
                        type="text"
                        value={connLabel}
                        onChange={(e) => setConnLabel(e.target.value)}
                        placeholder="Uplink Core-to-Dist"
                        className="min-h-[38px] w-full rounded-lg border border-line bg-canvas px-2.5 py-1.5 text-ink"
                      />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="conn-desc" className="block text-ink-secondary font-semibold mb-1">
                      Keterangan Tambahan
                    </label>
                    <input
                      id="conn-desc"
                      type="text"
                      value={connDesc}
                      onChange={(e) => setConnDesc(e.target.value)}
                      placeholder="Patch cord kuning rack 2 ke rack 3"
                      className="min-h-[38px] w-full rounded-lg border border-line bg-canvas px-2.5 py-1.5 text-ink"
                    />
                  </div>

                  <div className="flex gap-2 pt-3">
                    <button
                      type="button"
                      onClick={() => setShowConnModal(false)}
                      className="min-h-[38px] flex-1 rounded-lg border border-line bg-surface py-1.5 font-medium text-ink-secondary hover:bg-subtle hover:text-ink"
                    >
                      Batal
                    </button>
                    <button
                      type="submit"
                      disabled={connSubmitting || !connLocalIfaceId || !connRemoteIfaceId}
                      className="min-h-[38px] flex-1 rounded-lg bg-accent py-1.5 font-semibold text-accent-fg hover:bg-accent-hover disabled:opacity-60"
                    >
                      {connSubmitting ? 'Menghubungkan...' : 'Simpan Koneksi'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Modal Arsip Koneksi */}
          {archiveConnTarget && (
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="arch-conn-title"
              className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 animate-backdrop"
            >
              <div className="bg-elevated border border-line rounded-xl shadow-2xl w-full max-w-sm p-6 space-y-4 animate-modal">
                <h3 id="arch-conn-title" className="font-bold text-ink text-sm">
                  Arsipkan Relasi Koneksi
                </h3>
                <p className="text-xs text-ink-secondary">
                  Relasi koneksi antara port{' '}
                  <strong className="text-ink">{archiveConnTarget.endpointAInterface.name}</strong>{' '}
                  dan{' '}
                  <strong className="text-ink">{archiveConnTarget.endpointBInterface.name}</strong>{' '}
                  akan diarsipkan dan tidak tampil di diagram topologi default.
                </p>
                <form onSubmit={handleArchiveConnectionConfirm} className="space-y-3 text-xs">
                  <div>
                    <label htmlFor="arch-conn-reason" className="block text-ink-secondary font-semibold mb-1">
                      Alasan Pengarsipan *
                    </label>
                    <textarea
                      id="arch-conn-reason"
                      value={archiveConnReason}
                      onChange={(e) => setArchiveConnReason(e.target.value)}
                      placeholder="Contoh: Kabel dilepas untuk migrasi rak"
                      rows={3}
                      className="w-full rounded-lg border border-line bg-canvas p-2.5 text-ink"
                      required
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setArchiveConnTarget(null)}
                      className="min-h-[38px] flex-1 rounded-lg border border-line bg-surface py-1.5 font-medium text-ink-secondary hover:bg-subtle hover:text-ink"
                    >
                      Batal
                    </button>
                    <button
                      type="submit"
                      disabled={archiveConnLoading || !archiveConnReason.trim()}
                      className="min-h-[38px] flex-1 rounded-lg bg-amber-600 py-1.5 font-semibold text-white hover:bg-amber-500 disabled:opacity-60"
                    >
                      {archiveConnLoading ? 'Menyimpan...' : 'Arsipkan Koneksi'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 5: DOCUMENTS */}
      {activeTab === 'documents' && (
        <div key="tab-documents" className="animate-enter rounded-xl border border-line bg-surface p-6 shadow-xs space-y-4 text-xs">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-line pb-3">
            <div>
              <h2 className="text-sm font-bold text-ink">Dokumen & Lampiran Perangkat</h2>
              <p className="text-ink-secondary mt-0.5">
                Penyimpanan privat untuk foto fisik, diagram topologi, backup konfigurasi, dan dokumen garansi.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={refreshDocuments}
                disabled={docsLoading}
                className="inline-flex min-h-[38px] items-center gap-1.5 rounded-lg border border-line bg-surface px-3 py-1.5 text-xs font-medium text-ink-secondary hover:bg-subtle hover:text-ink disabled:opacity-50"
              >
                <IconRefresh className={`h-3.5 w-3.5 ${docsLoading ? 'animate-spin' : ''}`} />
                <span>{docsLoading ? 'Memuat...' : 'Muat Ulang'}</span>
              </button>
              {canUploadDoc && (
                <button
                  type="button"
                  onClick={() => {
                    setUploadError('');
                    setUploadFile(null);
                    setShowUploadModal(true);
                  }}
                  className="inline-flex min-h-[38px] items-center gap-1.5 rounded-lg bg-accent px-3.5 py-1.5 text-xs font-semibold text-accent-fg hover:bg-accent-hover"
                >
                  <IconPlus className="h-3.5 w-3.5" />
                  <span>Unggah Dokumen</span>
                </button>
              )}
            </div>
          </div>

          {documents.length === 0 ? (
            <div className="rounded-lg border border-dashed border-line-strong p-8 text-center text-ink-secondary space-y-2">
              <p className="font-semibold text-ink">
                Belum ada dokumen yang diunggah untuk perangkat ini.
              </p>
              <p className="text-[11px] text-ink-muted">
                Dokumen disimpan pada direktori privat dengan verifikasi checksum SHA-256 dan kontrol RBAC.
              </p>
              {canUploadDoc && (
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setUploadError('');
                      setUploadFile(null);
                      setShowUploadModal(true);
                    }}
                    className="inline-flex min-h-[38px] items-center rounded-lg bg-accent-soft border border-accent/30 px-3.5 py-1.5 text-xs font-semibold text-accent-ink hover:opacity-90"
                  >
                    Unggah Dokumen Pertama
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-line">
              <table className="w-full text-left divide-y divide-line">
                <thead className="bg-subtle text-[11px] font-semibold text-ink-secondary uppercase tracking-wider">
                  <tr>
                    <th className="py-2.5 px-3.5">Nama Berkas</th>
                    <th className="py-2.5 px-3.5">Kategori</th>
                    <th className="py-2.5 px-3.5">Ukuran</th>
                    <th className="py-2.5 px-3.5">Checksum (SHA-256)</th>
                    <th className="py-2.5 px-3.5">Pengunggah & Waktu</th>
                    <th className="py-2.5 px-3.5 text-right">Tindakan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line font-mono text-[11px]">
                  {documents.map((doc) => (
                    <tr key={doc.id} className="hover:bg-subtle/60">
                      <td className="py-2.5 px-3.5 font-medium text-ink font-sans">
                        <div className="flex items-center gap-2">
                          <IconFileDoc className="h-4 w-4 shrink-0 text-ink-muted" />
                          <span className="truncate max-w-xs" title={doc.originalFilename}>
                            {doc.originalFilename}
                          </span>
                        </div>
                        {doc.description && (
                          <p className="text-[10px] text-ink-muted font-sans mt-0.5 ml-6">
                            {doc.description}
                          </p>
                        )}
                      </td>
                      <td className="py-2.5 px-3.5 font-sans">
                        <span className="inline-block rounded-md bg-subtle px-2 py-0.5 text-[10px] font-medium text-ink border border-line">
                          {DOC_CATEGORY_MAP[doc.category] || doc.category}
                        </span>
                      </td>
                      <td className="py-2.5 px-3.5 text-ink-secondary">
                        {formatBytes(doc.fileSize)}
                      </td>
                      <td className="py-2.5 px-3.5 text-ink-muted">
                        <span
                          className="font-mono text-[10px] bg-subtle px-1.5 py-0.5 rounded border border-line"
                          title={doc.checksum}
                        >
                          {doc.checksum.substring(0, 10)}...
                          {doc.checksum.substring(doc.checksum.length - 6)}
                        </span>
                      </td>
                      <td className="py-2.5 px-3.5 font-sans text-ink-secondary">
                        <div>{doc.uploader ? doc.uploader.name : 'System'}</div>
                        <div className="text-[10px] text-ink-muted font-mono">
                          {new Date(doc.uploadedAt).toLocaleString('id-ID')}
                        </div>
                      </td>
                      <td className="py-2.5 px-3.5 text-right font-sans space-x-1.5 whitespace-nowrap">
                        <a
                          href={`/api/documents/${doc.id}/download`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 rounded-md bg-accent-soft border border-accent/30 px-2.5 py-1 text-[11px] font-semibold text-accent-ink hover:opacity-90"
                        >
                          <IconDownload className="h-3.5 w-3.5" />
                          <span>Unduh</span>
                        </a>
                        {(canUploadDoc || canEdit) && (
                          <button
                            type="button"
                            onClick={() => handleDeleteDocument(doc.id)}
                            disabled={docDeletingId === doc.id}
                            className="inline-block rounded-md bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900/60 px-2.5 py-1 text-[11px] font-medium text-rose-800 dark:text-rose-200 hover:bg-rose-100 disabled:opacity-50"
                          >
                            {docDeletingId === doc.id ? '...' : 'Hapus'}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 6: HISTORY */}
      {activeTab === 'history' && (
        <div key="tab-history" className="animate-enter rounded-xl border border-line bg-surface p-5 shadow-xs space-y-4 text-xs">
          <h2 className="text-sm font-bold text-ink border-b border-line pb-2.5">
            Riwayat Perubahan & Audit Trail Perangkat
          </h2>

          {history.length === 0 ? (
            <p className="text-ink-muted text-center py-6">
              Belum ada catatan histori perubahan.
            </p>
          ) : (
            <div className="space-y-3">
              {history.map((log) => (
                <div
                  key={log.id}
                  className="rounded-lg border border-line p-3.5 bg-canvas space-y-1.5"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-accent-ink uppercase tracking-wide">
                      Aksi: {log.action}
                    </span>
                    <span className="text-[11px] font-mono text-ink-muted">
                      {new Date(log.createdAt).toLocaleString('id-ID')}
                    </span>
                  </div>
                  <p className="text-ink-secondary">
                    Oleh:{' '}
                    <strong className="text-ink">
                      {log.user ? `${log.user.name} (@${log.user.username})` : 'System'}
                    </strong>
                  </p>
                  {log.action === 'ARCHIVE' && (
                    <p className="text-amber-900 dark:text-amber-200 bg-amber-50 dark:bg-amber-950/50 p-2 rounded border border-amber-200 dark:border-amber-900/60">
                      Alasan Arsip: <em>{log.afterData?.archiveReason || '-'}</em>
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Archive Modal */}
      {showArchiveModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="detail-archive-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 animate-backdrop"
        >
          <div className="w-full max-w-md rounded-xl border border-line bg-elevated p-5 shadow-2xl space-y-4 animate-modal">
            <h3 id="detail-archive-title" className="text-sm font-bold text-ink">
              Konfirmasi Pengarsipan: {device.hostname}
            </h3>
            <p className="text-xs text-ink-secondary">
              Pengarsipan wajib menyertakan alasan. Perangkat tidak tampil pada daftar aktif default.
            </p>
            {device.inventoryStatus === 'ACTIVE' && (
              <div className="flex items-start gap-2 rounded-lg border border-amber-200 dark:border-amber-900/60 bg-amber-50 dark:bg-amber-950/50 p-3 text-xs text-amber-900 dark:text-amber-200">
                <IconAlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>
                  Status saat ini adalah <strong>ACTIVE</strong>. Pastikan perangkat sudah tidak beroperasi di lapangan.
                </span>
              </div>
            )}
            <form onSubmit={handleArchive} className="space-y-3">
              <div>
                <label htmlFor="detail-arch-reason" className="block text-xs font-semibold text-ink-secondary">
                  Alasan Pengarsipan <span className="text-rose-600">*</span>
                </label>
                <textarea
                  id="detail-arch-reason"
                  required
                  rows={3}
                  placeholder="Contoh: Perangkat diganti dengan unit baru."
                  value={archiveReason}
                  onChange={(e) => setArchiveReason(e.target.value)}
                  className="mt-1.5 block w-full rounded-lg border border-line bg-canvas p-2.5 text-xs text-ink placeholder-ink-muted focus:border-accent focus:outline-none"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowArchiveModal(false)}
                  className="min-h-[38px] rounded-lg border border-line bg-surface px-3.5 py-1.5 text-xs font-medium text-ink-secondary hover:bg-subtle hover:text-ink"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={loadingArchive}
                  className="min-h-[38px] rounded-lg bg-rose-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-rose-500 disabled:opacity-50"
                >
                  {loadingArchive ? 'Mengarsipkan...' : 'Konfirmasi Arsipkan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Upload Document Modal */}
      {showUploadModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="upload-doc-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 animate-backdrop"
        >
          <div className="w-full max-w-lg rounded-xl border border-line bg-elevated p-5 shadow-2xl space-y-4 text-xs animate-modal">
            <div className="flex items-center justify-between border-b border-line pb-3">
              <h3 id="upload-doc-title" className="text-sm font-bold text-ink">
                Unggah Dokumen Perangkat: {device.hostname}
              </h3>
              <button
                type="button"
                aria-label="Tutup dialog"
                onClick={() => setShowUploadModal(false)}
                className="flex h-8 w-8 items-center justify-center rounded-md text-ink-muted hover:bg-subtle hover:text-ink"
              >
                <IconClose className="h-4 w-4" />
              </button>
            </div>

            {uploadError && (
              <div className="rounded-lg border border-rose-200 dark:border-rose-900/60 bg-rose-50 dark:bg-rose-950/60 p-3 text-rose-800 dark:text-rose-200">
                {uploadError}
              </div>
            )}

            <form onSubmit={handleUploadDocument} className="space-y-3.5">
              <div>
                <label htmlFor="upload-doc-file" className="block font-semibold text-ink-secondary mb-1">
                  Pilih Berkas File <span className="text-rose-600">*</span>
                </label>
                <input
                  id="upload-doc-file"
                  type="file"
                  required
                  onChange={(e) => {
                    const f = e.target.files?.[0] || null;
                    setUploadFile(f);
                  }}
                  className="block w-full text-xs text-ink-secondary file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-accent-soft file:text-accent-ink hover:file:opacity-90 cursor-pointer"
                />
                <p className="mt-1 text-[10px] text-ink-muted">
                  Didukung: PDF, PNG, JPG, WEBP, TXT, LOG, CFG, CSV, XLSX, DOCX, ZIP (Maks. 15 MB). Executable, SVG, dan HTML ditolak.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="upload-doc-cat" className="block font-semibold text-ink-secondary mb-1">
                    Kategori Dokumen <span className="text-rose-600">*</span>
                  </label>
                  <select
                    id="upload-doc-cat"
                    value={uploadCategory}
                    onChange={(e) => setUploadCategory(e.target.value)}
                    className="min-h-[38px] block w-full rounded-lg border border-line bg-canvas p-2 text-xs text-ink"
                  >
                    <option value="photo">Foto Fisik Perangkat</option>
                    <option value="topology_diagram">Diagram Topologi</option>
                    <option value="config_backup">Backup Konfigurasi</option>
                    <option value="warranty">Garansi & Servis</option>
                    <option value="manual">Buku Manual</option>
                    <option value="contract">Kontrak Vendor / SLA</option>
                    <option value="other">Lainnya</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="upload-doc-sens" className="block font-semibold text-ink-secondary mb-1">
                    Tingkat Sensitivitas
                  </label>
                  <select
                    id="upload-doc-sens"
                    value={uploadSensitivity}
                    onChange={(e) => setUploadSensitivity(e.target.value)}
                    className="min-h-[38px] block w-full rounded-lg border border-line bg-canvas p-2 text-xs text-ink"
                  >
                    <option value="internal">Internal (Default)</option>
                    <option value="confidential">Confidential (Rahasia)</option>
                    <option value="restricted">Restricted (Sangat Terbatas)</option>
                    <option value="public">Public</option>
                  </select>
                </div>
              </div>

              <div>
                <label htmlFor="upload-doc-desc" className="block font-semibold text-ink-secondary mb-1">
                  Keterangan Dokumen (Opsional)
                </label>
                <textarea
                  id="upload-doc-desc"
                  rows={2}
                  placeholder="Contoh: Backup konfigurasi sebelum pembaruan firmware"
                  value={uploadDescription}
                  onChange={(e) => setUploadDescription(e.target.value)}
                  className="block w-full rounded-lg border border-line bg-canvas p-2.5 text-xs text-ink placeholder-ink-muted"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-line">
                <button
                  type="button"
                  onClick={() => setShowUploadModal(false)}
                  className="min-h-[38px] rounded-lg border border-line bg-surface px-3.5 py-1.5 text-xs font-medium text-ink-secondary hover:bg-subtle hover:text-ink"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={uploadSubmitting || !uploadFile}
                  className="min-h-[38px] rounded-lg bg-accent px-4 py-1.5 text-xs font-semibold text-accent-fg hover:bg-accent-hover disabled:opacity-50"
                >
                  {uploadSubmitting ? 'Mengunggah...' : 'Unggah Sekarang'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL TAMBAH MANAGEMENT IP MANUAL P2P */}
      {showManualIpModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 animate-backdrop"
          onClick={() => {
            if (!manualIpSubmitting) setShowManualIpModal(false);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="manual-p2p-ip-title"
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg rounded-xl border border-line bg-elevated p-5 shadow-2xl animate-modal space-y-4 text-xs"
          >
            <div className="flex items-start justify-between gap-3 border-b border-line pb-3">
              <div>
                <h3 id="manual-p2p-ip-title" className="text-base font-bold text-ink">
                  Tambah Management IP Manual (Point-to-Point)
                </h3>
                <p className="mt-0.5 text-xs text-ink-secondary">
                  Khusus pengalamatan IP Point-to-Point (/30 atau /31) antara POP Induk dan End User.
                </p>
              </div>
              <button
                type="button"
                disabled={manualIpSubmitting}
                onClick={() => setShowManualIpModal(false)}
                aria-label="Tutup dialog"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-ink-muted hover:bg-subtle hover:text-ink disabled:opacity-50"
              >
                <IconClose className="h-4 w-4" />
              </button>
            </div>

            <div className="flex items-center gap-2.5 rounded-lg border border-line bg-accent-soft px-3.5 py-2.5 text-xs text-accent-ink">
              <IconLinkCable className="h-4 w-4 shrink-0" />
              <span>
                Jalur Link:{' '}
                {device.site.siteType === 'customer_site' && device.site.parentSite ? (
                  <>
                    <strong className="font-mono">{device.site.parentSite.siteCode}</strong>
                    {' -> '}
                    <strong className="font-mono">{device.site.siteCode}</strong> ({device.site.name})
                  </>
                ) : (
                  <>
                    POP Induk <strong className="font-mono">{device.site.siteCode}</strong> ({device.site.name}) ke End User
                  </>
                )}
              </span>
            </div>

            {manualIpError && (
              <div
                role="alert"
                className="flex items-start gap-2 rounded-lg border border-rose-200 dark:border-rose-900/60 bg-rose-50 dark:bg-rose-950/50 p-3 text-xs text-rose-800 dark:text-rose-200"
              >
                <IconAlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{manualIpError}</span>
              </div>
            )}

            <form onSubmit={handleCreateManualP2pIp} className="space-y-3.5">
              <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-3">
                <div className="sm:col-span-2">
                  <label htmlFor="p2p-ip-address" className="block font-semibold text-ink-secondary">
                    Alamat IPv4 Host *
                  </label>
                  <input
                    id="p2p-ip-address"
                    type="text"
                    required
                    placeholder="Contoh: 10.10.20.2"
                    value={manualIpAddress}
                    onChange={(e) => setManualIpAddress(e.target.value)}
                    className="mt-1 min-h-[40px] block w-full rounded-lg border border-line bg-canvas px-3 py-1.5 text-xs font-mono text-ink placeholder-ink-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
                  />
                </div>

                <div>
                  <label htmlFor="p2p-ip-prefix" className="block font-semibold text-ink-secondary">
                    Prefix P2P *
                  </label>
                  <select
                    id="p2p-ip-prefix"
                    value={manualIpPrefix}
                    onChange={(e) => setManualIpPrefix(Number(e.target.value) as 30 | 31)}
                    className="mt-1 min-h-[40px] block w-full rounded-lg border border-line bg-canvas px-3 py-1.5 text-xs font-mono text-ink focus:border-accent focus:outline-none"
                  >
                    <option value={30}>/30 (P2P Standar)</option>
                    <option value={31}>/31 (P2P RFC 3021)</option>
                  </select>
                </div>
              </div>

              {manualIpPreview && (
                manualIpPreview.valid && manualIpPreview.cidrInfo ? (
                  <div className="rounded-lg border border-line bg-subtle p-3 space-y-1.5">
                    <p className="font-semibold text-ink">Pratinjau Subnet Point-to-Point</p>
                    <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-3 font-mono text-[11px]">
                      <div>
                        <span className="block text-ink-muted">Subnet CIDR</span>
                        <span className="font-semibold text-ink">{manualIpPreview.cidrInfo.cidr}</span>
                      </div>
                      <div>
                        <span className="block text-ink-muted">IP Perangkat Ini</span>
                        <span className="font-semibold text-accent-ink">{manualIpPreview.hostIp}</span>
                      </div>
                      <div>
                        <span className="block text-ink-muted">IP Peer Lawan</span>
                        <span className="font-semibold text-ink">{manualIpPreview.peerIp}</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-lg border border-rose-200 dark:border-rose-900/60 bg-rose-50 dark:bg-rose-950/50 p-2.5 text-[11px] text-rose-800 dark:text-rose-200">
                    {manualIpPreview.error}
                  </div>
                )
              )}

              <div>
                <label htmlFor="p2p-ip-iface" className="block font-semibold text-ink-secondary">
                  Port / Interface Perangkat (Opsional)
                </label>
                <select
                  id="p2p-ip-iface"
                  value={manualIpInterfaceId}
                  onChange={(e) => setManualIpInterfaceId(e.target.value)}
                  className="mt-1 min-h-[40px] block w-full rounded-lg border border-line bg-canvas px-3 py-1.5 text-xs text-ink focus:border-accent focus:outline-none"
                >
                  <option value="">Tanpa ikatan port spesifik</option>
                  {interfaces.map((iface) => (
                    <option key={iface.id} value={iface.id}>
                      {iface.name} {iface.label ? `(${iface.label})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="p2p-ip-desc" className="block font-semibold text-ink-secondary">
                  Catatan Link (Opsional)
                </label>
                <input
                  id="p2p-ip-desc"
                  type="text"
                  maxLength={500}
                  placeholder="Contoh: Uplink P2P ke POP Bandung Dago"
                  value={manualIpDescription}
                  onChange={(e) => setManualIpDescription(e.target.value)}
                  className="mt-1 min-h-[40px] block w-full rounded-lg border border-line bg-canvas px-3 py-1.5 text-xs text-ink placeholder-ink-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
                />
              </div>

              <div className="flex justify-end gap-2 border-t border-line pt-3">
                <button
                  type="button"
                  disabled={manualIpSubmitting}
                  onClick={() => setShowManualIpModal(false)}
                  className="min-h-[40px] rounded-lg border border-line bg-surface px-4 py-1.5 text-xs font-medium text-ink-secondary hover:bg-subtle hover:text-ink disabled:opacity-50"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={manualIpSubmitting || !manualIpPreview?.valid}
                  className="min-h-[40px] rounded-lg bg-accent px-4 py-1.5 text-xs font-semibold text-accent-fg hover:bg-accent-hover disabled:opacity-50"
                >
                  {manualIpSubmitting ? 'Menyimpan...' : 'Simpan IP P2P'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL UBAH PENEMPATAN RUANG / RAK */}
      {showPlacementModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 animate-backdrop"
          onClick={() => {
            if (!placementSubmitting && !showRoomRackManager) setShowPlacementModal(false);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="device-placement-title"
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-xl border border-line bg-elevated p-5 shadow-2xl animate-modal space-y-4 text-xs"
          >
            <div className="flex items-start justify-between gap-3 border-b border-line pb-3">
              <div>
                <h3 id="device-placement-title" className="text-base font-bold text-ink">
                  Atur Penempatan Ruang / Rak
                </h3>
                <p className="mt-0.5 text-xs text-ink-secondary">
                  Site: <strong className="font-mono text-ink">{device.site.siteCode}</strong> -{' '}
                  {device.site.name}
                </p>
              </div>
              <button
                type="button"
                disabled={placementSubmitting}
                onClick={() => setShowPlacementModal(false)}
                aria-label="Tutup dialog"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-ink-muted hover:bg-subtle hover:text-ink disabled:opacity-50"
              >
                <IconClose className="h-4 w-4" />
              </button>
            </div>

            {placementError && (
              <div
                role="alert"
                className="flex items-start gap-2 rounded-lg border border-rose-200 dark:border-rose-900/60 bg-rose-50 dark:bg-rose-950/50 p-3 text-xs text-rose-800 dark:text-rose-200"
              >
                <IconAlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{placementError}</span>
              </div>
            )}

            <form onSubmit={handleSavePlacement} className="space-y-3.5">
              <div>
                <label htmlFor="place-room" className="block font-semibold text-ink-secondary">
                  Ruangan
                </label>
                <select
                  id="place-room"
                  disabled={placementLoading}
                  value={selectedRoomId}
                  onChange={(e) => {
                    const nextRoomId = e.target.value;
                    setSelectedRoomId(nextRoomId);
                    if (nextRoomId && selectedRackId) {
                      const pickedRack = siteRacks.find(
                        (rk) => rk.id.toString() === selectedRackId
                      );
                      if (
                        pickedRack &&
                        pickedRack.roomId !== null &&
                        pickedRack.roomId.toString() !== nextRoomId
                      ) {
                        setSelectedRackId('');
                      }
                    }
                  }}
                  className="mt-1 min-h-[40px] block w-full rounded-lg border border-line bg-canvas px-3 py-1.5 text-xs text-ink focus:border-accent focus:outline-none disabled:opacity-60"
                >
                  <option value="">Tanpa Ruangan</option>
                  {siteRooms.map((rm) => (
                    <option key={rm.id} value={rm.id}>
                      {rm.name} {rm.floor ? `(${rm.floor})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="place-rack" className="block font-semibold text-ink-secondary">
                  Rak
                </label>
                <select
                  id="place-rack"
                  disabled={placementLoading}
                  value={selectedRackId}
                  onChange={(e) => setSelectedRackId(e.target.value)}
                  className="mt-1 min-h-[40px] block w-full rounded-lg border border-line bg-canvas px-3 py-1.5 text-xs text-ink focus:border-accent focus:outline-none disabled:opacity-60"
                >
                  <option value="">Tanpa Rak</option>
                  {siteRacks
                    .filter(
                      (rk) =>
                        !selectedRoomId ||
                        rk.roomId === null ||
                        rk.roomId.toString() === selectedRoomId
                    )
                    .map((rk) => (
                      <option key={rk.id} value={rk.id}>
                        {rk.name} ({rk.unitCapacity}U)
                      </option>
                    ))}
                </select>
              </div>

              {canManageSites && (
                <div className="flex items-center justify-between rounded-lg border border-dashed border-line-strong bg-subtle/60 px-3 py-2">
                  <span className="text-[11px] text-ink-secondary">
                    Ruang atau rak belum tersedia?
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowRoomRackManager(true)}
                    className="text-[11px] font-semibold text-accent-ink hover:underline"
                  >
                    Kelola / Tambah Ruang & Rak Site Ini
                  </button>
                </div>
              )}

              <div className="flex justify-end gap-2 border-t border-line pt-3">
                <button
                  type="button"
                  disabled={placementSubmitting}
                  onClick={() => setShowPlacementModal(false)}
                  className="min-h-[40px] rounded-lg border border-line bg-surface px-4 py-1.5 text-xs font-medium text-ink-secondary hover:bg-subtle hover:text-ink disabled:opacity-50"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={placementSubmitting || placementLoading}
                  className="min-h-[40px] rounded-lg bg-accent px-4 py-1.5 text-xs font-semibold text-accent-fg hover:bg-accent-hover disabled:opacity-50"
                >
                  {placementSubmitting ? 'Menyimpan...' : 'Simpan Penempatan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <RoomRackManagerModal
        open={showRoomRackManager}
        site={{ id: device.site.id, siteCode: device.site.siteCode, name: device.site.name }}
        onClose={() => setShowRoomRackManager(false)}
        onChanged={loadSiteRoomsAndRacks}
      />
    </div>
  );
}
