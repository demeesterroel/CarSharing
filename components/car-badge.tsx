import { paper, fontMono } from "@/lib/paper-theme";

export function CarBadge({ short, active = true }: {
  short: string;
  active?: boolean;
}) {
  return (
    <div style={{
      padding: "6px 8px", background: active ? paper.ink : paper.inkMute, color: paper.paper,
      fontFamily: fontMono, fontSize: 11, fontWeight: 700, letterSpacing: 2,
      flexShrink: 0, minWidth: 42, textAlign: "center",
    }}>
      {short}
    </div>
  );
}
