import { hash } from 'bcryptjs';
import { NextResponse } from 'next/server';
import { getPrismaClient } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

type RegisterInput = {
  username: string;
  password: string;
};

function parseRegisterInput(value: unknown): { data?: RegisterInput; error?: string } {
  if (!value || typeof value !== 'object') {
    return { error: 'Invalid JSON body.' };
  }

  const candidate = value as Partial<RegisterInput>;

  if (typeof candidate.username !== 'string') {
    return { error: 'username is required.' };
  }

  const normalizedUsername = candidate.username.trim().toLowerCase();
  const usernamePattern = /^[a-z0-9._-]+$/;

  if (normalizedUsername.length < 3 || normalizedUsername.length > 32 || !usernamePattern.test(normalizedUsername)) {
    return { error: 'username must be 3-32 chars and can only contain a-z, 0-9, ".", "_" and "-".' };
  }

  if (typeof candidate.password !== 'string' || candidate.password.length < 6) {
    return { error: 'password must be at least 6 characters.' };
  }

  return {
    data: {
      username: normalizedUsername,
      password: candidate.password,
    },
  };
}

function isUniqueConstraintError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  return 'code' in error && error.code === 'P2002';
}

export async function POST(request: Request) {
  let rawBody: unknown;

  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const parsed = parseRegisterInput(rawBody);

  if (!parsed.data) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  try {
    const prisma = getPrismaClient();
    const passwordHash = await hash(parsed.data.password, 12);

    const user = await prisma.user.create({
      data: {
        username: parsed.data.username,
        passwordHash,
      },
      select: {
        id: true,
        username: true,
      },
    });

    return NextResponse.json(
      {
        success: true,
        user,
      },
      { status: 201 },
    );
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return NextResponse.json({ error: 'Username already exists.' }, { status: 409 });
    }

    console.error('Register API Error:', error);
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }
}
