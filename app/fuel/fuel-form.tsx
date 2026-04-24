"use client";
import { useEffect } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { CarToggle } from "@/components/car-toggle";
import { ReceiptUpload } from "@/components/receipt-upload";
import { LocationPicker } from "@/components/location-picker";
import { calcPricePerLiter } from "@/lib/formulas";
import { usePeople } from "@/hooks/use-people";
import { useCars } from "@/hooks/use-cars";
import { useLastCarState } from "@/hooks/use-car-state";
import { useMe } from "@/hooks/use-me";
import type { FuelFillup, FuelFillupInput } from "@/types";
import { t } from "@/lib/i18n";
import { paper, fontMono, fontSerif } from "@/lib/paper-theme";

const schema = z.object({
  person_id: z.number({ error: t("validation.person_required") }),
  car_id: z.number({ error: t("validation.car_required") }),
  date: z.string().min(1),
  amount: z.coerce.number().positive(),
  liters: z.coerce.number().positive(),
  full_tank: z.boolean().default(false),
  odometer: z.coerce.number().int().nullable().optional().transform((v) => v ?? null),
  receipt: z.string().nullable().optional().transform((v) => v ?? null),
  location: z.string().nullable().optional().transform((v) => v ?? null),
  gps_coords: z.string().nullable().optional().transform((v) => v ?? null),
});
type FormInput = z.input<typeof schema>;
type FormData = z.output<typeof schema>;

interface Props {
  defaultValues?: Partial<FuelFillup>;
  onSubmit: (data: FuelFillupInput) => void;
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

export function FuelForm({ defaultValues, onSubmit, onCancel, onDelete }: Props) {
  const { data: people = [] } = usePeople();
  const { data: cars = [] } = useCars();
  const { data: me } = useMe();
  const isAddMode = !defaultValues?.id;
  const isAdmin = me?.isAdmin ?? false;

  const { register, handleSubmit, control, watch, setValue, getValues } = useForm<FormInput, unknown, FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      date: defaultValues?.date ?? new Date().toISOString().slice(0, 10),
      person_id: defaultValues?.person_id,
      car_id: defaultValues?.car_id,
      amount: defaultValues?.amount ?? 0,
      liters: defaultValues?.liters ?? 0,
      full_tank: defaultValues?.full_tank === 1,
      odometer: defaultValues?.odometer ?? null,
      receipt: defaultValues?.receipt ?? null,
      location: defaultValues?.location ?? null,
      gps_coords: defaultValues?.gps_coords ?? null,
    },
  });

  const [amount, liters, carId, personId, date, fullTank] = watch(["amount", "liters", "car_id", "person_id", "date", "full_tank"]);
  const pricePerLiter = calcPricePerLiter(Number(amount) || 0, Number(liters) || 0);
  const person = people.find((p) => p.id === personId);

  const { data: lastState } = useLastCarState(carId);
  useEffect(() => {
    if (!isAddMode || !carId || !lastState) return;
    const current = getValues("odometer");
    if ((!current || Number(current) === 0) && lastState.odometer != null) {
      setValue("odometer", lastState.odometer);
    }
  }, [lastState, carId, isAddMode, setValue, getValues]);

  useEffect(() => {
    if (isAddMode && me?.personId && !getValues("person_id")) {
      setValue("person_id", me.personId);
    }
  }, [me, isAddMode, setValue, getValues]);

  const displayDate = date ? date.slice(5).replace("-", "/") : "";

  function handleSubmitForm(data: FormData) {
    onSubmit({
      person_id: data.person_id,
      car_id: data.car_id,
      date: data.date,
      amount: data.amount,
      liters: data.liters,
      full_tank: data.full_tank ? 1 : 0,
      odometer: data.odometer,
      receipt: data.receipt,
      location: data.location,
      gps_coords: data.gps_coords,
    });
  }

  return (
    <form onSubmit={handleSubmit(handleSubmitForm)} style={{ background: paper.paperDeep }}>
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
          ⛽ {t("form.fuel_receipt")}
        </div>
        <button type="submit" style={{
          fontFamily: fontMono, fontSize: 9, fontWeight: 700, letterSpacing: 2,
          textTransform: "uppercase", background: paper.green, color: "#fff",
          border: "none", padding: "8px 14px", cursor: "pointer",
        }}>
          {t("action.save_receipt")}
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

      {/* Pump block — light theme */}
      <div style={{ margin: "12px 14px", background: paper.paper, border: `1.5px solid ${paper.paperDark}` }}>
        <div style={{
          display: "flex", justifyContent: "space-between", alignItems: "center",
          padding: "10px 14px 6px",
          borderBottom: `1px dashed ${paper.paperDark}`,
        }}>
          <span style={{ fontFamily: fontMono, fontSize: 10, fontWeight: 700, letterSpacing: 2, color: paper.amber }}>
            ● {t("form.pump")}
          </span>
          <span style={{ fontFamily: fontMono, fontSize: 10, color: paper.inkMute, letterSpacing: 1 }}>
            {displayDate}
          </span>
        </div>

        {/* Amount + Liters */}
        <div style={{ display: "flex", alignItems: "flex-end", padding: "10px 14px 6px", gap: 0 }}>
          <div style={{ flex: 1 }}>
            <span style={{ ...label, fontSize: 8 }}>{t("form.amount")}</span>
            <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
              <input
                {...register("amount")}
                type="number" step="0.01"
                style={{
                  fontFamily: fontMono, fontSize: 32, fontWeight: 700, color: paper.ink,
                  background: "transparent", border: "none", outline: "none",
                  borderBottom: `1px dashed ${paper.paperDark}`,
                  width: "100%", padding: "2px 0",
                }}
              />
            </div>
          </div>
          <div style={{ padding: "0 12px 6px", fontFamily: fontMono, fontSize: 14, color: paper.inkMute }}>€</div>
          <div style={{ flex: 1 }}>
            <span style={{ ...label, fontSize: 8 }}>{t("form.liters")}</span>
            <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
              <input
                {...register("liters")}
                type="number" step="0.01"
                style={{
                  fontFamily: fontMono, fontSize: 32, fontWeight: 700, color: paper.ink,
                  background: "transparent", border: "none", outline: "none",
                  borderBottom: `1px dashed ${paper.paperDark}`,
                  width: "100%", padding: "2px 0",
                }}
              />
              <span style={{ fontFamily: fontMono, fontSize: 14, color: paper.inkMute, flexShrink: 0 }}>L</span>
            </div>
          </div>
        </div>

        {/* Price per liter */}
        <div style={{
          display: "flex", justifyContent: "space-between", alignItems: "center",
          padding: "8px 14px 12px",
          borderTop: `1px dashed ${paper.paperDark}`,
        }}>
          <span style={{ fontFamily: fontMono, fontSize: 9, letterSpacing: 2, textTransform: "uppercase", color: paper.inkMute }}>
            {t("form.price_per_liter")}
          </span>
          <span style={{ fontFamily: fontMono, fontSize: 12, fontWeight: 700, color: paper.inkDim, letterSpacing: 1 }}>
            € {pricePerLiter.toFixed(3).replace(".", ",")}
          </span>
        </div>
      </div>

      {/* Full tank checkbox */}
      <div style={{ padding: "0 14px 8px", display: "flex", alignItems: "center", gap: 10 }}>
        <input
          type="checkbox"
          id="full_tank"
          checked={!!fullTank}
          onChange={(e) => setValue("full_tank", e.target.checked)}
          style={{ width: 16, height: 16, cursor: "pointer", accentColor: paper.green }}
        />
        <label htmlFor="full_tank" style={{ fontFamily: fontMono, fontSize: 10, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", color: paper.inkDim, cursor: "pointer" }}>
          {t("form.full_tank")}
        </label>
        <span style={{ fontFamily: fontMono, fontSize: 9, color: paper.inkMute, letterSpacing: 1 }}>
          — {t("form.full_tank_hint")}
        </span>
      </div>

      {/* Odometer — only shown for full tank */}
      {fullTank && (
        <div style={{ padding: "0 14px 8px" }}>
          <span style={label}>{t("form.odometer")}</span>
          <div style={{ ...dashedBox, padding: "8px 14px" }}>
            <input
              {...register("odometer")}
              type="number"
              placeholder="—"
              style={{ fontFamily: fontSerif, fontSize: 20, fontWeight: 600, color: paper.ink, background: "transparent", border: "none", outline: "none", width: "100%", padding: 0 }}
            />
          </div>
        </div>
      )}

      {/* Fuel station location */}
      <div style={{ padding: "4px 14px 4px" }}>
        <span style={{ ...label, marginBottom: 6 }}>{t("form.fuel_station")}</span>
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

      {/* Receipt */}
      <div style={{ padding: "8px 14px" }}>
        <span style={label}>{t("form.receipt")}</span>
        <Controller name="receipt" control={control}
          render={({ field }) => <ReceiptUpload value={field.value ?? null} onChange={field.onChange} />}
        />
      </div>

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
