import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireApiPermission } from '@/lib/auth';
import { parseDeviceCsv, validateDeviceRows, LookupData } from '@/lib/device-import';

export async function POST(req: Request) {
  const { errorResponse } = await requireApiPermission('device.create', req);
  if (errorResponse) return errorResponse;

  let csvText = '';
  const contentType = req.headers.get('content-type') || '';

  if (contentType.includes('multipart/form-data')) {
    const formData = await req.formData().catch(() => null);
    if (!formData) {
      return NextResponse.json({ message: 'Gagal memproses form-data' }, { status: 400 });
    }
    const file = formData.get('file');
    if (!file || typeof file === 'string') {
      return NextResponse.json({ message: 'Berkas CSV tidak ditemukan dalam unggahan' }, { status: 400 });
    }
    const blob = file as Blob;
    csvText = await blob.text();
  } else {
    const body = await req.json().catch(() => null);
    if (!body || typeof body.csvText !== 'string') {
      return NextResponse.json({ message: 'Payload csvText wajib disertakan' }, { status: 400 });
    }
    csvText = body.csvText;
  }

  const { headers, rows, headerError } = parseDeviceCsv(csvText);
  if (headerError) {
    return NextResponse.json({ message: headerError }, { status: 400 });
  }

  // Load lookup data
  const [existingDevices, categories, vendors, sites] = await Promise.all([
    prisma.device.findMany({ select: { deviceCode: true } }),
    prisma.deviceCategory.findMany({ select: { id: true, code: true, name: true } }),
    prisma.vendor.findMany({ select: { id: true, name: true } }),
    prisma.site.findMany({ select: { id: true, siteCode: true, name: true } }),
  ]);

  const existingCodes = new Set<string>(existingDevices.map((d) => d.deviceCode.toUpperCase()));

  const lookups: LookupData = {
    existingCodes,
    categories,
    vendors,
    sites,
  };

  const { validRows, errors } = validateDeviceRows(rows, lookups);

  return NextResponse.json({
    success: true,
    headers,
    totalRows: rows.length,
    validCount: validRows.length,
    invalidCount: errors.length,
    errors,
    previewRows: validRows,
  });
}
