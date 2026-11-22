import path from 'node:path';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireApiPermission, getCurrentUser } from '@/lib/auth';
import { logAudit } from '@/lib/audit';
import { readDocumentFile } from '@/lib/document-storage';

const INLINE_IMAGE_EXTS = new Map<string, string>([
  ['.png', 'image/png'],
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.webp', 'image/webp'],
]);

const INLINE_TEXT_EXTS = new Set(['.txt', '.log', '.cfg', '.conf', '.csv']);

export async function GET(
  req: Request,
  props: { params: Promise<{ id: string }> }
) {
  const params = await props.params;
  const docId = parseInt(params.id, 10);
  if (isNaN(docId)) {
    return NextResponse.json({ error: 'ID dokumen tidak valid.' }, { status: 400 });
  }

  // DoD T5.3: Cek permission document.view. User tanpa izin -> 403 & tercatat di audit
  const { user, errorResponse } = await requireApiPermission('document.view', req);
  if (errorResponse) {
    const currentUser = await getCurrentUser();
    if (currentUser) {
      await logAudit({
        userId: currentUser.id,
        action: 'ACCESS_DENIED',
        entityType: 'Document',
        entityId: docId,
        beforeData: { attemptedAction: 'DOWNLOAD_DOCUMENT', reason: 'Missing document.view permission' },
        req,
      });
    }
    return errorResponse;
  }

  const document = await prisma.document.findUnique({
    where: { id: docId },
  });

  if (!document) {
    return NextResponse.json({ error: 'Dokumen tidak ditemukan.' }, { status: 404 });
  }

  try {
    const fileBuffer = await readDocumentFile(document.storageKey);
    const { searchParams } = new URL(req.url);
    const wantsInline = searchParams.get('inline') === '1' || searchParams.get('inline') === 'true';
    const ext = path.extname(document.originalFilename).toLowerCase();

    let disposition: 'inline' | 'attachment' = 'attachment';
    let responseContentType = document.mimeType || 'application/octet-stream';

    if (wantsInline) {
      if (ext === '.pdf') {
        disposition = 'inline';
        responseContentType = 'application/pdf';
      } else if (INLINE_IMAGE_EXTS.has(ext)) {
        disposition = 'inline';
        responseContentType = INLINE_IMAGE_EXTS.get(ext)!;
      } else if (INLINE_TEXT_EXTS.has(ext)) {
        disposition = 'inline';
        responseContentType = 'text/plain; charset=utf-8';
      }
    }

    // Audit log pengunduhan/pratinjau dokumen (DoD T5.3)
    await logAudit({
      userId: user.id,
      action: 'DOWNLOAD_DOCUMENT',
      entityType: 'Document',
      entityId: document.id,
      afterData: {
        originalFilename: document.originalFilename,
        fileSize: document.fileSize,
        checksum: document.checksum,
        deviceId: document.deviceId,
        preview: disposition === 'inline',
      },
      req,
    });

    // Format nama file yang aman untuk header Content-Disposition
    const safeFilename = encodeURIComponent(document.originalFilename);

    return new Response(new Uint8Array(fileBuffer), {
      status: 200,
      headers: {
        // DoD T5.2: X-Content-Type-Options: nosniff + inline hanya untuk tipe aman (image/pdf/text)
        'Content-Type': responseContentType,
        'Content-Disposition': `${disposition}; filename="${safeFilename}"; filename*=UTF-8''${safeFilename}`,
        'X-Content-Type-Options': 'nosniff',
        'Content-Length': document.fileSize.toString(),
        'Cache-Control': 'private, no-cache, no-store, must-revalidate',
      },
    });
  } catch (error: unknown) {
    console.error(`Gagal membaca berkas ${document.storageKey}:`, error);
    return NextResponse.json(
      { error: 'Berkas fisik dokumen tidak ditemukan di media penyimpanan privat.' },
      { status: 404 }
    );
  }
}
