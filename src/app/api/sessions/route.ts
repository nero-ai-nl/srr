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

        const { totalDuration, userType, records } = parsed.data;

        const session = await prisma.session.create({
            data: {
                totalDuration,
                userType,
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
        console.error("API Error:", error);
        return NextResponse.json({ error: "Database error" }, { status: 500 });
    }
}
