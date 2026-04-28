"use client";
import { Suspense } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { toast } from "sonner";
import * as Dialog from "@radix-ui/react-dialog";
import { PageHeader } from "@/components/page-header";
import { GroupedList } from "@/components/grouped-list";
import { Fab } from "@/components/fab";
import { TripForm } from "./trip-form";
import { useTrips, useCreateTrip, useUpdateTrip, useDeleteTrip } from "@/hooks/use-trips";
import { useMe } from "@/hooks/use-me";
import { useQueryParam } from "@/hooks/use-query-param";
import { YearSelect } from "@/components/year-select";
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

function TripsContent() {
  const t = useT();
  const { data: trips = [], isLoading } = useTrips();
  const { data: me } = useMe();
  const createTrip = useCreateTrip();
  const updateTrip = useUpdateTrip();
  const deleteTrip = useDeleteTrip();

  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  // Filter params (replace — no extra history entries)
  const [mineParam, setMineParam] = useQueryParam("mine", "");
  const [carFilter, setCarFilter] = useQueryParam("car", "");
  const [yearFilter, setYearFilter] = useQueryParam("year", "");

  // Modal params (push — history entries for back-button support)
  const actionParam = searchParams.get("action");
  const editIdParam = searchParams.get("edit");

  const adding = actionParam === "add";
  const editingId = editIdParam ? Number(editIdParam) : null;
  const editing = !isLoading && editingId ? trips.find((tr) => tr.id === editingId) ?? null : null;

  const isMine = mineParam === "true";
  const canFilter = me?.personId != null;
  const cars = Array.from(new Set(trips.map((tr) => tr.car_short).filter((s): s is string => !!s))).sort();
  const years = Array.from(new Set(trips.map((tr) => tr.date.slice(0, 4)))).sort().reverse();

  const visible = trips
    .filter((tr) => isMine && canFilter ? tr.person_id === me!.personId : true)
    .filter((tr) => carFilter ? tr.car_short === carFilter : true)
    .filter((tr) => yearFilter ? tr.date.startsWith(yearFilter) : true);

  const openAdd = () => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("action", "add");
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  };

  const openEdit = (trip: Trip) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("edit", String(trip.id));
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  };

  const closeModal = () => router.back();

  const filterBtnStyle = (active: boolean): React.CSSProperties => ({
    padding: "5px 12px",
    background: active ? paper.ink : "transparent",
    color: active ? paper.paper : paper.inkDim,
    border: `1.5px solid ${paper.ink}`,
    fontFamily: fontMono, fontSize: 9, fontWeight: 700, letterSpacing: 2,
    textTransform: "uppercase", cursor: "pointer",
  });

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
                <YearSelect value={yearFilter} onChange={setYearFilter} years={years} allLabel={t("filter.all")} />
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
        getKey={(trip) => trip.date.slice(0, 7)}
        getGroupLabel={(key) => fmtYearMonth(key + "-01")}
        getGroupTotal={(items) => items.reduce((s, trip) => s + trip.km, 0)}
        totalSuffix="km"
        renderItem={(trip) => (
          <button
            key={trip.id}
            onClick={() => openEdit(trip)}
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

      <Dialog.Root open={adding} onOpenChange={(open) => { if (!open) closeModal(); }}>
        <Dialog.Portal>
          <Dialog.Overlay style={overlayStyle} />
          <Dialog.Content style={sheetStyle} aria-describedby={undefined}>
            <Dialog.Title style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0,0,0,0)" }}>
              {t("page.trip_add")}
            </Dialog.Title>
            <TripForm
              onSubmit={(data) => createTrip.mutate(data as any, {
                onSuccess: () => { closeModal(); toast.success(t("toast.trip_saved")); },
                onError: (e) => toast.error(e.message),
              })}
              onCancel={closeModal}
            />
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      <Dialog.Root open={!!editing} onOpenChange={(open) => { if (!open) closeModal(); }}>
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
                  onSuccess: () => { closeModal(); toast.success(t("toast.saved")); },
                  onError: (e) => toast.error(e.message),
                })}
                onCancel={closeModal}
                onDelete={() => deleteTrip.mutate(editing.id, {
                  onSuccess: () => { closeModal(); toast.success(t("toast.trip_deleted")); },
                  onError: (e) => toast.error(e.message),
                })}
              />
            )}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      <Fab onClick={openAdd} label={t("page.trip_add")} />
    </div>
  );
}

export default function TripsPage() {
  return <Suspense><TripsContent /></Suspense>;
}
