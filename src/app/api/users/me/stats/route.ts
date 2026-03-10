import { NextResponse } from 'next/server';
import { getPrismaClient } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

function isMissingDefaultRetentionColumnError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;

  const code = 'code' in error ? error.code : undefined;
  if (code !== 'P2022') return false;

  const meta = 'meta' in error ? error.meta : undefined;
  const column = meta && typeof meta === 'object' && 'column' in meta ? meta.column : undefined;
  return typeof column === 'string' && column.includes('defaultMaxRetentionSeconds');
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('userId');

  if (!userId) {
    return NextResponse.json({ error: 'userId is required.' }, { status: 400 });
  }

  try {
    const prisma = getPrismaClient();
    let user:
      | {
          id: string;
          username: string;
          displayName: string | null;
          defaultMaxRetentionSeconds: number | null;
        }
      | null = null;

    try {
      user = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, username: true, displayName: true, defaultMaxRetentionSeconds: true },
      });
    } catch (error) {
      if (!isMissingDefaultRetentionColumnError(error)) {
        throw error;
      }

      const fallbackUser = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, username: true, displayName: true },
      });

      user = fallbackUser
        ? { ...fallbackUser, defaultMaxRetentionSeconds: null }
        : null;
    }

    if (!user) {
      return NextResponse.json({ error: 'User not found.' }, { status: 404 });
    }

    const sessions = await prisma.session.findMany({
      where: { userId: user.id },
      include: { records: true },
      orderBy: { createdAt: 'desc' },
    });

    const sessionCount = sessions.length;
    const totalDuration = sessions.reduce((sum, session) => sum + (session.totalDuration ?? 0), 0);
    const averageDuration = sessionCount > 0 ? Math.round(totalDuration / sessionCount) : 0;
    const bestRetention = sessions.reduce((maxValue, session) => {
      const perSessionMax = session.records.reduce((sessionMax, record) => Math.max(sessionMax, record.seconds), 0);
      return Math.max(maxValue, perSessionMax);
    }, 0);

    return NextResponse.json({
      success: true,
      user,
      stats: {
        sessionCount,
        totalDuration,
        averageDuration,
        bestRetention,
        lastSessionAt: sessions[0]?.createdAt ?? null,
        recentSessions: sessions.slice(0, 5).map((session) => ({
          id: session.id,
          createdAt: session.createdAt,
          totalDuration: session.totalDuration ?? 0,
          totalRetention: session.records.reduce((sum, record) => sum + record.seconds, 0),
          records: session.records
            .map((record) => ({
              chakra: record.chakra,
              seconds: record.seconds,
            }))
            .sort((a, b) => a.chakra.localeCompare(b.chakra)),
        })),
      },
    });
  } catch (error) {
    console.error('User stats API Error:', error);
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }
}
