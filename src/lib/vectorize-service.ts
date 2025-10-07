export interface VectorMatch {
    id: string;
    score: number;
    values?: number[];
    metadata: Record<string, any>;
}

export interface VectorInsert {
    id: string;
    values: number[];
    metadata?: Record<string, any>;
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

    async insert(vectors: VectorInsert[]): Promise<string[]> {
        console.log('🔵 Vectorize v2 insert called:', {
            pointsCount: vectors.length,
            indexName: this.indexName,
        });

        const response = await fetch(
            `https://api.cloudflare.com/client/v4/accounts/${this.accountId}/vectorize/v2/indexes/${this.indexName}/insert`,
            {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.apiToken}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ vectors }),
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

        // Return the IDs of inserted vectors
        return vectors.map(v => v.id);
    }

    async query(
        vector: number[],
        options?: {
            topK?: number;
            filter?: Record<string, any>;
            returnMetadata?: boolean;
            returnValues?: boolean;
        }
    ): Promise<VectorMatch[]> {
        const topK = options?.topK || 5;
        const filter = options?.filter;
        const returnMetadata = options?.returnMetadata !== false;
        const returnValues = options?.returnValues || false;

        console.log('🔵 Vectorize v2 query called:', {
            vectorLength: vector.length,
            topK,
            hasFilter: !!filter,
            indexName: this.indexName,
        });

        const body: any = {
            vector,
            topK,
            returnMetadata,
            returnValues,
        };

        if (filter) {
            body.filter = filter;
        }

        const response = await fetch(
            `https://api.cloudflare.com/client/v4/accounts/${this.accountId}/vectorize/v2/indexes/${this.indexName}/query`,
            {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.apiToken}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(body),
            }
        );

        console.log('📥 Vectorize query response:', response.status, response.statusText);

        if (!response.ok) {
            const error = await response.text();
            console.error('❌ Vectorize query failed:', error);
            throw new Error(`Vectorize query failed: ${response.statusText} - ${error}`);
        }

        const result = await response.json();
        const matches: VectorMatch[] = result.result?.matches || [];

        console.log('✅ Vectorize query successful:', { matches: matches.length });

        return matches;
    }

    async delete(ids: string[]): Promise<void> {
        console.log('🔵 Vectorize delete called:', { idsCount: ids.length });

        const response = await fetch(
            `https://api.cloudflare.com/client/v4/accounts/${this.accountId}/vectorize/v2/indexes/${this.indexName}/delete-by-ids`,
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
            console.error('❌ Vectorize delete failed:', error);
            throw new Error(`Vectorize delete failed: ${response.statusText} - ${error}`);
        }

        console.log('✅ Vectorize delete successful');
    }

    async getById(id: string): Promise<VectorMatch | null> {
        console.log('🔵 Vectorize getById called:', { id });

        const response = await fetch(
            `https://api.cloudflare.com/client/v4/accounts/${this.accountId}/vectorize/v2/indexes/${this.indexName}/get-by-ids`,
            {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.apiToken}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ ids: [id] }),
            }
        );

        if (!response.ok) {
            const error = await response.text();
            console.error('❌ Vectorize getById failed:', error);
            throw new Error(`Vectorize getById failed: ${response.statusText} - ${error}`);
        }

        const result = await response.json();
        const vectors = result.result?.vectors || [];

        return vectors.length > 0 ? vectors[0] : null;
    }
}
