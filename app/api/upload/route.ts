import { NextResponse } from 'next/server';
import { put } from '@vercel/blob';
import { auth } from '@/lib/auth';
import { isValidImageType, MAX_FILE_SIZE, VALID_IMAGE_TYPES_DISPLAY } from '@/lib/upload-constants';

export async function POST(request: Request) {
  let fileName = 'unknown';
  let userId = 'unknown';
  
  try {
    // Check authentication
    const session = await auth();
    userId = session?.user?.id ?? 'unknown';
    
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Check if user is admin
    if (session.user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Forbidden: Admin access required' },
        { status: 403 }
      );
    }

    // Get the form data
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    fileName = file.name;

    // Validate file type
    if (!isValidImageType(file.type)) {
      return NextResponse.json(
        { error: `Invalid file type. Only ${VALID_IMAGE_TYPES_DISPLAY} are allowed.` },
        { status: 400 }
      );
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB.` },
        { status: 400 }
      );
    }

    // Upload to Vercel Blob
    const blob = await put(file.name, file, {
      access: 'public',
      addRandomSuffix: true,
    });

    return NextResponse.json({
      success: true,
      data: {
        url: blob.url,
        pathname: blob.pathname,
        contentType: blob.contentType,
      },
    });
  } catch (error) {
    console.error('Upload error:', {
      error,
      fileName,
      userId,
    });
    return NextResponse.json(
      { error: 'Failed to upload file' },
      { status: 500 }
    );
  }
}
