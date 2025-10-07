export type MemoryType = 'text' | 'image' | 'video' | 'audio' | 'general';

export interface UploadedFile {
    file: File;
    preview: string;
    name: string;
    size: number;
    type: string;
}

export interface ImageAnalysisResponse {
    response: string;
    memorySaved: boolean;
    imageUrl?: string;
}

export interface VideoAnalysisResponse {
    answer: string;
    frameAnalyses: FrameAnalysis[];
    audioTranscript?: string;
    videoUrl?: string;
}

export interface AudioAnalysisResponse {
    transcript: string;
    answer?: string;
    audioUrl?: string;
    memorySaved: boolean;
    fileSizeMB: string;
    transcriptionSkipped: boolean;
}

export interface FrameAnalysis {
    timestamp: number;
    description: string;
}

export interface VideoFrame {
    timestamp: number;
    base64: string;
}

export interface APIError {
    error: string;
    details?: string;
}
