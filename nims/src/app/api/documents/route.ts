import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireApiPermission, getCurrentUser } from '@/lib/auth';
import { logAudit } from '@/lib/audit';
import { validateFileMetadata, saveDocumentFile } from '@/lib/document-storage';

export async function GET(req: Request) {
  const { user, errorResponse } = await requireApiPermission('document.view', req);
  if (errorResponse) {
    const currentUser = await getCurrentUser();
    if (currentUser) {
      await logAudit({
        userId: currentUser.id,
        action: 'ACCESS_DENIED',
        entityType: 'Document',
        beforeData: { attemptedAction: 'VIEW_DOCUMENT_LIST', reason: 'Missing document.view permission' },
        req,
      });
    }
    return errorResponse;
  }

  const { searchParams } = new URL(req.url);
  const deviceId = searchParams.get('deviceId');
  const category = searchParams.get('category');
  const includeArchived = searchParams.get('archived') === 'true';

  const where: any = {};
  if (!includeArchived) {
    where.archivedAt = null;
  }
  if (deviceId) {
    const parsedDeviceId = parseInt(deviceId, 10);
    if (!isNaN(parsedDeviceId)) {
      where.deviceId = parsedDeviceId;
    }
  }
  if (category) {
    where.category = category;
  }

  const documents = await prisma.document.findMany({
    where,
    include: {
      uploader: { select: { id: true, name: true, username: true } },
      device: { select: { id: true, hostname: true, deviceCode: true } },
    },
    orderBy: { uploadedAt: 'desc' },
  });

  return NextResponse.json({ documents });
}

export async function POST(req: Request) {
  const { user, errorResponse } = await requireApiPermission('document.upload', req);
  if (errorResponse) {
    const currentUser = await getCurrentUser();
    if (currentUser) {
      await logAudit({
        userId: currentUser.id,
        action: 'ACCESS_DENIED',
        entityType: 'Document',
        beforeData: { attemptedAction: 'UPLOAD_DOCUMENT', reason: 'Missing document.upload permission' },
        req,
      });
    }
    return errorResponse;
  }

  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const deviceIdStr = formData.get('deviceId') as string | null;
    const category = (formData.get('category') as string) || 'other';
    const sensitivityLevel = (formData.get('sensitivityLevel') as string) || 'internal';
    const description = (formData.get('description') as string | null)?.trim() || null;

    if (!file || typeof file === 'string') {
      return NextResponse.json({ error: 'Berkas file wajib diunggah.' }, { status: 400 });
    }

    let parsedDeviceId: number | null = null;
    if (deviceIdStr) {
      parsedDeviceId = parseInt(deviceIdStr, 10);
      if (isNaN(parsedDeviceId)) {
        return NextResponse.json({ error: 'ID perangkat tidak valid.' }, { status: 400 });
      }

      const device = await prisma.device.findUnique({ where: { id: parsedDeviceId } });
      if (!device) {
        return NextResponse.json({ error: 'Perangkat tidak ditemukan.' }, { status: 404 });
      }
    }

    // Validasi tipe file, ekstensi, MIME, dan ukuran maksimum (DoD T5.1 & T5.2)
    const validation = validateFileMetadata(file.name, file.type, file.size);
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Simpan ke private storage (di luar public) dan hitung checksum SHA-256
    const { storageKey, checksum, fileSize } = await saveDocumentFile(buffer, file.name);

    const doc = await prisma.document.create({
      data: {
        deviceId: parsedDeviceId,
        storageKey,
        originalFilename: file.name,
        mimeType: file.type || 'application/octet-stream',
        fileSize,
        checksum,
        category,
        sensitivityLevel,
        description,
        uploadedBy: user.id,
      },
      include: {
        uploader: { select: { id: true, name: true, username: true } },
      },
    });

    await logAudit({
      userId: user.id,
      action: 'UPLOAD_DOCUMENT',
      entityType: 'Document',
      entityId: doc.id,
      afterData: {
        originalFilename: doc.originalFilename,
        fileSize: doc.fileSize,
        checksum: doc.checksum,
        category: doc.category,
        deviceId: doc.deviceId,
        storageKey: doc.storageKey,
      },
      req,
    });

    return NextResponse.json(
      {
        message: 'Dokumen berhasil diunggah.',
        document: {
          id: doc.id,
          deviceId: doc.deviceId,
          originalFilename: doc.originalFilename,
          mimeType: doc.mimeType,
          fileSize: doc.fileSize,
          checksum: doc.checksum,
          category: doc.category,
          sensitivityLevel: doc.sensitivityLevel,
          description: doc.description,
          uploadedAt: doc.uploadedAt,
          uploader: doc.uploader,
        },
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('Error saat upload dokumen:', error);
    return NextResponse.json(
      { error: 'Terjadi kesalahan sistem saat memproses unggahan dokumen.' },
      { status: 500 }
    );
  }
}
