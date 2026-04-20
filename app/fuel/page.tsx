"use client";
import { useState } from "react";
import { toast } from "sonner";
import * as Dialog from "@radix-ui/react-dialog";
import { ChevronRight } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { GroupedList } from "@/components/grouped-list";
import { Fab } from "@/components/fab";
import { FuelForm } from "./fuel-form";
import { useFuelFillups, useCreateFuelFillup, useUpdateFuelFillup, useDeleteFuelFillup } from "@/hooks/use-fuel-fillups";
import type { FuelFillup } from "@/types";
import { t } from "@/lib/i18n";

function yearMonth(date: string) {
  const [y, m] = date.split("-");
  return `${y}-${m}`;
}

export default function FuelPage() {
  const { data: fillups = [], isLoading } = useFuelFillups();
  const createF = useCreateFuelFillup();
  const updateF = useUpdateFuelFillup();
  const deleteF = useDeleteFuelFillup();
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<FuelFillup | null>(null);

  if (isLoading) {
    return (
      <>
        <PageHeader title={t("page.fuel")} />
        <p className="p-4 text-gray-500">{t("state.loading")}</p>
      </>
    );
  }

  return (
    <>
      <PageHeader title={t("page.fuel")} />
      <GroupedList
        items={fillups}
        getKey={(f) => yearMonth(f.date)}
        getGroupLabel={(key) => { const [y, m] = key.split("-"); return `${y}-${Number(m)}`; }}
        getGroupTotal={(items) => items.reduce((s, f) => s + f.amount, 0)}
        renderItem={(f) => (
          <button key={f.id} onClick={() => setEditing(f)}
            className="w-full flex items-center px-4 py-3 border-b hover:bg-gray-50 text-left gap-3">
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">{f.person_name}</span>
                <span className="text-xs font-mono bg-gray-100 px-1.5 py-0.5 rounded">{f.car_short}</span>
                <span className="text-xs text-gray-500 ml-auto">{f.date}</span>
              </div>
              <div className="flex items-center gap-3 mt-0.5">
                <span className="text-sm font-medium">€ {f.amount.toFixed(2)}</span>
                <span className="text-xs text-gray-400">{f.liters} L · €{f.price_per_liter.toFixed(3)}/L</span>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
          </button>
        )}
      />

      <Dialog.Root open={adding} onOpenChange={setAdding}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/40 z-40" />
          <Dialog.Content className="fixed inset-x-0 bottom-0 bg-white rounded-t-xl z-50 max-h-[95vh] overflow-y-auto">
            <Dialog.Title className="px-4 pt-4 text-base font-semibold">{t("page.fuel_add")}</Dialog.Title>
            <FuelForm
              onSubmit={(data) => createF.mutate(data, {
                onSuccess: () => { setAdding(false); toast.success(t("toast.fuel_saved")); },
              })}
              onCancel={() => setAdding(false)}
            />
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      <Dialog.Root open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/40 z-40" />
          <Dialog.Content className="fixed inset-x-0 bottom-0 bg-white rounded-t-xl z-50 max-h-[95vh] overflow-y-auto">
            <Dialog.Title className="px-4 pt-4 text-base font-semibold">{t("page.fuel_edit")}</Dialog.Title>
            {editing && (
              <>
                <FuelForm
                  defaultValues={editing}
                  onSubmit={(data) => updateF.mutate({ id: editing.id, ...data }, {
                    onSuccess: () => { setEditing(null); toast.success(t("toast.saved")); },
                  })}
                  onCancel={() => setEditing(null)}
                />
                <div className="px-4 pb-4">
                  <button onClick={() => deleteF.mutate(editing.id, {
                    onSuccess: () => { setEditing(null); toast.success(t("toast.deleted")); },
                  })} className="w-full border border-red-300 text-red-600 rounded-md py-2 text-sm">
                    {t("action.delete")}
                  </button>
                </div>
              </>
            )}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      <Fab onClick={() => setAdding(true)} label={t("page.fuel_add")} />
    </>
  );
}
