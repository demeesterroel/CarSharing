"use client";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { PersonSelect } from "@/components/person-select";
import { usePeople } from "@/hooks/use-people";
import type { Payment, PaymentInput } from "@/types";
import { t } from "@/lib/i18n";

const schema = z.object({
  person_id: z.number({ required_error: t("validation.person_required") }),
  date: z.string().min(1),
  amount: z.coerce.number().positive(),
  note: z.string().nullable().optional(),
});
type FormData = z.infer<typeof schema>;

interface Props {
  defaultValues?: Partial<Payment>;
  onSubmit: (data: PaymentInput) => void;
  onCancel: () => void;
}

export function PaymentForm({ defaultValues, onSubmit, onCancel }: Props) {
  const { data: people = [] } = usePeople();
  const { register, handleSubmit, control } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      date: new Date().toISOString().slice(0, 10),
      amount: 0,
      note: null,
      ...defaultValues,
    },
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 p-4">
      <div>
        <label className="block text-sm font-medium mb-1">{t("form.name")}</label>
        <Controller
          name="person_id"
          control={control}
          render={({ field }) => (
            <PersonSelect people={people} value={field.value} onChange={field.onChange} />
          )}
        />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">{t("form.date")}</label>
        <input {...register("date")} type="date" className="w-full border rounded-md px-3 py-2 text-sm" />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">{t("form.amount_euro")}</label>
        <input {...register("amount")} type="number" step="0.01" className="w-full border rounded-md px-3 py-2 text-sm" />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">{t("form.note")}</label>
        <input {...register("note")} className="w-full border rounded-md px-3 py-2 text-sm"
          placeholder={t("form.note_placeholder")} />
      </div>
      <div className="flex gap-3 pt-2">
        <button type="button" onClick={onCancel} className="flex-1 border rounded-md py-2 text-sm">{t("action.cancel")}</button>
        <button type="submit" className="flex-1 bg-blue-600 text-white rounded-md py-2 text-sm">{t("action.save")}</button>
      </div>
    </form>
  );
}
