import { validateCsrfToken } from "@/lib/csrf";
import { randomUUID } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import { NextResponse, type NextRequest } from "next/server";
import path from "path";

const MAX_BYTES = 8 * 1024 * 1024;
const ALLOWED_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

/**
 * Verifies the file's leading bytes match its declared image type. The browser
 * `File.type` is client-controlled, so without this a caller could store an
 * arbitrary payload (HTML/SVG/script) under an image extension.
 */
function sniffMatchesMime(buffer: Buffer, mime: string): boolean {
  if (mime === "image/jpeg") {
    return buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  }
  if (mime === "image/png") {
    const sig = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
    return buffer.length >= 8 && sig.every((b, i) => buffer[i] === b);
  }
  if (mime === "image/webp") {
    return (
      buffer.length >= 12 &&
      buffer.toString("ascii", 0, 4) === "RIFF" &&
      buffer.toString("ascii", 8, 12) === "WEBP"
    );
  }
  return false;
}

export async function POST(req: NextRequest) {
  // Mutating endpoint: enforce CSRF like every other write route. This handler
  // does not go through the json() wrapper, so the check is applied directly.
  if (!validateCsrfToken(req)) {
    return NextResponse.json({ error: "invalid_csrf" }, { status: 403 });
  }

  const formData = await req.formData().catch(() => null);
  const file = formData?.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "File too large (max 8 MB)" }, { status: 413 });
  }
  const ext = ALLOWED_MIME[file.type];
  if (!ext) {
    return NextResponse.json({ error: "Unsupported file type" }, { status: 415 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  if (!sniffMatchesMime(buffer, file.type)) {
    return NextResponse.json({ error: "File content does not match its type" }, { status: 415 });
  }

  const uploadsDir = path.join(process.cwd(), "uploads");
  const filename = `${randomUUID()}.${ext}`;
  const dest = path.join(uploadsDir, filename);
  await mkdir(uploadsDir, { recursive: true });
  await writeFile(dest, buffer);

  return NextResponse.json({ path: `/uploads/${filename}` }, { status: 201 });
}
