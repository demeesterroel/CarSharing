"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useMe } from "@/hooks/use-me";
import { paper, fontMono, fontSerif, fmtMoney } from "@/lib/paper-theme";
import { useT } from "@/components/locale-provider";
import type { Car } from "@/types";
import { useCars, useCreateCar, useUpdateCar, useDeleteCar } from "@/hooks/use-cars";
import { usePeople } from "@/hooks/use-people";
import { useAdminSummary, beMetrics, Card, Perf } from "../_shared";
import { useEarliestDashboardYear } from "@/hooks/use-dashboard";
import { toast } from "sonner";
import { CarBadge } from "@/components/car-badge";
import { BreakEvenCard } from "@/components/break-even-card";
import { RateAssistant } from "@/components/rate-assistant";

// ── Owner screen state ────────────────────────────────────────
type OwnerScreen =
  | { view: "fleet" }
  | { view: "detail"; carId: number }
  | { view: "rate"; carId: number }
  | { view: "create" };

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

// ── Owner car tile (fleet list item with inline edit) ─────────
function OwnerCarTile({
  car,
  pnlData,
  onDetail,
  onRate,
}: {
  car: Car;
  pnlData: ReturnType<typeof beMetrics> | null;
  onDetail: () => void;
  onRate: () => void;
}) {
  const t = useT();
  const updateCar = useUpdateCar();
  const deleteCar = useDeleteCar();
  const [editOpen, setEditOpen] = useState(false);
  const [name, setName] = useState(car.name);
  const [price, setPrice] = useState(car.price_per_km);
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  const [prevId, setPrevId] = useState(car.id);
  if (car.id !== prevId) {
    setPrevId(car.id);
    setName(car.name);
    setPrice(car.price_per_km);
    setEditOpen(false);
    setDeleteConfirm(false);
  }

  const dirty = name !== car.name || price !== car.price_per_km;
  const isActive = car.active !== 0;
  const statusColor = pnlData
    ? pnlData.status === "ahead" ? paper.green : pnlData.status === "on_pace" ? paper.amber : paper.accent
    : paper.inkMute;
  const statusLabel = pnlData
    ? pnlData.status === "ahead" ? t("fleet.stamp_ahead") : pnlData.status === "on_pace" ? t("fleet.stamp_on_pace") : t("fleet.stamp_behind")
    : null;

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "6px 8px",
    fontFamily: fontMono,
    fontSize: 11,
    border: `1px solid ${paper.paperDark}`,
    background: paper.paperDeep,
    color: paper.ink,
    outline: "none",
    boxSizing: "border-box",
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

  function handleSave() {
    updateCar.mutate(
      { id: car.id, name, price_per_km: price, active: car.active } as Car & { id: number },
      {
        onSuccess: () => {
          setEditOpen(false);
          toast.success(t("toast.saved"));
        },
      }
    );
  }

  function handleToggleActive() {
    updateCar.mutate(
      { id: car.id, name: car.name, price_per_km: car.price_per_km, active: isActive ? 0 : 1 } as Car & { id: number },
      { onSuccess: () => toast.success(t("toast.saved")) }
    );
  }

  function handleDelete() {
    if (!deleteConfirm) {
      setDeleteConfirm(true);
      return;
    }
    deleteCar.mutate(car.id, {
      onError: () => {
        toast.error(t("owner.car_has_history"));
        setDeleteConfirm(false);
      },
    });
  }

  return (
    <Card style={{ marginBottom: 10, borderLeft: `3px solid ${isActive ? statusColor : paper.inkMute}`, opacity: isActive ? 1 : 0.6 }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <CarBadge short={car.short} active={isActive} />
          <div>
            <div style={{ fontFamily: fontSerif, fontSize: 16, fontWeight: 700, color: paper.ink }}>{car.name}</div>
            <div style={{ fontFamily: fontMono, fontSize: 9, color: paper.inkDim, letterSpacing: 1 }}>€{car.price_per_km.toFixed(2)}/km</div>
          </div>
        </div>
        {statusLabel && (
          <div style={{ padding: "3px 8px", border: `1.5px solid ${statusColor}`, color: statusColor, fontFamily: fontMono, fontSize: 8, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", transform: "rotate(-3deg)", flexShrink: 0 }}>
            {statusLabel}
          </div>
        )}
      </div>

      {/* Burden summary */}
      {pnlData && pnlData.fixedCovered < pnlData.remainingBurden + pnlData.fixedCovered && (
        <>
          <div style={{ fontFamily: fontSerif, fontSize: 24, fontWeight: 700, color: statusColor, lineHeight: 1, margin: "4px 0 2px" }}>
            {fmtMoney(pnlData.remainingBurden)}
          </div>
          <div style={{ fontFamily: fontMono, fontSize: 9, color: paper.inkDim, letterSpacing: 1, marginBottom: 6 }}>
            {t("fleet.remaining_burden")} · {t("fleet.pct_covered", { pct: Math.round(pnlData.pctCovered * 100) })}
          </div>
          <div style={{ height: 3, background: paper.paperDeep, position: "relative", marginBottom: 8 }}>
            <div style={{ position: "absolute", top: 0, bottom: 0, left: 0, width: `${Math.min(1, pnlData.pctCovered) * 100}%`, background: statusColor }} />
          </div>
        </>
      )}

      <Perf margin="8px 0" />

      {/* Actions */}
      <div style={{ display: "flex", gap: 6 }}>
        <button onClick={onDetail} style={{ flex: 1, padding: "8px", background: paper.ink, color: paper.paper, border: "none", cursor: "pointer", fontFamily: fontMono, fontSize: 9, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase" }}>
          {t("fleet.see_breakeven")}
        </button>
        <button onClick={onRate} style={{ flex: 1, padding: "8px", background: "transparent", color: paper.ink, border: `1.5px solid ${paper.ink}`, cursor: "pointer", fontFamily: fontMono, fontSize: 9, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase" }}>
          {t("rate.open")}
        </button>
        <button onClick={() => { setEditOpen((o) => !o); setDeleteConfirm(false); }} style={{ padding: "8px 10px", background: editOpen ? paper.paperDark : "transparent", color: paper.ink, border: `1.5px solid ${paper.paperDark}`, cursor: "pointer", fontFamily: fontMono, fontSize: 9, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase" }}>
          {t("owner.edit_car")}
        </button>
      </div>

      {/* Inline edit */}
      {editOpen && (
        <div style={{ borderTop: `1px dashed ${paper.paperDark}`, marginTop: 12, paddingTop: 12 }}>
          <div style={{ marginBottom: 8 }}>
            <label style={labelStyle}>{t("form.name")}</label>
            <input value={name} onChange={(e) => setName(e.target.value)} style={inputStyle} />
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={labelStyle}>{t("form.price_per_km")}</label>
            <input type="number" step="0.005" value={price} onChange={(e) => setPrice(parseFloat(e.target.value) || 0)} style={inputStyle} />
          </div>
          <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
            <button onClick={() => { setName(car.name); setPrice(car.price_per_km); setEditOpen(false); setDeleteConfirm(false); }} style={{ flex: 1, padding: "8px", background: "transparent", color: paper.inkDim, border: `1px solid ${paper.paperDark}`, cursor: "pointer", fontFamily: fontMono, fontSize: 9, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase" }}>
              {t("action.cancel")}
            </button>
            <button disabled={!dirty || updateCar.isPending} onClick={handleSave} style={{ flex: 2, padding: "8px", background: dirty && !updateCar.isPending ? paper.ink : paper.paperDark, color: dirty && !updateCar.isPending ? paper.paper : paper.inkMute, border: "none", cursor: dirty && !updateCar.isPending ? "pointer" : "default", fontFamily: fontMono, fontSize: 9, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase" }}>
              {updateCar.isPending ? "…" : t("action.save")}
            </button>
          </div>
          <button onClick={handleToggleActive} disabled={updateCar.isPending} style={{ width: "100%", marginBottom: 6, padding: "8px", background: isActive ? paper.accent : paper.green, color: paper.paper, border: "none", cursor: updateCar.isPending ? "default" : "pointer", opacity: updateCar.isPending ? 0.6 : 1, fontFamily: fontMono, fontSize: 9, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase" }}>
            {isActive ? t("admin.deactivate") : t("admin.activate")}
          </button>
          <button onClick={handleDelete} disabled={deleteCar.isPending} style={{ width: "100%", padding: "8px", background: deleteConfirm ? paper.accent : "transparent", color: deleteConfirm ? paper.paper : paper.accent, border: `1px solid ${paper.accent}`, cursor: "pointer", fontFamily: fontMono, fontSize: 9, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase" }}>
            {deleteCar.isPending ? "…" : deleteConfirm ? t("owner.delete_confirm") : t("action.delete")}
          </button>
          {deleteConfirm && (
            <button onClick={() => setDeleteConfirm(false)} style={{ width: "100%", marginTop: 4, padding: "6px", background: "transparent", color: paper.inkDim, border: `1px solid ${paper.paperDark}`, cursor: "pointer", fontFamily: fontMono, fontSize: 8, letterSpacing: 1 }}>
              {t("action.cancel")}
            </button>
          )}
        </div>
      )}
    </Card>
  );
}

// ── Owner create form ─────────────────────────────────────────
function OwnerCreateForm({ onBack }: { onBack: () => void }) {
  const t = useT();
  const createCar = useCreateCar();
  const [name, setName] = useState("");
  const [short, setShort] = useState("");
  const [price, setPrice] = useState(0.2);

  const valid = name.trim().length > 0 && short.trim().length > 0 && short.length <= 10 && price > 0;

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "6px 8px",
    fontFamily: fontMono,
    fontSize: 11,
    border: `1px solid ${paper.paperDark}`,
    background: paper.paperDeep,
    color: paper.ink,
    outline: "none",
    boxSizing: "border-box",
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

  function handleSubmit() {
    if (!valid || createCar.isPending) return;
    createCar.mutate(
      { short: short.toUpperCase(), name, price_per_km: price } as Omit<Car, "id">,
      { onSuccess: onBack }
    );
  }

  return (
    <div style={{ padding: "16px" }}>
      <button onClick={onBack} style={{ marginBottom: 12, padding: "7px 14px", background: "transparent", border: `1.5px solid ${paper.ink}`, color: paper.ink, fontFamily: fontMono, fontSize: 9, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", cursor: "pointer" }}>
        ← {t("owner.back_fleet")}
      </button>
      <Card>
        <div style={{ fontFamily: fontSerif, fontSize: 16, fontWeight: 700, color: paper.ink, marginBottom: 12 }}>
          {t("owner.add_car")}
        </div>
        <div style={{ marginBottom: 8 }}>
          <label style={labelStyle}>{t("form.name")}</label>
          <input value={name} onChange={(e) => setName(e.target.value)} style={inputStyle} />
        </div>
        <div style={{ marginBottom: 8 }}>
          <label style={labelStyle}>{t("form.short")}</label>
          <input value={short} onChange={(e) => setShort(e.target.value.toUpperCase())} maxLength={10} placeholder="ETH" style={inputStyle} />
        </div>
        <div style={{ marginBottom: 16 }}>
          <label style={labelStyle}>{t("form.price_per_km")}</label>
          <input type="number" step="0.005" min="0.01" value={price} onChange={(e) => setPrice(parseFloat(e.target.value) || 0)} style={inputStyle} />
        </div>
        <button disabled={!valid || createCar.isPending} onClick={handleSubmit} style={{ width: "100%", padding: "10px", background: valid && !createCar.isPending ? paper.ink : paper.paperDark, color: valid && !createCar.isPending ? paper.paper : paper.inkMute, border: "none", cursor: valid && !createCar.isPending ? "pointer" : "default", fontFamily: fontMono, fontSize: 9, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase" }}>
          {createCar.isPending ? "…" : t("owner.add_car")}
        </button>
      </Card>
    </div>
  );
}

// ── Owner fleet view ──────────────────────────────────────────
function OwnerFleet({ myName }: { myName: string }) {
  const t = useT();
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [screen, setScreen] = useState<OwnerScreen>({ view: "fleet" });

  const { data: earliestYear = currentYear } = useEarliestDashboardYear();
  const { data: cars = [] } = useCars();
  const { data: summary } = useAdminSummary(year);

  const carMap = new Map(cars.map((c) => [c.id, c]));
  const myCars = cars.filter((c) => c.owner_name === myName);
  const allPnL = summary?.carPnL ?? [];
  const monthlyKm = summary?.monthlyCarKm ?? [];
  const contributions = summary?.personContributions ?? [];
  const historicalKm = summary?.historicalCarKm ?? [];
  const priceHistory = summary?.priceHistory ?? [];

  if (screen.view === "detail") {
    const pnlCar = allPnL.find((c) => c.car_id === screen.carId);
    if (!pnlCar) return null;
    return (
      <div style={{ padding: "16px" }}>
        <button onClick={() => setScreen({ view: "fleet" })} style={{ marginBottom: 12, padding: "7px 14px", background: "transparent", border: `1.5px solid ${paper.ink}`, color: paper.ink, fontFamily: fontMono, fontSize: 9, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", cursor: "pointer" }}>
          ← {t("owner.back_fleet")}
        </button>
        <BreakEvenCard
          car={pnlCar}
          fullCar={carMap.get(screen.carId)}
          monthlyKm={monthlyKm.filter((m) => m.car_id === screen.carId)}
          contributions={contributions.filter((c) => c.car_id === screen.carId)}
          historicalKm={historicalKm.filter((h) => h.car_id === screen.carId)}
          priceHistory={priceHistory.filter((h) => h.car_id === screen.carId)}
          year={year}
          onRateOpen={() => setScreen({ view: "rate", carId: screen.carId })}
        />
      </div>
    );
  }

  if (screen.view === "rate") {
    const pnlCar = allPnL.find((c) => c.car_id === screen.carId);
    if (!pnlCar) return null;
    return (
      <div style={{ padding: "16px" }}>
        <button onClick={() => setScreen({ view: "detail", carId: screen.carId })} style={{ marginBottom: 12, padding: "7px 14px", background: "transparent", border: `1.5px solid ${paper.ink}`, color: paper.ink, fontFamily: fontMono, fontSize: 9, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", cursor: "pointer" }}>
          ← {t("fleet.see_breakeven")}
        </button>
        <RateAssistant
          car={pnlCar}
          fullCar={carMap.get(screen.carId)}
          historicalKm={historicalKm.filter((h) => h.car_id === screen.carId)}
          year={year}
          onCommit={() => setScreen({ view: "fleet" })}
        />
      </div>
    );
  }

  if (screen.view === "create") {
    return <OwnerCreateForm onBack={() => setScreen({ view: "fleet" })} />;
  }

  // Fleet list
  return (
    <div style={{ padding: "16px" }}>
      {/* Year selector */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
        <button onClick={() => setYear((y) => y - 1)} disabled={year <= earliestYear} style={{ padding: "6px 14px", background: "transparent", border: `1.5px solid ${paper.ink}`, borderRight: "none", fontFamily: fontMono, fontSize: 10, fontWeight: 700, color: year <= earliestYear ? paper.inkMute : paper.ink, cursor: year <= earliestYear ? "default" : "pointer", letterSpacing: 1 }}>
          ← {year - 1}
        </button>
        <div style={{ padding: "6px 18px", background: paper.ink, color: paper.paper, fontFamily: fontMono, fontSize: 10, fontWeight: 700, letterSpacing: 2, border: `1.5px solid ${paper.ink}` }}>
          {year}
        </div>
        <button onClick={() => setYear((y) => y + 1)} disabled={year >= currentYear} style={{ padding: "6px 14px", background: "transparent", border: `1.5px solid ${paper.ink}`, borderLeft: "none", fontFamily: fontMono, fontSize: 10, fontWeight: 700, color: year >= currentYear ? paper.inkMute : paper.ink, cursor: year >= currentYear ? "default" : "pointer", letterSpacing: 1 }}>
          {year + 1} →
        </button>
      </div>

      {/* Add car */}
      <button onClick={() => setScreen({ view: "create" })} style={{ display: "block", width: "100%", marginBottom: 12, padding: "10px 14px", background: "transparent", border: `1.5px dashed ${paper.ink}`, color: paper.ink, fontFamily: fontMono, fontSize: 9, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", cursor: "pointer", textAlign: "center" }}>
        + {t("owner.add_car")}
      </button>

      {myCars.length === 0 ? (
        <div style={{ fontFamily: fontMono, fontSize: 11, color: paper.inkMute, textAlign: "center", padding: "32px 0" }}>
          {t("owner.no_cars")}
        </div>
      ) : (
        myCars.map((car) => {
          const pnlCar = allPnL.find((c) => c.car_id === car.id);
          const m = pnlCar ? beMetrics(pnlCar) : null;
          return (
            <OwnerCarTile
              key={car.id}
              car={car}
              pnlData={m}
              onDetail={() => setScreen({ view: "detail", carId: car.id })}
              onRate={() => setScreen({ view: "rate", carId: car.id })}
            />
          );
        })
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────
export default function AdminWagensPage() {
  const { data: me, isLoading } = useMe();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && me && !me.isAdmin && !me.isOwner) {
      router.replace("/");
    }
  }, [me, isLoading, router]);

  if (isLoading || !me) return null;
  if (!me.isAdmin && !me.isOwner) return null;

  if (me.isAdmin) return <FleetTiles />;
  return <OwnerFleet myName={me.personName!} />;
}
