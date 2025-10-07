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

export async function POST(request: NextRequest) {
    try {
        const { message, conversationHistory, useMemory = true } = await request.json();

        if (!message) {
            return NextResponse.json({ error: 'Message is required' }, { status: 400 });
        }

        const rag = getRAGService();
        const result = await rag.chatWithContext(
            message,
            conversationHistory || [],
            useMemory
        );

        return NextResponse.json({
            response: result.response,
            context: result.context,
        });
    } catch (error) {
        console.error('Chat API error:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Failed to process request' },
            { status: 500 }
        );
    }
}
