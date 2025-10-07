import { NextRequest, NextResponse } from 'next/server';
import { CloudflareAI } from '@/lib/cloudflare-ai';
import { R2Service } from '@/lib/r2-service';
import { RAGService } from '@/lib/rag-service';

export const runtime = 'edge';

let ragService: RAGService | null = null;

function getRAGService() {
    if (!ragService) {
        const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
        const apiToken = process.env.CLOUDFLARE_API_TOKEN;
        const publicUrl = process.env.R2_PUBLIC_URL;

        if (!accountId || !apiToken) {
            throw new Error('Missing Cloudflare credentials');
        }

        ragService = new RAGService(accountId, apiToken, publicUrl);
    }
    return ragService;
}

export async function POST(request: NextRequest) {
    try {
        const formData = await request.formData();
        const image = formData.get('image') as File;
        const question = formData.get('question') as string;
        const saveToMemory = formData.get('saveToMemory') === 'true';

        console.log('🎯 Image API called:', {
            hasImage: !!image,
            question,
            saveToMemory,
            imageName: image?.name,
            imageType: image?.type,
            imageSize: image?.size,
        });

        if (!image || !question) {
            return NextResponse.json(
                { error: 'Missing image or question' },
                { status: 400 }
            );
        }

        const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
        const apiToken = process.env.CLOUDFLARE_API_TOKEN;
        const publicUrl = process.env.R2_PUBLIC_URL;

        if (!accountId || !apiToken) {
            return NextResponse.json(
                { error: 'Missing Cloudflare credentials' },
                { status: 500 }
            );
        }

        console.log('🔧 Configuration:', {
            hasAccountId: !!accountId,
            hasApiToken: !!apiToken,
            hasPublicUrl: !!publicUrl,
            publicUrl: publicUrl || 'NOT SET',
        });

        // STEP 1: Upload image to R2 FIRST
        let imageUrl: string | undefined;

        console.log('📤 Starting R2 upload...');

        if (publicUrl) {
            try {
                const r2 = new R2Service(accountId, apiToken, 'multimodalai', publicUrl);
                const key = r2.generateKey('images', image.name);

                console.log('📤 Uploading to R2 with key:', key);

                const uploadResult = await r2.uploadFile(image, key, image.type);
                imageUrl = uploadResult.url;

                console.log('✅ R2 upload successful!', {
                    url: imageUrl,
                    key: uploadResult.key,
                    size: uploadResult.size,
                });
            } catch (r2Error) {
                console.error('❌ R2 upload failed:', r2Error);
                console.error('R2 Error details:', {
                    message: r2Error instanceof Error ? r2Error.message : 'Unknown',
                    stack: r2Error instanceof Error ? r2Error.stack : undefined,
                });
                // Continue even if R2 fails, but log the error
            }
        } else {
            console.warn('⚠️ R2_PUBLIC_URL not configured in .env.local, skipping R2 upload');
        }

        // STEP 2: Convert image to base64 for AI analysis
        console.log('🔄 Converting image to base64...');
        const arrayBuffer = await image.arrayBuffer();
        const uint8Array = new Uint8Array(arrayBuffer);

        let binary = '';
        const len = uint8Array.byteLength;
        for (let i = 0; i < len; i++) {
            binary += String.fromCharCode(uint8Array[i]);
        }
        const base64 = btoa(binary);
        const dataUrl = `data:${image.type};base64,${base64}`;

        console.log('✅ Image converted to base64:', {
            length: base64.length,
            type: image.type,
        });

        // STEP 3: Analyze image with AI
        console.log('🤖 Analyzing image with AI...');
        const ai = new CloudflareAI(accountId, apiToken);
        const response = await ai.analyzeImageWithUrl(dataUrl, question);
        const answer = response.response || response.result?.response || 'No response';

        console.log('✅ AI analysis complete:', {
            answerLength: answer.length,
        });

        // STEP 4: Store in memory with R2 URL
        if (saveToMemory) {
            try {
                console.log('💾 Storing in vector memory...');
                const rag = getRAGService();

                const memoryId = await rag.storeMemory(
                    `Image Analysis - Q: ${question} A: ${answer}`,
                    'image',
                    {
                        question,
                        answer,
                        image_url: imageUrl,  // Store R2 URL in metadata
                        image_name: image.name,
                        image_type: image.type,
                        timestamp: Date.now()
                    }
                );

                console.log('✅ Stored in memory:', {
                    memoryId,
                    hasImageUrl: !!imageUrl,
                });
            } catch (memError) {
                console.error('❌ Failed to store in memory:', memError);
                console.error('Memory error details:', {
                    message: memError instanceof Error ? memError.message : 'Unknown',
                    stack: memError instanceof Error ? memError.stack : undefined,
                });
                // Don't fail the request if memory storage fails
            }
        } else {
            console.log('⏭️ Skipping memory storage (saveToMemory is false)');
        }

        console.log('🎉 Image API complete!');

        return NextResponse.json({
            response: answer,
            memorySaved: saveToMemory,
            imageUrl, // Return the R2 URL to the frontend
        });
    } catch (error) {
        console.error('❌ Image API error:', error);
        console.error('Error details:', {
            message: error instanceof Error ? error.message : 'Unknown',
            stack: error instanceof Error ? error.stack : undefined,
        });
        return NextResponse.json(
            {
                error: error instanceof Error ? error.message : 'Failed to analyze image',
            },
            { status: 500 }
        );
    }
}
