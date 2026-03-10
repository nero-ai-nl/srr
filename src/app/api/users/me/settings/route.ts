import { NextResponse } from 'next/server';
import { getPrismaClient } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

type SettingsInput = {
  userId: string;
  defaultMaxRetentionSeconds: number | null;
};

function parseSettingsInput(value: unknown): { data?: SettingsInput; error?: string } {
  if (!value || typeof value !== 'object') {
    return { error: 'Invalid JSON body.' };
  }

  const candidate = value as Partial<SettingsInput>;

  if (typeof candidate.userId !== 'string' || candidate.userId.trim().length === 0) {
    return { error: 'userId is required.' };
  }

  if (candidate.defaultMaxRetentionSeconds === null) {
    return {
      data: {
        userId: candidate.userId,
        defaultMaxRetentionSeconds: null,
      },
    };
  }

  if (
    typeof candidate.defaultMaxRetentionSeconds !== 'number'
    || !Number.isInteger(candidate.defaultMaxRetentionSeconds)
    || candidate.defaultMaxRetentionSeconds < 5
    || candidate.defaultMaxRetentionSeconds > 600
  ) {
    return { error: 'defaultMaxRetentionSeconds must be null or an integer between 5 and 600.' };
  }

  return {
    data: {
      userId: candidate.userId,
      defaultMaxRetentionSeconds: candidate.defaultMaxRetentionSeconds,
    },
  };
}

function isMissingDefaultRetentionColumnError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;

  const code = 'code' in error ? error.code : undefined;
  if (code !== 'P2022') return false;

  const meta = 'meta' in error ? error.meta : undefined;
  const column = meta && typeof meta === 'object' && 'column' in meta ? meta.column : undefined;
  return typeof column === 'string' && column.includes('defaultMaxRetentionSeconds');
}

export async function PATCH(request: Request) {
  let rawBody: unknown;

  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const parsed = parseSettingsInput(rawBody);

  if (!parsed.data) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  try {
    const prisma = getPrismaClient();
    const existingUser = await prisma.user.findUnique({
      where: { id: parsed.data.userId },
      select: { id: true },
    });

    if (!existingUser) {
      return NextResponse.json({ error: 'User not found.' }, { status: 404 });
    }

    const updatedUser = await prisma.user.update({
      where: { id: parsed.data.userId },
      data: {
        defaultMaxRetentionSeconds: parsed.data.defaultMaxRetentionSeconds,
      },
      select: {
        id: true,
        defaultMaxRetentionSeconds: true,
      },
    });

    return NextResponse.json(
      {
        success: true,
        settings: {
          defaultMaxRetentionSeconds: updatedUser.defaultMaxRetentionSeconds,
        },
      },
      { status: 200 },
    );
  } catch (error) {
    if (isMissingDefaultRetentionColumnError(error)) {
      return NextResponse.json(
        {
          error: 'Database schema is nog niet gemigreerd voor defaultMaxRetentionSeconds.',
          code: 'MIGRATION_REQUIRED',
          detail: 'Voer Prisma migraties uit (bijv. prisma migrate deploy) en probeer opnieuw.',
        },
        { status: 503 },
      );
    }

    console.error('User settings API Error:', error);
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }
}
