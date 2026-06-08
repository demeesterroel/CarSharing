"use client";
import { createElement, useEffect, useRef } from "react";
import { paper, fontSerif } from "@/lib/paper-theme";

const innerInputStyle: React.CSSProperties = {
  fontFamily: fontSerif,
  fontSize: 15,
  fontWeight: 600,
  color: paper.ink,
  background: paper.paper,
  border: `1.5px solid ${paper.paperDark}`,
  borderRadius: "var(--radius-md, 8px)",
  padding: "7px 8px",
  width: "100%",
  outline: "none",
};

// CSS var theming for the Material clock popup (mono-first → ink accent).
const wrapperStyle = {
  display: "block",
  "--clock-timepicker-accent-color": "var(--ink)",
} as React.CSSProperties;

/**
 * 24h Material clock time field (#191) — wraps the `clock-timepicker` web
 * component. Per the library's framework pattern, an enclosed <input> carries
 * the value; we keep it in sync and read changes off it. The element is
 * registered client-side only (it touches customElements, not available in SSR).
 * `value` is "HH:MM" or null; `onChange` emits "HH:MM" or null.
 */
export function TimePicker({
  value,
  onChange,
  disabled,
}: {
  value: string | null;
  onChange: (v: string | null) => void;
  disabled?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  // Define the custom element on the client only.
  useEffect(() => {
    let cancelled = false;
    import("clock-timepicker").then(() => {
      if (cancelled) return;
      // The library skips repositioning when an ancestor is position:fixed (our
      // BottomSheet) and then overflows. But its popup is itself position:fixed
      // and the sheet has no persistent transform, so viewport-relative
      // positioning is correct. Disable the bail so the built-in flip runs —
      // it opens the clock ABOVE the field when there's no room below. (#191)
      const Ctor = customElements.get("clock-timepicker") as
        | { prototype: { hasFixedParent?: () => boolean } }
        | undefined;
      if (Ctor && typeof Ctor.prototype.hasFixedParent === "function") {
        Ctor.prototype.hasFixedParent = () => false;
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Reflect external value onto the inner input.
  useEffect(() => {
    const el = inputRef.current;
    if (el && el.value !== (value ?? "")) el.value = value ?? "";
  }, [value]);

  // Read picker changes (the web component updates + fires events on the input).
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    const handler = () => onChange(el.value ? el.value.slice(0, 5) : null);
    el.addEventListener("change", handler);
    el.addEventListener("input", handler);
    return () => {
      el.removeEventListener("change", handler);
      el.removeEventListener("input", handler);
    };
  }, [onChange]);

  // clock-timepicker bug (#191): tabbing into a fresh picker selects the hour
  // part, then writes the default value, which moves the caret to the end and
  // clobbers the highlight. (Clicking is unaffected — its path selects after the
  // value exists.) Re-apply the hour selection on the next tick, but only when it
  // was collapsed — so click / tab-within-part / valued pickers are untouched.
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    const onFocus = () => {
      setTimeout(() => {
        if (document.activeElement !== el || !el.value) return;
        if (el.selectionStart !== el.selectionEnd) return; // a part is already selected
        const colon = el.value.indexOf(":");
        if (colon > 0) el.setSelectionRange(0, colon); // select the hour part
      }, 0);
    };
    el.addEventListener("focus", onFocus);
    return () => el.removeEventListener("focus", onFocus);
  }, []);

  return createElement(
    "clock-timepicker",
    { format: "HH:mm", precision: "00:05", style: wrapperStyle, ...(disabled ? { disabled: true } : {}) },
    <input
      ref={inputRef}
      type="text"
      inputMode="numeric"
      placeholder="--:--"
      defaultValue={value ?? ""}
      disabled={disabled}
      style={innerInputStyle}
    />
  );
}
