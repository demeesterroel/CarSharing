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
import { paper, fontMono, fontSerif, fmtMoney, fmtYearMonth } from "@/lib/paper-theme";
import { useT } from "@/components/locale-provider";

const sheetStyle: React.CSSProperties = {
  position: "fixed", left: 0, right: 0, bottom: 0, background: paper.paper,
  borderRadius: "16px 16px 0 0", zIndex: 50, maxHeight: "95vh",
  overflowY: "auto", maxWidth: 480, margin: "0 auto",
};

export default function TripsPage() {
  const t = useT();
  const { data: trips = [], isLoading } = useTrips();
  const createTrip = useCreateTrip();
  const updateTrip = useUpdateTrip();
  const deleteTrip = useDeleteTrip();
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<Trip | null>(null);

  if (isLoading) return (
    <div style={{ background: paper.paperDeep, minHeight: "100dvh" }}>
      <PageHeader title={t("page.trips")} />
      <div style={{ padding: "32px 20px", fontFamily: fontMono, fontSize: 11, color: paper.inkMute, letterSpacing: 1 }}>{t("state.loading")}</div>
    </div>
  );

  return (
    <div style={{ background: paper.paperDeep, minHeight: "100dvh", paddingBottom: 80 }}>
      <PageHeader title={t("page.trips")} />

      <GroupedList
        items={trips}
        getKey={(trip) => trip.date.slice(0, 7)}
        getGroupLabel={(key) => fmtYearMonth(key + "-01")}
        getGroupTotal={(items) => items.reduce((s, trip) => s + trip.km, 0)}
        totalSuffix="km"
        renderItem={(trip) => (
          <button
            key={trip.id}
            onClick={() => setEditing(trip)}
            style={{
              width: "100%", display: "flex", alignItems: "center", gap: 12,
              padding: "12px 14px", marginBottom: 8,
              background: paper.paper, border: "none", cursor: "pointer", textAlign: "left",
              borderLeft: `3px solid ${paper.ink}`,
              boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
            }}
          >
            <div style={{
              padding: "6px 8px", background: paper.ink, color: paper.paper,
              fontFamily: fontMono, fontSize: 11, fontWeight: 700, letterSpacing: 2, flexShrink: 0, minWidth: 42, textAlign: "center",
            }}>
              {trip.car_short}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: fontSerif, fontSize: 15, fontWeight: 600, color: paper.ink, lineHeight: 1.2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {trip.location ?? "—"}
              </div>
              <div style={{ fontFamily: fontMono, fontSize: 10, color: paper.inkDim, letterSpacing: 1, marginTop: 2 }}>
                {trip.person_name} · {trip.date} · {trip.start_odometer.toLocaleString("nl-BE")} → {trip.end_odometer.toLocaleString("nl-BE")}
              </div>
            </div>
            <div style={{ textAlign: "right", flexShrink: 0 }}>
              <div style={{ fontFamily: fontMono, fontSize: 14, fontWeight: 700, color: paper.ink }}>{fmtMoney(trip.amount)}</div>
              <div style={{ fontFamily: fontMono, fontSize: 10, color: paper.inkDim }}>{trip.km} km</div>
            </div>
          </button>
        )}
      />

      {trips.length === 0 && (
        <div style={{ padding: "32px 20px", textAlign: "center", fontFamily: fontMono, fontSize: 11, color: paper.inkMute, letterSpacing: 1 }}>
          {t("state.empty_trips")}
        </div>
      )}

      <Dialog.Root open={adding} onOpenChange={setAdding}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/40 z-40" />
          <Dialog.Content style={sheetStyle}>
            <Dialog.Title style={{ padding: "16px 20px 0", fontFamily: fontSerif, fontSize: 20, fontWeight: 700 }}>
              {t("page.trip_add")}
            </Dialog.Title>
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
          <Dialog.Content style={sheetStyle}>
            <Dialog.Title style={{ padding: "16px 20px 0", fontFamily: fontSerif, fontSize: 20, fontWeight: 700 }}>
              {t("page.trip_edit")}
            </Dialog.Title>
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
                <div style={{ padding: "0 16px 24px" }}>
                  <button
                    onClick={() => deleteTrip.mutate(editing.id, {
                      onSuccess: () => { setEditing(null); toast.success(t("toast.trip_deleted")); },
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

      <Fab onClick={() => setAdding(true)} label={t("page.trip_add")} />
    </div>
  );
}
