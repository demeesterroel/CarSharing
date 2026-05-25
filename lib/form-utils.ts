export function parseDecimalInput(value: string | number): number {
  if (typeof value === "number") return value;
  if (value.trim() === "") return NaN;
  return Number(value.replace(",", "."));
}
