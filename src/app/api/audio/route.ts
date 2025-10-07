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

        // STEP 2: Check audio size before transcribing
        const maxAudioSize = 5 * 1024 * 1024; // 2MB limit for Whisper
        let transcript = '';
        let answer = '';

        if (audio.size > maxAudioSize) {
            console.log(`⚠️ Audio too large (${(audio.size / 1024 / 1024).toFixed(2)}MB > 2MB), skipping transcription...`);
            transcript = `[Audio file uploaded to R2 successfully, but transcription was skipped because the file size (${(audio.size / 1024 / 1024).toFixed(2)}MB) exceeds the 2MB limit. Please use a smaller audio file for transcription.]`;

            if (question) {
                answer = `The audio file was uploaded to R2 successfully at: ${audioUrl}\n\nHowever, it's too large for automatic transcription (${(audio.size / 1024 / 1024).toFixed(2)}MB > 2MB limit). Please use an audio file smaller than 2MB for transcription.`;
            }
        } else {
            // STEP 2: Convert audio to base64 for transcription
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

            // STEP 3: Transcribe audio
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
                transcript = 'Transcription failed. Please try a different audio format or smaller file.';
            }

            // STEP 4: Answer question if provided
            if (question && transcript && !transcript.includes('failed') && !transcript.includes('skipped')) {
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
            } else if (question && (transcript.includes('failed') || transcript.includes('skipped'))) {
                answer = 'Cannot answer question because transcription was skipped or failed.';
            }
        }

        // STEP 5: Store in memory if requested
        if (saveToMemory && transcript) {
            try {
                console.log('💾 Storing in vector memory...');
                const rag = getRAGService();

                const content = question
                    ? `Audio Analysis - Q: ${question} A: ${answer}`
                    : `Audio Transcription: ${transcript}`;

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
            transcriptionSkipped: audio.size > maxAudioSize,
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
