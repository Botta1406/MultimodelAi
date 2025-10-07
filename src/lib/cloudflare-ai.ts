export interface Message {
    role: 'system' | 'user' | 'assistant';
    content: string | Array<{
        type: 'text' | 'image_url';
        text?: string;
        image_url?: { url: string };
    }>;
}

export interface AIResponse {
    response?: string;
    result?: {
        response: string;
    };
    text?: string;
    data?: number[][];
}

export class CloudflareAI {
    private accountId: string;
    private apiToken: string;
    private baseUrl: string;

    constructor(accountId: string, apiToken: string) {
        this.accountId = accountId;
        this.apiToken = apiToken;
        this.baseUrl = `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run`;
    }

    async chat(messages: Message[], options?: {
        temperature?: number;
        max_tokens?: number;
    }): Promise<AIResponse> {
        const response = await fetch(
            `${this.baseUrl}/@cf/meta/llama-4-scout-17b-16e-instruct`,
            {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.apiToken}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    messages,
                    temperature: options?.temperature || 0.7,
                    max_tokens: options?.max_tokens || 2048,
                }),
            }
        );

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`AI request failed: ${response.statusText} - ${error}`);
        }

        return response.json();
    }

    async generateEmbedding(text: string): Promise<number[]> {
        const response = await fetch(
            `${this.baseUrl}/@cf/baai/bge-base-en-v1.5`,  // ✅ 768 dims
            {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.apiToken}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    text: [text],
                }),
            }
        );

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`Embedding request failed: ${response.statusText} - ${error}`);
        }

        const result = await response.json();
        return result.data?.[0] || result.result?.data?.[0] || [];
    }

    async generateEmbeddings(texts: string[]): Promise<number[][]> {
        const response = await fetch(
            `${this.baseUrl}/@cf/baai/bge-base-en-v1.5`,  // ✅ Changed from large to base (768 dims)
            {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.apiToken}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    text: texts,
                }),
            }
        );

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`Embeddings request failed: ${response.statusText} - ${error}`);
        }

        const result = await response.json();
        return result.data || result.result?.data || [];
    }

    async analyzeImageWithUrl(imageDataUrl: string, question: string): Promise<AIResponse> {
        const messages: Message[] = [
            {
                role: 'system',
                content: 'You are a helpful AI assistant that can analyze images and answer questions about them in detail.',
            },
            {
                role: 'user',
                content: [
                    {
                        type: 'text',
                        text: question,
                    },
                    {
                        type: 'image_url',
                        image_url: {
                            url: imageDataUrl,
                        },
                    },
                ],
            },
        ];

        return this.chat(messages);
    }

    async analyzeImage(imageBase64: string, question: string): Promise<AIResponse> {
        const imageDataUrl = imageBase64.startsWith('data:')
            ? imageBase64
            : `data:image/jpeg;base64,${imageBase64}`;

        return this.analyzeImageWithUrl(imageDataUrl, question);
    }

    async transcribeAudio(audioBase64: string): Promise<AIResponse> {
        console.log('🎙️ Whisper API call (binary mode)');

        // Convert base64 to binary
        const binaryString = atob(audioBase64);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }

        console.log('Sending audio as binary:', {
            binaryLength: bytes.length,
            sizeMB: (bytes.length / 1024 / 1024).toFixed(2)
        });

        // Send as binary, not JSON!
        const response = await fetch(
            `${this.baseUrl}/@cf/openai/whisper`,
            {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.apiToken}`,
                    'Content-Type': 'application/octet-stream',  // Binary upload
                },
                body: bytes,  // Raw bytes, not JSON
            }
        );

        console.log('📥 Whisper response:', response.status);

        if (!response.ok) {
            const error = await response.text();
            console.error('❌ Whisper error:', error);
            throw new Error(`Whisper request failed: ${response.statusText} - ${error}`);
        }

        const result = await response.json();
        console.log('✅ Whisper transcription successful');
        return result;
    }
}
