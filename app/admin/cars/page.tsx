"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useMe } from "@/hooks/use-me";
import { paper, fontMono, fontSerif } from "@/lib/paper-theme";
import { useT } from "@/components/locale-provider";
import type { Car } from "@/types";
import { useCars, useUpdateCar } from "@/hooks/use-cars";
import { usePeople } from "@/hooks/use-people";
import { useAdminSummary, Card, Perf } from "../_shared";
import { toast } from "sonner";
import { CarBadge } from "@/components/car-badge";
import { BreakEvenCard } from "@/components/break-even-card";

// ── Car Row (accordion) ───────────────────────────────────────
function CarRow({
  car,
  expanded,
  onToggle,
  onSave,
  people,
  isSaving,
}: {
  car: Car;
  expanded: boolean;
  onToggle: () => void;
  onSave: (data: Partial<Car>) => void;
  people: { id: number; name: string }[];
  isSaving?: boolean;
}) {
  const t = useT();
  const [name, setName] = useState(car.name);
  const [price, setPrice] = useState(car.price_per_km);
  const [owner, setOwner] = useState(car.owner_name ?? "");
  const isActive = car.active !== 0;

  const [prevId, setPrevId] = useState(car.id);
  if (car.id !== prevId) {
    setPrevId(car.id);
    setName(car.name);
    setPrice(car.price_per_km);
    setOwner(car.owner_name ?? "");
  }

  const dirty = name !== car.name || price !== car.price_per_km || owner !== (car.owner_name ?? "");

  const reset = () => {
    setName(car.name);
    setPrice(car.price_per_km);
    setOwner(car.owner_name ?? "");
  };

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "6px 8px",
    fontFamily: fontMono,
    fontSize: 11,
    border: `1px solid ${paper.paperDark}`,
    background: paper.paperDeep,
    color: paper.ink,
    outline: "none",
  };
  const labelStyle: React.CSSProperties = {
    fontFamily: fontMono,
    fontSize: 9,
    color: paper.inkDim,
    letterSpacing: 1.5,
    textTransform: "uppercase",
    display: "block",
    marginBottom: 3,
  };

  // Inactive: name + activate only
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
          padding: "12px 14px",
        }}
      >
        <CarBadge short={car.short} active={false} />
        <div style={{ flex: 1 }} />
        <button
          disabled={isSaving}
          onClick={() => onSave({ active: 1 })}
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
      {/* Collapsed header — click to toggle */}
      <div
        role="button"
        tabIndex={0}
        onClick={onToggle}
        onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onToggle()}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "12px 14px",
          cursor: "pointer",
          userSelect: "none",
        }}
      >
        <CarBadge short={car.short} active={isActive} />
        <div
          style={{
            flex: 1,
            fontFamily: fontSerif,
            fontSize: 14,
            fontWeight: 600,
            color: paper.ink,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {car.owner_name ?? <span style={{ color: paper.inkMute, fontStyle: "italic" }}>—</span>}
        </div>
        <div
          style={{
            fontFamily: fontMono,
            fontSize: 11,
            fontWeight: 700,
            color: paper.ink,
            flexShrink: 0,
          }}
        >
          €{car.price_per_km.toFixed(2)}/km
        </div>
      </div>

      {/* Expanded edit form */}
      {expanded && (
        <div style={{ padding: "0 14px 14px", borderTop: `1px dashed ${paper.paperDark}` }}>
          <div style={{ paddingTop: 12, marginBottom: 8 }}>
            <label style={labelStyle}>{t("form.name")}</label>
            <input value={name} onChange={(e) => setName(e.target.value)} style={inputStyle} />
          </div>
          <div style={{ marginBottom: 8 }}>
            <label style={labelStyle}>{t("form.price_per_km")}</label>
            <input
              type="number"
              step="0.005"
              value={price}
              onChange={(e) => setPrice(parseFloat(e.target.value) || 0)}
              style={inputStyle}
            />
          </div>
          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>{t("form.owner")}</label>
            <select value={owner} onChange={(e) => setOwner(e.target.value)} style={inputStyle}>
              <option value="">—</option>
              {people.map((p) => (
                <option key={p.id} value={p.name}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          <div style={{ marginBottom: 12 }}>
            <button
              disabled={isSaving}
              onClick={() =>
                onSave({ name, price_per_km: price, owner_name: owner || null, active: 0 })
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
                onSave({ name, price_per_km: price, owner_name: owner || null, active: car.active })
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

// ── Fleet Tiles (main view) ───────────────────────────────────
function FleetTiles() {
  const t = useT();
  const year = new Date().getFullYear();
  const { data } = useAdminSummary(year);
  const { data: cars = [] } = useCars();
  const { data: people = [] } = usePeople();
  const updateCar = useUpdateCar();
  const [expanded, setExpanded] = useState<number | null>(null);
  const [savingId, setSavingId] = useState<number | null>(null);
  const [breakEvenCar, setBreakEvenCar] = useState<number | null>(null);

  const pnl = data?.carPnL ?? [];
  const monthlyKm = data?.monthlyCarKm ?? [];
  const contributions = data?.personContributions ?? [];
  const historicalKm = data?.historicalCarKm ?? [];
  const priceHistory = data?.priceHistory ?? [];
  const carMap = new Map(cars.map((c) => [c.id, c]));

  const toggle = (id: number) => setExpanded((prev) => (prev === id ? null : id));

  const handleSave = (car: Car, patch: Partial<Car>) => {
    setSavingId(car.id);
    updateCar.mutate({ ...car, ...patch } as Car & { id: number }, {
      onSuccess: () => {
        setExpanded(null);
        toast.success(t("toast.saved"));
      },
      onSettled: () => setSavingId(null),
    });
  };

  if (breakEvenCar !== null) {
    const car = pnl.find((c) => c.car_id === breakEvenCar);
    if (car) {
      return (
        <div style={{ padding: "16px" }}>
          <button
            onClick={() => setBreakEvenCar(null)}
            style={{
              marginBottom: 12,
              padding: "7px 14px",
              background: "transparent",
              border: `1.5px solid ${paper.ink}`,
              color: paper.ink,
              fontFamily: fontMono,
              fontSize: 9,
              fontWeight: 700,
              letterSpacing: 1.5,
              textTransform: "uppercase",
              cursor: "pointer",
            }}
          >
            ← {t("admin.sub_cars")}
          </button>
          <BreakEvenCard
            car={car}
            fullCar={carMap.get(car.car_id)}
            monthlyKm={monthlyKm.filter((m) => m.car_id === car.car_id)}
            contributions={contributions.filter((c) => c.car_id === car.car_id)}
            historicalKm={historicalKm.filter((h) => h.car_id === car.car_id)}
            priceHistory={priceHistory.filter((h) => h.car_id === car.car_id)}
            year={year}
          />
        </div>
      );
    }
  }

  const activeCars = cars.filter((c) => c.active !== 0);
  const inactiveCars = cars.filter((c) => c.active === 0);

  const renderCar = (car: Car) => (
    <CarRow
      key={car.id}
      car={car}
      expanded={expanded === car.id}
      onToggle={() => toggle(car.id)}
      onSave={(patch) => handleSave(car, patch)}
      people={people}
      isSaving={savingId === car.id}
    />
  );

  return (
    <div style={{ padding: "16px" }}>
      {activeCars.map(renderCar)}
      {/* Break-even links for cars that have PnL data */}
      {pnl.filter((c) => {
        const full = carMap.get(c.car_id);
        return (!full || full.active !== 0) && c.fixed_total > 0;
      }).length > 0 && (
        <div style={{ marginTop: 8 }}>
          {pnl
            .filter((c) => {
              const full = carMap.get(c.car_id);
              return (!full || full.active !== 0) && c.fixed_total > 0;
            })
            .map((car) => (
              <button
                key={car.car_id}
                onClick={() => setBreakEvenCar(car.car_id)}
                style={{
                  display: "block",
                  width: "100%",
                  marginBottom: 6,
                  padding: "9px 14px",
                  background: "transparent",
                  border: `1px dashed ${paper.inkDim}`,
                  cursor: "pointer",
                  fontFamily: fontMono,
                  fontSize: 9,
                  color: paper.inkDim,
                  letterSpacing: 1.5,
                  textTransform: "uppercase",
                  textAlign: "left",
                }}
              >
                {car.car_short} — {t("fleet.see_breakeven")} →
              </button>
            ))}
        </div>
      )}
      {inactiveCars.length > 0 && (
        <>
          <div
            style={{
              fontFamily: fontMono,
              fontSize: 9,
              color: paper.inkDim,
              letterSpacing: 2,
              textTransform: "uppercase",
              padding: "14px 0 8px",
              borderTop: `1.5px dashed ${paper.inkMute}`,
              marginTop: 4,
            }}
          >
            {t("admin.car_deactivated_section")}
          </div>
          {inactiveCars.map(renderCar)}
        </>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────
export default function AdminWagensPage() {
  const { data: me } = useMe();
  const router = useRouter();
  useEffect(() => {
    if (me && !me.isAdmin) router.replace("/admin");
  }, [me, router]);
  if (!me?.isAdmin) return null;
  return <FleetTiles />;
}
