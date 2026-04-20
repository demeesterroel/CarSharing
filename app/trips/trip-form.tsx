"use client";
import { useEffect } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { CarToggle } from "@/components/car-toggle";
import { PersonSelect } from "@/components/person-select";
import { LocationPicker } from "@/components/location-picker";
import { calcTripAmount } from "@/lib/formulas";
import { usePeople } from "@/hooks/use-people";
import { useCars } from "@/hooks/use-cars";
import { useLastCarState } from "@/hooks/use-car-state";
import type { Trip } from "@/types";
import { t } from "@/lib/i18n";

const schema = z.object({
  person_id: z.number({ required_error: t("validation.person_required") }),
  car_id: z.number({ required_error: t("validation.car_required") }),
  date: z.string().min(1),
  start_odometer: z.coerce.number().int().min(0),
  end_odometer: z.coerce.number().int().min(0),
  location: z.string().nullable().optional(),
}).refine((d) => d.end_odometer >= d.start_odometer, {
  path: ["end_odometer"],
  message: t("validation.end_gte_start"),
});
type FormData = z.infer<typeof schema>;

interface Props {
  defaultValues?: Partial<Trip>;
  onSubmit: (data: FormData) => void;
  onCancel: () => void;
}

export function TripForm({ defaultValues, onSubmit, onCancel }: Props) {
  const { data: people = [] } = usePeople();
  const { data: cars = [] } = useCars();
  const isAddMode = !defaultValues?.id;
  const { register, handleSubmit, control, watch, setValue, getValues, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      date: new Date().toISOString().slice(0, 10),
      start_odometer: 0, end_odometer: 0, location: null,
      ...defaultValues,
    },
  });

  const [start, end, personId, carId] = watch(["start_odometer", "end_odometer", "person_id", "car_id"]);
  const km = Math.max(0, (end ?? 0) - (start ?? 0));
  const person = people.find((p) => p.id === personId);
  const car = cars.find((c) => c.id === carId);
  const amount = person && car ? calcTripAmount(km, car.price_per_km, person.discount, person.discount_long) : 0;

  const { data: lastState } = useLastCarState(carId);

  const maybePrefillEnd = (startVal: number) => {
    const current = getValues("end_odometer");
    if (!current || Number(current) === 0) setValue("end_odometer", startVal);
  };

  useEffect(() => {
    if (!isAddMode || !carId || !lastState) return;
    if (lastState.odometer != null) {
      setValue("start_odometer", lastState.odometer);
      maybePrefillEnd(lastState.odometer);
    }
    if (lastState.location) setValue("location", lastState.location);
  }, [lastState, carId, isAddMode]);

  const startReg = register("start_odometer");

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 p-4">
      <div>
        <label className="block text-sm font-medium mb-2">{t("form.car")}</label>
        <Controller name="car_id" control={control}
          render={({ field }) => <CarToggle cars={cars} value={field.value} onChange={field.onChange} />}
        />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">{t("form.name")}</label>
        <Controller name="person_id" control={control}
          render={({ field }) => (
            <PersonSelect people={people.filter((p) => p.active)} value={field.value} onChange={field.onChange} />
          )}
        />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">{t("form.date")}</label>
        <input {...register("date")} type="date" className="w-full border rounded-md px-3 py-2 text-sm" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium mb-1">{t("form.start_odometer")}</label>
          <input
            {...startReg}
            type="number"
            className="w-full border rounded-md px-3 py-2 text-sm"
            onBlur={(e) => {
              startReg.onBlur(e);
              maybePrefillEnd(Number(e.target.value));
            }}
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">{t("form.end_odometer")}</label>
          <input {...register("end_odometer")} type="number" className="w-full border rounded-md px-3 py-2 text-sm" />
          {errors.end_odometer && <p className="text-red-500 text-xs mt-1">{errors.end_odometer.message}</p>}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium mb-1">{t("form.km")}</label>
          <input readOnly value={km} className="w-full border rounded-md px-3 py-2 text-sm bg-gray-50" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">{t("form.amount")}</label>
          <input readOnly value={amount.toFixed(2)} className="w-full border rounded-md px-3 py-2 text-sm bg-gray-50" />
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">{t("form.location")}</label>
        <Controller name="location" control={control}
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
