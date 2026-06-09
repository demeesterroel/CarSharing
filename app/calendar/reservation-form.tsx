"use client";
import { CarToggle } from "@/components/car-toggle";
import { useLocale, useT } from "@/components/locale-provider";
import { PickCalendar } from "@/components/pick-calendar";
import { TimePicker } from "@/components/time-picker";
import { useMe } from "@/hooks/use-me";
import { usePeople } from "@/hooks/use-people";
import { useReservations } from "@/hooks/use-reservations";
import { useCars } from "@/hooks/use-vehicles";
import { buildMissingLabel } from "@/lib/i18n";
import { useOnlineState } from "@/lib/offline/online-state";
import { fmtDate, fontMono, fontSerif, paper } from "@/lib/paper-theme";
import { fullNameOf } from "@/lib/person-utils";
import { useTheme } from "@/lib/theme-context";
import type { Reservation, ReservationInput } from "@/types";
import { zodResolver } from "@hookform/resolvers/zod";
import { Lock } from "lucide-react";
import { useEffect, useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

const schema = z
  .object({
    person_id: z.number({ error: "Persoon vereist" }),
    car_id: z.number({ error: "Wagen vereist" }),
    start_date: z.string().min(1),
    end_date: z.string().min(1),
    start_time: z
      .string()
      .nullable()
      .optional()
      .transform((v) => v || null),
    end_time: z
      .string()
      .nullable()
      .optional()
      .transform((v) => v || null),
    note: z
      .string()
      .nullable()
      .optional()
      .transform((v) => v || null),
  })
  .refine((v) => v.end_date >= v.start_date, {
    message: "Einddatum moet na startdatum zijn",
    path: ["end_date"],
  });
type FormInput = z.input<typeof schema>;
type FormData = z.output<typeof schema>;

interface Props {
  defaultValues?: Partial<Reservation>;
  onSubmit: (data: ReservationInput) => void;
  onCancel: () => void;
  /** When true the form is shown read-only: inputs disabled, save hidden. */
  readOnly?: boolean;
}

const fieldsetReset: React.CSSProperties = {
  border: 0,
  margin: 0,
  padding: 0,
  minInlineSize: "auto",
};

function diffDays(start: string, end: string): number {
  return Math.round((new Date(end).getTime() - new Date(start).getTime()) / 86400000) + 1;
}

const paperLabel: React.CSSProperties = {
  fontFamily: fontMono,
  fontSize: 9,
  fontWeight: 700,
  letterSpacing: 2,
  textTransform: "uppercase",
  color: paper.inkMute,
  display: "block",
  marginBottom: 4,
};

const monoLabel: React.CSSProperties = {
  fontFamily: fontMono,
  fontSize: 11,
  color: paper.inkMute,
  display: "block",
  marginBottom: 4,
};

export function ReservationForm({ defaultValues, onSubmit, onCancel, readOnly = false }: Props) {
  const t = useT();
  const { locale } = useLocale();
  const { theme } = useTheme();
  const mono = theme === "mono";
  const lbl = mono ? monoLabel : paperLabel;

  const { data: people = [] } = usePeople();
  const { data: cars = [] } = useCars();
  const { data: me } = useMe();
  const { online } = useOnlineState();
  const { data: reservations = [] } = useReservations();
  const isAdmin = me?.isAdmin ?? false;
  const today = new Date().toISOString().slice(0, 10);

  // Editing a decided reservation re-opens it for approval (→ pending): the
  // calendar event reverts to tentative and the owner is re-invited. Warn so the
  // revert isn't a surprise. (#2)
  const reopensForApproval =
    Boolean(defaultValues?.id) && (defaultValues?.status ?? "pending") !== "pending";

  const { register, handleSubmit, control, setValue, getValues } = useForm<
    FormInput,
    unknown,
    FormData
  >({
    resolver: zodResolver(schema),
    defaultValues: {
      start_date: defaultValues?.start_date ?? "",
      end_date: defaultValues?.end_date ?? "",
      start_time: defaultValues?.start_time ?? null,
      end_time: defaultValues?.end_time ?? null,
      person_id: defaultValues?.person_id,
      car_id: defaultValues?.car_id,
      note: defaultValues?.note ?? null,
    },
  });

  // Optional reservation times (#191). All-day is the default; unchecking reveals
  // start/end time pickers and collapses the reservation to a single day.
  const [allDay, setAllDay] = useState(() => !defaultValues?.start_time);

  useEffect(() => {
    if (!defaultValues?.person_id && me?.personId && !getValues("person_id")) {
      setValue("person_id", me.personId);
    }
  }, [me, defaultValues, setValue, getValues]);

  const calendarInitOffset = (() => {
    if (!defaultValues?.start_date) return 0;
    const ms =
      new Date(`${defaultValues.start_date}T00:00:00Z`).getTime() -
      new Date(`${today}T00:00:00Z`).getTime();
    return Math.max(0, Math.floor(ms / (7 * 86400000)));
  })();

  const [startDate, endDate, carId, personId, startTime, endTime] = useWatch({
    control,
    name: ["start_date", "end_date", "car_id", "person_id", "start_time", "end_time"],
  });
  const person = people.find((p) => p.id === personId);
  const datesSelected = !!(startDate && endDate && endDate >= startDate);
  // When timed (not all-day), both times must be set; end_time need only be after
  // start_time on a single-day reservation (multi-day ends on a later date).
  const timesValid =
    allDay || (!!startTime && !!endTime && (startDate !== endDate || endTime > startTime));
  const canSubmit = datesSelected && !!(carId && personId) && timesValid;
  // Visible error for the single-day case where end_time isn't after start_time.
  const timeOrderError =
    !allDay && !!startTime && !!endTime && startDate === endDate && endTime <= startTime;
  const missingLabel = buildMissingLabel([
    !carId && t("field.car"),
    isAdmin && !personId && t("field.driver"),
    !datesSelected && t("field.dates"),
  ]);
  const dayCount = datesSelected ? diffDays(startDate, endDate) : 1;

  const conflicts = reservations.filter((r) => {
    if (r.status === "rejected") return false;
    if (r.car_id !== carId) return false;
    if (defaultValues?.id && r.id === defaultValues.id) return false;
    return r.start_date <= endDate && r.end_date >= startDate;
  });

  function handleFormSubmit(data: FormData) {
    const timed = !allDay && !!data.start_time && !!data.end_time;
    onSubmit({
      person_id: data.person_id,
      car_id: data.car_id,
      start_date: data.start_date,
      end_date: data.end_date, // times may span the whole date range
      start_time: timed ? data.start_time : null,
      end_time: timed ? data.end_time : null,
      note: data.note,
    });
  }

  return (
    <form
      onSubmit={(e) => {
        if (readOnly) {
          e.preventDefault();
          return;
        }
        if (!online) {
          e.preventDefault();
          toast.error(t("offline.mutation_blocked"));
          return;
        }
        handleSubmit(handleFormSubmit)(e);
      }}
      style={{ background: paper.paperDeep }}
    >
      {/* Top bar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 16px",
          height: 52,
          borderBottom: mono ? `1px solid ${paper.paperDark}` : `1.5px solid ${paper.paperDark}`,
          background: paper.paper,
          position: "sticky",
          top: 0,
          zIndex: 10,
          borderRadius: "14px 14px 0 0",
        }}
      >
        <button
          type="button"
          onClick={onCancel}
          aria-label={t("action.close")}
          style={{
            fontFamily: fontMono,
            fontSize: 16,
            fontWeight: 700,
            background: "transparent",
            border: "none",
            cursor: "pointer",
            color: paper.ink,
            padding: "0 4px",
            lineHeight: 1,
          }}
        >
          ×
        </button>
        <div
          style={
            mono
              ? {
                  fontFamily:
                    "var(--font-inter-tight, 'Inter Tight', 'Inter', system-ui, sans-serif)",
                  fontSize: 16,
                  fontWeight: 700,
                  color: paper.ink,
                }
              : {
                  fontFamily: fontMono,
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: 3,
                  color: paper.inkDim,
                  textTransform: "uppercase" as const,
                }
          }
        >
          {mono ? t("form.reservation") : `▦ ${t("form.reservation").toUpperCase()}`}
        </div>
        {readOnly ? (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              fontFamily: fontMono,
              fontSize: 9,
              fontWeight: 700,
              letterSpacing: 2,
              textTransform: "uppercase",
              color: paper.inkMute,
            }}
          >
            <Lock size={13} color={paper.inkMute} strokeWidth={1.75} />
            {t("form.read_only")}
          </div>
        ) : (
          <div style={{ position: "relative" }} className="submit-wrap">
            <button
              type="submit"
              disabled={!canSubmit}
              style={
                mono
                  ? {
                      fontFamily: "var(--font-inter, 'Inter', system-ui, sans-serif)",
                      fontSize: 14,
                      fontWeight: 600,
                      background: paper.accent,
                      color: "#fff",
                      border: "none",
                      padding: "8px 18px",
                      borderRadius: "var(--radius-pill, 999px)",
                      cursor: canSubmit && online ? "pointer" : "default",
                      opacity: canSubmit && online ? 1 : 0.5,
                      transition: "opacity 0.15s",
                    }
                  : {
                      fontFamily: fontMono,
                      fontSize: 9,
                      fontWeight: 700,
                      letterSpacing: 2,
                      textTransform: "uppercase" as const,
                      background: isAdmin ? paper.blue : paper.accent,
                      color: "#fff",
                      border: "none",
                      padding: "8px 14px",
                      cursor: canSubmit && online ? "pointer" : "default",
                      opacity: canSubmit && online ? 1 : 0.35,
                    }
              }
            >
              {mono
                ? t("action.save")
                : isAdmin
                  ? t("action.confirm_reservation").toUpperCase()
                  : t("action.request_reservation").toUpperCase()}
            </button>
            {!canSubmit && (
              <div
                className="submit-tip"
                style={{
                  position: "absolute",
                  right: 0,
                  top: "calc(100% + 6px)",
                  background: paper.ink,
                  color: paper.paper,
                  fontFamily: fontMono,
                  fontSize: 9,
                  letterSpacing: 1,
                  padding: "5px 8px",
                  whiteSpace: "pre-line",
                  pointerEvents: "none",
                  opacity: 0,
                  transition: "opacity 0.15s",
                  zIndex: 20,
                }}
              >
                {missingLabel}
              </div>
            )}
          </div>
        )}
        <style>{`.submit-wrap:hover .submit-tip, .submit-wrap:focus-within .submit-tip { opacity: 1 !important; }`}</style>
      </div>

      <fieldset disabled={readOnly} style={fieldsetReset}>
        {readOnly && (
          <div
            style={{
              padding: "8px 14px",
              fontFamily: fontMono,
              fontSize: 9,
              fontWeight: 700,
              letterSpacing: 1,
              color: paper.amber,
              borderBottom: mono
                ? `1px solid ${paper.paperDark}`
                : `1.5px dashed ${paper.paperDark}`,
            }}
          >
            🔒 {t("form.read_only_hint")}
          </div>
        )}
        {!readOnly && reopensForApproval && (
          <div
            style={{
              padding: "8px 14px",
              fontFamily: fontMono,
              fontSize: 9,
              fontWeight: 700,
              letterSpacing: 1,
              color: paper.amber,
              borderBottom: mono
                ? `1px solid ${paper.paperDark}`
                : `1.5px dashed ${paper.paperDark}`,
            }}
          >
            ⚠ {t("form.edit_reopens_hint")}
          </div>
        )}

        {/* Car tabs */}
        <Controller
          name="car_id"
          control={control}
          render={({ field }) => (
            <CarToggle cars={cars} value={field.value} onChange={field.onChange} />
          )}
        />

        {/* Driver row */}
        <div
          style={{
            padding: "10px 14px",
            borderBottom: mono ? `1px solid ${paper.paperDark}` : `1.5px dashed ${paper.paperDark}`,
            background: paper.paper,
          }}
        >
          {mono ? (
            isAdmin ? (
              <>
                <span style={lbl}>{t("form.driver")}</span>
                <select
                  value={personId ?? ""}
                  onChange={(e) => setValue("person_id", Number(e.target.value))}
                  style={{
                    fontFamily: fontSerif,
                    fontSize: 17,
                    fontWeight: 600,
                    color: paper.ink,
                    background: "transparent",
                    border: "none",
                    outline: "none",
                    width: "100%",
                    padding: 0,
                    cursor: "pointer",
                  }}
                >
                  <option value="" disabled>
                    {t("form.select_person_placeholder")}
                  </option>
                  {people
                    .filter((p) => p.active)
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {fullNameOf(p)}
                      </option>
                    ))}
                </select>
              </>
            ) : (
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span
                  style={{
                    fontFamily:
                      "var(--font-inter-tight, 'Inter Tight', 'Inter', system-ui, sans-serif)",
                    fontSize: 19,
                    fontWeight: 700,
                    color: paper.ink,
                  }}
                >
                  {person ? fullNameOf(person) : (me?.shortName ?? "—")}
                </span>
                <Lock size={14} color={paper.inkMute} strokeWidth={1.75} />
              </div>
            )
          ) : (
            <>
              <span style={lbl}>{t("form.driver")}</span>
              {isAdmin ? (
                <select
                  value={personId ?? ""}
                  onChange={(e) => setValue("person_id", Number(e.target.value))}
                  style={{
                    fontFamily: fontSerif,
                    fontSize: 17,
                    fontWeight: 600,
                    color: paper.ink,
                    background: "transparent",
                    border: "none",
                    outline: "none",
                    width: "100%",
                    padding: 0,
                    cursor: "pointer",
                  }}
                >
                  <option value="" disabled>
                    {t("form.select_person_placeholder")}
                  </option>
                  {people
                    .filter((p) => p.active)
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {fullNameOf(p)}
                      </option>
                    ))}
                </select>
              ) : (
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span
                    style={{
                      fontFamily: fontSerif,
                      fontSize: 17,
                      fontWeight: 600,
                      color: paper.ink,
                    }}
                  >
                    {person ? fullNameOf(person) : (me?.shortName ?? "—")}
                  </span>
                  <span style={{ fontSize: 13 }}>🔒</span>
                </div>
              )}
            </>
          )}
        </div>
        {!isAdmin && !mono && (
          <div
            style={{
              padding: "6px 14px",
              fontFamily: fontMono,
              fontSize: 9,
              color: paper.amber,
              letterSpacing: 1,
            }}
          >
            🔒 {t("form.driver_locked_hint")}
          </div>
        )}

        {/* Hidden RHF fields */}
        <input type="hidden" {...register("start_date")} />
        <input type="hidden" {...register("end_date")} />

        {/* Calendar date picker */}
        <div
          style={
            mono
              ? {
                  margin: "12px 14px",
                  background: paper.paper,
                  border: `1px solid ${paper.paperDark}`,
                  borderRadius: "var(--radius-md, 10px)",
                  overflow: "hidden",
                }
              : {
                  margin: "12px 14px",
                  background: paper.paper,
                  border: `1.5px solid ${paper.paperDark}`,
                }
          }
        >
          {/* Header: date range + day count */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "8px 14px",
              borderBottom: mono ? `1px solid ${paper.paperDark}` : `1px dashed ${paper.paperDark}`,
            }}
          >
            <div>
              {!mono && (
                <div
                  style={{
                    fontFamily: fontMono,
                    fontSize: 10,
                    fontWeight: 700,
                    letterSpacing: 2,
                    color: paper.blue,
                  }}
                >
                  ● {t("page.reservation_request")}
                </div>
              )}
              {startDate && endDate && startDate !== endDate ? (
                <div
                  style={
                    mono
                      ? {
                          fontFamily:
                            "var(--font-inter-tight, 'Inter Tight', 'Inter', system-ui, sans-serif)",
                          fontSize: 15,
                          fontWeight: 700,
                          color: paper.ink,
                        }
                      : {
                          fontFamily: fontSerif,
                          fontSize: 13,
                          fontWeight: 600,
                          color: paper.inkDim,
                          marginTop: 2,
                        }
                  }
                >
                  {fmtDate(startDate, locale as "nl" | "en")}
                  {mono ? " – " : " → "}
                  {fmtDate(endDate, locale as "nl" | "en")}
                </div>
              ) : startDate ? (
                <div
                  style={
                    mono
                      ? {
                          fontFamily:
                            "var(--font-inter-tight, 'Inter Tight', 'Inter', system-ui, sans-serif)",
                          fontSize: 15,
                          fontWeight: 700,
                          color: paper.ink,
                        }
                      : {
                          fontFamily: fontSerif,
                          fontSize: 13,
                          fontWeight: 600,
                          color: paper.inkDim,
                          marginTop: 2,
                        }
                  }
                >
                  {fmtDate(startDate, locale as "nl" | "en")}
                </div>
              ) : (
                mono && (
                  <div
                    style={{
                      fontFamily: fontMono,
                      fontSize: 12,
                      color: paper.inkMute,
                    }}
                  >
                    {t("field.dates")}
                  </div>
                )
              )}
            </div>
            <div style={{ textAlign: "center" }}>
              <div
                style={{
                  fontFamily: fontSerif,
                  fontSize: 24,
                  fontWeight: 700,
                  color: datesSelected ? paper.ink : paper.inkMute,
                  lineHeight: 1,
                }}
              >
                {dayCount}
              </div>
              <div
                style={
                  mono
                    ? {
                        fontFamily: fontMono,
                        fontSize: 9,
                        color: paper.inkMute,
                      }
                    : {
                        fontFamily: fontMono,
                        fontSize: 7,
                        color: paper.inkMute,
                        letterSpacing: 1.5,
                        textTransform: "uppercase" as const,
                      }
                }
              >
                {t("form.days")}
              </div>
            </div>
          </div>

          {/* Calendar grid */}
          <div style={{ padding: "10px 14px 12px" }}>
            <PickCalendar
              initialOffset={calendarInitOffset}
              reservations={reservations}
              carId={carId}
              excludeId={defaultValues?.id}
              from={startDate ?? null}
              to={endDate ?? null}
              onRangePick={(from, to) => {
                if (readOnly) return;
                setValue("start_date", from, { shouldValidate: true });
                setValue("end_date", to, { shouldValidate: true });
              }}
            />
          </div>
        </div>

        {/* Conflict warning */}
        {conflicts.length > 0 && (
          <div
            style={
              mono
                ? {
                    margin: "0 14px 12px",
                    border: `1px solid ${paper.amber}`,
                    borderRadius: "var(--radius-md, 10px)",
                    padding: "10px 14px",
                    background: "rgba(180, 83, 9, 0.05)",
                  }
                : {
                    margin: "0 14px 12px",
                    background: "transparent",
                    border: `1.5px solid ${paper.accent}`,
                    padding: "10px 14px",
                  }
            }
          >
            <div
              style={
                mono
                  ? {
                      fontFamily:
                        "var(--font-inter-tight, 'Inter Tight', 'Inter', system-ui, sans-serif)",
                      fontSize: 13,
                      fontWeight: 600,
                      color: paper.amber,
                      marginBottom: 6,
                    }
                  : {
                      fontFamily: fontMono,
                      fontSize: 9,
                      fontWeight: 700,
                      color: paper.accent,
                      letterSpacing: 1.5,
                      textTransform: "uppercase" as const,
                      marginBottom: 6,
                    }
              }
            >
              {mono ? "⚠ " : "▲ "}
              {t("form.conflict_warning")}
            </div>
            {conflicts.map((r) => (
              <div key={r.id} style={{ marginBottom: 4 }}>
                <div
                  style={
                    mono
                      ? {
                          fontFamily: "var(--font-inter, 'Inter', system-ui, sans-serif)",
                          fontSize: 13,
                          fontWeight: 600,
                          color: paper.ink,
                        }
                      : {
                          fontFamily: fontSerif,
                          fontSize: 13,
                          fontWeight: 600,
                          color: paper.ink,
                        }
                  }
                >
                  {r.person_name} — {r.car_short}
                </div>
                <div
                  style={{
                    fontFamily: fontMono,
                    fontSize: 9,
                    color: paper.inkDim,
                    letterSpacing: mono ? 0 : 1,
                  }}
                >
                  {r.start_date} · {r.status}
                </div>
              </div>
            ))}
            <div
              style={{
                fontFamily: mono ? "var(--font-inter, 'Inter', system-ui, sans-serif)" : fontMono,
                fontSize: mono ? 11 : 9,
                color: paper.inkMute,
                letterSpacing: mono ? 0 : 1,
                marginTop: 6,
                fontStyle: "italic",
              }}
            >
              {t("form.conflict_note")}
            </div>
          </div>
        )}

        {/* Note */}
        <div style={{ padding: "4px 14px 16px" }}>
          <span
            style={
              mono
                ? { ...monoLabel }
                : {
                    fontFamily: fontMono,
                    fontSize: 9,
                    fontWeight: 700,
                    letterSpacing: 2,
                    textTransform: "uppercase" as const,
                    color: paper.inkMute,
                    display: "block",
                    marginBottom: 4,
                  }
            }
          >
            {t("form.reservation_reason")}
          </span>
          <div
            style={
              mono
                ? {
                    border: `1px solid ${paper.paperDark}`,
                    borderRadius: "var(--radius-md, 10px)",
                    padding: "8px 14px",
                  }
                : {
                    border: `1.5px dashed ${paper.paperDark}`,
                    padding: "8px 14px",
                  }
            }
          >
            <input
              {...register("note")}
              type="text"
              placeholder={t("form.reservation_reason_placeholder")}
              style={{
                fontFamily: fontSerif,
                fontSize: 15,
                fontWeight: 600,
                color: paper.ink,
                background: "transparent",
                border: "none",
                outline: "none",
                width: "100%",
                padding: 0,
              }}
            />
          </div>
        </div>

        {/* Optional times (#191) — all-day default; unchecking reveals time pickers.
            Placed last so the clock-timepicker popup opens into the space below. */}
        <div style={{ padding: "10px 14px 16px" }}>
          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              cursor: readOnly ? "default" : "pointer",
            }}
          >
            <input
              type="checkbox"
              checked={allDay}
              disabled={readOnly}
              onChange={(e) => {
                const checked = e.target.checked;
                setAllDay(checked);
                // Switching to all-day clears the times; the date range is kept
                // either way (timed reservations may span multiple days, #191).
                if (checked) {
                  setValue("start_time", null);
                  setValue("end_time", null);
                }
              }}
            />
            <span style={lbl}>{t("form.all_day")}</span>
          </label>
          {!allDay && (
            <div style={{ display: "flex", gap: 12, marginTop: 10 }}>
              <div style={{ flex: 1 }}>
                <span style={lbl}>{t("form.time_from")}</span>
                <Controller
                  name="start_time"
                  control={control}
                  render={({ field }) => (
                    <TimePicker
                      value={field.value ?? null}
                      onChange={(v) => field.onChange(v)}
                      disabled={readOnly}
                    />
                  )}
                />
              </div>
              <div style={{ flex: 1 }}>
                <span style={lbl}>{t("form.time_to")}</span>
                <Controller
                  name="end_time"
                  control={control}
                  render={({ field }) => (
                    <TimePicker
                      value={field.value ?? null}
                      onChange={(v) => field.onChange(v)}
                      disabled={readOnly}
                    />
                  )}
                />
              </div>
            </div>
          )}
          {timeOrderError && (
            <div
              style={{
                marginTop: 8,
                fontFamily: fontMono,
                fontSize: 10,
                color: paper.accent,
                letterSpacing: 0.5,
              }}
            >
              {t("form.time_order_error")}
            </div>
          )}
        </div>
      </fieldset>

      <div style={{ height: 32 }} />
    </form>
  );
}
