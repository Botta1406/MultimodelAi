'use client';

import { useState, useRef, ChangeEvent } from 'react';
import { Video, Upload, Loader2, Play, X, RefreshCw } from 'lucide-react';
import type { VideoAnalysisResponse, VideoFrame, APIError } from '@/types';

export default function VideoUpload() {
    const [video, setVideo] = useState<File | null>(null);
    const [preview, setPreview] = useState<string>('');
    const [question, setQuestion] = useState<string>('');
    const [answer, setAnswer] = useState<string>('');
    const [loading, setLoading] = useState<boolean>(false);
    const [saveToMemory, setSaveToMemory] = useState<boolean>(true);

    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);

    const handleVideoChange = (e: ChangeEvent<HTMLInputElement>): void => {
        const file = e.target.files?.[0];
        if (file) {
            if (preview) {
                URL.revokeObjectURL(preview);
            }
            setVideo(file);
            const url = URL.createObjectURL(file);
            setPreview(url);
            setAnswer('');
        }
    };

    const handleRemoveVideo = (): void => {
        if (preview) {
            URL.revokeObjectURL(preview);
        }
        setVideo(null);
        setPreview('');
        setAnswer('');
    };

    const extractFrames = async (videoFile: File, numFrames: number = 5): Promise<VideoFrame[]> => {
        return new Promise<VideoFrame[]>((resolve, reject) => {
            const video = document.createElement('video');
            video.preload = 'metadata';

            video.onloadedmetadata = () => {
                const duration = video.duration;
                const frames: VideoFrame[] = [];
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');

                if (!ctx) {
                    reject(new Error('Could not get canvas context'));
                    return;
                }

                let currentFrame = 0;

                video.onseeked = () => {
                    canvas.width = video.videoWidth;
                    canvas.height = video.videoHeight;
                    ctx.drawImage(video, 0, 0);

                    frames.push({
                        timestamp: video.currentTime,
                        base64: canvas.toDataURL('image/jpeg').split(',')[1],
                    });

                    currentFrame++;

                    if (currentFrame < numFrames) {
                        video.currentTime = (duration / numFrames) * currentFrame;
                    } else {
                        resolve(frames);
                    }
                };

                video.currentTime = 0;
            };

            video.onerror = () => reject(new Error('Failed to load video'));
            video.src = URL.createObjectURL(videoFile);
        });
    };

    const handleAnalyze = async (): Promise<void> => {
        if (!video) {
            alert('Please upload a video');
            return;
        }

        if (!question) {
            alert('Please enter a question about the video');
            return;
        }

        setLoading(true);
        setAnswer('');

        try {
            const frames = await extractFrames(video, 5);

            const formData = new FormData();
            formData.append('video', video);
            formData.append('frames', JSON.stringify(frames));
            formData.append('question', question);
            formData.append('saveToMemory', saveToMemory.toString());

            const response = await fetch('/api/video', {
                method: 'POST',
                body: formData,
            });

            if (!response.ok) {
                const errorData: APIError = await response.json();
                throw new Error(errorData.error || 'Failed to analyze video');
            }

            const data: VideoAnalysisResponse = await response.json();
            setAnswer(data.answer || 'No answer generated');
        } catch (error) {
            console.error('Error:', error);
            setAnswer('Failed to analyze video. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const handleClear = (): void => {
        handleRemoveVideo();
        setQuestion('');
        setAnswer('');
    };

    return (
        <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl shadow-2xl p-6 border border-slate-700">
            <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-700">
                <Video className="w-6 h-6 text-purple-400" />
                <h2 className="text-xl font-bold text-white">Video Analysis</h2>
            </div>

            <div className="space-y-6">
                {/* Upload Area */}
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
                            <div className="text-center">
                                <Upload className="w-12 h-12 mx-auto mb-3 text-slate-400" />
                                <p className="text-slate-300">Click to upload video</p>
                                <p className="text-sm text-slate-500 mt-1">MP4, WebM up to 50MB</p>
                            </div>
                        </label>
                    </div>
                </div>

                {/* Uploaded Files Section */}
                {video && (
                    <div className="p-4 bg-slate-700/50 rounded-xl border border-slate-600">
                        <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                            <Video className="w-4 h-4" />
                            Uploaded Video
                        </h3>
                        <div className="flex items-start gap-4 p-3 bg-slate-800/50 rounded-lg">
                            {/* Video Preview */}
                            <video
                                ref={videoRef}
                                src={preview}
                                className="w-32 h-20 object-cover rounded-lg border border-slate-600"
                                controls
                            />

                            {/* File Info */}
                            <div className="flex-1 min-w-0">
                                <p className="text-white font-medium truncate">{video.name}</p>
                                <p className="text-slate-400 text-sm">
                                    {(video.size / 1024 / 1024).toFixed(2)} MB • {video.type}
                                </p>
                            </div>

                            {/* Actions */}
                            <div className="flex gap-2">
                                <label
                                    htmlFor="video-upload"
                                    className="px-3 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-medium cursor-pointer flex items-center gap-2 transition-colors"
                                >
                                    <RefreshCw className="w-4 h-4" />
                                    Replace
                                </label>
                                <button
                                    onClick={handleRemoveVideo}
                                    className="px-3 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium flex items-center gap-2 transition-colors"
                                >
                                    <X className="w-4 h-4" />
                                    Remove
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Question Input */}
                <div>
                    <label className="block mb-3 font-semibold text-white">Ask a Question</label>
                    <textarea
                        value={question}
                        onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setQuestion(e.target.value)}
                        placeholder="What is happening in this video?"
                        rows={3}
                        className="w-full p-4 bg-slate-700 text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 placeholder-slate-400 resize-none"
                    />
                </div>

                {/* Save to Memory Checkbox */}
                <div className="flex items-center gap-2">
                    <input
                        type="checkbox"
                        id="save-video-memory"
                        checked={saveToMemory}
                        onChange={(e: ChangeEvent<HTMLInputElement>) => setSaveToMemory(e.target.checked)}
                        className="w-4 h-4 text-purple-600 rounded focus:ring-purple-500"
                    />
                    <label htmlFor="save-video-memory" className="text-slate-300 cursor-pointer">
                        Save analysis to memory
                    </label>
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
                                Analyzing...
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

            <canvas ref={canvasRef} style={{ display: 'none' }} />
        </div>
    );
}
