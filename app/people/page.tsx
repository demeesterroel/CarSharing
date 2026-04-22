"use client";
import { useState } from "react";
import { toast } from "sonner";
import * as Dialog from "@radix-ui/react-dialog";
import { PageHeader } from "@/components/page-header";
import { Fab } from "@/components/fab";
import { PersonForm } from "./person-form";
import { usePeople, useCreatePerson, useUpdatePerson } from "@/hooks/use-people";
import type { Person } from "@/types";
import { paper, fontMono, fontSerif } from "@/lib/paper-theme";
import { useT } from "@/components/locale-provider";

const sheetStyle: React.CSSProperties = {
  position: "fixed", left: 0, right: 0, bottom: 0, background: paper.paper,
  borderRadius: "16px 16px 0 0", zIndex: 50, maxHeight: "95vh",
  overflowY: "auto", maxWidth: 480, margin: "0 auto",
};

export default function PeoplePage() {
  const t = useT();
  const { data: people = [], isLoading } = usePeople();
  const createPerson = useCreatePerson();
  const updatePerson = useUpdatePerson();
  const [editing, setEditing] = useState<Person | null>(null);
  const [adding, setAdding] = useState(false);

  if (isLoading) return (
    <div style={{ background: paper.paperDeep, minHeight: "100dvh" }}>
      <PageHeader title={t("page.people")} />
      <div style={{ padding: "32px 20px", fontFamily: fontMono, fontSize: 11, color: paper.inkMute, letterSpacing: 1 }}>{t("state.loading")}</div>
    </div>
  );

  return (
    <div style={{ background: paper.paperDeep, minHeight: "100dvh", paddingBottom: 80 }}>
      <PageHeader title={t("page.people")} />

      <div style={{ padding: "8px 16px" }}>
        {people.map((p) => (
          <button
            key={p.id}
            onClick={() => setEditing(p)}
            style={{
              width: "100%", display: "flex", alignItems: "center", gap: 12,
              padding: "12px 14px", marginBottom: 8,
              background: paper.paper, border: "none", cursor: "pointer", textAlign: "left",
              borderLeft: `3px solid ${p.active ? paper.ink : paper.inkMute}`,
              boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
            }}
          >
            <div style={{
              width: 8, height: 8, borderRadius: "50%", flexShrink: 0,
              background: p.active ? paper.green : paper.inkMute,
            }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: fontSerif, fontSize: 15, fontWeight: 600, color: p.active ? paper.ink : paper.inkDim }}>
                {p.name}
              </div>
              {(p.discount > 0 || p.discount_long > 0) && (
                <div style={{ fontFamily: fontMono, fontSize: 10, color: paper.inkDim, letterSpacing: 1, marginTop: 2 }}>
                  {p.discount > 0 ? `${p.discount}% ${t("form.discount")}` : ""}
                  {p.discount > 0 && p.discount_long > 0 ? " · " : ""}
                  {p.discount_long > 0 ? `${p.discount_long}% ${t("form.discount_long")}` : ""}
                </div>
              )}
            </div>
            {!p.active && (
              <div style={{
                padding: "2px 6px", background: paper.paperDark,
                fontFamily: fontMono, fontSize: 9, color: paper.inkMute, letterSpacing: 1, textTransform: "uppercase",
              }}>
                {t("person.inactive")}
              </div>
            )}
          </button>
        ))}
      </div>

      <Dialog.Root open={adding} onOpenChange={setAdding}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/40 z-40" />
          <Dialog.Content style={sheetStyle}>
            <Dialog.Title style={{ padding: "16px 20px 0", fontFamily: fontSerif, fontSize: 20, fontWeight: 700 }}>
              {t("page.person_add")}
            </Dialog.Title>
            <PersonForm
              onSubmit={(data) => {
                createPerson.mutate(data as Omit<Person, "id">, {
                  onSuccess: () => { setAdding(false); toast.success(t("toast.person_added")); },
                  onError: (e) => toast.error(e.message),
                });
              }}
              onCancel={() => setAdding(false)}
            />
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      <Dialog.Root open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/40 z-40" />
          <Dialog.Content style={sheetStyle}>
            <Dialog.Title style={{ padding: "16px 20px 0", fontFamily: fontSerif, fontSize: 20, fontWeight: 700 }}>
              {t("page.person_edit")}
            </Dialog.Title>
            {editing && (
              <PersonForm
                defaultValues={editing}
                onSubmit={(data) => {
                  updatePerson.mutate({ ...editing, ...data }, {
                    onSuccess: () => { setEditing(null); toast.success(t("toast.saved")); },
                    onError: (e) => toast.error(e.message),
                  });
                }}
                onCancel={() => setEditing(null)}
              />
            )}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      <Fab onClick={() => setAdding(true)} label={t("page.person_add")} />
    </div>
  );
}
