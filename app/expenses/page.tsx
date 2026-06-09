"use client";
import { ErrorBoundary } from "@/components/error-boundary";
import { ExpenseCard } from "@/components/expense-card";
import { Fab } from "@/components/fab";
import { GroupedList } from "@/components/grouped-list";
import { ListFilterBar } from "@/components/list-filter-bar";
import { useT } from "@/components/locale-provider";
import { ModalSheet } from "@/components/modal-sheet";
import { PageHeader } from "@/components/page-header";
import { useEditModal } from "@/hooks/use-edit-modal";
import {
  useCreateExpense,
  useDeleteExpense,
  useExpenses,
  useUpdateExpense,
} from "@/hooks/use-expenses";
import { useMe } from "@/hooks/use-me";
import { useQueryParam } from "@/hooks/use-query-param";
import { useCars } from "@/hooks/use-vehicles";
import { fmtYearMonth, fontMono, paper } from "@/lib/paper-theme";
import { canEdit } from "@/lib/permissions";
import { Suspense } from "react";
import { toast } from "sonner";
import { ExpenseForm } from "./expense-form";

function ExpensesContent() {
  const t = useT();
  const { data: expenses = [], isLoading } = useExpenses();
  const { data: me } = useMe();
  const { data: carList = [] } = useCars();
  const createE = useCreateExpense();
  const updateE = useUpdateExpense();
  const deleteE = useDeleteExpense();

  const [mineParam, setMineParam] = useQueryParam("mine", "");
  const [carFilter, setCarFilter] = useQueryParam("car", "");
  const [yearFilter, setYearFilter] = useQueryParam("year", "");

  const { adding, editingId, modalClosed, openAdd, openEdit, closeModal } = useEditModal();

  const editing =
    !isLoading && editingId ? (expenses.find((e) => e.id === editingId) ?? null) : null;

  const editingReadOnly =
    editing != null &&
    !(
      me?.personId != null &&
      canEdit(
        me.personId,
        me.isAdmin,
        editing,
        carList.find((c) => c.id === editing.car_id)?.owner_person_id ?? null
      )
    );

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

  if (isLoading)
    return (
      <div style={{ background: paper.paperDeep, minHeight: "100dvh" }}>
        <PageHeader title={t("page.expenses")} />
        <div
          style={{
            padding: "32px 20px",
            fontFamily: fontMono,
            fontSize: 11,
            color: paper.inkDim,
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

      <ListFilterBar
        canFilter={canFilter}
        isMine={isMine}
        cars={cars}
        carFilter={carFilter}
        years={years}
        yearFilter={yearFilter}
        onMineChange={setMineParam}
        onCarChange={setCarFilter}
        onYearChange={setYearFilter}
      />

      <GroupedList
        items={visible}
        getKey={(e) => e.date.slice(0, 7)}
        getGroupLabel={(key) => fmtYearMonth(key + "-01")}
        getGroupTotal={(items) => items.reduce((s, e) => s + e.amount, 0)}
        totalSuffix="€"
        renderItem={(e) => <ExpenseCard key={e.id} expense={e} onClick={() => openEdit(e.id)} />}
      />

      {visible.length === 0 && (
        <div
          style={{
            padding: "32px 20px",
            textAlign: "center",
            fontFamily: fontMono,
            fontSize: 11,
            color: paper.inkDim,
            letterSpacing: 1,
          }}
        >
          {t("state.empty_expenses")}
        </div>
      )}

      <ModalSheet open={adding} onClose={closeModal} title={t("page.expense_add")}>
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
      </ModalSheet>

      <ModalSheet
        open={!!editing && !modalClosed}
        onClose={closeModal}
        title={t("page.expense_edit")}
      >
        {editing && (
          <ExpenseForm
            key={editing.id}
            defaultValues={editing}
            readOnly={editingReadOnly}
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
            onDelete={
              editingReadOnly
                ? undefined
                : () =>
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
      </ModalSheet>

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
