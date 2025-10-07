import { NextRequest, NextResponse } from 'next/server';
import { CloudflareAI } from '@/lib/cloudflare-ai';

export const runtime = 'edge';

export async function POST(request: NextRequest) {
    try {
        const { text } = await request.json();

        const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
        const apiToken = process.env.CLOUDFLARE_API_TOKEN;

        if (!accountId || !apiToken) {
            return NextResponse.json(
                { error: 'Missing credentials' },
                { status: 500 }
            );
        }

        const ai = new CloudflareAI(accountId, apiToken);
        const embedding = await ai.generateEmbedding(text || 'test');

        return NextResponse.json({
            success: true,
            embeddingLength: embedding.length,
            firstValues: embedding.slice(0, 5),
        });
    } catch (error) {
        return NextResponse.json({
            error: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 });
    }
}
