import { NextRequest, NextResponse } from 'next/server';
import { RAGService } from '@/lib/rag-service';

export const runtime = 'edge';

let ragService: RAGService | null = null;

function getRAGService() {
    if (!ragService) {
        const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
        const apiToken = process.env.CLOUDFLARE_API_TOKEN;

        if (!accountId || !apiToken) {
            throw new Error('Missing Cloudflare credentials');
        }

        ragService = new RAGService(accountId, apiToken);
    }
    return ragService;
}

export async function GET(request: NextRequest) {
    try {
        const rag = getRAGService();
        const stats = await rag.getStats();

        return NextResponse.json(stats);
    } catch (error) {
        console.error('Stats API error:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Failed to fetch stats' },
            { status: 500 }
        );
    }
}
