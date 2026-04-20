"use client";
import { useState } from "react";
import { toast } from "sonner";
import * as Dialog from "@radix-ui/react-dialog";
import { PageHeader } from "@/components/page-header";
import { Fab } from "@/components/fab";
import { CarForm } from "./car-form";
import { useCars, useCreateCar, useUpdateCar } from "@/hooks/use-cars";
import type { Car } from "@/types";
import { ChevronRight } from "lucide-react";
import { t } from "@/lib/i18n";

export default function CarsPage() {
  const { data: cars = [], isLoading } = useCars();
  const createCar = useCreateCar();
  const updateCar = useUpdateCar();
  const [editing, setEditing] = useState<Car | null>(null);
  const [adding, setAdding] = useState(false);

  if (isLoading) return <><PageHeader title={t("page.cars")} /><p className="p-4 text-gray-500">{t("state.loading")}</p></>;

  return (
    <>
      <PageHeader title={t("page.cars")} />
      <div className="divide-y">
        {cars.map((c) => (
          <button key={c.id} onClick={() => setEditing(c)}
            className="w-full flex items-center px-4 py-3 hover:bg-gray-50 text-left gap-3">
            <span className="text-sm font-mono font-bold text-blue-600 w-10">{c.short}</span>
            <div className="flex-1">
              <p className="text-sm font-medium">{c.name}</p>
              <p className="text-xs text-gray-500">
                {[c.brand, c.color].filter(Boolean).join(" · ")} · €{c.price_per_km}/km
              </p>
            </div>
            <ChevronRight className="w-4 h-4 text-gray-400" />
          </button>
        ))}
      </div>

      <Dialog.Root open={adding} onOpenChange={setAdding}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/40 z-40" />
          <Dialog.Content className="fixed inset-x-0 bottom-0 bg-white rounded-t-xl z-50 max-h-[90vh] overflow-y-auto">
            <Dialog.Title className="px-4 pt-4 text-base font-semibold">{t("page.car_add")}</Dialog.Title>
            <CarForm
              onSubmit={(data) => createCar.mutate(
                { ...data, brand: data.brand ?? null, color: data.color ?? null } as Omit<Car,"id">,
                { onSuccess: () => { setAdding(false); toast.success(t("toast.car_added")); },
                  onError: (e) => toast.error(e.message) }
              )}
              onCancel={() => setAdding(false)}
            />
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      <Dialog.Root open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/40 z-40" />
          <Dialog.Content className="fixed inset-x-0 bottom-0 bg-white rounded-t-xl z-50 max-h-[90vh] overflow-y-auto">
            <Dialog.Title className="px-4 pt-4 text-base font-semibold">{t("page.car_edit")}</Dialog.Title>
            {editing && (
              <CarForm
                defaultValues={editing}
                onSubmit={(data) => updateCar.mutate(
                  { ...editing, ...data, brand: data.brand ?? null, color: data.color ?? null },
                  { onSuccess: () => { setEditing(null); toast.success(t("toast.saved")); },
                    onError: (e) => toast.error(e.message) }
                )}
                onCancel={() => setEditing(null)}
              />
            )}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      <Fab onClick={() => setAdding(true)} label={t("page.car_add")} />
    </>
  );
}
