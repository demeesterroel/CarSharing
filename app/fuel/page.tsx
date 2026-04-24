"use client";
import { useState } from "react";
import { toast } from "sonner";
import * as Dialog from "@radix-ui/react-dialog";
import { PageHeader } from "@/components/page-header";
import { GroupedList } from "@/components/grouped-list";
import { Fab } from "@/components/fab";
import { FuelForm } from "./fuel-form";
import { useFuelFillups, useCreateFuelFillup, useUpdateFuelFillup, useDeleteFuelFillup } from "@/hooks/use-fuel-fillups";
import { useMe } from "@/hooks/use-me";
import type { FuelFillup } from "@/types";
import { paper, fontMono, fontSerif, fmtMoney, fmtYearMonth } from "@/lib/paper-theme";
import { useT } from "@/components/locale-provider";

const overlayStyle: React.CSSProperties = {
  position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 49,
};
const sheetStyle: React.CSSProperties = {
  position: "fixed", bottom: 0,
  left: "50%", transform: "translateX(-50%)",
  width: "min(100%, 480px)",
  maxHeight: "92dvh", borderRadius: "14px 14px 0 0",
  background: paper.paperDeep, zIndex: 50, overflowY: "auto",
};

export default function FuelPage() {
  const t = useT();
  const { data: fillups = [], isLoading } = useFuelFillups();
  const { data: me } = useMe();
  const createF = useCreateFuelFillup();
  const updateF = useUpdateFuelFillup();
  const deleteF = useDeleteFuelFillup();
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<FuelFillup | null>(null);
  const [filter, setFilter] = useState<"all" | "mine">("all");
  const [carFilter, setCarFilter] = useState<string | null>(null);

  const canFilter = me?.personId != null;
  const cars = Array.from(new Set(fillups.map((f) => f.car_short).filter((s): s is string => !!s))).sort();

  const visible = fillups
    .filter((f) => filter === "mine" && canFilter ? f.person_id === me!.personId : true)
    .filter((f) => carFilter ? f.car_short === carFilter : true);

  if (isLoading) return (
    <div style={{ background: paper.paperDeep, minHeight: "100dvh" }}>
      <PageHeader title={t("page.fuel")} />
      <div style={{ padding: "32px 20px", fontFamily: fontMono, fontSize: 11, color: paper.inkMute, letterSpacing: 1 }}>{t("state.loading")}</div>
    </div>
  );

  return (
    <div style={{ background: paper.paperDeep, minHeight: "100dvh", paddingBottom: 80 }}>
      <PageHeader title={t("page.fuel")} />

      <div style={{ padding: "10px 16px 8px", borderBottom: `1px solid ${paper.paperDark}`, display: "flex", flexDirection: "column", gap: 6 }}>
        {canFilter && (
          <div style={{ display: "flex", gap: 0 }}>
            {(["mine", "all"] as const).map((v, i, arr) => (
              <button
                key={v}
                onClick={() => setFilter(v)}
                style={{
                  padding: "5px 12px",
                  background: filter === v ? paper.ink : "transparent",
                  color: filter === v ? paper.paper : paper.inkDim,
                  border: `1.5px solid ${paper.ink}`,
                  borderRight: i < arr.length - 1 ? "none" : `1.5px solid ${paper.ink}`,
                  fontFamily: fontMono, fontSize: 9, fontWeight: 700, letterSpacing: 2,
                  textTransform: "uppercase", cursor: "pointer",
                }}
              >
                {v === "all" ? t("filter.all") : t("filter.mine")}
              </button>
            ))}
          </div>
        )}
        {cars.length > 1 && (
          <div style={{ display: "flex", gap: 0 }}>
            {[null, ...cars].map((car, i, arr) => (
              <button
                key={car ?? "__all"}
                onClick={() => setCarFilter(car)}
                style={{
                  padding: "5px 12px",
                  background: carFilter === car ? paper.ink : "transparent",
                  color: carFilter === car ? paper.paper : paper.inkDim,
                  border: `1.5px solid ${paper.ink}`,
                  borderRight: i < arr.length - 1 ? "none" : `1.5px solid ${paper.ink}`,
                  fontFamily: fontMono, fontSize: 9, fontWeight: 700, letterSpacing: 2,
                  textTransform: "uppercase", cursor: "pointer",
                }}
              >
                {car ?? t("filter.all")}
              </button>
            ))}
          </div>
        )}
      </div>

      <GroupedList
        items={visible}
        getKey={(f) => f.date.slice(0, 7)}
        getGroupLabel={(key) => fmtYearMonth(key + "-01")}
        getGroupTotal={(items) => items.reduce((s, f) => s + f.amount, 0)}
        renderItem={(f) => (
          <button
            key={f.id}
            onClick={() => setEditing(f)}
            style={{
              width: "100%", display: "flex", alignItems: "center", gap: 12,
              padding: "12px 14px", marginBottom: 8,
              background: paper.paper, border: "none", cursor: "pointer", textAlign: "left",
              borderLeft: `3px solid ${paper.green}`,
              boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
            }}
          >
            <div style={{
              padding: "6px 8px", background: paper.ink, color: paper.paper,
              fontFamily: fontMono, fontSize: 11, fontWeight: 700, letterSpacing: 2, flexShrink: 0, minWidth: 42, textAlign: "center",
            }}>
              {f.car_short}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: fontSerif, fontSize: 15, fontWeight: 600, color: paper.ink, lineHeight: 1.2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                ⛽ {Number(f.liters).toFixed(1)} L getankt{f.full_tank ? " 🔋" : ""}
              </div>
              <div style={{ fontFamily: fontMono, fontSize: 10, color: paper.inkDim, letterSpacing: 1, marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {f.person_name} · {f.date}{f.location ? ` · ${f.location}` : ""}
              </div>
            </div>
            <div style={{ textAlign: "right", flexShrink: 0 }}>
              <div style={{ fontFamily: fontMono, fontSize: 14, fontWeight: 700, color: paper.green }}>{fmtMoney(f.amount)}</div>
              <div style={{ fontFamily: fontMono, fontSize: 10, color: paper.inkMute }}>€{Number(f.price_per_liter).toFixed(3)}/L</div>
            </div>
          </button>
        )}
      />

      {visible.length === 0 && (
        <div style={{ padding: "32px 20px", textAlign: "center", fontFamily: fontMono, fontSize: 11, color: paper.inkMute, letterSpacing: 1 }}>
          {t("state.empty_fuel")}
        </div>
      )}

      <Dialog.Root open={adding} onOpenChange={setAdding}>
        <Dialog.Portal>
          <Dialog.Overlay style={overlayStyle} />
          <Dialog.Content style={sheetStyle} aria-describedby={undefined}>
            <Dialog.Title style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0,0,0,0)" }}>
              {t("page.fuel_add")}
            </Dialog.Title>
            <FuelForm
              onSubmit={(data) => createF.mutate(data, {
                onSuccess: () => { setAdding(false); toast.success(t("toast.fuel_saved")); },
              })}
              onCancel={() => setAdding(false)}
            />
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      <Dialog.Root open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <Dialog.Portal>
          <Dialog.Overlay style={overlayStyle} />
          <Dialog.Content style={sheetStyle} aria-describedby={undefined}>
            <Dialog.Title style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0,0,0,0)" }}>
              {t("page.fuel_edit")}
            </Dialog.Title>
            {editing && (
              <FuelForm
                defaultValues={editing}
                onSubmit={(data) => updateF.mutate({ id: editing.id, ...data }, {
                  onSuccess: () => { setEditing(null); toast.success(t("toast.saved")); },
                })}
                onCancel={() => setEditing(null)}
                onDelete={() => deleteF.mutate(editing.id, {
                  onSuccess: () => { setEditing(null); toast.success(t("toast.deleted")); },
                })}
              />
            )}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      <Fab onClick={() => setAdding(true)} label={t("page.fuel_add")} />
    </div>
  );
}
