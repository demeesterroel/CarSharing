"use client";
import { Fab } from "@/components/fab";
import { useT } from "@/components/locale-provider";
import { ModalSheet } from "@/components/modal-sheet";
import { useMe } from "@/hooks/use-me";
import { useCreatePerson } from "@/hooks/use-people";
import { apiFetch } from "@/lib/api/client";
import { fontMono, fontSerif, tokens } from "@/lib/theme-tokens";
import { fullNameOf } from "@/lib/person-utils";
import type { Person } from "@/types";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Pencil } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { usePeople } from "../_shared";
import { buildInviteMessage } from "./invite-message";
import { MemberForm } from "./member-form";

// ── Person Row (accordion) ────────────────────────────────────
function PersonRow({
  person,
  expanded,
  onToggle,
  onSave,
  onCloak,
  onRevokeSessions,
  isSaving,
}: {
  person: Person;
  expanded: boolean;
  onToggle: () => void;
  onSave: (p: Person) => void;
  onCloak?: (personId: number) => void;
  onRevokeSessions?: (person: Person) => void;
  isSaving?: boolean;
}) {
  const t = useT();
  const { data: me } = useMe();
  const qc = useQueryClient();
  // Send the invite by email when a mail transport is configured AND this member
  // has an email; otherwise fall back to copying the link to the clipboard.
  const canSendInvite = Boolean(me?.mailEnabled && person.email);
  const [disc, setDisc] = useState(person.discount);
  const [discLong, setDiscLong] = useState(person.discount_long);
  const [username, setUsername] = useState(person.username ?? "");
  const [isAdmin, setIsAdmin] = useState(person.is_admin === 1);
  const [inviteBanner, setInviteBanner] = useState<string | null>(null);

  const [hovered, setHovered] = useState(false);
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

  // The invite link unlocks as soon as a username is typed — even before saving.
  // Any pending edit is persisted first (see handleInvite) because the invite
  // endpoint rejects members whose username isn't saved yet (400 no_username).
  const hasUsername = Boolean(username.trim());

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
      // Persist any unsaved edits first so the invite targets the entered
      // username — the invite endpoint 400s when the username isn't saved yet.
      if (dirty) {
        const saveRes = await fetch(`/api/people/${person.id}`, {
          method: "PUT",
          headers: { "x-csrf-token": csrfToken, "Content-Type": "application/json" },
          body: JSON.stringify({
            first_name: person.first_name,
            last_name: person.last_name,
            discount: disc,
            discount_long: discLong,
            active: person.active,
            username: username || null,
            is_admin: isAdmin ? 1 : 0,
          }),
        });
        if (!saveRes.ok) throw new Error();
        qc.invalidateQueries({ queryKey: ["people"] });
      }
      const res = await fetch(`/api/people/${person.id}/invite`, {
        method: "POST",
        headers: { "x-csrf-token": csrfToken, "Content-Type": "application/json" },
        body: JSON.stringify({ send: canSendInvite }),
      });
      if (!res.ok) throw new Error();
      if (canSendInvite) {
        setInviteBanner(t("admin.invite_sent"));
      } else {
        const { url } = await res.json();
        await navigator.clipboard.writeText(buildInviteMessage(person.username, url, t));
        setInviteBanner(t("admin.invite_copied"));
      }
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
          background: tokens.paper,
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
        <div style={{ fontFamily: fontSerif, fontSize: 15, fontWeight: 700, color: tokens.inkDim }}>
          {fullNameOf(person)}
        </div>
        <button
          disabled={isSaving}
          onClick={() => onSave({ ...person, active: 1 })}
          style={{
            padding: "5px 12px",
            background: tokens.green,
            color: tokens.paper,
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
        background: tokens.paper,
        marginBottom: 6,
        boxShadow: "0 1px 2px rgba(0,0,0,0.05), 0 4px 16px rgba(0,0,0,0.06)",
        borderLeft: expanded ? `3px solid ${tokens.blue}` : `3px solid transparent`,
      }}
    >
      {/* Collapsed header */}
      <div
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          display: "flex",
          alignItems: "center",
          minWidth: 0,
        }}
      >
        <button
          onClick={onToggle}
          style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            gap: 6,
            padding: "12px 14px",
            cursor: "pointer",
            userSelect: "none",
            minWidth: 0,
            background: "none",
            border: "none",
            textAlign: "left",
          }}
        >
          <span
            style={{
              fontFamily: fontSerif,
              fontSize: 15,
              fontWeight: 700,
              color: tokens.ink,
              whiteSpace: "nowrap",
            }}
          >
            {fullNameOf(person)}
          </span>
          {person.username && (
            <span
              style={{
                fontFamily: fontMono,
                fontSize: 10,
                color: tokens.inkDim,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {person.username}
            </span>
          )}
          {hasDiscount && (
            <div
              style={{
                fontFamily: fontMono,
                fontSize: 9,
                color: tokens.inkDim,
                fontWeight: 700,
                letterSpacing: 1,
                border: `1px solid ${tokens.amber}`,
                padding: "2px 5px",
                textTransform: "uppercase",
                flexShrink: 0,
              }}
            >
              {t("admin.discount_badge")}
            </div>
          )}
        </button>
        <Link
          href={`/user/${person.id}/edit`}
          aria-label={t("admin.edit_member").replace("{name}", fullNameOf(person))}
          style={{
            display: "inline-flex",
            alignItems: "center",
            color: tokens.inkDim,
            opacity: hovered ? 1 : 0,
            transition: "opacity 0.15s",
            padding: "0 6px",
          }}
        >
          <Pencil size={11} />
        </Link>
        {onCloak && (
          <button
            onClick={() => onCloak(person.id)}
            style={{
              background: "none",
              border: "none",
              padding: "0 14px 0 0",
              cursor: "pointer",
              fontFamily: fontMono,
              fontSize: 9,
              fontWeight: 700,
              letterSpacing: 1.5,
              textTransform: "uppercase",
              color: tokens.inkDim,
              whiteSpace: "nowrap",
            }}
          >
            ← view as
          </button>
        )}
      </div>

      {/* Expanded edit form */}
      {expanded && (
        <div style={{ padding: "0 14px 14px", borderTop: `1px dashed ${tokens.paperDark}` }}>
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
                  color: tokens.inkDim,
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
                  border: `1px solid ${tokens.paperDark}`,
                  background: tokens.paperDeep,
                  fontFamily: fontMono,
                  fontSize: 12,
                  color: tokens.ink,
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
                style={{ accentColor: tokens.blue, width: 14, height: 14 }}
              />
              <span
                style={{
                  fontFamily: fontMono,
                  fontSize: 9,
                  letterSpacing: 1.5,
                  textTransform: "uppercase",
                  color: tokens.inkDim,
                }}
              >
                {t("admin.is_admin_label")}
              </span>
            </label>
          </div>

          {/* Invite — needs a username; without one the invitee can't log in. */}
          <div style={{ marginBottom: 12 }}>
            <button
              onClick={handleInvite}
              disabled={!hasUsername}
              title={!hasUsername ? t("admin.invite_needs_username") : undefined}
              style={{
                padding: "7px 12px",
                background: "transparent",
                border: `1px dashed ${tokens.inkDim}`,
                cursor: hasUsername ? "pointer" : "not-allowed",
                opacity: hasUsername ? 1 : 0.45,
                fontFamily: fontMono,
                fontSize: 9,
                letterSpacing: 1.5,
                textTransform: "uppercase",
                color: tokens.inkDim,
              }}
            >
              {canSendInvite ? t("admin.invite_send") : t("admin.invite_copy")}
            </button>
            {inviteBanner && (
              <span
                style={{ marginLeft: 10, fontFamily: fontMono, fontSize: 10, color: tokens.green }}
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
                color: tokens.inkDim,
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
              style={{ width: "100%", accentColor: disc > 0 ? tokens.amber : tokens.inkDim }}
            />
          </div>
          <div style={{ marginBottom: 14 }}>
            <div
              style={{
                fontFamily: fontMono,
                fontSize: 9,
                color: tokens.inkDim,
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
              style={{ width: "100%", accentColor: discLong > 0 ? tokens.amber : tokens.inkDim }}
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
                background: tokens.accent,
                color: tokens.paper,
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

          {/* Revoke sessions */}
          {onRevokeSessions && (
            <div style={{ marginBottom: 12 }}>
              <button
                type="button"
                disabled={isSaving}
                onClick={() => onRevokeSessions(person)}
                style={{
                  width: "100%",
                  padding: "8px",
                  background: "transparent",
                  color: tokens.accent,
                  border: `1.5px solid ${tokens.accent}`,
                  cursor: isSaving ? "default" : "pointer",
                  opacity: isSaving ? 0.6 : 1,
                  fontFamily: fontMono,
                  fontSize: 9,
                  fontWeight: 700,
                  letterSpacing: 1.5,
                  textTransform: "uppercase",
                }}
              >
                {t("admin.revoke_sessions")}
              </button>
            </div>
          )}

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
                color: tokens.inkDim,
                border: `1px solid ${tokens.paperDark}`,
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
                background: dirty && !isSaving ? tokens.ink : tokens.paperDark,
                color: dirty && !isSaving ? tokens.paper : tokens.inkMute,
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
  const [savingId, setSavingId] = useState<number | null>(null);
  const [adding, setAdding] = useState(false);
  const createPerson = useCreatePerson();

  useEffect(() => {
    if (me && !me.isAdmin) router.replace("/admin");
  }, [me, router]);

  const toggle = (id: number) => setExpanded((prev) => (prev === id ? null : id));

  const savePerson = useMutation({
    mutationFn: async (p: Person) => {
      await apiFetch(`/api/people/${p.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          first_name: p.first_name,
          last_name: p.last_name,
          discount: p.discount,
          discount_long: p.discount_long,
          active: p.active,
          username: p.username,
          is_admin: p.is_admin,
        }),
      });
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
    await apiFetch("/api/auth/cloak", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ personId }),
    });
    window.location.href = "/";
  }

  async function handleRevokeSessions(person: Person) {
    if (!window.confirm(t("admin.revoke_sessions_confirm", { name: fullNameOf(person) }))) return;
    // Revoking your own sessions must destroy the current cookie, not just bump
    // the epoch: the Edge proxy can't see a stale epoch, so an undestroyed cookie
    // keeps passing page navigation. /api/auth/logout-all bumps the epoch AND
    // destroys the cookie, so the redirect to /login sticks.
    if (person.id === me?.personId) {
      try {
        await apiFetch("/api/auth/logout-all", { method: "POST" });
      } catch {
        // Ignore — redirect to login regardless of the response.
      }
      qc.clear();
      router.replace("/login");
      return;
    }
    try {
      await apiFetch(`/api/people/${person.id}/revoke-sessions`, { method: "POST" });
      toast.success(t("toast.sessions_revoked"));
    } catch {
      toast.error(t("toast.error"));
    }
  }

  if (!me?.isAdmin) return null;

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
          onRevokeSessions={handleRevokeSessions}
          isSaving={savingId === person.id}
        />
      ))}
      {inactive.length > 0 && (
        <>
          <div
            style={{
              fontFamily: fontMono,
              fontSize: 9,
              color: tokens.inkDim,
              letterSpacing: 2,
              textTransform: "uppercase",
              padding: "16px 0 8px",
              borderTop: `1.5px dashed ${tokens.inkMute}`,
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
      <ModalSheet open={adding} onClose={() => setAdding(false)} title={t("page.person_add")}>
        <div
          style={{
            padding: "16px 20px 0",
            fontFamily: fontSerif,
            fontSize: 20,
            fontWeight: 700,
            color: tokens.ink,
          }}
        >
          {t("page.person_add")}
        </div>
        <MemberForm
          onSubmit={(data) => {
            createPerson.mutate(
              {
                ...data,
                last_name: data.last_name ?? "",
                username: null,
                password_hash: null,
                is_admin: 0,
                bank_account: "",
                email: null,
                theme_preference: "mono",
                updated_at: "",
                notify_new_reservations: "off",
                notify_reservation_updates: "mine",
                notify_new_trips: "off",
                notify_my_car_reservations: "off",
                notify_my_car_trips: "off",
              },
              {
                onSuccess: () => {
                  setAdding(false);
                  toast.success(t("toast.person_added"));
                },
                onError: (e) => toast.error(e.message),
              }
            );
          }}
          onCancel={() => setAdding(false)}
          isPending={createPerson.isPending}
        />
      </ModalSheet>
      <Fab onClick={() => setAdding(true)} label={t("page.person_add")} />
    </div>
  );
}
