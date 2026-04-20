"use client";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import type { Person } from "@/types";
import { t } from "@/lib/i18n";

const schema = z.object({
  name: z.string().min(1, t("validation.name_required")),
  discount: z.coerce.number().min(0).max(1),
  discount_long: z.coerce.number().min(0).max(1),
  active: z.coerce.number().int().min(0).max(1),
});
type FormData = z.infer<typeof schema>;

interface Props {
  defaultValues?: Partial<Person>;
  onSubmit: (data: FormData) => void;
  onCancel: () => void;
}

export function PersonForm({ defaultValues, onSubmit, onCancel }: Props) {
  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { discount: 0, discount_long: 0, active: 1, ...defaultValues },
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 p-4">
      <div>
        <label className="block text-sm font-medium mb-1">{t("form.name")}</label>
        <input {...register("name")} className="w-full border rounded-md px-3 py-2 text-sm" />
        {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name.message}</p>}
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">{t("form.discount")}</label>
        <input {...register("discount")} type="number" step="0.01" className="w-full border rounded-md px-3 py-2 text-sm" />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">{t("form.discount_long")}</label>
        <input {...register("discount_long")} type="number" step="0.01" className="w-full border rounded-md px-3 py-2 text-sm" />
      </div>
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="active"
          checked={watch("active") === 1}
          onChange={(e) => setValue("active", e.target.checked ? 1 : 0)}
          className="rounded"
        />
        <label htmlFor="active" className="text-sm">{t("form.active_member")}</label>
      </div>
      <div className="flex gap-3 pt-2">
        <button type="button" onClick={onCancel} className="flex-1 border rounded-md py-2 text-sm">{t("action.cancel")}</button>
        <button type="submit" className="flex-1 bg-blue-600 text-white rounded-md py-2 text-sm">{t("action.save")}</button>
      </div>
    </form>
  );
}
