import { NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";

const MAX_BYTES = 8 * 1024 * 1024;
const ALLOWED_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export async function POST(req: Request) {
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

  const uploadsDir = path.join(process.cwd(), "uploads");
  const filename = `${randomUUID()}.${ext}`;
  const dest = path.join(uploadsDir, filename);
  const buffer = Buffer.from(await file.arrayBuffer());
  await mkdir(uploadsDir, { recursive: true });
  await writeFile(dest, buffer);

  return NextResponse.json({ path: `/uploads/${filename}` }, { status: 201 });
}
