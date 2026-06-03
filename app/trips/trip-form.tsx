"use client";
import { useEffect } from "react";
import { useForm, useWatch, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Lock } from "lucide-react";
import { CarToggle } from "@/components/car-toggle";
import { LocationPicker } from "@/components/location-picker";
import { calcTripAmount } from "@/lib/formulas";
import { usePeople } from "@/hooks/use-people";
import { useCars } from "@/hooks/use-vehicles";
import { useLastCarState } from "@/hooks/use-vehicle-state";
import { useMe } from "@/hooks/use-me";
import { useOnlineState } from "@/lib/offline/online-state";
import type { Trip } from "@/types";
import { t, buildMissingLabel } from "@/lib/i18n";
import { fullNameOf } from "@/lib/person-utils";
import { paper, fontMono, fontSerif, fmtMoney, fmtDate } from "@/lib/paper-theme";
import { useTheme } from "@/lib/theme-context";
import { useLocale } from "@/components/locale-provider";

const schema = z
  .object({
    person_id: z.number({ error: t("validation.person_required") }),
    car_id: z.number({ error: t("validation.car_required") }),
    date: z.string().min(1),
    start_odometer: z.coerce.number().int().min(0),
    end_odometer: z.coerce.number().int().min(0),
    location: z
      .string()
      .nullable()
      .optional()
      .transform((v) => v ?? null),
    gps_coords: z
      .string()
      .nullable()
      .optional()
      .transform((v) => v ?? null),
    parking: z
      .string()
      .nullable()
      .optional()
      .transform((v) => v ?? null),
  })
  .refine((d) => d.end_odometer >= d.start_odometer, {
    path: ["end_odometer"],
    message: t("validation.end_gte_start"),
  });
type FormInput = z.input<typeof schema>;
type FormData = z.output<typeof schema>;

interface Props {
  defaultValues?: Partial<Trip>;
  onSubmit: (data: FormData) => void;
  onCancel: () => void;
  onDelete?: () => void;
  /** When true the form is shown read-only: inputs disabled, save hidden. */
  readOnly?: boolean;
}

const fieldsetReset: React.CSSProperties = {
  border: 0,
  margin: 0,
  padding: 0,
  minInlineSize: "auto",
};

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
const dashedBox: React.CSSProperties = {
  border: `1.5px dashed ${paper.paperDark}`,
  padding: "12px 14px",
};
const bigInput: React.CSSProperties = {
  fontFamily: fontSerif,
  fontSize: 28,
  fontWeight: 700,
  color: paper.ink,
  background: "transparent",
  border: "none",
  outline: "none",
  width: "100%",
  padding: 0,
};

export function TripForm({ defaultValues, onSubmit, onCancel, onDelete, readOnly = false }: Props) {
  const { data: people = [] } = usePeople();
  const { data: cars = [] } = useCars();
  const { data: me } = useMe();
  const isAddMode = !defaultValues?.id;
  const isAdmin = me?.isAdmin ?? false;
  const { theme } = useTheme();
  const mono = theme === "mono";
  const { locale } = useLocale();

  const {
    register,
    handleSubmit,
    control,
    setValue,
    getValues,
    formState: { errors },
  } = useForm<FormInput, unknown, FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      date: new Date().toISOString().slice(0, 10),
      start_odometer: 0,
      end_odometer: 0,
      location: null,
      gps_coords: null,
      parking: null,
      ...defaultValues,
    },
  });

  const [start, end, personId, carId, date] = useWatch({
    control,
    name: ["start_odometer", "end_odometer", "person_id", "car_id", "date"],
  });
  const endOk = Number(end) > 0 && Number(end) >= Number(start);
  const canSubmit = !!(personId && carId && date && endOk);
  const km = Math.max(0, (Number(end) || 0) - (Number(start) || 0));
  const missingLabel = buildMissingLabel([
    !carId && t("field.car"),
    isAdmin && !personId && t("field.driver"),
    !date && t("field.date"),
    !endOk && t("field.km"),
  ]);
  const person = people.find((p) => p.id === personId);
  const car = cars.find((c) => c.id === carId);

  const shortKm = Math.min(km, 500);
  const longKm = Math.max(km - 500, 0);
  const disc = person?.discount ?? 0;
  const discLong = person?.discount_long ?? 0;
  const shortAmount = car ? car.price_per_km * shortKm * (1 - disc) : 0;
  const longAmount = car ? car.price_per_km * longKm * (1 - discLong) : 0;
  const amount = shortAmount + longAmount;

  const { data: lastState } = useLastCarState(carId);
  const { online } = useOnlineState();

  useEffect(() => {
    if (!isAddMode || !carId || !lastState) return;
    if (lastState.odometer != null) {
      setValue("start_odometer", lastState.odometer);
      const current = getValues("end_odometer");
      if (!current || Number(current) === 0) setValue("end_odometer", lastState.odometer);
    }
    if (lastState.location) setValue("location", lastState.location);
  }, [lastState, carId, isAddMode, setValue, getValues]);

  useEffect(() => {
    if (isAddMode && me?.personId && !getValues("person_id")) {
      setValue("person_id", me.personId);
    }
  }, [me, isAddMode, setValue, getValues]);

  const startReg = register("start_odometer");
  const pctShort = Math.round(disc * 100);
  const pctLong = Math.round(discLong * 100);
  const lbl = mono ? monoLabel : paperLabel;

  const rowBorder = mono ? `1px solid ${paper.paperDark}` : `1.5px dashed ${paper.paperDark}`;

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
        handleSubmit(onSubmit)(e);
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
          borderBottom: rowBorder,
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
                  fontFamily: fontSerif,
                  fontSize: 17,
                  fontWeight: 700,
                  color: paper.ink,
                }
              : {
                  fontFamily: fontMono,
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: 3,
                  color: paper.inkDim,
                  textTransform: "uppercase",
                }
          }
        >
          {!mono && "↦ "}
          {t("form.log_trip")}
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
              style={{
                fontFamily: mono ? fontSerif : fontMono,
                fontSize: mono ? 13 : 9,
                fontWeight: 700,
                letterSpacing: mono ? 0 : 2,
                textTransform: mono ? "none" : "uppercase",
                background: paper.accent,
                color: "#fff",
                border: "none",
                borderRadius: mono ? "var(--radius-pill, 999px)" : 0,
                padding: mono ? "8px 18px" : "8px 14px",
                cursor: canSubmit && online ? "pointer" : "default",
                opacity: canSubmit && online ? 1 : 0.35,
              }}
            >
              {mono ? t("action.save") : t("action.save_trip")}
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
              borderBottom: rowBorder,
            }}
          >
            🔒 {t("form.read_only_hint")}
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

        {/* Driver + Date row */}
        <div style={{ display: "flex", borderBottom: rowBorder }}>
          <div style={{ flex: 1, padding: "10px 14px", borderRight: rowBorder }}>
            {!mono && <span style={lbl}>{t("form.driver")}</span>}
            {isAdmin ? (
              <>
                {mono && <span style={lbl}>{t("form.driver")}</span>}
                <select
                  value={personId ?? ""}
                  onChange={(e) => setValue("person_id", Number(e.target.value))}
                  style={{
                    fontFamily: fontSerif,
                    fontSize: mono ? 19 : 17,
                    fontWeight: mono ? 700 : 600,
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
            ) : mono ? (
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span
                  style={{
                    fontFamily: fontSerif,
                    fontSize: 19,
                    fontWeight: 700,
                    color: paper.ink,
                    lineHeight: 1.15,
                  }}
                >
                  {person ? fullNameOf(person) : (me?.shortName ?? "—")}
                </span>
                <Lock
                  size={14}
                  color={paper.inkMute}
                  strokeWidth={1.75}
                  style={{ flexShrink: 0 }}
                />
              </div>
            ) : (
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span
                  style={{ fontFamily: fontSerif, fontSize: 17, fontWeight: 600, color: paper.ink }}
                >
                  {person ? fullNameOf(person) : (me?.shortName ?? "—")}
                </span>
                {(person?.discount ?? 0) > 0 && (
                  <span style={{ color: paper.accent, fontSize: 13 }}>★</span>
                )}
                <span style={{ fontSize: 13 }}>🔒</span>
              </div>
            )}
          </div>
          <div style={{ flex: 1, padding: "10px 14px" }}>
            {mono ? (
              <div style={{ position: "relative" }}>
                <span style={{ ...monoLabel, marginBottom: 2 }}>{t("form.date")}</span>
                <div
                  style={{
                    fontFamily: fontSerif,
                    fontSize: 17,
                    fontWeight: 700,
                    color: paper.ink,
                    pointerEvents: "none",
                  }}
                >
                  {date ? fmtDate(date, locale) : "—"}
                </div>
                <input
                  {...register("date")}
                  type="date"
                  onClick={(e) => e.currentTarget.showPicker?.()}
                  style={{
                    position: "absolute",
                    inset: 0,
                    opacity: 0.001,
                    cursor: "pointer",
                    width: "100%",
                    height: "100%",
                  }}
                />
              </div>
            ) : (
              <>
                <span style={lbl}>{t("form.date")}</span>
                <input
                  {...register("date")}
                  type="date"
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
                />
              </>
            )}
          </div>
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

        {/* Odometer block */}
        {mono ? (
          <div style={{ padding: "12px 14px 8px" }}>
            <span
              style={{
                fontFamily: fontSerif,
                fontSize: 13,
                fontWeight: 600,
                color: paper.inkMute,
                display: "block",
                marginBottom: 8,
              }}
            >
              {t("form.odometer_section")}
            </span>
            <div style={{ display: "flex", alignItems: "flex-end", gap: 8 }}>
              <div style={{ flex: 1 }}>
                <span style={{ ...monoLabel, marginBottom: 2 }}>{t("form.start_km")}</span>
                <input
                  {...startReg}
                  type="number"
                  style={{ ...bigInput, fontSize: 26 }}
                  onBlur={(e) => {
                    startReg.onBlur(e);
                    const startVal = Number(e.target.value);
                    const current = getValues("end_odometer");
                    if (!current || Number(current) === 0) setValue("end_odometer", startVal);
                  }}
                />
              </div>
              <div style={{ textAlign: "center", flexShrink: 0, padding: "0 6px 8px" }}>
                <div style={{ fontFamily: fontMono, fontSize: 11.5, color: paper.inkMute }}>
                  {km > 0 ? `+${km} km` : "—"}
                </div>
              </div>
              <div style={{ flex: 1, textAlign: "right" }}>
                <span
                  style={{ ...monoLabel, marginBottom: 2, textAlign: "right", display: "block" }}
                >
                  {t("form.end_km")}
                </span>
                <input
                  {...register("end_odometer")}
                  type="number"
                  style={{ ...bigInput, fontSize: 26, textAlign: "right" }}
                />
              </div>
            </div>
            {errors.end_odometer && (
              <div
                style={{ fontFamily: fontMono, fontSize: 11, color: paper.accent, marginTop: 4 }}
              >
                {errors.end_odometer.message}
              </div>
            )}
            {!online && isAddMode && (
              <div style={{ fontFamily: fontMono, fontSize: 10, color: paper.amber, marginTop: 4 }}>
                {t("form.offline_start_km_hint")}
              </div>
            )}
          </div>
        ) : (
          <div
            style={{
              margin: "12px 14px",
              background: paper.paper,
              border: `1.5px solid ${paper.paperDark}`,
            }}
          >
            <div
              style={{
                textAlign: "center",
                padding: "8px 0 4px",
                fontFamily: fontMono,
                fontSize: 9,
                fontWeight: 700,
                letterSpacing: 3,
                color: paper.inkMute,
                textTransform: "uppercase",
                borderBottom: `1px dashed ${paper.paperDark}`,
              }}
            >
              @ {t("form.odometer_section")}
            </div>
            <div style={{ display: "flex", alignItems: "center", padding: "12px 14px", gap: 8 }}>
              <div style={{ flex: 1 }}>
                <span style={{ ...paperLabel, fontSize: 8 }}>{t("form.start_km")}</span>
                <input
                  {...startReg}
                  type="number"
                  style={{ ...bigInput, fontSize: 20 }}
                  onBlur={(e) => {
                    startReg.onBlur(e);
                    const startVal = Number(e.target.value);
                    const current = getValues("end_odometer");
                    if (!current || Number(current) === 0) setValue("end_odometer", startVal);
                  }}
                />
                {!online && isAddMode && (
                  <div
                    style={{
                      fontFamily: fontMono,
                      fontSize: 8,
                      color: paper.amber,
                      letterSpacing: 1,
                      marginTop: 2,
                      textTransform: "uppercase",
                    }}
                  >
                    {t("form.offline_start_km_hint")}
                  </div>
                )}
              </div>
              <div style={{ textAlign: "center", flexShrink: 0, padding: "0 8px" }}>
                <div
                  style={{
                    fontFamily: fontMono,
                    fontSize: 10,
                    color: paper.inkMute,
                    letterSpacing: 1,
                    marginBottom: 2,
                  }}
                >
                  {km > 0 ? `${km} KM` : "—"}
                </div>
                <div
                  style={{
                    fontSize: 16,
                    color: errors.end_odometer ? paper.accent : paper.inkMute,
                  }}
                >
                  →
                </div>
              </div>
              <div style={{ flex: 1, textAlign: "right" }}>
                <span style={{ ...paperLabel, fontSize: 8, textAlign: "right", display: "block" }}>
                  {t("form.end_km")}
                </span>
                <input
                  {...register("end_odometer")}
                  type="number"
                  style={{ ...bigInput, fontSize: 20, textAlign: "right" }}
                />
                {errors.end_odometer && (
                  <div
                    style={{
                      fontFamily: fontMono,
                      fontSize: 8,
                      color: paper.accent,
                      letterSpacing: 1,
                    }}
                  >
                    {errors.end_odometer.message}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Location (GPS + map) */}
        <div style={{ padding: "4px 14px 4px" }}>
          <span style={{ ...lbl, marginBottom: 6 }}>
            {mono ? t("form.parking_short") : t("form.where_parked")}
          </span>
          <Controller
            name="location"
            control={control}
            render={({ field: addrField }) => (
              <Controller
                name="gps_coords"
                control={control}
                render={({ field: coordsField }) => (
                  <LocationPicker
                    address={addrField.value ?? null}
                    coords={coordsField.value ?? null}
                    onAddressChange={(v) => addrField.onChange(v ?? null)}
                    onCoordsChange={(v) => coordsField.onChange(v ?? null)}
                    autoGps={isAddMode}
                  />
                )}
              />
            )}
          />
        </div>

        {/* Parking note */}
        <div style={{ padding: "8px 14px 4px" }}>
          <span style={{ ...lbl, marginBottom: 6 }}>{t("form.parking_note")}</span>
          <div
            style={
              mono
                ? {
                    border: `1px solid ${paper.paperDark}`,
                    borderRadius: "var(--radius-sm, 6px)",
                    padding: "10px 14px",
                  }
                : { ...dashedBox, padding: "10px 14px" }
            }
          >
            <input
              {...register("parking")}
              type="text"
              placeholder={t("form.parking_placeholder")}
              style={{
                fontFamily: fontSerif,
                fontSize: 16,
                fontWeight: 500,
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

        {/* Breakdown / overzicht — always visible to prevent layout jump */}
        <div
          style={
            mono
              ? {
                  margin: "12px 14px",
                  border: `1px solid ${paper.paperDark}`,
                  borderRadius: "var(--radius-md, 10px)",
                  padding: "12px 14px",
                }
              : { margin: "12px 14px", ...dashedBox }
          }
        >
          <div
            style={
              mono
                ? {
                    fontFamily: fontSerif,
                    fontSize: 13,
                    fontWeight: 600,
                    color: paper.inkMute,
                    marginBottom: 10,
                  }
                : {
                    textAlign: "center",
                    fontFamily: fontMono,
                    fontSize: 9,
                    fontWeight: 700,
                    letterSpacing: 3,
                    color: paper.inkDim,
                    textTransform: "uppercase",
                    marginBottom: 10,
                  }
            }
          >
            {mono ? t("form.breakdown") : `— ${t("form.breakdown")} —`}
          </div>
          <BreakdownRow
            label={t("form.rate")}
            value={car ? `€ ${car.price_per_km.toFixed(2).replace(".", ",")} / km` : "—"}
            mono={mono}
            muted={!car}
          />
          <BreakdownRow
            label={t("form.tier_short", { km: String(shortKm), pct: String(pctShort) })}
            value={shortKm > 0 ? fmtMoney(shortAmount) : "—"}
            mono={mono}
            muted={shortKm === 0}
          />
          {longKm > 0 && (
            <BreakdownRow
              label={t("form.tier_long", { km: String(longKm), pct: String(pctLong) })}
              value={fmtMoney(longAmount)}
              mono={mono}
            />
          )}
          <div
            style={{
              borderTop: mono ? `1px solid ${paper.paperDark}` : `1px dashed ${paper.paperDark}`,
              margin: "8px 0",
            }}
          />
          <BreakdownRow
            label={`${mono ? "Totaal" : "TOTAL"} (${km} km)`}
            value={fmtMoney(amount)}
            valueStyle={{ color: paper.accent, fontSize: mono ? 16 : 15, fontWeight: 700 }}
            mono={mono}
          />
          {car && shortAmount + longAmount < car.price_per_km * km && km > 0 && (
            <div
              style={{
                textAlign: "right",
                fontFamily: fontMono,
                fontSize: mono ? 11 : 9,
                color: paper.inkMute,
                letterSpacing: mono ? 0 : 1,
                marginTop: 2,
              }}
            >
              − {fmtMoney(car.price_per_km * km - amount)} {t("form.total_discount").toLowerCase()}
            </div>
          )}
        </div>

        {onDelete && (
          <div style={{ padding: "0 14px 24px" }}>
            <button
              type="button"
              onClick={onDelete}
              style={{
                width: "100%",
                padding: "10px",
                background: "transparent",
                border: mono ? `1px solid ${paper.accent}` : `1.5px solid ${paper.accent}`,
                borderRadius: mono ? "var(--radius-pill, 999px)" : 0,
                color: paper.accent,
                fontFamily: mono ? fontSerif : fontMono,
                fontSize: mono ? 13 : 10,
                fontWeight: 700,
                letterSpacing: mono ? 0 : 2,
                textTransform: mono ? "none" : "uppercase",
                cursor: "pointer",
              }}
            >
              {t("action.delete")}
            </button>
          </div>
        )}
      </fieldset>
      <div style={{ height: 32 }} />
    </form>
  );
}

function BreakdownRow({
  label: lbl,
  value,
  valueStyle,
  mono,
  muted,
}: {
  label: string;
  value: string;
  valueStyle?: React.CSSProperties;
  mono: boolean;
  muted?: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "baseline",
        marginBottom: 6,
      }}
    >
      <span
        style={
          mono
            ? { fontFamily: fontMono, fontSize: 11, color: paper.inkMute }
            : {
                fontFamily: fontMono,
                fontSize: 9,
                color: paper.inkDim,
                letterSpacing: 1.5,
                textTransform: "uppercase",
              }
        }
      >
        {lbl}
      </span>
      <span
        style={{
          fontFamily: fontMono,
          fontSize: mono ? 13 : 12,
          fontWeight: 700,
          color: muted ? paper.inkMute : paper.ink,
          ...valueStyle,
        }}
      >
        {value}
      </span>
    </div>
  );
}
