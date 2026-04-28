"use client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { paper, fontMono, fontSerif } from "@/lib/paper-theme";
import { useT } from "@/components/locale-provider";
import { useReservations, Card, Perf } from "./_shared";
import { toast } from "sonner";
import { CarBadge } from "@/components/car-badge";

// ── INBOX ─────────────────────────────────────────────────────
export default function AdminInboxPage() {
  const t = useT();
  const qc = useQueryClient();
  const { data: reservations = [] } = useReservations();
  const pending = reservations.filter((r) => r.status === "pending");

  const approve = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: "confirmed" | "rejected" }) => {
      const res = await fetch(`/api/reservations/${id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error("Failed");
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["reservations"] }); },
  });

  if (pending.length === 0) {
    return (
      <div style={{ padding: "32px 20px", textAlign: "center" }}>
        <div style={{ fontFamily: fontMono, fontSize: 11, color: paper.inkMute, letterSpacing: 1, textTransform: "uppercase" }}>
          {t("admin.inbox_empty")}
        </div>
        <div style={{ fontFamily: fontSerif, fontSize: 32, marginTop: 8 }}>✓</div>
      </div>
    );
  }

  return (
    <div style={{ padding: "16px" }}>
      {pending.map((r) => (
        <Card key={r.id}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 12 }}>
            <CarBadge short={r.car_short ?? "?"} style={{ padding: "8px 10px" }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: fontSerif, fontSize: 16, fontWeight: 700, color: paper.ink }}>{r.person_name}</div>
              <div style={{ fontFamily: fontMono, fontSize: 10, color: paper.inkDim, letterSpacing: 1, marginTop: 2 }}>
                {r.start_date}{r.start_date !== r.end_date ? ` → ${r.end_date}` : ""}
              </div>
              {r.note && <div style={{ fontFamily: fontMono, fontSize: 10, color: paper.inkDim, marginTop: 4 }}>{r.note}</div>}
            </div>
            <div style={{
              fontFamily: fontMono, fontSize: 8, fontWeight: 700, letterSpacing: 1,
              color: paper.amber, border: `1px solid ${paper.amber}`, padding: "2px 6px",
              textTransform: "uppercase",
            }}>
              {t("admin.pending_badge")}
            </div>
          </div>
          <Perf margin="8px 0" />
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={() => approve.mutate({ id: r.id, status: "confirmed" }, { onSuccess: () => toast.success(t("toast.reservation_confirmed")) })}
              style={{
                flex: 1, padding: "10px", background: paper.green, color: paper.paper,
                border: "none", cursor: "pointer", fontFamily: fontMono, fontSize: 10,
                fontWeight: 700, letterSpacing: 2, textTransform: "uppercase",
              }}>
              {t("admin.confirm")}
            </button>
            <button
              onClick={() => approve.mutate({ id: r.id, status: "rejected" }, { onSuccess: () => toast.success(t("toast.reservation_rejected")) })}
              style={{
                flex: 1, padding: "10px", background: "transparent", color: paper.accent,
                border: `1.5px solid ${paper.accent}`, cursor: "pointer", fontFamily: fontMono,
                fontSize: 10, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase",
              }}>
              {t("admin.reject")}
            </button>
          </div>
        </Card>
      ))}
    </div>
  );
}
