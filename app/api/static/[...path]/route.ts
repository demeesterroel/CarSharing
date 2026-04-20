import { NextResponse } from "next/server";
import { readFile } from "fs/promises";
import path from "path";

const MIME_BY_EXT: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

export async function GET(
  _: Request,
  ctx: { params: Promise<{ path: string[] }> }
) {
  const { path: parts } = await ctx.params;
  const uploadsRoot = path.resolve(process.cwd(), "uploads");
  const filePath = path.resolve(uploadsRoot, ...parts);

  const relative = path.relative(uploadsRoot, filePath);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const file = await readFile(filePath);
    const ext = parts.at(-1)?.split(".").pop()?.toLowerCase() ?? "";
    const mime = MIME_BY_EXT[ext] ?? "application/octet-stream";
    return new Response(new Uint8Array(file), {
      headers: { "Content-Type": mime, "Cache-Control": "public, max-age=31536000, immutable" },
    });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}
