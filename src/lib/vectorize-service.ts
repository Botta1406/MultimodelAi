export interface VectorPoint {
    id: string;
    values: number[];
    metadata: {
        content: string;
        timestamp: number;
        type: 'text' | 'image' | 'video' | 'audio';
        [key: string]: any;
    };
}

export interface SearchResult {
    id: string;
    score: number;
    metadata: VectorPoint['metadata'];
}

export class VectorizeService {
    private accountId: string;
    private apiToken: string;
    private indexName: string;

    constructor(accountId: string, apiToken: string, indexName: string = 'multimodal-memory') {
        this.accountId = accountId;
        this.apiToken = apiToken;
        this.indexName = indexName;
    }

    async insert(points: VectorPoint[]) {
        try {
            console.log('🔵 Vectorize v2 insert called:', {
                pointsCount: points.length,
                indexName: this.indexName,
            });

            // FIXED: Use v2 API endpoint
            const response = await fetch(
                `https://api.cloudflare.com/client/v4/accounts/${this.accountId}/vectorize/v2/indexes/${this.indexName}/insert`,
                {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${this.apiToken}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        vectors: points.map(point => ({
                            id: point.id,
                            values: point.values,
                            metadata: point.metadata,
                        })),
                    }),
                }
            );

            console.log('📥 Vectorize insert response:', response.status, response.statusText);

            if (!response.ok) {
                const error = await response.text();
                console.error('❌ Vectorize insert failed:', error);
                throw new Error(`Vectorize insert failed: ${response.statusText} - ${error}`);
            }

            const result = await response.json();
            console.log('✅ Vectorize insert successful');
            return result;
        } catch (error) {
            console.error('❌ Error inserting vectors:', error);
            throw error;
        }
    }

    async query(
        vector: number[],
        options: {
            topK?: number;
            filter?: Record<string, any>;
            returnValues?: boolean;
            returnMetadata?: boolean;
        } = {}
    ): Promise<SearchResult[]> {
        try {
            // FIXED: Use v2 API endpoint
            const response = await fetch(
                `https://api.cloudflare.com/client/v4/accounts/${this.accountId}/vectorize/v2/indexes/${this.indexName}/query`,
                {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${this.apiToken}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        vector,
                        topK: options.topK || 5,
                        filter: options.filter,
                        returnValues: options.returnValues ?? false,
                        returnMetadata: options.returnMetadata ?? true,
                    }),
                }
            );

            if (!response.ok) {
                const error = await response.text();
                throw new Error(`Vectorize query failed: ${response.statusText} - ${error}`);
            }

            const data = await response.json();

            return (data.result?.matches || []).map((match: any) => ({
                id: match.id,
                score: match.score,
                metadata: match.metadata || {},
            }));
        } catch (error) {
            console.error('Error querying vectors:', error);
            throw error;
        }
    }

    async getById(ids: string[]): Promise<VectorPoint[]> {
        try {
            // FIXED: Use v2 API endpoint
            const response = await fetch(
                `https://api.cloudflare.com/client/v4/accounts/${this.accountId}/vectorize/v2/indexes/${this.indexName}/getByIds`,
                {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${this.apiToken}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ ids }),
                }
            );

            if (!response.ok) {
                const error = await response.text();
                throw new Error(`Vectorize getById failed: ${response.statusText} - ${error}`);
            }

            const data = await response.json();
            return data.result?.vectors || [];
        } catch (error) {
            console.error('Error getting vectors by ID:', error);
            throw error;
        }
    }

    async deleteById(ids: string[]) {
        try {
            // FIXED: Use v2 API endpoint
            const response = await fetch(
                `https://api.cloudflare.com/client/v4/accounts/${this.accountId}/vectorize/v2/indexes/${this.indexName}/deleteByIds`,
                {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${this.apiToken}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ ids }),
                }
            );

            if (!response.ok) {
                const error = await response.text();
                throw new Error(`Vectorize delete failed: ${response.statusText} - ${error}`);
            }

            return response.json();
        } catch (error) {
            console.error('Error deleting vectors:', error);
            throw error;
        }
    }

    async getIndexInfo() {
        try {
            // FIXED: Use v2 API endpoint
            const response = await fetch(
                `https://api.cloudflare.com/client/v4/accounts/${this.accountId}/vectorize/v2/indexes/${this.indexName}`,
                {
                    method: 'GET',
                    headers: {
                        'Authorization': `Bearer ${this.apiToken}`,
                        'Content-Type': 'application/json',
                    },
                }
            );

            if (!response.ok) {
                const error = await response.text();
                throw new Error(`Vectorize info failed: ${response.statusText} - ${error}`);
            }

            return response.json();
        } catch (error) {
            console.error('Error getting index info:', error);
            throw error;
        }
    }
}
