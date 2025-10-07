export interface VideoFrame {
    timestamp: number;
    base64: string;
}

export class VideoProcessor {
    static async extractFrames(
        videoFile: File,
        intervalSeconds: number = 5,
        maxFrames: number = 10
    ): Promise<VideoFrame[]> {
        return new Promise((resolve, reject) => {
            const video = document.createElement('video');
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            const frames: VideoFrame[] = [];

            if (!ctx) {
                reject(new Error('Failed to get canvas context'));
                return;
            }

            video.preload = 'metadata';
            video.src = URL.createObjectURL(videoFile);

            video.onloadedmetadata = () => {
                canvas.width = Math.min(video.videoWidth, 1280);
                canvas.height = Math.min(video.videoHeight, 720);
                const duration = video.duration;
                let currentTime = 0;
                const frameInterval = Math.max(intervalSeconds, duration / maxFrames);

                const captureFrame = () => {
                    if (currentTime > duration || frames.length >= maxFrames) {
                        URL.revokeObjectURL(video.src);
                        resolve(frames);
                        return;
                    }

                    video.currentTime = Math.min(currentTime, duration);
                };

                video.onseeked = () => {
                    if (ctx) {
                        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                        const base64 = canvas.toDataURL('image/jpeg', 0.7).split(',')[1];

                        frames.push({
                            timestamp: currentTime,
                            base64,
                        });

                        currentTime += frameInterval;
                        captureFrame();
                    }
                };

                video.onerror = () => reject(new Error('Failed to load video'));
                captureFrame();
            };
        });
    }

    static async extractAudio(videoFile: File): Promise<string> {
        try {
            const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
            const arrayBuffer = await videoFile.arrayBuffer();
            const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

            const wavData = this.audioBufferToWav(audioBuffer);
            const base64 = btoa(
                new Uint8Array(wavData).reduce(
                    (data, byte) => data + String.fromCharCode(byte),
                    ''
                )
            );

            return base64;
        } catch (error) {
            console.error('Audio extraction error:', error);
            return '';
        }
    }

    private static audioBufferToWav(buffer: AudioBuffer): ArrayBuffer {
        const length = buffer.length * buffer.numberOfChannels * 2 + 44;
        const arrayBuffer = new ArrayBuffer(length);
        const view = new DataView(arrayBuffer);
        const channels: Float32Array[] = [];
        let pos = 0;

        const setUint16 = (data: number) => {
            view.setUint16(pos, data, true);
            pos += 2;
        };

        const setUint32 = (data: number) => {
            view.setUint32(pos, data, true);
            pos += 4;
        };

        // WAV header
        setUint32(0x46464952); // "RIFF"
        setUint32(length - 8);
        setUint32(0x45564157); // "WAVE"
        setUint32(0x20746d66); // "fmt "
        setUint32(16);
        setUint16(1);
        setUint16(buffer.numberOfChannels);
        setUint32(buffer.sampleRate);
        setUint32(buffer.sampleRate * 2 * buffer.numberOfChannels);
        setUint16(buffer.numberOfChannels * 2);
        setUint16(16);
        setUint32(0x61746164); // "data"
        setUint32(length - pos - 4);

        // Write audio data
        for (let i = 0; i < buffer.numberOfChannels; i++) {
            channels.push(buffer.getChannelData(i));
        }

        let offset = 0;
        while (pos < length) {
            for (let i = 0; i < buffer.numberOfChannels; i++) {
                const sample = Math.max(-1, Math.min(1, channels[i][offset]));
                view.setInt16(pos, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
                pos += 2;
            }
            offset++;
        }

        return arrayBuffer;
    }
}
