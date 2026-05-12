"use client";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { paper, fontMono, fontSerif } from "@/lib/paper-theme";
import { useT } from "@/components/locale-provider";
import {
  useReservations,
  useOwnerCarShorts,
  useAdminSummary,
  usePeople,
  Card,
  Perf,
} from "./_shared";
import { toast } from "sonner";
import { CarBadge } from "@/components/car-badge";
import { apiFetch } from "@/lib/api/client";
import { useCreateTrip } from "@/hooks/use-trips";
import type { KmGap } from "@/lib/queries/admin";
import { shortNameOf } from "@/lib/person-utils";
import { ShimmerBar, shimmerKeyframes } from "@/components/shimmer";

function groupByYear<T extends { date?: string; after_date?: string }>(
  items: T[]
): [string, T[]][] {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const year = (item.after_date ?? item.date ?? "").slice(0, 4) || "?";
    if (!map.has(year)) map.set(year, []);
    map.get(year)!.push(item);
  }
  return Array.from(map.entries()).sort((a, b) => b[0].localeCompare(a[0]));
}

function YearGroup({ year, count, totalKm, children }: { year: string; count: number; totalKm: number; children: React.ReactNode }) {
  const t = useT();
  return (
    <div style={{ marginBottom: 4 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          fontFamily: fontMono,
          fontSize: 9,
          fontWeight: 700,
          color: paper.ink,
          letterSpacing: 2,
          textTransform: "uppercase",
          padding: "6px 0 4px",
          borderTop: `1px dashed ${paper.paperDark}`,
          marginBottom: 6,
        }}
      >
        <span>{year}</span>
        <span>{count} {t("admin.gaps_noun")} · {totalKm.toLocaleString("nl-BE")} km</span>
      </div>
      {children}
    </div>
  );
}

function SectionHeader({
  label,
  count,
  countSuffix,
  totalKm,
  isLoading,
}: {
  label: string;
  count: number;
  countSuffix: string;
  totalKm?: number;
  isLoading?: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        fontFamily: fontMono,
        fontSize: 9,
        fontWeight: 700,
        letterSpacing: 2,
        textTransform: "uppercase",
        color: paper.inkDim,
        marginBottom: 8,
        marginTop: 4,
      }}
    >
      <span>{label}</span>
      {isLoading ? (
        <ShimmerBar width={40} height={12} />
      ) : (
        count > 0 && (
          <span style={{ color: paper.accent }}>
            {count} {countSuffix}{totalKm != null ? ` · ${totalKm.toLocaleString("nl-BE")} km` : ""}
          </span>
        )
      )}
    </div>
  );
}

function InboxCardSkeleton() {
  return (
    <Card style={{ marginBottom: 8 }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 12 }}>
        <ShimmerBar width={42} height={24} />
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 7 }}>
          <ShimmerBar width="55%" height={16} />
          <ShimmerBar width="70%" height={10} />
        </div>
        <ShimmerBar width={60} height={14} />
      </div>
      <Perf margin="8px 0" />
      <div style={{ display: "flex", gap: 8 }}>
        <ShimmerBar width="50%" height={38} />
        <ShimmerBar width="50%" height={38} />
      </div>
    </Card>
  );
}

function GapCardSkeleton() {
  return (
    <Card style={{ borderLeft: `3px solid ${paper.paperDark}`, marginBottom: 8 }}>
      <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
        <ShimmerBar width={42} height={24} />
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 7 }}>
          <ShimmerBar width="60%" height={16} />
          <ShimmerBar width="75%" height={9} />
          <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 5 }}>
            <ShimmerBar width="80%" height={10} />
            <ShimmerBar width="65%" height={10} />
            <ShimmerBar width="78%" height={10} />
          </div>
        </div>
      </div>
    </Card>
  );
}

// ── INBOX ─────────────────────────────────────────────────────
export default function AdminInboxPage() {
  const t = useT();
  const qc = useQueryClient();
  const year = new Date().getFullYear();

  const { data: reservations = [], isLoading: isResLoading } = useReservations();
  const ownerCarShorts = useOwnerCarShorts();
  const { data: adminData, isLoading: isAdminLoading } = useAdminSummary(year);
  const { data: people = [] } = usePeople();
  const createTrip = useCreateTrip();

  const pending = reservations
    .filter((r) => r.status === "pending")
    .filter((r) => !ownerCarShorts || ownerCarShorts.has(r.car_short ?? ""));

  const gaps = (adminData?.kmGaps ?? []).filter(
    (g) => !ownerCarShorts || ownerCarShorts.has(g.car_short)
  );

  const [expandedGap, setExpandedGap] = useState<string | null>(null);

  const gapKey = (gap: KmGap) => `${gap.car_short}-${gap.after_trip_id}-${gap.before_trip_id}`;

  const activeMembers = people.filter((p) => p.active);

  const approve = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: "confirmed" | "rejected" }) => {
      await apiFetch(`/api/reservations/${id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["reservations"] });
    },
  });

  const assignGap = (gap: KmGap, personId: number) => {
    const d1 = new Date(gap.after_date);
    const d2 = new Date(gap.before_date);
    const date = new Date((d1.getTime() + d2.getTime()) / 2).toISOString().slice(0, 10);
    createTrip.mutate(
      {
        person_id: personId,
        car_id: gap.car_id,
        date,
        start_odometer: gap.after_end,
        end_odometer: gap.before_start,
        location: null,
      },
      {
        onSuccess: () => {
          qc.invalidateQueries({ queryKey: ["admin-summary"] });
          setExpandedGap(null);
          toast.success(t("admin.gap_assigned"));
        },
        onError: (e) => toast.error(e.message),
      }
    );
  };

  const gapsByYear = groupByYear(gaps);

  return (
    <div style={{ padding: "16px" }}>
      <style>{shimmerKeyframes}</style>

      {/* ── Open reservations ─────────────────────────────── */}
      <SectionHeader
        label={t("admin.sub_inbox")}
        count={pending.length}
        countSuffix={t("admin.pending_badge").toLowerCase()}
        isLoading={isResLoading}
      />

      {isResLoading ? (
        <div data-testid="admin-inbox-skeleton">
          {Array.from({ length: 2 }).map((_, i) => (
            <InboxCardSkeleton key={i} />
          ))}
        </div>
      ) : pending.length === 0 ? (
        <div
          style={{
            padding: "12px 0 4px",
            textAlign: "center",
            fontFamily: fontMono,
            fontSize: 10,
            color: paper.inkDim,
            letterSpacing: 1,
          }}
        >
          {t("admin.inbox_empty")}
        </div>
      ) : (
        pending.map((r) => (
          <Card key={r.id} style={{ marginBottom: 8 }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 12 }}>
              <CarBadge short={r.car_short ?? "?"} />
              <div style={{ flex: 1 }}>
                <div
                  style={{ fontFamily: fontSerif, fontSize: 16, fontWeight: 700, color: paper.ink }}
                >
                  {r.person_name}
                </div>
                <div
                  style={{
                    fontFamily: fontMono,
                    fontSize: 10,
                    color: paper.inkDim,
                    letterSpacing: 1,
                    marginTop: 2,
                  }}
                >
                  {r.start_date}
                  {r.start_date !== r.end_date ? ` → ${r.end_date}` : ""}
                </div>
                {r.note && (
                  <div
                    style={{
                      fontFamily: fontMono,
                      fontSize: 10,
                      color: paper.inkDim,
                      marginTop: 4,
                    }}
                  >
                    {r.note}
                  </div>
                )}
              </div>
              <div
                style={{
                  fontFamily: fontMono,
                  fontSize: 8,
                  fontWeight: 700,
                  letterSpacing: 1,
                  color: paper.amber,
                  border: `1px solid ${paper.amber}`,
                  padding: "2px 6px",
                  textTransform: "uppercase",
                }}
              >
                {t("admin.pending_badge")}
              </div>
            </div>
            <Perf margin="8px 0" />
            <div style={{ display: "flex", gap: 8 }}>
              <button
                onClick={() =>
                  approve.mutate(
                    { id: r.id, status: "confirmed" },
                    { onSuccess: () => toast.success(t("toast.reservation_confirmed")) }
                  )
                }
                style={{
                  flex: 1,
                  padding: "10px",
                  background: paper.green,
                  color: paper.paper,
                  border: "none",
                  cursor: "pointer",
                  fontFamily: fontMono,
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: 2,
                  textTransform: "uppercase",
                }}
              >
                {t("admin.confirm")}
              </button>
              <button
                onClick={() =>
                  approve.mutate(
                    { id: r.id, status: "rejected" },
                    { onSuccess: () => toast.success(t("toast.reservation_rejected")) }
                  )
                }
                style={{
                  flex: 1,
                  padding: "10px",
                  background: "transparent",
                  color: paper.accent,
                  border: `1.5px solid ${paper.accent}`,
                  cursor: "pointer",
                  fontFamily: fontMono,
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: 2,
                  textTransform: "uppercase",
                }}
              >
                {t("admin.reject")}
              </button>
            </div>
          </Card>
        ))
      )}

      {/* ── Divider ───────────────────────────────────────── */}
      <Perf margin="20px 0 16px" />

      {/* ── Odometer gaps ─────────────────────────────────── */}
      <SectionHeader
        label={t("admin.km_gaps_title")}
        count={gaps.length}
        countSuffix={t("admin.gaps_noun")}
        totalKm={gaps.reduce((s, g) => s + g.missing_km, 0)}
        isLoading={isAdminLoading}
      />

      {isAdminLoading ? (
        <div data-testid="admin-gaps-skeleton">
          {Array.from({ length: 3 }).map((_, i) => (
            <GapCardSkeleton key={i} />
          ))}
        </div>
      ) : gaps.length === 0 ? (
        <div
          style={{
            padding: "12px 0 4px",
            textAlign: "center",
            fontFamily: fontMono,
            fontSize: 10,
            color: paper.inkDim,
            letterSpacing: 1,
          }}
        >
          {t("admin.no_gaps")}
        </div>
      ) : (
        gapsByYear.map(([yr, items]) => (
          <YearGroup key={yr} year={yr} count={items.length} totalKm={items.reduce((s, g) => s + g.missing_km, 0)}>
            {items.map((gap) => {
              const key = gapKey(gap);
              const expanded = expandedGap === key;
              return (
                <Card
                  key={key}
                  style={{
                    borderLeft: `3px solid ${paper.accent}`,
                    marginBottom: 8,
                    cursor: "pointer",
                    paddingBottom: expanded ? 14 : 18,
                  }}
                  onClick={() => setExpandedGap(expanded ? null : key)}
                >
                  <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                    <CarBadge short={gap.car_short} />
                    <div style={{ flex: 1 }}>
                      <div
                        style={{
                          fontFamily: fontSerif,
                          fontSize: 16,
                          fontWeight: 700,
                          color: paper.ink,
                          lineHeight: 1.1,
                        }}
                      >
                        {gap.missing_km.toLocaleString("nl-BE")} km {t("admin.km_missing_suffix")}
                      </div>
                      <div
                        style={{
                          fontFamily: fontMono,
                          fontSize: 9,
                          color: paper.inkDim,
                          letterSpacing: 1,
                          marginTop: 3,
                        }}
                      >
                        {gap.after_date} – {gap.before_date}
                      </div>
                      <div style={{ marginTop: 8 }}>
                        <div style={{ fontFamily: fontMono, fontSize: 10, color: paper.inkDim }}>
                          ↑ {gap.after_end.toLocaleString("nl-BE")} km ({gap.after_person})
                        </div>
                        <div
                          style={{
                            fontFamily: fontMono,
                            fontSize: 10,
                            color: paper.accent,
                            fontWeight: 700,
                          }}
                        >
                          ? ...{gap.missing_km.toLocaleString("nl-BE")} km gap...
                        </div>
                        <div style={{ fontFamily: fontMono, fontSize: 10, color: paper.inkDim }}>
                          ↓ {gap.before_start.toLocaleString("nl-BE")} km ({gap.before_person})
                        </div>
                      </div>
                    </div>
                  </div>

                  {expanded && (
                    <div
                      style={{
                        marginTop: 14,
                        borderTop: `1px dashed ${paper.paperDark}`,
                        paddingTop: 12,
                      }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div
                        style={{
                          fontFamily: fontMono,
                          fontSize: 9,
                          color: paper.inkDim,
                          letterSpacing: 2,
                          textTransform: "uppercase",
                          marginBottom: 8,
                        }}
                      >
                        {t("admin.assign_to")}
                      </div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                        {activeMembers.map((person) => (
                          <button
                            key={person.id}
                            onClick={() => assignGap(gap, person.id)}
                            disabled={createTrip.isPending}
                            style={{
                              fontFamily: fontMono,
                              fontSize: 9,
                              fontWeight: 700,
                              letterSpacing: 1,
                              textTransform: "uppercase",
                              padding: "5px 10px",
                              background: "transparent",
                              color: paper.ink,
                              border: `1.5px dashed ${paper.ink}`,
                              cursor: "pointer",
                              opacity: createTrip.isPending ? 0.5 : 1,
                            }}
                          >
                            {shortNameOf(person)}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </Card>
              );
            })}
          </YearGroup>
        ))
      )}
    </div>
  );
}
