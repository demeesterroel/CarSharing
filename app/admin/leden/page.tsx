"use client";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { paper, fontMono, fontSerif } from "@/lib/paper-theme";
import { useT } from "@/components/locale-provider";
import type { Person } from "@/types";
import { usePeople, Card } from "../_shared";
import { toast } from "sonner";

// ── Person Card ───────────────────────────────────────────────
function PersonCard({ person, onSave }: { person: Person; onSave: (p: Person) => void }) {
  const t = useT();
  const [disc, setDisc] = useState(person.discount);
  const [discLong, setDiscLong] = useState(person.discount_long);
  const [username, setUsername] = useState(person.username ?? "");
  const [isAdmin, setIsAdmin] = useState(person.is_admin === 1);
  const [inviteBanner, setInviteBanner] = useState<string | null>(null);

  const dirty =
    disc !== person.discount ||
    discLong !== person.discount_long ||
    username !== (person.username ?? "") ||
    isAdmin !== (person.is_admin === 1);

  const isActive = !!person.active;

  const handleInvite = async () => {
    try {
      const res = await fetch(`/api/people/${person.id}/invite`, { method: "POST" });
      if (!res.ok) throw new Error();
      const { url } = await res.json();
      await navigator.clipboard.writeText(url);
      setInviteBanner(t("admin.invite_copied"));
      setTimeout(() => setInviteBanner(null), 3000);
    } catch {
      setInviteBanner("Error generating invite");
      setTimeout(() => setInviteBanner(null), 3000);
    }
  };

  if (!isActive) {
    return (
      <Card style={{ opacity: 0.55, marginBottom: 8 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontFamily: fontSerif, fontSize: 17, fontWeight: 700, color: paper.inkDim }}>{person.name}</div>
          <button
            onClick={() => onSave({ ...person, active: 1 })}
            style={{
              padding: "5px 12px", background: "transparent", color: paper.green,
              border: `1.5px solid ${paper.green}`, cursor: "pointer",
              fontFamily: fontMono, fontSize: 9, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase",
            }}>
            {t("admin.activate")}
          </button>
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <div style={{ fontFamily: fontSerif, fontSize: 17, fontWeight: 700, color: paper.ink }}>{person.name}</div>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          {isAdmin && (
            <div style={{
              fontFamily: fontMono, fontSize: 9, color: paper.blue, fontWeight: 700,
              letterSpacing: 1, border: `1px solid ${paper.blue}`, padding: "2px 6px",
              textTransform: "uppercase",
            }}>Admin</div>
          )}
          {(disc > 0 || discLong > 0) && (
            <div style={{
              fontFamily: fontMono, fontSize: 9, color: paper.amber, fontWeight: 700,
              letterSpacing: 1, border: `1px solid ${paper.amber}`, padding: "2px 6px",
              textTransform: "uppercase",
            }}>{t("admin.discount_badge")}</div>
          )}
        </div>
      </div>

      {/* Login credentials */}
      <div style={{ marginBottom: 12, display: "flex", gap: 8, alignItems: "flex-end" }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: fontMono, fontSize: 9, color: paper.inkDim, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 4 }}>
            {t("admin.username_label")}
          </div>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder={t("admin.no_username")}
            style={{
              width: "100%", padding: "6px 8px",
              border: `1px solid ${paper.paperDark}`,
              background: paper.paperDeep,
              fontFamily: fontMono, fontSize: 12, color: paper.ink,
              outline: "none",
            }}
          />
        </div>
        <label style={{ display: "flex", alignItems: "center", gap: 6, paddingBottom: 6, cursor: "pointer" }}>
          <input
            type="checkbox"
            checked={isAdmin}
            onChange={(e) => setIsAdmin(e.target.checked)}
            style={{ accentColor: paper.blue, width: 14, height: 14 }}
          />
          <span style={{ fontFamily: fontMono, fontSize: 9, letterSpacing: 1.5, textTransform: "uppercase", color: paper.inkDim }}>
            {t("admin.is_admin_label")}
          </span>
        </label>
      </div>

      {/* Invite */}
      <div style={{ marginBottom: 12 }}>
        <button
          onClick={handleInvite}
          style={{
            padding: "7px 12px", background: "transparent",
            border: `1px dashed ${paper.inkDim}`, cursor: "pointer",
            fontFamily: fontMono, fontSize: 9, letterSpacing: 1.5, textTransform: "uppercase",
            color: paper.inkDim,
          }}>
          {t("admin.invite_copy")}
        </button>
        {inviteBanner && (
          <span style={{ marginLeft: 10, fontFamily: fontMono, fontSize: 10, color: paper.green }}>
            {inviteBanner}
          </span>
        )}
      </div>

      <div style={{ marginBottom: 10 }}>
        <div style={{ fontFamily: fontMono, fontSize: 9, color: paper.inkDim, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 4 }}>
          {t("admin.base_discount", { pct: (disc * 100).toFixed(0) })}
        </div>
        <input type="range" min={0} max={0.5} step={0.05} value={disc}
          onChange={(e) => setDisc(parseFloat(e.target.value))}
          style={{ width: "100%", accentColor: disc > 0 ? paper.amber : paper.inkDim }} />
      </div>

      <div style={{ marginBottom: 10 }}>
        <div style={{ fontFamily: fontMono, fontSize: 9, color: paper.inkDim, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 4 }}>
          {t("admin.long_discount", { pct: (discLong * 100).toFixed(0) })}
        </div>
        <input type="range" min={0} max={0.75} step={0.05} value={discLong}
          onChange={(e) => setDiscLong(parseFloat(e.target.value))}
          style={{ width: "100%", accentColor: discLong > 0 ? paper.amber : paper.inkDim }} />
      </div>

      <div style={{ display: "flex", gap: 8 }}>
        {dirty && (
          <button
            onClick={() => onSave({
              ...person,
              discount: disc, discount_long: discLong,
              username: username || null, is_admin: isAdmin ? 1 : 0,
            })}
            style={{
              flex: 1, padding: "10px", background: paper.ink, color: paper.paper,
              border: "none", cursor: "pointer", fontFamily: fontMono, fontSize: 10,
              fontWeight: 700, letterSpacing: 2, textTransform: "uppercase",
            }}>
            {t("action.save")}
          </button>
        )}
        <button
          onClick={() => onSave({ ...person, discount: disc, discount_long: discLong, active: 0 })}
          style={{
            padding: "10px 14px", background: "transparent", color: paper.inkMute,
            border: `1px solid ${paper.paperDark}`, cursor: "pointer",
            fontFamily: fontMono, fontSize: 9, letterSpacing: 1.5, textTransform: "uppercase",
          }}>
          {t("admin.deactivate")}
        </button>
      </div>
    </Card>
  );
}

// ── Members Page ──────────────────────────────────────────────
export default function AdminLedenPage() {
  const t = useT();
  const { data: people = [] } = usePeople();
  const qc = useQueryClient();

  const savePerson = useMutation({
    mutationFn: async (p: Person) => {
      const res = await fetch(`/api/people/${p.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: p.name, discount: p.discount, discount_long: p.discount_long,
          active: p.active, username: p.username, is_admin: p.is_admin,
        }),
      });
      if (!res.ok) throw new Error("Failed");
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["people"] }); toast.success(t("toast.saved")); },
  });

  const active = people.filter((p) => p.active);
  const inactive = people.filter((p) => !p.active);

  return (
    <div style={{ padding: "16px" }}>
      {active.map((person) => (
        <PersonCard key={person.id} person={person} onSave={(p) => savePerson.mutate(p)} />
      ))}
      {inactive.length > 0 && (
        <>
          <div style={{
            fontFamily: fontMono, fontSize: 9, color: paper.inkDim, letterSpacing: 2,
            textTransform: "uppercase", padding: "16px 0 8px",
            borderTop: `1.5px dashed ${paper.inkMute}`, marginTop: 8,
          }}>
            {t("admin.inactive_section")}
          </div>
          {inactive.map((person) => (
            <PersonCard key={person.id} person={person} onSave={(p) => savePerson.mutate(p)} />
          ))}
        </>
      )}
    </div>
  );
}
