"use client";
import { useState, useEffect } from "react";
import { Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { paper, fontMono, fontSerif } from "@/lib/paper-theme";
import { useAdminSettings, useSaveAdminSettings } from "@/hooks/use-admin-settings";
import { Card, Perf } from "../_shared";
import { useT } from "@/components/locale-provider";

export default function AdminSettingsPage() {
  const t = useT();
  const { data, isLoading } = useAdminSettings();
  const saveBankAccount = useSaveAdminSettings();
  const saveCalendar = useSaveAdminSettings();
  const [bankAccount, setBankAccount] = useState("");
  const [calendarId, setCalendarId] = useState("");
  const [refreshToken, setRefreshToken] = useState("");
  const [showToken, setShowToken] = useState(false);
  const [testStatus, setTestStatus] = useState<{ ok: boolean; message: string } | null>(null);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    if (data) {
      setBankAccount(data.coop_bank_account);
      setCalendarId(data.google_calendar_id ?? "");
      // Never pre-fill the token — user must re-enter to change it
    }
  }, [data]);

  const dirty = data ? bankAccount !== data.coop_bank_account : false;
  const calendarDirty = data
    ? calendarId !== (data.google_calendar_id ?? "") || refreshToken !== ""
    : false;

  const inputStyle = {
    width: "100%",
    padding: "8px 10px",
    fontFamily: fontMono,
    fontSize: 12,
    background: paper.paperDark,
    color: paper.ink,
    outline: "none",
    boxSizing: "border-box" as const,
    letterSpacing: 1,
  };

  const labelStyle = {
    fontFamily: fontMono,
    fontSize: 9,
    color: paper.inkMute,
    letterSpacing: 1,
    marginBottom: 4,
  };

  return (
    <div style={{ padding: 16, maxWidth: 480 }}>
      <div
        style={{
          fontFamily: fontMono,
          fontSize: 9,
          color: paper.inkDim,
          letterSpacing: 2,
          textTransform: "uppercase",
          marginBottom: 12,
        }}
      >
        {t("settings.title")}
      </div>

      <Card>
        <div
          style={{
            fontFamily: fontSerif,
            fontSize: 14,
            fontWeight: 700,
            color: paper.ink,
            marginBottom: 12,
          }}
        >
          {t("settings.bank_title")}
        </div>
        <div
          style={{
            fontFamily: fontMono,
            fontSize: 9,
            color: paper.inkMute,
            letterSpacing: 1,
            marginBottom: 8,
          }}
        >
          {t("settings.bank_hint")}
        </div>

        <Perf margin="0 0 12px" />

        {isLoading ? (
          <div style={{ fontFamily: fontMono, fontSize: 10, color: paper.inkMute }}>…</div>
        ) : (
          <>
            <input
              type="text"
              value={bankAccount}
              onChange={(e) => setBankAccount(e.target.value)}
              placeholder="BE12 3456 7890 1234"
              style={{
                ...inputStyle,
                border: `1.5px solid ${dirty ? paper.ink : paper.paperDark}`,
              }}
            />
            <button
              onClick={() =>
                saveBankAccount.mutate(
                  { coop_bank_account: bankAccount },
                  { onSuccess: () => toast.success(t("action.saved")) }
                )
              }
              disabled={!dirty || saveBankAccount.isPending}
              style={{
                marginTop: 10,
                width: "100%",
                padding: "8px",
                fontFamily: fontMono,
                fontSize: 9,
                fontWeight: 700,
                letterSpacing: 2,
                textTransform: "uppercase",
                background: dirty ? paper.ink : paper.paperDark,
                color: dirty ? paper.paper : paper.inkMute,
                border: "none",
                cursor: dirty ? "pointer" : "default",
              }}
            >
              {saveBankAccount.isPending
                ? t("action.saving")
                : saveBankAccount.isSuccess && !dirty
                  ? t("action.saved")
                  : t("action.save")}
            </button>
          </>
        )}
      </Card>

      <div style={{ marginTop: 16 }}>
        <Card>
          <div
            style={{
              fontFamily: fontSerif,
              fontSize: 14,
              fontWeight: 700,
              color: paper.ink,
              marginBottom: 12,
            }}
          >
            {t("settings.calendar_title")}
          </div>
          <div
            style={{
              fontFamily: fontMono,
              fontSize: 9,
              color: paper.inkMute,
              letterSpacing: 1,
              marginBottom: 8,
            }}
          >
            {t("settings.calendar_hint")}
          </div>

          {!isLoading && data && !data.env_credentials_ok && (
            <div
              style={{
                fontFamily: fontMono,
                fontSize: 10,
                color: "#b45309",
                background: "#fffbeb",
                border: "1px solid #fde68a",
                padding: "8px 10px",
                marginBottom: 12,
                lineHeight: 1.5,
              }}
            >
              {t("settings.env_warning")}
            </div>
          )}

          {isLoading ? (
            <div style={{ fontFamily: fontMono, fontSize: 10, color: paper.inkMute }}>…</div>
          ) : (
            <>
              <div style={{ marginBottom: 12 }}>
                <div style={labelStyle}>{t("settings.calendar_id_label")}</div>
                <input
                  type="text"
                  value={calendarId}
                  onChange={(e) => setCalendarId(e.target.value)}
                  placeholder="abc123@group.calendar.google.com"
                  style={{
                    ...inputStyle,
                    border: `1.5px solid ${calendarDirty ? paper.ink : paper.paperDark}`,
                  }}
                />
              </div>
              <div style={{ marginBottom: 12 }}>
                <div style={labelStyle}>{t("settings.token_label")}</div>
                <div style={{ position: "relative" }}>
                  <input
                    type={showToken ? "text" : "password"}
                    value={refreshToken}
                    onChange={(e) => setRefreshToken(e.target.value)}
                    placeholder={
                      data?.google_oauth_refresh_token
                        ? t("settings.token_stored")
                        : t("settings.token_empty")
                    }
                    style={{
                      ...inputStyle,
                      paddingRight: 32,
                      border: `1.5px solid ${calendarDirty ? paper.ink : paper.paperDark}`,
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowToken((v) => !v)}
                    style={{
                      position: "absolute",
                      right: 8,
                      top: "50%",
                      transform: "translateY(-50%)",
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      padding: 0,
                      color: paper.inkMute,
                      display: "flex",
                    }}
                  >
                    {showToken ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>
              <button
                onClick={() =>
                  saveCalendar.mutate(
                    {
                      google_calendar_id: calendarId,
                      ...(refreshToken !== "" && { google_oauth_refresh_token: refreshToken }),
                    },
                    {
                      onSuccess: () => {
                        setRefreshToken("");
                        toast.success(t("action.saved"));
                      },
                    }
                  )
                }
                disabled={!calendarDirty || saveCalendar.isPending}
                style={{
                  marginTop: 10,
                  width: "100%",
                  padding: "8px",
                  fontFamily: fontMono,
                  fontSize: 9,
                  fontWeight: 700,
                  letterSpacing: 2,
                  textTransform: "uppercase",
                  background: calendarDirty ? paper.ink : paper.paperDark,
                  color: calendarDirty ? paper.paper : paper.inkMute,
                  border: "none",
                  cursor: calendarDirty ? "pointer" : "default",
                }}
              >
                {saveCalendar.isPending
                  ? t("action.saving")
                  : saveCalendar.isSuccess && !calendarDirty
                    ? t("action.saved")
                    : t("action.save")}
              </button>
              <button
                type="button"
                disabled={testing}
                onClick={async () => {
                  setTesting(true);
                  setTestStatus(null);
                  try {
                    const res = await fetch("/api/admin/calendar-test");
                    const body = (await res.json()) as
                      | { ok: true; summary: string }
                      | { ok: false; error: string };
                    if (body.ok) {
                      setTestStatus({
                        ok: true,
                        message: t("settings.test_ok").replace("{name}", body.summary),
                      });
                    } else {
                      const errorMap: Record<string, string> = {
                        no_calendar_id: t("settings.test_no_id"),
                        no_token: t("settings.test_no_token"),
                        no_env_credentials: t("settings.test_no_env"),
                        invalid_client: t("settings.test_invalid_client"),
                        invalid_grant: t("settings.test_invalid_grant"),
                        calendar_not_found: t("settings.test_not_found"),
                      };
                      const msg =
                        errorMap[body.error] ??
                        t("settings.test_fail").replace("{error}", body.error);
                      setTestStatus({ ok: false, message: msg });
                    }
                  } catch {
                    setTestStatus({
                      ok: false,
                      message: t("settings.test_fail").replace("{error}", "network error"),
                    });
                  } finally {
                    setTesting(false);
                  }
                }}
                style={{
                  marginTop: 8,
                  width: "100%",
                  padding: "8px",
                  fontFamily: fontMono,
                  fontSize: 9,
                  fontWeight: 700,
                  letterSpacing: 2,
                  textTransform: "uppercase",
                  background: "none",
                  color: testing ? paper.inkMute : paper.inkDim,
                  border: `1px solid ${paper.paperDark}`,
                  cursor: testing ? "not-allowed" : "pointer",
                }}
              >
                {testing ? "…" : t("settings.test")}
              </button>
              {testStatus && (
                <div
                  style={{
                    marginTop: 8,
                    fontFamily: fontMono,
                    fontSize: 10,
                    color: testStatus.ok ? "#2d7a2d" : paper.accent,
                    letterSpacing: 0.5,
                    lineHeight: 1.5,
                  }}
                >
                  {testStatus.message}
                </div>
              )}
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
