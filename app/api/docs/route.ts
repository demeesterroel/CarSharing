import { NextResponse } from "next/server";
import { readFileSync } from "fs";
import { join } from "path";

export async function GET() {
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const yaml = readFileSync(join(process.cwd(), "docs/openapi.yaml"), "utf-8");
  return new NextResponse(yaml, { headers: { "Content-Type": "application/yaml" } });
}
