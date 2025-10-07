import { CloudflareAI } from './cloudflare-ai';
import { VectorizeService } from './vectorize-service';

export type MemoryType = 'text' | 'image' | 'video' | 'audio' | 'general';

export interface Memory {
    id: string;
    text: string;
    type: MemoryType;
    metadata: Record<string, any>;
    score?: number;
}

export class RAGService {
    private ai: CloudflareAI;
    private vectorize: VectorizeService;
    private publicUrl?: string;

    constructor(accountId: string, apiToken: string, publicUrl?: string) {
        this.ai = new CloudflareAI(accountId, apiToken);
        this.vectorize = new VectorizeService(accountId, apiToken);
        this.publicUrl = publicUrl;
    }

    async storeMemory(
        text: string,
        type: MemoryType = 'general',
        metadata: Record<string, any> = {}
    ): Promise<string> {
        console.log('💾 Storing memory:', { text: text.substring(0, 100), type });

        // Generate embedding for the text
        const embedding = await this.ai.generateEmbedding(text);

        // Store in Vectorize
        const vectors = [
            {
                id: crypto.randomUUID(),
                values: embedding,
                metadata: {
                    text,
                    type,
                    ...metadata,
                    timestamp: Date.now(),
                },
            },
        ];

        const ids = await this.vectorize.insert(vectors);
        const id = ids[0] || vectors[0].id;

        console.log('✅ Memory stored with ID:', id);
        return id;
    }

    async retrieveContext(
        query: string,
        limit: number = 5,
        type?: MemoryType
    ): Promise<Memory[]> {
        console.log('🔍 Retrieving context for:', query);

        // Generate embedding for the query
        const queryEmbedding = await this.ai.generateEmbedding(query);

        // Query Vectorize with proper options
        const results = await this.vectorize.query(queryEmbedding, {
            topK: limit,
            filter: type ? { type } : undefined,
        });

        console.log('✅ Retrieved contexts:', results.length);

        return results.map((result) => ({
            id: result.id,
            text: result.metadata.text as string,
            type: (result.metadata.type as MemoryType) || 'general',
            metadata: result.metadata,
            score: result.score,
        }));
    }

    async chatWithContext(userMessage: string, limit: number = 5): Promise<string> {
        console.log('💬 Chat with context:', userMessage);

        // Retrieve relevant context
        const contexts = await this.retrieveContext(userMessage, limit);

        // Build context string
        const contextString = contexts
            .map((ctx) => `[${ctx.type}] ${ctx.text}`)
            .join('\n\n');

        console.log('📚 Context retrieved:', {
            count: contexts.length,
            preview: contextString.substring(0, 200),
        });

        // Chat with AI using context
        const response = await this.ai.chat([
            {
                role: 'system',
                content: `You are a helpful AI assistant with access to the user's previous interactions and uploaded content. Use the following context to answer questions accurately and helpfully.\n\nContext:\n${contextString}`,
            },
            {
                role: 'user',
                content: userMessage,
            },
        ]);

        const answer =
            response.response || response.result?.response || 'No response generated';

        console.log('✅ Chat response generated');

        return answer;
    }

    async deleteAllMemories(): Promise<void> {
        console.log('🗑️ Deleting all memories...');

        // Query all items first
        const allItems = await this.vectorize.query(new Array(768).fill(0), {
            topK: 1000,
        });

        // Delete each item by ID
        if (allItems.length > 0) {
            const ids = allItems.map(item => item.id);
            await this.vectorize.delete(ids);
        }

        console.log('✅ All memories deleted');
    }

    async getStats(): Promise<{
        totalMemories: number;
        byType: Record<string, number>;
    }> {
        console.log('📊 Getting memory stats...');

        try {
            // Query for all items (using a generic embedding)
            const allItems = await this.vectorize.query(
                new Array(768).fill(0), // Zero vector to get random samples
                {
                    topK: 1000, // Get up to 1000 items
                }
            );

            const byType: Record<string, number> = {};

            allItems.forEach((item) => {
                const type = (item.metadata.type as string) || 'general';
                byType[type] = (byType[type] || 0) + 1;
            });

            const stats = {
                totalMemories: allItems.length,
                byType,
            };

            console.log('✅ Stats retrieved:', stats);
            return stats;
        } catch (error) {
            console.error('Error getting stats:', error);
            return {
                totalMemories: 0,
                byType: {},
            };
        }
    }
}
