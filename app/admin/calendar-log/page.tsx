"use client";
import { fontMono, fontSerif, paper } from "@/lib/paper-theme";
import { useQuery } from "@tanstack/react-query";
import { Card } from "../_shared";

interface SyncLogRow {
  id: number;
  created_at: string;
  direction: string;
  action: string;
  reservation_id: number | null;
  google_event_id: string | null;
  ok: number;
  detail: string | null;
}

const labelStyle: React.CSSProperties = {
  fontFamily: fontMono,
  fontSize: 9,
  fontWeight: 700,
  letterSpacing: 1,
  textTransform: "uppercase",
  color: paper.inkMute,
};

export default function CalendarLogPage() {
  const { data, isLoading, refetch, isFetching } = useQuery<SyncLogRow[]>({
    queryKey: ["admin", "calendar-log"],
    queryFn: () => fetch("/api/admin/calendar-log").then((r) => r.json()),
    refetchInterval: 15000,
  });

  return (
    <div style={{ padding: "12px 0 40px" }}>
      <Card>
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            justifyContent: "space-between",
            marginBottom: 6,
          }}
        >
          <div style={{ fontFamily: fontSerif, fontSize: 16, color: paper.ink }}>
            Calendar sync log
          </div>
          <button
            type="button"
            onClick={() => refetch()}
            disabled={isFetching}
            style={{
              fontFamily: fontMono,
              fontSize: 9,
              fontWeight: 700,
              letterSpacing: 2,
              textTransform: "uppercase",
              background: "none",
              color: isFetching ? paper.inkMute : paper.inkDim,
              border: `1px solid ${paper.paperDark}`,
              padding: "5px 10px",
              cursor: isFetching ? "default" : "pointer",
            }}
          >
            {isFetching ? "…" : "Refresh"}
          </button>
        </div>
        <div
          style={{
            fontFamily: fontMono,
            fontSize: 10,
            color: paper.inkMute,
            lineHeight: 1.5,
            marginBottom: 12,
          }}
        >
          Last 200 Google Calendar 2-way sync events (newest first, auto-refresh 15s). Times are
          UTC. <strong>outbound</strong> = app → Google, <strong>inbound</strong> = Google → app.
        </div>

        {isLoading && <div style={labelStyle}>Loading…</div>}
        {!isLoading && (!data || data.length === 0) && (
          <div style={labelStyle}>No sync events logged yet.</div>
        )}

        {data && data.length > 0 && (
          <div style={{ overflowX: "auto" }}>
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                fontFamily: fontMono,
                fontSize: 10,
              }}
            >
              <thead>
                <tr style={{ textAlign: "left", color: paper.inkMute }}>
                  <th style={thStyle}>Time (UTC)</th>
                  <th style={thStyle}>Dir</th>
                  <th style={thStyle}>Action</th>
                  <th style={thStyle}>Res</th>
                  <th style={thStyle}>Event</th>
                  <th style={thStyle}>Detail</th>
                </tr>
              </thead>
              <tbody>
                {data.map((row) => (
                  <tr
                    key={row.id}
                    style={{ borderTop: `1px solid ${paper.paperDark}`, verticalAlign: "top" }}
                  >
                    <td style={{ ...tdStyle, whiteSpace: "nowrap", color: paper.inkDim }}>
                      {row.created_at}
                    </td>
                    <td style={{ ...tdStyle, color: paper.inkMute }}>{row.direction}</td>
                    <td
                      style={{
                        ...tdStyle,
                        fontWeight: 700,
                        color: row.ok ? paper.ink : paper.accent,
                        whiteSpace: "nowrap",
                      }}
                    >
                      {row.ok ? "" : "⚠ "}
                      {row.action}
                    </td>
                    <td style={tdStyle}>{row.reservation_id ?? "—"}</td>
                    <td style={{ ...tdStyle, color: paper.inkMute }}>
                      {row.google_event_id ? "…" + row.google_event_id.slice(-6) : "—"}
                    </td>
                    <td style={{ ...tdStyle, color: paper.inkDim, wordBreak: "break-word" }}>
                      {formatDetail(row.detail)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

const thStyle: React.CSSProperties = {
  padding: "4px 8px 6px 0",
  fontWeight: 700,
  letterSpacing: 0.5,
  textTransform: "uppercase",
  fontSize: 9,
};

const tdStyle: React.CSSProperties = {
  padding: "5px 8px 5px 0",
};

function formatDetail(detail: string | null): string {
  if (!detail) return "";
  try {
    const obj = JSON.parse(detail) as Record<string, unknown>;
    return Object.entries(obj)
      .filter(([, v]) => v !== null && v !== undefined && v !== "")
      .map(([k, v]) => `${k}=${typeof v === "object" ? JSON.stringify(v) : String(v)}`)
      .join("  ");
  } catch {
    return detail;
  }
}
