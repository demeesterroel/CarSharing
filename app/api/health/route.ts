import { NextResponse } from "next/server";

import { version } from "@/package.json";

export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json({ ok: true, version });
}

export function HEAD() {
  return new NextResponse(null, { status: 200 });
}
