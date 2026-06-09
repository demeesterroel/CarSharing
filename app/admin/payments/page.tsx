"use client";
import { Fab } from "@/components/fab";
import { useT } from "@/components/locale-provider";
import {
  useCreatePayment,
  useDeletePayment,
  usePayments,
  useUpdatePayment,
} from "@/hooks/use-payments";
import { usePeople } from "@/hooks/use-people";
import { fullNameOf } from "@/lib/person-utils";
import {
  amtColor,
  fmtDate,
  fmtMoney,
  fontMono,
  fontSerif,
  signPrefix,
  tokens,
} from "@/lib/theme-tokens";
import type { Payment } from "@/types";
import * as Dialog from "@radix-ui/react-dialog";
import { useState } from "react";

// ── Sheet styles ──────────────────────────────────────────────
const overlayStyle: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,0.45)",
  zIndex: 49,
};
const sheetStyle: React.CSSProperties = {
  position: "fixed",
  bottom: 0,
  left: "50%",
  transform: "translateX(-50%)",
  width: "min(100%, 480px)",
  maxHeight: "92dvh",
  borderRadius: "14px 14px 0 0",
  background: tokens.paperDeep,
  zIndex: 50,
  overflowY: "auto",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "6px 8px",
  fontFamily: fontMono,
  fontSize: 11,
  border: `1px solid ${tokens.paperDark}`,
  background: tokens.paperDeep,
  color: tokens.ink,
  outline: "none",
  boxSizing: "border-box",
};
const labelStyle: React.CSSProperties = {
  fontFamily: fontMono,
  fontSize: 9,
  color: tokens.inkDim,
  letterSpacing: 1.5,
  textTransform: "uppercase",
  display: "block",
  marginBottom: 3,
};

// ── Form state ────────────────────────────────────────────────
interface FormState {
  person_id: number | "";
  date: string;
  amount: string;
  note: string;
}

const emptyForm = (): FormState => ({
  person_id: "",
  date: new Date().toISOString().slice(0, 10),
  amount: "",
  note: "",
});

function fromPayment(p: Payment): FormState {
  return {
    person_id: p.person_id,
    date: p.date,
    amount: String(p.amount),
    note: p.note ?? "",
  };
}

// ── Add payment sheet ─────────────────────────────────────────
function AddPaymentSheet({ onClose }: { onClose: () => void }) {
  const t = useT();
  const { data: people = [] } = usePeople();
  const create = useCreatePayment();
  const [f, setF] = useState<FormState>(emptyForm());
  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setF((p) => ({ ...p, [k]: v }));

  const valid = f.person_id !== "" && f.date.length >= 10 && Number(f.amount) !== 0;

  function handleSave() {
    if (!valid || create.isPending) return;
    create.mutate(
      {
        person_id: Number(f.person_id),
        date: f.date,
        amount: Number(f.amount),
        note: f.note || null,
      },
      { onSuccess: onClose }
    );
  }

  return (
    <div style={{ background: tokens.paperDeep }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 16px",
          height: 52,
          borderBottom: `1.5px solid ${tokens.paperDark}`,
          background: tokens.paper,
          position: "sticky",
          top: 0,
          zIndex: 10,
          borderRadius: "14px 14px 0 0",
        }}
      >
        <button
          type="button"
          onClick={onClose}
          style={{
            fontFamily: fontMono,
            fontSize: 18,
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
          style={{
            fontFamily: fontMono,
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: 3,
            color: tokens.inkDim,
            textTransform: "uppercase",
          }}
        >
          {t("page.payment_add")}
        </div>
        <button
          type="button"
          disabled={!valid || create.isPending}
          onClick={handleSave}
          style={{
            fontFamily: fontMono,
            fontSize: 9,
            fontWeight: 700,
            letterSpacing: 2,
            textTransform: "uppercase",
            background: valid && !create.isPending ? tokens.ink : tokens.paperDark,
            color: valid && !create.isPending ? tokens.paper : tokens.inkMute,
            border: "none",
            padding: "8px 14px",
            cursor: valid && !create.isPending ? "pointer" : "default",
          }}
        >
          {create.isPending ? "…" : t("action.add")}
        </button>
      </div>

      <div style={{ padding: 16 }}>
        <div style={{ marginBottom: 8 }}>
          <label style={labelStyle}>{t("form.person")}</label>
          <select
            value={f.person_id}
            onChange={(e) => set("person_id", e.target.value === "" ? "" : Number(e.target.value))}
            style={inputStyle}
          >
            <option value="">— {t("form.person")} —</option>
            {people
              .filter((p) => p.active)
              .map((p) => (
                <option key={p.id} value={p.id}>
                  {fullNameOf(p)}
                </option>
              ))}
          </select>
        </div>

        <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>{t("form.date")}</label>
            <input
              type="date"
              value={f.date}
              onChange={(e) => set("date", e.target.value)}
              style={inputStyle}
            />
          </div>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>{t("form.amount")} (€)</label>
            <input
              type="number"
              step="0.01"
              value={f.amount}
              onChange={(e) => set("amount", e.target.value)}
              style={inputStyle}
            />
          </div>
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={labelStyle}>
            {t("form.note")} ({t("form.optional")})
          </label>
          <input
            type="text"
            value={f.note}
            onChange={(e) => set("note", e.target.value)}
            style={inputStyle}
          />
        </div>
      </div>
    </div>
  );
}

// ── Payment accordion card ────────────────────────────────────
function PaymentAccordion({
  payment,
  expanded,
  onToggle,
}: {
  payment: Payment;
  expanded: boolean;
  onToggle: () => void;
}) {
  const t = useT();
  const { data: people = [] } = usePeople();
  const update = useUpdatePayment();
  const remove = useDeletePayment();

  const [f, setF] = useState<FormState>(() => fromPayment(payment));
  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setF((p) => ({ ...p, [k]: v }));
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  // Reset form when payment changes externally
  const [prevId, setPrevId] = useState(payment.id);
  if (payment.id !== prevId) {
    setPrevId(payment.id);
    setF(fromPayment(payment));
    setDeleteConfirm(false);
  }

  const dirty =
    Number(f.person_id) !== payment.person_id ||
    f.date !== payment.date ||
    Number(f.amount) !== payment.amount ||
    (f.note || null) !== (payment.note ?? null);

  function handleSave() {
    update.mutate(
      {
        id: payment.id,
        person_id: Number(f.person_id),
        date: f.date,
        amount: Number(f.amount),
        note: f.note || null,
      },
      { onSuccess: onToggle }
    );
  }

  function handleDelete() {
    if (!deleteConfirm) {
      setDeleteConfirm(true);
      return;
    }
    remove.mutate(payment.id, { onSuccess: () => setDeleteConfirm(false) });
  }

  function handleCancel() {
    setF(fromPayment(payment));
    setDeleteConfirm(false);
    onToggle();
  }

  const barColor = amtColor(payment.amount);

  return (
    <div
      style={{
        background: tokens.paper,
        marginBottom: 6,
        boxShadow: "0 1px 2px rgba(0,0,0,0.05), 0 4px 16px rgba(0,0,0,0.06)",
        borderLeft: `3px solid ${barColor}`,
      }}
    >
      {/* Collapsed header — click to toggle */}
      <div
        role="button"
        tabIndex={0}
        onClick={onToggle}
        onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onToggle()}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "12px 14px",
          cursor: "pointer",
          userSelect: "none",
        }}
      >
        <div
          style={{
            fontFamily: fontMono,
            fontSize: 9,
            color: tokens.inkDim,
            whiteSpace: "nowrap",
            flexShrink: 0,
          }}
        >
          {fmtDate(payment.date)}
        </div>
        <div style={{ flex: 1, overflow: "hidden" }}>
          <div
            style={{
              fontFamily: fontSerif,
              fontSize: 14,
              fontWeight: 600,
              color: tokens.ink,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {payment.person_name}
          </div>
          {payment.note && (
            <div
              style={{
                fontFamily: fontMono,
                fontSize: 9,
                color: tokens.inkDim,
                marginTop: 1,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {payment.note}
            </div>
          )}
        </div>
        <div
          style={{
            fontFamily: fontMono,
            fontSize: 12,
            fontWeight: 700,
            color: barColor,
            whiteSpace: "nowrap",
            flexShrink: 0,
          }}
        >
          {signPrefix(payment.amount)}
          {fmtMoney(payment.amount)}
        </div>
      </div>

      {/* Expanded edit form */}
      {expanded && (
        <div style={{ padding: "0 14px 14px", borderTop: `1px solid ${tokens.paperDark}` }}>
          <div style={{ paddingTop: 12, marginBottom: 8 }}>
            <label style={labelStyle}>{t("form.person")}</label>
            <select
              value={f.person_id}
              onChange={(e) =>
                set("person_id", e.target.value === "" ? "" : Number(e.target.value))
              }
              style={inputStyle}
            >
              <option value="">— {t("form.person")} —</option>
              {people
                .filter((p) => p.active)
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {fullNameOf(p)}
                  </option>
                ))}
            </select>
          </div>

          <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>{t("form.date")}</label>
              <input
                type="date"
                value={f.date}
                onChange={(e) => set("date", e.target.value)}
                style={inputStyle}
              />
            </div>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>{t("form.amount")} (€)</label>
              <input
                type="number"
                step="0.01"
                value={f.amount}
                onChange={(e) => set("amount", e.target.value)}
                style={inputStyle}
              />
            </div>
          </div>

          <div style={{ marginBottom: 12 }}>
            <label style={labelStyle}>
              {t("form.note")} ({t("form.optional")})
            </label>
            <input
              type="text"
              value={f.note}
              onChange={(e) => set("note", e.target.value)}
              style={inputStyle}
            />
          </div>

          <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
            <button
              onClick={handleCancel}
              style={{
                flex: 1,
                padding: "9px",
                background: "transparent",
                color: tokens.inkDim,
                border: `1px solid ${tokens.paperDark}`,
                cursor: "pointer",
                fontFamily: fontMono,
                fontSize: 9,
                fontWeight: 700,
                letterSpacing: 1.5,
                textTransform: "uppercase",
              }}
            >
              {t("action.cancel")}
            </button>
            <button
              disabled={!dirty || update.isPending}
              onClick={handleSave}
              style={{
                flex: 2,
                padding: "9px",
                background: dirty && !update.isPending ? tokens.ink : tokens.paperDark,
                color: dirty && !update.isPending ? tokens.paper : tokens.inkMute,
                border: "none",
                cursor: dirty && !update.isPending ? "pointer" : "default",
                fontFamily: fontMono,
                fontSize: 9,
                fontWeight: 700,
                letterSpacing: 2,
                textTransform: "uppercase",
              }}
            >
              {update.isPending ? "…" : t("action.save")}
            </button>
          </div>

          <button
            onClick={handleDelete}
            disabled={remove.isPending}
            style={{
              width: "100%",
              padding: "9px",
              background: deleteConfirm ? tokens.accent : "transparent",
              color: deleteConfirm ? tokens.paper : tokens.accent,
              border: `1px solid ${tokens.accent}`,
              cursor: "pointer",
              fontFamily: fontMono,
              fontSize: 9,
              fontWeight: 700,
              letterSpacing: 1.5,
              textTransform: "uppercase",
            }}
          >
            {remove.isPending
              ? "…"
              : deleteConfirm
                ? t("owner.delete_confirm")
                : t("action.delete")}
          </button>
          {deleteConfirm && (
            <button
              onClick={() => setDeleteConfirm(false)}
              style={{
                width: "100%",
                marginTop: 4,
                padding: "6px",
                background: "transparent",
                color: tokens.inkDim,
                border: `1px solid ${tokens.paperDark}`,
                cursor: "pointer",
                fontFamily: fontMono,
                fontSize: 8,
                letterSpacing: 1,
              }}
            >
              {t("action.cancel")}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────
export default function AdminPaymentsPage() {
  const t = useT();
  const { data: payments = [], isLoading } = usePayments();
  const { data: people = [] } = usePeople();

  const [personFilter, setPersonFilter] = useState<number | "">("");
  const [yearFilter, setYearFilter] = useState<number | "">("");
  const [adding, setAdding] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const years = [...new Set(payments.map((p) => p.year))].sort((a, b) => b - a);

  const filtered = payments.filter((p) => {
    if (personFilter !== "" && p.person_id !== personFilter) return false;
    if (yearFilter !== "" && p.year !== yearFilter) return false;
    return true;
  });

  const grouped = new Map<number, Payment[]>();
  for (const p of filtered) {
    if (!grouped.has(p.year)) grouped.set(p.year, []);
    grouped.get(p.year)!.push(p);
  }
  const sortedYears = [...grouped.keys()].sort((a, b) => b - a);

  return (
    <div style={{ padding: 16 }}>
      <Fab onClick={() => setAdding(true)} label={t("page.payment_add")} />

      {/* Filters */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <select
          aria-label={t("filter.all_persons")}
          value={personFilter}
          onChange={(e) => setPersonFilter(e.target.value === "" ? "" : Number(e.target.value))}
          style={{
            flex: 1,
            padding: "7px 10px",
            fontFamily: fontMono,
            fontSize: 10,
            background: tokens.paper,
            color: tokens.ink,
            border: `1.5px solid ${tokens.paperDark}`,
            outline: "none",
          }}
        >
          <option value="">{t("filter.all_persons")}</option>
          {people.map((p) => (
            <option key={p.id} value={p.id}>
              {fullNameOf(p)}
            </option>
          ))}
        </select>
        <select
          aria-label={t("filter.all_years")}
          value={yearFilter}
          onChange={(e) => setYearFilter(e.target.value === "" ? "" : Number(e.target.value))}
          style={{
            flex: 1,
            padding: "7px 10px",
            fontFamily: fontMono,
            fontSize: 10,
            background: tokens.paper,
            color: tokens.ink,
            border: `1.5px solid ${tokens.paperDark}`,
            outline: "none",
          }}
        >
          <option value="">{t("filter.all_years")}</option>
          {years.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
      </div>

      {isLoading && (
        <div
          style={{
            fontFamily: fontMono,
            fontSize: 10,
            color: tokens.inkDim,
            padding: "24px 0",
            textAlign: "center",
          }}
        >
          …
        </div>
      )}

      {/* Grouped by year */}
      {sortedYears.map((year) => {
        const rows = grouped.get(year)!;
        const total = rows.reduce((s, p) => s + p.amount, 0);
        return (
          <div key={year} style={{ marginBottom: 24 }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "baseline",
                marginBottom: 8,
              }}
            >
              <div
                style={{
                  fontFamily: fontMono,
                  fontSize: 9,
                  color: tokens.inkDim,
                  letterSpacing: 2,
                  textTransform: "uppercase",
                }}
              >
                {t("settlement.year")} {year}
              </div>
              <div style={{ fontFamily: fontMono, fontSize: 10, color: tokens.inkDim }}>
                {fmtMoney(total)}
              </div>
            </div>

            {rows.map((p) => (
              <PaymentAccordion
                key={p.id}
                payment={p}
                expanded={expandedId === p.id}
                onToggle={() => setExpandedId(expandedId === p.id ? null : p.id)}
              />
            ))}
          </div>
        );
      })}

      {!isLoading && filtered.length === 0 && (
        <div
          style={{
            fontFamily: fontMono,
            fontSize: 10,
            color: tokens.inkDim,
            padding: "32px 0",
            textAlign: "center",
          }}
        >
          {t("admin.inbox_empty")}
        </div>
      )}

      {/* Add payment sheet */}
      <Dialog.Root open={adding} onOpenChange={(open) => !open && setAdding(false)}>
        <Dialog.Portal>
          <Dialog.Overlay style={overlayStyle} />
          <Dialog.Content style={sheetStyle} aria-describedby={undefined}>
            <Dialog.Title
              style={{
                position: "absolute",
                width: 1,
                height: 1,
                overflow: "hidden",
                clip: "rect(0,0,0,0)",
              }}
            >
              {t("page.payment_add")}
            </Dialog.Title>
            <AddPaymentSheet onClose={() => setAdding(false)} />
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}
