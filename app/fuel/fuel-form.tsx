"use client";
import { CarToggle } from "@/components/car-toggle";
import { useLocale } from "@/components/locale-provider";
import { LocationPicker } from "@/components/location-picker";
import { ReceiptUpload } from "@/components/receipt-upload";
import { useMe } from "@/hooks/use-me";
import { usePeople } from "@/hooks/use-people";
import { useLastCarState } from "@/hooks/use-vehicle-state";
import { useCars } from "@/hooks/use-vehicles";
import { parseDecimalInput } from "@/lib/form-utils";
import { calcPricePerLiter } from "@/lib/formulas";
import { buildMissingLabel, t } from "@/lib/i18n";
import { useOnlineState } from "@/lib/offline/online-state";
import { fmtDate, fontMono, fontSerif, tokens } from "@/lib/theme-tokens";
import { fullNameOf } from "@/lib/person-utils";
import { useTheme } from "@/lib/theme-context";
import type { FuelFillup, FuelFillupInput } from "@/types";
import { zodResolver } from "@hookform/resolvers/zod";
import { Lock } from "lucide-react";
import { useEffect } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

const schema = z.object({
  person_id: z.number({ error: t("validation.person_required") }),
  car_id: z.number({ error: t("validation.car_required") }),
  date: z.string().min(1),
  amount: z.preprocess((v) => parseDecimalInput(v as string), z.number().positive()),
  liters: z.preprocess((v) => parseDecimalInput(v as string), z.number().positive()),
  full_tank: z.boolean().default(false),
  settled_outside: z.boolean().default(false),
  odometer: z.coerce
    .number()
    .int()
    .nullable()
    .optional()
    .transform((v) => v ?? null),
  receipt: z
    .string()
    .nullable()
    .optional()
    .transform((v) => v ?? null),
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
});
type FormInput = z.input<typeof schema>;
type FormData = z.output<typeof schema>;

interface Props {
  defaultValues?: Partial<FuelFillup>;
  onSubmit: (data: FuelFillupInput) => void;
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
  color: tokens.inkMute,
  display: "block",
  marginBottom: 4,
};
const monoLabel: React.CSSProperties = {
  fontFamily: fontMono,
  fontSize: 11,
  color: tokens.inkMute,
  display: "block",
  marginBottom: 4,
};
const dashedBox: React.CSSProperties = {
  border: `1.5px dashed ${tokens.paperDark}`,
  padding: "12px 14px",
};

export function FuelForm({ defaultValues, onSubmit, onCancel, onDelete, readOnly = false }: Props) {
  const { data: people = [] } = usePeople();
  const { data: cars = [] } = useCars();
  const { data: me } = useMe();
  const { online } = useOnlineState();
  const isAddMode = !defaultValues?.id;
  const isAdmin = me?.isAdmin ?? false;
  const { theme } = useTheme();
  const mono = theme === "mono";
  const { locale } = useLocale();

  const { register, handleSubmit, control, setValue, getValues } = useForm<
    FormInput,
    unknown,
    FormData
  >({
    resolver: zodResolver(schema),
    defaultValues: {
      date: defaultValues?.date ?? new Date().toISOString().slice(0, 10),
      person_id: defaultValues?.person_id,
      car_id: defaultValues?.car_id,
      amount: defaultValues?.amount ?? 0,
      liters: defaultValues?.liters ?? 0,
      full_tank: defaultValues?.full_tank === 1,
      settled_outside: defaultValues?.settled_outside === 1,
      odometer: defaultValues?.odometer ?? null,
      receipt: defaultValues?.receipt ?? null,
      location: defaultValues?.location ?? null,
      gps_coords: defaultValues?.gps_coords ?? null,
    },
  });

  const [amount, liters, carId, personId, date, fullTank, settledOutside] = useWatch({
    control,
    name: ["amount", "liters", "car_id", "person_id", "date", "full_tank", "settled_outside"],
  });
  const canSubmit = !!(
    personId &&
    carId &&
    date &&
    parseDecimalInput(amount as string) > 0 &&
    parseDecimalInput(liters as string) > 0
  );
  const missingLabel = buildMissingLabel([
    !carId && t("field.car"),
    isAdmin && !personId && t("field.driver"),
    !date && t("field.date"),
    !(parseDecimalInput(amount as string) > 0) && t("field.amount"),
    !(parseDecimalInput(liters as string) > 0) && t("field.liters"),
  ]);
  const pricePerLiter = calcPricePerLiter(
    parseDecimalInput(amount as string) || 0,
    parseDecimalInput(liters as string) || 0
  );
  const person = people.find((p) => p.id === personId);

  const { data: lastState } = useLastCarState(carId);
  useEffect(() => {
    if (!isAddMode || !carId || !lastState) return;
    if (lastState.odometer != null) {
      setValue("odometer", lastState.odometer);
    }
  }, [lastState, carId, isAddMode, setValue, getValues]);

  useEffect(() => {
    if (isAddMode && me?.personId && !getValues("person_id")) {
      setValue("person_id", me.personId);
    }
  }, [me, isAddMode, setValue, getValues]);

  const displayDate = date ? date.slice(5).replace("-", "/") : "";
  const lbl = mono ? monoLabel : paperLabel;
  const rowBorder = mono ? `1px solid ${tokens.paperDark}` : `1.5px dashed ${tokens.paperDark}`;

  function handleSubmitForm(data: FormData) {
    onSubmit({
      person_id: data.person_id,
      car_id: data.car_id,
      date: data.date,
      amount: data.amount,
      liters: data.liters,
      full_tank: data.full_tank ? 1 : 0,
      settled_outside: data.settled_outside ? 1 : 0,
      odometer: data.odometer,
      receipt: data.receipt,
      location: data.location,
      gps_coords: data.gps_coords,
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
        handleSubmit(handleSubmitForm)(e);
      }}
      style={{ background: tokens.paperDeep }}
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
          background: tokens.paper,
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
            color: tokens.ink,
            padding: "0 4px",
            lineHeight: 1,
          }}
        >
          ×
        </button>
        <div
          style={
            mono
              ? { fontFamily: fontSerif, fontSize: 17, fontWeight: 700, color: tokens.ink }
              : {
                  fontFamily: fontMono,
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: 3,
                  color: tokens.inkDim,
                  textTransform: "uppercase",
                }
          }
        >
          {!mono && "⛽ "}
          {t("form.fuel_receipt")}
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
              color: tokens.inkMute,
            }}
          >
            <Lock size={13} color={tokens.inkMute} strokeWidth={1.75} />
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
                background: mono ? tokens.accent : tokens.green,
                color: "#fff",
                border: "none",
                borderRadius: mono ? "var(--radius-pill, 999px)" : 0,
                padding: mono ? "8px 18px" : "8px 14px",
                cursor: canSubmit && online ? "pointer" : "default",
                opacity: canSubmit && online ? 1 : 0.35,
              }}
            >
              {mono ? t("action.save") : t("action.save_receipt")}
            </button>
            {!canSubmit && (
              <div
                className="submit-tip"
                style={{
                  position: "absolute",
                  right: 0,
                  top: "calc(100% + 6px)",
                  background: tokens.ink,
                  color: tokens.paper,
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
              color: tokens.amber,
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
                    color: tokens.ink,
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
                    color: tokens.ink,
                    lineHeight: 1.15,
                  }}
                >
                  {person ? fullNameOf(person) : (me?.shortName ?? "—")}
                </span>
                <Lock
                  size={14}
                  color={tokens.inkMute}
                  strokeWidth={1.75}
                  style={{ flexShrink: 0 }}
                />
              </div>
            ) : (
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span
                  style={{ fontFamily: fontSerif, fontSize: 17, fontWeight: 600, color: tokens.ink }}
                >
                  {person ? fullNameOf(person) : (me?.shortName ?? "—")}
                </span>
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
                    color: tokens.ink,
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
                    color: tokens.ink,
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
              color: tokens.amber,
              letterSpacing: 1,
            }}
          >
            🔒 {t("form.driver_locked_hint")}
          </div>
        )}

        {/* Pump / fuel section */}
        {mono ? (
          <div style={{ padding: "12px 14px 8px" }}>
            {/* Amount + price/L + Liters row */}
            <div style={{ display: "flex", alignItems: "flex-end", gap: 8 }}>
              <div style={{ flex: 1 }}>
                <span style={{ ...monoLabel, marginBottom: 2 }}>{t("form.amount")}</span>
                <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
                  <span style={{ fontFamily: fontMono, fontSize: 20, color: tokens.inkMute }}>
                    €
                  </span>
                  <input
                    {...register("amount")}
                    type="text"
                    inputMode="decimal"
                    style={{
                      fontFamily: fontMono,
                      fontSize: 28,
                      fontWeight: 700,
                      color: tokens.ink,
                      background: "transparent",
                      border: "none",
                      outline: "none",
                      borderBottom: `1px solid ${tokens.paperDark}`,
                      width: "100%",
                      padding: "2px 0",
                    }}
                  />
                </div>
              </div>
              <div style={{ textAlign: "center", flexShrink: 0, padding: "0 6px 8px" }}>
                <div style={{ fontFamily: fontMono, fontSize: 11.5, color: tokens.inkMute }}>
                  {parseDecimalInput(liters as string) > 0
                    ? `€ ${pricePerLiter.toFixed(3).replace(".", ",")}/L`
                    : "€/L"}
                </div>
              </div>
              <div style={{ flex: 1 }}>
                <span
                  style={{ ...monoLabel, marginBottom: 2, textAlign: "right", display: "block" }}
                >
                  {t("form.liters")}
                </span>
                <div
                  style={{
                    display: "flex",
                    alignItems: "baseline",
                    gap: 4,
                    justifyContent: "flex-end",
                  }}
                >
                  <input
                    {...register("liters")}
                    type="text"
                    inputMode="decimal"
                    style={{
                      fontFamily: fontMono,
                      fontSize: 28,
                      fontWeight: 700,
                      color: tokens.ink,
                      background: "transparent",
                      border: "none",
                      outline: "none",
                      borderBottom: `1px solid ${tokens.paperDark}`,
                      width: "100%",
                      padding: "2px 0",
                      textAlign: "right",
                    }}
                  />
                  <span
                    style={{
                      fontFamily: fontMono,
                      fontSize: 14,
                      color: tokens.inkMute,
                      flexShrink: 0,
                    }}
                  >
                    L
                  </span>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div
            style={{
              margin: "12px 14px",
              background: tokens.paper,
              border: `1.5px solid ${tokens.paperDark}`,
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "10px 14px 6px",
                borderBottom: `1px dashed ${tokens.paperDark}`,
              }}
            >
              <span
                style={{
                  fontFamily: fontMono,
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: 2,
                  color: tokens.amber,
                  textTransform: "uppercase",
                }}
              >
                ● {t("form.pump")}
              </span>
              <span
                style={{
                  fontFamily: fontMono,
                  fontSize: 10,
                  color: tokens.inkMute,
                  letterSpacing: 1,
                }}
              >
                {displayDate}
              </span>
            </div>

            {/* Amount + Liters */}
            <div
              style={{ display: "flex", alignItems: "flex-end", padding: "10px 14px 6px", gap: 0 }}
            >
              <div style={{ flex: 1 }}>
                <span style={{ ...paperLabel, fontSize: 8 }}>{t("form.amount")}</span>
                <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
                  <input
                    {...register("amount")}
                    type="text"
                    inputMode="decimal"
                    style={{
                      fontFamily: fontMono,
                      fontSize: 32,
                      fontWeight: 700,
                      color: tokens.ink,
                      background: "transparent",
                      border: "none",
                      outline: "none",
                      borderBottom: `1px dashed ${tokens.paperDark}`,
                      width: "100%",
                      padding: "2px 0",
                    }}
                  />
                </div>
              </div>
              <div
                style={{
                  padding: "0 12px 6px",
                  fontFamily: fontMono,
                  fontSize: 14,
                  color: tokens.inkMute,
                }}
              >
                €
              </div>
              <div style={{ flex: 1 }}>
                <span style={{ ...paperLabel, fontSize: 8 }}>{t("form.liters")}</span>
                <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
                  <input
                    {...register("liters")}
                    type="text"
                    inputMode="decimal"
                    style={{
                      fontFamily: fontMono,
                      fontSize: 32,
                      fontWeight: 700,
                      color: tokens.ink,
                      background: "transparent",
                      border: "none",
                      outline: "none",
                      borderBottom: `1px dashed ${tokens.paperDark}`,
                      width: "100%",
                      padding: "2px 0",
                    }}
                  />
                  <span
                    style={{
                      fontFamily: fontMono,
                      fontSize: 14,
                      color: tokens.inkMute,
                      flexShrink: 0,
                    }}
                  >
                    L
                  </span>
                </div>
              </div>
            </div>

            {/* Price per liter */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "8px 14px 12px",
                borderTop: `1px dashed ${tokens.paperDark}`,
              }}
            >
              <span
                style={{
                  fontFamily: fontMono,
                  fontSize: 9,
                  letterSpacing: 2,
                  textTransform: "uppercase",
                  color: tokens.inkMute,
                }}
              >
                {t("form.price_per_liter")}
              </span>
              <span
                style={{
                  fontFamily: fontMono,
                  fontSize: 12,
                  fontWeight: 700,
                  color: tokens.inkDim,
                  letterSpacing: 1,
                }}
              >
                € {pricePerLiter.toFixed(3).replace(".", ",")}
              </span>
            </div>
          </div>
        )}

        {/* Full tank toggle */}
        {mono ? (
          <div style={{ padding: "8px 14px", display: "flex", alignItems: "flex-start", gap: 12 }}>
            <div
              onClick={() => !readOnly && setValue("full_tank", !fullTank)}
              style={{
                width: 22,
                height: 22,
                borderRadius: "50%",
                border: `2px solid ${fullTank ? tokens.green : tokens.paperDark}`,
                background: fullTank ? tokens.green : "transparent",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
                marginTop: 2,
                cursor: "pointer",
                transition: "all 0.15s",
              }}
            >
              {fullTank && (
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#fff" }} />
              )}
            </div>
            <div
              style={{ flex: 1, cursor: "pointer" }}
              onClick={() => !readOnly && setValue("full_tank", !fullTank)}
            >
              <div
                style={{ fontFamily: fontSerif, fontSize: 15, fontWeight: 600, color: tokens.ink }}
              >
                {t("form.full_tank")}
              </div>
              <div
                style={{ fontFamily: fontMono, fontSize: 11, color: tokens.inkMute, marginTop: 2 }}
              >
                {t("form.full_tank_hint")}
              </div>
            </div>
            {fullTank && (
              <div style={{ textAlign: "right", flexShrink: 0, width: 88, overflow: "hidden" }}>
                <span
                  style={{ ...monoLabel, textAlign: "right", display: "block", marginBottom: 2 }}
                >
                  {t("form.odometer")}
                </span>
                <input
                  {...register("odometer")}
                  type="number"
                  placeholder="—"
                  style={{
                    fontFamily: fontSerif,
                    fontSize: 18,
                    fontWeight: 700,
                    color: tokens.ink,
                    background: "transparent",
                    border: "none",
                    borderBottom: `1px solid ${tokens.paperDark}`,
                    outline: "none",
                    width: "100%",
                    padding: "2px 0",
                    textAlign: "right",
                  }}
                />
              </div>
            )}
          </div>
        ) : (
          <div style={{ padding: "0 14px 8px", display: "flex", alignItems: "center", gap: 10 }}>
            <input
              type="checkbox"
              id="full_tank"
              checked={!!fullTank}
              onChange={(e) => setValue("full_tank", e.target.checked)}
              style={{ width: 16, height: 16, cursor: "pointer", accentColor: tokens.green }}
            />
            <label
              htmlFor="full_tank"
              style={{
                fontFamily: fontMono,
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: 2,
                textTransform: "uppercase",
                color: tokens.inkDim,
                cursor: "pointer",
              }}
            >
              {t("form.full_tank")}
            </label>
            <span
              style={{ fontFamily: fontMono, fontSize: 9, color: tokens.inkMute, letterSpacing: 1 }}
            >
              — {t("form.full_tank_hint")}
            </span>
          </div>
        )}

        {/* Settled outside toggle */}
        {mono ? (
          <div
            style={{
              padding: "8px 14px 12px",
              display: "flex",
              alignItems: "flex-start",
              gap: 12,
              cursor: "pointer",
            }}
            onClick={() => !readOnly && setValue("settled_outside", !settledOutside)}
          >
            <div
              style={{
                width: 22,
                height: 22,
                borderRadius: "50%",
                border: `2px solid ${settledOutside ? tokens.inkMute : tokens.paperDark}`,
                background: settledOutside ? tokens.inkMute : "transparent",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
                marginTop: 2,
                transition: "all 0.15s",
              }}
            >
              {settledOutside && (
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#fff" }} />
              )}
            </div>
            <div>
              <div
                style={{ fontFamily: fontSerif, fontSize: 15, fontWeight: 600, color: tokens.ink }}
              >
                {t("form.settled_outside")}
              </div>
              <div
                style={{ fontFamily: fontMono, fontSize: 11, color: tokens.inkMute, marginTop: 2 }}
              >
                {t("form.settled_outside_hint")}
              </div>
            </div>
          </div>
        ) : (
          <div style={{ padding: "0 14px 8px", display: "flex", alignItems: "center", gap: 10 }}>
            <input
              type="checkbox"
              id="fuel_settled_outside"
              checked={!!settledOutside}
              onChange={(e) => setValue("settled_outside", e.target.checked)}
              style={{ width: 16, height: 16, cursor: "pointer", accentColor: tokens.inkMute }}
            />
            <label
              htmlFor="fuel_settled_outside"
              style={{
                fontFamily: fontMono,
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: 2,
                textTransform: "uppercase",
                color: tokens.inkDim,
                cursor: "pointer",
              }}
            >
              {t("form.settled_outside")}
            </label>
            <span
              style={{ fontFamily: fontMono, fontSize: 9, color: tokens.inkMute, letterSpacing: 1 }}
            >
              — {t("form.settled_outside_hint")}
            </span>
          </div>
        )}

        {/* Odometer — only shown for full tank (paper only; mono shows inline with toggle) */}
        {fullTank && !mono && (
          <div style={{ padding: "0 14px 8px" }}>
            <span style={lbl}>{t("form.odometer")}</span>
            <div
              style={
                mono
                  ? {
                      border: `1px solid ${tokens.paperDark}`,
                      borderRadius: "var(--radius-sm, 6px)",
                      padding: "8px 14px",
                    }
                  : { ...dashedBox, padding: "8px 14px" }
              }
            >
              <input
                {...register("odometer")}
                type="number"
                placeholder="—"
                style={{
                  fontFamily: fontSerif,
                  fontSize: 20,
                  fontWeight: 600,
                  color: tokens.ink,
                  background: "transparent",
                  border: "none",
                  outline: "none",
                  width: "100%",
                  padding: 0,
                }}
              />
            </div>
          </div>
        )}

        {/* Fuel station location */}
        <div style={{ padding: "4px 14px 4px" }}>
          <span style={{ ...lbl, marginBottom: 6 }}>{t("form.fuel_station")}</span>
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

        {/* Receipt */}
        <div style={{ padding: "8px 14px" }}>
          {!mono && <span style={lbl}>{t("form.receipt")}</span>}
          <Controller
            name="receipt"
            control={control}
            render={({ field }) => (
              <ReceiptUpload value={field.value ?? null} onChange={field.onChange} />
            )}
          />
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
                border: mono ? `1px solid ${tokens.accent}` : `1.5px solid ${tokens.accent}`,
                borderRadius: mono ? "var(--radius-pill, 999px)" : 0,
                color: tokens.accent,
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
