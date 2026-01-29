/**
 * Blob upload endpoint
 * Converts images to WEBP, uploads to Vercel Blob
 * 
 * SECURITY: Token must be in .env.local and Vercel env vars
 * Do NOT hardcode token in code.
 */

import { NextRequest, NextResponse } from 'next/server';
import { put } from '@vercel/blob';
import sharp from 'sharp';
import { requireAdmin } from '@/lib/auth/admin-auth';

export const runtime = 'nodejs'; // Required for sharp

export async function POST(request: NextRequest) {
  try {
    // Auth check
    const { error, user } = await requireAdmin();
    if (error) return error;

    // Check token
    const token = process.env.BLOB_READ_WRITE_TOKEN;
    if (!token) {
      console.error('BLOB_READ_WRITE_TOKEN not found in environment');
      return NextResponse.json(
        { error: 'Blob storage not configured. BLOB_READ_WRITE_TOKEN must be set in .env.local and Vercel env vars.' },
        { status: 500 }
      );
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;
    const folder = formData.get('folder') as string || 'products';
    const filenameBase = formData.get('filenameBase') as string || 'image';

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Convert to buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Process with sharp: convert to WEBP, constrain to 1200x1800 (fit: contain, keep alpha)
    const processedBuffer = await sharp(buffer)
      .resize(1200, 1800, {
        fit: 'contain',
        background: { r: 0, g: 0, b: 0, alpha: 0 }, // Transparent background
        withoutEnlargement: true,
      })
      .webp({ quality: 90, effort: 6 })
      .toBuffer();

    // Get metadata
    const metadata = await sharp(processedBuffer).metadata();

    // Generate filename
    const timestamp = Date.now();
    const filename = `${folder}/${filenameBase}-${timestamp}.webp`;

    // Upload to Vercel Blob
    const blob = await put(filename, processedBuffer, {
      access: 'public',
      token,
      contentType: 'image/webp',
    });

    return NextResponse.json({
      url: blob.url,
      contentType: 'image/webp',
      size: processedBuffer.length,
      width: metadata.width,
      height: metadata.height,
    });
  } catch (error) {
    console.error('Blob upload error:', error);
    return NextResponse.json(
      { error: 'Failed to upload file', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
