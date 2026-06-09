"use client";
import { CarBadge } from "@/components/car-badge";
import { ErrorBoundary } from "@/components/error-boundary";
import { Fab } from "@/components/fab";
import { useT } from "@/components/locale-provider";
import { PageHeader } from "@/components/page-header";
import { PickCalendar } from "@/components/pick-calendar";
import { ReservationCard } from "@/components/reservation-card";
import { useMe } from "@/hooks/use-me";
import {
  useCreateReservation,
  useDeleteReservation,
  useReservations,
  useUpdateReservation,
} from "@/hooks/use-reservations";
import { useCars } from "@/hooks/use-vehicles";
import { apiFetch } from "@/lib/api/client";
import {
  CALENDAR_NUDGE_DURATION,
  markCalendarNudgeSeen,
  shouldShowCalendarNudge,
} from "@/lib/calendar-nudge";
import { useOnlineState } from "@/lib/offline/online-state";
import { canEdit } from "@/lib/permissions";
import { fontMono, fontSerif, tokens } from "@/lib/theme-tokens";
import type { Car, Reservation } from "@/types";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarPlus } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { ReservationForm } from "./reservation-form";

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
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.4)",
          zIndex: 40,
        }}
      />
      <div
        style={{
          position: "fixed",
          left: 0,
          right: 0,
          bottom: 0,
          background: tokens.paper,
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
    <div
      style={{
        background: tokens.paper,
        marginBottom: 12,
        padding: "14px 14px 18px",
        boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
        <CarBadge short={car.short} active={!!car.active} />
        <div style={{ fontFamily: fontSerif, fontSize: 16, fontWeight: 700, color: tokens.ink }}>
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
  const { data: me } = useMe();
  const { data: calendarMeta } = useQuery<{ calendarId: string | null }>({
    queryKey: ["calendar-id"],
    queryFn: () => apiFetch("/api/calendar-id"),
  });
  const createR = useCreateReservation();
  const updateR = useUpdateReservation();
  const deleteR = useDeleteReservation();

  // One-time nudge: prompt the user to subscribe to the CarSharing calendar.
  // Fires on first /calendar visit; localStorage key cs.calendarNudgeSeen
  // persists the dismissal.
  useEffect(() => {
    const calendarId = calendarMeta?.calendarId;
    if (!calendarId) return;
    if (!shouldShowCalendarNudge(localStorage)) return;

    markCalendarNudgeSeen(localStorage);
    const subscribeUrl = `https://calendar.google.com/calendar/r?cid=${encodeURIComponent(calendarId)}`;
    toast(t("calendar.nudge_message"), {
      duration: CALENDAR_NUDGE_DURATION,
      action: {
        label: t("calendar.nudge_action"),
        onClick: () => {
          window.open(subscribeUrl, "_blank", "noopener,noreferrer");
        },
      },
    });
  }, [calendarMeta, t]);

  const activeCars = cars.filter((c) => c.active);

  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const actionParam = searchParams.get("action");
  const editIdParam = searchParams.get("edit");
  // ?reservation=<id> deep-link from notification bell
  const reservationParam = searchParams.get("reservation");
  // Resolve notification deep-link: treat ?reservation=<id> the same as ?edit=<id>
  const resolvedEditId = editIdParam ?? reservationParam;

  const sheet: "add" | "edit" | null =
    actionParam === "add" ? "add" : resolvedEditId ? "edit" : null;
  const editing =
    !isLoading && resolvedEditId
      ? (reservations.find((r) => r.id === Number(resolvedEditId)) ?? null)
      : null;

  const editingReadOnly =
    editing != null &&
    !(
      me?.personId != null &&
      canEdit(
        me.personId,
        me.isAdmin,
        editing,
        cars.find((c) => c.id === editing.car_id)?.owner_person_id ?? null
      )
    );

  const [sheetClosed, setSheetClosed] = useState(false);
  useEffect(() => {
    setSheetClosed(false);
  }, [editIdParam, actionParam, reservationParam]);

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
    if (!online) {
      toast.error(t("offline.mutation_blocked"));
      return;
    }
    setPrefillCarId(carId);
    setPrefillFrom(from);
    setPrefillTo(to);
    const params = new URLSearchParams(searchParams.toString());
    params.set("action", "add");
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  };

  const closeSheet = () => {
    setSheetClosed(true);
    window.history.replaceState(null, "", pathname);
  };

  const openAdd = () => {
    setPrefillCarId(undefined);
    setPrefillFrom(undefined);
    setPrefillTo(undefined);
    const params = new URLSearchParams(searchParams.toString());
    params.set("action", "add");
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  };

  const openEdit = (r: Reservation) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("edit", String(r.id));
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  };

  const subscribeButton = calendarMeta?.calendarId ? (
    <a
      href={`https://calendar.google.com/calendar/r?cid=${encodeURIComponent(calendarMeta.calendarId)}`}
      target="_blank"
      rel="noopener noreferrer"
      title={t("calendar.subscribe")}
      style={{ display: "flex", alignItems: "center", color: tokens.inkDim, padding: 4 }}
    >
      <CalendarPlus size={18} />
    </a>
  ) : null;

  if (isLoading)
    return (
      <div style={{ background: tokens.paperDeep, minHeight: "100dvh" }}>
        <PageHeader title={t("page.reservations")} right={subscribeButton} />
        <div
          style={{
            padding: "32px 20px",
            fontFamily: fontMono,
            fontSize: 11,
            color: tokens.inkDim,
            letterSpacing: 1,
          }}
        >
          {t("state.loading")}
        </div>
      </div>
    );

  return (
    <div style={{ background: tokens.paperDeep, minHeight: "100dvh", paddingBottom: 80 }}>
      <PageHeader title={t("page.reservations")} right={subscribeButton} />

      {/* Legend */}
      <div
        style={{
          display: "flex",
          gap: 16,
          flexWrap: "wrap",
          padding: "10px 16px",
          fontFamily: fontMono,
          fontSize: 9,
          letterSpacing: 1.5,
          textTransform: "uppercase",
          color: tokens.inkDim,
          borderBottom: `1px solid ${tokens.paperDark}`,
        }}
      >
        <span>□ {t("calendar.available")}</span>
        <span style={{ color: tokens.ink }}>■ {t("calendar.confirmed")}</span>
        <span style={{ color: tokens.amber }}>▦ {t("calendar.pending")}</span>
      </div>

      {/* Per-car 14-day timeline */}
      <div style={{ padding: "12px 0 4px" }}>
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
        <div
          style={{
            fontFamily: fontMono,
            fontSize: 10,
            color: tokens.inkDim,
            letterSpacing: 2,
            textTransform: "uppercase",
            marginBottom: 10,
            borderTop: `1.5px dashed ${tokens.ink}`,
            paddingTop: 12,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <span>{t("calendar.upcoming")}</span>
        </div>

        {upcoming.length === 0 && (
          <div
            style={{
              padding: "20px 0",
              textAlign: "center",
              fontFamily: fontMono,
              fontSize: 11,
              color: tokens.inkDim,
              letterSpacing: 1,
            }}
          >
            {t("state.empty_reservations")}
          </div>
        )}
        {upcoming.map((r) => (
          <ReservationCard key={r.id} reservation={r} onClick={() => openEdit(r)} />
        ))}
      </div>

      <Fab onClick={openAdd} label={t("page.reservation_add")} />

      {/* Add sheet */}
      <BottomSheet open={sheet === "add" && !sheetClosed} onClose={() => closeSheet()}>
        <ReservationForm
          defaultValues={
            prefillCarId !== undefined
              ? {
                  car_id: prefillCarId,
                  start_date: prefillFrom,
                  end_date: prefillTo,
                }
              : undefined
          }
          onSubmit={(data) =>
            createR.mutate(data, {
              onSuccess: () => {
                closeSheet();
                toast.success(t("toast.reservation_saved"));
              },
              onError: (e) => toast.error(e.message),
            })
          }
          onCancel={() => closeSheet()}
        />
      </BottomSheet>

      {/* Edit sheet */}
      <BottomSheet
        open={sheet === "edit" && !!editing && !sheetClosed}
        onClose={() => closeSheet()}
      >
        {editing && (
          <>
            <ReservationForm
              key={editing.id}
              defaultValues={editing}
              readOnly={editingReadOnly}
              onSubmit={(data) =>
                updateR.mutate(
                  { id: editing.id, ...data },
                  {
                    onSuccess: () => {
                      closeSheet();
                      toast.success(t("toast.saved"));
                    },
                    onError: (e) => toast.error(e.message),
                  }
                )
              }
              onCancel={() => closeSheet()}
            />
            {!editingReadOnly && (
              <div style={{ padding: "0 16px 24px" }}>
                <button
                  onClick={() =>
                    deleteR.mutate(editing.id, {
                      onSuccess: () => {
                        closeSheet();
                        toast.success(t("toast.deleted"));
                      },
                      onError: (e) => toast.error(e.message),
                    })
                  }
                  style={{
                    width: "100%",
                    padding: "10px",
                    background: "transparent",
                    border: `1.5px solid ${tokens.accent}`,
                    color: tokens.accent,
                    fontFamily: fontMono,
                    fontSize: 10,
                    fontWeight: 700,
                    letterSpacing: 2,
                    textTransform: "uppercase",
                    cursor: "pointer",
                  }}
                >
                  {t("action.delete")}
                </button>
              </div>
            )}
          </>
        )}
      </BottomSheet>
    </div>
  );
}

export default function CalendarPage() {
  return (
    <Suspense>
      <ErrorBoundary>
        <CalendarContent />
      </ErrorBoundary>
    </Suspense>
  );
}
