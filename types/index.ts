export interface Person {
  id: number;
  first_name: string;
  last_name: string;
  discount: number;
  discount_long: number;
  active: 0 | 1;
  username: string | null;
  password_hash: string | null;
  is_admin: 0 | 1;
  bank_account: string;
  email: string | null;
  theme_preference: "paper" | "mono";
  /** Bumped to revoke all of a user's existing sessions ("log out everywhere"). */
  session_epoch?: number;
  updated_at: string;
}

export interface Car {
  id: number;
  short: string;
  name: string;
  price_per_km: number;
  brand: string | null;
  color: string | null;
  owner_from: string | null; // 'YYYY-MM-DD', inclusive
  owner_to: string | null; // 'YYYY-MM-DD', inclusive; NULL = ongoing
  owner_person_id: number | null;
  long_threshold: number;
  active: 0 | 1;
  expected_km: number | null;
  updated_at: string;
}

export type ExpenseCategory = "onderhoud" | "keuring" | "belasting" | "verzekering" | "diversen";

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
  receipt: string | null;
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
  receipt?: string | null;
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
  google_event_id: string | null;
  last_synced_etag: string | null;
  last_app_write_nonce: string | null;
  last_known_response_status: string | null;
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
  updated_at: string;
  // joined
  person_name?: string;
}

export interface CarDashboardBreakdown {
  car_short: string;
  car_name: string;
  is_own_car: boolean; // true = person owns this car; false = drove another owner's car

  // Own car: others' activity. Cross-car: own activity.
  trip_count: number;
  trip_km: number;
  trip_amount: number; // own car: +N (revenue). cross-car: + raw (negate for display)
  fuel_count: number;
  fuel_liters: number;
  fuel_amount: number; // own car: + raw (negate for display). cross-car: + (advance)
  expense_count: number;
  expense_amount: number; // same sign as fuel_amount

  net_car: number; // own car: N(c). cross-car: −trip + fuel + expense

  // Own usage on own car (€0 in settlement — stats only, no amounts shown):
  own_trip_count: number;
  own_trip_km: number;
  own_fuel_count: number;
  own_fuel_liters: number;
  own_expense_count: number;

  // Settled-outside counts (settled_outside=1, excluded from amounts above):
  fuel_settled_count?: number;
  fuel_settled_liters?: number;
  expense_settled_count?: number;
  expense_settled_amount?: number;
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
  is_owner: boolean;
  car_breakdowns: CarDashboardBreakdown[];
}

// Form input types (no id, no computed fields)
export type PersonInput = Pick<
  Person,
  "first_name" | "last_name" | "discount" | "discount_long" | "active"
> & {
  username?: string | null;
  is_admin?: 0 | 1;
};
export type CarInput = Pick<Car, "short" | "name" | "price_per_km" | "brand" | "color"> & {
  owner_person_id?: number | null;
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

export interface CarParticipantRow {
  person_name: string;
  row_type: "member" | "cross_owner" | "own"; // own = owner's own trips, shown €0
  trip_km: number;
  trip_amount: number; // 0 for row_type "own"
  fuel_liters: number;
  fuel_amount: number;
  expense_amount: number;
  balance: number; // trip_amount − fuel_amount − expense_amount; 0 for "own"
  fuel_settled_count: number;
  fuel_settled_liters: number;
  expense_settled_count: number;
  expense_settled_amount: number;
}

export interface CarSettlement {
  car_name: string;
  car_short: string;
  owner_name: string;
  owner_from: string;
  owner_to: string | null;
  rows: CarParticipantRow[]; // sorted: members (alpha) → cross_owners (alpha) → own
  total_balance: number; // N_new(c) = what co-op pays owner in Step 2
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
  s1?: number; // non-owner: net balance with co-op (negative = owes)
  s2?: number; // owner: co-op payout (N_new for all owned cars)
  s1_cross?: number; // owner: cross-owner balance in Step 1 (negative = owes co-op)
  net?: number; // owner: s2 + s1_cross
  car_eras: CarEraBalance[];
}

export interface Transfer {
  from: string; // person_name or "co-op"
  to: string;
  amount: number;
  step: 1 | 2; // was: 1 | 2 | 3
  label: string;
}

export interface TransferPaymentStatus {
  /** Total amount paid toward this transfer (from the payments table). */
  paid: number;
  /** Amount still outstanding: Math.max(0, amount - paid). */
  open: number;
  /** Individual payment records that make up the total. */
  payments: { id: number; date: string; amount: number }[];
}

export interface AnnotatedTransfer extends Transfer {
  /** Payment status for this transfer, if the payer is a known person (not "co-op"). */
  payment_status: TransferPaymentStatus | null;
}

export interface SettlementResult {
  year: number;
  frozen: boolean;
  settled_at: string | null;
  settled_by: string | null;
  members: MemberStatement[];
  car_settlements: CarSettlement[];
  transfers: AnnotatedTransfer[];
  verify_ok: boolean;
  /** Keyed by person_id; total paid for this settlement year. */
  payments_by_person: Record<number, number>;
  /** True when every transfer with a human payer has open === 0. */
  all_paid: boolean;
}

export interface CalendarSyncState {
  id: 1;
  channel_id: string;
  resource_id: string;
  expiration_at: string;
  sync_token: string;
}
