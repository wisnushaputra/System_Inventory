'use client';

import { useState, useCallback, useEffect, useMemo } from 'react';
import Link from 'next/link';
import {
  IconPlus,
  IconSearch,
  IconRefresh,
  IconClose,
  IconEdit,
  IconTrash,
  IconCheckCircle,
  IconAlertTriangle,
  IconSubnetGlobe,
} from '@/components/Icons';
import { parseCidr, validateHostIp, type CidrInfo } from '@/lib/ipam';
import { useFeedback } from '@/components/FeedbackProvider';

export interface SubnetItem {
  id: number;
  name: string;
  cidr: string;
  ipVersion: string;
  siteId: number | null;
  site: { id: number; name: string; siteCode: string } | null;
  gatewayIp: string | null;
  vlanId: number | null;
  purpose: string;
  status: string;
  description: string | null;
  cidrInfo: CidrInfo | null;
  allocatedCount: number;
  availableCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface IpAddressEntry {
  id: number;
  address: string;
  ipVersion: string;
  subnetId: number;
  subnet: {
    id: number;
    name: string;
    cidr: string;
    gatewayIp: string | null;
    purpose: string;
  };
  deviceId: number | null;
  device: { id: number; hostname: string; deviceCode: string } | null;
  interfaceId: number | null;
  interface: { id: number; name: string; label: string | null } | null;
  purpose: string;
  allocationStatus: string;
  hostname: string | null;
  description: string | null;
  assignedAt: string | null;
  releasedAt: string | null;
}

interface SiteOption {
  id: number;
  siteCode: string;
  name: string;
  siteType: string;
}

interface DeviceOption {
  id: number;
  deviceCode: string;
  hostname: string;
  site: { siteCode: string; name: string };
  interfaces: { id: number; name: string; label: string | null }[];
}

interface IpamClientProps {
  initialSubnets: SubnetItem[];
  initialAddresses: IpAddressEntry[];
  sites: SiteOption[];
  devices: DeviceOption[];
  canManageIpam: boolean;
  initialTab?: 'subnets' | 'addresses';
  initialSubnetFilter?: string;
  initialIpQuery?: string;
}

const SUBNET_PURPOSE_OPTIONS = [
  { value: 'management', label: 'Management' },
  { value: 'loopback', label: 'Loopback' },
  { value: 'point_to_point', label: 'Point-to-Point (P2P)' },
  { value: 'access', label: 'Access / Pelanggan' },
  { value: 'server', label: 'Server / Layanan' },
  { value: 'public', label: 'Public IP' },
  { value: 'other', label: 'Lainnya' },
] as const;

const SUBNET_STATUS_OPTIONS = [
  { value: 'active', label: 'Aktif' },
  { value: 'reserved', label: 'Reserved' },
  { value: 'deprecated', label: 'Deprecated' },
] as const;

const IP_PURPOSE_OPTIONS = [
  { value: 'management', label: 'Management' },
  { value: 'loopback', label: 'Loopback' },
  { value: 'point_to_point', label: 'Point-to-Point' },
  { value: 'nat', label: 'NAT Pool' },
  { value: 'carp', label: 'CARP / VRRP VIP' },
  { value: 'other', label: 'Lainnya' },
] as const;

const IP_STATUS_OPTIONS = [
  { value: 'ALLOCATED', label: 'ALLOCATED' },
  { value: 'RESERVED', label: 'RESERVED' },
  { value: 'AVAILABLE', label: 'AVAILABLE' },
  { value: 'RELEASED', label: 'RELEASED' },
] as const;

const SUBNET_PURPOSE_LABELS: Record<string, string> = Object.fromEntries(
  SUBNET_PURPOSE_OPTIONS.map((o) => [o.value, o.label])
);

const STATUS_BADGE: Record<string, string> = {
  active: 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950/70 dark:text-emerald-300',
  reserved: 'bg-amber-100 text-amber-900 dark:bg-amber-950/70 dark:text-amber-300',
  deprecated: 'bg-subtle text-ink-muted',
  ALLOCATED: 'bg-sky-100 text-sky-900 dark:bg-sky-950/70 dark:text-sky-300',
  RESERVED: 'bg-amber-100 text-amber-900 dark:bg-amber-950/70 dark:text-amber-300',
  AVAILABLE: 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950/70 dark:text-emerald-300',
  RELEASED: 'bg-subtle text-ink-muted',
};

function mapSubnetPurposeToIpPurpose(subnetPurpose: string): string {
  if (subnetPurpose === 'loopback' || subnetPurpose === 'point_to_point') {
    return subnetPurpose;
  }
  return 'management';
}

export function IpamClient({
  initialSubnets,
  initialAddresses,
  sites,
  devices,
  canManageIpam,
  initialTab = 'subnets',
  initialSubnetFilter = '',
  initialIpQuery = '',
}: IpamClientProps) {
  const { toast, confirm: confirmDialog } = useFeedback();
  const [activeTab, setActiveTab] = useState<'subnets' | 'addresses'>(initialTab);

  const [subnets, setSubnets] = useState<SubnetItem[]>(initialSubnets);
  const [addresses, setAddresses] = useState<IpAddressEntry[]>(initialAddresses);
  const [loadingSubnets, setLoadingSubnets] = useState(false);
  const [loadingAddresses, setLoadingAddresses] = useState(false);

  const [bannerMsg, setBannerMsg] = useState<string | null>(null);
  const [bannerError, setBannerError] = useState<string | null>(null);

  // Filter Subnet
  const [subnetQuery, setSubnetQuery] = useState('');
  const [subnetSiteFilter, setSubnetSiteFilter] = useState('');
  const [subnetPurposeFilter, setSubnetPurposeFilter] = useState('');
  const [subnetStatusFilter, setSubnetStatusFilter] = useState('');

  // Filter Alamat IP
  const [ipQuery, setIpQuery] = useState(initialIpQuery);
  const [ipSubnetFilter, setIpSubnetFilter] = useState(initialSubnetFilter);
  const [ipStatusFilter, setIpStatusFilter] = useState('');
  const [ipPurposeFilter, setIpPurposeFilter] = useState('');

  // Modal Tambah / Edit Subnet
  const [showSubnetModal, setShowSubnetModal] = useState(false);
  const [editingSubnet, setEditingSubnet] = useState<SubnetItem | null>(null);
  const [subnetName, setSubnetName] = useState('');
  const [subnetCidr, setSubnetCidr] = useState('');
  const [subnetSiteId, setSubnetSiteId] = useState('');
  const [subnetGatewayIp, setSubnetGatewayIp] = useState('');
  const [subnetVlanId, setSubnetVlanId] = useState('');
  const [subnetPurpose, setSubnetPurpose] = useState('management');
  const [subnetStatus, setSubnetStatus] = useState('active');
  const [subnetDescription, setSubnetDescription] = useState('');
  const [subnetSubmitting, setSubnetSubmitting] = useState(false);
  const [subnetFormError, setSubnetFormError] = useState<string | null>(null);

  // Modal Alokasi IP
  const [showAllocateModal, setShowAllocateModal] = useState(false);
  const [allocSubnetId, setAllocSubnetId] = useState('');
  const [allocAddress, setAllocAddress] = useState('');
  const [allocStatus, setAllocStatus] = useState('ALLOCATED');
  const [allocPurpose, setAllocPurpose] = useState('management');
  const [allocDeviceId, setAllocDeviceId] = useState('');
  const [allocInterfaceId, setAllocInterfaceId] = useState('');
  const [allocHostname, setAllocHostname] = useState('');
  const [allocDescription, setAllocDescription] = useState('');
  const [allocSubmitting, setAllocSubmitting] = useState(false);
  const [allocError, setAllocError] = useState<string | null>(null);

  // Modal Edit Metadata IP
  const [editingIp, setEditingIp] = useState<IpAddressEntry | null>(null);
  const [editIpPurpose, setEditIpPurpose] = useState('management');
  const [editIpHostname, setEditIpHostname] = useState('');
  const [editIpDescription, setEditIpDescription] = useState('');
  const [editIpSubmitting, setEditIpSubmitting] = useState(false);
  const [editIpError, setEditIpError] = useState<string | null>(null);

  useEffect(() => {
    const anyModal = showSubnetModal || showAllocateModal || Boolean(editingIp);
    if (!anyModal) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (!subnetSubmitting) setShowSubnetModal(false);
        if (!allocSubmitting) setShowAllocateModal(false);
        if (!editIpSubmitting) setEditingIp(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [
    showSubnetModal,
    subnetSubmitting,
    showAllocateModal,
    allocSubmitting,
    editingIp,
    editIpSubmitting,
  ]);

  const refreshAll = useCallback(async () => {
    setLoadingSubnets(true);
    setLoadingAddresses(true);
    try {
      const [resSub, resAddr] = await Promise.all([
        fetch('/api/ipam/subnets'),
        fetch('/api/ipam/addresses'),
      ]);
      if (resSub.ok) {
        const jSub = await resSub.json();
        setSubnets(jSub.data || []);
      }
      if (resAddr.ok) {
        const jAddr = await resAddr.json();
        setAddresses(jAddr.data || []);
      }
    } finally {
      setLoadingSubnets(false);
      setLoadingAddresses(false);
    }
  }, []);

  // Live preview CIDR saat membuat/mengedit subnet
  const subnetCidrPreview = useMemo<{ info: CidrInfo | null; error: string | null }>(() => {
    const raw = subnetCidr.trim();
    if (!raw) return { info: null, error: null };
    try {
      return { info: parseCidr(raw), error: null };
    } catch (err: unknown) {
      return {
        info: null,
        error: err instanceof Error ? err.message : 'Format CIDR tidak valid',
      };
    }
  }, [subnetCidr]);

  const subnetGatewayValidation = useMemo(() => {
    const gw = subnetGatewayIp.trim();
    if (!gw || !subnetCidrPreview.info) return null;
    return validateHostIp(gw, subnetCidrPreview.info.cidr);
  }, [subnetGatewayIp, subnetCidrPreview.info]);

  // Live validation host IP untuk modal Alokasi IP
  const selectedAllocSubnet = useMemo(
    () => subnets.find((s) => s.id.toString() === allocSubnetId) || null,
    [subnets, allocSubnetId]
  );

  const allocHostPreview = useMemo(() => {
    if (!allocAddress.trim() || !selectedAllocSubnet) return null;
    return validateHostIp(allocAddress.trim(), selectedAllocSubnet.cidr);
  }, [allocAddress, selectedAllocSubnet]);

  const selectedAllocDevice = useMemo(
    () => devices.find((d) => d.id.toString() === allocDeviceId) || null,
    [devices, allocDeviceId]
  );

  // Filter client-side
  const filteredSubnets = useMemo(() => {
    const q = subnetQuery.trim().toLowerCase();
    return subnets.filter((sub) => {
      if (subnetSiteFilter && sub.siteId?.toString() !== subnetSiteFilter) return false;
      if (subnetPurposeFilter && sub.purpose !== subnetPurposeFilter) return false;
      if (subnetStatusFilter && sub.status !== subnetStatusFilter) return false;
      if (q) {
        const matchName = sub.name.toLowerCase().includes(q);
        const matchCidr = sub.cidr.toLowerCase().includes(q);
        const matchDesc = (sub.description || '').toLowerCase().includes(q);
        const matchSite = (sub.site?.name || '').toLowerCase().includes(q);
        if (!matchName && !matchCidr && !matchDesc && !matchSite) return false;
      }
      return true;
    });
  }, [subnets, subnetQuery, subnetSiteFilter, subnetPurposeFilter, subnetStatusFilter]);

  const filteredAddresses = useMemo(() => {
    const q = ipQuery.trim().toLowerCase();
    return addresses.filter((ip) => {
      if (ipSubnetFilter && ip.subnetId.toString() !== ipSubnetFilter) return false;
      if (ipStatusFilter && ip.allocationStatus !== ipStatusFilter) return false;
      if (ipPurposeFilter && ip.purpose !== ipPurposeFilter) return false;
      if (q) {
        const matchIp = ip.address.toLowerCase().includes(q);
        const matchHost = (ip.hostname || '').toLowerCase().includes(q);
        const matchDesc = (ip.description || '').toLowerCase().includes(q);
        const matchDev = (ip.device?.hostname || '').toLowerCase().includes(q);
        const matchSub = ip.subnet.cidr.toLowerCase().includes(q);
        if (!matchIp && !matchHost && !matchDesc && !matchDev && !matchSub) return false;
      }
      return true;
    });
  }, [addresses, ipQuery, ipSubnetFilter, ipStatusFilter, ipPurposeFilter]);

  const selectedInspectSubnet = useMemo(
    () => (ipSubnetFilter ? subnets.find((s) => s.id.toString() === ipSubnetFilter) || null : null),
    [subnets, ipSubnetFilter]
  );

  // Ringkasan KPI riil dari data subnet
  const totals = useMemo(() => {
    let totalAllocated = 0;
    let totalUsable = 0;
    for (const s of subnets) {
      totalAllocated += s.allocatedCount;
      totalUsable += s.cidrInfo?.usableHosts ?? 0;
    }
    const avgPct = totalUsable > 0 ? Math.round((totalAllocated / totalUsable) * 100) : 0;
    return {
      subnetCount: subnets.length,
      totalAllocated,
      totalUsable,
      totalAvailable: Math.max(0, totalUsable - totalAllocated),
      avgPct,
    };
  }, [subnets]);

  const openCreateSubnetModal = () => {
    setEditingSubnet(null);
    setSubnetName('');
    setSubnetCidr('');
    setSubnetSiteId('');
    setSubnetGatewayIp('');
    setSubnetVlanId('');
    setSubnetPurpose('management');
    setSubnetStatus('active');
    setSubnetDescription('');
    setSubnetFormError(null);
    setShowSubnetModal(true);
  };

  const openEditSubnetModal = (sub: SubnetItem) => {
    setEditingSubnet(sub);
    setSubnetName(sub.name);
    setSubnetCidr(sub.cidr);
    setSubnetSiteId(sub.siteId ? sub.siteId.toString() : '');
    setSubnetGatewayIp(sub.gatewayIp || '');
    setSubnetVlanId(sub.vlanId ? sub.vlanId.toString() : '');
    setSubnetPurpose(sub.purpose);
    setSubnetStatus(sub.status);
    setSubnetDescription(sub.description || '');
    setSubnetFormError(null);
    setShowSubnetModal(true);
  };

  const handleSaveSubnet = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubnetFormError(null);

    if (subnetName.trim().length < 2) {
      setSubnetFormError('Nama subnet minimal 2 karakter.');
      return;
    }
    if (!editingSubnet && !subnetCidrPreview.info) {
      setSubnetFormError(subnetCidrPreview.error || 'Format CIDR subnet belum valid.');
      return;
    }
    if (subnetGatewayValidation && !subnetGatewayValidation.valid) {
      setSubnetFormError(subnetGatewayValidation.error || 'Gateway IP tidak berada dalam subnet.');
      return;
    }

    let parsedVlan: number | null = null;
    if (subnetVlanId.trim()) {
      const n = Number(subnetVlanId.trim());
      if (!Number.isInteger(n) || n < 1 || n > 4094) {
        setSubnetFormError('VLAN ID harus berupa bilangan bulat antara 1 sampai 4094.');
        return;
      }
      parsedVlan = n;
    }

    setSubnetSubmitting(true);
    setBannerError(null);
    try {
      const commonPayload = {
        name: subnetName.trim(),
        siteId: subnetSiteId ? parseInt(subnetSiteId, 10) : null,
        gatewayIp: subnetGatewayIp.trim() || null,
        vlanId: parsedVlan,
        purpose: subnetPurpose,
        status: subnetStatus,
        description: subnetDescription.trim() || null,
      };

      const res = await fetch(
        editingSubnet ? `/api/ipam/subnets/${editingSubnet.id}` : '/api/ipam/subnets',
        {
          method: editingSubnet ? 'PUT' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(
            editingSubnet
              ? commonPayload
              : {
                  ...commonPayload,
                  cidr: subnetCidr.trim(),
                }
          ),
        }
      );

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.message || 'Gagal menyimpan data subnet.');
      }

      setShowSubnetModal(false);
      const msg =
        json.message ||
        (editingSubnet
          ? `Subnet '${subnetName.trim()}' berhasil diperbarui.`
          : `Subnet '${subnetName.trim()}' berhasil ditambahkan.`);
      setBannerMsg(msg);
      toast.success(msg);
      await refreshAll();
    } catch (err: unknown) {
      setSubnetFormError(
        err instanceof Error ? err.message : 'Terjadi kesalahan saat menyimpan subnet.'
      );
    } finally {
      setSubnetSubmitting(false);
    }
  };

  const handleDeleteSubnet = async (sub: SubnetItem) => {
    const confirmed = await confirmDialog({
      title: `Hapus Subnet ${sub.cidr}?`,
      message: `Subnet "${sub.name}" (${sub.cidr}) dan data IP non-aktif di dalamnya akan dihapus dari sistem.`,
      confirmLabel: 'Hapus Subnet',
      tone: 'danger',
    });
    if (!confirmed) return;

    setBannerError(null);
    setBannerMsg(null);
    const res = await fetch(`/api/ipam/subnets/${sub.id}`, { method: 'DELETE' });
    const json = await res.json();
    if (!res.ok) {
      const errText = json.message || 'Gagal menghapus subnet.';
      setBannerError(errText);
      toast.error(errText, 'Gagal Menghapus Subnet');
      return;
    }
    if (ipSubnetFilter === sub.id.toString()) {
      setIpSubnetFilter('');
    }
    const okText = json.message || `Subnet '${sub.name}' berhasil dihapus.`;
    setBannerMsg(okText);
    toast.success(okText);
    await refreshAll();
  };

  const openAllocateIpModal = (preselectedSubnetId?: string) => {
    const initialSubId = preselectedSubnetId || ipSubnetFilter || (subnets[0]?.id.toString() ?? '');
    const pickedSub = subnets.find((s) => s.id.toString() === initialSubId);

    setAllocSubnetId(initialSubId);
    setAllocAddress('');
    setAllocStatus('ALLOCATED');
    setAllocPurpose(pickedSub ? mapSubnetPurposeToIpPurpose(pickedSub.purpose) : 'management');
    setAllocDeviceId('');
    setAllocInterfaceId('');
    setAllocHostname('');
    setAllocDescription('');
    setAllocError(null);
    setShowAllocateModal(true);
  };

  const handleAllocateIp = async (e: React.FormEvent) => {
    e.preventDefault();
    setAllocError(null);

    if (!allocSubnetId) {
      setAllocError('Pilih subnet tujuan terlebih dahulu.');
      return;
    }
    if (!allocAddress.trim()) {
      setAllocError('Alamat IPv4 wajib diisi.');
      return;
    }
    if (allocHostPreview && !allocHostPreview.valid) {
      setAllocError(allocHostPreview.error || 'Alamat IP tidak valid untuk subnet ini.');
      return;
    }

    setAllocSubmitting(true);
    setBannerError(null);
    try {
      const res = await fetch('/api/ipam/addresses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subnetId: parseInt(allocSubnetId, 10),
          address: allocAddress.trim(),
          allocationStatus: allocStatus,
          purpose: allocPurpose,
          deviceId: allocDeviceId ? parseInt(allocDeviceId, 10) : null,
          interfaceId: allocInterfaceId ? parseInt(allocInterfaceId, 10) : null,
          hostname: allocHostname.trim() || null,
          description: allocDescription.trim() || null,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.message || 'Gagal mengalokasikan alamat IP.');
      }

      setShowAllocateModal(false);
      const allocMsg = json.message || `Alamat IP ${allocAddress.trim()} berhasil dialokasikan.`;
      setBannerMsg(allocMsg);
      toast.success(allocMsg);
      await refreshAll();
    } catch (err: unknown) {
      setAllocError(err instanceof Error ? err.message : 'Gagal menyimpan alokasi IP.');
    } finally {
      setAllocSubmitting(false);
    }
  };

  const openEditIpModal = (ip: IpAddressEntry) => {
    setEditingIp(ip);
    setEditIpPurpose(ip.purpose);
    setEditIpHostname(ip.hostname || '');
    setEditIpDescription(ip.description || '');
    setEditIpError(null);
  };

  const handleUpdateIp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingIp) return;
    setEditIpSubmitting(true);
    setEditIpError(null);
    try {
      const res = await fetch(`/api/ipam/addresses/${editingIp.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          purpose: editIpPurpose,
          hostname: editIpHostname.trim() || null,
          description: editIpDescription.trim() || null,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.message || 'Gagal memperbarui metadata IP.');
      }
      const updMsg = json.message || `Metadata IP ${editingIp.address} berhasil diperbarui.`;
      setEditingIp(null);
      setBannerMsg(updMsg);
      toast.success(updMsg);
      await refreshAll();
    } catch (err: unknown) {
      setEditIpError(err instanceof Error ? err.message : 'Terjadi kesalahan saat memperbarui IP.');
    } finally {
      setEditIpSubmitting(false);
    }
  };

  const handleReleaseIp = async (ip: IpAddressEntry) => {
    const confirmed = await confirmDialog({
      title: `Lepas Alokasi IP ${ip.address}?`,
      message: `Ikatan IP ${ip.address} ke perangkat dan port akan dihapus, lalu status berubah menjadi RELEASED.`,
      confirmLabel: 'Lepas Alokasi',
      tone: 'warning',
    });
    if (!confirmed) return;

    setBannerError(null);
    setBannerMsg(null);
    const res = await fetch(`/api/ipam/addresses/${ip.id}/release`, { method: 'POST' });
    const json = await res.json();
    if (!res.ok) {
      const errText = json.message || 'Gagal melepas alokasi IP.';
      setBannerError(errText);
      toast.error(errText, 'Gagal Melepas IP');
      return;
    }
    const okText = json.message || `Alamat IP ${ip.address} berhasil dilepas.`;
    setBannerMsg(okText);
    toast.success(okText);
    await refreshAll();
  };

  const handleDeleteIp = async (ip: IpAddressEntry) => {
    const confirmed = await confirmDialog({
      title: `Hapus Alamat IP ${ip.address}?`,
      message: `Catatan IP ${ip.address} pada subnet ${ip.subnet.cidr} akan dihapus permanen dari sistem.`,
      confirmLabel: 'Hapus IP',
      tone: 'danger',
    });
    if (!confirmed) return;

    setBannerError(null);
    setBannerMsg(null);
    const res = await fetch(`/api/ipam/addresses/${ip.id}`, { method: 'DELETE' });
    const json = await res.json();
    if (!res.ok) {
      const errText = json.message || 'Gagal menghapus alamat IP.';
      setBannerError(errText);
      toast.error(errText, 'Gagal Menghapus IP');
      return;
    }
    const okText = json.message || `Alamat IP ${ip.address} berhasil dihapus.`;
    setBannerMsg(okText);
    toast.success(okText);
    await refreshAll();
  };

  const inspectSubnetAddresses = (subId: number) => {
    setIpSubnetFilter(subId.toString());
    setActiveTab('addresses');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="animate-enter flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-ink">Manajemen IPAM & Subnet</h1>
          <p className="text-sm text-ink-secondary mt-1">
            Kelola blok subnet CIDR, pantau utilisasi kapasitas host, dan lacak alokasi IP seluruh perangkat jaringan.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={refreshAll}
            disabled={loadingSubnets || loadingAddresses}
            className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg border border-line bg-surface px-3.5 py-1.5 text-xs font-medium text-ink-secondary hover:bg-subtle hover:text-ink disabled:opacity-50"
          >
            <IconRefresh
              className={`h-3.5 w-3.5 ${loadingSubnets || loadingAddresses ? 'animate-spin' : ''}`}
            />
            <span>Muat Ulang</span>
          </button>
          {canManageIpam && (
            <>
              <button
                type="button"
                onClick={() => openAllocateIpModal()}
                disabled={subnets.length === 0}
                className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg border border-line bg-surface px-3.5 py-1.5 text-xs font-semibold text-ink hover:border-accent hover:bg-accent-soft hover:text-accent-ink disabled:opacity-50"
              >
                <IconPlus className="h-3.5 w-3.5" />
                <span>Alokasi IP</span>
              </button>
              <button
                type="button"
                onClick={openCreateSubnetModal}
                className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg bg-accent px-4 py-1.5 text-xs font-semibold text-accent-fg shadow-xs hover:bg-accent-hover"
              >
                <IconPlus className="h-3.5 w-3.5" />
                <span>Tambah Subnet</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Summary Bar */}
      <div className="animate-enter stagger-1 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-line bg-surface p-4 shadow-xs">
          <p className="text-xs font-medium text-ink-secondary">Total Subnet</p>
          <p className="mt-1 text-2xl font-bold font-mono text-ink tabular-nums-data">
            {totals.subnetCount}
          </p>
        </div>
        <div className="rounded-xl border border-line bg-surface p-4 shadow-xs">
          <p className="text-xs font-medium text-ink-secondary">IP Dialokasikan</p>
          <p className="mt-1 text-2xl font-bold font-mono text-accent-ink tabular-nums-data">
            {totals.totalAllocated}
          </p>
        </div>
        <div className="rounded-xl border border-line bg-surface p-4 shadow-xs">
          <p className="text-xs font-medium text-ink-secondary">Kapasitas Host Tersedia</p>
          <p className="mt-1 text-2xl font-bold font-mono text-ink tabular-nums-data">
            {totals.totalAvailable}
          </p>
        </div>
        <div className="rounded-xl border border-line bg-surface p-4 shadow-xs">
          <p className="text-xs font-medium text-ink-secondary">Utilisasi Global</p>
          <p className="mt-1 text-2xl font-bold font-mono text-ink tabular-nums-data">
            {totals.avgPct}%
          </p>
        </div>
      </div>

      {bannerMsg && (
        <div
          role="status"
          className="animate-enter flex items-center justify-between gap-2 rounded-xl border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50 dark:bg-emerald-950/50 px-4 py-3 text-xs font-medium text-emerald-900 dark:text-emerald-200"
        >
          <div className="flex items-center gap-2">
            <IconCheckCircle className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
            <span>{bannerMsg}</span>
          </div>
          <button
            type="button"
            aria-label="Tutup pemberitahuan"
            onClick={() => setBannerMsg(null)}
            className="text-emerald-700 dark:text-emerald-300 hover:opacity-75"
          >
            <IconClose className="h-4 w-4" />
          </button>
        </div>
      )}

      {bannerError && (
        <div
          role="alert"
          className="animate-enter flex items-center justify-between gap-2 rounded-xl border border-rose-200 dark:border-rose-900/60 bg-rose-50 dark:bg-rose-950/50 px-4 py-3 text-xs font-medium text-rose-800 dark:text-rose-200"
        >
          <div className="flex items-center gap-2">
            <IconAlertTriangle className="h-4 w-4 shrink-0" />
            <span>{bannerError}</span>
          </div>
          <button
            type="button"
            aria-label="Tutup pesan error"
            onClick={() => setBannerError(null)}
            className="text-rose-700 dark:text-rose-300 hover:opacity-75"
          >
            <IconClose className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-line overflow-x-auto">
        <div role="tablist" aria-label="Tampilan IPAM" className="flex space-x-2 text-xs font-medium">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'subnets'}
            onClick={() => setActiveTab('subnets')}
            className={`min-h-[42px] border-b-2 px-4 py-2.5 transition-colors duration-150 whitespace-nowrap ${
              activeTab === 'subnets'
                ? 'border-accent text-accent-ink font-semibold'
                : 'border-transparent text-ink-secondary hover:text-ink'
            }`}
          >
            1. Daftar Subnet ({subnets.length})
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'addresses'}
            onClick={() => setActiveTab('addresses')}
            className={`min-h-[42px] border-b-2 px-4 py-2.5 transition-colors duration-150 whitespace-nowrap ${
              activeTab === 'addresses'
                ? 'border-accent text-accent-ink font-semibold'
                : 'border-transparent text-ink-secondary hover:text-ink'
            }`}
          >
            2. Alamat IP ({addresses.length})
          </button>
        </div>
      </div>

      {/* TAB 1: SUBNETS */}
      {activeTab === 'subnets' && (
        <div key="tab-subnets" className="animate-enter space-y-4">
          <div className="rounded-xl border border-line bg-surface p-4 shadow-xs grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <div className="lg:col-span-2">
              <label htmlFor="subnet-search" className="block text-[11px] font-semibold text-ink-secondary mb-1">
                Cari Subnet / CIDR
              </label>
              <div className="relative">
                <IconSearch className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-ink-muted" />
                <input
                  id="subnet-search"
                  type="text"
                  placeholder="Contoh: 10.10.0.0/24 atau Management..."
                  value={subnetQuery}
                  onChange={(e) => setSubnetQuery(e.target.value)}
                  className="min-h-[38px] w-full rounded-lg border border-line bg-canvas pl-8 pr-3 py-1.5 text-xs text-ink placeholder-ink-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
                />
              </div>
            </div>

            <div>
              <label htmlFor="subnet-filter-site" className="block text-[11px] font-semibold text-ink-secondary mb-1">
                Site / Lokasi
              </label>
              <select
                id="subnet-filter-site"
                value={subnetSiteFilter}
                onChange={(e) => setSubnetSiteFilter(e.target.value)}
                className="min-h-[38px] w-full rounded-lg border border-line bg-canvas px-2.5 py-1.5 text-xs text-ink focus:border-accent focus:outline-none"
              >
                <option value="">Semua Site</option>
                {sites.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.siteCode} - {s.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="subnet-filter-purpose" className="block text-[11px] font-semibold text-ink-secondary mb-1">
                Tujuan
              </label>
              <select
                id="subnet-filter-purpose"
                value={subnetPurposeFilter}
                onChange={(e) => setSubnetPurposeFilter(e.target.value)}
                className="min-h-[38px] w-full rounded-lg border border-line bg-canvas px-2.5 py-1.5 text-xs text-ink focus:border-accent focus:outline-none"
              >
                <option value="">Semua Tujuan</option>
                {SUBNET_PURPOSE_OPTIONS.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="subnet-filter-status" className="block text-[11px] font-semibold text-ink-secondary mb-1">
                Status
              </label>
              <select
                id="subnet-filter-status"
                value={subnetStatusFilter}
                onChange={(e) => setSubnetStatusFilter(e.target.value)}
                className="min-h-[38px] w-full rounded-lg border border-line bg-canvas px-2.5 py-1.5 text-xs text-ink focus:border-accent focus:outline-none"
              >
                <option value="">Semua Status</option>
                {SUBNET_STATUS_OPTIONS.map((st) => (
                  <option key={st.value} value={st.value}>
                    {st.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {loadingSubnets ? (
            <div className="rounded-xl border border-line bg-surface p-10 text-center text-xs text-ink-secondary">
              Memuat daftar subnet IPAM...
            </div>
          ) : filteredSubnets.length === 0 ? (
            <div className="rounded-xl border border-dashed border-line-strong bg-surface p-10 text-center text-xs text-ink-secondary space-y-3">
              <IconSubnetGlobe className="mx-auto h-8 w-8 text-ink-muted" />
              <div>
                <p className="font-semibold text-ink">
                  {subnets.length === 0
                    ? 'Belum ada blok subnet yang terdaftar.'
                    : 'Tidak ada subnet yang cocok dengan filter pencarian.'}
                </p>
                <p className="mt-1 text-ink-muted">
                  {subnets.length === 0
                    ? 'Tambahkan subnet Management, Loopback, LAN, atau P2P untuk mulai mengelola alokasi alamat IP.'
                    : 'Ubah kata kunci atau reset filter untuk melihat seluruh blok subnet.'}
                </p>
              </div>
              {subnets.length === 0 && canManageIpam && (
                <button
                  type="button"
                  onClick={openCreateSubnetModal}
                  className="inline-flex min-h-[38px] items-center gap-1.5 rounded-lg bg-accent px-4 py-1.5 text-xs font-semibold text-accent-fg hover:bg-accent-hover"
                >
                  <IconPlus className="h-3.5 w-3.5" />
                  <span>Tambah Subnet Pertama</span>
                </button>
              )}
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-line bg-surface shadow-xs">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-line text-left text-xs">
                  <thead className="bg-subtle text-ink-secondary font-semibold uppercase text-[11px]">
                    <tr>
                      <th className="px-4 py-3">CIDR & Rentang Host</th>
                      <th className="px-4 py-3">Nama Subnet & VLAN</th>
                      <th className="px-4 py-3">Tujuan & Site</th>
                      <th className="px-4 py-3">Utilisasi Kapasitas</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3 text-right">Tindakan</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line text-ink">
                    {filteredSubnets.map((sub) => {
                      const usable = sub.cidrInfo?.usableHosts ?? 0;
                      const pct = usable > 0 ? Math.min(100, Math.round((sub.allocatedCount / usable) * 100)) : 0;
                      const barColor =
                        pct >= 85
                          ? 'bg-rose-600 dark:bg-rose-400'
                          : pct >= 65
                          ? 'bg-amber-600 dark:bg-amber-400'
                          : 'bg-accent';

                      return (
                        <tr key={sub.id} className="transition-colors duration-100 hover:bg-subtle/60">
                          <td className="px-4 py-3 whitespace-nowrap">
                            <span className="font-mono font-bold text-accent-ink block text-sm">
                              {sub.cidr}
                            </span>
                            {sub.cidrInfo && (
                              <span className="font-mono text-[11px] text-ink-muted block mt-0.5">
                                {sub.cidrInfo.firstUsableIp} - {sub.cidrInfo.lastUsableIp}
                              </span>
                            )}
                            {sub.gatewayIp && (
                              <span className="font-mono text-[11px] text-ink-secondary block">
                                GW: {sub.gatewayIp}
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="font-semibold text-ink">{sub.name}</span>
                              {sub.vlanId && (
                                <span className="inline-flex rounded bg-accent-soft px-1.5 py-0.5 font-mono text-[10px] font-semibold text-accent-ink">
                                  VLAN {sub.vlanId}
                                </span>
                              )}
                            </div>
                            {sub.description && (
                              <p className="text-[11px] text-ink-muted mt-0.5 max-w-xs truncate">
                                {sub.description}
                              </p>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <span className="inline-flex rounded-md border border-line bg-canvas px-2 py-0.5 text-[10px] font-semibold text-ink">
                              {SUBNET_PURPOSE_LABELS[sub.purpose] || sub.purpose}
                            </span>
                            <div className="text-[11px] text-ink-secondary mt-1">
                              {sub.site ? `${sub.site.siteCode} - ${sub.site.name}` : 'Global / Semua Site'}
                            </div>
                          </td>
                          <td className="px-4 py-3 min-w-[180px]">
                            <div className="flex items-center justify-between text-[11px] font-mono tabular-nums-data mb-1">
                              <span className="font-semibold text-ink">
                                {sub.allocatedCount} / {usable} terpakai
                              </span>
                              <span className="text-ink-secondary">{pct}%</span>
                            </div>
                            <div className="h-2 w-full rounded-full bg-subtle overflow-hidden">
                              <div
                                className={`h-full rounded-full ${barColor}`}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                            <div className="text-[10px] text-ink-muted mt-1 tabular-nums-data">
                              Tersedia: {sub.availableCount} host
                            </div>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <span
                              className={`inline-flex rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase ${
                                STATUS_BADGE[sub.status] || 'bg-subtle text-ink-secondary'
                              }`}
                            >
                              {sub.status}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right whitespace-nowrap space-x-2.5">
                            <button
                              type="button"
                              onClick={() => inspectSubnetAddresses(sub.id)}
                              className="text-accent-ink hover:underline font-semibold"
                            >
                              Lihat IP
                            </button>
                            {canManageIpam && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => openEditSubnetModal(sub)}
                                  className="text-ink-secondary hover:text-ink hover:underline font-medium"
                                >
                                  Edit
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteSubnet(sub)}
                                  className="text-rose-700 dark:text-rose-300 hover:underline font-medium"
                                >
                                  Hapus
                                </button>
                              </>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: IP ADDRESSES */}
      {activeTab === 'addresses' && (
        <div key="tab-addresses" className="animate-enter space-y-4">
          {selectedInspectSubnet && (
            <div className="rounded-xl border border-accent/30 bg-accent-soft p-4 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono font-bold text-sm text-accent-ink">
                    {selectedInspectSubnet.cidr}
                  </span>
                  <span className="font-semibold text-ink">{selectedInspectSubnet.name}</span>
                  {selectedInspectSubnet.vlanId && (
                    <span className="rounded bg-surface px-2 py-0.5 font-mono text-[10px] font-semibold text-accent-ink border border-line">
                      VLAN {selectedInspectSubnet.vlanId}
                    </span>
                  )}
                </div>
                {selectedInspectSubnet.cidrInfo && (
                  <p className="font-mono text-[11px] text-ink-secondary">
                    Netmask: {selectedInspectSubnet.cidrInfo.netmask} | Network:{' '}
                    {selectedInspectSubnet.cidrInfo.networkAddress} | Broadcast:{' '}
                    {selectedInspectSubnet.cidrInfo.broadcastAddress} | Gateway:{' '}
                    {selectedInspectSubnet.gatewayIp || '-'} | Terpakai:{' '}
                    {selectedInspectSubnet.allocatedCount}/{selectedInspectSubnet.cidrInfo.usableHosts}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2">
                {canManageIpam && (
                  <button
                    type="button"
                    onClick={() => openAllocateIpModal(selectedInspectSubnet.id.toString())}
                    className="inline-flex min-h-[36px] items-center gap-1 rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-accent-fg hover:bg-accent-hover"
                  >
                    <IconPlus className="h-3.5 w-3.5" />
                    <span>Alokasi IP di Subnet Ini</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setIpSubnetFilter('')}
                  className="min-h-[36px] rounded-lg border border-line bg-surface px-3 py-1.5 text-xs font-medium text-ink-secondary hover:bg-subtle hover:text-ink"
                >
                  Tampilkan Semua Subnet
                </button>
              </div>
            </div>
          )}

          <div className="rounded-xl border border-line bg-surface p-4 shadow-xs grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <div className="lg:col-span-2">
              <label htmlFor="ip-search" className="block text-[11px] font-semibold text-ink-secondary mb-1">
                Cari IP / Hostname / Perangkat
              </label>
              <div className="relative">
                <IconSearch className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-ink-muted" />
                <input
                  id="ip-search"
                  type="text"
                  placeholder="Contoh: 10.10.20.2 atau pop-bdg-core01..."
                  value={ipQuery}
                  onChange={(e) => setIpQuery(e.target.value)}
                  className="min-h-[38px] w-full rounded-lg border border-line bg-canvas pl-8 pr-3 py-1.5 text-xs text-ink placeholder-ink-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
                />
              </div>
            </div>

            <div>
              <label htmlFor="ip-filter-subnet" className="block text-[11px] font-semibold text-ink-secondary mb-1">
                Filter Subnet
              </label>
              <select
                id="ip-filter-subnet"
                value={ipSubnetFilter}
                onChange={(e) => setIpSubnetFilter(e.target.value)}
                className="min-h-[38px] w-full rounded-lg border border-line bg-canvas px-2.5 py-1.5 text-xs text-ink focus:border-accent focus:outline-none"
              >
                <option value="">Semua Subnet</option>
                {subnets.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.cidr} - {s.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="ip-filter-status" className="block text-[11px] font-semibold text-ink-secondary mb-1">
                Status Alokasi
              </label>
              <select
                id="ip-filter-status"
                value={ipStatusFilter}
                onChange={(e) => setIpStatusFilter(e.target.value)}
                className="min-h-[38px] w-full rounded-lg border border-line bg-canvas px-2.5 py-1.5 text-xs text-ink focus:border-accent focus:outline-none"
              >
                <option value="">Semua Status</option>
                {IP_STATUS_OPTIONS.map((st) => (
                  <option key={st.value} value={st.value}>
                    {st.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="ip-filter-purpose" className="block text-[11px] font-semibold text-ink-secondary mb-1">
                Tujuan IP
              </label>
              <select
                id="ip-filter-purpose"
                value={ipPurposeFilter}
                onChange={(e) => setIpPurposeFilter(e.target.value)}
                className="min-h-[38px] w-full rounded-lg border border-line bg-canvas px-2.5 py-1.5 text-xs text-ink focus:border-accent focus:outline-none"
              >
                <option value="">Semua Tujuan</option>
                {IP_PURPOSE_OPTIONS.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {loadingAddresses ? (
            <div className="rounded-xl border border-line bg-surface p-10 text-center text-xs text-ink-secondary">
              Memuat daftar alamat IP...
            </div>
          ) : filteredAddresses.length === 0 ? (
            <div className="rounded-xl border border-dashed border-line-strong bg-surface p-10 text-center text-xs text-ink-secondary space-y-3">
              <p className="font-semibold text-ink">
                {addresses.length === 0
                  ? 'Belum ada alamat IP yang dialokasikan.'
                  : 'Tidak ada alamat IP yang cocok dengan filter.'}
              </p>
              {canManageIpam && subnets.length > 0 && (
                <button
                  type="button"
                  onClick={() => openAllocateIpModal(ipSubnetFilter || undefined)}
                  className="inline-flex min-h-[38px] items-center gap-1.5 rounded-lg bg-accent px-4 py-1.5 text-xs font-semibold text-accent-fg hover:bg-accent-hover"
                >
                  <IconPlus className="h-3.5 w-3.5" />
                  <span>Alokasi IP Sekarang</span>
                </button>
              )}
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-line bg-surface shadow-xs">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-line text-left text-xs">
                  <thead className="bg-subtle text-ink-secondary font-semibold uppercase text-[11px]">
                    <tr>
                      <th className="px-4 py-3">Alamat IP</th>
                      <th className="px-4 py-3">Subnet</th>
                      <th className="px-4 py-3">Perangkat & Port</th>
                      <th className="px-4 py-3">Tujuan</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Hostname / Catatan</th>
                      {canManageIpam && <th className="px-4 py-3 text-right">Tindakan</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line text-ink">
                    {filteredAddresses.map((ip) => (
                      <tr key={ip.id} className="transition-colors duration-100 hover:bg-subtle/60">
                        <td className="px-4 py-3 font-mono font-bold text-accent-ink whitespace-nowrap">
                          {ip.address}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className="font-medium text-ink block">{ip.subnet.name}</span>
                          <span className="font-mono text-[11px] text-ink-muted block">
                            {ip.subnet.cidr}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {ip.device ? (
                            <div>
                              <Link
                                href={`/devices/${ip.device.id}`}
                                className="font-semibold text-accent-ink hover:underline block"
                              >
                                {ip.device.hostname}
                              </Link>
                              <span className="font-mono text-[11px] text-ink-muted">
                                {ip.interface ? `Port: ${ip.interface.name}` : ip.device.deviceCode}
                              </span>
                            </div>
                          ) : (
                            <span className="italic text-ink-muted">Belum terikat perangkat</span>
                          )}
                        </td>
                        <td className="px-4 py-3 uppercase font-mono text-[11px] text-ink-secondary">
                          {ip.purpose}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span
                            className={`inline-flex rounded-md px-2 py-0.5 text-[10px] font-semibold ${
                              STATUS_BADGE[ip.allocationStatus] || 'bg-subtle text-ink-secondary'
                            }`}
                          >
                            {ip.allocationStatus}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-ink-secondary max-w-[220px]">
                          <div className="font-medium text-ink">{ip.hostname || '-'}</div>
                          {ip.description && (
                            <div className="text-[11px] text-ink-muted truncate">{ip.description}</div>
                          )}
                        </td>
                        {canManageIpam && (
                          <td className="px-4 py-3 text-right whitespace-nowrap space-x-2.5">
                            <button
                              type="button"
                              onClick={() => openEditIpModal(ip)}
                              className="inline-flex items-center gap-1 text-accent-ink hover:underline font-medium"
                            >
                              <IconEdit className="h-3.5 w-3.5" />
                              <span>Edit</span>
                            </button>
                            {ip.allocationStatus === 'ALLOCATED' ? (
                              <button
                                type="button"
                                onClick={() => handleReleaseIp(ip)}
                                className="text-amber-700 dark:text-amber-300 hover:underline font-medium"
                              >
                                Lepas
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleDeleteIp(ip)}
                                className="inline-flex items-center gap-1 text-rose-700 dark:text-rose-300 hover:underline font-medium"
                              >
                                <IconTrash className="h-3.5 w-3.5" />
                                <span>Hapus</span>
                              </button>
                            )}
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* MODAL TAMBAH / EDIT SUBNET */}
      {showSubnetModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 animate-backdrop"
          onClick={() => {
            if (!subnetSubmitting) setShowSubnetModal(false);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="subnet-modal-title"
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg rounded-xl border border-line bg-elevated p-5 shadow-2xl animate-modal space-y-4 text-xs max-h-[92vh] overflow-y-auto"
          >
            <div className="flex items-start justify-between gap-3 border-b border-line pb-3">
              <div>
                <h3 id="subnet-modal-title" className="text-base font-bold text-ink">
                  {editingSubnet ? `Edit Subnet: ${editingSubnet.cidr}` : 'Tambah Blok Subnet Baru'}
                </h3>
                <p className="mt-0.5 text-xs text-ink-secondary">
                  Daftarkan blok jaringan IPv4 (Management, Loopback, LAN, Server, atau P2P) dengan kalkulasi CIDR otomatis.
                </p>
              </div>
              <button
                type="button"
                disabled={subnetSubmitting}
                onClick={() => setShowSubnetModal(false)}
                aria-label="Tutup dialog"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-ink-muted hover:bg-subtle hover:text-ink disabled:opacity-50"
              >
                <IconClose className="h-4 w-4" />
              </button>
            </div>

            {subnetFormError && (
              <div
                role="alert"
                className="flex items-start gap-2 rounded-lg border border-rose-200 dark:border-rose-900/60 bg-rose-50 dark:bg-rose-950/50 p-3 text-xs text-rose-800 dark:text-rose-200"
              >
                <IconAlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{subnetFormError}</span>
              </div>
            )}

            <form onSubmit={handleSaveSubnet} className="space-y-3.5">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label htmlFor="sub-name" className="block font-semibold text-ink-secondary">
                    Nama Subnet <span className="text-rose-600">*</span>
                  </label>
                  <input
                    id="sub-name"
                    type="text"
                    required
                    minLength={2}
                    maxLength={100}
                    placeholder="Contoh: Management POP Bandung"
                    value={subnetName}
                    onChange={(e) => setSubnetName(e.target.value)}
                    className="mt-1 min-h-[38px] block w-full rounded-lg border border-line bg-canvas px-3 py-1.5 text-xs text-ink placeholder-ink-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
                  />
                </div>
                <div>
                  <label htmlFor="sub-cidr" className="block font-semibold text-ink-secondary">
                    CIDR IPv4 <span className="text-rose-600">*</span>
                  </label>
                  <input
                    id="sub-cidr"
                    type="text"
                    required
                    disabled={Boolean(editingSubnet)}
                    placeholder="Contoh: 10.20.0.0/24"
                    value={subnetCidr}
                    onChange={(e) => setSubnetCidr(e.target.value)}
                    className="mt-1 min-h-[38px] block w-full rounded-lg border border-line bg-canvas px-3 py-1.5 font-mono text-xs text-ink placeholder-ink-muted focus:border-accent focus:outline-none disabled:opacity-60"
                  />
                </div>
              </div>

              {subnetCidr.trim() && (
                subnetCidrPreview.info ? (
                  <div className="rounded-lg border border-line bg-subtle p-3 space-y-1.5">
                    <p className="font-semibold text-ink">Pratinjau Kalkulator CIDR</p>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 font-mono text-[11px]">
                      <div>
                        <span className="block text-ink-muted">Canonical CIDR</span>
                        <span className="font-semibold text-accent-ink">{subnetCidrPreview.info.cidr}</span>
                      </div>
                      <div>
                        <span className="block text-ink-muted">Netmask</span>
                        <span className="font-semibold text-ink">{subnetCidrPreview.info.netmask}</span>
                      </div>
                      <div>
                        <span className="block text-ink-muted">Host Usable</span>
                        <span className="font-semibold text-ink">{subnetCidrPreview.info.usableHosts} IP</span>
                      </div>
                      <div>
                        <span className="block text-ink-muted">Rentang Host</span>
                        <span className="font-semibold text-ink">
                          {subnetCidrPreview.info.firstUsableIp} - {subnetCidrPreview.info.lastUsableIp}
                        </span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-lg border border-rose-200 dark:border-rose-900/60 bg-rose-50 dark:bg-rose-950/50 p-2.5 text-[11px] text-rose-800 dark:text-rose-200">
                    {subnetCidrPreview.error}
                  </div>
                )
              )}

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div>
                  <label htmlFor="sub-purpose" className="block font-semibold text-ink-secondary">
                    Tujuan Subnet
                  </label>
                  <select
                    id="sub-purpose"
                    value={subnetPurpose}
                    onChange={(e) => setSubnetPurpose(e.target.value)}
                    className="mt-1 min-h-[38px] block w-full rounded-lg border border-line bg-canvas px-2.5 py-1.5 text-xs text-ink focus:border-accent focus:outline-none"
                  >
                    {SUBNET_PURPOSE_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="sub-status" className="block font-semibold text-ink-secondary">
                    Status Subnet
                  </label>
                  <select
                    id="sub-status"
                    value={subnetStatus}
                    onChange={(e) => setSubnetStatus(e.target.value)}
                    className="mt-1 min-h-[38px] block w-full rounded-lg border border-line bg-canvas px-2.5 py-1.5 text-xs text-ink focus:border-accent focus:outline-none"
                  >
                    {SUBNET_STATUS_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="sub-site" className="block font-semibold text-ink-secondary">
                    Site (Opsional)
                  </label>
                  <select
                    id="sub-site"
                    value={subnetSiteId}
                    onChange={(e) => setSubnetSiteId(e.target.value)}
                    className="mt-1 min-h-[38px] block w-full rounded-lg border border-line bg-canvas px-2.5 py-1.5 text-xs text-ink focus:border-accent focus:outline-none"
                  >
                    <option value="">Global / Lintas Site</option>
                    {sites.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.siteCode} - {s.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label htmlFor="sub-gw" className="block font-semibold text-ink-secondary">
                    Gateway IP (Opsional)
                  </label>
                  <input
                    id="sub-gw"
                    type="text"
                    placeholder="Contoh: 10.20.0.1"
                    value={subnetGatewayIp}
                    onChange={(e) => setSubnetGatewayIp(e.target.value)}
                    className="mt-1 min-h-[38px] block w-full rounded-lg border border-line bg-canvas px-3 py-1.5 font-mono text-xs text-ink placeholder-ink-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
                  />
                  {subnetGatewayValidation && !subnetGatewayValidation.valid && (
                    <p className="mt-1 text-[11px] text-rose-700 dark:text-rose-300">
                      {subnetGatewayValidation.error}
                    </p>
                  )}
                </div>
                <div>
                  <label htmlFor="sub-vlan" className="block font-semibold text-ink-secondary">
                    VLAN ID (1-4094)
                  </label>
                  <input
                    id="sub-vlan"
                    type="number"
                    min={1}
                    max={4094}
                    placeholder="Contoh: 100"
                    value={subnetVlanId}
                    onChange={(e) => setSubnetVlanId(e.target.value)}
                    className="mt-1 min-h-[38px] block w-full rounded-lg border border-line bg-canvas px-3 py-1.5 font-mono text-xs text-ink placeholder-ink-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="sub-desc" className="block font-semibold text-ink-secondary">
                  Deskripsi (Opsional)
                </label>
                <input
                  id="sub-desc"
                  type="text"
                  maxLength={500}
                  placeholder="Contoh: Blok IP manajemen OLT & switch POP Bandung"
                  value={subnetDescription}
                  onChange={(e) => setSubnetDescription(e.target.value)}
                  className="mt-1 min-h-[38px] block w-full rounded-lg border border-line bg-canvas px-3 py-1.5 text-xs text-ink placeholder-ink-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
                />
              </div>

              <div className="flex justify-end gap-2 border-t border-line pt-3">
                <button
                  type="button"
                  disabled={subnetSubmitting}
                  onClick={() => setShowSubnetModal(false)}
                  className="min-h-[38px] rounded-lg border border-line bg-surface px-4 py-1.5 text-xs font-medium text-ink-secondary hover:bg-subtle hover:text-ink disabled:opacity-50"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={subnetSubmitting}
                  className="min-h-[38px] rounded-lg bg-accent px-4 py-1.5 text-xs font-semibold text-accent-fg hover:bg-accent-hover disabled:opacity-50"
                >
                  {subnetSubmitting
                    ? 'Menyimpan...'
                    : editingSubnet
                    ? 'Simpan Perubahan'
                    : 'Simpan Subnet'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL ALOKASI IP ADDRESS */}
      {showAllocateModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 animate-backdrop"
          onClick={() => {
            if (!allocSubmitting) setShowAllocateModal(false);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="alloc-ip-title"
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg rounded-xl border border-line bg-elevated p-5 shadow-2xl animate-modal space-y-4 text-xs max-h-[92vh] overflow-y-auto"
          >
            <div className="flex items-start justify-between gap-3 border-b border-line pb-3">
              <div>
                <h3 id="alloc-ip-title" className="text-base font-bold text-ink">
                  Alokasi Alamat IP Baru
                </h3>
                <p className="mt-0.5 text-xs text-ink-secondary">
                  Alokasikan atau reservasi IP host dari salah satu subnet terdaftar dengan validasi CIDR otomatis.
                </p>
              </div>
              <button
                type="button"
                disabled={allocSubmitting}
                onClick={() => setShowAllocateModal(false)}
                aria-label="Tutup dialog"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-ink-muted hover:bg-subtle hover:text-ink disabled:opacity-50"
              >
                <IconClose className="h-4 w-4" />
              </button>
            </div>

            {allocError && (
              <div
                role="alert"
                className="flex items-start gap-2 rounded-lg border border-rose-200 dark:border-rose-900/60 bg-rose-50 dark:bg-rose-950/50 p-3 text-xs text-rose-800 dark:text-rose-200"
              >
                <IconAlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{allocError}</span>
              </div>
            )}

            <form onSubmit={handleAllocateIp} className="space-y-3.5">
              <div>
                <label htmlFor="alloc-subnet" className="block font-semibold text-ink-secondary">
                  Subnet Sumber <span className="text-rose-600">*</span>
                </label>
                <select
                  id="alloc-subnet"
                  required
                  value={allocSubnetId}
                  onChange={(e) => {
                    const nextId = e.target.value;
                    setAllocSubnetId(nextId);
                    const sub = subnets.find((s) => s.id.toString() === nextId);
                    if (sub) setAllocPurpose(mapSubnetPurposeToIpPurpose(sub.purpose));
                  }}
                  className="mt-1 min-h-[38px] block w-full rounded-lg border border-line bg-canvas px-2.5 py-1.5 text-xs text-ink focus:border-accent focus:outline-none"
                >
                  <option value="">Pilih Subnet</option>
                  {subnets.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.cidr} - {s.name} ({s.availableCount} bebas)
                    </option>
                  ))}
                </select>
                {selectedAllocSubnet?.cidrInfo && (
                  <p className="mt-1 font-mono text-[11px] text-ink-muted">
                    Rentang valid: {selectedAllocSubnet.cidrInfo.firstUsableIp} -{' '}
                    {selectedAllocSubnet.cidrInfo.lastUsableIp}
                  </p>
                )}
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div>
                  <label htmlFor="alloc-address" className="block font-semibold text-ink-secondary">
                    Alamat IPv4 Host <span className="text-rose-600">*</span>
                  </label>
                  <input
                    id="alloc-address"
                    type="text"
                    required
                    placeholder="Contoh: 10.20.0.10"
                    value={allocAddress}
                    onChange={(e) => setAllocAddress(e.target.value)}
                    className="mt-1 min-h-[38px] block w-full rounded-lg border border-line bg-canvas px-3 py-1.5 font-mono text-xs text-ink placeholder-ink-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
                  />
                </div>
                <div>
                  <label htmlFor="alloc-status" className="block font-semibold text-ink-secondary">
                    Status
                  </label>
                  <select
                    id="alloc-status"
                    value={allocStatus}
                    onChange={(e) => setAllocStatus(e.target.value)}
                    className="mt-1 min-h-[38px] block w-full rounded-lg border border-line bg-canvas px-2.5 py-1.5 text-xs text-ink focus:border-accent focus:outline-none"
                  >
                    <option value="ALLOCATED">ALLOCATED</option>
                    <option value="RESERVED">RESERVED</option>
                    <option value="AVAILABLE">AVAILABLE</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="alloc-purpose" className="block font-semibold text-ink-secondary">
                    Tujuan IP
                  </label>
                  <select
                    id="alloc-purpose"
                    value={allocPurpose}
                    onChange={(e) => setAllocPurpose(e.target.value)}
                    className="mt-1 min-h-[38px] block w-full rounded-lg border border-line bg-canvas px-2.5 py-1.5 text-xs text-ink focus:border-accent focus:outline-none"
                  >
                    {IP_PURPOSE_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {allocHostPreview && !allocHostPreview.valid && (
                <div className="rounded-lg border border-rose-200 dark:border-rose-900/60 bg-rose-50 dark:bg-rose-950/50 p-2.5 text-[11px] text-rose-800 dark:text-rose-200">
                  {allocHostPreview.error}
                </div>
              )}

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label htmlFor="alloc-device" className="block font-semibold text-ink-secondary">
                    Perangkat (Opsional)
                  </label>
                  <select
                    id="alloc-device"
                    value={allocDeviceId}
                    onChange={(e) => {
                      setAllocDeviceId(e.target.value);
                      setAllocInterfaceId('');
                    }}
                    className="mt-1 min-h-[38px] block w-full rounded-lg border border-line bg-canvas px-2.5 py-1.5 text-xs text-ink focus:border-accent focus:outline-none"
                  >
                    <option value="">Tidak terikat perangkat</option>
                    {devices.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.hostname} ({d.site.siteCode})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="alloc-iface" className="block font-semibold text-ink-secondary">
                    Port / Interface (Opsional)
                  </label>
                  <select
                    id="alloc-iface"
                    disabled={!selectedAllocDevice}
                    value={allocInterfaceId}
                    onChange={(e) => setAllocInterfaceId(e.target.value)}
                    className="mt-1 min-h-[38px] block w-full rounded-lg border border-line bg-canvas px-2.5 py-1.5 text-xs text-ink focus:border-accent focus:outline-none disabled:opacity-60"
                  >
                    <option value="">Tanpa ikatan port spesifik</option>
                    {selectedAllocDevice?.interfaces.map((iface) => (
                      <option key={iface.id} value={iface.id}>
                        {iface.name} {iface.label ? `(${iface.label})` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label htmlFor="alloc-host" className="block font-semibold text-ink-secondary">
                    Hostname / DNS (Opsional)
                  </label>
                  <input
                    id="alloc-host"
                    type="text"
                    maxLength={100}
                    placeholder="Contoh: mgmt-bdg-core01.internal"
                    value={allocHostname}
                    onChange={(e) => setAllocHostname(e.target.value)}
                    className="mt-1 min-h-[38px] block w-full rounded-lg border border-line bg-canvas px-3 py-1.5 text-xs text-ink placeholder-ink-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
                  />
                </div>
                <div>
                  <label htmlFor="alloc-desc" className="block font-semibold text-ink-secondary">
                    Catatan (Opsional)
                  </label>
                  <input
                    id="alloc-desc"
                    type="text"
                    maxLength={500}
                    placeholder="Contoh: IP Loopback OSPF router utama"
                    value={allocDescription}
                    onChange={(e) => setAllocDescription(e.target.value)}
                    className="mt-1 min-h-[38px] block w-full rounded-lg border border-line bg-canvas px-3 py-1.5 text-xs text-ink placeholder-ink-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 border-t border-line pt-3">
                <button
                  type="button"
                  disabled={allocSubmitting}
                  onClick={() => setShowAllocateModal(false)}
                  className="min-h-[38px] rounded-lg border border-line bg-surface px-4 py-1.5 text-xs font-medium text-ink-secondary hover:bg-subtle hover:text-ink disabled:opacity-50"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={allocSubmitting || (allocHostPreview !== null && !allocHostPreview.valid)}
                  className="min-h-[38px] rounded-lg bg-accent px-4 py-1.5 text-xs font-semibold text-accent-fg hover:bg-accent-hover disabled:opacity-50"
                >
                  {allocSubmitting ? 'Menyimpan...' : 'Simpan Alokasi IP'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL EDIT METADATA IP */}
      {editingIp && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 animate-backdrop"
          onClick={() => {
            if (!editIpSubmitting) setEditingIp(null);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="edit-ip-title"
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-xl border border-line bg-elevated p-5 shadow-2xl animate-modal space-y-4 text-xs"
          >
            <div className="flex items-start justify-between gap-3 border-b border-line pb-3">
              <div>
                <h3 id="edit-ip-title" className="text-base font-bold text-ink">
                  Edit Metadata IP: {editingIp.address}
                </h3>
                <p className="mt-0.5 font-mono text-[11px] text-ink-secondary">
                  Subnet: {editingIp.subnet.cidr} ({editingIp.subnet.name})
                </p>
              </div>
              <button
                type="button"
                disabled={editIpSubmitting}
                onClick={() => setEditingIp(null)}
                aria-label="Tutup dialog"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-ink-muted hover:bg-subtle hover:text-ink disabled:opacity-50"
              >
                <IconClose className="h-4 w-4" />
              </button>
            </div>

            {editIpError && (
              <div
                role="alert"
                className="flex items-start gap-2 rounded-lg border border-rose-200 dark:border-rose-900/60 bg-rose-50 dark:bg-rose-950/50 p-3 text-xs text-rose-800 dark:text-rose-200"
              >
                <IconAlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{editIpError}</span>
              </div>
            )}

            <form onSubmit={handleUpdateIp} className="space-y-3.5">
              <div>
                <label htmlFor="edit-ip-purpose" className="block font-semibold text-ink-secondary">
                  Tujuan IP
                </label>
                <select
                  id="edit-ip-purpose"
                  value={editIpPurpose}
                  onChange={(e) => setEditIpPurpose(e.target.value)}
                  className="mt-1 min-h-[38px] block w-full rounded-lg border border-line bg-canvas px-2.5 py-1.5 text-xs text-ink focus:border-accent focus:outline-none"
                >
                  {IP_PURPOSE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="edit-ip-host" className="block font-semibold text-ink-secondary">
                  Hostname / DNS
                </label>
                <input
                  id="edit-ip-host"
                  type="text"
                  maxLength={100}
                  value={editIpHostname}
                  onChange={(e) => setEditIpHostname(e.target.value)}
                  className="mt-1 min-h-[38px] block w-full rounded-lg border border-line bg-canvas px-3 py-1.5 text-xs text-ink focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
                />
              </div>
              <div>
                <label htmlFor="edit-ip-desc" className="block font-semibold text-ink-secondary">
                  Catatan
                </label>
                <input
                  id="edit-ip-desc"
                  type="text"
                  maxLength={500}
                  value={editIpDescription}
                  onChange={(e) => setEditIpDescription(e.target.value)}
                  className="mt-1 min-h-[38px] block w-full rounded-lg border border-line bg-canvas px-3 py-1.5 text-xs text-ink focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
                />
              </div>
              <div className="flex justify-end gap-2 border-t border-line pt-3">
                <button
                  type="button"
                  disabled={editIpSubmitting}
                  onClick={() => setEditingIp(null)}
                  className="min-h-[38px] rounded-lg border border-line bg-surface px-4 py-1.5 text-xs font-medium text-ink-secondary hover:bg-subtle hover:text-ink disabled:opacity-50"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={editIpSubmitting}
                  className="min-h-[38px] rounded-lg bg-accent px-4 py-1.5 text-xs font-semibold text-accent-fg hover:bg-accent-hover disabled:opacity-50"
                >
                  {editIpSubmitting ? 'Menyimpan...' : 'Simpan Perubahan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
