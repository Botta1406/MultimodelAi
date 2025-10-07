'use client';

import { useState } from 'react';
import { Image as ImageIcon, Upload, Loader2, Play, X, RefreshCw } from 'lucide-react';

export default function ImageUpload() {
    const [image, setImage] = useState<File | null>(null);
    const [preview, setPreview] = useState<string>('');
    const [question, setQuestion] = useState('');
    const [answer, setAnswer] = useState('');
    const [loading, setLoading] = useState(false);
    const [saveToMemory, setSaveToMemory] = useState(true);

    const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            if (preview) {
                URL.revokeObjectURL(preview);
            }
            setImage(file);
            const url = URL.createObjectURL(file);
            setPreview(url);
            setAnswer('');
        }
    };

    const handleRemoveImage = () => {
        if (preview) {
            URL.revokeObjectURL(preview);
        }
        setImage(null);
        setPreview('');
        setAnswer('');
    };

    const handleAnalyze = async () => {
        if (!image) {
            alert('Please upload an image');
            return;
        }

        if (!question) {
            alert('Please enter a question about the image');
            return;
        }

        setLoading(true);
        setAnswer('');

        try {
            const formData = new FormData();
            formData.append('image', image);
            formData.append('question', question);
            formData.append('saveToMemory', saveToMemory.toString());

            const response = await fetch('/api/image', {
                method: 'POST',
                body: formData,
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to analyze image');
            }

            const data = await response.json();
            setAnswer(data.response || 'No response received');
        } catch (error) {
            console.error('Error:', error);
            setAnswer('Failed to analyze image. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const handleClear = () => {
        handleRemoveImage();
        setQuestion('');
        setAnswer('');
    };

    return (
        <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl shadow-2xl p-6 border border-slate-700">
            <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-700">
                <ImageIcon className="w-6 h-6 text-blue-400" />
                <h2 className="text-xl font-bold text-white">Image Analysis</h2>
            </div>

            <div className="space-y-6">
                {/* Upload Area */}
                <div>
                    <label className="block mb-3 font-semibold text-white">Upload Image</label>
                    <div className="relative">
                        <input
                            type="file"
                            accept="image/*"
                            onChange={handleImageChange}
                            className="hidden"
                            id="image-upload"
                        />
                        <label
                            htmlFor="image-upload"
                            className="flex items-center justify-center w-full p-8 border-2 border-dashed border-slate-600 rounded-xl hover:border-blue-500 transition-colors cursor-pointer bg-slate-700/30"
                        >
                            <div className="text-center">
                                <Upload className="w-12 h-12 mx-auto mb-3 text-slate-400" />
                                <p className="text-slate-300">Click to upload image</p>
                                <p className="text-sm text-slate-500 mt-1">PNG, JPG, WEBP up to 10MB</p>
                            </div>
                        </label>
                    </div>
                </div>

                {/* Uploaded Files Section */}
                {image && (
                    <div className="p-4 bg-slate-700/50 rounded-xl border border-slate-600">
                        <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                            <ImageIcon className="w-4 h-4" />
                            Uploaded Image
                        </h3>
                        <div className="flex items-start gap-4 p-3 bg-slate-800/50 rounded-lg">
                            {/* Thumbnail */}
                            <img
                                src={preview}
                                alt={image.name}
                                className="w-20 h-20 object-cover rounded-lg border border-slate-600"
                            />

                            {/* File Info */}
                            <div className="flex-1 min-w-0">
                                <p className="text-white font-medium truncate">{image.name}</p>
                                <p className="text-slate-400 text-sm">
                                    {(image.size / 1024).toFixed(2)} KB • {image.type}
                                </p>
                            </div>

                            {/* Actions */}
                            <div className="flex gap-2">
                                <label
                                    htmlFor="image-upload"
                                    className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium cursor-pointer flex items-center gap-2 transition-colors"
                                >
                                    <RefreshCw className="w-4 h-4" />
                                    Replace
                                </label>
                                <button
                                    onClick={handleRemoveImage}
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
                        onChange={(e) => setQuestion(e.target.value)}
                        placeholder="What do you see in this image?"
                        rows={3}
                        className="w-full p-4 bg-slate-700 text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-slate-400 resize-none"
                    />
                </div>

                {/* Save to Memory Checkbox */}
                <div className="flex items-center gap-2">
                    <input
                        type="checkbox"
                        id="save-image-memory"
                        checked={saveToMemory}
                        onChange={(e) => setSaveToMemory(e.target.checked)}
                        className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                    />
                    <label htmlFor="save-image-memory" className="text-slate-300 cursor-pointer">
                        Save analysis to memory
                    </label>
                </div>

                {/* Buttons */}
                <div className="flex gap-3">
                    <button
                        onClick={handleAnalyze}
                        disabled={!image || !question || loading}
                        className="flex-1 py-4 bg-gradient-to-r from-blue-600 to-cyan-600 text-white rounded-xl hover:from-blue-700 hover:to-cyan-700 disabled:opacity-50 disabled:cursor-not-allowed font-semibold transition-all transform hover:scale-105 flex items-center justify-center gap-2"
                    >
                        {loading ? (
                            <>
                                <Loader2 className="w-5 h-5 animate-spin" />
                                Analyzing...
                            </>
                        ) : (
                            <>
                                <Play className="w-5 h-5" />
                                Analyze Image
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
                            <ImageIcon className="w-5 h-5 text-blue-400" />
                            Analysis Result:
                        </h3>
                        <p className="whitespace-pre-wrap text-slate-200 leading-relaxed">{answer}</p>
                    </div>
                )}
            </div>
        </div>
    );
}
