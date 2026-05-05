export interface Person {
  id: number;
  name: string;
  discount: number;
  discount_long: number;
  active: 0 | 1;
  username: string | null;
  password_hash: string | null;
  is_admin: 0 | 1;
}

export interface Car {
  id: number;
  short: string;
  name: string;
  price_per_km: number;
  brand: string | null;
  color: string | null;
  owner_name: string | null;
  owner_from: string | null; // 'YYYY-MM-DD', inclusive
  owner_to: string | null; // 'YYYY-MM-DD', inclusive; NULL = ongoing
  long_threshold: number;
  fixed_costs_json: string | null;
  active: 0 | 1;
  expected_km: number | null;
}

export type FixedCostCategory =
  | "belastingen"
  | "verzekeringen"
  | "onderhoud"
  | "keuring"
  | "diversen";

export type ExpenseCategory = "onderhoud" | "keuring" | "belasting" | "verzekering" | "diversen";

export interface FixedCostItem {
  id: string;
  category: FixedCostCategory;
  description: string;
  amount: number;
}

export interface Trip {
  id: number;
  person_id: number;
  car_id: number;
  date: string; // ISO date "YYYY-MM-DD"
  start_odometer: number;
  end_odometer: number;
  km: number;
  amount: number;
  location: string | null; // human-readable address (shown in list)
  gps_coords: string | null; // raw "lat, lng" (for map pin)
  parking: string | null;
  client_id: string | null;
  updated_at: string;
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
  full_tank: 0 | 1;
  odometer: number | null;
  receipt: string | null;
  location: string | null;
  gps_coords: string | null;
  settled_outside: 0 | 1;
  client_id: string | null;
  updated_at: string;
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
  category: ExpenseCategory | null;
  settled_outside: 0 | 1;
  client_id: string | null;
  updated_at: string;
  // joined
  person_name?: string;
  car_short?: string;
}

export type ExpenseInput = Pick<
  Expense,
  "person_id" | "car_id" | "date" | "amount" | "description"
> & {
  category?: ExpenseCategory | null;
  settled_outside?: 0 | 1;
  client_id?: string | null;
};

export type ReservationStatus = "pending" | "confirmed" | "rejected";

export interface Reservation {
  id: number;
  person_id: number;
  car_id: number;
  start_date: string;
  end_date: string;
  status: ReservationStatus;
  note: string | null;
  client_id: string | null;
  updated_at: string;
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
  year: number; // date.year − 1 (payment settles previous year)
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
  expense_count: number;
  trip_amount: number; // negative (cost charged)
  fuel_amount: number; // positive (fuel paid)
  expense_amount: number; // positive (expenses paid)
  total_amount: number; // trip_amount + fuel_amount + expense_amount
  paid_amount: number; // settlement payments
  balance: number; // total_amount + paid_amount
}

// Form input types (no id, no computed fields)
export type PersonInput = Pick<Person, "name" | "discount" | "discount_long" | "active"> & {
  username?: string | null;
  is_admin?: 0 | 1;
};
export type CarInput = Pick<Car, "short" | "name" | "price_per_km" | "brand" | "color"> & {
  owner_name?: string | null;
  long_threshold?: number;
  fixed_costs_json?: string | null;
  active?: number;
  expected_km?: number | null;
};
export type TripInput = Pick<
  Trip,
  "person_id" | "car_id" | "date" | "start_odometer" | "end_odometer" | "location"
> & { parking?: string | null; gps_coords?: string | null; client_id?: string | null };
export type FuelFillupInput = Pick<
  FuelFillup,
  "person_id" | "car_id" | "date" | "amount" | "liters" | "odometer" | "receipt" | "location"
> & {
  gps_coords?: string | null;
  full_tank?: 0 | 1;
  settled_outside?: 0 | 1;
  client_id?: string | null;
};
export type ReservationInput = Pick<
  Reservation,
  "person_id" | "car_id" | "start_date" | "end_date"
> & { note?: string | null; status?: ReservationStatus; client_id?: string | null };
export type PaymentInput = Pick<Payment, "person_id" | "date" | "amount" | "note">;

// Derived "last known" state for a car, used to prefill trip/fuel forms on car selection.
// `source` records which table the reading came from — trips always win a same-date tie
// because that reflects the physical odometer after the trip completed.
export interface CarState {
  odometer: number | null;
  location: string | null;
  source: "trip" | "fuel";
}

export interface CarMemberContribution {
  person_name: string;
  trip_km: number;
  fuel_liters: number;
  expense_amount: number;
  contribution: number; // trips − fuel − expenses; positive = member owes co-op for this car
  fuel_settled_count?: number;
  fuel_settled_liters?: number;
  expense_settled_count?: number;
  expense_settled_amount?: number;
}

export interface CrossOwnerBalance {
  other_owner_name: string;
  net: number; // M[this][other] − M[other][this]; positive = I receive (used for sorting/filtering)
  my_balance: number; // M[this][other] = b(me, other's cars); negative = I owe
  my_trip_km: number; // km I drove in their cars
  my_fuel_liters: number; // liters I paid for their cars
  my_expense_amount: number; // expenses I paid for their cars
  my_fuel_settled_count?: number;
  my_fuel_settled_liters?: number;
  my_expense_settled_count?: number;
  my_expense_settled_amount?: number;
}

export interface CarEraBalance {
  car_name: string;
  car_short: string;
  owner_name: string;
  owner_from: string;
  owner_to: string | null;
  trip_amount: number;
  trip_km: number;
  fuel_amount: number;
  fuel_liters: number;
  expense_amount: number;
  balance: number; // b(p, c*) for this person; or N(c*) for the owner's own car row
  n_c_star?: number; // N(c*) — only set on the owner's own car rows
  member_contributions?: CarMemberContribution[]; // non-owner contributions; only on owner's car rows
  fuel_settled_count?: number;
  fuel_settled_liters?: number;
  expense_settled_count?: number;
  expense_settled_amount?: number;
}

export interface MemberStatement {
  person_id: number;
  person_name: string;
  is_owner: boolean;
  s1?: number; // non-owner: net balance with co-op
  s2?: number; // owner: co-op payout
  x?: number; // owner: cross-owner net position
  net?: number; // owner: s2 + x
  car_eras: CarEraBalance[];
  cross_owner_balances?: CrossOwnerBalance[]; // only on owner rows
}

export interface Transfer {
  from: string; // person_name or "co-op"
  to: string;
  amount: number;
  step: 1 | 2 | 3;
  label: string;
}

export interface SettlementResult {
  year: number;
  frozen: boolean;
  settled_at: string | null;
  settled_by: string | null;
  members: MemberStatement[];
  transfers: Transfer[];
  verify_ok: boolean;
}
