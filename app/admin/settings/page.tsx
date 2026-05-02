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

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (data) setBankAccount(data.coop_bank_account);
  }, [data]);

  const dirty = data ? bankAccount !== data.coop_bank_account : false;

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
                width: "100%",
                padding: "8px 10px",
                fontFamily: fontMono,
                fontSize: 12,
                background: paper.paperDark,
                color: paper.ink,
                border: `1.5px solid ${dirty ? paper.ink : paper.paperDark}`,
                outline: "none",
                boxSizing: "border-box",
                letterSpacing: 1,
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
              {save.isPending ? t("action.saving") : save.isSuccess && !dirty ? t("action.saved") : t("action.save")}
            </button>
          </>
        )}
      </Card>
    </div>
  );
}
