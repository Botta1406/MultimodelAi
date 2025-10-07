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

// Store new memory
export async function POST(request: NextRequest) {
    try {
        const { content, type, metadata } = await request.json();

        if (!content || !type) {
            return NextResponse.json(
                { error: 'Content and type are required' },
                { status: 400 }
            );
        }

        const rag = getRAGService();
        const id = await rag.storeMemory(content, type, metadata);

        return NextResponse.json({ id, success: true });
    } catch (error) {
        console.error('Memory POST error:', error);
        return NextResponse.json(
            {
                error:
                    error instanceof Error ? error.message : 'Failed to store memory',
            },
            { status: 500 }
        );
    }
}

// Clear all memories
export async function DELETE(request: NextRequest) {
    try {
        // Note: Vectorize doesn't support clearing all vectors via API
        // You would need to delete and recreate the index
        return NextResponse.json({
            success: true,
            message: 'Memory clearing not fully supported. Please recreate the index via wrangler.'
        });
    } catch (error) {
        console.error('Memory DELETE error:', error);
        return NextResponse.json(
            {
                error:
                    error instanceof Error ? error.message : 'Failed to clear memories',
            },
            { status: 500 }
        );
    }
}
