"use client";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import * as Dialog from "@radix-ui/react-dialog";
import dynamic from "next/dynamic";
import type { EventClickArg } from "@fullcalendar/core";
import { PageHeader } from "@/components/page-header";
import { Fab } from "@/components/fab";
import { ReservationForm } from "./reservation-form";
import {
  useReservations,
  useCreateReservation,
  useUpdateReservation,
  useDeleteReservation,
} from "@/hooks/use-reservations";
import type { Reservation } from "@/types";
import { t } from "@/lib/i18n";

const FullCalendarWrapper = dynamic(() => import("./full-calendar-wrapper"), { ssr: false });

function addOneDay(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

export default function CalendarPage() {
  const { data: reservations = [], isLoading } = useReservations();
  const createR = useCreateReservation();
  const updateR = useUpdateReservation();
  const deleteR = useDeleteReservation();
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<Reservation | null>(null);

  const events = useMemo(
    () =>
      reservations.map((r) => ({
        id: String(r.id),
        title: `${r.car_short} - ${r.person_name}`,
        start: r.start_date,
        end: addOneDay(r.end_date),
        allDay: true,
        backgroundColor: "#c0392b",
        borderColor: "#c0392b",
        extendedProps: { reservation: r },
      })),
    [reservations]
  );

  const handleEventClick = (info: EventClickArg) => {
    setEditing(info.event.extendedProps.reservation as Reservation);
  };

  return (
    <>
      <PageHeader title={t("page.calendar")} />
      <div className="p-2">
        {!isLoading && <FullCalendarWrapper events={events} onEventClick={handleEventClick} />}
      </div>

      <Dialog.Root open={adding} onOpenChange={setAdding}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/40 z-40" />
          <Dialog.Content className="fixed inset-x-0 bottom-0 bg-white rounded-t-xl z-50 max-h-[90vh] overflow-y-auto">
            <Dialog.Title className="px-4 pt-4 text-base font-semibold">
              {t("page.reservation_add")}
            </Dialog.Title>
            <ReservationForm
              onSubmit={(data) =>
                createR.mutate(data, {
                  onSuccess: () => {
                    setAdding(false);
                    toast.success(t("toast.reservation_saved"));
                  },
                  onError: (e) => toast.error(e.message),
                })
              }
              onCancel={() => setAdding(false)}
            />
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      <Dialog.Root open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/40 z-40" />
          <Dialog.Content className="fixed inset-x-0 bottom-0 bg-white rounded-t-xl z-50 max-h-[90vh] overflow-y-auto">
            <Dialog.Title className="px-4 pt-4 text-base font-semibold">
              {t("page.reservation_edit")}
            </Dialog.Title>
            {editing && (
              <>
                <ReservationForm
                  defaultValues={editing}
                  onSubmit={(data) =>
                    updateR.mutate(
                      { id: editing.id, ...data },
                      {
                        onSuccess: () => {
                          setEditing(null);
                          toast.success(t("toast.saved"));
                        },
                        onError: (e) => toast.error(e.message),
                      }
                    )
                  }
                  onCancel={() => setEditing(null)}
                />
                <div className="px-4 pb-4">
                  <button
                    onClick={() =>
                      deleteR.mutate(editing.id, {
                        onSuccess: () => {
                          setEditing(null);
                          toast.success(t("toast.deleted"));
                        },
                        onError: (e) => toast.error(e.message),
                      })
                    }
                    className="w-full border border-red-300 text-red-600 rounded-md py-2 text-sm"
                  >
                    {t("action.delete")}
                  </button>
                </div>
              </>
            )}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      <Fab onClick={() => setAdding(true)} label={t("page.reservation_add")} />
    </>
  );
}
