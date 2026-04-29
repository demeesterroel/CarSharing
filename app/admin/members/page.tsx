"use client";
import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useMe } from "@/hooks/use-me";
import { paper, fontMono, fontSerif } from "@/lib/paper-theme";
import { useT } from "@/components/locale-provider";
import type { Person } from "@/types";
import { usePeople } from "../_shared";
import { toast } from "sonner";

// ── Person Row (accordion) ────────────────────────────────────
function PersonRow({
  person,
  expanded,
  onToggle,
  onSave,
  onCloak,
  isSaving,
}: {
  person: Person;
  expanded: boolean;
  onToggle: () => void;
  onSave: (p: Person) => void;
  onCloak?: (personId: number) => void;
  isSaving?: boolean;
}) {
  const t = useT();
  const [disc, setDisc] = useState(person.discount);
  const [discLong, setDiscLong] = useState(person.discount_long);
  const [username, setUsername] = useState(person.username ?? "");
  const [isAdmin, setIsAdmin] = useState(person.is_admin === 1);
  const [inviteBanner, setInviteBanner] = useState<string | null>(null);

  const [prevId, setPrevId] = useState(person.id);
  if (person.id !== prevId) {
    setPrevId(person.id);
    setDisc(person.discount);
    setDiscLong(person.discount_long);
    setUsername(person.username ?? "");
    setIsAdmin(person.is_admin === 1);
  }

  const dirty =
    disc !== person.discount ||
    discLong !== person.discount_long ||
    username !== (person.username ?? "") ||
    isAdmin !== (person.is_admin === 1);

  const reset = () => {
    setDisc(person.discount);
    setDiscLong(person.discount_long);
    setUsername(person.username ?? "");
    setIsAdmin(person.is_admin === 1);
  };

  const isActive = !!person.active;
  const hasDiscount = person.discount > 0 || person.discount_long > 0;

  const handleInvite = async () => {
    try {
      const csrfToken = document.cookie.match(/csrf-token=([^;]+)/)?.[1] ?? "";
      const res = await fetch(`/api/people/${person.id}/invite`, {
        method: "POST",
        headers: { "x-csrf-token": csrfToken },
      });
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

  // Inactive: simple row with Activate button only
  if (!isActive) {
    return (
      <div
        style={{
          background: paper.paper,
          marginBottom: 6,
          opacity: 0.55,
          boxShadow: "0 1px 2px rgba(0,0,0,0.05), 0 4px 16px rgba(0,0,0,0.06)",
          borderLeft: "3px solid transparent",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "12px 14px",
        }}
      >
        <div style={{ fontFamily: fontSerif, fontSize: 15, fontWeight: 700, color: paper.inkDim }}>
          {person.name}
        </div>
        <button
          disabled={isSaving}
          onClick={() => onSave({ ...person, active: 1 })}
          style={{
            padding: "5px 12px",
            background: paper.green,
            color: paper.paper,
            border: "none",
            cursor: isSaving ? "default" : "pointer",
            opacity: isSaving ? 0.6 : 1,
            fontFamily: fontMono,
            fontSize: 9,
            fontWeight: 700,
            letterSpacing: 1.5,
            textTransform: "uppercase",
          }}
        >
          {isSaving ? "…" : t("admin.activate")}
        </button>
      </div>
    );
  }

  return (
    <div
      style={{
        background: paper.paper,
        marginBottom: 6,
        boxShadow: "0 1px 2px rgba(0,0,0,0.05), 0 4px 16px rgba(0,0,0,0.06)",
        borderLeft: expanded ? `3px solid ${paper.blue}` : `3px solid transparent`,
      }}
    >
      {/* Collapsed header */}
      <div
        role="button"
        tabIndex={0}
        onClick={onToggle}
        onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onToggle()}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "12px 14px",
          cursor: "pointer",
          userSelect: "none",
        }}
      >
        {/* Name + ← view as + username */}
        <div style={{ flex: 1, display: "flex", alignItems: "baseline", gap: 8, minWidth: 0 }}>
          <span
            style={{
              fontFamily: fontSerif,
              fontSize: 15,
              fontWeight: 700,
              color: paper.ink,
              whiteSpace: "nowrap",
            }}
          >
            {person.name}
          </span>
          {onCloak && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onCloak(person.id);
              }}
              style={{
                background: "none",
                border: "none",
                padding: 0,
                cursor: "pointer",
                fontFamily: fontMono,
                fontSize: 8,
                fontWeight: 700,
                letterSpacing: 1.5,
                textTransform: "uppercase",
                color: paper.amber,
                whiteSpace: "nowrap",
                flexShrink: 0,
              }}
            >
              ← view as
            </button>
          )}
          {person.username && (
            <span
              style={{
                fontFamily: fontMono,
                fontSize: 10,
                color: paper.inkDim,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {person.username}
            </span>
          )}
        </div>

        {/* Discount badge */}
        {hasDiscount && (
          <div
            style={{
              fontFamily: fontMono,
              fontSize: 8,
              color: paper.amber,
              fontWeight: 700,
              letterSpacing: 1,
              border: `1px solid ${paper.amber}`,
              padding: "2px 5px",
              textTransform: "uppercase",
              flexShrink: 0,
            }}
          >
            {t("admin.discount_badge")}
          </div>
        )}
      </div>

      {/* Expanded edit form */}
      {expanded && (
        <div style={{ padding: "0 14px 14px", borderTop: `1px dashed ${paper.paperDark}` }}>
          {/* Username + admin */}
          <div
            style={{
              paddingTop: 12,
              marginBottom: 12,
              display: "flex",
              gap: 8,
              alignItems: "flex-end",
            }}
          >
            <div style={{ flex: 1 }}>
              <div
                style={{
                  fontFamily: fontMono,
                  fontSize: 9,
                  color: paper.inkDim,
                  letterSpacing: 1.5,
                  textTransform: "uppercase",
                  marginBottom: 4,
                }}
              >
                {t("admin.username_label")}
              </div>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder={t("admin.no_username")}
                style={{
                  width: "100%",
                  padding: "6px 8px",
                  border: `1px solid ${paper.paperDark}`,
                  background: paper.paperDeep,
                  fontFamily: fontMono,
                  fontSize: 12,
                  color: paper.ink,
                  outline: "none",
                }}
              />
            </div>
            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                paddingBottom: 6,
                cursor: "pointer",
              }}
            >
              <input
                type="checkbox"
                checked={isAdmin}
                onChange={(e) => setIsAdmin(e.target.checked)}
                style={{ accentColor: paper.blue, width: 14, height: 14 }}
              />
              <span
                style={{
                  fontFamily: fontMono,
                  fontSize: 9,
                  letterSpacing: 1.5,
                  textTransform: "uppercase",
                  color: paper.inkDim,
                }}
              >
                {t("admin.is_admin_label")}
              </span>
            </label>
          </div>

          {/* Invite */}
          <div style={{ marginBottom: 12 }}>
            <button
              onClick={handleInvite}
              style={{
                padding: "7px 12px",
                background: "transparent",
                border: `1px dashed ${paper.inkDim}`,
                cursor: "pointer",
                fontFamily: fontMono,
                fontSize: 9,
                letterSpacing: 1.5,
                textTransform: "uppercase",
                color: paper.inkDim,
              }}
            >
              {t("admin.invite_copy")}
            </button>
            {inviteBanner && (
              <span
                style={{ marginLeft: 10, fontFamily: fontMono, fontSize: 10, color: paper.green }}
              >
                {inviteBanner}
              </span>
            )}
          </div>

          {/* Discounts */}
          <div style={{ marginBottom: 10 }}>
            <div
              style={{
                fontFamily: fontMono,
                fontSize: 9,
                color: paper.inkDim,
                letterSpacing: 1.5,
                textTransform: "uppercase",
                marginBottom: 4,
              }}
            >
              {t("admin.base_discount", { pct: (disc * 100).toFixed(0) })}
            </div>
            <input
              type="range"
              min={0}
              max={0.5}
              step={0.05}
              value={disc}
              onChange={(e) => setDisc(parseFloat(e.target.value))}
              style={{ width: "100%", accentColor: disc > 0 ? paper.amber : paper.inkDim }}
            />
          </div>
          <div style={{ marginBottom: 14 }}>
            <div
              style={{
                fontFamily: fontMono,
                fontSize: 9,
                color: paper.inkDim,
                letterSpacing: 1.5,
                textTransform: "uppercase",
                marginBottom: 4,
              }}
            >
              {t("admin.long_discount", { pct: (discLong * 100).toFixed(0) })}
            </div>
            <input
              type="range"
              min={0}
              max={0.75}
              step={0.05}
              value={discLong}
              onChange={(e) => setDiscLong(parseFloat(e.target.value))}
              style={{ width: "100%", accentColor: discLong > 0 ? paper.amber : paper.inkDim }}
            />
          </div>

          {/* Deactivate */}
          <div style={{ marginBottom: 12 }}>
            <button
              disabled={isSaving}
              onClick={() =>
                onSave({ ...person, discount: disc, discount_long: discLong, active: 0 })
              }
              style={{
                width: "100%",
                padding: "8px",
                background: paper.accent,
                color: paper.paper,
                border: "none",
                cursor: isSaving ? "default" : "pointer",
                opacity: isSaving ? 0.6 : 1,
                fontFamily: fontMono,
                fontSize: 9,
                fontWeight: 700,
                letterSpacing: 1.5,
                textTransform: "uppercase",
              }}
            >
              {isSaving ? "…" : t("admin.deactivate")}
            </button>
          </div>

          {/* Cancel / Save */}
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={() => {
                reset();
                onToggle();
              }}
              style={{
                flex: 1,
                padding: "9px",
                background: "transparent",
                color: paper.inkDim,
                border: `1px solid ${paper.paperDark}`,
                cursor: "pointer",
                fontFamily: fontMono,
                fontSize: 9,
                fontWeight: 700,
                letterSpacing: 1.5,
                textTransform: "uppercase",
              }}
            >
              {t("action.cancel")}
            </button>
            <button
              disabled={!dirty || isSaving}
              onClick={() =>
                onSave({
                  ...person,
                  discount: disc,
                  discount_long: discLong,
                  username: username || null,
                  is_admin: isAdmin ? 1 : 0,
                })
              }
              style={{
                flex: 2,
                padding: "9px",
                background: dirty && !isSaving ? paper.ink : paper.paperDark,
                color: dirty && !isSaving ? paper.paper : paper.inkMute,
                border: "none",
                cursor: dirty && !isSaving ? "pointer" : "default",
                fontFamily: fontMono,
                fontSize: 9,
                fontWeight: 700,
                letterSpacing: 2,
                textTransform: "uppercase",
              }}
            >
              {isSaving ? "…" : t("action.save")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Members Page ──────────────────────────────────────────────
export default function AdminLedenPage() {
  const t = useT();
  const { data: me } = useMe();
  const { data: people = [] } = usePeople();
  const qc = useQueryClient();
  const router = useRouter();
  const [expanded, setExpanded] = useState<number | null>(null);

  useEffect(() => {
    if (me && !me.isAdmin) router.replace("/admin");
  }, [me, router]);

  if (!me?.isAdmin) return null;
  const [savingId, setSavingId] = useState<number | null>(null);

  const toggle = (id: number) => setExpanded((prev) => (prev === id ? null : id));

  const savePerson = useMutation({
    mutationFn: async (p: Person) => {
      const res = await fetch(`/api/people/${p.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: p.name,
          discount: p.discount,
          discount_long: p.discount_long,
          active: p.active,
          username: p.username,
          is_admin: p.is_admin,
        }),
      });
      if (!res.ok) throw new Error("Failed");
    },
    onMutate: (p) => setSavingId(p.id),
    onSettled: () => setSavingId(null),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["people"] });
      setExpanded(null);
      toast.success(t("toast.saved"));
    },
  });

  async function handleCloak(personId: number) {
    const res = await fetch("/api/auth/cloak", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ personId }),
    });
    if (!res.ok) return;
    qc.invalidateQueries({ queryKey: ["me"] });
    router.push("/");
  }

  const active = people.filter((p) => p.active);
  const inactive = people.filter((p) => !p.active);

  return (
    <div style={{ padding: "16px" }}>
      {active.map((person) => (
        <PersonRow
          key={person.id}
          person={person}
          expanded={expanded === person.id}
          onToggle={() => toggle(person.id)}
          onSave={(p) => savePerson.mutate(p)}
          onCloak={handleCloak}
          isSaving={savingId === person.id}
        />
      ))}
      {inactive.length > 0 && (
        <>
          <div
            style={{
              fontFamily: fontMono,
              fontSize: 9,
              color: paper.inkDim,
              letterSpacing: 2,
              textTransform: "uppercase",
              padding: "16px 0 8px",
              borderTop: `1.5px dashed ${paper.inkMute}`,
              marginTop: 8,
            }}
          >
            {t("admin.inactive_section")}
          </div>
          {inactive.map((person) => (
            <PersonRow
              key={person.id}
              person={person}
              expanded={false}
              onToggle={() => {}}
              onSave={(p) => savePerson.mutate(p)}
              isSaving={savingId === person.id}
            />
          ))}
        </>
      )}
    </div>
  );
}
