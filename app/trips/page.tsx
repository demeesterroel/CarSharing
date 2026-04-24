"use client";
import { useState } from "react";
import { toast } from "sonner";
import * as Dialog from "@radix-ui/react-dialog";
import { PageHeader } from "@/components/page-header";
import { GroupedList } from "@/components/grouped-list";
import { Fab } from "@/components/fab";
import { TripForm } from "./trip-form";
import { useTrips, useCreateTrip, useUpdateTrip, useDeleteTrip } from "@/hooks/use-trips";
import { useMe } from "@/hooks/use-me";
import type { Trip } from "@/types";
import { paper, fontMono, fontSerif, fmtMoney, fmtYearMonth } from "@/lib/paper-theme";
import { useT } from "@/components/locale-provider";

const overlayStyle: React.CSSProperties = {
  position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 49,
};
const sheetStyle: React.CSSProperties = {
  position: "fixed", bottom: 0,
  left: "50%", transform: "translateX(-50%)",
  width: "min(100%, 480px)",
  maxHeight: "92dvh", borderRadius: "14px 14px 0 0",
  background: paper.paperDeep, zIndex: 50, overflowY: "auto",
};

export default function TripsPage() {
  const t = useT();
  const { data: trips = [], isLoading } = useTrips();
  const { data: me } = useMe();
  const createTrip = useCreateTrip();
  const updateTrip = useUpdateTrip();
  const deleteTrip = useDeleteTrip();
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<Trip | null>(null);
  const [filter, setFilter] = useState<"all" | "mine">("all");
  const [carFilter, setCarFilter] = useState<string | null>(null);

  const canFilter = me?.personId != null;
  const cars = Array.from(new Set(trips.map((tr) => tr.car_short).filter((s): s is string => !!s))).sort();

  const visible = trips
    .filter((tr) => filter === "mine" && canFilter ? tr.person_id === me!.personId : true)
    .filter((tr) => carFilter ? tr.car_short === carFilter : true);

  if (isLoading) return (
    <div style={{ background: paper.paperDeep, minHeight: "100dvh" }}>
      <PageHeader title={t("page.trips")} />
      <div style={{ padding: "32px 20px", fontFamily: fontMono, fontSize: 11, color: paper.inkMute, letterSpacing: 1 }}>{t("state.loading")}</div>
    </div>
  );

  return (
    <div style={{ background: paper.paperDeep, minHeight: "100dvh", paddingBottom: 80 }}>
      <PageHeader title={t("page.trips")} />

      <div style={{ padding: "10px 16px 8px", borderBottom: `1px solid ${paper.paperDark}`, display: "flex", flexDirection: "column", gap: 6 }}>
        {/* Mine / All row */}
        {canFilter && (
          <div style={{ display: "flex", gap: 0 }}>
            {(["mine", "all"] as const).map((v, i, arr) => (
              <button
                key={v}
                onClick={() => setFilter(v)}
                style={{
                  padding: "5px 12px",
                  background: filter === v ? paper.ink : "transparent",
                  color: filter === v ? paper.paper : paper.inkDim,
                  border: `1.5px solid ${paper.ink}`,
                  borderRight: i < arr.length - 1 ? "none" : `1.5px solid ${paper.ink}`,
                  fontFamily: fontMono, fontSize: 9, fontWeight: 700, letterSpacing: 2,
                  textTransform: "uppercase", cursor: "pointer",
                }}
              >
                {v === "all" ? t("filter.all") : t("filter.mine")}
              </button>
            ))}
          </div>
        )}
        {/* Car filter row */}
        {cars.length > 1 && (
          <div style={{ display: "flex", gap: 0 }}>
            {[null, ...cars].map((car, i, arr) => (
              <button
                key={car ?? "__all"}
                onClick={() => setCarFilter(car)}
                style={{
                  padding: "5px 12px",
                  background: carFilter === car ? paper.ink : "transparent",
                  color: carFilter === car ? paper.paper : paper.inkDim,
                  border: `1.5px solid ${paper.ink}`,
                  borderRight: i < arr.length - 1 ? "none" : `1.5px solid ${paper.ink}`,
                  fontFamily: fontMono, fontSize: 9, fontWeight: 700, letterSpacing: 2,
                  textTransform: "uppercase", cursor: "pointer",
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
              borderLeft: `3px solid ${paper.accent}`,
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
              <div style={{
                fontFamily: fontSerif, fontSize: 15, fontWeight: 600, lineHeight: 1.2,
                whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                color: (!trip.location && !trip.gps_coords && trip.parking) ? paper.inkDim : paper.ink,
                fontStyle: (!trip.location && !trip.gps_coords && trip.parking) ? "italic" : "normal",
              }}>
                {trip.location ?? trip.gps_coords ?? trip.parking ?? "—"}
              </div>
              <div style={{ fontFamily: fontMono, fontSize: 10, color: paper.inkDim, letterSpacing: 1, marginTop: 2 }}>
                {trip.person_name} · {trip.date} · {trip.start_odometer.toLocaleString("nl-BE")} → {trip.end_odometer.toLocaleString("nl-BE")}
              </div>
            </div>
            <div style={{ textAlign: "right", flexShrink: 0 }}>
              <div style={{ fontFamily: fontMono, fontSize: 14, fontWeight: 700, color: paper.accent }}>{fmtMoney(trip.amount)}</div>
              <div style={{ fontFamily: fontMono, fontSize: 10, color: paper.inkDim }}>{trip.km} km</div>
            </div>
          </button>
        )}
      />

      {visible.length === 0 && (
        <div style={{ padding: "32px 20px", textAlign: "center", fontFamily: fontMono, fontSize: 11, color: paper.inkMute, letterSpacing: 1 }}>
          {t("state.empty_trips")}
        </div>
      )}

      <Dialog.Root open={adding} onOpenChange={setAdding}>
        <Dialog.Portal>
          <Dialog.Overlay style={overlayStyle} />
          <Dialog.Content style={sheetStyle} aria-describedby={undefined}>
            <Dialog.Title style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0,0,0,0)" }}>
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
          <Dialog.Overlay style={overlayStyle} />
          <Dialog.Content style={sheetStyle} aria-describedby={undefined}>
            <Dialog.Title style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0,0,0,0)" }}>
              {t("page.trip_edit")}
            </Dialog.Title>
            {editing && (
              <TripForm
                defaultValues={editing}
                onSubmit={(data) => updateTrip.mutate({ id: editing.id, ...data } as any, {
                  onSuccess: () => { setEditing(null); toast.success(t("toast.saved")); },
                  onError: (e) => toast.error(e.message),
                })}
                onCancel={() => setEditing(null)}
                onDelete={() => deleteTrip.mutate(editing.id, {
                  onSuccess: () => { setEditing(null); toast.success(t("toast.trip_deleted")); },
                  onError: (e) => toast.error(e.message),
                })}
              />
            )}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      <Fab onClick={() => setAdding(true)} label={t("page.trip_add")} />
    </div>
  );
}
