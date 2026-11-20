import { Metadata } from 'next';
import { requirePermission } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import DeviceImportClient from './DeviceImportClient';

export const metadata: Metadata = {
  title: 'Impor Perangkat CSV | NIMS',
  description: 'Impor data massal perangkat jaringan menggunakan berkas CSV',
};

export default async function DeviceImportPage() {
  await requirePermission('device.create');

  const [categories, vendors, sites] = await Promise.all([
    prisma.deviceCategory.findMany({
      select: { code: true, name: true },
      orderBy: { name: 'asc' },
    }),
    prisma.vendor.findMany({
      select: { name: true },
      orderBy: { name: 'asc' },
    }),
    prisma.site.findMany({
      select: { siteCode: true, name: true },
      orderBy: { name: 'asc' },
    }),
  ]);

  return (
    <DeviceImportClient
      categories={categories}
      vendors={vendors}
      sites={sites}
    />
  );
}
