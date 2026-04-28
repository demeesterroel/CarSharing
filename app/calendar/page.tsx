"use client";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useOnlineState } from "@/lib/offline/online-state";
import { PageHeader } from "@/components/page-header";
import { ReservationForm } from "./reservation-form";
import {
  useReservations,
  useCreateReservation,
  useUpdateReservation,
  useDeleteReservation,
} from "@/hooks/use-reservations";
import { useCars } from "@/hooks/use-cars";
import type { Reservation, Car } from "@/types";
import { paper, fontMono, fontSerif } from "@/lib/paper-theme";
import { useT } from "@/components/locale-provider";
import { ReservationCard } from "@/components/reservation-card";
import { PickCalendar } from "@/components/pick-calendar";
import { CarBadge } from "@/components/car-badge";

// ── Bottom Sheet ──────────────────────────────────────────────
function BottomSheet({
  open,
  onClose,
  children,
}: {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
}) {
  if (!open) return null;
  return (
    <>
      <div
        onClick={onClose}
        style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 40,
        }}
      />
      <div
        style={{
          position: "fixed", left: 0, right: 0, bottom: 0,
          background: paper.paper,
          borderRadius: "16px 16px 0 0",
          zIndex: 50,
          maxHeight: "92vh",
          overflowY: "auto",
          maxWidth: 480,
          margin: "0 auto",
          animation: "slideUp 0.2s ease",
        }}
      >
        {children}
      </div>
      <style>{`@keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }`}</style>
    </>
  );
}

// ── Car Timeline ──────────────────────────────────────────────
function CarTimeline({
  car,
  reservations,
  onPickDone,
}: {
  car: Car;
  reservations: Reservation[];
  onPickDone: (carId: number, from: string, to: string) => void;
}) {
  return (
    <div style={{
      background: paper.paper, marginBottom: 12, padding: "14px 14px 18px",
      boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
        <CarBadge short={car.short} active={!!car.active} />
        <div style={{ fontFamily: fontSerif, fontSize: 16, fontWeight: 700, color: paper.ink }}>
          {car.name}
        </div>
      </div>

      <PickCalendar
        reservations={reservations}
        carId={car.id}
        from={null}
        to={null}
        onRangePick={(from, to) => onPickDone(car.id, from, to)}
      />
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────
function CalendarContent() {
  const t = useT();
  const today = new Date().toISOString().slice(0, 10);

  const { data: reservations = [], isLoading } = useReservations();
  const { data: cars = [] } = useCars();
  const createR = useCreateReservation();
  const updateR = useUpdateReservation();
  const deleteR = useDeleteReservation();

  const activeCars = cars.filter((c) => c.active);

  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const actionParam = searchParams.get("action");
  const editIdParam = searchParams.get("edit");

  const sheet: "add" | "edit" | null =
    actionParam === "reserve" ? "add" : editIdParam ? "edit" : null;
  const editing = !isLoading && editIdParam
    ? reservations.find((r) => r.id === Number(editIdParam)) ?? null
    : null;

  // Refetch reservations whenever the new-reservation sheet opens online —
  // the conflict warning needs to see the freshest server state.
  const qc = useQueryClient();
  const { online } = useOnlineState();
  useEffect(() => {
    if (sheet === "add" && online) {
      qc.invalidateQueries({ queryKey: ["reservations"] });
    }
  }, [sheet, online, qc]);

  const [prefillCarId, setPrefillCarId] = useState<number | undefined>();
  const [prefillFrom, setPrefillFrom] = useState<string | undefined>();
  const [prefillTo, setPrefillTo] = useState<string | undefined>();

  const upcoming = useMemo(
    () =>
      reservations
        .filter((r) => r.status !== "rejected" && r.end_date >= today)
        .sort((a, b) => a.start_date.localeCompare(b.start_date)),
    [reservations, today]
  );

  const handlePickDone = (carId: number, from: string, to: string) => {
    if (!online) { toast.error(t("offline.mutation_blocked")); return; }
    setPrefillCarId(carId);
    setPrefillFrom(from);
    setPrefillTo(to);
    const params = new URLSearchParams(searchParams.toString());
    params.set("action", "reserve");
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  };

  const closeSheet = () => router.back();

  const openEdit = (r: Reservation) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("edit", String(r.id));
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  };

  if (isLoading) return (
    <div style={{ background: paper.paperDeep, minHeight: "100dvh" }}>
      <PageHeader title={t("page.reservations")} />
      <div style={{ padding: "32px 20px", fontFamily: fontMono, fontSize: 11, color: paper.inkMute, letterSpacing: 1 }}>
        {t("state.loading")}
      </div>
    </div>
  );

  return (
    <div style={{ background: paper.paperDeep, minHeight: "100dvh", paddingBottom: 80 }}>
      <PageHeader title={t("page.reservations")} />

      {/* Legend */}
      <div style={{
        display: "flex", gap: 16, flexWrap: "wrap",
        padding: "10px 16px",
        fontFamily: fontMono, fontSize: 9, letterSpacing: 1.5,
        textTransform: "uppercase", color: paper.inkDim,
        borderBottom: `1px solid ${paper.paperDark}`,
      }}>
        <span>□ {t("calendar.available")}</span>
        <span style={{ color: paper.ink }}>■ {t("calendar.confirmed")}</span>
        <span style={{ color: paper.amber }}>▦ {t("calendar.pending")}</span>
      </div>

      {/* Per-car 14-day timeline */}
      <div style={{ padding: "12px 12px 4px" }}>
        {activeCars.map((car) => (
          <CarTimeline
            key={car.id}
            car={car}
            reservations={reservations}
            onPickDone={handlePickDone}
          />
        ))}
      </div>

      {/* Upcoming list */}
      <div style={{ padding: "8px 16px 0" }}>
        <div style={{
          fontFamily: fontMono, fontSize: 10, color: paper.inkDim,
          letterSpacing: 2, textTransform: "uppercase",
          marginBottom: 10, borderTop: `1.5px dashed ${paper.ink}`, paddingTop: 12,
          display: "flex", justifyContent: "space-between", alignItems: "center",
        }}>
          <span>{t("calendar.upcoming")}</span>
          <button
            onClick={() => {
              if (!online) { toast.error(t("offline.mutation_blocked")); return; }
              setPrefillCarId(undefined);
              setPrefillFrom(undefined);
              setPrefillTo(undefined);
              const params = new URLSearchParams(searchParams.toString());
              params.set("action", "reserve");
              router.push(`${pathname}?${params.toString()}`, { scroll: false });
            }}
            style={{
              padding: "5px 12px", background: online ? paper.ink : paper.inkMute, color: paper.paper,
              border: "none", cursor: online ? "pointer" : "default",
              fontFamily: fontMono, fontSize: 9, fontWeight: 700,
              letterSpacing: 1.5, textTransform: "uppercase",
              opacity: online ? 1 : 0.45,
            }}
          >
            + {t("page.reservation_add")}
          </button>
        </div>

        {upcoming.length === 0 && (
          <div style={{ padding: "20px 0", textAlign: "center", fontFamily: fontMono, fontSize: 11, color: paper.inkMute, letterSpacing: 1 }}>
            {t("state.empty_reservations")}
          </div>
        )}
        {upcoming.map((r) => (
          <ReservationCard key={r.id} reservation={r} onClick={() => openEdit(r)} />
        ))}
      </div>

      {/* Add sheet */}
      <BottomSheet open={sheet === "add"} onClose={() => closeSheet()}>
        <div style={{ padding: "16px 20px 0", fontFamily: fontSerif, fontSize: 20, fontWeight: 700, color: paper.ink }}>
          {t("page.reservation_add")}
        </div>
        <ReservationForm
          defaultValues={prefillCarId !== undefined ? {
            car_id: prefillCarId,
            start_date: prefillFrom,
            end_date: prefillTo,
          } : undefined}
          onSubmit={(data) =>
            createR.mutate(data, {
              onSuccess: () => { closeSheet(); toast.success(t("toast.reservation_saved")); },
              onError: (e) => toast.error(e.message),
            })
          }
          onCancel={() => closeSheet()}
        />
      </BottomSheet>

      {/* Edit sheet */}
      <BottomSheet open={sheet === "edit" && !!editing} onClose={() => closeSheet()}>
        <div style={{ padding: "16px 20px 0", fontFamily: fontSerif, fontSize: 20, fontWeight: 700, color: paper.ink }}>
          {t("page.reservation_edit")}
        </div>
        {editing && (
          <>
            <ReservationForm
              defaultValues={editing}
              onSubmit={(data) =>
                updateR.mutate(
                  { id: editing.id, ...data },
                  {
                    onSuccess: () => { closeSheet(); toast.success(t("toast.saved")); },
                    onError: (e) => toast.error(e.message),
                  }
                )
              }
              onCancel={() => closeSheet()}
            />
            <div style={{ padding: "0 16px 24px" }}>
              <button
                onClick={() =>
                  deleteR.mutate(editing.id, {
                    onSuccess: () => { closeSheet(); toast.success(t("toast.deleted")); },
                    onError: (e) => toast.error(e.message),
                  })
                }
                style={{
                  width: "100%", padding: "10px", background: "transparent",
                  border: `1.5px solid ${paper.accent}`, color: paper.accent,
                  fontFamily: fontMono, fontSize: 10, fontWeight: 700,
                  letterSpacing: 2, textTransform: "uppercase", cursor: "pointer",
                }}
              >
                {t("action.delete")}
              </button>
            </div>
          </>
        )}
      </BottomSheet>
    </div>
  );
}

export default function CalendarPage() {
  return <Suspense><CalendarContent /></Suspense>;
}
