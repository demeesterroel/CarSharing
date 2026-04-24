"use client";
import { useMemo, useState } from "react";
import { toast } from "sonner";
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
import { PickCalendar } from "@/components/pick-calendar";

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
        <div style={{
          padding: "5px 8px", background: car.active ? paper.ink : paper.inkMute, color: paper.paper,
          fontFamily: fontMono, fontSize: 11, fontWeight: 700, letterSpacing: 2, minWidth: 40, textAlign: "center",
        }}>
          {car.short}
        </div>
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

// ── Reservation list item ─────────────────────────────────────
function ResRow({
  r,
  onClick,
}: {
  r: Reservation;
  onClick: () => void;
}) {
  const isPending = r.status === "pending";
  const statusColor = r.status === "confirmed" ? paper.green
    : r.status === "rejected" ? paper.accent : paper.amber;

  return (
    <button
      onClick={onClick}
      style={{
        width: "100%", display: "flex", alignItems: "center", gap: 12,
        padding: "11px 14px", marginBottom: 8,
        background: isPending
          ? `repeating-linear-gradient(45deg, ${paper.paper} 0 6px, ${paper.paperDeep} 6px 10px)`
          : paper.paper,
        border: "none",
        borderLeft: `3px ${isPending ? "dashed" : "solid"} ${statusColor}`,
        boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
        cursor: "pointer", textAlign: "left",
      }}
    >
      <div style={{
        padding: "5px 7px", background: paper.ink, color: paper.paper,
        fontFamily: fontMono, fontSize: 11, fontWeight: 700, letterSpacing: 2,
        flexShrink: 0, minWidth: 38, textAlign: "center",
      }}>
        {r.car_short}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: fontSerif, fontSize: 15, fontWeight: 600, color: paper.ink, lineHeight: 1.2 }}>
          {r.person_name}
        </div>
        <div style={{ fontFamily: fontMono, fontSize: 10, color: paper.inkDim, letterSpacing: 1, marginTop: 2 }}>
          {r.start_date}{r.start_date !== r.end_date ? ` → ${r.end_date}` : ""}
        </div>
        {r.note && (
          <div style={{ fontFamily: fontMono, fontSize: 10, color: paper.inkMute, marginTop: 2 }}>
            {r.note}
          </div>
        )}
      </div>
      <div style={{
        padding: "3px 6px",
        background: statusColor,
        color: paper.paper,
        fontFamily: fontMono, fontSize: 9, fontWeight: 700,
        letterSpacing: 1, textTransform: "uppercase", flexShrink: 0,
      }}>
        {r.status === "confirmed" ? "✓" : r.status === "rejected" ? "✗" : "?"}
      </div>
    </button>
  );
}

// ── Main page ─────────────────────────────────────────────────
export default function CalendarPage() {
  const t = useT();
  const today = new Date().toISOString().slice(0, 10);

  const { data: reservations = [], isLoading } = useReservations();
  const { data: cars = [] } = useCars();
  const createR = useCreateReservation();
  const updateR = useUpdateReservation();
  const deleteR = useDeleteReservation();

  const activeCars = cars.filter((c) => c.active);

  const [sheet, setSheet] = useState<"add" | "edit" | null>(null);
  const [editing, setEditing] = useState<Reservation | null>(null);
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
    setPrefillCarId(carId);
    setPrefillFrom(from);
    setPrefillTo(to);
    setSheet("add");
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
            onClick={() => { setPrefillCarId(undefined); setPrefillFrom(undefined); setPrefillTo(undefined); setSheet("add"); }}
            style={{
              padding: "5px 12px", background: paper.ink, color: paper.paper,
              border: "none", cursor: "pointer",
              fontFamily: fontMono, fontSize: 9, fontWeight: 700,
              letterSpacing: 1.5, textTransform: "uppercase",
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
          <ResRow key={r.id} r={r} onClick={() => { setEditing(r); setSheet("edit"); }} />
        ))}
      </div>

      {/* Add sheet */}
      <BottomSheet open={sheet === "add"} onClose={() => setSheet(null)}>
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
              onSuccess: () => { setSheet(null); toast.success(t("toast.reservation_saved")); },
              onError: (e) => toast.error(e.message),
            })
          }
          onCancel={() => setSheet(null)}
        />
      </BottomSheet>

      {/* Edit sheet */}
      <BottomSheet open={sheet === "edit" && !!editing} onClose={() => setSheet(null)}>
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
                    onSuccess: () => { setSheet(null); toast.success(t("toast.saved")); },
                    onError: (e) => toast.error(e.message),
                  }
                )
              }
              onCancel={() => setSheet(null)}
            />
            <div style={{ padding: "0 16px 24px" }}>
              <button
                onClick={() =>
                  deleteR.mutate(editing.id, {
                    onSuccess: () => { setSheet(null); toast.success(t("toast.deleted")); },
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
