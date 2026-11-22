import { prisma } from '@/lib/prisma';
import { requirePermission, hasPermission } from '@/lib/auth';
import { parseCidr } from '@/lib/ipam';
import { IpamClient } from './IpamClient';

export const instant = false;

export default async function IpamPage(props: {
  searchParams?: Promise<{ tab?: string; subnetId?: string; q?: string }>;
}) {
  const user = await requirePermission('ipam.view');
  const canManageIpam = hasPermission(user, 'ipam.manage');
  const resolvedSearchParams = props.searchParams ? await props.searchParams : {};
  const initialTab = resolvedSearchParams.tab === 'addresses' ? 'addresses' : 'subnets';
  const initialSubnetFilter = resolvedSearchParams.subnetId || '';
  const initialIpQuery = resolvedSearchParams.q || '';

  const [subnets, addresses, sites, devices] = await Promise.all([
    prisma.subnet.findMany({
      include: {
        site: { select: { id: true, name: true, siteCode: true } },
        _count: {
          select: {
            ipAddresses: {
              where: { allocationStatus: 'ALLOCATED' },
            },
          },
        },
      },
      orderBy: { cidr: 'asc' },
    }),
    prisma.ipAddress.findMany({
      include: {
        subnet: {
          select: { id: true, name: true, cidr: true, gatewayIp: true, purpose: true },
        },
        device: {
          select: { id: true, hostname: true, deviceCode: true },
        },
        interface: {
          select: { id: true, name: true, label: true },
        },
      },
      orderBy: { address: 'asc' },
    }),
    prisma.site.findMany({
      select: { id: true, siteCode: true, name: true, siteType: true },
      orderBy: { siteCode: 'asc' },
    }),
    prisma.device.findMany({
      where: { archivedAt: null },
      select: {
        id: true,
        deviceCode: true,
        hostname: true,
        site: { select: { siteCode: true, name: true } },
        interfaces: {
          select: { id: true, name: true, label: true },
          orderBy: { name: 'asc' },
        },
      },
      orderBy: { hostname: 'asc' },
    }),
  ]);

  const serializedSubnets = subnets.map((sub) => {
    let cidrInfo = null;
    try {
      cidrInfo = parseCidr(sub.cidr);
    } catch {
      cidrInfo = null;
    }
    const allocatedCount = sub._count.ipAddresses;
    const availableCount = cidrInfo ? Math.max(0, cidrInfo.usableHosts - allocatedCount) : 0;

    return {
      id: sub.id,
      name: sub.name,
      cidr: sub.cidr,
      ipVersion: sub.ipVersion,
      siteId: sub.siteId,
      site: sub.site,
      gatewayIp: sub.gatewayIp,
      vlanId: sub.vlanId,
      purpose: sub.purpose,
      status: sub.status,
      description: sub.description,
      cidrInfo,
      allocatedCount,
      availableCount,
      createdAt: sub.createdAt.toISOString(),
      updatedAt: sub.updatedAt.toISOString(),
    };
  });

  const serializedAddresses = addresses.map((ip) => ({
    id: ip.id,
    address: ip.address,
    ipVersion: ip.ipVersion,
    subnetId: ip.subnetId,
    subnet: ip.subnet,
    deviceId: ip.deviceId,
    device: ip.device,
    interfaceId: ip.interfaceId,
    interface: ip.interface,
    purpose: ip.purpose,
    allocationStatus: ip.allocationStatus,
    hostname: ip.hostname,
    description: ip.description,
    assignedAt: ip.assignedAt ? ip.assignedAt.toISOString() : null,
    releasedAt: ip.releasedAt ? ip.releasedAt.toISOString() : null,
  }));

  return (
    <div className="space-y-6">
      <IpamClient
        initialSubnets={serializedSubnets}
        initialAddresses={serializedAddresses}
        sites={sites}
        devices={devices}
        canManageIpam={canManageIpam}
        initialTab={initialTab}
        initialSubnetFilter={initialSubnetFilter}
        initialIpQuery={initialIpQuery}
      />
    </div>
  );
}
