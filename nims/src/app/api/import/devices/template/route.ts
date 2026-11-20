import { NextResponse } from 'next/server';
import { requireApiPermission } from '@/lib/auth';
import { CSV_TEMPLATE_CONTENT } from '@/lib/device-import';

export async function GET() {
  const { errorResponse } = await requireApiPermission('device.view');
  if (errorResponse) return errorResponse;

  // UTF-8 BOM prefix for Excel / LibreOffice compatibility
  const BOM = '\uFEFF';
  const csvWithBom = BOM + CSV_TEMPLATE_CONTENT;

  return new NextResponse(csvWithBom, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="template-impor-perangkat.csv"',
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'no-store, max-age=0',
    },
  });
}
