import { CloudflareAI, Message } from './cloudflare-ai';
import { VectorizeService, VectorPoint } from './vectorize-service';
import { v4 as uuidv4 } from 'uuid';

export interface RAGContext {
    relevant_memories: Array<{
        content: string;
        score: number;
        type: string;
        timestamp: number;
    }>;
}

export class RAGService {
    private ai: CloudflareAI;
    private vectorize: VectorizeService;

    constructor(accountId: string, apiToken: string) {
        this.ai = new CloudflareAI(accountId, apiToken);
        this.vectorize = new VectorizeService(accountId, apiToken);
    }

    async storeMemory(
        content: string,
        type: 'text' | 'image' | 'video' | 'audio',
        metadata?: Record<string, any>
    ): Promise<string> {
        try {
            // Generate embedding
            const embedding = await this.ai.generateEmbedding(content);

            // Create vector point
            const id = uuidv4();
            const point: VectorPoint = {
                id,
                values: embedding,
                metadata: {
                    content,
                    timestamp: Date.now(),
                    type,
                    ...metadata,
                },
            };

            // Store in Vectorize
            await this.vectorize.insert([point]);

            console.log(`Memory stored with ID: ${id}`);
            return id;
        } catch (error) {
            console.error('Error storing memory:', error);
            throw error;
        }
    }

    async storeMultipleMemories(
        items: Array<{
            content: string;
            type: 'text' | 'image' | 'video' | 'audio';
            metadata?: Record<string, any>;
        }>
    ): Promise<string[]> {
        try {
            // Generate all embeddings in one call
            const contents = items.map((item) => item.content);
            const embeddings = await this.ai.generateEmbeddings(contents);

            // Create vector points
            const points: VectorPoint[] = items.map((item, index) => ({
                id: uuidv4(),
                values: embeddings[index],
                metadata: {
                    content: item.content,
                    timestamp: Date.now(),
                    type: item.type,
                    ...item.metadata,
                },
            }));

            // Store in Vectorize
            await this.vectorize.insert(points);

            console.log(`${points.length} memories stored`);
            return points.map((p) => p.id);
        } catch (error) {
            console.error('Error storing multiple memories:', error);
            throw error;
        }
    }

    async retrieveContext(
        query: string,
        limit: number = 5,
        type?: 'text' | 'image' | 'video' | 'audio'
    ): Promise<RAGContext> {
        try {
            // Generate query embedding
            const queryEmbedding = await this.ai.generateEmbedding(query);

            // Build filter
            const filter = type ? { type } : undefined;

            // Search for similar vectors
            const results = await this.vectorize.query(queryEmbedding, {
                topK: limit,
                filter,
                returnMetadata: true,
            });

            return {
                relevant_memories: results.map((result) => ({
                    content: result.metadata.content,
                    score: result.score,
                    type: result.metadata.type,
                    timestamp: result.metadata.timestamp,
                })),
            };
        } catch (error) {
            console.error('Error retrieving context:', error);
            throw error;
        }
    }

    async chatWithContext(
        userMessage: string,
        conversationHistory: Array<{ role: string; content: string }> = [],
        useMemory: boolean = true
    ): Promise<{ response: string; context?: RAGContext }> {
        try {
            let context: RAGContext | undefined;

            if (useMemory) {
                // Retrieve relevant context
                context = await this.retrieveContext(userMessage, 5);

                // Store user message
                await this.storeMemory(userMessage, 'text', {
                    role: 'user',
                    conversationId: Date.now(),
                });
            }

            // Build enhanced prompt with context
            const systemPrompt =
                useMemory && context && context.relevant_memories.length > 0
                    ? `You are a helpful AI assistant with access to previous conversation context.

Relevant context from previous interactions:
${context.relevant_memories
                        .map(
                            (mem, i) =>
                                `${i + 1}. [${mem.type}, relevance: ${(mem.score * 100).toFixed(1)}%] ${mem.content}`
                        )
                        .join('\n')}

Use this context to provide more informed and contextual responses.`
                    : 'You are a helpful AI assistant.';

            // Prepare messages with proper typing
            const messages: Message[] = [
                { role: 'system', content: systemPrompt },
                ...conversationHistory.map((msg): Message => ({
                    role: msg.role as 'user' | 'assistant' | 'system',
                    content: msg.content,
                })),
                { role: 'user', content: userMessage },
            ];

            // Get AI response
            const aiResponse = await this.ai.chat(messages);
            const responseText =
                aiResponse.response || aiResponse.result?.response || 'No response';

            // Store assistant response
            if (useMemory) {
                await this.storeMemory(responseText, 'text', {
                    role: 'assistant',
                    conversationId: Date.now(),
                });
            }

            return {
                response: responseText,
                context,
            };
        } catch (error) {
            console.error('Error in chat with context:', error);
            throw error;
        }
    }

    async getStats() {
        try {
            return await this.vectorize.getIndexInfo();
        } catch (error) {
            console.error('Error getting stats:', error);
            throw error;
        }
    }

    async deleteMemories(ids: string[]) {
        try {
            await this.vectorize.deleteById(ids);
            console.log(`Deleted ${ids.length} memories`);
        } catch (error) {
            console.error('Error deleting memories:', error);
            throw error;
        }
    }
}
