"use client";
import { CarToggle } from "@/components/car-toggle";
import { useLocale, useT } from "@/components/locale-provider";
import { ReceiptUpload } from "@/components/receipt-upload";
import { useMe } from "@/hooks/use-me";
import { usePeople } from "@/hooks/use-people";
import { useCars } from "@/hooks/use-vehicles";
import { buildMissingLabel } from "@/lib/i18n";
import { useOnlineState } from "@/lib/offline/online-state";
import { fmtDate, fontMono, fontSerif, tokens } from "@/lib/theme-tokens";
import { fullNameOf } from "@/lib/person-utils";
import { useTheme } from "@/lib/theme-context";
import type { Expense, ExpenseCategory, ExpenseInput } from "@/types";
import { zodResolver } from "@hookform/resolvers/zod";
import { FileText, Lock, MoreHorizontal, Search, Shield, Wrench } from "lucide-react";
import { useEffect } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

const EXPENSE_CATEGORIES: {
  key: ExpenseCategory;
  icon: string;
  Icon: React.ComponentType<{ size?: number; strokeWidth?: number; color?: string }>;
  labelKey: string;
}[] = [
  { key: "onderhoud", icon: "🔧", Icon: Wrench, labelKey: "form.cat_onderhoud" },
  { key: "keuring", icon: "🔍", Icon: Search, labelKey: "form.cat_keuring" },
  { key: "belasting", icon: "📜", Icon: FileText, labelKey: "form.cat_belasting" },
  { key: "verzekering", icon: "🛡️", Icon: Shield, labelKey: "form.cat_verzekering" },
  { key: "diversen", icon: "📎", Icon: MoreHorizontal, labelKey: "form.cat_diversen" },
];

const schema = z.object({
  person_id: z.number({ error: "Persoon vereist" }),
  car_id: z.number({ error: "Wagen vereist" }),
  date: z.string().min(1),
  amount: z.coerce.number().positive(),
  description: z
    .string()
    .nullable()
    .optional()
    .transform((v) => v ?? null),
  category: z
    .string()
    .nullable()
    .optional()
    .transform((v) => v ?? null),
  receipt: z
    .string()
    .nullable()
    .optional()
    .transform((v) => v ?? null),
  settled_outside: z.boolean().default(false),
});
type FormInput = z.input<typeof schema>;
type FormData = z.output<typeof schema>;

interface Props {
  defaultValues?: Partial<Expense>;
  onSubmit: (data: ExpenseInput) => void;
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
};

export function ExpenseForm({
  defaultValues,
  onSubmit,
  onCancel,
  onDelete,
  readOnly = false,
}: Props) {
  const t = useT();
  const { locale } = useLocale();
  const { theme } = useTheme();
  const mono = theme === "mono";
  const lbl = mono ? monoLabel : paperLabel;

  const { data: people = [] } = usePeople();
  const { data: cars = [] } = useCars();
  const { data: me } = useMe();
  const { online } = useOnlineState();
  const isAddMode = !defaultValues?.id;
  const isAdmin = me?.isAdmin ?? false;

  const { register, handleSubmit, control, setValue, getValues } = useForm<
    FormInput,
    unknown,
    FormData
  >({
    resolver: zodResolver(schema),
    defaultValues: {
      date: defaultValues?.date ?? new Date().toISOString().slice(0, 10),
      amount: defaultValues?.amount ?? 0,
      description: defaultValues?.description ?? null,
      category: defaultValues?.category ?? null,
      receipt: defaultValues?.receipt ?? null,
      settled_outside: defaultValues?.settled_outside === 1,
      person_id: defaultValues?.person_id,
      car_id: defaultValues?.car_id,
    },
  });

  const [personId, category, settledOutside, carIdW, dateW, amountW] = useWatch({
    control,
    name: ["person_id", "category", "settled_outside", "car_id", "date", "amount"],
  });
  const canSubmit = !!(personId && carIdW && dateW && Number(amountW) > 0);
  const missingLabel = buildMissingLabel([
    !carIdW && t("field.car"),
    isAdmin && !personId && t("field.driver"),
    !dateW && t("field.date"),
    !(Number(amountW) > 0) && t("field.amount"),
  ]);
  const person = people.find((p) => p.id === personId);

  useEffect(() => {
    if (isAddMode && me?.personId && !getValues("person_id")) {
      setValue("person_id", me.personId);
    }
  }, [me, isAddMode, setValue, getValues]);

  function handleSubmitForm(data: FormData) {
    onSubmit({
      person_id: data.person_id,
      car_id: data.car_id,
      date: data.date,
      amount: data.amount,
      description: data.description,
      category: (data.category as ExpenseCategory) ?? null,
      receipt: data.receipt,
      settled_outside: data.settled_outside ? 1 : 0,
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
          borderBottom: mono ? `1px solid ${tokens.paperDark}` : `1.5px solid ${tokens.paperDark}`,
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
              ? {
                  fontFamily:
                    "var(--font-inter-tight, 'Inter Tight', 'Inter', system-ui, sans-serif)",
                  fontSize: 16,
                  fontWeight: 700,
                  color: tokens.ink,
                }
              : {
                  fontFamily: fontMono,
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: 3,
                  color: tokens.inkDim,
                  textTransform: "uppercase" as const,
                }
          }
        >
          {mono ? t("form.extra_cost") : `📋 ${t("form.extra_cost")}`}
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
              style={
                mono
                  ? {
                      fontFamily: "var(--font-inter, 'Inter', system-ui, sans-serif)",
                      fontSize: 14,
                      fontWeight: 600,
                      background: tokens.accent,
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
                      background: tokens.inkDim,
                      color: "#fff",
                      border: "none",
                      padding: "8px 14px",
                      cursor: canSubmit && online ? "pointer" : "default",
                      opacity: canSubmit && online ? 1 : 0.35,
                    }
              }
            >
              {mono ? t("action.save") : t("action.save_cost")}
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
              borderBottom: mono
                ? `1px solid ${tokens.paperDark}`
                : `1.5px dashed ${tokens.paperDark}`,
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
        <div
          style={{
            display: "flex",
            borderBottom: mono ? `1px solid ${tokens.paperDark}` : `1.5px dashed ${tokens.paperDark}`,
          }}
        >
          <div
            style={{
              flex: 1,
              padding: "10px 14px",
              borderRight: mono
                ? `1px solid ${tokens.paperDark}`
                : `1.5px dashed ${tokens.paperDark}`,
            }}
          >
            {mono ? (
              <>
                {isAdmin ? (
                  <>
                    <span style={lbl}>{t("form.driver")}</span>
                    <select
                      value={personId ?? ""}
                      onChange={(e) => setValue("person_id", Number(e.target.value))}
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
                        color: tokens.ink,
                      }}
                    >
                      {person ? fullNameOf(person) : (me?.shortName ?? "—")}
                    </span>
                    <Lock size={14} color={tokens.inkMute} strokeWidth={1.75} />
                  </div>
                )}
              </>
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
                ) : (
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span
                      style={{
                        fontFamily: fontSerif,
                        fontSize: 17,
                        fontWeight: 600,
                        color: tokens.ink,
                      }}
                    >
                      {person ? fullNameOf(person) : (me?.shortName ?? "—")}
                    </span>
                    {(person?.discount ?? 0) > 0 && (
                      <span style={{ color: tokens.accent, fontSize: 13 }}>★</span>
                    )}
                    <span style={{ fontSize: 13 }}>🔒</span>
                  </div>
                )}
              </>
            )}
          </div>
          <div style={{ flex: 1, padding: "10px 14px" }}>
            {mono ? (
              <div style={{ position: "relative" }}>
                <span style={{ ...monoLabel, marginBottom: 2 }}>{t("form.date")}</span>
                <div
                  style={{
                    fontFamily:
                      "var(--font-inter-tight, 'Inter Tight', 'Inter', system-ui, sans-serif)",
                    fontSize: 17,
                    fontWeight: 700,
                    color: tokens.ink,
                    pointerEvents: "none",
                  }}
                >
                  {dateW ? fmtDate(dateW, locale) : "—"}
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

        {/* Category */}
        <div style={{ padding: "12px 14px 4px" }}>
          <span
            style={
              mono
                ? {
                    fontFamily:
                      "var(--font-inter-tight, 'Inter Tight', 'Inter', system-ui, sans-serif)",
                    fontSize: 13,
                    fontWeight: 600,
                    color: tokens.inkDim,
                    display: "block",
                    marginBottom: 8,
                  }
                : {
                    fontFamily: fontMono,
                    fontSize: 9,
                    fontWeight: 700,
                    letterSpacing: 2,
                    textTransform: "uppercase" as const,
                    color: tokens.inkMute,
                    display: "block",
                    marginBottom: 8,
                  }
            }
          >
            {mono ? t("form.category") : `— ${t("form.category").toUpperCase()} —`}
          </span>
          <div
            style={
              mono
                ? { display: "flex", width: "100%", gap: 6 }
                : { display: "flex", width: "100%", border: `1.5px solid ${tokens.paperDark}` }
            }
          >
            {EXPENSE_CATEGORIES.map((cat, i, arr) => {
              const selected = category === cat.key;
              return (
                <button
                  key={cat.key}
                  type="button"
                  onClick={() => setValue("category", cat.key)}
                  style={
                    mono
                      ? {
                          flex: 1,
                          padding: "10px 4px",
                          background: selected ? tokens.ink : "transparent",
                          border: selected ? "none" : `1px solid ${tokens.paperDark}`,
                          borderRadius: "var(--radius-sm, 6px)",
                          cursor: "pointer",
                          textAlign: "center" as const,
                          transition: "background 0.15s",
                        }
                      : {
                          flex: 1,
                          padding: "12px 4px",
                          background: selected ? tokens.ink : "transparent",
                          borderTop: "none",
                          borderLeft: "none",
                          borderBottom: "none",
                          borderRight: i < arr.length - 1 ? `1px solid ${tokens.paperDark}` : "none",
                          cursor: "pointer",
                          textAlign: "center" as const,
                        }
                  }
                >
                  {mono ? (
                    <>
                      <cat.Icon
                        size={18}
                        strokeWidth={1.75}
                        color={selected ? tokens.paper : tokens.inkDim}
                      />
                      <div
                        style={{
                          fontFamily: "var(--font-inter, 'Inter', system-ui, sans-serif)",
                          fontSize: 9,
                          fontWeight: 500,
                          color: selected ? tokens.paper : tokens.inkDim,
                          marginTop: 4,
                        }}
                      >
                        {t(cat.labelKey as any)}
                      </div>
                    </>
                  ) : (
                    <>
                      <div style={{ fontSize: 18, marginBottom: 4 }}>{cat.icon}</div>
                      <div
                        style={{
                          fontFamily: fontMono,
                          fontSize: 8,
                          fontWeight: 700,
                          letterSpacing: 1,
                          textTransform: "uppercase" as const,
                          color: selected ? tokens.paper : tokens.inkDim,
                        }}
                      >
                        {t(cat.labelKey as any)}
                      </div>
                    </>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Amount */}
        <div
          style={
            mono
              ? {
                  margin: "12px 14px",
                  border: `1px solid ${tokens.paperDark}`,
                  borderRadius: "var(--radius-md, 10px)",
                  padding: "12px 14px",
                }
              : { margin: "12px 14px", ...dashedBox, padding: "12px 14px" }
          }
        >
          <span style={lbl}>{t("form.amount")}</span>
          <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
            <span
              style={{ fontFamily: fontSerif, fontSize: 32, fontWeight: 700, color: tokens.inkDim }}
            >
              €
            </span>
            <input
              {...register("amount")}
              type="number"
              step="0.01"
              placeholder="0,00"
              style={{
                fontFamily: fontSerif,
                fontSize: 32,
                fontWeight: 700,
                color: tokens.ink,
                background: "transparent",
                border: "none",
                outline: "none",
                flex: 1,
                padding: 0,
              }}
            />
          </div>
        </div>

        {/* Description */}
        <div style={{ padding: "0 14px" }}>
          <span style={lbl}>{mono ? t("form.description") : t("form.note")}</span>
          <div
            style={
              mono
                ? {
                    border: `1px solid ${tokens.paperDark}`,
                    borderRadius: "var(--radius-md, 10px)",
                    padding: "10px 14px",
                  }
                : { ...dashedBox, padding: "10px 14px" }
            }
          >
            <input
              {...register("description")}
              type="text"
              placeholder={t("form.note")}
              style={{
                fontFamily: fontSerif,
                fontSize: 17,
                fontWeight: 500,
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

        {/* Receipt */}
        <div style={{ padding: "12px 14px 0" }}>
          {!mono && <span style={lbl}>{t("form.receipt")}</span>}
          {mono && <span style={{ ...lbl, marginBottom: 8 }}>{t("form.receipt")}</span>}
          <Controller
            name="receipt"
            control={control}
            render={({ field }) => (
              <ReceiptUpload value={field.value ?? null} onChange={field.onChange} />
            )}
          />
        </div>

        {/* Settled outside */}
        {mono ? (
          <div
            style={{ padding: "12px 14px 4px", display: "flex", alignItems: "flex-start", gap: 10 }}
          >
            <div
              onClick={() => !readOnly && setValue("settled_outside", !settledOutside)}
              style={{
                width: 22,
                height: 22,
                borderRadius: "50%",
                border: `2px solid ${settledOutside ? tokens.ink : tokens.paperDark}`,
                background: settledOutside ? tokens.ink : "transparent",
                cursor: "pointer",
                flexShrink: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                transition: "all 0.15s",
                marginTop: 2,
              }}
            >
              {settledOutside && (
                <div
                  style={{ width: 8, height: 8, borderRadius: "50%", background: tokens.paper }}
                />
              )}
            </div>
            <div>
              <div
                style={{
                  fontFamily: "var(--font-inter, 'Inter', system-ui, sans-serif)",
                  fontSize: 15,
                  fontWeight: 600,
                  color: tokens.ink,
                }}
              >
                {t("form.settled_outside")}
              </div>
              <div
                style={{
                  fontFamily: "var(--font-inter, 'Inter', system-ui, sans-serif)",
                  fontSize: 12,
                  color: tokens.inkMute,
                  marginTop: 2,
                }}
              >
                {t("form.settled_outside_hint")}
              </div>
            </div>
          </div>
        ) : (
          <div style={{ padding: "8px 14px 4px", display: "flex", alignItems: "center", gap: 10 }}>
            <input
              type="checkbox"
              id="expense_settled_outside"
              checked={!!settledOutside}
              onChange={(e) => setValue("settled_outside", e.target.checked)}
              style={{ width: 16, height: 16, cursor: "pointer", accentColor: tokens.inkMute }}
            />
            <label
              htmlFor="expense_settled_outside"
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

        {onDelete && (
          <div style={{ padding: "8px 14px 24px" }}>
            <button
              type="button"
              onClick={onDelete}
              style={{
                width: "100%",
                padding: "10px",
                background: "transparent",
                border: `1.5px solid ${tokens.accent}`,
                color: tokens.accent,
                fontFamily: fontMono,
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: 2,
                textTransform: "uppercase",
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
