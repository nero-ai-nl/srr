import { compare } from 'bcryptjs';
import { NextResponse } from 'next/server';
import { getPrismaClient } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

type LoginInput = {
  username: string;
  password: string;
};

function parseLoginInput(value: unknown): { data?: LoginInput; error?: string } {
  if (!value || typeof value !== 'object') {
    return { error: 'Invalid JSON body.' };
  }

  const candidate = value as Partial<LoginInput>;

  if (typeof candidate.username !== 'string' || candidate.username.trim().length < 3) {
    return { error: 'username must be at least 3 characters.' };
  }

  if (typeof candidate.password !== 'string' || candidate.password.length < 6) {
    return { error: 'password must be at least 6 characters.' };
  }

  return {
    data: {
      username: candidate.username.trim().toLowerCase(),
      password: candidate.password,
    },
  };
}

export async function POST(request: Request) {
  let rawBody: unknown;

  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const parsed = parseLoginInput(rawBody);

  if (!parsed.data) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  try {
    const prisma = getPrismaClient();
    const user = await prisma.user.findUnique({
      where: { username: parsed.data.username },
    });

    if (!user) {
      return NextResponse.json({ error: 'Invalid credentials.' }, { status: 401 });
    }

    const passwordOk = await compare(parsed.data.password, user.passwordHash);
    if (!passwordOk) {
      return NextResponse.json({ error: 'Invalid credentials.' }, { status: 401 });
    }

    return NextResponse.json(
      {
        success: true,
        user: {
          id: user.id,
          username: user.username,
          displayName: user.displayName,
        },
      },
      { status: 200 },
    );
  } catch (error) {
    console.error('Login API Error:', error);
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }
}
