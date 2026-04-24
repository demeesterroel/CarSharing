"use client";
import { useEffect } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { CarToggle } from "@/components/car-toggle";
import { LocationPicker } from "@/components/location-picker";
import { calcTripAmount } from "@/lib/formulas";
import { usePeople } from "@/hooks/use-people";
import { useCars } from "@/hooks/use-cars";
import { useLastCarState } from "@/hooks/use-car-state";
import { useMe } from "@/hooks/use-me";
import type { Trip } from "@/types";
import { t } from "@/lib/i18n";
import { paper, fontMono, fontSerif, fmtMoney } from "@/lib/paper-theme";

const schema = z.object({
  person_id: z.number({ error: t("validation.person_required") }),
  car_id: z.number({ error: t("validation.car_required") }),
  date: z.string().min(1),
  start_odometer: z.coerce.number().int().min(0),
  end_odometer: z.coerce.number().int().min(0),
  location: z.string().nullable().optional().transform((v) => v ?? null),
  gps_coords: z.string().nullable().optional().transform((v) => v ?? null),
  parking: z.string().nullable().optional().transform((v) => v ?? null),
}).refine((d) => d.end_odometer >= d.start_odometer, {
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
}

const label: React.CSSProperties = {
  fontFamily: fontMono, fontSize: 9, fontWeight: 700, letterSpacing: 2,
  textTransform: "uppercase", color: paper.inkMute, display: "block", marginBottom: 4,
};
const dashedBox: React.CSSProperties = {
  border: `1.5px dashed ${paper.paperDark}`, padding: "12px 14px",
};
const bigInput: React.CSSProperties = {
  fontFamily: fontSerif, fontSize: 28, fontWeight: 700, color: paper.ink,
  background: "transparent", border: "none", outline: "none",
  width: "100%", padding: 0,
};

export function TripForm({ defaultValues, onSubmit, onCancel, onDelete }: Props) {
  const { data: people = [] } = usePeople();
  const { data: cars = [] } = useCars();
  const { data: me } = useMe();
  const isAddMode = !defaultValues?.id;
  const isAdmin = me?.isAdmin ?? false;

  const { register, handleSubmit, control, watch, setValue, getValues, formState: { errors } } = useForm<FormInput, unknown, FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      date: new Date().toISOString().slice(0, 10),
      start_odometer: 0, end_odometer: 0, location: null, gps_coords: null, parking: null,
      ...defaultValues,
    },
  });

  const [start, end, personId, carId] = watch(["start_odometer", "end_odometer", "person_id", "car_id"]);
  const km = Math.max(0, (Number(end) || 0) - (Number(start) || 0));
  const person = people.find((p) => p.id === personId);
  const car = cars.find((c) => c.id === carId);

  const shortKm = Math.min(km, 500);
  const longKm = Math.max(km - 500, 0);
  const disc = person?.discount ?? 0;
  const discLong = person?.discount_long ?? 0;
  const shortAmount = car ? car.price_per_km * shortKm * (1 - disc) : 0;
  const longAmount  = car ? car.price_per_km * longKm  * (1 - discLong) : 0;
  const amount = shortAmount + longAmount;

  const { data: lastState } = useLastCarState(carId);

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
  const pctLong  = Math.round(discLong * 100);

  return (
    <form onSubmit={handleSubmit(onSubmit)} style={{ background: paper.paperDeep }}>
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
          border: "none", cursor: "pointer", color: paper.ink, padding: "0 4px",
          lineHeight: 1,
        }}>×</button>
        <div style={{ fontFamily: fontMono, fontSize: 10, fontWeight: 700, letterSpacing: 3, color: paper.inkDim, textTransform: "uppercase" }}>
          ① {t("form.log_trip")}
        </div>
        <button type="submit" style={{
          fontFamily: fontMono, fontSize: 9, fontWeight: 700, letterSpacing: 2,
          textTransform: "uppercase", background: paper.accent, color: "#fff",
          border: "none", padding: "8px 14px", cursor: "pointer",
        }}>
          {t("action.save_trip")}
        </button>
      </div>

      {/* Car tabs */}
      <Controller name="car_id" control={control}
        render={({ field }) => <CarToggle cars={cars} value={field.value} onChange={field.onChange} />}
      />

      {/* Driver + Date row */}
      <div style={{ display: "flex", borderBottom: `1.5px dashed ${paper.paperDark}` }}>
        <div style={{ flex: 1, padding: "10px 14px", borderRight: `1.5px dashed ${paper.paperDark}` }}>
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
              {(person?.discount ?? 0) > 0 && <span style={{ color: paper.accent, fontSize: 13 }}>★</span>}
              <span style={{ fontSize: 13 }}>🔒</span>
            </div>
          )}
        </div>
        <div style={{ flex: 1, padding: "10px 14px" }}>
          <span style={label}>{t("form.date")}</span>
          <input {...register("date")} type="date" style={{ fontFamily: fontSerif, fontSize: 17, fontWeight: 600, color: paper.ink, background: "transparent", border: "none", outline: "none", width: "100%", padding: 0, cursor: "pointer" }} />
        </div>
      </div>
      {!isAdmin && (
        <div style={{ padding: "6px 14px", fontFamily: fontMono, fontSize: 9, color: paper.amber, letterSpacing: 1 }}>
          🔒 {t("form.driver_locked_hint")}
        </div>
      )}

      {/* Odometer block */}
      <div style={{ margin: "12px 14px", background: paper.paper, border: `1.5px solid ${paper.paperDark}` }}>
        <div style={{
          textAlign: "center", padding: "8px 0 4px",
          fontFamily: fontMono, fontSize: 9, fontWeight: 700, letterSpacing: 3,
          color: paper.inkMute, textTransform: "uppercase",
          borderBottom: `1px dashed ${paper.paperDark}`,
        }}>
          @ {t("form.odometer_section")}
        </div>
        <div style={{ display: "flex", alignItems: "center", padding: "12px 14px", gap: 8 }}>
          <div style={{ flex: 1 }}>
            <span style={{ ...label, fontSize: 8 }}>{t("form.start_km")}</span>
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
          <div style={{ textAlign: "center", flexShrink: 0, padding: "0 8px" }}>
            <div style={{ fontFamily: fontMono, fontSize: 10, color: paper.inkMute, letterSpacing: 1, marginBottom: 2 }}>
              {km > 0 ? `${km} KM` : "—"}
            </div>
            <div style={{ fontSize: 16, color: errors.end_odometer ? paper.accent : paper.inkMute }}>→</div>
          </div>
          <div style={{ flex: 1, textAlign: "right" }}>
            <span style={{ ...label, fontSize: 8, textAlign: "right", display: "block" }}>{t("form.end_km")}</span>
            <input
              {...register("end_odometer")}
              type="number"
              style={{ ...bigInput, fontSize: 26, textAlign: "right" }}
            />
            {errors.end_odometer && (
              <div style={{ fontFamily: fontMono, fontSize: 8, color: paper.accent, letterSpacing: 1 }}>
                {errors.end_odometer.message}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Location (GPS + map) */}
      <div style={{ padding: "4px 14px 4px" }}>
        <span style={{ ...label, marginBottom: 6 }}>{t("form.where_parked")}</span>
        <Controller name="location" control={control}
          render={({ field: addrField }) => (
            <Controller name="gps_coords" control={control}
              render={({ field: coordsField }) => (
                <LocationPicker
                  address={addrField.value ?? null}
                  coords={coordsField.value ?? null}
                  onAddressChange={(v) => addrField.onChange(v ?? null)}
                  onCoordsChange={(v) => coordsField.onChange(v ?? null)}
                />
              )}
            />
          )}
        />
      </div>

      {/* Parking note */}
      <div style={{ padding: "8px 14px 4px" }}>
        <span style={{ ...label, marginBottom: 6 }}>{t("form.parking_note")}</span>
        <div style={{ ...dashedBox, padding: "10px 14px" }}>
          <input
            {...register("parking")}
            type="text"
            placeholder="bv. ondergrondse parking, verdieping -1"
            style={{
              fontFamily: fontSerif, fontSize: 16, fontWeight: 500, color: paper.ink,
              background: "transparent", border: "none", outline: "none",
              width: "100%", padding: 0,
            }}
          />
        </div>
      </div>

      {/* Breakdown */}
      {km > 0 && car && person && (
        <div style={{ margin: "12px 14px", ...dashedBox }}>
          <div style={{
            textAlign: "center", fontFamily: fontMono, fontSize: 9, fontWeight: 700,
            letterSpacing: 3, color: paper.inkDim, textTransform: "uppercase", marginBottom: 10,
          }}>
            — {t("form.breakdown")} —
          </div>
          <BreakdownRow label={t("form.rate")} value={`€ ${car.price_per_km.toFixed(2).replace(".", ",")} / km`} />
          <BreakdownRow
            label={t("form.tier_short", { km: String(shortKm), pct: String(pctShort) })}
            value={fmtMoney(shortAmount)}
          />
          {longKm > 0 && (
            <BreakdownRow
              label={t("form.tier_long", { km: String(longKm), pct: String(pctLong) })}
              value={fmtMoney(longAmount)}
            />
          )}
          <div style={{ borderTop: `1px dashed ${paper.paperDark}`, margin: "8px 0" }} />
          <BreakdownRow
            label={`TOTAL (${km} km)`}
            value={fmtMoney(amount)}
            valueStyle={{ color: paper.accent, fontSize: 15, fontWeight: 700 }}
          />
          {(shortAmount + longAmount) < car.price_per_km * km && (
            <div style={{ textAlign: "right", fontFamily: fontMono, fontSize: 9, color: paper.inkMute, letterSpacing: 1, marginTop: 2 }}>
              − {fmtMoney(car.price_per_km * km - amount)} {t("form.total_discount").toLowerCase()}
            </div>
          )}
        </div>
      )}

      {onDelete && (
        <div style={{ padding: "0 14px 24px" }}>
          <button type="button" onClick={onDelete} style={{
            width: "100%", padding: "10px", background: "transparent",
            border: `1.5px solid ${paper.accent}`, color: paper.accent,
            fontFamily: fontMono, fontSize: 10, fontWeight: 700, letterSpacing: 2,
            textTransform: "uppercase", cursor: "pointer",
          }}>
            {t("action.delete")}
          </button>
        </div>
      )}
      <div style={{ height: 32 }} />
    </form>
  );
}

function BreakdownRow({
  label: lbl, value, valueStyle,
}: { label: string; value: string; valueStyle?: React.CSSProperties }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
      <span style={{ fontFamily: fontMono, fontSize: 9, color: paper.inkDim, letterSpacing: 1.5, textTransform: "uppercase" }}>
        {lbl}
      </span>
      <span style={{ fontFamily: fontMono, fontSize: 12, fontWeight: 700, color: paper.ink, ...valueStyle }}>
        {value}
      </span>
    </div>
  );
}
