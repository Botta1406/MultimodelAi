import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';

export async function GET(request: NextRequest) {
    try {
        const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
        const apiToken = process.env.CLOUDFLARE_API_TOKEN;
        const publicUrl = process.env.R2_PUBLIC_URL;

        console.log('🔍 Testing R2 configuration...');
        console.log('Account ID:', accountId ? accountId.substring(0, 8) + '...' : 'MISSING');
        console.log('API Token:', apiToken ? apiToken.substring(0, 10) + '...' : 'MISSING');
        console.log('Public URL:', publicUrl || 'MISSING');

        if (!accountId || !apiToken || !publicUrl) {
            return NextResponse.json({
                success: false,
                error: 'Missing configuration',
                config: {
                    hasAccountId: !!accountId,
                    hasApiToken: !!apiToken,
                    hasPublicUrl: !!publicUrl,
                }
            }, { status: 500 });
        }

        // Test upload a simple text file
        const testContent = 'Hello from Cloudflare R2! Test at: ' + new Date().toISOString();
        const encoder = new TextEncoder();
        const data = encoder.encode(testContent);
        const key = `test/hello-${Date.now()}.txt`;

        console.log('📤 Uploading test file to R2...');
        console.log('Bucket:', 'multimodalai');
        console.log('Key:', key);

        const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/r2/buckets/multimodalai/objects/${encodeURIComponent(key)}`;

        const response = await fetch(url, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${apiToken}`,
                'Content-Type': 'text/plain',
                'Content-Length': data.length.toString(),
            },
            body: data,
        });

        console.log('📥 R2 Response status:', response.status, response.statusText);

        const responseText = await response.text();
        console.log('📥 R2 Response body:', responseText);

        if (!response.ok) {
            return NextResponse.json({
                success: false,
                error: 'R2 upload failed',
                status: response.status,
                statusText: response.statusText,
                response: responseText,
            }, { status: 500 });
        }

        const publicFileUrl = `${publicUrl}/${key}`;

        console.log('✅ Upload successful!');
        console.log('🔗 Public URL:', publicFileUrl);

        return NextResponse.json({
            success: true,
            message: 'File uploaded to R2 successfully! 🎉',
            fileUrl: publicFileUrl,
            key: key,
            bucketSize: data.length,
        });
    } catch (error) {
        console.error('❌ R2 test error:', error);
        return NextResponse.json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
            stack: error instanceof Error ? error.stack : undefined,
        }, { status: 500 });
    }
}
