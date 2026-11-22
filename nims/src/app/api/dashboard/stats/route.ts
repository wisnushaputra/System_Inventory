import { NextResponse } from 'next/server';
import { requireApiPermission } from '@/lib/auth';
import { getDashboardStats } from '@/lib/dashboard-stats';

export async function GET(req: Request) {
  const { errorResponse } = await requireApiPermission('dashboard.view', req);
  if (errorResponse) return errorResponse;

  try {
    const stats = await getDashboardStats();
    return NextResponse.json(stats);
  } catch (error: unknown) {
    console.error('Error saat mengambil statistik dashboard:', error);
    return NextResponse.json({ error: 'Gagal memuat statistik dashboard.' }, { status: 500 });
  }
}
