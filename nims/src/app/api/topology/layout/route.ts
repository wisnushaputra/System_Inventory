import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireApiPermission } from '@/lib/auth';

export async function GET(req: Request) {
  const { user, errorResponse } = await requireApiPermission('topology.view', req);
  if (errorResponse) return errorResponse;

  const url = new URL(req.url);
  const scope = url.searchParams.get('scope') || 'default';

  const layout = await prisma.topologyLayout.findUnique({
    where: {
      userId_scope: {
        userId: user.id,
        scope,
      },
    },
  });

  return NextResponse.json({
    scope,
    positions: layout?.positions || {},
  });
}

export async function POST(req: Request) {
  const { user, errorResponse } = await requireApiPermission('topology.view', req);
  if (errorResponse) return errorResponse;

  try {
    const body = await req.json();
    const scope = body.scope || 'default';
    const positions = body.positions;

    if (!positions || typeof positions !== 'object') {
      return NextResponse.json({ error: 'Data posisi tidak valid.' }, { status: 400 });
    }

    const saved = await prisma.topologyLayout.upsert({
      where: {
        userId_scope: {
          userId: user.id,
          scope,
        },
      },
      update: {
        positions,
      },
      create: {
        userId: user.id,
        scope,
        positions,
      },
    });

    return NextResponse.json({
      message: 'Tata letak topologi berhasil disimpan.',
      scope: saved.scope,
    });
  } catch (error: any) {
    console.error('Error saat menyimpan layout topologi:', error);
    return NextResponse.json({ error: 'Gagal menyimpan layout topologi.' }, { status: 500 });
  }
}
