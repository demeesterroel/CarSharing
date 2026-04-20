"use client";
import { useState } from "react";
import { toast } from "sonner";
import * as Dialog from "@radix-ui/react-dialog";
import { ChevronRight } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Fab } from "@/components/fab";
import { PaymentForm } from "./payment-form";
import { usePayments, useCreatePayment, useUpdatePayment, useDeletePayment } from "@/hooks/use-payments";
import type { Payment } from "@/types";
import { t } from "@/lib/i18n";

export default function PaymentsPage() {
  const { data: payments = [], isLoading } = usePayments();
  const createP = useCreatePayment();
  const updateP = useUpdatePayment();
  const deleteP = useDeletePayment();
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<Payment | null>(null);

  if (isLoading) return <><PageHeader title={t("page.payments")} /><p className="p-4 text-gray-500">{t("state.loading")}</p></>;

  return (
    <>
      <PageHeader title={t("page.payments")} />
      <div className="divide-y">
        {payments.map((b) => (
          <button key={b.id} onClick={() => setEditing(b)}
            className="w-full flex items-center px-4 py-3 hover:bg-gray-50 text-left gap-3">
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">{b.person_name}</span>
                <span className="text-xs bg-gray-100 px-1.5 py-0.5 rounded">{b.year}</span>
                <span className="text-xs text-gray-500 ml-auto">{b.date}</span>
              </div>
              <div className="flex items-center mt-0.5">
                <span className="text-xs text-gray-500">{b.note}</span>
                <span className="text-sm font-medium ml-auto">€ {b.amount.toFixed(2)}</span>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-gray-400" />
          </button>
        ))}
      </div>

      <Dialog.Root open={adding} onOpenChange={setAdding}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/40 z-40" />
          <Dialog.Content className="fixed inset-x-0 bottom-0 bg-white rounded-t-xl z-50 max-h-[90vh] overflow-y-auto">
            <Dialog.Title className="px-4 pt-4 text-base font-semibold">{t("page.payment_add")}</Dialog.Title>
            <PaymentForm
              onSubmit={(data) => createP.mutate(data, {
                onSuccess: () => { setAdding(false); toast.success(t("toast.payment_saved")); },
              })}
              onCancel={() => setAdding(false)}
            />
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      <Dialog.Root open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/40 z-40" />
          <Dialog.Content className="fixed inset-x-0 bottom-0 bg-white rounded-t-xl z-50 max-h-[90vh] overflow-y-auto">
            <Dialog.Title className="px-4 pt-4 text-base font-semibold">{t("page.payment_edit")}</Dialog.Title>
            {editing && (
              <>
                <PaymentForm
                  defaultValues={editing}
                  onSubmit={(data) => updateP.mutate({ id: editing.id, ...data }, {
                    onSuccess: () => { setEditing(null); toast.success(t("toast.saved")); },
                  })}
                  onCancel={() => setEditing(null)}
                />
                <div className="px-4 pb-4">
                  <button onClick={() => deleteP.mutate(editing.id, {
                    onSuccess: () => { setEditing(null); toast.success(t("toast.deleted")); },
                  })} className="w-full border border-red-300 text-red-600 rounded-md py-2 text-sm">
                    {t("action.delete")}
                  </button>
                </div>
              </>
            )}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      <Fab onClick={() => setAdding(true)} label={t("page.payment_add")} />
    </>
  );
}
