"use client";
import { Suspense } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { GroupedList } from "@/components/grouped-list";
import { Fab } from "@/components/fab";
import { ListFilterBar } from "@/components/list-filter-bar";
import { ModalSheet } from "@/components/modal-sheet";
import { TripForm } from "./trip-form";
import { useTrips, useCreateTrip, useUpdateTrip, useDeleteTrip } from "@/hooks/use-trips";
import { useMe } from "@/hooks/use-me";
import { useCars } from "@/hooks/use-vehicles";
import { canEdit } from "@/lib/permissions";
import { useQueryParam } from "@/hooks/use-query-param";
import { useEditModal } from "@/hooks/use-edit-modal";
import { paper, fontMono, fmtYearMonth } from "@/lib/paper-theme";
import { useT } from "@/components/locale-provider";
import { TripCard } from "@/components/trip-card";
import { ErrorBoundary } from "@/components/error-boundary";

function TripsContent() {
  const t = useT();
  const { data: trips = [], isLoading } = useTrips();
  const { data: me } = useMe();
  const { data: carList = [] } = useCars();
  const createTrip = useCreateTrip();
  const updateTrip = useUpdateTrip();
  const deleteTrip = useDeleteTrip();

  const [mineParam, setMineParam] = useQueryParam("mine", "");
  const [carFilter, setCarFilter] = useQueryParam("car", "");
  const [yearFilter, setYearFilter] = useQueryParam("year", "");

  const { adding, editingId, modalClosed, openAdd, openEdit, closeModal } = useEditModal();

  const editing =
    !isLoading && editingId ? (trips.find((tr) => tr.id === editingId) ?? null) : null;

  const editingReadOnly =
    editing != null &&
    !(
      me?.personId != null &&
      canEdit(
        me.personId,
        me.isAdmin,
        editing,
        carList.find((c) => c.id === editing.car_id)?.owner_person_id ?? null
      )
    );

  const isMine = mineParam === "true";
  const isOthers = mineParam === "false";
  const canFilter = me?.personId != null;
  const cars = Array.from(
    new Set(trips.map((tr) => tr.car_short).filter((s): s is string => !!s))
  ).sort();
  const years = Array.from(new Set(trips.map((tr) => tr.date.slice(0, 4))))
    .sort()
    .reverse();

  const visible = trips
    .filter((tr) => {
      if (isMine && canFilter) return tr.person_id === me!.personId;
      if (isOthers && canFilter) return tr.person_id !== me!.personId;
      return true;
    })
    .filter((tr) => (carFilter ? tr.car_short === carFilter : true))
    .filter((tr) => (yearFilter ? tr.date.startsWith(yearFilter) : true));

  if (isLoading)
    return (
      <div style={{ background: paper.paperDeep, minHeight: "100dvh" }}>
        <PageHeader title={t("page.trips")} />
        <div
          style={{
            padding: "32px 20px",
            fontFamily: fontMono,
            fontSize: 11,
            color: paper.inkDim,
            letterSpacing: 1,
          }}
        >
          {t("state.loading")}
        </div>
      </div>
    );

  return (
    <div style={{ background: paper.paperDeep, minHeight: "100dvh", paddingBottom: 80 }}>
      <PageHeader title={t("page.trips")} />

      <ListFilterBar
        canFilter={canFilter}
        isMine={isMine}
        cars={cars}
        carFilter={carFilter}
        years={years}
        yearFilter={yearFilter}
        onMineChange={setMineParam}
        onCarChange={setCarFilter}
        onYearChange={setYearFilter}
      />

      <GroupedList
        items={visible}
        getKey={(trip) => trip.date.slice(0, 7)}
        getGroupLabel={(key) => fmtYearMonth(key + "-01")}
        getGroupTotal={(items) => items.reduce((s, trip) => s + trip.km, 0)}
        totalSuffix="km"
        renderItem={(trip) => (
          <TripCard key={trip.id} trip={trip} onClick={() => openEdit(trip.id)} />
        )}
      />

      {visible.length === 0 && (
        <div
          style={{
            padding: "32px 20px",
            textAlign: "center",
            fontFamily: fontMono,
            fontSize: 11,
            color: paper.inkDim,
            letterSpacing: 1,
          }}
        >
          {t("state.empty_trips")}
        </div>
      )}

      <ModalSheet open={adding} onClose={closeModal} title={t("page.trip_add")}>
        <TripForm
          onSubmit={(data) =>
            createTrip.mutate(data as any, {
              onSuccess: () => {
                closeModal();
                toast.success(t("toast.trip_saved"));
              },
              onError: (e) => toast.error(e.message),
            })
          }
          onCancel={closeModal}
        />
      </ModalSheet>

      <ModalSheet open={!!editing && !modalClosed} onClose={closeModal} title={t("page.trip_edit")}>
        {editing && (
          <TripForm
            key={editing.id}
            defaultValues={editing}
            readOnly={editingReadOnly}
            onSubmit={(data) =>
              updateTrip.mutate({ id: editing.id, ...data } as any, {
                onSuccess: () => {
                  closeModal();
                  toast.success(t("toast.saved"));
                },
                onError: (e) => toast.error(e.message),
              })
            }
            onCancel={closeModal}
            onDelete={
              editingReadOnly
                ? undefined
                : () =>
                    deleteTrip.mutate(editing.id, {
                      onSuccess: () => {
                        closeModal();
                        toast.success(t("toast.trip_deleted"));
                      },
                      onError: (e) => toast.error(e.message),
                    })
            }
          />
        )}
      </ModalSheet>

      <Fab onClick={openAdd} label={t("page.trip_add")} />
    </div>
  );
}

export default function TripsPage() {
  return (
    <Suspense>
      <ErrorBoundary>
        <TripsContent />
      </ErrorBoundary>
    </Suspense>
  );
}
