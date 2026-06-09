"use client";
import { t } from "@/lib/i18n";
import { fontMono, tokens } from "@/lib/theme-tokens";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";

const schema = z.object({
  first_name: z.string().min(1, t("validation.name_required")),
  last_name: z.string().default(""),
  discount: z.coerce.number().min(0).max(1),
  discount_long: z.coerce.number().min(0).max(1),
  active: z.coerce
    .number()
    .int()
    .min(0)
    .max(1)
    .transform((v): 0 | 1 => (v === 0 ? 0 : 1)),
});
export type MemberFormData = z.output<typeof schema>;
type FormInput = z.input<typeof schema>;

const labelStyle: React.CSSProperties = {
  fontFamily: fontMono,
  fontSize: 9,
  color: tokens.inkDim,
  letterSpacing: 1.5,
  textTransform: "uppercase",
  marginBottom: 4,
  display: "block",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "6px 8px",
  border: `1px solid ${tokens.paperDark}`,
  background: tokens.paperDeep,
  fontFamily: fontMono,
  fontSize: 12,
  color: tokens.ink,
  outline: "none",
};

interface Props {
  onSubmit: (data: MemberFormData) => void;
  onCancel: () => void;
  isPending?: boolean;
}

export function MemberForm({ onSubmit, onCancel, isPending }: Props) {
  const {
    register,
    handleSubmit,
    control,
    setValue,
    formState: { errors },
  } = useForm<FormInput, unknown, MemberFormData>({
    resolver: zodResolver(schema),
    defaultValues: { first_name: "", last_name: "", discount: 0, discount_long: 0, active: 1 },
  });

  const activeValue = useWatch({ control, name: "active" });

  return (
    <form onSubmit={handleSubmit(onSubmit)} style={{ padding: "0 20px 20px" }}>
      <div style={{ marginBottom: 12 }}>
        <label style={labelStyle} htmlFor="mf-first-name">
          {t("form.first_name")}
        </label>
        <input id="mf-first-name" {...register("first_name")} style={inputStyle} />
        {errors.first_name && (
          <p style={{ color: tokens.accent, fontFamily: fontMono, fontSize: 10, marginTop: 4 }}>
            {errors.first_name.message}
          </p>
        )}
      </div>

      <div style={{ marginBottom: 12 }}>
        <label style={labelStyle} htmlFor="mf-last-name">
          {t("form.last_name")}
        </label>
        <input id="mf-last-name" {...register("last_name")} style={inputStyle} />
      </div>

      <div style={{ marginBottom: 12 }}>
        <label style={labelStyle} htmlFor="mf-discount">
          {t("form.discount")}
        </label>
        <input
          id="mf-discount"
          type="number"
          step="0.01"
          {...register("discount")}
          style={inputStyle}
        />
      </div>

      <div style={{ marginBottom: 12 }}>
        <label style={labelStyle} htmlFor="mf-discount-long">
          {t("form.discount_long")}
        </label>
        <input
          id="mf-discount-long"
          type="number"
          step="0.01"
          {...register("discount_long")}
          style={inputStyle}
        />
      </div>

      <label
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginBottom: 16,
          cursor: "pointer",
        }}
      >
        <input
          type="checkbox"
          checked={activeValue === 1}
          onChange={(e) => setValue("active", e.target.checked ? 1 : 0)}
          style={{ accentColor: tokens.blue, width: 14, height: 14 }}
        />
        <span style={{ ...labelStyle, marginBottom: 0 }}>{t("form.active_member")}</span>
      </label>

      <div style={{ display: "flex", gap: 8 }}>
        <button
          type="button"
          onClick={onCancel}
          style={{
            flex: 1,
            padding: "9px",
            background: "transparent",
            color: tokens.inkDim,
            border: `1px solid ${tokens.paperDark}`,
            cursor: "pointer",
            fontFamily: fontMono,
            fontSize: 9,
            fontWeight: 700,
            letterSpacing: 1.5,
            textTransform: "uppercase",
          }}
        >
          {t("action.cancel")}
        </button>
        <button
          type="submit"
          disabled={isPending}
          style={{
            flex: 2,
            padding: "9px",
            background: isPending ? tokens.paperDark : tokens.ink,
            color: isPending ? tokens.inkMute : tokens.paper,
            border: "none",
            cursor: isPending ? "default" : "pointer",
            fontFamily: fontMono,
            fontSize: 9,
            fontWeight: 700,
            letterSpacing: 2,
            textTransform: "uppercase",
          }}
        >
          {isPending ? "…" : t("action.save")}
        </button>
      </div>
    </form>
  );
}
