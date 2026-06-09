// Shared form-field label styles.
//
// The paper and mono themes use different label typography (paper: tiny
// uppercase tracked caps; mono: slightly larger sentence-case). These two
// variants were copy-pasted verbatim into every form; they live here now so
// there is a single source. Pick the active one with `formLabel(mono)` or
// import a variant directly.
import { fontMono, tokens } from "@/lib/theme-tokens";
import type { CSSProperties } from "react";

export const paperLabel: CSSProperties = {
  fontFamily: fontMono,
  fontSize: 9,
  fontWeight: 700,
  letterSpacing: 2,
  textTransform: "uppercase",
  color: tokens.inkMute,
  display: "block",
  marginBottom: 4,
};

export const monoLabel: CSSProperties = {
  fontFamily: fontMono,
  fontSize: 11,
  color: tokens.inkMute,
  display: "block",
  marginBottom: 4,
};

/** Returns the field-label style for the active theme. */
export const formLabel = (mono: boolean): CSSProperties => (mono ? monoLabel : paperLabel);
