import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser, hasPermission } from '@/lib/auth';
import { logAudit } from '@/lib/audit';
import { deleteDocumentFile } from '@/lib/document-storage';

export async function GET(
  req: Request,
  props: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ message: 'Autentikasi diperlukan' }, { status: 401 });
  }

  if (!hasPermission(user, 'document.view')) {
    await logAudit({
      userId: user.id,
      action: 'ACCESS_DENIED',
      entityType: 'Document',
      beforeData: { attemptedAction: 'GET_DOCUMENT_DETAIL', reason: 'Missing document.view permission' },
      req,
    });
    return NextResponse.json({ message: 'Akses ditolak: Memerlukan izin document.view' }, { status: 403 });
  }

  const params = await props.params;
  const docId = parseInt(params.id, 10);
  if (isNaN(docId)) {
    return NextResponse.json({ error: 'ID dokumen tidak valid.' }, { status: 400 });
  }

  const document = await prisma.document.findUnique({
    where: { id: docId },
    include: {
      uploader: { select: { id: true, name: true, username: true } },
      device: { select: { id: true, hostname: true, deviceCode: true } },
    },
  });

  if (!document) {
    return NextResponse.json({ error: 'Dokumen tidak ditemukan.' }, { status: 404 });
  }

  return NextResponse.json({ document });
}

export async function DELETE(
  req: Request,
  props: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ message: 'Autentikasi diperlukan' }, { status: 401 });
  }

  if (!hasPermission(user, 'document.upload') && !hasPermission(user, 'device.update')) {
    await logAudit({
      userId: user.id,
      action: 'ACCESS_DENIED',
      entityType: 'Document',
      beforeData: { attemptedAction: 'DELETE_DOCUMENT', reason: 'Missing document.upload or device.update permission' },
      req,
    });
    return NextResponse.json({ message: 'Akses ditolak: Tidak memiliki izin menghapus dokumen.' }, { status: 403 });
  }

  const params = await props.params;
  const docId = parseInt(params.id, 10);
  if (isNaN(docId)) {
    return NextResponse.json({ error: 'ID dokumen tidak valid.' }, { status: 400 });
  }

  const document = await prisma.document.findUnique({
    where: { id: docId },
  });

  if (!document) {
    return NextResponse.json({ error: 'Dokumen tidak ditemukan.' }, { status: 404 });
  }

  // Hapus berkas fisik di disk privat
  await deleteDocumentFile(document.storageKey);

  // Hapus dari database
  await prisma.document.delete({
    where: { id: docId },
  });

  await logAudit({
    userId: user.id,
    action: 'DELETE_DOCUMENT',
    entityType: 'Document',
    entityId: docId,
    beforeData: {
      originalFilename: document.originalFilename,
      fileSize: document.fileSize,
      checksum: document.checksum,
      deviceId: document.deviceId,
      storageKey: document.storageKey,
    },
    req,
  });

  return NextResponse.json({ success: true, message: 'Dokumen berhasil dihapus.' });
}
