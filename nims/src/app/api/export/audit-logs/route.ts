import { prisma } from '@/lib/prisma';
import { requireApiPermission, getCurrentUser, hasPermission } from '@/lib/auth';
import { logAudit } from '@/lib/audit';
import { generateCsv } from '@/lib/csv';
import { NextResponse } from 'next/server';

export async function GET(req: Request) {
  // DoD T6.3: Verifikasi izin report.export dan audit.view
  const { user, errorResponse } = await requireApiPermission('report.export', req);
  if (errorResponse) {
    const currentUser = await getCurrentUser();
    if (currentUser) {
      await logAudit({
        userId: currentUser.id,
        action: 'ACCESS_DENIED',
        entityType: 'AuditLog',
        beforeData: { attemptedAction: 'EXPORT_AUDIT_LOGS', reason: 'Missing report.export permission' },
        req,
      });
    }
    return errorResponse;
  }

  if (!hasPermission(user, 'audit.view')) {
    await logAudit({
      userId: user.id,
      action: 'ACCESS_DENIED',
      entityType: 'AuditLog',
      beforeData: { attemptedAction: 'EXPORT_AUDIT_LOGS', reason: 'Missing audit.view permission' },
      req,
    });
    return NextResponse.json({ message: 'Akses ditolak: Memerlukan izin audit.view' }, { status: 403 });
  }

  const url = new URL(req.url);
  const userId = url.searchParams.get('userId');
  const entityType = url.searchParams.get('entityType');
  const action = url.searchParams.get('action');
  const startDate = url.searchParams.get('startDate');
  const endDate = url.searchParams.get('endDate');
  const q = url.searchParams.get('q')?.trim();

  const where: any = {};

  if (userId) {
    const uid = parseInt(userId, 10);
    if (!isNaN(uid)) where.userId = uid;
  }

  if (entityType) where.entityType = entityType;
  if (action) where.action = action;

  if (startDate || endDate) {
    where.createdAt = {};
    if (startDate) where.createdAt.gte = new Date(startDate);
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      where.createdAt.lte = end;
    }
  }

  if (q) {
    where.OR = [
      { ipAddress: { contains: q, mode: 'insensitive' } },
      { user: { name: { contains: q, mode: 'insensitive' } } },
      { user: { username: { contains: q, mode: 'insensitive' } } },
      { entityType: { contains: q, mode: 'insensitive' } },
    ];
  }

  const logs = await prisma.auditLog.findMany({
    where,
    include: {
      user: { select: { name: true, username: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 5000,
  });

  const headers = [
    'Log ID',
    'Waktu',
    'Nama Pengguna',
    'Username',
    'Aksi',
    'Tipe Entitas',
    'Entity ID',
    'IP Address',
    'Data Sebelum',
    'Data Sesudah',
  ];

  const rows = logs.map((log) => [
    log.id,
    log.createdAt.toISOString(),
    log.user ? log.user.name : 'System',
    log.user ? log.user.username : '-',
    log.action,
    log.entityType,
    log.entityId ?? '-',
    log.ipAddress || '-',
    log.beforeData ? JSON.stringify(log.beforeData) : '-',
    log.afterData ? JSON.stringify(log.afterData) : '-',
  ]);

  const csvContent = generateCsv(headers, rows);

  await logAudit({
    userId: user.id,
    action: 'EXPORT',
    entityType: 'AuditLog',
    afterData: {
      format: 'csv',
      rowCount: logs.length,
      filter: { userId, entityType, action, startDate, endDate, q },
    },
    req,
  });

  const filename = `audit-logs-${new Date().toISOString().split('T')[0]}.csv`;

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
