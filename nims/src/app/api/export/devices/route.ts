import { prisma } from '@/lib/prisma';
import { requireApiPermission, getCurrentUser } from '@/lib/auth';
import { logAudit } from '@/lib/audit';
import { generateCsv } from '@/lib/csv';

export async function GET(req: Request) {
  // DoD T6.3: Verifikasi izin report.export
  const { user, errorResponse } = await requireApiPermission('report.export', req);
  if (errorResponse) {
    const currentUser = await getCurrentUser();
    if (currentUser) {
      await logAudit({
        userId: currentUser.id,
        action: 'ACCESS_DENIED',
        entityType: 'Device',
        beforeData: { attemptedAction: 'EXPORT_DEVICES', reason: 'Missing report.export permission' },
        req,
      });
    }
    return errorResponse;
  }

  const url = new URL(req.url);
  const q = url.searchParams.get('q')?.trim();
  const categoryId = url.searchParams.get('categoryId');
  const vendorId = url.searchParams.get('vendorId');
  const siteId = url.searchParams.get('siteId');
  const inventoryStatus = url.searchParams.get('inventoryStatus');
  const isArchived = url.searchParams.get('isArchived') === 'true';

  const where: any = {
    archivedAt: isArchived ? { not: null } : null,
  };

  if (categoryId) {
    const cid = parseInt(categoryId, 10);
    if (!isNaN(cid)) where.categoryId = cid;
  }

  if (vendorId) {
    const vid = parseInt(vendorId, 10);
    if (!isNaN(vid)) where.vendorId = vid;
  }

  if (siteId) {
    const sid = parseInt(siteId, 10);
    if (!isNaN(sid)) where.siteId = sid;
  }

  if (inventoryStatus) {
    where.inventoryStatus = inventoryStatus;
  }

  if (q) {
    where.OR = [
      { hostname: { contains: q, mode: 'insensitive' } },
      { deviceCode: { contains: q, mode: 'insensitive' } },
      { serialNumber: { contains: q, mode: 'insensitive' } },
    ];
  }

  const devices = await prisma.device.findMany({
    where,
    include: {
      category: true,
      vendor: true,
      model: true,
      site: true,
      room: true,
      rack: true,
      creator: { select: { name: true, username: true } },
      ipAddresses: {
        where: { purpose: 'management', allocationStatus: 'ALLOCATED' },
        select: { address: true },
      },
    },
    orderBy: { hostname: 'asc' },
  });

  const headers = [
    'ID Perangkat',
    'Kode Perangkat',
    'Hostname',
    'Kategori',
    'Vendor',
    'Model',
    'Serial Number',
    'Management IP',
    'Role Jaringan',
    'Site / Lokasi',
    'Ruangan',
    'Rak',
    'Status Inventaris',
    'Tim Penanggung Jawab',
    'Tanggal Pasang',
    'Garansi Berakhir',
    'Status Arsip',
    'Alasan Arsip',
    'Deskripsi / Catatan',
    'Dibuat Oleh',
    'Waktu Dibuat',
    'Waktu Diperbarui',
  ];

  const rows = devices.map((dev) => [
    dev.id,
    dev.deviceCode,
    dev.hostname,
    dev.category.name,
    dev.vendor.name,
    dev.model ? `${dev.model.modelName} (${dev.model.modelCode})` : '-',
    dev.serialNumber || '-',
    dev.ipAddresses[0]?.address || '-',
    dev.networkRole || '-',
    `${dev.site.siteCode} - ${dev.site.name}`,
    dev.room?.name || '-',
    dev.rack?.name || '-',
    dev.inventoryStatus,
    dev.ownerTeam || '-',
    dev.installedAt ? dev.installedAt.toISOString().split('T')[0] : '-',
    dev.warrantyExpiry ? dev.warrantyExpiry.toISOString().split('T')[0] : '-',
    dev.archivedAt ? 'TERARSIP' : 'AKTIF',
    dev.archiveReason || '-',
    dev.description || '-',
    dev.creator ? `${dev.creator.name} (@${dev.creator.username})` : 'System',
    dev.createdAt.toISOString(),
    dev.updatedAt.toISOString(),
  ]);

  // Generate CSV dengan formula injection defense (DoD T6.3)
  const csvContent = generateCsv(headers, rows);

  // Catat aktivitas ekspor di audit log (DoD T6.3)
  await logAudit({
    userId: user.id,
    action: 'EXPORT',
    entityType: 'Device',
    afterData: {
      format: 'csv',
      rowCount: devices.length,
      filter: { q, categoryId, vendorId, siteId, inventoryStatus, isArchived },
    },
    req,
  });

  const filename = `inventaris-perangkat-${isArchived ? 'arsip-' : ''}${new Date().toISOString().split('T')[0]}.csv`;

  return new Response(csvContent, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'no-store, no-cache, must-revalidate',
    },
  });
}
