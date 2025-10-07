import { NextRequest, NextResponse } from 'next/server';
import { CloudflareAI } from '@/lib/cloudflare-ai';
import { RAGService } from '@/lib/rag-service';
import { R2Service } from '@/lib/r2-service';

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
        const audio = formData.get('audio') as File;
        const question = formData.get('question') as string;
        const saveToMemory = formData.get('saveToMemory') === 'true';

        console.log('🎵 Audio API called:', {
            hasAudio: !!audio,
            audioName: audio?.name,
            audioSize: audio?.size,
            audioType: audio?.type,
            question,
            saveToMemory,
        });

        if (!audio) {
            return NextResponse.json({ error: 'Missing audio file' }, { status: 400 });
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

        // STEP 1: Upload audio to R2
        let audioUrl: string | undefined;

        if (publicUrl) {
            try {
                console.log('📤 Uploading audio to R2...');
                const r2 = new R2Service(accountId, apiToken, 'multimodalai', publicUrl);
                const key = r2.generateKey('audio', audio.name);
                const uploadResult = await r2.uploadFile(audio, key, audio.type);
                audioUrl = uploadResult.url;
                console.log('✅ Audio uploaded to R2:', audioUrl);
            } catch (r2Error) {
                console.error('❌ R2 audio upload failed:', r2Error);
            }
        }

        // STEP 2: Convert audio to base64 for transcription
        let transcript = '';
        let answer = '';

        console.log('🔄 Converting audio to base64...');
        const arrayBuffer = await audio.arrayBuffer();
        const uint8Array = new Uint8Array(arrayBuffer);

        // Convert to base64
        let binary = '';
        for (let i = 0; i < uint8Array.length; i++) {
            binary += String.fromCharCode(uint8Array[i]);
        }
        const base64 = btoa(binary);

        console.log('✅ Audio converted:', {
            originalSize: audio.size,
            base64Length: base64.length,
        });

        // STEP 3: Transcribe audio with Whisper (no size check)
        console.log('🎙️ Transcribing audio with Whisper...');
        const ai = new CloudflareAI(accountId, apiToken);

        try {
            const transcriptionResponse = await ai.transcribeAudio(base64);
            transcript = transcriptionResponse.text || '';

            if (!transcript) {
                throw new Error('Whisper returned empty transcription');
            }

            console.log('✅ Transcription complete:', {
                transcriptLength: transcript.length,
                preview: transcript.substring(0, 100),
            });
        } catch (transcribeError) {
            console.error('❌ Transcription failed:', transcribeError);

            // Check if it's a size error from Whisper API
            const errorMessage = transcribeError instanceof Error ? transcribeError.message : String(transcribeError);

            if (errorMessage.includes('too large') || errorMessage.includes('Payload Too Large')) {
                transcript = `Audio file is too large for Whisper API. The file was uploaded to R2 storage successfully, but transcription is not available. Please use a smaller file (under 2MB) or shorter recording for transcription.`;
            } else {
                transcript = `Transcription failed: ${errorMessage}. The audio file was uploaded successfully to R2 storage.`;
            }
        }

        // STEP 4: Answer question if provided
        if (question && transcript && !transcript.includes('failed') && !transcript.includes('too large')) {
            console.log('💬 Answering question based on transcript...');
            try {
                const chatResponse = await ai.chat([
                    {
                        role: 'system',
                        content: 'You are analyzing an audio transcription. Answer questions based on the transcript accurately and concisely.',
                    },
                    {
                        role: 'user',
                        content: `Transcript: ${transcript}\n\nQuestion: ${question}`,
                    },
                ]);
                answer = chatResponse.response || chatResponse.result?.response || 'No answer generated';
                console.log('✅ Answer generated');
            } catch (answerError) {
                console.error('❌ Failed to generate answer:', answerError);
                answer = 'Failed to generate answer based on transcript';
            }
        } else if (question && (transcript.includes('failed') || transcript.includes('too large'))) {
            answer = 'Cannot answer question because transcription failed. However, the audio file was uploaded to R2 storage successfully.';
        }

        // STEP 5: Store in memory if requested
        if (saveToMemory && transcript) {
            try {
                console.log('💾 Storing in vector memory...');
                const rag = getRAGService();

                const content = question
                    ? `Audio Analysis - Q: ${question} A: ${answer}`
                    : `Audio Upload: ${audio.name} - ${transcript}`;

                await rag.storeMemory(content, 'audio', {
                    transcript,
                    question: question || undefined,
                    answer: answer || undefined,
                    audio_url: audioUrl,
                    audio_name: audio.name,
                    audio_type: audio.type,
                    audio_size: audio.size,
                    timestamp: Date.now(),
                });

                console.log('✅ Stored in memory');
            } catch (memError) {
                console.error('❌ Failed to store in memory:', memError);
            }
        }

        console.log('🎉 Audio processing complete!');

        return NextResponse.json({
            transcript: transcript || 'No transcription available',
            answer: answer || undefined,
            audioUrl,
            memorySaved: saveToMemory && !!transcript,
            fileSizeMB: (audio.size / 1024 / 1024).toFixed(2),
            transcriptionSkipped: false,
        });
    } catch (error) {
        console.error('❌ Audio API error:', error);
        return NextResponse.json(
            {
                error: error instanceof Error ? error.message : 'Failed to process audio',
                details: error instanceof Error ? error.stack : undefined,
            },
            { status: 500 }
        );
    }
}
