import { forbidden, json, notFound, readBody, readId } from "@/lib/api";
import { getDb } from "@/lib/db";
import { getPersonById, updatePerson } from "@/lib/queries/people";
import { sessionOptions, type SessionData } from "@/lib/session";
import { getIronSession } from "iron-session";
import { NextResponse } from "next/server";
import { z } from "zod";

const profileSchema = z.object({
  first_name: z.string().min(1),
  last_name: z.string().default(""),
  bank_account: z.string().default(""),
  email: z
    .string()
    .email()
    .nullable()
    .optional()
    .transform((v) => v ?? null),
  theme_preference: z.enum(["paper", "mono"]).optional(),
  // Driver/member prefs
  notify_new_reservations: z.enum(["off", "all"]).optional(),
  notify_reservation_updates: z.enum(["off", "all", "mine"]).optional(),
  notify_new_trips: z.enum(["off", "all"]).optional(),
  // Owner prefs (events on cars I own)
  notify_my_car_reservations: z.enum(["off", "on"]).optional(),
  notify_my_car_trips: z.enum(["off", "on"]).optional(),
});

export const PATCH = json(async (req, ctx) => {
  const res = NextResponse.next();
  const session = await getIronSession<SessionData>(req, res, sessionOptions);
  const id = await readId(ctx);
  if (!session.authenticated) forbidden("Unauthorized");
  if (session.personId !== id && !session.isAdmin) forbidden("Forbidden");
  const data = await readBody(req, profileSchema);
  const existing = getPersonById(getDb(), id);
  if (!existing) notFound();
  updatePerson(getDb(), id, {
    ...existing,
    first_name: data.first_name,
    last_name: data.last_name,
    bank_account: data.bank_account,
    email: data.email ?? null,
    theme_preference: data.theme_preference ?? existing.theme_preference,
    notify_new_reservations: data.notify_new_reservations ?? existing.notify_new_reservations,
    notify_reservation_updates:
      data.notify_reservation_updates ?? existing.notify_reservation_updates,
    notify_new_trips: data.notify_new_trips ?? existing.notify_new_trips,
    notify_my_car_reservations:
      data.notify_my_car_reservations ?? existing.notify_my_car_reservations,
    notify_my_car_trips: data.notify_my_car_trips ?? existing.notify_my_car_trips,
  });
  return { ok: true };
});
