"use client";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { CarToggle } from "@/components/car-toggle";
import { PersonSelect } from "@/components/person-select";
import { usePeople } from "@/hooks/use-people";
import { useCars } from "@/hooks/use-cars";
import type { Reservation, ReservationInput } from "@/types";
import { t } from "@/lib/i18n";

const schema = z
  .object({
    person_id: z.number({ error: t("validation.person_required") }),
    car_id: z.number({ error: t("validation.car_required") }),
    start_date: z.string().min(1),
    end_date: z.string().min(1),
  })
  .refine((v) => v.end_date >= v.start_date, {
    message: t("validation.end_date_gte_start"),
    path: ["end_date"],
  });
type FormData = z.infer<typeof schema>;

interface Props {
  defaultValues?: Partial<Reservation>;
  onSubmit: (data: ReservationInput) => void;
  onCancel: () => void;
}

export function ReservationForm({ defaultValues, onSubmit, onCancel }: Props) {
  const { data: people = [] } = usePeople();
  const { data: cars = [] } = useCars();
  const today = new Date().toISOString().slice(0, 10);
  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { start_date: today, end_date: today, ...defaultValues },
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 p-4">
      <div>
        <label className="block text-sm font-medium mb-2">{t("form.car")}</label>
        <Controller
          name="car_id"
          control={control}
          render={({ field }) => (
            <CarToggle cars={cars} value={field.value} onChange={field.onChange} />
          )}
        />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">{t("form.name")}</label>
        <Controller
          name="person_id"
          control={control}
          render={({ field }) => (
            <PersonSelect
              people={people.filter((p) => p.active)}
              value={field.value}
              onChange={field.onChange}
            />
          )}
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium mb-1">{t("form.date_from")}</label>
          <input
            {...register("start_date")}
            type="date"
            className="w-full border rounded-md px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">{t("form.date_to")}</label>
          <input
            {...register("end_date")}
            type="date"
            className="w-full border rounded-md px-3 py-2 text-sm"
          />
          {errors.end_date && (
            <p className="text-xs text-red-600 mt-1">{errors.end_date.message}</p>
          )}
        </div>
      </div>
      <div className="flex gap-3 pt-2">
        <button type="button" onClick={onCancel} className="flex-1 border rounded-md py-2 text-sm">
          {t("action.cancel")}
        </button>
        <button type="submit" className="flex-1 bg-blue-600 text-white rounded-md py-2 text-sm">
          {t("action.save")}
        </button>
      </div>
    </form>
  );
}
