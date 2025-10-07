'use client';

import { useState, useRef } from 'react';
import { Mic, Upload, Loader2, Play, StopCircle } from 'lucide-react';

export default function AudioUpload() {
    const [audio, setAudio] = useState<File | null>(null);
    const [preview, setPreview] = useState<string>('');
    const [question, setQuestion] = useState('');
    const [transcript, setTranscript] = useState('');
    const [answer, setAnswer] = useState('');
    const [loading, setLoading] = useState(false);
    const [isRecording, setIsRecording] = useState(false);
    const [recordingTime, setRecordingTime] = useState(0);
    const [saveToMemory, setSaveToMemory] = useState(true);

    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const chunksRef = useRef<Blob[]>([]);
    const timerRef = useRef<NodeJS.Timeout | null>(null);

    const handleAudioChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setAudio(file);
            const url = URL.createObjectURL(file);
            setPreview(url);
            setTranscript('');
            setAnswer('');
        }
    };

    // Helper function to convert audio to WAV format
    const audioBufferToWav = (buffer: AudioBuffer): ArrayBuffer => {
        const length = buffer.length * buffer.numberOfChannels * 2 + 44;
        const arrayBuffer = new ArrayBuffer(length);
        const view = new DataView(arrayBuffer);
        const channels: Float32Array[] = [];
        let offset = 0;
        let pos = 0;

        // Helper functions
        const setUint16 = (data: number) => {
            view.setUint16(pos, data, true);
            pos += 2;
        };
        const setUint32 = (data: number) => {
            view.setUint32(pos, data, true);
            pos += 4;
        };

        // Write WAV header
        setUint32(0x46464952); // "RIFF"
        setUint32(length - 8); // file length - 8
        setUint32(0x45564157); // "WAVE"
        setUint32(0x20746d66); // "fmt " chunk
        setUint32(16); // length = 16
        setUint16(1); // PCM (uncompressed)
        setUint16(buffer.numberOfChannels);
        setUint32(buffer.sampleRate);
        setUint32(buffer.sampleRate * 2 * buffer.numberOfChannels); // avg. bytes/sec
        setUint16(buffer.numberOfChannels * 2); // block-align
        setUint16(16); // 16-bit
        setUint32(0x61746164); // "data" - chunk
        setUint32(length - pos - 4); // chunk length

        // Write interleaved data
        for (let i = 0; i < buffer.numberOfChannels; i++) {
            channels.push(buffer.getChannelData(i));
        }

        while (pos < length) {
            for (let i = 0; i < buffer.numberOfChannels; i++) {
                let sample = Math.max(-1, Math.min(1, channels[i][offset]));
                sample = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
                view.setInt16(pos, sample, true);
                pos += 2;
            }
            offset++;
        }

        return arrayBuffer;
    };

    // Convert WebM to WAV
    const convertToWav = async (audioBlob: Blob): Promise<Blob> => {
        try {
            console.log('Converting audio to WAV format...');
            const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
            const arrayBuffer = await audioBlob.arrayBuffer();
            const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

            // Create WAV file
            const wavBuffer = audioBufferToWav(audioBuffer);
            console.log('✅ Converted to WAV');
            return new Blob([wavBuffer], { type: 'audio/wav' });
        } catch (error) {
            console.error('❌ WAV conversion failed:', error);
            return audioBlob; // Return original if conversion fails
        }
    };

    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

            // Try different formats in order of preference
            let mimeType = 'audio/webm';
            if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
                mimeType = 'audio/webm;codecs=opus';
            }

            console.log('Recording with format:', mimeType);

            const mediaRecorder = new MediaRecorder(stream, { mimeType });
            mediaRecorderRef.current = mediaRecorder;
            chunksRef.current = [];

            mediaRecorder.ondataavailable = (e) => {
                if (e.data.size > 0) {
                    chunksRef.current.push(e.data);
                }
            };

            mediaRecorder.onstop = async () => {
                console.log('Recording stopped, processing...');
                const webmBlob = new Blob(chunksRef.current, { type: mimeType });

                // Convert to WAV for better compatibility with Whisper
                const wavBlob = await convertToWav(webmBlob);

                const file = new File([wavBlob], 'recording.wav', { type: 'audio/wav' });
                setAudio(file);
                const url = URL.createObjectURL(wavBlob);
                setPreview(url);

                stream.getTracks().forEach(track => track.stop());
                console.log('Recording ready:', {
                    size: file.size,
                    type: file.type,
                    name: file.name
                });
            };

            mediaRecorder.start();
            setIsRecording(true);
            setRecordingTime(0);

            timerRef.current = setInterval(() => {
                setRecordingTime((prev) => prev + 1);
            }, 1000);
        } catch (error) {
            console.error('Error accessing microphone:', error);
            alert('Could not access microphone. Please check permissions.');
        }
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.stop();
            setIsRecording(false);

            if (timerRef.current) {
                clearInterval(timerRef.current);
                timerRef.current = null;
            }
        }
    };

    const handleAnalyze = async () => {
        if (!audio) {
            alert('Please upload or record audio');
            return;
        }

        if (!question) {
            alert('Please enter a question about the audio');
            return;
        }

        setLoading(true);
        setTranscript('');
        setAnswer('');

        try {
            const formData = new FormData();
            formData.append('audio', audio);
            formData.append('question', question);
            formData.append('saveToMemory', saveToMemory.toString());

            const response = await fetch('/api/audio', {
                method: 'POST',
                body: formData,
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to analyze audio');
            }

            const data = await response.json();
            setTranscript(data.transcript || 'No transcription available');
            setAnswer(data.answer || 'No answer generated');
        } catch (error) {
            console.error('Error:', error);
            setAnswer('Failed to analyze audio. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const handleClear = () => {
        if (preview) {
            URL.revokeObjectURL(preview);
        }
        setAudio(null);
        setPreview('');
        setQuestion('');
        setTranscript('');
        setAnswer('');
        setRecordingTime(0);
    };

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    return (
        <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl shadow-2xl p-6 border border-slate-700">
            <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-700">
                <Mic className="w-6 h-6 text-green-400" />
                <h2 className="text-xl font-bold text-white">Audio Analysis</h2>
            </div>

            <div className="space-y-6">
                {/* Audio Upload or Recording */}
                <div>
                    <label className="block mb-3 font-semibold text-white">Upload or Record Audio</label>

                    {/* Recording Controls */}
                    <div className="mb-4 p-4 bg-slate-700/50 rounded-xl">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                {isRecording ? (
                                    <button
                                        onClick={stopRecording}
                                        className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-semibold transition-colors"
                                    >
                                        <StopCircle className="w-5 h-5" />
                                        Stop Recording
                                    </button>
                                ) : (
                                    <button
                                        onClick={startRecording}
                                        className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-semibold transition-colors"
                                    >
                                        <Mic className="w-5 h-5" />
                                        Start Recording
                                    </button>
                                )}
                            </div>

                            {isRecording && (
                                <div className="flex items-center gap-2">
                                    <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
                                    <span className="text-white font-mono">{formatTime(recordingTime)}</span>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* File Upload */}
                    <div className="relative">
                        <input
                            type="file"
                            accept="audio/*"
                            onChange={handleAudioChange}
                            className="hidden"
                            id="audio-upload"
                        />
                        <label
                            htmlFor="audio-upload"
                            className="flex items-center justify-center w-full p-8 border-2 border-dashed border-slate-600 rounded-xl hover:border-green-500 transition-colors cursor-pointer bg-slate-700/30"
                        >
                            {preview ? (
                                <div className="w-full">
                                    <audio src={preview} controls className="w-full" />
                                    <p className="text-center text-slate-300 mt-3">{audio?.name}</p>
                                    <p className="text-center text-slate-500 text-sm mt-1">
                                        Size: {((audio?.size || 0) / 1024 / 1024).toFixed(2)}MB
                                    </p>
                                </div>
                            ) : (
                                <div className="text-center">
                                    <Upload className="w-12 h-12 mx-auto mb-3 text-slate-400" />
                                    <p className="text-slate-300">Click to upload audio file</p>
                                    <p className="text-sm text-slate-500 mt-1">MP3, WAV, M4A up to 2MB for transcription</p>
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
                        placeholder="What is being discussed in this audio?"
                        rows={3}
                        className="w-full p-4 bg-slate-700 text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 placeholder-slate-400 resize-none"
                    />
                </div>

                {/* Save to Memory Checkbox */}
                <div className="flex items-center gap-2">
                    <input
                        type="checkbox"
                        id="save-audio-memory"
                        checked={saveToMemory}
                        onChange={(e) => setSaveToMemory(e.target.checked)}
                        className="w-4 h-4 text-green-600 rounded focus:ring-green-500"
                    />
                    <label htmlFor="save-audio-memory" className="text-slate-300 cursor-pointer">
                        Save analysis to memory
                    </label>
                </div>

                {/* Buttons */}
                <div className="flex gap-3">
                    <button
                        onClick={handleAnalyze}
                        disabled={!audio || !question || loading}
                        className="flex-1 py-4 bg-gradient-to-r from-green-600 to-teal-600 text-white rounded-xl hover:from-green-700 hover:to-teal-700 disabled:opacity-50 disabled:cursor-not-allowed font-semibold transition-all transform hover:scale-105 flex items-center justify-center gap-2"
                    >
                        {loading ? (
                            <>
                                <Loader2 className="w-5 h-5 animate-spin" />
                                Analyzing...
                            </>
                        ) : (
                            <>
                                <Play className="w-5 h-5" />
                                Analyze Audio
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

                {/* Transcript Display */}
                {transcript && (
                    <div className="p-6 bg-slate-700/50 rounded-xl border border-slate-600">
                        <h3 className="font-semibold mb-3 text-white flex items-center gap-2">
                            <Mic className="w-5 h-5 text-green-400" />
                            Transcription:
                        </h3>
                        <p className="whitespace-pre-wrap text-slate-200 leading-relaxed">{transcript}</p>
                    </div>
                )}

                {/* Answer Display */}
                {answer && (
                    <div className="p-6 bg-slate-700/50 rounded-xl border border-slate-600">
                        <h3 className="font-semibold mb-3 text-white flex items-center gap-2">
                            <Mic className="w-5 h-5 text-green-400" />
                            Analysis Result:
                        </h3>
                        <p className="whitespace-pre-wrap text-slate-200 leading-relaxed">{answer}</p>
                    </div>
                )}
            </div>
        </div>
    );
}
