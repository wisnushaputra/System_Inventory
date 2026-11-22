import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser, hasPermission } from '@/lib/auth';

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ message: 'Autentikasi diperlukan' }, { status: 401 });
  }

  const url = new URL(req.url);
  const rawQuery = (url.searchParams.get('q') || '').trim().slice(0, 100);

  if (rawQuery.length < 2) {
    return NextResponse.json({
      query: rawQuery,
      results: {
        devices: [],
        ipAddresses: [],
        subnets: [],
        sites: [],
        ports: [],
      },
    });
  }

  const canDevice = hasPermission(user, 'device.view');
  const canIpam = hasPermission(user, 'ipam.view');
  const canSite = hasPermission(user, 'site.view');
  const canInterface = hasPermission(user, 'interface.view');

  const [devices, ipAddresses, subnets, sites, ports] = await Promise.all([
    canDevice
      ? prisma.device.findMany({
          where: {
            OR: [
              { hostname: { contains: rawQuery, mode: 'insensitive' } },
              { deviceCode: { contains: rawQuery, mode: 'insensitive' } },
              { serialNumber: { contains: rawQuery, mode: 'insensitive' } },
              { model: { modelName: { contains: rawQuery, mode: 'insensitive' } } },
              { site: { siteCode: { contains: rawQuery, mode: 'insensitive' } } },
              { site: { name: { contains: rawQuery, mode: 'insensitive' } } },
            ],
          },
          select: {
            id: true,
            deviceCode: true,
            hostname: true,
            serialNumber: true,
            inventoryStatus: true,
            archivedAt: true,
            category: { select: { code: true, name: true } },
            site: { select: { siteCode: true, name: true } },
            ipAddresses: {
              where: { purpose: 'management', allocationStatus: 'ALLOCATED' },
              select: { address: true },
              take: 1,
            },
          },
          orderBy: [{ archivedAt: 'asc' }, { hostname: 'asc' }],
          take: 5,
        })
      : Promise.resolve([]),

    canIpam
      ? prisma.ipAddress.findMany({
          where: {
            OR: [
              { address: { contains: rawQuery, mode: 'insensitive' } },
              { hostname: { contains: rawQuery, mode: 'insensitive' } },
              { description: { contains: rawQuery, mode: 'insensitive' } },
              { device: { hostname: { contains: rawQuery, mode: 'insensitive' } } },
              { subnet: { cidr: { contains: rawQuery, mode: 'insensitive' } } },
            ],
          },
          select: {
            id: true,
            address: true,
            allocationStatus: true,
            purpose: true,
            hostname: true,
            deviceId: true,
            device: { select: { id: true, hostname: true, deviceCode: true } },
            subnet: { select: { id: true, name: true, cidr: true } },
          },
          orderBy: { address: 'asc' },
          take: 5,
        })
      : Promise.resolve([]),

    canIpam
      ? prisma.subnet.findMany({
          where: {
            OR: [
              { cidr: { contains: rawQuery, mode: 'insensitive' } },
              { name: { contains: rawQuery, mode: 'insensitive' } },
              { description: { contains: rawQuery, mode: 'insensitive' } },
            ],
          },
          select: {
            id: true,
            name: true,
            cidr: true,
            purpose: true,
            status: true,
            vlanId: true,
            site: { select: { siteCode: true, name: true } },
          },
          orderBy: { cidr: 'asc' },
          take: 5,
        })
      : Promise.resolve([]),

    canSite
      ? prisma.site.findMany({
          where: {
            OR: [
              { siteCode: { contains: rawQuery, mode: 'insensitive' } },
              { name: { contains: rawQuery, mode: 'insensitive' } },
              { city: { contains: rawQuery, mode: 'insensitive' } },
              { address: { contains: rawQuery, mode: 'insensitive' } },
            ],
          },
          select: {
            id: true,
            siteCode: true,
            name: true,
            siteType: true,
            city: true,
            parentSite: { select: { siteCode: true, name: true } },
          },
          orderBy: { siteCode: 'asc' },
          take: 5,
        })
      : Promise.resolve([]),

    canInterface && canDevice
      ? prisma.interface.findMany({
          where: {
            OR: [
              { name: { contains: rawQuery, mode: 'insensitive' } },
              { label: { contains: rawQuery, mode: 'insensitive' } },
              { macAddress: { contains: rawQuery, mode: 'insensitive' } },
              { description: { contains: rawQuery, mode: 'insensitive' } },
            ],
          },
          select: {
            id: true,
            name: true,
            label: true,
            macAddress: true,
            vlanId: true,
            deviceId: true,
            device: { select: { id: true, hostname: true, deviceCode: true } },
          },
          orderBy: { name: 'asc' },
          take: 5,
        })
      : Promise.resolve([]),
  ]);

  return NextResponse.json({
    query: rawQuery,
    results: {
      devices: devices.map((d) => ({
        id: d.id,
        deviceCode: d.deviceCode,
        hostname: d.hostname,
        serialNumber: d.serialNumber,
        inventoryStatus: d.inventoryStatus,
        archived: Boolean(d.archivedAt),
        categoryCode: d.category.code,
        categoryName: d.category.name,
        siteCode: d.site.siteCode,
        siteName: d.site.name,
        managementIp: d.ipAddresses[0]?.address ?? null,
      })),
      ipAddresses,
      subnets,
      sites,
      ports,
    },
  });
}
