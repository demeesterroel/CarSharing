"use client";
import { useEffect } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { CarToggle } from "@/components/car-toggle";
import { PersonSelect } from "@/components/person-select";
import { ReceiptUpload } from "@/components/receipt-upload";
import { LocationPicker } from "@/components/location-picker";
import { calcPricePerLiter } from "@/lib/formulas";
import { usePeople } from "@/hooks/use-people";
import { useCars } from "@/hooks/use-cars";
import { useLastCarState } from "@/hooks/use-car-state";
import type { FuelFillup, FuelFillupInput } from "@/types";
import { t } from "@/lib/i18n";

const schema = z.object({
  person_id: z.number({ required_error: t("validation.person_required") }),
  car_id: z.number({ required_error: t("validation.car_required") }),
  date: z.string().min(1),
  amount: z.coerce.number().positive(),
  liters: z.coerce.number().positive(),
  odometer: z.coerce.number().int().nullable().optional(),
  receipt: z.string().nullable().optional(),
  location: z.string().nullable().optional(),
});
type FormData = z.infer<typeof schema>;

interface Props {
  defaultValues?: Partial<FuelFillup>;
  onSubmit: (data: FuelFillupInput) => void;
  onCancel: () => void;
}

export function FuelForm({ defaultValues, onSubmit, onCancel }: Props) {
  const { data: people = [] } = usePeople();
  const { data: cars = [] } = useCars();
  const isAddMode = !defaultValues?.id;
  const { register, handleSubmit, control, watch, setValue, getValues } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      date: new Date().toISOString().slice(0, 10),
      amount: 0,
      liters: 0,
      odometer: null,
      receipt: null,
      location: null,
      ...defaultValues,
    },
  });

  const [amount, liters, carId] = watch(["amount", "liters", "car_id"]);
  const pricePerLiter = calcPricePerLiter(amount ?? 0, liters ?? 0);

  const { data: lastState } = useLastCarState(carId);
  useEffect(() => {
    if (!isAddMode || !carId || !lastState) return;
    const current = getValues("odometer");
    if ((!current || Number(current) === 0) && lastState.odometer != null) {
      setValue("odometer", lastState.odometer);
    }
  }, [lastState, carId, isAddMode]);

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 p-4">
      <div>
        <label className="block text-sm font-medium mb-1">{t("form.name")}</label>
        <Controller
          name="person_id"
          control={control}
          render={({ field }) => (
            <PersonSelect people={people.filter((p) => p.active)} value={field.value} onChange={field.onChange} />
          )}
        />
      </div>
      <div>
        <label className="block text-sm font-medium mb-2">{t("form.car")}</label>
        <Controller
          name="car_id"
          control={control}
          render={({ field }) => <CarToggle cars={cars} value={field.value} onChange={field.onChange} />}
        />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">{t("form.date")}</label>
        <input {...register("date")} type="date" className="w-full border rounded-md px-3 py-2 text-sm" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium mb-1">{t("form.amount_euro_required")}</label>
          <input {...register("amount")} type="number" step="0.01" className="w-full border rounded-md px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">{t("form.liters")}</label>
          <input {...register("liters")} type="number" step="0.01" className="w-full border rounded-md px-3 py-2 text-sm" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium mb-1">{t("form.price_per_liter")}</label>
          <input readOnly value={pricePerLiter.toFixed(3)} className="w-full border rounded-md px-3 py-2 text-sm bg-gray-50" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">{t("form.odometer")}</label>
          <input {...register("odometer")} type="number" className="w-full border rounded-md px-3 py-2 text-sm" />
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">{t("form.receipt")}</label>
        <Controller
          name="receipt"
          control={control}
          render={({ field }) => <ReceiptUpload value={field.value ?? null} onChange={field.onChange} />}
        />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">{t("form.location")}</label>
        <Controller
          name="location"
          control={control}
          render={({ field }) => <LocationPicker value={field.value ?? null} onChange={field.onChange} />}
        />
      </div>
      <div className="flex gap-3 pt-2">
        <button type="button" onClick={onCancel} className="flex-1 border rounded-md py-2 text-sm">{t("action.cancel")}</button>
        <button type="submit" className="flex-1 bg-blue-600 text-white rounded-md py-2 text-sm">{t("action.save")}</button>
      </div>
    </form>
  );
}
