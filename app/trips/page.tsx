"use client";
import { useState } from "react";
import { toast } from "sonner";
import * as Dialog from "@radix-ui/react-dialog";
import { PageHeader } from "@/components/page-header";
import { GroupedList } from "@/components/grouped-list";
import { Fab } from "@/components/fab";
import { TripForm } from "./trip-form";
import { useTrips, useCreateTrip, useUpdateTrip, useDeleteTrip } from "@/hooks/use-trips";
import type { Trip } from "@/types";
import { MapPin, ChevronRight } from "lucide-react";
import { t } from "@/lib/i18n";

export default function TripsPage() {
  const { data: trips = [], isLoading } = useTrips();
  const createTrip = useCreateTrip();
  const updateTrip = useUpdateTrip();
  const deleteTrip = useDeleteTrip();
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<Trip | null>(null);

  if (isLoading) return <><PageHeader title={t("page.trips")} /><p className="p-4 text-gray-500">{t("state.loading")}</p></>;

  return (
    <>
      <PageHeader title={t("page.trips")} />
      <GroupedList
        items={trips}
        getKey={(trip) => trip.date.slice(0, 7)}
        getGroupLabel={(key) => { const [y, m] = key.split("-"); return `${y}-${Number(m)}`; }}
        getGroupTotal={(items) => items.reduce((s, trip) => s + trip.km, 0)}
        renderItem={(trip) => (
          <button key={trip.id} onClick={() => setEditing(trip)}
            className="w-full flex items-center px-4 py-3 border-b hover:bg-gray-50 text-left gap-3">
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">{trip.person_name}</span>
                <span className="text-xs font-mono bg-gray-100 px-1.5 py-0.5 rounded">{trip.car_short}</span>
                <span className="text-xs text-gray-500 ml-auto">{trip.date}</span>
              </div>
              <div className="flex items-center gap-3 mt-0.5">
                <span className="text-sm text-gray-600">{trip.km} km</span>
                <span className="text-xs text-gray-400">{trip.start_odometer} → {trip.end_odometer}</span>
                <span className="text-sm font-medium ml-auto">€ {trip.amount.toFixed(2)}</span>
              </div>
            </div>
            {trip.location && <MapPin className="w-4 h-4 text-gray-400 flex-shrink-0" />}
            <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
          </button>
        )}
      />

      <Dialog.Root open={adding} onOpenChange={setAdding}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/40 z-40" />
          <Dialog.Content className="fixed inset-x-0 bottom-0 bg-white rounded-t-xl z-50 max-h-[95vh] overflow-y-auto">
            <Dialog.Title className="px-4 pt-4 text-base font-semibold">{t("page.trip_add")}</Dialog.Title>
            <TripForm
              onSubmit={(data) => createTrip.mutate(data as any, {
                onSuccess: () => { setAdding(false); toast.success(t("toast.trip_saved")); },
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
          <Dialog.Content className="fixed inset-x-0 bottom-0 bg-white rounded-t-xl z-50 max-h-[95vh] overflow-y-auto">
            <Dialog.Title className="px-4 pt-4 text-base font-semibold">{t("page.trip_edit")}</Dialog.Title>
            {editing && (
              <>
                <TripForm
                  defaultValues={editing}
                  onSubmit={(data) => updateTrip.mutate({ id: editing.id, ...data } as any, {
                    onSuccess: () => { setEditing(null); toast.success(t("toast.saved")); },
                    onError: (e) => toast.error(e.message),
                  })}
                  onCancel={() => setEditing(null)}
                />
                <div className="px-4 pb-4">
                  <button onClick={() => deleteTrip.mutate(editing.id, {
                    onSuccess: () => { setEditing(null); toast.success(t("toast.trip_deleted")); },
                    onError: (e) => toast.error(e.message),
                  })} className="w-full border border-red-300 text-red-600 rounded-md py-2 text-sm">
                    {t("action.delete")}
                  </button>
                </div>
              </>
            )}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      <Fab onClick={() => setAdding(true)} label={t("page.trip_add")} />
    </>
  );
}
