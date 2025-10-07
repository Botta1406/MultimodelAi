'use client';

import { useState } from 'react';
import { Video, Upload, Loader2, Play } from 'lucide-react';
import { VideoProcessor } from '@/lib/video-processor';

export default function VideoUpload() {
    const [video, setVideo] = useState<File | null>(null);
    const [preview, setPreview] = useState<string>('');
    const [question, setQuestion] = useState('');
    const [answer, setAnswer] = useState('');
    const [loading, setLoading] = useState(false);
    const [progress, setProgress] = useState('');
    const [frameCount, setFrameCount] = useState(0);

    const handleVideoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setVideo(file);
            const url = URL.createObjectURL(file);
            setPreview(url);
            setAnswer('');
            setProgress('');
        }
    };

    const handleAnalyze = async () => {
        if (!video || !question) {
            alert('Please upload a video and enter a question');
            return;
        }

        setLoading(true);
        setAnswer('');
        setProgress('Starting video analysis...');

        try {
            // Extract frames
            setProgress('Extracting video frames...');
            const frames = await VideoProcessor.extractFrames(video, 5, 8);
            setFrameCount(frames.length);
            setProgress(`Extracted ${frames.length} frames. Processing audio...`);

            // Extract and transcribe audio
            let audioTranscript = '';
            try {
                setProgress('Extracting audio from video...');
                const audioBase64 = await VideoProcessor.extractAudio(video);

                if (audioBase64) {
                    setProgress('Transcribing audio...');
                    const audioBlob = new Blob(
                        [Uint8Array.from(atob(audioBase64), (c) => c.charCodeAt(0))],
                        { type: 'audio/wav' }
                    );

                    const audioFormData = new FormData();
                    audioFormData.append('audio', audioBlob, 'audio.wav');

                    const transcriptResponse = await fetch('/api/audio', {
                        method: 'POST',
                        body: audioFormData,
                    });

                    if (transcriptResponse.ok) {
                        const transcriptData = await transcriptResponse.json();
                        audioTranscript = transcriptData.text || '';
                    }
                }
            } catch (audioError) {
                console.error('Audio extraction failed:', audioError);
                setProgress('Audio extraction failed, continuing with visual analysis...');
            }

            // Analyze video with AI
            setProgress('Analyzing video content with AI...');

// Create FormData to send video file + frames
            const formData = new FormData();
            formData.append('video', video);  // ← Add the video file!
            formData.append('frames', JSON.stringify(frames.slice(0, 5)));
            formData.append('audioTranscript', audioTranscript || '');
            formData.append('question', question);

            const response = await fetch('/api/video', {
                method: 'POST',
                body: formData,  // ← Send FormData instead of JSON
            });

            if (!response.ok) {
                throw new Error('Failed to analyze video');
            }

            const data = await response.json();
            setAnswer(data.answer || 'No answer generated');
            setProgress('');
        } catch (error) {
            console.error('Error:', error);
            setAnswer('Failed to analyze video. Please try again.');
            setProgress('');
        } finally {
            setLoading(false);
        }
    };

    const handleClear = () => {
        if (preview) {
            URL.revokeObjectURL(preview);
        }
        setVideo(null);
        setPreview('');
        setQuestion('');
        setAnswer('');
        setProgress('');
        setFrameCount(0);
    };

    return (
        <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl shadow-2xl p-6 border border-slate-700">
            <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-700">
                <Video className="w-6 h-6 text-purple-400" />
                <h2 className="text-xl font-bold text-white">Video Analysis</h2>
            </div>

            <div className="space-y-6">
                {/* Video Upload */}
                <div>
                    <label className="block mb-3 font-semibold text-white">Upload Video</label>
                    <div className="relative">
                        <input
                            type="file"
                            accept="video/*"
                            onChange={handleVideoChange}
                            className="hidden"
                            id="video-upload"
                        />
                        <label
                            htmlFor="video-upload"
                            className="flex items-center justify-center w-full p-8 border-2 border-dashed border-slate-600 rounded-xl hover:border-purple-500 transition-colors cursor-pointer bg-slate-700/30"
                        >
                            {preview ? (
                                <div className="relative w-full max-w-md">
                                    <video
                                        src={preview}
                                        controls
                                        className="w-full rounded-lg"
                                        style={{ maxHeight: '300px' }}
                                    />
                                    <div className="absolute top-2 right-2 bg-black/70 px-3 py-1 rounded-full text-xs text-white">
                                        {video?.name}
                                    </div>
                                </div>
                            ) : (
                                <div className="text-center">
                                    <Upload className="w-12 h-12 mx-auto mb-3 text-slate-400" />
                                    <p className="text-slate-300">Click to upload a video</p>
                                    <p className="text-sm text-slate-500 mt-1">MP4, WebM, MOV up to 50MB</p>
                                </div>
                            )}
                        </label>
                    </div>
                </div>

                {/* Question Input */}
                <div>
                    <label className="block mb-3 font-semibold text-white">Ask a Question</label>
                    <textarea
                        value={question}
                        onChange={(e) => setQuestion(e.target.value)}
                        placeholder="What happens in this video?"
                        rows={3}
                        className="w-full p-4 bg-slate-700 text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 placeholder-slate-400 resize-none"
                    />
                </div>

                {/* Buttons */}
                <div className="flex gap-3">
                    <button
                        onClick={handleAnalyze}
                        disabled={!video || !question || loading}
                        className="flex-1 py-4 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl hover:from-purple-700 hover:to-pink-700 disabled:opacity-50 disabled:cursor-not-allowed font-semibold transition-all transform hover:scale-105 flex items-center justify-center gap-2"
                    >
                        {loading ? (
                            <>
                                <Loader2 className="w-5 h-5 animate-spin" />
                                Processing...
                            </>
                        ) : (
                            <>
                                <Play className="w-5 h-5" />
                                Analyze Video
                            </>
                        )}
                    </button>
                    <button
                        onClick={handleClear}
                        className="px-6 py-4 bg-slate-700 text-white rounded-xl hover:bg-slate-600 font-semibold transition-colors"
                    >
                        Clear
                    </button>
                </div>

                {/* Progress Display */}
                {progress && (
                    <div className="p-4 bg-yellow-600/20 border border-yellow-600/50 rounded-xl">
                        <div className="flex items-center gap-3">
                            <Loader2 className="w-5 h-5 animate-spin text-yellow-400" />
                            <div>
                                <p className="text-yellow-300 font-semibold">{progress}</p>
                                {frameCount > 0 && (
                                    <p className="text-yellow-200 text-sm mt-1">
                                        Extracted {frameCount} frames for analysis
                                    </p>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* Answer Display */}
                {answer && (
                    <div className="p-6 bg-slate-700/50 rounded-xl border border-slate-600">
                        <h3 className="font-semibold mb-3 text-white flex items-center gap-2">
                            <Video className="w-5 h-5 text-purple-400" />
                            Analysis Result:
                        </h3>
                        <p className="whitespace-pre-wrap text-slate-200 leading-relaxed">{answer}</p>
                    </div>
                )}
            </div>
        </div>
    );
}
