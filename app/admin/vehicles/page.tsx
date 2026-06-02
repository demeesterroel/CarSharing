"use client";
import { useState, Suspense } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import * as Dialog from "@radix-ui/react-dialog";
import { useMe } from "@/hooks/use-me";
import { paper, fontMono, fontSerif } from "@/lib/paper-theme";
import { useT } from "@/components/locale-provider";
import type { Car } from "@/types";
import { useCars, useCreateCar, useUpdateCar, useDeleteCar } from "@/hooks/use-vehicles";
import { usePeople } from "@/hooks/use-people";
import { useAdminSummary } from "../_shared";
import { useEarliestDashboardYear } from "@/hooks/use-dashboard";
import { toast } from "sonner";
import { CarBadge } from "@/components/car-badge";
import { CostCoverageScreen } from "@/components/cost-coverage-screen";
import { Fab } from "@/components/fab";
import type { CarPriceHistory, CarPnL } from "@/lib/queries/admin";
import { shortNameOf } from "@/lib/person-utils";

// ── Style constants ───────────────────────────────────────────
const overlayStyle: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,0.45)",
  zIndex: 49,
};
const sheetStyle: React.CSSProperties = {
  position: "fixed",
  bottom: 0,
  left: "50%",
  transform: "translateX(-50%)",
  width: "min(100%, 480px)",
  maxHeight: "92dvh",
  borderRadius: "14px 14px 0 0",
  background: paper.paperDeep,
  zIndex: 50,
  overflowY: "auto",
};

const sharedInputStyle: React.CSSProperties = {
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
const sharedLabelStyle: React.CSSProperties = {
  fontFamily: fontMono,
  fontSize: 9,
  color: paper.inkDim,
  letterSpacing: 1.5,
  textTransform: "uppercase",
  display: "block",
  marginBottom: 3,
};

// ── Toggle ────────────────────────────────────────────────────
function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div
      role="switch"
      aria-checked={value}
      tabIndex={0}
      onClick={() => onChange(!value)}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onChange(!value)}
      style={{
        width: 44,
        height: 24,
        borderRadius: 12,
        background: value ? paper.green : paper.paperDark,
        position: "relative",
        cursor: "pointer",
        flexShrink: 0,
        transition: "background 0.2s",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: 2,
          left: value ? 22 : 2,
          width: 20,
          height: 20,
          borderRadius: "50%",
          background: paper.paper,
          boxShadow: "0 1px 3px rgba(0,0,0,0.25)",
          transition: "left 0.18s",
        }}
      />
    </div>
  );
}

// ── Car accordion (tile + edit form) ─────────────────────────
function CarAccordion({
  car,
  expanded,
  onToggle,
  displayPrice,
  year,
  hasPnl,
}: {
  car: Car;
  expanded: boolean;
  onToggle: () => void;
  displayPrice: number;
  year: number;
  hasPnl: boolean;
}) {
  const router = useRouter();
  const t = useT();
  const updateCar = useUpdateCar();
  const deleteCar = useDeleteCar();
  const { data: me } = useMe();
  const { data: people = [] } = usePeople();
  const currentYear = new Date().getFullYear();
  const [name, setName] = useState(car.name);
  const [price, setPrice] = useState(car.price_per_km);
  const [activeLocal, setActiveLocal] = useState(car.active !== 0);
  const [ownerPersonId, setOwnerPersonId] = useState<number | null>(car.owner_person_id ?? null);
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  const [prevId, setPrevId] = useState(car.id);
  if (car.id !== prevId) {
    setPrevId(car.id);
    setName(car.name);
    setPrice(car.price_per_km);
    setActiveLocal(car.active !== 0);
    setOwnerPersonId(car.owner_person_id ?? null);
    setDeleteConfirm(false);
  }

  const dirty =
    name !== car.name ||
    price !== car.price_per_km ||
    activeLocal !== (car.active !== 0) ||
    ownerPersonId !== (car.owner_person_id ?? null);

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
  function resetForm() {
    setName(car.name);
    setPrice(car.price_per_km);
    setActiveLocal(car.active !== 0);
    setOwnerPersonId(car.owner_person_id ?? null);
    setDeleteConfirm(false);
  }

  function handleSave() {
    updateCar.mutate(
      {
        ...car,
        name,
        price_per_km: price,
        active: activeLocal ? 1 : 0,
        owner_person_id: ownerPersonId,
      },
      {
        onSuccess: () => {
          onToggle();
          toast.success(t("toast.saved"));
        },
      }
    );
  }

  function handleDelete() {
    if (!deleteConfirm) {
      setDeleteConfirm(true);
      return;
    }
    deleteCar.mutate(car.id, {
      onError: (err: unknown) => {
        const apiErr = err as { status?: number; message?: string };
        toast.error(
          apiErr.status === 409 ? t("owner.car_has_history") : (apiErr.message ?? "Error")
        );
        setDeleteConfirm(false);
      },
    });
  }

  return (
    <div
      style={{
        background: car.active !== 0 ? paper.paper : paper.paperDeep,
        marginBottom: 6,
        boxShadow: "0 1px 2px rgba(0,0,0,0.05), 0 4px 16px rgba(0,0,0,0.06)",
        borderLeft: expanded ? `3px solid ${paper.blue}` : "3px solid transparent",
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
        <CarBadge short={car.short} active={car.active !== 0} />
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
          {car.owner_person_id ? (
            displayName(
              people.find((p) => p.id === car.owner_person_id) ?? {
                first_name: "?",
                username: null,
              }
            )
          ) : (
            <span style={{ color: paper.inkDim, fontStyle: "italic" }}>—</span>
          )}
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
          €{displayPrice.toFixed(2)}/km
        </div>
      </div>

      {/* Expanded edit form */}
      {expanded && (
        <div style={{ padding: "0 14px 14px", borderTop: `1px dashed ${paper.paperDark}` }}>
          <div style={{ paddingTop: 12, marginBottom: 8 }}>
            <label style={labelStyle}>{t("form.name")}</label>
            <input value={name} onChange={(e) => setName(e.target.value)} style={inputStyle} />
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={labelStyle}>{t("form.price_per_km")}</label>
            <div style={{ display: "flex", gap: 6 }}>
              <input
                type="number"
                step="0.005"
                value={price}
                onChange={(e) => setPrice(parseFloat(e.target.value) || 0)}
                style={{ ...inputStyle, flex: 1 }}
              />
              {hasPnl && (
                <button
                  onClick={() => {
                    const p = new URLSearchParams();
                    p.set("view", "detail");
                    p.set("car", String(car.id));
                    if (year !== currentYear) p.set("year", String(year));
                    router.push(`/admin/vehicles?${p.toString()}`);
                  }}
                  style={{
                    fontFamily: fontMono,
                    fontSize: 10,
                    fontWeight: 700,
                    padding: "0 10px",
                    background: paper.blue,
                    color: paper.paper,
                    border: "none",
                    cursor: "pointer",
                    flexShrink: 0,
                  }}
                >
                  ✦
                </button>
              )}
            </div>
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 16,
            }}
          >
            <label style={labelStyle}>
              {activeLocal ? t("admin.car_active") : t("admin.car_inactive")}
            </label>
            <Toggle value={activeLocal} onChange={setActiveLocal} />
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={labelStyle}>Eigenaar (persoon)</label>
            {me?.isAdmin ? (
              <select
                value={ownerPersonId ?? ""}
                onChange={(e) => setOwnerPersonId(e.target.value ? Number(e.target.value) : null)}
                style={inputStyle}
              >
                <option value="">— geen —</option>
                {people.map((p) => (
                  <option key={p.id} value={p.id}>
                    {displayName(p)}
                  </option>
                ))}
              </select>
            ) : (
              <div
                style={{
                  ...inputStyle,
                  color: paper.inkDim,
                  background: paper.paperDark,
                  cursor: "default",
                }}
              >
                {car.owner_person_id
                  ? displayName(
                      people.find((p) => p.id === car.owner_person_id) ?? {
                        first_name: "?",
                        username: null,
                      }
                    )
                  : "—"}
              </div>
            )}
          </div>
          <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
            <button
              onClick={() => {
                resetForm();
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
              disabled={!dirty || updateCar.isPending}
              onClick={handleSave}
              style={{
                flex: 2,
                padding: "9px",
                background: dirty && !updateCar.isPending ? paper.ink : paper.paperDark,
                color: dirty && !updateCar.isPending ? paper.paper : paper.inkMute,
                border: "none",
                cursor: dirty && !updateCar.isPending ? "pointer" : "default",
                fontFamily: fontMono,
                fontSize: 9,
                fontWeight: 700,
                letterSpacing: 2,
                textTransform: "uppercase",
              }}
            >
              {updateCar.isPending ? "…" : t("action.save")}
            </button>
          </div>
          <button
            onClick={handleDelete}
            disabled={deleteCar.isPending}
            style={{
              width: "100%",
              padding: "9px",
              background: deleteConfirm ? paper.accent : "transparent",
              color: deleteConfirm ? paper.paper : paper.accent,
              border: `1px solid ${paper.accent}`,
              cursor: "pointer",
              fontFamily: fontMono,
              fontSize: 9,
              fontWeight: 700,
              letterSpacing: 1.5,
              textTransform: "uppercase",
            }}
          >
            {deleteCar.isPending
              ? "…"
              : deleteConfirm
                ? t("owner.delete_confirm")
                : t("action.delete")}
          </button>
          {deleteConfirm && (
            <button
              onClick={() => setDeleteConfirm(false)}
              style={{
                width: "100%",
                marginTop: 4,
                padding: "6px",
                background: "transparent",
                color: paper.inkDim,
                border: `1px solid ${paper.paperDark}`,
                cursor: "pointer",
                fontFamily: fontMono,
                fontSize: 8,
                letterSpacing: 1,
              }}
            >
              {t("action.cancel")}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ── Add car form ──────────────────────────────────────────────
function AddCarForm({ onBack }: { onBack: () => void }) {
  const t = useT();
  const createCar = useCreateCar();
  const { data: me } = useMe();
  const { data: people = [] } = usePeople();
  const inputStyle = sharedInputStyle;
  const labelStyle = sharedLabelStyle;
  const [name, setName] = useState("");
  const [short, setShort] = useState("");
  const [price, setPrice] = useState(0.2);
  const [ownerPersonId, setOwnerPersonId] = useState<number | null>(
    me?.isAdmin ? null : (me?.personId ?? null)
  );

  const valid =
    name.trim().length > 0 && short.trim().length > 0 && short.length <= 10 && price > 0;

  function handleSubmit() {
    if (!valid || createCar.isPending) return;
    createCar.mutate(
      {
        short: short.toUpperCase(),
        name,
        price_per_km: price,
        owner_person_id: ownerPersonId,
      } as Omit<Car, "id">,
      { onSuccess: onBack }
    );
  }

  return (
    <div style={{ background: paper.paperDeep }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 16px",
          height: 52,
          borderBottom: `1.5px solid ${paper.paperDark}`,
          background: paper.paper,
          position: "sticky",
          top: 0,
          zIndex: 10,
          borderRadius: "14px 14px 0 0",
        }}
      >
        <button
          type="button"
          onClick={onBack}
          style={{
            fontFamily: fontMono,
            fontSize: 18,
            fontWeight: 700,
            background: "transparent",
            border: "none",
            cursor: "pointer",
            color: paper.ink,
            padding: "0 4px",
            lineHeight: 1,
          }}
        >
          ×
        </button>
        <div
          style={{
            fontFamily: fontMono,
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: 3,
            color: paper.inkDim,
            textTransform: "uppercase",
          }}
        >
          {t("owner.add_car")}
        </div>
        <button
          type="button"
          disabled={!valid || createCar.isPending}
          onClick={handleSubmit}
          style={{
            fontFamily: fontMono,
            fontSize: 9,
            fontWeight: 700,
            letterSpacing: 2,
            textTransform: "uppercase",
            background: valid && !createCar.isPending ? paper.accent : paper.paperDark,
            color: valid && !createCar.isPending ? "#fff" : paper.inkMute,
            border: "none",
            padding: "8px 14px",
            cursor: valid && !createCar.isPending ? "pointer" : "default",
          }}
        >
          {createCar.isPending ? "…" : t("action.add")}
        </button>
      </div>
      <div style={{ padding: "16px" }}>
        <div style={{ marginBottom: 8 }}>
          <label style={labelStyle}>{t("form.name")}</label>
          <input value={name} onChange={(e) => setName(e.target.value)} style={inputStyle} />
        </div>
        <div style={{ marginBottom: 8 }}>
          <label style={labelStyle}>{t("form.short")}</label>
          <input
            value={short}
            onChange={(e) => setShort(e.target.value.toUpperCase())}
            maxLength={10}
            placeholder="ETH"
            style={inputStyle}
          />
        </div>
        <div style={{ marginBottom: 8 }}>
          <label style={labelStyle}>{t("form.price_per_km")}</label>
          <input
            type="number"
            step="0.005"
            min="0.01"
            value={price}
            onChange={(e) => setPrice(parseFloat(e.target.value) || 0)}
            style={inputStyle}
          />
        </div>
        <div style={{ marginBottom: 16 }}>
          <label style={labelStyle}>Eigenaar (persoon)</label>
          {me?.isAdmin ? (
            <select
              value={ownerPersonId ?? ""}
              onChange={(e) => setOwnerPersonId(e.target.value ? Number(e.target.value) : null)}
              style={inputStyle}
            >
              <option value="">— geen —</option>
              {people.map((p) => (
                <option key={p.id} value={p.id}>
                  {displayName(p)}
                </option>
              ))}
            </select>
          ) : (
            <div
              style={{
                ...inputStyle,
                color: paper.inkDim,
                background: paper.paperDark,
                cursor: "default",
              }}
            >
              {me?.shortName ?? "—"}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Helper: find effective price for a given year ─────────────
function priceForYear(
  carId: number,
  year: number,
  history: CarPriceHistory[],
  fallback: number
): number {
  const cutoff = `${year}-12-31`;
  const match = history
    .filter((h) => h.car_id === carId && h.effective_from <= cutoff)
    .sort((a, b) => b.effective_from.localeCompare(a.effective_from))[0];
  return match?.price_per_km ?? fallback;
}

// ── Helper: generate markdown report for a car/year ───────────
function generateCarDetailMd(car: CarPnL, year: number): string {
  const fmt = (n: number) =>
    n.toLocaleString("nl-BE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const fmtL = (n: number) =>
    n.toLocaleString("nl-BE", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const othersRevenue = car.trip_revenue - car.owner_trip_amount;
  const ytdNet = othersRevenue - car.variable_total;

  const lines: string[] = [];
  lines.push(`# ${car.car_name} — ${year}`);
  if (car.owner_name) lines.push(`Eigenaar: ${car.owner_name}`);

  lines.push(`\n## Ritten`);
  lines.push(`${car.trip_count} ritten · ${car.trip_km.toLocaleString("nl-BE")} km`);
  lines.push(
    `- Anderen: ${car.trip_count - car.owner_trip_count} rit. · ${(car.trip_km - car.owner_trip_km).toLocaleString("nl-BE")} km · € ${fmt(othersRevenue)}`
  );
  lines.push(
    `- Eigen:   ${car.owner_trip_count} rit. · ${car.owner_trip_km.toLocaleString("nl-BE")} km · € ${fmt(car.owner_trip_amount)}`
  );

  lines.push(`\n## Tankbeurten`);
  lines.push(
    `${car.fuel_count} tankbeurten · ${fmtL(car.fuel_liters)} L · € ${fmt(car.fuel_amount)}`
  );
  lines.push(
    `- Anderen: ${car.fuel_count - car.owner_fuel_count} tk. · ${fmtL(car.fuel_liters - car.owner_fuel_liters)} L · € ${fmt(car.fuel_amount - car.owner_fuel_amount)}`
  );
  lines.push(
    `- Eigen:   ${car.owner_fuel_count} tk. · ${fmtL(car.owner_fuel_liters)} L · € ${fmt(car.owner_fuel_amount)}`
  );

  lines.push(`\n## Kosten`);
  lines.push(`${car.expense_count} kosten · € ${fmt(car.expense_amount)}`);
  lines.push(
    `- Anderen: ${car.expense_count - car.owner_expense_count} kst. · € ${fmt(car.expense_amount - car.owner_expense_amount)}`
  );
  lines.push(`- Eigen:   ${car.owner_expense_count} kst. · € ${fmt(car.owner_expense_amount)}`);

  lines.push(`\n## Resultaat`);
  lines.push(`- Inkomsten ritten (anderen): € ${fmt(othersRevenue)}`);
  lines.push(`- Variabele kosten:           € ${fmt(car.variable_total)}`);
  lines.push(`- Netto:                      ${ytdNet >= 0 ? "+" : "−"}€ ${fmt(Math.abs(ytdNet))}`);

  const fuelPerKm = car.trip_km > 0 ? car.fuel_amount / car.trip_km : 0;
  const pctOthers =
    car.trip_km > 0 ? Math.round(((car.trip_km - car.owner_trip_km) / car.trip_km) * 100) / 100 : 0;
  const nonOwnerKm = car.trip_km * pctOthers;
  const ownerKm = car.trip_km * (1 - pctOthers);
  const markupPerKm = car.car_price_per_km - fuelPerKm;
  const nonOwnerMarkup = markupPerKm * nonOwnerKm;
  const ownerFuelCost = fuelPerKm * ownerKm;
  const ownerNet = nonOwnerMarkup - car.expense_amount - ownerFuelCost;

  lines.push(`\n## Kostendekking`);
  lines.push(`- Brandstof/km:    € ${fuelPerKm.toFixed(3)}/km`);
  lines.push(`- Totale km/jaar:  ${car.trip_km.toLocaleString("nl-BE")} km`);
  lines.push(`- % anderen:       ${Math.round(pctOthers * 100)}%`);
  lines.push(`- Verwachte kosten: € ${fmt(car.expense_amount)}`);
  lines.push(`- Prijs/km:        € ${car.car_price_per_km.toFixed(3)}/km`);
  lines.push(`\n### Prognose`);
  lines.push(`- Bijdrage anderen: € ${fmt(nonOwnerMarkup)}`);
  lines.push(`- Te dekken kosten: € ${fmt(car.expense_amount)}`);
  lines.push(`- Eigen brandstof:  € ${fmt(ownerFuelCost)}`);
  lines.push(`- Eigenaar netto:   ${ownerNet >= 0 ? "+" : "−"}€ ${fmt(Math.abs(ownerNet))}`);

  return lines.join("\n");
}

// ── Fleet + detail view ───────────────────────────────────────
function OwnerFleet() {
  const t = useT();
  const currentYear = new Date().getFullYear();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();

  const { data: earliestYear = currentYear } = useEarliestDashboardYear();

  const yearParam = searchParams.get("year");
  const viewParam = searchParams.get("view");
  const carParam = searchParams.get("car");
  const screenCarId = carParam ? parseInt(carParam, 10) : null;
  const year = yearParam ? parseInt(yearParam, 10) : currentYear;

  const adding = searchParams.get("action") === "add";
  const openAdd = () => {
    const p = new URLSearchParams(searchParams.toString());
    p.set("action", "add");
    router.push(`${pathname}?${p.toString()}`, { scroll: false });
  };
  const closeAdd = () => router.back();

  const setYear = (newYear: number) => {
    const p = new URLSearchParams(searchParams.toString());
    if (newYear === currentYear) p.delete("year");
    else p.set("year", String(newYear));
    router.replace(`${pathname}?${p.toString()}`, { scroll: false });
  };

  const { data: cars = [] } = useCars();
  const { data: summary } = useAdminSummary(year);
  const { data: me } = useMe();

  const carMap = new Map(cars.map((c) => [c.id, c]));
  const myCars = me?.isAdmin ? cars : cars.filter((c) => c.owner_person_id === me?.personId);
  const allPnL = summary?.carPnL ?? [];
  const historicalKm = summary?.historicalCarKm ?? [];
  const historicalExpensesAll = summary?.historicalExpenses ?? [];
  const rollingFuel = summary?.rollingFuelPerKm ?? [];
  const ownerSplitAll = summary?.historicalOwnerSplit ?? [];
  const priceHistory = summary?.priceHistory ?? [];

  const [expandedId, setExpandedId] = useState<number | null>(null);

  // Coverage-card collapse, kept here (parent survives year switches, which
  // remount CostCoverageScreen via its key) and keyed per car. Absent = expanded.
  const [coverageExpanded, setCoverageExpanded] = useState<Record<number, boolean>>({});

  const goToFleet = () => {
    const p = new URLSearchParams();
    if (year !== currentYear) p.set("year", String(year));
    const qs = p.toString();
    router.push(`${pathname}${qs ? `?${qs}` : ""}`, { scroll: false });
  };

  const yearSelector = (
    <div
      style={{ display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 16 }}
    >
      <button
        onClick={() => setYear(year - 1)}
        disabled={year <= earliestYear}
        style={{
          padding: "6px 14px",
          background: "transparent",
          border: `1.5px solid ${paper.ink}`,
          fontFamily: fontMono,
          fontSize: 10,
          fontWeight: 700,
          color: year <= earliestYear ? paper.inkMute : paper.ink,
          cursor: year <= earliestYear ? "default" : "pointer",
          letterSpacing: 1,
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
          marginLeft: -1.5,
          marginRight: -1.5,
        }}
      >
        {year}
      </div>
      <button
        onClick={() => setYear(year + 1)}
        disabled={year >= currentYear}
        style={{
          padding: "6px 14px",
          background: "transparent",
          border: `1.5px solid ${paper.ink}`,
          fontFamily: fontMono,
          fontSize: 10,
          fontWeight: 700,
          color: year >= currentYear ? paper.inkMute : paper.ink,
          cursor: year >= currentYear ? "default" : "pointer",
          letterSpacing: 1,
        }}
      >
        {year + 1} →
      </button>
    </div>
  );

  if (viewParam === "detail" && screenCarId) {
    const pnlCar = allPnL.find((c) => c.car_id === screenCarId);
    if (!pnlCar)
      return (
        <div style={{ padding: 16 }}>
          {yearSelector}
          <div style={{ fontFamily: fontMono, fontSize: 11, color: paper.inkDim }}>
            geen data voor dit jaar
          </div>
        </div>
      );
    const carRollingFuel = rollingFuel.find((r) => r.car_id === screenCarId);
    function handleDownload() {
      const md = generateCarDetailMd(pnlCar!, year);
      const blob = new Blob([md], { type: "text/markdown" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${pnlCar!.car_name.toLowerCase()}-${year}.md`;
      a.click();
      URL.revokeObjectURL(url);
    }
    return (
      <div style={{ padding: "16px" }}>
        <div style={{ position: "relative" }}>
          {yearSelector}
          <button
            onClick={goToFleet}
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              padding: "6px 10px",
              background: "transparent",
              border: `1.5px solid ${paper.ink}`,
              color: paper.ink,
              cursor: "pointer",
              fontFamily: fontMono,
              fontSize: 12,
              lineHeight: 1,
            }}
          >
            ←
          </button>
          <button
            onClick={handleDownload}
            title="Download als .md"
            style={{
              position: "absolute",
              right: 0,
              top: 0,
              padding: "6px 10px",
              background: "transparent",
              border: `1.5px solid ${paper.ink}`,
              color: paper.ink,
              cursor: "pointer",
              fontFamily: fontMono,
              fontSize: 12,
              lineHeight: 1,
            }}
          >
            ↓
          </button>
        </div>
        <CostCoverageScreen
          key={`${screenCarId}-${year}`}
          car={pnlCar}
          fullCar={carMap.get(screenCarId)}
          historicalKm={historicalKm.filter((h) => h.car_id === screenCarId)}
          ownerSplit={ownerSplitAll.filter((s) => s.car_id === screenCarId)}
          historicalExpenses={historicalExpensesAll.filter((e) => e.car_id === screenCarId)}
          priceHistory={priceHistory.filter((h) => h.car_id === screenCarId)}
          rollingFuelPerKm={carRollingFuel?.fuel_per_km ?? 0}
          year={year}
          expanded={coverageExpanded[screenCarId] ?? true}
          onToggleExpanded={() =>
            setCoverageExpanded((m) => ({ ...m, [screenCarId]: !(m[screenCarId] ?? true) }))
          }
        />
      </div>
    );
  }

  // Fleet list
  const activeCars = myCars.filter((c) => c.active !== 0);
  const inactiveCars = myCars.filter((c) => c.active === 0);

  return (
    <div style={{ padding: "16px" }}>
      {yearSelector}

      <Fab onClick={openAdd} label={t("owner.add_car")} />

      {activeCars.map((car) => (
        <CarAccordion
          key={car.id}
          car={car}
          expanded={expandedId === car.id}
          onToggle={() => setExpandedId(expandedId === car.id ? null : car.id)}
          displayPrice={priceForYear(car.id, year, priceHistory, car.price_per_km)}
          year={year}
          hasPnl={!!allPnL.find((c) => c.car_id === car.id)}
        />
      ))}
      {inactiveCars.length > 0 && (
        <>
          <div
            style={{
              borderTop: `1.5px dashed ${paper.ink}`,
              margin: "12px 0 10px",
            }}
          />
          <div
            style={{
              fontFamily: fontMono,
              fontSize: 9,
              fontWeight: 700,
              letterSpacing: 1.5,
              textTransform: "uppercase",
              color: paper.inkDim,
              marginBottom: 8,
            }}
          >
            {t("admin.car_deactivated_section")}
          </div>
          {inactiveCars.map((car) => (
            <CarAccordion
              key={car.id}
              car={car}
              expanded={expandedId === car.id}
              onToggle={() => setExpandedId(expandedId === car.id ? null : car.id)}
              displayPrice={priceForYear(car.id, year, priceHistory, car.price_per_km)}
              year={year}
              hasPnl={!!allPnL.find((c) => c.car_id === car.id)}
            />
          ))}
        </>
      )}
      {myCars.length === 0 && (
        <div style={{ fontFamily: fontMono, fontSize: 11, color: paper.inkDim }}>
          {t("owner.no_cars")}
        </div>
      )}

      <Dialog.Root
        open={adding}
        onOpenChange={(open) => {
          if (!open) closeAdd();
        }}
      >
        <Dialog.Portal>
          <Dialog.Overlay style={overlayStyle} />
          <Dialog.Content style={sheetStyle} aria-describedby={undefined}>
            <Dialog.Title
              style={{
                position: "absolute",
                width: 1,
                height: 1,
                overflow: "hidden",
                clip: "rect(0,0,0,0)",
              }}
            >
              {t("owner.add_car")}
            </Dialog.Title>
            <AddCarForm onBack={closeAdd} />
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────
function displayName(p: {
  first_name?: string | null;
  last_name?: string | null;
  username?: string | null;
}): string {
  return shortNameOf(p) || "?";
}

export default function AdminVehiclesPage() {
  return (
    <Suspense>
      <OwnerFleet />
    </Suspense>
  );
}
