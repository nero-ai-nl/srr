import { NextResponse } from 'next/server';
import { getPrismaClient } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

type RecordInput = {
    chakra: string;
    time: number;
};

type SessionInput = {
    totalDuration: number;
    userType: 'GUEST' | 'USER';
    userId?: string | null;
    records: RecordInput[];
};

function isRecordInput(value: unknown): value is RecordInput {
    if (!value || typeof value !== 'object') return false;
    const candidate = value as Partial<RecordInput>;
    return (
        typeof candidate.chakra === 'string' &&
        candidate.chakra.trim().length > 0 &&
        typeof candidate.time === 'number' &&
        Number.isInteger(candidate.time) &&
        candidate.time >= 0
    );
}

function parseSessionInput(value: unknown): { data?: SessionInput; error?: string } {
    if (!value || typeof value !== 'object') {
        return { error: 'Invalid JSON body.' };
    }

    const candidate = value as Partial<SessionInput>;

    if (
        typeof candidate.totalDuration !== 'number' ||
        !Number.isInteger(candidate.totalDuration) ||
        candidate.totalDuration < 0
    ) {
        return { error: 'totalDuration must be a positive integer or zero.' };
    }

    if (candidate.userType !== 'GUEST' && candidate.userType !== 'USER') {
        return { error: 'userType must be GUEST or USER.' };
    }

    if (candidate.userType === 'USER' && (!candidate.userId || typeof candidate.userId !== 'string')) {
        return { error: 'userId is required when userType is USER.' };
    }

    if (!Array.isArray(candidate.records) || candidate.records.length === 0) {
        return { error: 'records must be a non-empty array.' };
    }

    if (!candidate.records.every(isRecordInput)) {
        return { error: 'Each record must contain a chakra (string) and time (integer >= 0).' };
    }

    return { data: candidate as SessionInput };
}

export async function POST(request: Request) {
    let rawBody: unknown;

    try {
        rawBody = await request.json();
    } catch {
        return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
    }

    try {
        const prisma = getPrismaClient();
        const parsed = parseSessionInput(rawBody);

        if (!parsed.data) {
            return NextResponse.json({ error: parsed.error }, { status: 400 });
        }

        const { totalDuration, userType, userId, records } = parsed.data;

        const session = await prisma.session.create({
            data: {
                totalDuration,
                userType,
                userId: userType === 'USER' ? userId : null,
                records: {
                    create: records.map((record) => ({
                        chakra: record.chakra,
                        seconds: record.time,
                    })),
                },
            },
            include: {
                records: true,
            },
        });

        return NextResponse.json({ success: true, session }, { status: 201 });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        const lowered = message.toLowerCase();
        const errorCode =
            typeof error === 'object' &&
            error !== null &&
            'code' in error &&
            typeof (error as { code?: unknown }).code === 'string'
                ? (error as { code: string }).code
                : undefined;
        console.error('API Error:', error);

        const sanitizedMessage = message
            .replace(/postgresql:\/\/[^@]+@/gi, 'postgresql://***:***@')
            .replace(/password=[^&\s]+/gi, 'password=***');

        if (lowered.includes('database_url is not set')) {
            return NextResponse.json(
                { error: 'Server config error: DATABASE_URL ontbreekt.', code: 'MISSING_DATABASE_URL' },
                { status: 500 },
            );
        }

        if (
            errorCode === 'P1001' ||
            lowered.includes('can\'t reach database server') ||
            lowered.includes('enotfound') ||
            lowered.includes('econnrefused') ||
            lowered.includes('timeout')
        ) {
            return NextResponse.json(
                { error: 'Database connection failed. Controleer host/poort/ssl en Neon status.', code: 'DB_CONNECT_FAILED' },
                { status: 500 },
            );
        }

        if (
            errorCode === 'P1000' ||
            lowered.includes('password authentication failed') ||
            lowered.includes('sasl') ||
            lowered.includes('channel binding')
        ) {
            return NextResponse.json(
                { error: 'Database authentication failed. Controleer credentials en query params.', code: 'DB_AUTH_FAILED' },
                { status: 500 },
            );
        }

        if (
            errorCode === 'P2021' ||
            lowered.includes('does not exist in the current database') ||
            lowered.includes('relation') && lowered.includes('does not exist')
        ) {
            return NextResponse.json(
                {
                    error: 'Database schema ontbreekt of is onvolledig. Voer prisma migrate deploy uit tegen de productie-DB.',
                    code: 'DB_SCHEMA_MISSING',
                    detail: sanitizedMessage,
                },
                { status: 500 },
            );
        }

        return NextResponse.json(
            { error: 'Database error', code: 'DB_RUNTIME_ERROR', detail: sanitizedMessage },
            { status: 500 },
        );
    }
}
