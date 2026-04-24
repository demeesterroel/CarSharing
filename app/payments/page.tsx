"use client";
import { useState } from "react";
import { toast } from "sonner";
import * as Dialog from "@radix-ui/react-dialog";
import { PageHeader } from "@/components/page-header";
import { Fab } from "@/components/fab";
import { PaymentForm } from "./payment-form";
import { usePayments, useCreatePayment, useUpdatePayment, useDeletePayment } from "@/hooks/use-payments";
import type { Payment } from "@/types";
import { paper, fontMono, fontSerif, fmtMoney } from "@/lib/paper-theme";
import { useT } from "@/components/locale-provider";

const sheetStyle: React.CSSProperties = {
  position: "fixed", left: 0, right: 0, bottom: 0, background: paper.paper,
  borderRadius: "16px 16px 0 0", zIndex: 50, maxHeight: "95vh",
  overflowY: "auto", maxWidth: 480, margin: "0 auto",
};

function groupByYear(payments: Payment[]) {
  const groups = new Map<number, Payment[]>();
  for (const p of payments) {
    if (!groups.has(p.year)) groups.set(p.year, []);
    groups.get(p.year)!.push(p);
  }
  return Array.from(groups.entries()).sort((a, b) => b[0] - a[0]);
}

export default function PaymentsPage() {
  const t = useT();
  const { data: payments = [], isLoading } = usePayments();
  const createP = useCreatePayment();
  const updateP = useUpdatePayment();
  const deleteP = useDeletePayment();
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<Payment | null>(null);

  if (isLoading) return (
    <div style={{ background: paper.paperDeep, minHeight: "100dvh" }}>
      <PageHeader title={t("page.payments")} />
      <div style={{ padding: "32px 20px", fontFamily: fontMono, fontSize: 11, color: paper.inkMute, letterSpacing: 1 }}>{t("state.loading")}</div>
    </div>
  );

  const grouped = groupByYear(payments);

  return (
    <div style={{ background: paper.paperDeep, minHeight: "100dvh", paddingBottom: 80 }}>
      <PageHeader title={t("page.payments")} />

      {grouped.length === 0 && (
        <div style={{ padding: "32px 20px", textAlign: "center", fontFamily: fontMono, fontSize: 11, color: paper.inkMute, letterSpacing: 1 }}>
          {t("state.empty_payments")}
        </div>
      )}

      {grouped.map(([year, items]) => {
        const total = items.reduce((s, p) => s + p.amount, 0);
        return (
          <div key={year}>
            <div style={{
              display: "flex", alignItems: "baseline", justifyContent: "space-between",
              padding: "10px 20px 6px",
              borderTop: `1.5px dashed ${paper.ink}`,
              background: paper.paperDeep,
            }}>
              <span style={{ fontFamily: fontSerif, fontSize: 16, fontWeight: 600, color: paper.ink }}>{year}</span>
              <span style={{ fontFamily: fontMono, fontSize: 11, color: paper.inkDim, fontWeight: 600 }}>
                {`€\u00a0${total.toLocaleString("nl-BE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
              </span>
            </div>
            <div style={{ padding: "8px 16px" }}>
              {items.map((b) => (
                <button
                  key={b.id}
                  onClick={() => setEditing(b)}
                  style={{
                    width: "100%", display: "flex", alignItems: "center", gap: 12,
                    padding: "12px 14px", marginBottom: 8,
                    background: paper.paper, border: "none", cursor: "pointer", textAlign: "left",
                    borderLeft: `3px solid ${paper.green}`,
                    boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: fontSerif, fontSize: 15, fontWeight: 600, color: paper.ink, lineHeight: 1.2 }}>
                      {b.person_name}
                    </div>
                    <div style={{ fontFamily: fontMono, fontSize: 10, color: paper.inkDim, letterSpacing: 1, marginTop: 2 }}>
                      {b.date}{b.note ? ` · ${b.note}` : ""}
                    </div>
                  </div>
                  <div style={{ fontFamily: fontMono, fontSize: 14, fontWeight: 700, color: paper.green, flexShrink: 0 }}>
                    {fmtMoney(b.amount)}
                  </div>
                </button>
              ))}
            </div>
          </div>
        );
      })}

      <Dialog.Root open={adding} onOpenChange={setAdding}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/40 z-40" />
          <Dialog.Content style={sheetStyle}>
            <Dialog.Title style={{ padding: "16px 20px 0", fontFamily: fontSerif, fontSize: 20, fontWeight: 700 }}>
              {t("page.payment_add")}
            </Dialog.Title>
            <PaymentForm
              onSubmit={(data) => createP.mutate(data, {
                onSuccess: () => { setAdding(false); toast.success(t("toast.payment_saved")); },
                onError: (e) => toast.error(e.message),
              })}
              onCancel={() => setAdding(false)}
            />
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      <Dialog.Root open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/40 z-40" />
          <Dialog.Content style={sheetStyle}>
            <Dialog.Title style={{ padding: "16px 20px 0", fontFamily: fontSerif, fontSize: 20, fontWeight: 700 }}>
              {t("page.payment_edit")}
            </Dialog.Title>
            {editing && (
              <>
                <PaymentForm
                  defaultValues={editing}
                  onSubmit={(data) => updateP.mutate({ id: editing.id, ...data }, {
                    onSuccess: () => { setEditing(null); toast.success(t("toast.saved")); },
                    onError: (e) => toast.error(e.message),
                  })}
                  onCancel={() => setEditing(null)}
                />
                <div style={{ padding: "0 16px 24px" }}>
                  <button
                    onClick={() => deleteP.mutate(editing.id, {
                      onSuccess: () => { setEditing(null); toast.success(t("toast.deleted")); },
                      onError: (e) => toast.error(e.message),
                    })}
                    style={{
                      width: "100%", padding: "10px", background: "transparent",
                      border: `1.5px solid ${paper.accent}`, color: paper.accent,
                      fontFamily: fontMono, fontSize: 10, fontWeight: 700, letterSpacing: 2,
                      textTransform: "uppercase", cursor: "pointer",
                    }}
                  >
                    {t("action.delete")}
                  </button>
                </div>
              </>
            )}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      <Fab onClick={() => setAdding(true)} label={t("page.payment_add")} />
    </div>
  );
}
