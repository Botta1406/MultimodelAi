export interface UploadResult {
    success: boolean;
    url: string;
    key: string;
    size: number;
    contentType: string;
}

export class R2Service {
    private accountId: string;
    private apiToken: string;
    private bucketName: string;
    private publicUrl: string;

    constructor(
        accountId: string,
        apiToken: string,
        bucketName: string = 'multimodalai',
        publicUrl?: string
    ) {
        this.accountId = accountId;
        this.apiToken = apiToken;
        this.bucketName = bucketName;
        this.publicUrl = publicUrl || process.env.R2_PUBLIC_URL || '';
    }

    /**
     * Upload a file to R2
     */
    async uploadFile(
        file: File | Buffer,
        key: string,
        contentType?: string
    ): Promise<UploadResult> {
        try {
            console.log('🔵 R2 uploadFile called:', {
                key,
                contentType,
                fileType: file instanceof File ? 'File' : 'Buffer',
                bucketName: this.bucketName,
            });

            // Convert to buffer
            const buffer = file instanceof File ? await file.arrayBuffer() : file;
            const uint8Array = new Uint8Array(buffer);

            console.log('📊 File info:', {
                size: uint8Array.length,
                contentType: contentType || 'application/octet-stream',
            });

            // R2 API endpoint
            const url = `https://api.cloudflare.com/client/v4/accounts/${this.accountId}/r2/buckets/${this.bucketName}/objects/${encodeURIComponent(key)}`;

            console.log('📡 Upload URL:', url);

            const response = await fetch(url, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${this.apiToken}`,
                    'Content-Type': contentType || 'application/octet-stream',
                    'Content-Length': uint8Array.length.toString(),
                },
                body: uint8Array,
            });

            console.log('📥 R2 Response:', {
                status: response.status,
                statusText: response.statusText,
                ok: response.ok,
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error('❌ R2 upload failed:', {
                    status: response.status,
                    statusText: response.statusText,
                    error: errorText,
                });
                throw new Error(`R2 upload failed: ${response.statusText} - ${errorText}`);
            }

            const publicUrl = `${this.publicUrl}/${key}`;
            console.log('✅ R2 upload successful!', { publicUrl });

            return {
                success: true,
                url: publicUrl,
                key,
                size: uint8Array.length,
                contentType: contentType || 'application/octet-stream',
            };
        } catch (error) {
            console.error('❌ R2 upload error:', error);
            if (error instanceof Error) {
                console.error('Error details:', {
                    message: error.message,
                    stack: error.stack,
                });
            }
            throw error;
        }
    }

    /**
     * Generate a unique key for the file
     */
    generateKey(prefix: string, filename: string): string {
        const timestamp = Date.now();
        const random = Math.random().toString(36).substring(7);
        const extension = filename.split('.').pop() || 'bin';
        const cleanFilename = filename.replace(/[^a-zA-Z0-9.-]/g, '_');
        const shortName = cleanFilename.substring(0, 50); // Limit filename length
        return `${prefix}/${timestamp}-${random}-${shortName}`;
    }

    /**
     * Delete a file from R2
     */
    async deleteFile(key: string): Promise<boolean> {
        try {
            const url = `https://api.cloudflare.com/client/v4/accounts/${this.accountId}/r2/buckets/${this.bucketName}/objects/${encodeURIComponent(key)}`;

            const response = await fetch(url, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${this.apiToken}`,
                },
            });

            if (!response.ok) {
                console.error('R2 delete failed:', response.statusText);
                return false;
            }

            console.log('✅ R2 file deleted:', key);
            return true;
        } catch (error) {
            console.error('R2 delete error:', error);
            return false;
        }
    }

    /**
     * Get file info
     */
    async getFileInfo(key: string): Promise<any> {
        try {
            const url = `https://api.cloudflare.com/client/v4/accounts/${this.accountId}/r2/buckets/${this.bucketName}/objects/${encodeURIComponent(key)}`;

            const response = await fetch(url, {
                method: 'HEAD',
                headers: {
                    'Authorization': `Bearer ${this.apiToken}`,
                },
            });

            if (!response.ok) {
                throw new Error('File not found');
            }

            return {
                size: response.headers.get('content-length'),
                contentType: response.headers.get('content-type'),
                lastModified: response.headers.get('last-modified'),
            };
        } catch (error) {
            console.error('R2 get info error:', error);
            throw error;
        }
    }

    /**
     * List files in a prefix
     */
    async listFiles(prefix: string = ''): Promise<string[]> {
        try {
            const url = `https://api.cloudflare.com/client/v4/accounts/${this.accountId}/r2/buckets/${this.bucketName}/objects`;

            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${this.apiToken}`,
                },
            });

            if (!response.ok) {
                throw new Error('Failed to list files');
            }

            const data = await response.json();
            return data.result?.objects?.map((obj: any) => obj.key) || [];
        } catch (error) {
            console.error('R2 list error:', error);
            return [];
        }
    }
}
