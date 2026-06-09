"use client";
import { useT } from "@/components/locale-provider";
import { PageHeader } from "@/components/page-header";
import { useMe } from "@/hooks/use-me";
import { apiFetch } from "@/lib/api/client";
import { fontMono, fontSerif, paper } from "@/lib/paper-theme";
import { fullNameOf } from "@/lib/person-utils";
import { useTheme, type Theme } from "@/lib/theme-context";
import type { Person } from "@/types";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function EditProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const t = useT();
  const { data: me, isLoading: meLoading } = useMe();
  const [id, setId] = useState<number | null>(null);
  const [person, setPerson] = useState<Person | null>(null);
  const [loading, setLoading] = useState(true);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [bankAccount, setBankAccount] = useState("");
  const [email, setEmail] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const { theme: _theme, setTheme } = useTheme();
  const [themePreference, setThemePreference] = useState<Theme>("mono");
  const [themeSaved, setThemeSaved] = useState(false);
  type NotifyPref = "off" | "all" | "own";
  const [notifyNewReservations, setNotifyNewReservations] = useState<NotifyPref>("off");
  const [notifyReservationUpdates, setNotifyReservationUpdates] = useState<NotifyPref>("off");
  const [notifyNewTrips, setNotifyNewTrips] = useState<NotifyPref>("off");

  useEffect(() => {
    params.then(({ id: rawId }) => {
      const n = Number(rawId);
      setId(n);
    });
  }, [params]);

  useEffect(() => {
    if (id === null) return;
    fetch(`/api/people/${id}`)
      .then((r) => {
        if (!r.ok) throw new Error("Niet gevonden");
        return r.json() as Promise<Person>;
      })
      .then((p) => {
        setPerson(p);
        setFirstName(p.first_name);
        setLastName(p.last_name);
        setBankAccount(p.bank_account ?? "");
        setEmail(p.email ?? "");
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    if (person) {
      setThemePreference((person.theme_preference as Theme) ?? "mono");
      setNotifyNewReservations(person.notify_new_reservations ?? "off");
      setNotifyReservationUpdates(person.notify_reservation_updates ?? "off");
      setNotifyNewTrips(person.notify_new_trips ?? "off");
    }
  }, [person]);

  const canEdit = me != null && id != null && (me.personId === id || me.isAdmin);

  if (meLoading || loading) {
    return (
      <div style={{ background: paper.paperDeep, minHeight: "100dvh" }}>
        <PageHeader title={t("page.profile_edit")} />
      </div>
    );
  }

  if (!canEdit || !person) {
    return (
      <div style={{ background: paper.paperDeep, minHeight: "100dvh" }}>
        <PageHeader title={t("page.profile_edit")} />
        <div style={{ padding: 24, fontFamily: fontMono, fontSize: 12, color: paper.accent }}>
          {!canEdit ? t("error.no_access") : t("error.not_found")}
        </div>
      </div>
    );
  }

  const personFirstName = person.first_name;
  const personLastName = person.last_name;
  const dirty =
    firstName !== personFirstName ||
    lastName !== personLastName ||
    bankAccount !== (person.bank_account ?? "") ||
    email !== (person.email ?? "");

  // Auto-save the text fields: persist whenever a dirty field loses focus, the
  // same immediate-save behaviour the theme and notification controls already
  // use. No explicit Save button, no redirect.
  async function saveProfile() {
    if (saving) return;
    setSaving(true);
    setError(null);
    try {
      await apiFetch(`/api/people/${id}/profile`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          first_name: firstName,
          last_name: lastName,
          bank_account: bankAccount,
          email: email || null,
          notify_new_reservations: notifyNewReservations,
          notify_reservation_updates: notifyReservationUpdates,
          notify_new_trips: notifyNewTrips,
        }),
      });
      // Advance the local baseline so the form is no longer dirty (prevents the
      // next blur from re-saving unchanged values).
      setPerson((p) =>
        p
          ? {
              ...p,
              first_name: firstName,
              last_name: lastName,
              bank_account: bankAccount,
              email: email || null,
            }
          : p
      );
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
      await queryClient.invalidateQueries({ queryKey: ["me"] });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Fout bij opslaan");
    } finally {
      setSaving(false);
    }
  }

  function handleFieldBlur() {
    if (dirty && !saving) void saveProfile();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (dirty) await saveProfile();
  }

  async function handleNotifyChange(
    field: "notify_new_reservations" | "notify_reservation_updates" | "notify_new_trips",
    value: NotifyPref
  ) {
    const patch: Record<string, string> = {
      first_name: firstName,
      last_name: lastName,
      bank_account: bankAccount,
      email: email || "",
      notify_new_reservations: notifyNewReservations,
      notify_reservation_updates: notifyReservationUpdates,
      notify_new_trips: notifyNewTrips,
      [field]: value,
    };
    if (field === "notify_new_reservations") setNotifyNewReservations(value);
    if (field === "notify_reservation_updates") setNotifyReservationUpdates(value);
    if (field === "notify_new_trips") setNotifyNewTrips(value);
    try {
      await apiFetch(`/api/people/${id}/profile`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...patch, email: email || null }),
      });
      await queryClient.invalidateQueries({ queryKey: ["me"] });
    } catch {
      // revert
      if (field === "notify_new_reservations")
        setNotifyNewReservations(person!.notify_new_reservations ?? "off");
      if (field === "notify_reservation_updates")
        setNotifyReservationUpdates(person!.notify_reservation_updates ?? "off");
      if (field === "notify_new_trips") setNotifyNewTrips(person!.notify_new_trips ?? "off");
    }
  }

  async function handleLogoutAll() {
    if (!window.confirm(t("auth.logout_all_confirm"))) return;
    try {
      await apiFetch("/api/auth/logout-all", { method: "POST" });
    } catch {
      // Ignore — redirect to login regardless of the response.
    }
    queryClient.clear();
    router.replace("/login");
  }

  async function handleThemeToggle(newTheme: Theme) {
    setThemePreference(newTheme);
    setTheme(newTheme);
    setThemeSaved(false);
    try {
      await apiFetch(`/api/people/${id}/profile`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          first_name: firstName,
          last_name: lastName,
          bank_account: bankAccount,
          email: email || null,
          theme_preference: newTheme,
        }),
      });
      setThemeSaved(true);
      setTimeout(() => setThemeSaved(false), 1500);
      await queryClient.invalidateQueries({ queryKey: ["me"] });
    } catch {
      // revert local
      setThemePreference(themePreference);
      setTheme(themePreference);
    }
  }

  return (
    <div style={{ background: paper.paperDeep, minHeight: "100dvh" }}>
      <PageHeader title={t("page.profile_edit")} />

      <div style={{ padding: 16 }}>
        <div
          style={{
            background: paper.paper,
            boxShadow: "0 1px 4px rgba(0,0,0,0.07)",
            padding: "14px 16px",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "baseline",
              gap: 8,
              marginBottom: 16,
            }}
          >
            <div style={{ fontFamily: fontSerif, fontSize: 14, fontWeight: 700, color: paper.ink }}>
              {fullNameOf({ first_name: firstName, last_name: lastName, username: person.username })}
            </div>
            <div
              aria-live="polite"
              style={{
                fontFamily: fontMono,
                fontSize: 9,
                letterSpacing: 1,
                textTransform: "uppercase",
                whiteSpace: "nowrap",
                color: saving ? paper.inkMute : paper.green,
              }}
            >
              {saving ? t("action.saving") : saved ? t("action.saved") : ""}
            </div>
          </div>

          <form id="profile-form" onSubmit={handleSubmit}>
            <div style={{ marginBottom: 12 }}>
              <label
                htmlFor="edit-username"
                style={{
                  display: "block",
                  fontFamily: fontMono,
                  fontSize: 9,
                  color: paper.inkMute,
                  letterSpacing: 1,
                  marginBottom: 4,
                }}
              >
                {t("form.username")}
              </label>
              <input
                id="edit-username"
                type="text"
                value={person.username ?? ""}
                readOnly
                style={{
                  width: "100%",
                  padding: "8px 10px",
                  fontFamily: fontMono,
                  fontSize: 12,
                  background: paper.paperDeep,
                  color: paper.inkMute,
                  border: `1.5px solid ${paper.paperDeep}`,
                  outline: "none",
                  boxSizing: "border-box",
                  cursor: "default",
                }}
              />
            </div>

            <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
              <div style={{ flex: 1 }}>
                <label
                  htmlFor="edit-first-name"
                  style={{
                    display: "block",
                    fontFamily: fontMono,
                    fontSize: 9,
                    color: paper.inkMute,
                    letterSpacing: 1,
                    marginBottom: 4,
                  }}
                >
                  {t("form.first_name")}
                </label>
                <input
                  id="edit-first-name"
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  onBlur={handleFieldBlur}
                  required
                  style={{
                    width: "100%",
                    padding: "8px 10px",
                    fontFamily: fontMono,
                    fontSize: 12,
                    background: paper.paperDark,
                    color: paper.ink,
                    border: `1.5px solid ${firstName !== personFirstName ? paper.ink : paper.paperDark}`,
                    outline: "none",
                    boxSizing: "border-box",
                  }}
                />
              </div>
              <div style={{ flex: 1 }}>
                <label
                  htmlFor="edit-last-name"
                  style={{
                    display: "block",
                    fontFamily: fontMono,
                    fontSize: 9,
                    color: paper.inkMute,
                    letterSpacing: 1,
                    marginBottom: 4,
                  }}
                >
                  {t("form.last_name")}
                </label>
                <input
                  id="edit-last-name"
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  onBlur={handleFieldBlur}
                  style={{
                    width: "100%",
                    padding: "8px 10px",
                    fontFamily: fontMono,
                    fontSize: 12,
                    background: paper.paperDark,
                    color: paper.ink,
                    border: `1.5px solid ${lastName !== personLastName ? paper.ink : paper.paperDark}`,
                    outline: "none",
                    boxSizing: "border-box",
                  }}
                />
              </div>
            </div>

            <div style={{ marginBottom: 12 }}>
              <label
                htmlFor="edit-bank"
                style={{
                  display: "block",
                  fontFamily: fontMono,
                  fontSize: 9,
                  color: paper.inkMute,
                  letterSpacing: 1,
                  marginBottom: 4,
                }}
              >
                {t("form.bank_account")}
              </label>
              <input
                id="edit-bank"
                type="text"
                value={bankAccount}
                onChange={(e) => setBankAccount(e.target.value)}
                onBlur={handleFieldBlur}
                placeholder="BE00 0000 0000 0000"
                style={{
                  width: "100%",
                  padding: "8px 10px",
                  fontFamily: fontMono,
                  fontSize: 12,
                  background: paper.paperDark,
                  color: paper.ink,
                  border: `1.5px solid ${bankAccount !== (person.bank_account ?? "") ? paper.ink : paper.paperDark}`,
                  outline: "none",
                  boxSizing: "border-box",
                  letterSpacing: 1,
                }}
              />
            </div>

            <div style={{ marginBottom: 16 }}>
              <label
                htmlFor="edit-email"
                style={{
                  display: "block",
                  fontFamily: fontMono,
                  fontSize: 9,
                  color: paper.inkMute,
                  letterSpacing: 1,
                  marginBottom: 4,
                }}
              >
                {t("form.email")}
              </label>
              <input
                id="edit-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onBlur={handleFieldBlur}
                placeholder="naam@voorbeeld.be"
                style={{
                  width: "100%",
                  padding: "8px 10px",
                  fontFamily: fontMono,
                  fontSize: 12,
                  background: paper.paperDark,
                  color: paper.ink,
                  border: `1.5px solid ${email !== (person.email ?? "") ? paper.ink : paper.paperDark}`,
                  outline: "none",
                  boxSizing: "border-box",
                  letterSpacing: 1,
                }}
              />
              <p
                style={{
                  fontFamily: fontMono,
                  fontSize: 9,
                  color: paper.inkMute,
                  marginTop: 4,
                  marginBottom: 0,
                  letterSpacing: 0.5,
                }}
              >
                {t("form.email_hint")}
              </p>
            </div>

            {error && (
              <div
                style={{
                  fontFamily: fontMono,
                  fontSize: 10,
                  color: paper.accent,
                  marginBottom: 10,
                }}
              >
                {error}
              </div>
            )}

          </form>

          <div style={{ marginTop: 20, paddingTop: 16, borderTop: `1px solid ${paper.paperDark}` }}>
            <div
              style={{
                fontFamily: fontMono,
                fontSize: 9,
                color: paper.inkMute,
                letterSpacing: 1,
                marginBottom: 8,
                textTransform: "uppercase",
              }}
            >
              {t("form.theme")}
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              {(["mono", "paper"] as Theme[]).map((t2) => (
                <button
                  key={t2}
                  type="button"
                  onClick={() => handleThemeToggle(t2)}
                  style={{
                    flex: 1,
                    padding: "8px",
                    fontFamily: fontMono,
                    fontSize: 9,
                    fontWeight: 700,
                    letterSpacing: 2,
                    textTransform: "uppercase",
                    background: themePreference === t2 ? paper.ink : paper.paperDark,
                    color: themePreference === t2 ? paper.paper : paper.inkMute,
                    border: "none",
                    cursor: "pointer",
                  }}
                >
                  {t2 === "paper" ? "Papier" : "Mono"}
                </button>
              ))}
            </div>
            {themeSaved && (
              <div
                style={{
                  fontFamily: fontMono,
                  fontSize: 9,
                  color: paper.green,
                  marginTop: 6,
                  letterSpacing: 1,
                }}
              >
                {t("action.saved")}
              </div>
            )}
          </div>

          {/* Notification preferences */}
          <div style={{ marginTop: 20, paddingTop: 16, borderTop: `1px solid ${paper.paperDark}` }}>
            <div
              style={{
                fontFamily: fontMono,
                fontSize: 9,
                color: paper.inkMute,
                letterSpacing: 1,
                marginBottom: 12,
                textTransform: "uppercase",
              }}
            >
              {t("notif.pref_section")}
            </div>
            {(
              [
                {
                  field: "notify_new_reservations" as const,
                  label: t("notif.pref_new_reservations"),
                  value: notifyNewReservations,
                },
                {
                  field: "notify_reservation_updates" as const,
                  label: t("notif.pref_reservation_updates"),
                  value: notifyReservationUpdates,
                },
                {
                  field: "notify_new_trips" as const,
                  label: t("notif.pref_new_trips"),
                  value: notifyNewTrips,
                },
              ] as {
                field:
                  | "notify_new_reservations"
                  | "notify_reservation_updates"
                  | "notify_new_trips";
                label: string;
                value: NotifyPref;
              }[]
            ).map(({ field, label, value }) => {
              const isOwner = me?.isOwner ?? false;
              const enabled = value !== "off";
              return (
                <div
                  key={field}
                  style={{
                    marginBottom: 12,
                    padding: "8px 10px",
                    background: paper.paperDark,
                  }}
                >
                  <label
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      cursor: "pointer",
                      fontFamily: fontMono,
                      fontSize: 11,
                      color: paper.ink,
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={enabled}
                      onChange={(e) => {
                        if (!e.target.checked) {
                          handleNotifyChange(field, "off");
                        } else {
                          handleNotifyChange(field, isOwner ? "all" : "all");
                        }
                      }}
                      style={{ accentColor: paper.ink }}
                    />
                    {label}
                  </label>
                  {enabled && isOwner && (
                    <div
                      style={{
                        marginTop: 6,
                        marginLeft: 20,
                        display: "flex",
                        gap: 16,
                      }}
                    >
                      {(["all", "own"] as const).map((scope) => (
                        <label
                          key={scope}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 4,
                            fontFamily: fontMono,
                            fontSize: 9,
                            color: paper.inkMute,
                            cursor: "pointer",
                            letterSpacing: 0.5,
                          }}
                        >
                          <input
                            type="radio"
                            name={`${field}-scope`}
                            value={scope}
                            checked={value === scope}
                            onChange={() => handleNotifyChange(field, scope)}
                            style={{ accentColor: paper.ink }}
                          />
                          {scope === "all" ? t("notif.pref_scope_all") : t("notif.pref_scope_own")}
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {me?.personId === id && (
            <div
              style={{ marginTop: 20, paddingTop: 16, borderTop: `1px solid ${paper.paperDark}` }}
            >
              <button
                type="button"
                onClick={handleLogoutAll}
                style={{
                  width: "100%",
                  padding: "8px",
                  fontFamily: fontMono,
                  fontSize: 9,
                  fontWeight: 700,
                  letterSpacing: 2,
                  textTransform: "uppercase",
                  background: "transparent",
                  color: paper.accent,
                  border: `1.5px solid ${paper.accent}`,
                  cursor: "pointer",
                }}
              >
                {t("auth.logout_all")}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
