import { NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { auth } from "@/lib/auth";
import {
  isValidImageType,
  MAX_FILE_SIZE,
  VALID_IMAGE_TYPES_DISPLAY,
} from "@/lib/upload-constants";
import { logError } from "@/lib/logger";

export async function POST(request: Request) {
  let fileName = "unknown";
  let userId = "unknown";

  try {
    const session = await auth();
    userId = session?.user?.id ?? "unknown";

    const errorMap: Record<string, { message: string; status: number }> = {
      unauthorized: { message: "Unauthorized", status: 401 },
      forbidden: { message: "Forbidden: Admin access required", status: 403 },
    };

    let errorKey: string | null = null;
    if (!session?.user) {
      errorKey = "unauthorized";
    } else if (session.user.role !== "ADMIN") {
      errorKey = "forbidden";
    }

    if (errorKey) {
      const { message, status } = errorMap[errorKey];
      return NextResponse.json({ error: message }, { status });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    fileName = file.name;

    if (!isValidImageType(file.type)) {
      return NextResponse.json(
        {
          error: `Invalid file type. Only ${VALID_IMAGE_TYPES_DISPLAY} are allowed.`,
        },
        { status: 400 },
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        {
          error: `File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB.`,
        },
        { status: 400 },
      );
    }

    const blob = await put(file.name, file, {
      access: "public",
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
    logError({
      error,
      context: "file_upload",
      additionalInfo: { fileName, userId },
    });
    return NextResponse.json(
      { error: "Failed to upload file" },
      { status: 500 },
    );
  }
}
