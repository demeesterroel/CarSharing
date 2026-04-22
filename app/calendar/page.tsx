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
import { paper, fontMono, fontSerif, fmtYearMonth } from "@/lib/paper-theme";
import { useT } from "@/components/locale-provider";

const FullCalendarWrapper = dynamic(() => import("./full-calendar-wrapper"), { ssr: false });

const sheetStyle: React.CSSProperties = {
  position: "fixed", left: 0, right: 0, bottom: 0, background: paper.paper,
  borderRadius: "16px 16px 0 0", zIndex: 50, maxHeight: "95vh",
  overflowY: "auto", maxWidth: 480, margin: "0 auto",
};

function addOneDay(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

function statusColor(status: string) {
  if (status === "confirmed") return paper.green;
  if (status === "rejected") return paper.accent;
  return paper.amber;
}

function groupByMonth(reservations: Reservation[]) {
  const groups = new Map<string, Reservation[]>();
  for (const r of reservations) {
    const key = r.start_date.slice(0, 7);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(r);
  }
  return Array.from(groups.entries()).sort((a, b) => b[0].localeCompare(a[0]));
}

export default function CalendarPage() {
  const t = useT();

  function statusLabel(status: string) {
    if (status === "confirmed") return t("reservation.confirmed");
    if (status === "rejected") return t("reservation.rejected");
    return t("reservation.pending");
  }

  const { data: reservations = [], isLoading } = useReservations();
  const createR = useCreateReservation();
  const updateR = useUpdateReservation();
  const deleteR = useDeleteReservation();
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<Reservation | null>(null);
  const [view, setView] = useState<"list" | "calendar">("list");

  const events = useMemo(
    () =>
      reservations.map((r) => ({
        id: String(r.id),
        title: `${r.car_short} - ${r.person_name}`,
        start: r.start_date,
        end: addOneDay(r.end_date),
        allDay: true,
        backgroundColor: statusColor(r.status ?? "pending"),
        borderColor: statusColor(r.status ?? "pending"),
        extendedProps: { reservation: r },
      })),
    [reservations]
  );

  const handleEventClick = (info: EventClickArg) => {
    setEditing(info.event.extendedProps.reservation as Reservation);
  };

  const grouped = useMemo(() => groupByMonth(reservations), [reservations]);

  if (isLoading) return (
    <div style={{ background: paper.paperDeep, minHeight: "100dvh" }}>
      <PageHeader title={t("page.reservations")} />
      <div style={{ padding: "32px 20px", fontFamily: fontMono, fontSize: 11, color: paper.inkMute, letterSpacing: 1 }}>{t("state.loading")}</div>
    </div>
  );

  return (
    <div style={{ background: paper.paperDeep, minHeight: "100dvh", paddingBottom: 80 }}>
      <PageHeader title={t("page.reservations")} />

      {/* View toggle */}
      <div style={{ display: "flex", gap: 0, padding: "12px 16px 4px", borderBottom: `1px solid ${paper.paperDark}` }}>
        {(["list", "calendar"] as const).map((v) => (
          <button
            key={v}
            onClick={() => setView(v)}
            style={{
              flex: 1, padding: "7px 0",
              background: view === v ? paper.ink : "transparent",
              color: view === v ? paper.paper : paper.inkDim,
              border: `1.5px solid ${paper.ink}`,
              borderRight: v === "list" ? "none" : undefined,
              fontFamily: fontMono, fontSize: 10, fontWeight: 700, letterSpacing: 2,
              textTransform: "uppercase", cursor: "pointer",
            }}
          >
            {v === "list" ? t("calendar.list") : t("calendar.calendar")}
          </button>
        ))}
      </div>

      {view === "calendar" ? (
        <div style={{ padding: 8 }}>
          <FullCalendarWrapper events={events} onEventClick={handleEventClick} />
        </div>
      ) : (
        <div>
          {grouped.length === 0 && (
            <div style={{ padding: "32px 20px", textAlign: "center", fontFamily: fontMono, fontSize: 11, color: paper.inkMute, letterSpacing: 1 }}>
              {t("state.empty_reservations")}
            </div>
          )}
          {grouped.map(([key, items]) => (
            <div key={key}>
              <div style={{
                display: "flex", alignItems: "baseline", justifyContent: "space-between",
                padding: "10px 20px 6px",
                borderTop: `1.5px dashed ${paper.ink}`,
                background: paper.paperDeep,
              }}>
                <span style={{ fontFamily: fontSerif, fontSize: 16, fontWeight: 600, color: paper.ink }}>
                  {fmtYearMonth(key + "-01")}
                </span>
                <span style={{ fontFamily: fontMono, fontSize: 11, color: paper.inkDim, fontWeight: 600 }}>
                  {t("calendar.count", { count: items.length })}
                </span>
              </div>
              <div style={{ padding: "8px 16px" }}>
                {items.map((r) => {
                  const status = r.status ?? "pending";
                  const isPending = status === "pending";
                  return (
                    <button
                      key={r.id}
                      onClick={() => setEditing(r)}
                      style={{
                        width: "100%", display: "flex", alignItems: "center", gap: 12,
                        padding: "12px 14px", marginBottom: 8,
                        background: isPending
                          ? `repeating-linear-gradient(45deg, ${paper.paper}, ${paper.paper} 6px, ${paper.paperDeep} 6px, ${paper.paperDeep} 12px)`
                          : paper.paper,
                        border: isPending ? `1.5px dashed ${paper.amber}` : "none",
                        cursor: "pointer", textAlign: "left",
                        borderLeft: isPending ? `3px solid ${paper.amber}` : `3px solid ${statusColor(status)}`,
                        boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
                      }}
                    >
                      <div style={{
                        padding: "6px 8px", background: paper.ink, color: paper.paper,
                        fontFamily: fontMono, fontSize: 11, fontWeight: 700, letterSpacing: 2, flexShrink: 0, minWidth: 42, textAlign: "center",
                      }}>
                        {r.car_short}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontFamily: fontSerif, fontSize: 15, fontWeight: 600, color: paper.ink, lineHeight: 1.2 }}>
                          {r.person_name}
                        </div>
                        <div style={{ fontFamily: fontMono, fontSize: 10, color: paper.inkDim, letterSpacing: 1, marginTop: 2 }}>
                          {r.start_date} → {r.end_date}
                        </div>
                      </div>
                      <div style={{
                        padding: "3px 7px",
                        background: statusColor(status),
                        color: paper.paper,
                        fontFamily: fontMono, fontSize: 9, fontWeight: 700, letterSpacing: 1,
                        textTransform: "uppercase", flexShrink: 0,
                      }}>
                        {statusLabel(status)}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog.Root open={adding} onOpenChange={setAdding}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/40 z-40" />
          <Dialog.Content style={sheetStyle}>
            <Dialog.Title style={{ padding: "16px 20px 0", fontFamily: fontSerif, fontSize: 20, fontWeight: 700 }}>
              {t("page.reservation_add")}
            </Dialog.Title>
            <ReservationForm
              onSubmit={(data) =>
                createR.mutate(data, {
                  onSuccess: () => { setAdding(false); toast.success(t("toast.reservation_saved")); },
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
          <Dialog.Content style={sheetStyle}>
            <Dialog.Title style={{ padding: "16px 20px 0", fontFamily: fontSerif, fontSize: 20, fontWeight: 700 }}>
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
                        onSuccess: () => { setEditing(null); toast.success(t("toast.saved")); },
                        onError: (e) => toast.error(e.message),
                      }
                    )
                  }
                  onCancel={() => setEditing(null)}
                />
                <div style={{ padding: "0 16px 24px" }}>
                  <button
                    onClick={() =>
                      deleteR.mutate(editing.id, {
                        onSuccess: () => { setEditing(null); toast.success(t("toast.deleted")); },
                        onError: (e) => toast.error(e.message),
                      })
                    }
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

      <Fab onClick={() => setAdding(true)} label={t("page.reservation_add")} />
    </div>
  );
}
