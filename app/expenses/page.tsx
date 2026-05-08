"use client";
import { Suspense } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { toast } from "sonner";
import * as Dialog from "@radix-ui/react-dialog";
import { PageHeader } from "@/components/page-header";
import { GroupedList } from "@/components/grouped-list";
import { Fab } from "@/components/fab";
import { ExpenseForm } from "./expense-form";
import {
  useExpenses,
  useCreateExpense,
  useUpdateExpense,
  useDeleteExpense,
} from "@/hooks/use-expenses";
import { useMe } from "@/hooks/use-me";
import { useQueryParam } from "@/hooks/use-query-param";
import { YearSelect } from "@/components/year-select";
import type { Expense } from "@/types";
import { paper, fontMono, fmtYearMonth } from "@/lib/paper-theme";
import { useT } from "@/components/locale-provider";
import { ExpenseCard } from "@/components/expense-card";
import { ErrorBoundary } from "@/components/error-boundary";

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
  background: paper.paperDeep,
  zIndex: 50,
  overflowY: "auto",
};

function ExpensesContent() {
  const t = useT();
  const { data: expenses = [], isLoading } = useExpenses();
  const { data: me } = useMe();
  const createE = useCreateExpense();
  const updateE = useUpdateExpense();
  const deleteE = useDeleteExpense();

  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const [mineParam, setMineParam] = useQueryParam("mine", "");
  const [carFilter, setCarFilter] = useQueryParam("car", "");
  const [yearFilter, setYearFilter] = useQueryParam("year", "");

  const actionParam = searchParams.get("action");
  const editIdParam = searchParams.get("edit");

  const adding = actionParam === "add";
  const editingId = editIdParam ? Number(editIdParam) : null;
  const editing =
    !isLoading && editingId ? (expenses.find((e) => e.id === editingId) ?? null) : null;

  const isMine = mineParam === "true";
  const isOthers = mineParam === "false";
  const canFilter = me?.personId != null;
  const cars = Array.from(
    new Set(expenses.map((e) => e.car_short).filter((s): s is string => !!s))
  ).sort();
  const years = Array.from(new Set(expenses.map((e) => e.date.slice(0, 4))))
    .sort()
    .reverse();

  const visible = expenses
    .filter((e) => {
      if (isMine && canFilter) return e.person_id === me!.personId;
      if (isOthers && canFilter) return e.person_id !== me!.personId;
      return true;
    })
    .filter((e) => (carFilter ? e.car_short === carFilter : true))
    .filter((e) => (yearFilter ? e.date.startsWith(yearFilter) : true));

  const openAdd = () => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("action", "add");
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  };

  const openEdit = (expense: Expense) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("edit", String(expense.id));
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  };

  const closeModal = () => router.back();

  const filterBtnStyle = (active: boolean): React.CSSProperties => ({
    padding: "5px 12px",
    background: active ? paper.ink : "transparent",
    color: active ? paper.paper : paper.inkDim,
    border: `1.5px solid ${paper.ink}`,
    fontFamily: fontMono,
    fontSize: 9,
    fontWeight: 700,
    letterSpacing: 2,
    textTransform: "uppercase",
    cursor: "pointer",
  });

  if (isLoading)
    return (
      <div style={{ background: paper.paperDeep, minHeight: "100dvh" }}>
        <PageHeader title={t("page.expenses")} />
        <div
          style={{
            padding: "32px 20px",
            fontFamily: fontMono,
            fontSize: 11,
            color: paper.inkMute,
            letterSpacing: 1,
          }}
        >
          {t("state.loading")}
        </div>
      </div>
    );

  return (
    <div style={{ background: paper.paperDeep, minHeight: "100dvh", paddingBottom: 80 }}>
      <PageHeader title={t("page.expenses")} />

      <div
        style={{
          padding: "10px 16px 8px",
          borderBottom: `1px solid ${paper.paperDark}`,
          display: "flex",
          flexDirection: "column",
          gap: 6,
        }}
      >
        {(canFilter || years.length > 1) && (
          <div style={{ display: "flex", alignItems: "center" }}>
            {canFilter && (
              <div style={{ display: "flex", gap: 0 }}>
                {(["all", "mine"] as const).map((v, i, arr) => (
                  <button
                    key={v}
                    onClick={() => setMineParam(v === "mine" ? "true" : "")}
                    style={{
                      ...filterBtnStyle(v === "mine" ? isMine : !isMine),
                      borderRight: i < arr.length - 1 ? "none" : `1.5px solid ${paper.ink}`,
                    }}
                  >
                    {v === "all" ? t("filter.all") : t("filter.mine")}
                  </button>
                ))}
              </div>
            )}
            {years.length > 1 && (
              <div style={{ marginLeft: "auto" }}>
                <YearSelect
                  value={yearFilter}
                  onChange={setYearFilter}
                  years={years}
                  allLabel={t("filter.all")}
                />
              </div>
            )}
          </div>
        )}
        {cars.length > 1 && (
          <div style={{ display: "flex", gap: 0 }}>
            {[null, ...cars].map((car, i, arr) => (
              <button
                key={car ?? "__all"}
                onClick={() => setCarFilter(car ?? "")}
                style={{
                  ...filterBtnStyle(carFilter === (car ?? "")),
                  borderRight: i < arr.length - 1 ? "none" : `1.5px solid ${paper.ink}`,
                }}
              >
                {car ?? t("filter.all")}
              </button>
            ))}
          </div>
        )}
      </div>

      <GroupedList
        items={visible}
        getKey={(e) => e.date.slice(0, 7)}
        getGroupLabel={(key) => fmtYearMonth(key + "-01")}
        getGroupTotal={(items) => items.reduce((s, e) => s + e.amount, 0)}
        totalSuffix="€"
        renderItem={(e) => <ExpenseCard key={e.id} expense={e} onClick={() => openEdit(e)} />}
      />

      {visible.length === 0 && (
        <div
          style={{
            padding: "32px 20px",
            textAlign: "center",
            fontFamily: fontMono,
            fontSize: 11,
            color: paper.inkMute,
            letterSpacing: 1,
          }}
        >
          {t("state.empty_expenses")}
        </div>
      )}

      <Dialog.Root
        open={adding}
        onOpenChange={(open) => {
          if (!open) closeModal();
        }}
      >
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
              {t("page.expense_add")}
            </Dialog.Title>
            <ExpenseForm
              onSubmit={(data) =>
                createE.mutate(data as any, {
                  onSuccess: () => {
                    closeModal();
                    toast.success(t("toast.saved"));
                  },
                  onError: (e) => toast.error(e.message),
                })
              }
              onCancel={closeModal}
            />
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      <Dialog.Root
        open={!!editing}
        onOpenChange={(open) => {
          if (!open) closeModal();
        }}
      >
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
              {t("page.expense_edit")}
            </Dialog.Title>
            {editing && (
              <ExpenseForm
                defaultValues={editing}
                onSubmit={(data) =>
                  updateE.mutate({ id: editing.id, ...data } as any, {
                    onSuccess: () => {
                      closeModal();
                      toast.success(t("toast.saved"));
                    },
                    onError: (e) => toast.error(e.message),
                  })
                }
                onCancel={closeModal}
                onDelete={() =>
                  deleteE.mutate(editing.id, {
                    onSuccess: () => {
                      closeModal();
                      toast.success(t("toast.saved"));
                    },
                    onError: (e) => toast.error(e.message),
                  })
                }
              />
            )}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      <Fab onClick={openAdd} label={t("page.expense_add")} />
    </div>
  );
}

export default function ExpensesPage() {
  return (
    <Suspense>
      <ErrorBoundary>
        <ExpensesContent />
      </ErrorBoundary>
    </Suspense>
  );
}
