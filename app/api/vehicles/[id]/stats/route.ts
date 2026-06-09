import { getCarStats } from "@/lib/queries/cars";
import { getDb } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const id = parseInt(params.id, 10);
  const { searchParams } = new URL(request.url);
  const yearParam = searchParams.get("year");
  
  if (isNaN(id)) {
    return NextResponse.json({ error: "Invalid car ID" }, { status: 400 });
  }
  
  const year = yearParam ? parseInt(yearParam, 10) : new Date().getFullYear();
  
  const db = getDb();
  const stats = getCarStats(db, id, year);
  
  return NextResponse.json(stats);
}