"use client";
import { useState } from "react";
import { toast } from "sonner";
import * as Dialog from "@radix-ui/react-dialog";
import { PageHeader } from "@/components/page-header";
import { Fab } from "@/components/fab";
import { PersonForm } from "./person-form";
import { usePeople, useCreatePerson, useUpdatePerson } from "@/hooks/use-people";
import type { Person } from "@/types";
import { ChevronRight } from "lucide-react";
import { t } from "@/lib/i18n";

export default function PeoplePage() {
  const { data: people = [], isLoading } = usePeople();
  const createPerson = useCreatePerson();
  const updatePerson = useUpdatePerson();
  const [editing, setEditing] = useState<Person | null>(null);
  const [adding, setAdding] = useState(false);

  if (isLoading) return <><PageHeader title={t("page.people")} /><p className="p-4 text-gray-500">{t("state.loading")}</p></>;

  return (
    <>
      <PageHeader title={t("page.people")} />
      <div className="divide-y">
        {people.map((p) => (
          <button
            key={p.id}
            onClick={() => setEditing(p)}
            className="w-full flex items-center px-4 py-3 hover:bg-gray-50 text-left gap-3"
          >
            <span className={`w-2 h-2 rounded-full ${p.active ? "bg-green-500" : "bg-gray-300"}`} />
            <span className="flex-1 text-sm font-medium">{p.name}</span>
            {p.discount > 0 && <span className="text-xs text-gray-500">{p.discount}</span>}
            <ChevronRight className="w-4 h-4 text-gray-400" />
          </button>
        ))}
      </div>

      <Dialog.Root open={adding} onOpenChange={setAdding}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/40 z-40" />
          <Dialog.Content className="fixed inset-x-0 bottom-0 bg-white rounded-t-xl z-50 max-h-[90vh] overflow-y-auto">
            <Dialog.Title className="px-4 pt-4 text-base font-semibold">{t("page.person_add")}</Dialog.Title>
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
          <Dialog.Content className="fixed inset-x-0 bottom-0 bg-white rounded-t-xl z-50 max-h-[90vh] overflow-y-auto">
            <Dialog.Title className="px-4 pt-4 text-base font-semibold">{t("page.person_edit")}</Dialog.Title>
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
    </>
  );
}
