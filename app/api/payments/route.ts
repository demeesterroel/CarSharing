import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { getPayments, insertPayment } from "@/lib/queries/payments";
import { json, readBody } from "@/lib/api";

const PaymentSchema = z.object({
  person_id: z.number().int().positive(),
  date: z.string().min(10),
  amount: z.number().positive(),
  note: z.string().nullable().optional().transform((v) => v ?? null),
});

export const GET = json(async () => getPayments(getDb()));

export const POST = json(async (req) => {
  const body = await readBody(req, PaymentSchema);
  const id = insertPayment(getDb(), body);
  return NextResponse.json({ id }, { status: 201 });
});
