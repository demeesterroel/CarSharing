import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getPayments, insertPayment } from "@/lib/queries/payments";
import { json, readBody } from "@/lib/api";
import { paymentSchema } from "@/lib/schemas/payment";

export const GET = json(async () => getPayments(getDb()));

export const POST = json(async (req) => {
  const body = await readBody(req, paymentSchema);
  const id = insertPayment(getDb(), body);
  return NextResponse.json({ id }, { status: 201 });
});
