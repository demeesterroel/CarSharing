import { json } from "@/lib/api";
import { getDb } from "@/lib/db";
import { getDashboard } from "@/lib/queries/dashboard";
import { NextResponse } from "next/server";

export const GET = json(async (req) => {
  const { searchParams } = new URL(req.url);
  const raw = searchParams.get("year");
  const year = raw ? Number(raw) : new Date().getFullYear();
  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    return NextResponse.json({ error: "Invalid year" }, { status: 400 });
  }
  return getDashboard(getDb(), year);
});
