"use client";
import { useState } from "react";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import { paper, fontMono, fontSerif, fmtMoney } from "@/lib/paper-theme";
import { useT } from "@/components/locale-provider";
import { useEarliestDashboardYear } from "@/hooks/use-dashboard";
import { useSettlement } from "@/hooks/use-settlement";
import { useMe } from "@/hooks/use-me";
import { apiFetch } from "@/lib/api/client";
import { Card, Row, Perf } from "../_shared";
import type { MemberStatement, Transfer } from "@/types";

function YearPicker({
  year,
  earliest,
  current,
  onChange,
}: {
  year: number;
  earliest: number;
  current: number;
  onChange: (y: number) => void;
}) {
  const btnBase: React.CSSProperties = {
    padding: "6px 14px",
    background: "transparent",
    fontFamily: fontMono,
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: 1,
    border: `1.5px solid ${paper.ink}`,
    cursor: "pointer",
  };
  return (
    <div
      style={{ display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 12 }}
    >
      <button
        onClick={() => onChange(year - 1)}
        disabled={year <= earliest}
        style={{
          ...btnBase,
          borderRight: "none",
          color: year <= earliest ? paper.inkMute : paper.ink,
          cursor: year <= earliest ? "default" : "pointer",
        }}
      >
        ← {year - 1}
      </button>
      <div
        style={{
          padding: "6px 18px",
          background: paper.ink,
          color: paper.paper,
          fontFamily: fontMono,
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: 2,
          border: `1.5px solid ${paper.ink}`,
        }}
      >
        {year}
      </div>
      <button
        onClick={() => onChange(year + 1)}
        disabled={year >= current}
        style={{
          ...btnBase,
          borderLeft: "none",
          color: year >= current ? paper.inkMute : paper.ink,
          cursor: year >= current ? "default" : "pointer",
        }}
      >
        {year + 1} →
      </button>
    </div>
  );
}

function MemberCard({ m }: { m: MemberStatement }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const net = m.is_owner ? (m.net ?? 0) : (m.s1 ?? 0);
  const isPositive = net > 0;

  return (
    <div
      style={{
        background: paper.paper,
        marginBottom: 6,
        boxShadow: "0 1px 4px rgba(0,0,0,0.07)",
        borderLeft: `3px solid ${m.is_owner ? paper.blue : paper.ink}`,
      }}
    >
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          width: "100%",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "12px 14px",
          background: "transparent",
          border: "none",
          cursor: "pointer",
        }}
      >
        <div style={{ textAlign: "left" }}>
          <div style={{ fontFamily: fontSerif, fontSize: 16, fontWeight: 700, color: paper.ink }}>
            {m.person_name}
          </div>
          {m.is_owner && (
            <div
              style={{
                fontFamily: fontMono,
                fontSize: 8,
                color: paper.inkMute,
                letterSpacing: 1.5,
                textTransform: "uppercase",
                marginTop: 2,
              }}
            >
              {m.car_eras.map((e) => e.car_short).join(" · ")}
            </div>
          )}
        </div>
        <div style={{ textAlign: "right" }}>
          <div
            style={{
              fontFamily: fontMono,
              fontSize: 15,
              fontWeight: 700,
              color: isPositive ? paper.green : net < 0 ? paper.accent : paper.inkMute,
            }}
          >
            {net > 0 ? "+" : ""}
            {fmtMoney(net)}
          </div>
          {m.is_owner && (
            <div
              style={{ fontFamily: fontMono, fontSize: 8, color: paper.inkMute, letterSpacing: 1 }}
            >
              {t("settlement.s2_label")} {fmtMoney(m.s2 ?? 0)} / {t("settlement.x_label")}{" "}
              {(m.x ?? 0) >= 0 ? "+" : ""}
              {fmtMoney(m.x ?? 0)}
            </div>
          )}
        </div>
      </button>

      {open && m.car_eras.length > 0 && (
        <div style={{ padding: "0 14px 12px", borderTop: `1px dashed ${paper.paperDark}` }}>
          {m.car_eras.map((era, i) => (
            <div key={i} style={{ marginTop: 8 }}>
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
                {era.car_short} — {era.car_name}
              </div>
              {m.is_owner ? (
                <Row
                  label={t("settlement.n_c_star_label")}
                  value={fmtMoney(era.n_c_star ?? 0)}
                  color={paper.green}
                />
              ) : (
                <>
                  {era.trip_amount > 0 && (
                    <Row label="Ritten" value={`− ${fmtMoney(era.trip_amount)}`} />
                  )}
                  {era.fuel_amount > 0 && (
                    <Row
                      label="Brandstof"
                      value={`+ ${fmtMoney(era.fuel_amount)}`}
                      color={paper.green}
                    />
                  )}
                  {era.expense_amount > 0 && (
                    <Row
                      label="Kosten"
                      value={`+ ${fmtMoney(era.expense_amount)}`}
                      color={paper.green}
                    />
                  )}
                  <Row
                    label="Saldo"
                    value={(era.balance >= 0 ? "+" : "") + fmtMoney(era.balance)}
                    color={era.balance >= 0 ? paper.green : paper.accent}
                    big
                  />
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function TransferRow({ transfer }: { transfer: Transfer }) {
  const t = useT();
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(
      `${transfer.from} → ${transfer.to}: ${fmtMoney(transfer.amount)}`
    );
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "7px 0",
        borderBottom: `1px dotted ${paper.paperDark}`,
      }}
    >
      <div>
        <span style={{ fontFamily: fontMono, fontSize: 11, color: paper.ink }}>
          {transfer.from}
        </span>
        <span style={{ fontFamily: fontMono, fontSize: 11, color: paper.inkMute }}> → </span>
        <span style={{ fontFamily: fontMono, fontSize: 11, color: paper.ink }}>{transfer.to}</span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontFamily: fontMono, fontSize: 13, fontWeight: 700, color: paper.ink }}>
          {fmtMoney(transfer.amount)}
        </span>
        <button
          onClick={copy}
          style={{
            padding: "2px 8px",
            fontFamily: fontMono,
            fontSize: 8,
            fontWeight: 700,
            letterSpacing: 1,
            textTransform: "uppercase",
            background: copied ? paper.green : "transparent",
            color: copied ? paper.paper : paper.inkMute,
            border: `1px solid ${copied ? paper.green : paper.paperDark}`,
            cursor: "pointer",
          }}
        >
          {copied ? t("settlement.copied") : t("settlement.copy_transfer")}
        </button>
      </div>
    </div>
  );
}

export default function AdminSettlementPage() {
  const t = useT();
  const { data: me } = useMe();
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const { data: earliest = currentYear } = useEarliestDashboardYear();
  const { data, isLoading } = useSettlement(year);
  const qc = useQueryClient();

  const lock = useMutation({
    mutationFn: () => apiFetch(`/api/settlement/${year}`, { method: "POST" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["settlement", year] }),
  });

  const step1 = data?.transfers.filter((tr) => tr.step === 1) ?? [];
  const step2 = data?.transfers.filter((tr) => tr.step === 2) ?? [];
  const step3 = data?.transfers.filter((tr) => tr.step === 3) ?? [];

  return (
    <div style={{ padding: 16 }}>
      <YearPicker year={year} earliest={earliest} current={currentYear} onChange={setYear} />

      {data?.frozen && (
        <div style={{ textAlign: "center", marginBottom: 12 }}>
          <span
            style={{
              display: "inline-block",
              padding: "4px 14px",
              background: paper.green,
              color: paper.paper,
              fontFamily: fontMono,
              fontSize: 9,
              fontWeight: 700,
              letterSpacing: 2,
              textTransform: "uppercase",
            }}
          >
            {t("settlement.frozen_badge")}
          </span>
          {data.settled_by && (
            <div style={{ fontFamily: fontMono, fontSize: 9, color: paper.inkMute, marginTop: 4 }}>
              {t("settlement.frozen_by", {
                date: data.settled_at?.slice(0, 10) ?? "",
                name: data.settled_by,
              })}
            </div>
          )}
        </div>
      )}

      {isLoading && (
        <div
          style={{
            fontFamily: fontMono,
            fontSize: 10,
            color: paper.inkMute,
            textAlign: "center",
            padding: 32,
          }}
        >
          …
        </div>
      )}

      {!isLoading && (!data || data.members.length === 0) && (
        <div
          style={{
            fontFamily: fontMono,
            fontSize: 10,
            color: paper.inkMute,
            textAlign: "center",
            padding: 32,
          }}
        >
          {t("settlement.no_data", { year })}
        </div>
      )}

      {data && data.members.length > 0 && (
        <>
          <div
            style={{
              fontFamily: fontMono,
              fontSize: 9,
              color: paper.inkDim,
              letterSpacing: 2,
              textTransform: "uppercase",
              marginBottom: 8,
            }}
          >
            {t("settlement.members_title")}
          </div>
          {data.members.map((m) => (
            <MemberCard key={m.person_id} m={m} />
          ))}

          <Card style={{ marginTop: 16 }}>
            <div
              style={{
                fontFamily: fontMono,
                fontSize: 9,
                color: paper.inkDim,
                letterSpacing: 2,
                textTransform: "uppercase",
                marginBottom: 10,
              }}
            >
              {t("settlement.transfers_title")}
            </div>

            {step1.length > 0 && (
              <>
                <div
                  style={{
                    fontFamily: fontMono,
                    fontSize: 8,
                    color: paper.inkMute,
                    letterSpacing: 1.5,
                    textTransform: "uppercase",
                    marginBottom: 4,
                  }}
                >
                  {t("settlement.step1_title")}
                </div>
                {step1.map((tr, i) => (
                  <TransferRow key={i} transfer={tr} />
                ))}
                <div style={{ marginBottom: 10 }} />
              </>
            )}

            {step2.length > 0 && (
              <>
                <div
                  style={{
                    fontFamily: fontMono,
                    fontSize: 8,
                    color: paper.inkMute,
                    letterSpacing: 1.5,
                    textTransform: "uppercase",
                    marginBottom: 4,
                  }}
                >
                  {t("settlement.step2_title")}
                </div>
                {step2.map((tr, i) => (
                  <TransferRow key={i} transfer={tr} />
                ))}
                <div style={{ marginBottom: 10 }} />
              </>
            )}

            {step3.length > 0 && (
              <>
                <div
                  style={{
                    fontFamily: fontMono,
                    fontSize: 8,
                    color: paper.inkMute,
                    letterSpacing: 1.5,
                    textTransform: "uppercase",
                    marginBottom: 4,
                  }}
                >
                  {t("settlement.step3_title")}
                </div>
                {step3.map((tr, i) => (
                  <TransferRow key={i} transfer={tr} />
                ))}
              </>
            )}
          </Card>

          <div
            style={{
              marginTop: 12,
              padding: "10px 14px",
              background: data.verify_ok ? paper.green : paper.accent,
              color: paper.paper,
            }}
          >
            <span style={{ fontFamily: fontMono, fontSize: 10, fontWeight: 700, letterSpacing: 1 }}>
              {data.verify_ok ? t("settlement.verify_ok") : t("settlement.verify_fail")}
            </span>
          </div>

          {me?.isAdmin && (
            <button
              onClick={() => lock.mutate()}
              disabled={lock.isPending}
              style={{
                marginTop: 16,
                width: "100%",
                padding: "10px",
                fontFamily: fontMono,
                fontSize: 9,
                fontWeight: 700,
                letterSpacing: 2,
                textTransform: "uppercase",
                background: data.frozen ? paper.paperDark : paper.ink,
                color: data.frozen ? paper.inkMute : paper.paper,
                border: "none",
                cursor: lock.isPending ? "default" : "pointer",
              }}
            >
              {lock.isPending
                ? "…"
                : data.frozen
                  ? t("settlement.unfinalize")
                  : t("settlement.finalize")}
            </button>
          )}
        </>
      )}
    </div>
  );
}
