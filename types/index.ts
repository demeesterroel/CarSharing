export interface Person {
  id: number;
  name: string;
  discount: number;
  discount_long: number;
  active: 0 | 1;
}

export interface Car {
  id: number;
  short: string;
  name: string;
  price_per_km: number;
  brand: string | null;
  color: string | null;
}

export interface Trip {
  id: number;
  person_id: number;
  car_id: number;
  date: string;           // ISO date "YYYY-MM-DD"
  start_odometer: number;
  end_odometer: number;
  km: number;
  amount: number;
  location: string | null;
  // joined
  person_name?: string;
  car_short?: string;
}

export interface FuelFillup {
  id: number;
  person_id: number;
  car_id: number;
  date: string;
  amount: number;
  liters: number;
  price_per_liter: number;
  odometer: number | null;
  receipt: string | null;
  location: string | null;
  // joined
  person_name?: string;
  car_short?: string;
}

export interface Expense {
  id: number;
  person_id: number;
  car_id: number;
  date: string;
  amount: number;
  description: string | null;
  // joined
  person_name?: string;
  car_short?: string;
}

export interface Reservation {
  id: number;
  person_id: number;
  car_id: number;
  start_date: string;
  end_date: string;
  // joined
  person_name?: string;
  car_short?: string;
}

export interface Payment {
  id: number;
  person_id: number;
  date: string;
  amount: number;
  note: string | null;
  year: number;           // date.year − 1 (payment settles previous year)
  // joined
  person_name?: string;
}

export interface DashboardRow {
  person_id: number;
  person_name: string;
  year: number;
  trip_count: number;
  trip_km: number;
  fuel_count: number;
  fuel_liters: number;
  trip_amount: number;     // negative (cost charged)
  fuel_amount: number;     // positive (fuel paid)
  expense_amount: number;  // positive (expenses paid)
  total_amount: number;    // trip_amount + fuel_amount + expense_amount
  paid_amount: number;     // settlement payments
  balance: number;         // total_amount + paid_amount
}

// Form input types (no id, no computed fields)
export type PersonInput = Pick<Person, "name"|"discount"|"discount_long"|"active">;
export type CarInput = Pick<Car, "short"|"name"|"price_per_km"|"brand"|"color">;
export type TripInput = Pick<Trip, "person_id"|"car_id"|"date"|"start_odometer"|"end_odometer"|"location">;
export type FuelFillupInput = Pick<FuelFillup, "person_id"|"car_id"|"date"|"amount"|"liters"|"price_per_liter"|"odometer"|"receipt"|"location">;
export type ExpenseInput = Pick<Expense, "person_id"|"car_id"|"date"|"amount"|"description">;
export type ReservationInput = Pick<Reservation, "person_id"|"car_id"|"start_date"|"end_date">;
export type PaymentInput = Pick<Payment, "person_id"|"date"|"amount"|"note">;

// Derived "last known" state for a car, used to prefill trip/fuel forms on car selection.
// `source` records which table the reading came from — trips always win a same-date tie
// because that reflects the physical odometer after the trip completed.
export interface CarState {
  odometer: number | null;
  location: string | null;
  source: "trip" | "fuel";
}
