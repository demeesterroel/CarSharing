"use client";
import { useEffect, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { CarToggle } from "@/components/car-toggle";
import { usePeople } from "@/hooks/use-people";
import { useCars } from "@/hooks/use-cars";
import { useMe } from "@/hooks/use-me";
import { useReservations } from "@/hooks/use-reservations";
import type { Reservation, ReservationInput } from "@/types";
import { useT, useLocale } from "@/components/locale-provider";
import { paper, fontMono, fontSerif, fmtDate } from "@/lib/paper-theme";
import { PickCalendar } from "@/components/pick-calendar";

const schema = z
  .object({
    person_id: z.number({ error: "Persoon vereist" }),
    car_id: z.number({ error: "Wagen vereist" }),
    start_date: z.string().min(1),
    end_date: z.string().min(1),
    note: z.string().nullable().optional().transform((v) => v || null),
  })
  .refine((v) => v.end_date >= v.start_date, {
    message: "Einddatum moet na startdatum zijn",
    path: ["end_date"],
  });
type FormInput = z.input<typeof schema>;
type FormData  = z.output<typeof schema>;

interface Props {
  defaultValues?: Partial<Reservation>;
  onSubmit: (data: ReservationInput) => void;
  onCancel: () => void;
}

function addDays(date: string, n: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function diffDays(start: string, end: string): number {
  return Math.round((new Date(end).getTime() - new Date(start).getTime()) / 86400000) + 1;
}

const label: React.CSSProperties = {
  fontFamily: fontMono, fontSize: 9, fontWeight: 700, letterSpacing: 2,
  textTransform: "uppercase", color: paper.inkMute, display: "block", marginBottom: 4,
};

export function ReservationForm({ defaultValues, onSubmit, onCancel }: Props) {
  const t = useT();
  const { locale } = useLocale();
  const { data: people = [] } = usePeople();
  const { data: cars = [] } = useCars();
  const { data: me } = useMe();
  const { data: reservations = [] } = useReservations();
  const isAdmin = me?.isAdmin ?? false;
  const today = new Date().toISOString().slice(0, 10);

  const { register, handleSubmit, control, watch, setValue, getValues } = useForm<FormInput, unknown, FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      start_date: defaultValues?.start_date ?? today,
      end_date: defaultValues?.end_date ?? today,
      person_id: defaultValues?.person_id,
      car_id: defaultValues?.car_id,
      note: defaultValues?.note ?? null,
    },
  });

  useEffect(() => {
    if (!defaultValues?.person_id && me?.personId && !getValues("person_id")) {
      setValue("person_id", me.personId);
    }
  }, [me, defaultValues, setValue, getValues]);

  const [weekOffset, setWeekOffset] = useState(0);

  const [startDate, endDate, carId, personId] = watch(["start_date", "end_date", "car_id", "person_id"]);
  const person = people.find((p) => p.id === personId);
  const dayCount = startDate && endDate && endDate >= startDate ? diffDays(startDate, endDate) : 1;

  // Conflict detection
  const conflicts = reservations.filter((r) => {
    if (r.status === "rejected") return false;
    if (r.car_id !== carId) return false;
    if (defaultValues?.id && r.id === defaultValues.id) return false;
    return r.start_date <= endDate && r.end_date >= startDate;
  });

  // 14 days (2 rows × 7) centered on startDate, shifted by weekOffset
  const stripStart = addDays(startDate || today, weekOffset * 7 - 3);
  const stripDays = Array.from({ length: 14 }, (_, i) => addDays(stripStart, i));

  function handleFormSubmit(data: FormData) {
    onSubmit({
      person_id: data.person_id,
      car_id: data.car_id,
      start_date: data.start_date,
      end_date: data.end_date,
      note: data.note,
    });
  }

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} style={{ background: paper.paperDeep }}>
      {/* Top bar */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0 16px", height: 52,
        borderBottom: `1.5px solid ${paper.paperDark}`,
        background: paper.paper,
        position: "sticky", top: 0, zIndex: 10,
        borderRadius: "14px 14px 0 0",
      }}>
        <button type="button" onClick={onCancel} style={{
          fontFamily: fontMono, fontSize: 16, fontWeight: 700, background: "transparent",
          border: "none", cursor: "pointer", color: paper.ink, padding: "0 4px", lineHeight: 1,
        }}>×</button>
        <div style={{ fontFamily: fontMono, fontSize: 10, fontWeight: 700, letterSpacing: 3, color: paper.inkDim, textTransform: "uppercase" }}>
          🗓 {t("page.reservation_request")}
        </div>
        <button type="submit" style={{
          fontFamily: fontMono, fontSize: 9, fontWeight: 700, letterSpacing: 2,
          textTransform: "uppercase", background: paper.blue, color: "#fff",
          border: "none", padding: "8px 14px", cursor: "pointer",
        }}>
          {t("action.confirm_reservation")}
        </button>
      </div>

      {/* Car tabs */}
      <Controller name="car_id" control={control}
        render={({ field }) => <CarToggle cars={cars} value={field.value} onChange={field.onChange} />}
      />

      {/* Driver row */}
      <div style={{ padding: "10px 14px", borderBottom: `1.5px dashed ${paper.paperDark}`, background: paper.paper }}>
        <span style={label}>{t("form.driver")}</span>
        {isAdmin ? (
          <select
            value={personId ?? ""}
            onChange={(e) => setValue("person_id", Number(e.target.value))}
            style={{ fontFamily: fontSerif, fontSize: 17, fontWeight: 600, color: paper.ink, background: "transparent", border: "none", outline: "none", width: "100%", padding: 0, cursor: "pointer" }}
          >
            <option value="" disabled>{t("form.select_person_placeholder")}</option>
            {people.filter((p) => p.active).map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        ) : (
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontFamily: fontSerif, fontSize: 17, fontWeight: 600, color: paper.ink }}>
              {person?.name ?? me?.personName ?? "—"}
            </span>
            <span style={{ fontSize: 13 }}>🔒</span>
          </div>
        )}
      </div>
      {!isAdmin && (
        <div style={{ padding: "6px 14px", fontFamily: fontMono, fontSize: 9, color: paper.amber, letterSpacing: 1 }}>
          🔒 {t("form.driver_locked_hint")}
        </div>
      )}

      {/* Hidden fields so RHF keeps start_date / end_date in form state */}
      <input type="hidden" {...register("start_date")} />
      <input type="hidden" {...register("end_date")} />

      {/* Calendar date picker */}
      <div style={{ margin: "12px 14px", background: paper.paper, border: `1.5px solid ${paper.paperDark}` }}>
        {/* Header: label + days count + selected range */}
        <div style={{
          display: "flex", justifyContent: "space-between", alignItems: "center",
          padding: "8px 14px", borderBottom: `1px dashed ${paper.paperDark}`,
        }}>
          <div>
            <div style={{ fontFamily: fontMono, fontSize: 10, fontWeight: 700, letterSpacing: 2, color: paper.blue }}>
              ● {t("page.reservation_request")}
            </div>
            {startDate && endDate && startDate !== endDate ? (
              <div style={{ fontFamily: fontSerif, fontSize: 13, fontWeight: 600, color: paper.inkDim, marginTop: 2 }}>
                {fmtDate(startDate, locale as "nl" | "en")} → {fmtDate(endDate, locale as "nl" | "en")}
              </div>
            ) : startDate ? (
              <div style={{ fontFamily: fontSerif, fontSize: 13, fontWeight: 600, color: paper.inkDim, marginTop: 2 }}>
                {fmtDate(startDate, locale as "nl" | "en")}
              </div>
            ) : null}
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontFamily: fontSerif, fontSize: 24, fontWeight: 700, color: paper.ink, lineHeight: 1 }}>
              {dayCount}
            </div>
            <div style={{ fontFamily: fontMono, fontSize: 7, color: paper.inkMute, letterSpacing: 1.5, textTransform: "uppercase" }}>
              {t("form.days")}
            </div>
          </div>
        </div>

        {/* Calendar grid + navigation */}
        <div style={{ padding: "10px 14px 12px" }}>
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 8, gap: 4 }}>
            <button type="button" onClick={() => setWeekOffset((o) => o - 1)} style={{
              fontFamily: fontMono, fontSize: 14, fontWeight: 700,
              background: "transparent", border: `1px solid ${paper.paperDark}`,
              color: paper.inkDim, cursor: "pointer", padding: "0 8px", lineHeight: "22px",
            }}>‹</button>
            <button type="button" onClick={() => setWeekOffset((o) => o + 1)} style={{
              fontFamily: fontMono, fontSize: 14, fontWeight: 700,
              background: "transparent", border: `1px solid ${paper.paperDark}`,
              color: paper.inkDim, cursor: "pointer", padding: "0 8px", lineHeight: "22px",
            }}>›</button>
          </div>
          <PickCalendar
            days={stripDays}
            reservations={reservations}
            carId={carId}
            excludeId={defaultValues?.id}
            from={startDate ?? null}
            to={endDate ?? null}
            onRangePick={(from, to) => {
              setValue("start_date", from, { shouldValidate: true });
              setValue("end_date", to, { shouldValidate: true });
            }}
          />
        </div>
      </div>

      {/* Conflict warning */}
      {conflicts.length > 0 && (
        <div style={{
          margin: "0 14px 12px",
          background: "transparent",
          border: `1.5px solid ${paper.accent}`,
          padding: "10px 14px",
        }}>
          <div style={{ fontFamily: fontMono, fontSize: 9, fontWeight: 700, color: paper.accent, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 6 }}>
            ▲ {t("form.conflict_warning")}
          </div>
          {conflicts.map((r) => (
            <div key={r.id} style={{ marginBottom: 4 }}>
              <div style={{ fontFamily: fontSerif, fontSize: 13, fontWeight: 600, color: paper.ink }}>
                {r.person_name} — {r.car_short}
              </div>
              <div style={{ fontFamily: fontMono, fontSize: 9, color: paper.inkDim, letterSpacing: 1 }}>
                {r.start_date} · {r.status}
              </div>
            </div>
          ))}
          <div style={{ fontFamily: fontMono, fontSize: 9, color: paper.inkMute, letterSpacing: 1, marginTop: 6, fontStyle: "italic" }}>
            {t("form.conflict_note")}
          </div>
        </div>
      )}

      {/* Note */}
      <div style={{ padding: "4px 14px 16px" }}>
        <span style={label}>{t("form.reservation_reason")}</span>
        <div style={{ border: `1.5px dashed ${paper.paperDark}`, padding: "8px 14px" }}>
          <input
            {...register("note")}
            type="text"
            placeholder={t("form.reservation_reason_placeholder")}
            style={{
              fontFamily: fontSerif, fontSize: 15, fontWeight: 600, color: paper.ink,
              background: "transparent", border: "none", outline: "none",
              width: "100%", padding: 0,
            }}
          />
        </div>
      </div>

      <div style={{ height: 32 }} />
    </form>
  );
}
