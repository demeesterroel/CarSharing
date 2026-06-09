"use client";
import { ErrorBoundary } from "@/components/error-boundary";
import { Fab } from "@/components/fab";
import { FuelCard } from "@/components/fuel-card";
import { GroupedList } from "@/components/grouped-list";
import { ListFilterBar } from "@/components/list-filter-bar";
import { useT } from "@/components/locale-provider";
import { ModalSheet } from "@/components/modal-sheet";
import { PageHeader } from "@/components/page-header";
import { useEditModal } from "@/hooks/use-edit-modal";
import {
  useCreateFuelFillup,
  useDeleteFuelFillup,
  useFuelFillups,
  useUpdateFuelFillup,
} from "@/hooks/use-fuel-fillups";
import { useMe } from "@/hooks/use-me";
import { useQueryParam } from "@/hooks/use-query-param";
import { useCars } from "@/hooks/use-vehicles";
import { fmtYearMonth, fontMono, tokens } from "@/lib/theme-tokens";
import { canEdit } from "@/lib/permissions";
import { Suspense } from "react";
import { toast } from "sonner";
import { FuelForm } from "./fuel-form";

function FuelContent() {
  const t = useT();
  const { data: fillups = [], isLoading } = useFuelFillups();
  const { data: me } = useMe();
  const { data: carList = [] } = useCars();
  const createF = useCreateFuelFillup();
  const updateF = useUpdateFuelFillup();
  const deleteF = useDeleteFuelFillup();

  const [mineParam, setMineParam] = useQueryParam("mine", "");
  const [carFilter, setCarFilter] = useQueryParam("car", "");
  const [yearFilter, setYearFilter] = useQueryParam("year", "");

  const { adding, editingId, modalClosed, openAdd, openEdit, closeModal } = useEditModal();

  const editing =
    !isLoading && editingId ? (fillups.find((f) => f.id === editingId) ?? null) : null;

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
    new Set(fillups.map((f) => f.car_short).filter((s): s is string => !!s))
  ).sort();
  const years = Array.from(new Set(fillups.map((f) => f.date.slice(0, 4))))
    .sort()
    .reverse();

  const visible = fillups
    .filter((f) => {
      if (isMine && canFilter) return f.person_id === me!.personId;
      if (isOthers && canFilter) return f.person_id !== me!.personId;
      return true;
    })
    .filter((f) => (carFilter ? f.car_short === carFilter : true))
    .filter((f) => (yearFilter ? f.date.startsWith(yearFilter) : true));

  if (isLoading)
    return (
      <div style={{ background: tokens.paperDeep, minHeight: "100dvh" }}>
        <PageHeader title={t("page.fuel")} />
        <div
          style={{
            padding: "32px 20px",
            fontFamily: fontMono,
            fontSize: 11,
            color: tokens.inkDim,
            letterSpacing: 1,
          }}
        >
          {t("state.loading")}
        </div>
      </div>
    );

  return (
    <div style={{ background: tokens.paperDeep, minHeight: "100dvh", paddingBottom: 80 }}>
      <PageHeader title={t("page.fuel")} />

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
        getKey={(f) => f.date.slice(0, 7)}
        getGroupLabel={(key) => fmtYearMonth(key + "-01")}
        getGroupTotal={(items) => items.reduce((s, f) => s + f.amount, 0)}
        totalSuffix="€"
        renderItem={(f) => <FuelCard key={f.id} fuel={f} onClick={() => openEdit(f.id)} />}
      />

      {visible.length === 0 && (
        <div
          style={{
            padding: "32px 20px",
            textAlign: "center",
            fontFamily: fontMono,
            fontSize: 11,
            color: tokens.inkDim,
            letterSpacing: 1,
          }}
        >
          {t("state.empty_fuel")}
        </div>
      )}

      <ModalSheet open={adding} onClose={closeModal} title={t("page.fuel_add")}>
        <FuelForm
          onSubmit={(data) =>
            createF.mutate(data as any, {
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

      <ModalSheet open={!!editing && !modalClosed} onClose={closeModal} title={t("page.fuel_edit")}>
        {editing && (
          <FuelForm
            key={editing.id}
            defaultValues={editing}
            readOnly={editingReadOnly}
            onSubmit={(data) =>
              updateF.mutate({ id: editing.id, ...data } as any, {
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
                    deleteF.mutate(editing.id, {
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

      <Fab onClick={openAdd} label={t("page.fuel_add")} />
    </div>
  );
}

export default function FuelPage() {
  return (
    <Suspense>
      <ErrorBoundary>
        <FuelContent />
      </ErrorBoundary>
    </Suspense>
  );
}
