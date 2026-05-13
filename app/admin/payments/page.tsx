"use client";
import { useState } from "react";
import { paper, fontMono, fontSerif, fmtMoney, fmtDate } from "@/lib/paper-theme";
import { useT } from "@/components/locale-provider";
import {
  usePayments,
  useCreatePayment,
  useUpdatePayment,
  useDeletePayment,
} from "@/hooks/use-payments";
import { usePeople } from "@/hooks/use-people";
import { Card, Perf } from "../_shared";
import type { Payment } from "@/types";
import { fullNameOf } from "@/lib/person-utils";

// ── Form ──────────────────────────────────────────────────────

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

interface FormProps {
  initial: FormState;
  onSave: (f: FormState) => void;
  onCancel: () => void;
  saving: boolean;
}

function PaymentForm({ initial, onSave, onCancel, saving }: FormProps) {
  const t = useT();
  const { data: people = [] } = usePeople();
  const [f, setF] = useState<FormState>(initial);
  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setF((p) => ({ ...p, [k]: v }));

  const valid = f.person_id !== "" && f.date.length >= 10 && Number(f.amount) !== 0;

  return (
    <div style={{ padding: "12px 0" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <div>
          <label
            style={{
              display: "block",
              fontFamily: fontMono,
              fontSize: 9,
              color: paper.inkMute,
              letterSpacing: 1,
              marginBottom: 4,
            }}
          >
            {t("form.person")}
          </label>
          <select
            value={f.person_id}
            onChange={(e) => set("person_id", e.target.value === "" ? "" : Number(e.target.value))}
            style={{
              width: "100%",
              padding: "8px 10px",
              fontFamily: fontMono,
              fontSize: 12,
              background: paper.paperDark,
              color: paper.ink,
              border: `1.5px solid ${paper.paperDark}`,
              outline: "none",
            }}
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

        <div style={{ display: "flex", gap: 8 }}>
          <div style={{ flex: 1 }}>
            <label
              style={{
                display: "block",
                fontFamily: fontMono,
                fontSize: 9,
                color: paper.inkMute,
                letterSpacing: 1,
                marginBottom: 4,
              }}
            >
              {t("form.date")}
            </label>
            <input
              type="date"
              value={f.date}
              onChange={(e) => set("date", e.target.value)}
              style={{
                width: "100%",
                padding: "8px 10px",
                fontFamily: fontMono,
                fontSize: 12,
                background: paper.paperDark,
                color: paper.ink,
                border: `1.5px solid ${paper.paperDark}`,
                outline: "none",
                boxSizing: "border-box",
              }}
            />
          </div>
          <div style={{ flex: 1 }}>
            <label
              style={{
                display: "block",
                fontFamily: fontMono,
                fontSize: 9,
                color: paper.inkMute,
                letterSpacing: 1,
                marginBottom: 4,
              }}
            >
              {t("form.amount")} (€)
            </label>
            <input
              type="number"
              step="0.01"
              value={f.amount}
              onChange={(e) => set("amount", e.target.value)}
              style={{
                width: "100%",
                padding: "8px 10px",
                fontFamily: fontMono,
                fontSize: 12,
                background: paper.paperDark,
                color: paper.ink,
                border: `1.5px solid ${paper.paperDark}`,
                outline: "none",
                boxSizing: "border-box",
              }}
            />
          </div>
        </div>

        <div>
          <label
            style={{
              display: "block",
              fontFamily: fontMono,
              fontSize: 9,
              color: paper.inkMute,
              letterSpacing: 1,
              marginBottom: 4,
            }}
          >
            {t("form.note")} ({t("form.optional")})
          </label>
          <input
            type="text"
            value={f.note}
            onChange={(e) => set("note", e.target.value)}
            style={{
              width: "100%",
              padding: "8px 10px",
              fontFamily: fontMono,
              fontSize: 12,
              background: paper.paperDark,
              color: paper.ink,
              border: `1.5px solid ${paper.paperDark}`,
              outline: "none",
              boxSizing: "border-box",
            }}
          />
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={onCancel}
            style={{
              flex: 1,
              padding: "8px",
              fontFamily: fontMono,
              fontSize: 9,
              fontWeight: 700,
              letterSpacing: 2,
              textTransform: "uppercase",
              background: "transparent",
              color: paper.inkMute,
              border: `1.5px solid ${paper.paperDark}`,
              cursor: "pointer",
            }}
          >
            {t("action.cancel")}
          </button>
          <button
            onClick={() => valid && onSave(f)}
            disabled={!valid || saving}
            style={{
              flex: 2,
              padding: "8px",
              fontFamily: fontMono,
              fontSize: 9,
              fontWeight: 700,
              letterSpacing: 2,
              textTransform: "uppercase",
              background: valid ? paper.ink : paper.paperDark,
              color: valid ? paper.paper : paper.inkMute,
              border: "none",
              cursor: valid && !saving ? "pointer" : "default",
            }}
          >
            {saving ? t("action.saving") : t("action.save")}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────

export default function AdminPaymentsPage() {
  const t = useT();
  const { data: payments = [], isLoading } = usePayments();
  const { data: people = [] } = usePeople();
  const create = useCreatePayment();
  const update = useUpdatePayment();
  const remove = useDeletePayment();

  const [personFilter, setPersonFilter] = useState<number | "">("");
  const [yearFilter, setYearFilter] = useState<number | "">("");
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<Payment | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);

  // Derive available years from data
  const years = [...new Set(payments.map((p) => p.year))].sort((a, b) => b - a);

  const filtered = payments.filter((p) => {
    if (personFilter !== "" && p.person_id !== personFilter) return false;
    if (yearFilter !== "" && p.year !== yearFilter) return false;
    return true;
  });

  // Group by year descending
  const grouped = new Map<number, Payment[]>();
  for (const p of filtered) {
    if (!grouped.has(p.year)) grouped.set(p.year, []);
    grouped.get(p.year)!.push(p);
  }
  const sortedYears = [...grouped.keys()].sort((a, b) => b - a);

  const handleCreate = (f: FormState) => {
    create.mutate(
      {
        person_id: Number(f.person_id),
        date: f.date,
        amount: Number(f.amount),
        note: f.note || null,
      },
      { onSuccess: () => setAdding(false) }
    );
  };

  const handleUpdate = (f: FormState) => {
    if (!editing) return;
    update.mutate(
      {
        id: editing.id,
        person_id: Number(f.person_id),
        date: f.date,
        amount: Number(f.amount),
        note: f.note || null,
      },
      { onSuccess: () => setEditing(null) }
    );
  };

  const handleDelete = (id: number) => {
    remove.mutate(id, { onSuccess: () => setConfirmDelete(null) });
  };

  return (
    <div style={{ padding: 16 }}>
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
            background: paper.paper,
            color: paper.ink,
            border: `1.5px solid ${paper.paperDark}`,
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
            background: paper.paper,
            color: paper.ink,
            border: `1.5px solid ${paper.paperDark}`,
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
        <button
          onClick={() => {
            setAdding(true);
            setEditing(null);
          }}
          style={{
            padding: "7px 14px",
            fontFamily: fontMono,
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: 1,
            textTransform: "uppercase",
            background: paper.ink,
            color: paper.paper,
            border: "none",
            cursor: "pointer",
          }}
        >
          + {t("action.add")}
        </button>
      </div>

      {/* Add form */}
      {adding && (
        <Card>
          <div
            style={{
              fontFamily: fontSerif,
              fontSize: 13,
              fontWeight: 700,
              color: paper.ink,
              marginBottom: 4,
            }}
          >
            {t("page.payment_add")}
          </div>
          <Perf margin="0 0 8px" />
          <PaymentForm
            initial={emptyForm()}
            onSave={handleCreate}
            onCancel={() => setAdding(false)}
            saving={create.isPending}
          />
        </Card>
      )}

      {isLoading && (
        <div
          style={{
            fontFamily: fontMono,
            fontSize: 10,
            color: paper.inkDim,
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
            {/* Year header */}
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
                  color: paper.inkDim,
                  letterSpacing: 2,
                  textTransform: "uppercase",
                }}
              >
                {t("settlement.year")} {year}
              </div>
              <div style={{ fontFamily: fontMono, fontSize: 10, color: paper.inkDim }}>
                {fmtMoney(total)}
              </div>
            </div>

            <Card>
              {rows.map((p, i) => (
                <div key={p.id}>
                  {i > 0 && <Perf margin="0" />}

                  {editing?.id === p.id ? (
                    <PaymentForm
                      initial={fromPayment(p)}
                      onSave={handleUpdate}
                      onCancel={() => setEditing(null)}
                      saving={update.isPending}
                    />
                  ) : confirmDelete === p.id ? (
                    <div
                      style={{ padding: "10px 0", display: "flex", alignItems: "center", gap: 8 }}
                    >
                      <div
                        style={{ flex: 1, fontFamily: fontMono, fontSize: 10, color: paper.accent }}
                      >
                        {t("action.delete")} {p.person_name} {fmtMoney(p.amount)}?
                      </div>
                      <button
                        onClick={() => setConfirmDelete(null)}
                        style={{
                          padding: "4px 10px",
                          fontFamily: fontMono,
                          fontSize: 9,
                          background: "transparent",
                          color: paper.inkMute,
                          border: `1.5px solid ${paper.paperDark}`,
                          cursor: "pointer",
                        }}
                      >
                        {t("action.cancel")}
                      </button>
                      <button
                        onClick={() => handleDelete(p.id)}
                        disabled={remove.isPending}
                        style={{
                          padding: "4px 10px",
                          fontFamily: fontMono,
                          fontSize: 9,
                          fontWeight: 700,
                          background: paper.accent,
                          color: paper.paper,
                          border: "none",
                          cursor: "pointer",
                        }}
                      >
                        {t("action.delete")}
                      </button>
                    </div>
                  ) : (
                    <div
                      style={{ display: "flex", alignItems: "baseline", gap: 8, padding: "10px 0" }}
                    >
                      <div
                        style={{
                          fontFamily: fontMono,
                          fontSize: 9,
                          color: paper.inkDim,
                          whiteSpace: "nowrap",
                        }}
                      >
                        {fmtDate(p.date)}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div
                          style={{
                            fontFamily: fontSerif,
                            fontSize: 13,
                            fontWeight: 700,
                            color: paper.ink,
                          }}
                        >
                          {p.person_name}
                        </div>
                        {p.note && (
                          <div
                            style={{
                              fontFamily: fontMono,
                              fontSize: 9,
                              color: paper.inkDim,
                              marginTop: 2,
                            }}
                          >
                            {p.note}
                          </div>
                        )}
                      </div>
                      <div
                        style={{
                          fontFamily: fontMono,
                          fontSize: 12,
                          color: paper.green,
                          whiteSpace: "nowrap",
                        }}
                      >
                        {fmtMoney(p.amount)}
                      </div>
                      <button
                        onClick={() => {
                          setEditing(p);
                          setAdding(false);
                        }}
                        style={{
                          padding: "3px 8px",
                          fontFamily: fontMono,
                          fontSize: 9,
                          background: "transparent",
                          color: paper.inkMute,
                          border: `1.5px solid ${paper.paperDark}`,
                          cursor: "pointer",
                        }}
                      >
                        ✎
                      </button>
                      <button
                        onClick={() => setConfirmDelete(p.id)}
                        style={{
                          padding: "3px 8px",
                          fontFamily: fontMono,
                          fontSize: 9,
                          background: "transparent",
                          color: paper.accent,
                          border: `1.5px solid ${paper.paperDark}`,
                          cursor: "pointer",
                        }}
                      >
                        ✕
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </Card>
          </div>
        );
      })}

      {!isLoading && filtered.length === 0 && (
        <div
          style={{
            fontFamily: fontMono,
            fontSize: 10,
            color: paper.inkDim,
            padding: "32px 0",
            textAlign: "center",
          }}
        >
          {t("admin.inbox_empty")}
        </div>
      )}
    </div>
  );
}
