"use client";
import { Fab } from "@/components/fab";
import { useT } from "@/components/locale-provider";
import { PageHeader } from "@/components/page-header";
import { usePeople } from "@/hooks/use-people";
import { useCars, useCreateCar, useUpdateCar } from "@/hooks/use-vehicles";
import { shortNameOf } from "@/lib/person-utils";
import { fontMono, fontSerif, tokens } from "@/lib/theme-tokens";
import type { Car } from "@/types";
import * as Dialog from "@radix-ui/react-dialog";
import { useState } from "react";
import { toast } from "sonner";
import { CarForm } from "./car-form";

const sheetStyle: React.CSSProperties = {
  position: "fixed",
  left: 0,
  right: 0,
  bottom: 0,
  background: tokens.paper,
  borderRadius: "16px 16px 0 0",
  zIndex: 50,
  maxHeight: "95vh",
  overflowY: "auto",
  maxWidth: 480,
  margin: "0 auto",
};

export default function CarsPage() {
  const t = useT();
  const { data: cars = [], isLoading } = useCars();
  const { data: people = [] } = usePeople();
  const createCar = useCreateCar();
  const updateCar = useUpdateCar();
  const [editing, setEditing] = useState<Car | null>(null);
  const [adding, setAdding] = useState(false);

  if (isLoading)
    return (
      <div style={{ background: tokens.paperDeep, minHeight: "100dvh" }}>
        <PageHeader title={t("page.cars")} />
        <div
          style={{
            padding: "32px 20px",
            fontFamily: fontMono,
            fontSize: 11,
            color: tokens.inkDim,
            letterSpacing: 1,
          }}
        >
          {t("state.loading")}
        </div>
      </div>
    );

  return (
    <div style={{ background: tokens.paperDeep, minHeight: "100dvh", paddingBottom: 80 }}>
      <PageHeader title={t("page.cars")} />

      <div style={{ padding: "8px 16px" }}>
        {cars.map((c) => (
          <button
            key={c.id}
            onClick={() => setEditing(c)}
            style={{
              width: "100%",
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: "12px 14px",
              marginBottom: 8,
              background: tokens.paper,
              border: "none",
              cursor: "pointer",
              textAlign: "left",
              borderLeft: `3px solid ${tokens.blue}`,
              boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
            }}
          >
            <div
              style={{
                padding: "6px 8px",
                background: tokens.ink,
                color: tokens.paper,
                fontFamily: fontMono,
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: 2,
                flexShrink: 0,
                minWidth: 42,
                textAlign: "center",
              }}
            >
              {c.short}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontFamily: fontSerif,
                  fontSize: 15,
                  fontWeight: 600,
                  color: tokens.ink,
                  lineHeight: 1.2,
                }}
              >
                {c.name}
              </div>
              <div
                style={{
                  fontFamily: fontMono,
                  fontSize: 10,
                  color: tokens.inkDim,
                  letterSpacing: 1,
                  marginTop: 2,
                }}
              >
                {[c.brand, c.color].filter(Boolean).join(" · ")}
                {c.brand || c.color ? " · " : ""}€{c.price_per_km}/km
              </div>
            </div>
            {c.owner_person_id &&
              (() => {
                const owner = people.find((p) => p.id === c.owner_person_id);
                return owner ? (
                  <div
                    style={{
                      padding: "2px 6px",
                      background: tokens.paperDark,
                      fontFamily: fontMono,
                      fontSize: 9,
                      color: tokens.inkDim,
                      letterSpacing: 1,
                    }}
                  >
                    {shortNameOf(owner)}
                  </div>
                ) : null;
              })()}
          </button>
        ))}
      </div>

      <Dialog.Root open={adding} onOpenChange={setAdding}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/40 z-40" />
          <Dialog.Content style={sheetStyle}>
            <Dialog.Title
              style={{
                padding: "16px 20px 0",
                fontFamily: fontSerif,
                fontSize: 20,
                fontWeight: 700,
              }}
            >
              {t("page.car_add")}
            </Dialog.Title>
            <CarForm
              onSubmit={(data) =>
                createCar.mutate(
                  { ...data, brand: data.brand ?? null, color: data.color ?? null } as Omit<
                    Car,
                    "id"
                  >,
                  {
                    onSuccess: () => {
                      setAdding(false);
                      toast.success(t("toast.car_added"));
                    },
                    onError: (e) => toast.error(e.message),
                  }
                )
              }
              onCancel={() => setAdding(false)}
            />
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      <Dialog.Root open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/40 z-40" />
          <Dialog.Content style={sheetStyle}>
            <Dialog.Title
              style={{
                padding: "16px 20px 0",
                fontFamily: fontSerif,
                fontSize: 20,
                fontWeight: 700,
              }}
            >
              {t("page.car_edit")}
            </Dialog.Title>
            {editing && (
              <CarForm
                defaultValues={editing}
                onSubmit={(data) =>
                  updateCar.mutate(
                    { ...editing, ...data, brand: data.brand ?? null, color: data.color ?? null },
                    {
                      onSuccess: () => {
                        setEditing(null);
                        toast.success(t("toast.saved"));
                      },
                      onError: (e) => toast.error(e.message),
                    }
                  )
                }
                onCancel={() => setEditing(null)}
              />
            )}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      <Fab onClick={() => setAdding(true)} label={t("page.car_add")} />
    </div>
  );
}
