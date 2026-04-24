"use client";
import { useEffect } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { CarToggle } from "@/components/car-toggle";
import { usePeople } from "@/hooks/use-people";
import { useCars } from "@/hooks/use-cars";
import { useMe } from "@/hooks/use-me";
import type { Expense, ExpenseCategory, ExpenseInput } from "@/types";
import { useT } from "@/components/locale-provider";
import { paper, fontMono, fontSerif } from "@/lib/paper-theme";

const EXPENSE_CATEGORIES: { key: ExpenseCategory; icon: string; labelKey: string }[] = [
  { key: "onderhoud",   icon: "🔧", labelKey: "form.cat_onderhoud"   },
  { key: "keuring",     icon: "🔍", labelKey: "form.cat_keuring"     },
  { key: "belasting",   icon: "📜", labelKey: "form.cat_belasting"   },
  { key: "verzekering", icon: "🛡️", labelKey: "form.cat_verzekering" },
  { key: "diversen",    icon: "📎", labelKey: "form.cat_diversen"    },
];

const schema = z.object({
  person_id: z.number({ error: "Persoon vereist" }),
  car_id: z.number({ error: "Wagen vereist" }),
  date: z.string().min(1),
  amount: z.coerce.number().positive(),
  description: z.string().nullable().optional().transform((v) => v ?? null),
  category: z.string().nullable().optional().transform((v) => v ?? null),
});
type FormInput = z.input<typeof schema>;
type FormData = z.output<typeof schema>;

interface Props {
  defaultValues?: Partial<Expense>;
  onSubmit: (data: ExpenseInput) => void;
  onCancel: () => void;
  onDelete?: () => void;
}

const dashedBox: React.CSSProperties = {
  border: `1.5px dashed ${paper.paperDark}`,
};

export function ExpenseForm({ defaultValues, onSubmit, onCancel, onDelete }: Props) {
  const t = useT();
  const { data: people = [] } = usePeople();
  const { data: cars = [] } = useCars();
  const { data: me } = useMe();
  const isAddMode = !defaultValues?.id;
  const isAdmin = me?.isAdmin ?? false;

  const { register, handleSubmit, control, watch, setValue, getValues } = useForm<FormInput, unknown, FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      date: defaultValues?.date ?? new Date().toISOString().slice(0, 10),
      amount: defaultValues?.amount ?? 0,
      description: defaultValues?.description ?? null,
      category: defaultValues?.category ?? null,
      person_id: defaultValues?.person_id,
      car_id: defaultValues?.car_id,
    },
  });

  const [personId, category] = watch(["person_id", "category"]);
  const person = people.find((p) => p.id === personId);

  useEffect(() => {
    if (isAddMode && me?.personId && !getValues("person_id")) {
      setValue("person_id", me.personId);
    }
  }, [me, isAddMode, setValue, getValues]);

  return (
    <form onSubmit={handleSubmit(onSubmit as any)} style={{ background: paper.paperDeep }}>
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
          📋 {t("form.extra_cost")}
        </div>
        <button type="submit" style={{
          fontFamily: fontMono, fontSize: 9, fontWeight: 700, letterSpacing: 2,
          textTransform: "uppercase", background: paper.inkDim, color: "#fff",
          border: "none", padding: "8px 14px", cursor: "pointer",
        }}>
          {t("action.save_cost")}
        </button>
      </div>

      {/* Car tabs */}
      <Controller name="car_id" control={control}
        render={({ field }) => <CarToggle cars={cars} value={field.value} onChange={field.onChange} />}
      />

      {/* Driver + Date row */}
      <div style={{ display: "flex", borderBottom: `1.5px dashed ${paper.paperDark}` }}>
        <div style={{ flex: 1, padding: "10px 14px", borderRight: `1.5px dashed ${paper.paperDark}` }}>
          <span style={{ fontFamily: fontMono, fontSize: 9, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", color: paper.inkMute, display: "block", marginBottom: 4 }}>
            {t("form.driver")}
          </span>
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
          <span style={{ fontFamily: fontMono, fontSize: 9, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", color: paper.inkMute, display: "block", marginBottom: 4 }}>
            {t("form.date")}
          </span>
          <input {...register("date")} type="date" style={{ fontFamily: fontSerif, fontSize: 17, fontWeight: 600, color: paper.ink, background: "transparent", border: "none", outline: "none", width: "100%", padding: 0, cursor: "pointer" }} />
        </div>
      </div>
      {!isAdmin && (
        <div style={{ padding: "6px 14px", fontFamily: fontMono, fontSize: 9, color: paper.amber, letterSpacing: 1 }}>
          🔒 {t("form.driver_locked_hint")}
        </div>
      )}

      {/* Category */}
      <div style={{ padding: "12px 14px 4px" }}>
        <span style={{ fontFamily: fontMono, fontSize: 9, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", color: paper.inkMute, display: "block", marginBottom: 8 }}>
          — {t("form.category")} —
        </span>
        <div style={{ display: "flex", width: "100%", border: `1.5px solid ${paper.paperDark}` }}>
          {EXPENSE_CATEGORIES.map((cat, i, arr) => {
            const selected = category === cat.key;
            return (
              <button
                key={cat.key}
                type="button"
                onClick={() => setValue("category", cat.key)}
                style={{
                  flex: 1, padding: "12px 4px",
                  background: selected ? paper.ink : "transparent",
                  borderTop: "none", borderLeft: "none", borderBottom: "none",
                  borderRight: i < arr.length - 1 ? `1px solid ${paper.paperDark}` : "none",
                  cursor: "pointer", textAlign: "center",
                }}
              >
                <div style={{ fontSize: 18, marginBottom: 4 }}>{cat.icon}</div>
                <div style={{
                  fontFamily: fontMono, fontSize: 8, fontWeight: 700, letterSpacing: 1,
                  textTransform: "uppercase",
                  color: selected ? paper.paper : paper.inkDim,
                }}>
                  {t(cat.labelKey as any)}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Amount */}
      <div style={{ margin: "12px 14px", ...dashedBox, padding: "12px 14px" }}>
        <span style={{ fontFamily: fontMono, fontSize: 9, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", color: paper.inkMute, display: "block", marginBottom: 8 }}>
          {t("form.amount")}
        </span>
        <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
          <span style={{ fontFamily: fontSerif, fontSize: 32, fontWeight: 700, color: paper.inkDim }}>€</span>
          <input
            {...register("amount")}
            type="number" step="0.01"
            placeholder="0,00"
            style={{
              fontFamily: fontSerif, fontSize: 32, fontWeight: 700, color: paper.ink,
              background: "transparent", border: "none", outline: "none",
              flex: 1, padding: 0,
            }}
          />
        </div>
      </div>

      {/* Description */}
      <div style={{ padding: "0 14px" }}>
        <span style={{ fontFamily: fontMono, fontSize: 9, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", color: paper.inkMute, display: "block", marginBottom: 6 }}>
          {t("form.description")} *
        </span>
        <div style={{ ...dashedBox, padding: "10px 14px" }}>
          <input
            {...register("description")}
            type="text"
            placeholder={t("form.description_placeholder")}
            style={{
              fontFamily: fontSerif, fontSize: 17, fontWeight: 500, color: paper.ink,
              background: "transparent", border: "none", outline: "none",
              width: "100%", padding: 0,
            }}
          />
        </div>
      </div>

      {onDelete && (
        <div style={{ padding: "8px 14px 24px" }}>
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
