import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireApiPermission, getCurrentUser } from '@/lib/auth';
import { logAudit } from '@/lib/audit';

export async function GET(req: Request) {
  // DoD T6.2: Verifikasi izin audit.view
  const { user, errorResponse } = await requireApiPermission('audit.view', req);
  if (errorResponse) {
    const currentUser = await getCurrentUser();
    if (currentUser) {
      await logAudit({
        userId: currentUser.id,
        action: 'ACCESS_DENIED',
        entityType: 'AuditLog',
        beforeData: { attemptedAction: 'VIEW_AUDIT_LOGS', reason: 'Missing audit.view permission' },
        req,
      });
    }
    return errorResponse;
  }

  const url = new URL(req.url);
  const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
  const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') || '20', 10)));
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

  if (entityType) {
    where.entityType = entityType;
  }

  if (action) {
    where.action = action;
  }

  if (startDate || endDate) {
    where.createdAt = {};
    if (startDate) {
      where.createdAt.gte = new Date(startDate);
    }
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

  const [total, data] = await Promise.all([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({
      where,
      include: {
        user: { select: { id: true, name: true, username: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
  ]);

  return NextResponse.json({
    data,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    },
  });
}
