"use client";
import { useState } from "react";
import { toast } from "sonner";
import * as Dialog from "@radix-ui/react-dialog";
import { PageHeader } from "@/components/page-header";
import { GroupedList } from "@/components/grouped-list";
import { Fab } from "@/components/fab";
import { ExpenseForm } from "./expense-form";
import { useExpenses, useCreateExpense, useUpdateExpense, useDeleteExpense } from "@/hooks/use-expenses";
import type { Expense } from "@/types";
import { paper, fontMono, fontSerif, fmtMoney, fmtYearMonth } from "@/lib/paper-theme";
import { useT } from "@/components/locale-provider";

const sheetStyle: React.CSSProperties = {
  position: "fixed", left: 0, right: 0, bottom: 0, background: paper.paper,
  borderRadius: "16px 16px 0 0", zIndex: 50, maxHeight: "95vh",
  overflowY: "auto", maxWidth: 480, margin: "0 auto",
};

export default function ExpensesPage() {
  const t = useT();
  const { data: expenses = [], isLoading } = useExpenses();
  const createE = useCreateExpense();
  const updateE = useUpdateExpense();
  const deleteE = useDeleteExpense();
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<Expense | null>(null);

  if (isLoading) return (
    <div style={{ background: paper.paperDeep, minHeight: "100dvh" }}>
      <PageHeader title={t("page.expenses")} />
      <div style={{ padding: "32px 20px", fontFamily: fontMono, fontSize: 11, color: paper.inkMute, letterSpacing: 1 }}>{t("state.loading")}</div>
    </div>
  );

  return (
    <div style={{ background: paper.paperDeep, minHeight: "100dvh", paddingBottom: 80 }}>
      <PageHeader title={t("page.expenses")} />

      <GroupedList
        items={expenses}
        getKey={(e) => e.date.slice(0, 7)}
        getGroupLabel={(key) => fmtYearMonth(key + "-01")}
        getGroupTotal={(items) => items.reduce((s, e) => s + e.amount, 0)}
        renderItem={(e) => (
          <button
            key={e.id}
            onClick={() => setEditing(e)}
            style={{
              width: "100%", display: "flex", alignItems: "center", gap: 12,
              padding: "12px 14px", marginBottom: 8,
              background: paper.paper, border: "none", cursor: "pointer", textAlign: "left",
              borderLeft: `3px solid ${paper.amber}`,
              boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
            }}
          >
            <div style={{
              padding: "6px 8px", background: paper.ink, color: paper.paper,
              fontFamily: fontMono, fontSize: 11, fontWeight: 700, letterSpacing: 2, flexShrink: 0, minWidth: 42, textAlign: "center",
            }}>
              {e.car_short}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: fontSerif, fontSize: 15, fontWeight: 600, color: paper.ink, lineHeight: 1.2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {e.description}
              </div>
              <div style={{ fontFamily: fontMono, fontSize: 10, color: paper.inkDim, letterSpacing: 1, marginTop: 2 }}>
                {e.person_name} · {e.date}
              </div>
            </div>
            <div style={{ textAlign: "right", flexShrink: 0 }}>
              <div style={{ fontFamily: fontMono, fontSize: 14, fontWeight: 700, color: paper.amber }}>{fmtMoney(e.amount)}</div>
            </div>
          </button>
        )}
      />

      {expenses.length === 0 && (
        <div style={{ padding: "32px 20px", textAlign: "center", fontFamily: fontMono, fontSize: 11, color: paper.inkMute, letterSpacing: 1 }}>
          {t("state.empty_expenses")}
        </div>
      )}

      <Dialog.Root open={adding} onOpenChange={setAdding}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/40 z-40" />
          <Dialog.Content style={sheetStyle}>
            <Dialog.Title style={{ padding: "16px 20px 0", fontFamily: fontSerif, fontSize: 20, fontWeight: 700 }}>
              {t("page.expense_add")}
            </Dialog.Title>
            <ExpenseForm
              onSubmit={(data) => createE.mutate(data, {
                onSuccess: () => { setAdding(false); toast.success(t("toast.saved")); },
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
              {t("page.expense_edit")}
            </Dialog.Title>
            {editing && (
              <>
                <ExpenseForm
                  defaultValues={editing}
                  onSubmit={(data) => updateE.mutate({ id: editing.id, ...data }, {
                    onSuccess: () => { setEditing(null); toast.success(t("toast.saved")); },
                    onError: (e) => toast.error(e.message),
                  })}
                  onCancel={() => setEditing(null)}
                />
                <div style={{ padding: "0 16px 24px" }}>
                  <button
                    onClick={() => deleteE.mutate(editing.id, {
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

      <Fab onClick={() => setAdding(true)} label={t("page.expense_add")} />
    </div>
  );
}
