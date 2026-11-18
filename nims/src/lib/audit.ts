import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';

export type AuditAction = 'CREATE' | 'UPDATE' | 'DELETE' | 'ARCHIVE' | 'RESTORE' | 'LOGIN' | 'LOGOUT' | 'EXPORT';

export interface AuditLogOptions {
  userId?: number | null;
  action: AuditAction;
  entityType: string;
  entityId?: number | null;
  beforeData?: unknown;
  afterData?: unknown;
  req?: Request;
}

const SENSITIVE_FIELDS = ['password', 'passwordHash', 'token', 'secret'];

function sanitizeData(data: unknown): unknown {
  if (!data || typeof data !== 'object') return data;
  if (Array.isArray(data)) return data.map(sanitizeData);
  const clean: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(data as Record<string, unknown>)) {
    if (SENSITIVE_FIELDS.includes(key)) {
      clean[key] = '[REDACTED]';
    } else if (val instanceof Date) {
      clean[key] = val.toISOString();
    } else if (typeof val === 'object' && val !== null) {
      clean[key] = sanitizeData(val);
    } else {
      clean[key] = val;
    }
  }
  return clean;
}

export async function logAudit(options: AuditLogOptions) {
  try {
    let ipAddress: string | null = null;
    let userAgent: string | null = null;

    if (options.req) {
      ipAddress =
        options.req.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
        options.req.headers.get('x-real-ip') ||
        null;
      userAgent = options.req.headers.get('user-agent') || null;
    }

    return await prisma.auditLog.create({
      data: {
        userId: options.userId ?? null,
        action: options.action,
        entityType: options.entityType,
        entityId: options.entityId ?? null,
        beforeData: options.beforeData ? (sanitizeData(options.beforeData) as Prisma.InputJsonValue) : Prisma.JsonNull,
        afterData: options.afterData ? (sanitizeData(options.afterData) as Prisma.InputJsonValue) : Prisma.JsonNull,
        ipAddress,
        userAgent,
      },
    });
  } catch (error) {
    console.error('Failed to create audit log:', error);
    return null;
  }
}
