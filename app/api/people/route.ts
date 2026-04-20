import { z } from "zod";
import { getDb } from "@/lib/db";
import { getPeople, insertPerson } from "@/lib/queries/people";
import { json, readBody } from "@/lib/api";

const PersonSchema = z.object({
  name: z.string().min(1),
  discount: z.number().min(0).max(1).default(0),
  discount_long: z.number().min(0).max(1).default(0),
  active: z.union([z.literal(0), z.literal(1)]).default(1),
});

export const GET = json(async () => getPeople(getDb()));

export const POST = json(async (req) => {
  const data = await readBody(req, PersonSchema);
  const id = insertPerson(getDb(), data);
  return Response.json({ id }, { status: 201 });
});
