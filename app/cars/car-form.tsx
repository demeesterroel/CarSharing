"use client";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import type { Car } from "@/types";
import { t } from "@/lib/i18n";

const schema = z.object({
  short: z.string().min(1).max(10),
  name: z.string().min(1),
  price_per_km: z.coerce.number().positive(),
  brand: z.string().optional().transform((v) => v === "" ? null : (v ?? null)),
  color: z.string().optional().transform((v) => v === "" ? null : (v ?? null)),
});
type FormData = z.infer<typeof schema>;

interface Props {
  defaultValues?: Partial<Car>;
  onSubmit: (data: FormData) => void;
  onCancel: () => void;
}

export function CarForm({ defaultValues, onSubmit, onCancel }: Props) {
  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { price_per_km: 0.20, ...defaultValues },
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 p-4">
      <div>
        <label className="block text-sm font-medium mb-1">{t("form.car_short")}</label>
        <input {...register("short")} className="w-full border rounded-md px-3 py-2 text-sm uppercase" />
        {errors.short && <p className="text-red-500 text-xs mt-1">{errors.short.message}</p>}
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">{t("form.name")}</label>
        <input {...register("name")} className="w-full border rounded-md px-3 py-2 text-sm" />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">{t("form.price_per_km")}</label>
        <input {...register("price_per_km")} type="number" step="0.01" className="w-full border rounded-md px-3 py-2 text-sm" />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">{t("form.brand")}</label>
        <input {...register("brand")} className="w-full border rounded-md px-3 py-2 text-sm" />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">{t("form.color")}</label>
        <input {...register("color")} className="w-full border rounded-md px-3 py-2 text-sm" />
      </div>
      <div className="flex gap-3 pt-2">
        <button type="button" onClick={onCancel} className="flex-1 border rounded-md py-2 text-sm">{t("action.cancel")}</button>
        <button type="submit" className="flex-1 bg-blue-600 text-white rounded-md py-2 text-sm">{t("action.save")}</button>
      </div>
    </form>
  );
}
