"use client";
import { useT } from "@/components/locale-provider";
import { PageHeader } from "@/components/page-header";
import { useMe } from "@/hooks/use-me";
import { apiFetch } from "@/lib/api/client";
import { fullNameOf } from "@/lib/person-utils";
import { useTheme, type Theme } from "@/lib/theme-context";
import { fontMono, fontSerif, tokens } from "@/lib/theme-tokens";
import type { Person } from "@/types";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";

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
  const [saved, setSaved] = useState(false);
  const { theme: _theme, setTheme } = useTheme();
  const [themePreference, setThemePreference] = useState<Theme>("mono");
  // Driver/member prefs (all users)
  const [notifyNewReservations, setNotifyNewReservations] = useState<"off" | "all">("off");
  const [notifyReservationUpdates, setNotifyReservationUpdates] = useState<"off" | "all" | "mine">(
    "mine"
  );
  const [notifyNewTrips, setNotifyNewTrips] = useState<"off" | "all">("off");
  // Owner prefs (only people who own a car)
  const [notifyMyCarReservations, setNotifyMyCarReservations] = useState<"off" | "on">("off");
  const [notifyMyCarTrips, setNotifyMyCarTrips] = useState<"off" | "on">("off");

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
      setNotifyNewReservations(person.notify_new_reservations === "all" ? "all" : "off");
      setNotifyReservationUpdates(
        person.notify_reservation_updates === "all"
          ? "all"
          : person.notify_reservation_updates === "off"
            ? "off"
            : "mine"
      );
      setNotifyNewTrips(person.notify_new_trips === "all" ? "all" : "off");
      setNotifyMyCarReservations(person.notify_my_car_reservations === "on" ? "on" : "off");
      setNotifyMyCarTrips(person.notify_my_car_trips === "on" ? "on" : "off");
    }
  }, [person]);

  const canEdit = me != null && id != null && (me.personId === id || me.isAdmin);

  if (meLoading || loading) {
    return (
      <div style={{ background: tokens.paperDeep, minHeight: "100dvh" }}>
        <PageHeader title={t("page.profile_edit")} />
      </div>
    );
  }

  if (!canEdit || !person) {
    return (
      <div style={{ background: tokens.paperDeep, minHeight: "100dvh" }}>
        <PageHeader title={t("page.profile_edit")} />
        <div style={{ padding: 24, fontFamily: fontMono, fontSize: 12, color: tokens.accent }}>
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
          notify_my_car_reservations: notifyMyCarReservations,
          notify_my_car_trips: notifyMyCarTrips,
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
      toast.error(err instanceof Error ? err.message : t("toast.error"));
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
    field:
      | "notify_new_reservations"
      | "notify_reservation_updates"
      | "notify_new_trips"
      | "notify_my_car_reservations"
      | "notify_my_car_trips",
    value: string
  ) {
    const current = {
      notify_new_reservations: notifyNewReservations,
      notify_reservation_updates: notifyReservationUpdates,
      notify_new_trips: notifyNewTrips,
      notify_my_car_reservations: notifyMyCarReservations,
      notify_my_car_trips: notifyMyCarTrips,
    };
    const next = { ...current, [field]: value };
    // Optimistic update — re-applies every value so the changed one wins.
    setNotifyNewReservations(next.notify_new_reservations as "off" | "all");
    setNotifyReservationUpdates(next.notify_reservation_updates as "off" | "all" | "mine");
    setNotifyNewTrips(next.notify_new_trips as "off" | "all");
    setNotifyMyCarReservations(next.notify_my_car_reservations as "off" | "on");
    setNotifyMyCarTrips(next.notify_my_car_trips as "off" | "on");
    try {
      await apiFetch(`/api/people/${id}/profile`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          first_name: firstName,
          last_name: lastName,
          bank_account: bankAccount,
          email: email || null,
          ...next,
        }),
      });
      await queryClient.invalidateQueries({ queryKey: ["me"] });
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    } catch {
      toast.error(t("toast.error"));
      // Revert to the pre-change values.
      setNotifyNewReservations(current.notify_new_reservations);
      setNotifyReservationUpdates(current.notify_reservation_updates);
      setNotifyNewTrips(current.notify_new_trips);
      setNotifyMyCarReservations(current.notify_my_car_reservations);
      setNotifyMyCarTrips(current.notify_my_car_trips);
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
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
      await queryClient.invalidateQueries({ queryKey: ["me"] });
    } catch {
      toast.error(t("toast.error"));
      // revert local
      setThemePreference(themePreference);
      setTheme(themePreference);
    }
  }

  const notifySectionStyle: React.CSSProperties = {
    fontFamily: fontMono,
    fontSize: 9,
    color: tokens.inkMute,
    letterSpacing: 1,
    marginBottom: 12,
    textTransform: "uppercase",
  };
  const notifyRowStyle: React.CSSProperties = {
    marginBottom: 10,
    padding: "8px 10px",
    background: tokens.paperDark,
  };
  const notifyCheckbox = (
    key: string,
    label: string,
    checked: boolean,
    onToggle: (checked: boolean) => void
  ) => (
    <div key={key} style={notifyRowStyle}>
      <label
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          cursor: "pointer",
          fontFamily: fontMono,
          fontSize: 11,
          color: tokens.ink,
        }}
      >
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onToggle(e.target.checked)}
          style={{ accentColor: tokens.ink }}
        />
        {label}
      </label>
    </div>
  );

  return (
    <div style={{ background: tokens.paperDeep, minHeight: "100dvh" }}>
      <PageHeader title={t("page.profile_edit")} />

      <div style={{ padding: 16 }}>
        <div
          style={{
            background: tokens.paper,
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
            <div
              style={{ fontFamily: fontSerif, fontSize: 14, fontWeight: 700, color: tokens.ink }}
            >
              {fullNameOf({
                first_name: firstName,
                last_name: lastName,
                username: person.username,
              })}
            </div>
            <div
              aria-live="polite"
              style={{
                fontFamily: fontMono,
                fontSize: 9,
                letterSpacing: 1,
                textTransform: "uppercase",
                whiteSpace: "nowrap",
                color: saving ? tokens.inkMute : tokens.green,
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
                  color: tokens.inkMute,
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
                  background: tokens.paperDeep,
                  color: tokens.inkMute,
                  border: `1.5px solid ${tokens.paperDeep}`,
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
                    color: tokens.inkMute,
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
                    background: tokens.paperDark,
                    color: tokens.ink,
                    border: `1.5px solid ${firstName !== personFirstName ? tokens.ink : tokens.paperDark}`,
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
                    color: tokens.inkMute,
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
                    background: tokens.paperDark,
                    color: tokens.ink,
                    border: `1.5px solid ${lastName !== personLastName ? tokens.ink : tokens.paperDark}`,
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
                  color: tokens.inkMute,
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
                  background: tokens.paperDark,
                  color: tokens.ink,
                  border: `1.5px solid ${bankAccount !== (person.bank_account ?? "") ? tokens.ink : tokens.paperDark}`,
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
                  color: tokens.inkMute,
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
                  background: tokens.paperDark,
                  color: tokens.ink,
                  border: `1.5px solid ${email !== (person.email ?? "") ? tokens.ink : tokens.paperDark}`,
                  outline: "none",
                  boxSizing: "border-box",
                  letterSpacing: 1,
                }}
              />
              <p
                style={{
                  fontFamily: fontMono,
                  fontSize: 9,
                  color: tokens.inkMute,
                  marginTop: 4,
                  marginBottom: 0,
                  letterSpacing: 0.5,
                }}
              >
                {t("form.email_hint")}
              </p>
            </div>
          </form>

          <div
            style={{ marginTop: 20, paddingTop: 16, borderTop: `1px solid ${tokens.paperDark}` }}
          >
            <div
              style={{
                fontFamily: fontMono,
                fontSize: 9,
                color: tokens.inkMute,
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
                    background: themePreference === t2 ? tokens.ink : tokens.paperDark,
                    color: themePreference === t2 ? tokens.paper : tokens.inkMute,
                    border: "none",
                    cursor: "pointer",
                  }}
                >
                  {t2 === "paper" ? "Papier" : "Mono"}
                </button>
              ))}
            </div>
          </div>

          {/* Notification preferences — driver/member block (all users) */}
          <div
            style={{ marginTop: 20, paddingTop: 16, borderTop: `1px solid ${tokens.paperDark}` }}
          >
            <div style={notifySectionStyle}>{t("notif.pref_section")}</div>

            {notifyCheckbox(
              "new_reservations",
              t("notif.pref_new_reservations"),
              notifyNewReservations === "all",
              (c) => handleNotifyChange("notify_new_reservations", c ? "all" : "off")
            )}

            {/* Reservation updates: unchecking turns off ALL update notifications
                (not even your own outcome). Checked reveals the all/mine choice. */}
            <div style={notifyRowStyle}>
              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  cursor: "pointer",
                  fontFamily: fontMono,
                  fontSize: 11,
                  color: tokens.ink,
                }}
              >
                <input
                  type="checkbox"
                  checked={notifyReservationUpdates !== "off"}
                  onChange={(e) =>
                    handleNotifyChange(
                      "notify_reservation_updates",
                      e.target.checked ? "mine" : "off"
                    )
                  }
                  style={{ accentColor: tokens.ink }}
                />
                {t("notif.pref_reservation_updates")}
              </label>
              {notifyReservationUpdates !== "off" && (
                <div style={{ display: "flex", gap: 16, marginTop: 8, marginLeft: 24 }}>
                  {(["all", "mine"] as const).map((scope) => (
                    <label
                      key={scope}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 4,
                        fontFamily: fontMono,
                        fontSize: 10,
                        color: tokens.ink,
                        cursor: "pointer",
                      }}
                    >
                      <input
                        type="radio"
                        name="reservation-updates-scope"
                        value={scope}
                        checked={notifyReservationUpdates === scope}
                        onChange={() => handleNotifyChange("notify_reservation_updates", scope)}
                        style={{ accentColor: tokens.ink }}
                      />
                      {scope === "all" ? t("notif.pref_updates_all") : t("notif.pref_updates_mine")}
                    </label>
                  ))}
                </div>
              )}
            </div>

            {notifyCheckbox("new_trips", t("notif.pref_new_trips"), notifyNewTrips === "all", (c) =>
              handleNotifyChange("notify_new_trips", c ? "all" : "off")
            )}
          </div>

          {/* Owner block — only shown to people who own a car */}
          {me?.isOwner && (
            <div
              style={{ marginTop: 20, paddingTop: 16, borderTop: `1px solid ${tokens.paperDark}` }}
            >
              <div style={notifySectionStyle}>{t("notif.pref_section_owner")}</div>
              {notifyCheckbox(
                "my_car_reservations",
                t("notif.pref_my_car_reservations"),
                notifyMyCarReservations === "on",
                (c) => handleNotifyChange("notify_my_car_reservations", c ? "on" : "off")
              )}
              {notifyCheckbox(
                "my_car_trips",
                t("notif.pref_my_car_trips"),
                notifyMyCarTrips === "on",
                (c) => handleNotifyChange("notify_my_car_trips", c ? "on" : "off")
              )}
            </div>
          )}

          {me?.personId === id && (
            <div
              style={{ marginTop: 20, paddingTop: 16, borderTop: `1px solid ${tokens.paperDark}` }}
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
                  color: tokens.accent,
                  border: `1.5px solid ${tokens.accent}`,
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
