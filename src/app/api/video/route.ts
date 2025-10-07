import { NextRequest, NextResponse } from 'next/server';
import { CloudflareAI } from '@/lib/cloudflare-ai';
import { RAGService } from '@/lib/rag-service';
import { R2Service } from '@/lib/r2-service';

export const runtime = 'edge';
export const maxDuration = 60;

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
        const videoFile = formData.get('video') as File;
        const framesJson = formData.get('frames') as string;
        const audioTranscript = formData.get('audioTranscript') as string;
        const question = formData.get('question') as string;

        const frames = framesJson ? JSON.parse(framesJson) : null;

        console.log('🎬 Video API called:', {
            hasVideo: !!videoFile,
            videoName: videoFile?.name,
            videoSize: videoFile?.size,
            framesCount: frames?.length,
            question,
        });

        if (!frames || !question) {
            return NextResponse.json(
                { error: 'Missing frames or question' },
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

        // STEP 1: Upload video to R2
        let videoUrl: string | undefined;

        if (videoFile && publicUrl) {
            try {
                console.log('📤 Uploading video to R2...');
                const r2 = new R2Service(accountId, apiToken, 'multimodalai', publicUrl);
                const key = r2.generateKey('videos', videoFile.name);
                const uploadResult = await r2.uploadFile(videoFile, key, videoFile.type);
                videoUrl = uploadResult.url;
                console.log('✅ Video uploaded to R2:', videoUrl);
            } catch (r2Error) {
                console.error('❌ R2 video upload failed:', r2Error);
            }
        }

        const ai = new CloudflareAI(accountId, apiToken);

        // STEP 2: Analyze frames (limit to 5 for performance)
        console.log('🖼️ Analyzing video frames...');
        const frameAnalyses = await Promise.all(
            frames.slice(0, 5).map(async (frame: any) => {
                const dataUrl = `data:image/jpeg;base64,${frame.base64}`;
                const result = await ai.analyzeImageWithUrl(
                    dataUrl,
                    'Describe what you see in this video frame in detail.'
                );
                return {
                    timestamp: frame.timestamp,
                    description:
                        result.response || result.result?.response || 'No description',
                };
            })
        );

        // STEP 3: Combine context
        const context = `
Video Analysis:
${frameAnalyses
            .map((f) => `[${f.timestamp.toFixed(1)}s]: ${f.description}`)
            .join('\n')}

Audio Transcript:
${audioTranscript || 'No audio available'}
`;

        // STEP 4: Answer question
        console.log('💬 Generating answer...');
        const finalResponse = await ai.chat([
            {
                role: 'system',
                content:
                    'You are analyzing a video. Use the frame descriptions and audio transcript to answer questions accurately.',
            },
            {
                role: 'user',
                content: `${context}\n\nQuestion: ${question}`,
            },
        ]);

        const answer =
            finalResponse.response || finalResponse.result?.response || 'No answer generated';

        // STEP 5: Store in memory with video URL
        console.log('💾 Storing in vector memory...');
        const rag = getRAGService();
        await rag.storeMemory(
            `Video Analysis - Q: ${question} A: ${answer}`,
            'video',
            {
                question,
                answer,
                video_url: videoUrl,  // ← Store R2 URL!
                video_name: videoFile?.name,
                frameCount: frames.length,
                hasAudio: !!audioTranscript,
                timestamp: Date.now()
            }
        );

        console.log('✅ Video processing complete!');

        return NextResponse.json({
            answer,
            frameAnalyses,
            audioTranscript,
            videoUrl,  // Return video URL to frontend
        });
    } catch (error) {
        console.error('❌ Video API error:', error);
        return NextResponse.json(
            {
                error: error instanceof Error ? error.message : 'Failed to process video',
            },
            { status: 500 }
        );
    }
}
