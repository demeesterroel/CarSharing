"use client";
import { useState, useEffect } from "react";
import { paper, fontMono, fontSerif } from "@/lib/paper-theme";
import { useAdminSettings, useSaveAdminSettings } from "@/hooks/use-admin-settings";
import { Card, Perf } from "../_shared";
import { useT } from "@/components/locale-provider";

export default function AdminSettingsPage() {
  const t = useT();
  const { data, isLoading } = useAdminSettings();
  const save = useSaveAdminSettings();
  const [bankAccount, setBankAccount] = useState("");
  const [calendarId, setCalendarId] = useState("");
  const [refreshToken, setRefreshToken] = useState("");

  useEffect(() => {
    if (data) {
      setBankAccount(data.coop_bank_account);
      setCalendarId(data.google_calendar_id ?? "");
      setRefreshToken(data.google_oauth_refresh_token ?? "");
    }
  }, [data]);

  const dirty = data ? bankAccount !== data.coop_bank_account : false;
  const calendarDirty = data
    ? calendarId !== (data.google_calendar_id ?? "") ||
      refreshToken !== (data.google_oauth_refresh_token ?? "")
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
        Instellingen
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
          Coöperatie bankrekening
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
          Wordt vermeld in het betalingsbericht voor leden.
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
              onClick={() => save.mutate({ coop_bank_account: bankAccount })}
              disabled={!dirty || save.isPending}
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
              {save.isPending
                ? t("action.saving")
                : save.isSuccess && !dirty
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
            Google Calendar
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
            Laat leeg om de integratie uit te schakelen.
          </div>

          {isLoading ? (
            <div style={{ fontFamily: fontMono, fontSize: 10, color: paper.inkMute }}>…</div>
          ) : (
            <>
              <div style={{ marginBottom: 12 }}>
                <div style={labelStyle}>Google Calendar ID</div>
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
                <div style={labelStyle}>OAuth Refresh Token</div>
                <input
                  type="password"
                  value={refreshToken}
                  onChange={(e) => setRefreshToken(e.target.value)}
                  placeholder="••••••••"
                  style={{
                    ...inputStyle,
                    border: `1.5px solid ${calendarDirty ? paper.ink : paper.paperDark}`,
                  }}
                />
              </div>
              <button
                onClick={() =>
                  save.mutate({
                    google_calendar_id: calendarId,
                    google_oauth_refresh_token: refreshToken,
                  })
                }
                disabled={!calendarDirty || save.isPending}
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
                {save.isPending
                  ? t("action.saving")
                  : save.isSuccess && !calendarDirty
                    ? t("action.saved")
                    : t("action.save")}
              </button>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
