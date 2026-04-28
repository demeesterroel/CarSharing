"use client";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { paper, fontMono, fontSerif } from "@/lib/paper-theme";
import { useT } from "@/components/locale-provider";
import type { KmGap, ZeroKmTrip } from "@/lib/queries/admin";
import { useAdminSummary, usePeople, Card } from "../_shared";
import { useCreateTrip } from "@/hooks/use-trips";
import { toast } from "sonner";
import { CarBadge } from "@/components/car-badge";

// ── Helpers ───────────────────────────────────────────────────
function groupByYear<T extends { date?: string; after_date?: string }>(items: T[]): [string, T[]][] {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const year = (item.after_date ?? item.date ?? "").slice(0, 4) || "?";
    if (!map.has(year)) map.set(year, []);
    map.get(year)!.push(item);
  }
  return Array.from(map.entries()).sort((a, b) => b[0].localeCompare(a[0]));
}

function SectionLabel({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ fontFamily: fontMono, fontSize: 9, color: paper.inkDim, letterSpacing: 2, textTransform: "uppercase", marginBottom: 8, marginTop: 4, ...style }}>
      {children}
    </div>
  );
}

function YearGroup({ year, children }: { year: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 4 }}>
      <div style={{
        fontFamily: fontMono, fontSize: 9, fontWeight: 700, color: paper.ink,
        letterSpacing: 2, textTransform: "uppercase",
        padding: "6px 0 4px", borderTop: `1px dashed ${paper.paperDark}`, marginBottom: 6,
      }}>
        {year}
      </div>
      {children}
    </div>
  );
}

// ── Data Hygiene Page ─────────────────────────────────────────
export default function AdminHygienePage() {
  const t = useT();
  const qc = useQueryClient();
  const year = new Date().getFullYear();
  const { data } = useAdminSummary(year);
  const { data: people = [] } = usePeople();
  const createTrip = useCreateTrip();
  const gaps = data?.kmGaps ?? [];
  const zeroKmTrips = data?.zeroKmTrips ?? [];
  const [expandedGap, setExpandedGap] = useState<string | null>(null);

  const gapKey = (gap: KmGap) => `${gap.car_short}-${gap.after_trip_id}-${gap.before_trip_id}`;

  const activeMembers = people.filter((p) => p.active);

  const assignGap = (gap: KmGap, personId: number) => {
    const d1 = new Date(gap.after_date);
    const d2 = new Date(gap.before_date);
    const date = new Date((d1.getTime() + d2.getTime()) / 2).toISOString().slice(0, 10);
    createTrip.mutate(
      { person_id: personId, car_id: gap.car_id, date, start_odometer: gap.after_end, end_odometer: gap.before_start, location: null },
      {
        onSuccess: () => {
          qc.invalidateQueries({ queryKey: ["admin-summary"] });
          setExpandedGap(null);
          toast.success(t("admin.gap_assigned"));
        },
        onError: (e) => toast.error(e.message),
      },
    );
  };

  const gapsByYear = groupByYear(gaps);
  const zeroByYear = groupByYear(zeroKmTrips);

  return (
    <div style={{ padding: "16px" }}>
      <SectionLabel>
        <span>{t("admin.km_gaps_title")}</span>
        {gaps.length > 0 && (
          <span style={{ float: "right", color: paper.accent }}>{gaps.length} {t("admin.gaps_count")}</span>
        )}
      </SectionLabel>

      {gaps.length === 0 ? (
        <Card>
          <div style={{ textAlign: "center", padding: "16px 0" }}>
            <div style={{ fontFamily: fontSerif, fontSize: 28 }}>✓</div>
            <div style={{ fontFamily: fontMono, fontSize: 10, color: paper.inkMute, marginTop: 8, letterSpacing: 1 }}>
              {t("admin.no_gaps")}
            </div>
          </div>
        </Card>
      ) : (
        gapsByYear.map(([yr, items]) => (
          <YearGroup key={yr} year={yr}>
            {items.map((gap) => {
              const key = gapKey(gap);
              const expanded = expandedGap === key;
              return (
                <Card
                  key={key}
                  style={{ borderLeft: `3px solid ${paper.accent}`, marginBottom: 8, cursor: "pointer", paddingBottom: expanded ? 14 : 18 }}
                  onClick={() => setExpandedGap(expanded ? null : key)}
                >
                  <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                    <CarBadge short={gap.car_short} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontFamily: fontSerif, fontSize: 16, fontWeight: 700, color: paper.ink, lineHeight: 1.1 }}>
                        {gap.missing_km.toLocaleString("nl-BE")} km {t("admin.km_missing_suffix")}
                      </div>
                      <div style={{ fontFamily: fontMono, fontSize: 9, color: paper.inkDim, letterSpacing: 1, marginTop: 3 }}>
                        {gap.after_date} – {gap.before_date}
                      </div>
                      <div style={{ marginTop: 8 }}>
                        <div style={{ fontFamily: fontMono, fontSize: 10, color: paper.inkDim }}>
                          ↑ {gap.after_end.toLocaleString("nl-BE")} km ({gap.after_person})
                        </div>
                        <div style={{ fontFamily: fontMono, fontSize: 10, color: paper.accent, fontWeight: 700 }}>
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
                      style={{ marginTop: 14, borderTop: `1px dashed ${paper.paperDark}`, paddingTop: 12 }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div style={{ fontFamily: fontMono, fontSize: 9, color: paper.inkDim, letterSpacing: 2, textTransform: "uppercase", marginBottom: 8 }}>
                        {t("admin.assign_to")}
                      </div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                        {activeMembers.map((person) => (
                          <button
                            key={person.id}
                            onClick={() => assignGap(gap, person.id)}
                            disabled={createTrip.isPending}
                            style={{
                              fontFamily: fontMono, fontSize: 9, fontWeight: 700,
                              letterSpacing: 1, textTransform: "uppercase",
                              padding: "5px 10px",
                              background: "transparent", color: paper.ink,
                              border: `1.5px dashed ${paper.ink}`,
                              cursor: "pointer",
                              opacity: createTrip.isPending ? 0.5 : 1,
                            }}
                          >
                            {person.name.split(" ")[0]}
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

      <SectionLabel style={{ marginTop: 20 }}>{t("admin.zero_km_title")}</SectionLabel>

      {zeroKmTrips.length === 0 ? (
        <Card>
          <div style={{ textAlign: "center", padding: "8px 0", fontFamily: fontMono, fontSize: 10, color: paper.inkMute, letterSpacing: 1 }}>
            {t("admin.no_zero_km")}
          </div>
        </Card>
      ) : (
        zeroByYear.map(([yr, items]) => (
          <YearGroup key={yr} year={yr}>
            {items.map((trip) => (
              <Card key={trip.id} style={{ borderLeft: `3px solid ${paper.amber}`, marginBottom: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ fontFamily: fontMono, fontSize: 11, fontWeight: 700, color: paper.ink }}>{trip.car_short}</div>
                  <div style={{ fontFamily: fontMono, fontSize: 9, color: paper.inkDim, letterSpacing: 1 }}>#{trip.id}</div>
                </div>
                <div style={{ fontFamily: fontMono, fontSize: 10, color: paper.inkDim, marginTop: 4 }}>
                  {trip.person_name} · {trip.date}
                </div>
              </Card>
            ))}
          </YearGroup>
        ))
      )}
    </div>
  );
}
