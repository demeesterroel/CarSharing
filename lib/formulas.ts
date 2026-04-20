export function calcTripAmount(
  km: number,
  pricePerKm: number,
  discount: number,
  discountLong: number
): number {
  const shortKm = Math.min(km, 500);
  const longKm = Math.max(km - 500, 0);
  return (
    pricePerKm * shortKm * (1 - discount) +
    pricePerKm * longKm * (1 - discountLong)
  );
}

export function calcPricePerLiter(amount: number, liters: number): number {
  if (liters === 0) return 0;
  return amount / liters;
}

export function calcPaymentYear(date: string): number {
  return new Date(date).getFullYear() - 1;
}
