// Real data model for the CarSharing co-op (Antwerp)

// ── Cars
//  eigenaar (legacy): single owner name — kept for back-compat
//  ownerIds:  array of owner names (supports co-owned cars)
//  longKm:    kilometrage threshold beyond which the long-discount applies
//  fixedCosts: yearly fixed costs — array of {id, category, description, amount}
//              categories: belastingen | verzekeringen | onderhoud | keuring | diversen
//  jaarKm:    total kilometres driven last year
//  expectedCoopKm: km/year the car is expected to be driven by OTHERS (co-op members) — set in January
const CARS = [
  { short: 'JF',  name: 'Jean-François', merk: 'Toyota Prius+',     kleur: 'wit',   prijs: 0.20,
    eigenaar: 'Roeland',  ownerIds: ['Roeland'], longKm: 500, jaarKm: 18400,
    expectedCoopKm: 8000,
    fixedCosts: [
      { id: 'jf-1', category: 'verzekeringen', description: 'BA + omnium',         amount: 780  },
      { id: 'jf-2', category: 'belastingen',   description: 'Verkeersbelasting',   amount: 327  },
      { id: 'jf-3', category: 'keuring',       description: 'Technische keuring',  amount: 52   },
      { id: 'jf-4', category: 'diversen',      description: 'Afschrijving',        amount: 1600 },
    ] },
  { short: 'ETH', name: 'Ethel',         merk: 'Fiat Punto',        kleur: 'blauw', prijs: 0.20,
    eigenaar: 'Malvina',  ownerIds: ['Malvina'], longKm: 400, jaarKm: 9200,
    expectedCoopKm: 3500,
    fixedCosts: [
      { id: 'eth-1', category: 'verzekeringen', description: 'BA verzekering',      amount: 620 },
      { id: 'eth-2', category: 'belastingen',   description: 'Verkeersbelasting',   amount: 218 },
      { id: 'eth-3', category: 'keuring',       description: 'Technische keuring',  amount: 52  },
      { id: 'eth-4', category: 'diversen',      description: 'Afschrijving',        amount: 700 },
    ] },
  { short: 'LEW', name: 'Lewis',         merk: 'Mercedes Sprinter', kleur: 'wit',   prijs: 0.25,
    eigenaar: 'Roeland',  ownerIds: ['Roeland'], longKm: 600, jaarKm: 14700,
    expectedCoopKm: 6000,
    fixedCosts: [
      { id: 'lew-1', category: 'verzekeringen', description: 'Omnium + aanhangwagen', amount: 1180 },
      { id: 'lew-2', category: 'belastingen',   description: 'Verkeersbelasting',     amount: 490  },
      { id: 'lew-3', category: 'keuring',       description: 'Technische keuring',    amount: 64   },
      { id: 'lew-4', category: 'diversen',      description: 'Afschrijving',          amount: 2400 },
    ] },
];
const carByShort = Object.fromEntries(CARS.map(c => [c.short, c]));
const carByName  = Object.fromEntries(CARS.map(c => [c.name, c]));

// ── People: 14 active members. Some have discount, some don't.
// discount = base (<=500km), discount_long = applied on km >500
// username/password: for mockup auth (plain-text, prototype only)
// isAdmin: only Roeland; owner role is derived from car ownership
const PEOPLE = [
  { name: 'Armando',  username: 'armando',  password: 'armando',  isAdmin: false, k: 0.25, kl: 0.50 },
  { name: 'Bouke',    username: 'bouke',    password: 'bouke',    isAdmin: false, k: 0,    kl: 0    },
  { name: 'Joris',    username: 'joris',    password: 'joris',    isAdmin: false, k: 0.25, kl: 0.50 },
  { name: 'Lander',   username: 'lander',   password: 'lander',   isAdmin: false, k: 0,    kl: 0    },
  { name: 'Malvina',  username: 'malvina',  password: 'malvina',  isAdmin: false, k: 0,    kl: 0    },
  { name: 'Roeland',  username: 'roeland',  password: 'roeland',  isAdmin: true,  k: 0,    kl: 0    },
  { name: 'Stefaan',  username: 'stefaan',  password: 'stefaan',  isAdmin: false, k: 0,    kl: 0    },
  { name: 'Steven',   username: 'steven',   password: 'steven',   isAdmin: false, k: 0,    kl: 0    },
  { name: 'Susanna',  username: 'susanna',  password: 'susanna',  isAdmin: false, k: 0.25, kl: 0.50 },
  { name: 'Sverre',   username: 'sverre',   password: 'sverre',   isAdmin: false, k: 0,    kl: 0    },
  { name: 'Tinne',    username: 'tinne',    password: 'tinne',    isAdmin: false, k: 0.25, kl: 0.50 },
  { name: 'Wim',      username: 'wim',      password: 'wim',      isAdmin: false, k: 0.25, kl: 0.50 },
  { name: 'Wouter',   username: 'wouter',   password: 'wouter',   isAdmin: false, k: 0.25, kl: 0.50 },
  { name: 'WouterLC', username: 'wouterlc', password: 'wouterlc', isAdmin: false, k: 0.25, kl: 0.50 },
];
const personByName = Object.fromEntries(PEOPLE.map(p => [p.name, p]));

// Current "logged-in" user — resolved at runtime from session, not a static const
const ME = personByName['Roeland'];

// ── Discount formula
//   amount = car.prijs × ( min(km, 500) × (1 − p.k)
//                        + max(km − 500, 0) × (1 − p.kl) )
function calcTripAmount(km, person, car) {
  const base = Math.min(km, 500);
  const extra = Math.max(km - 500, 0);
  return car.prijs * (base * (1 - person.k) + extra * (1 - person.kl));
}

function calcTripBreakdown(km, person, car) {
  const baseKm = Math.min(km, 500);
  const extraKm = Math.max(km - 500, 0);
  const baseCost = car.prijs * baseKm * (1 - person.k);
  const extraCost = car.prijs * extraKm * (1 - person.kl);
  const fullCost = car.prijs * km;
  const discount = fullCost - (baseCost + extraCost);
  return { baseKm, extraKm, baseCost, extraCost, fullCost, discount, total: baseCost + extraCost };
}

// ── Recent trips — from real data, last April 2026
// Locatie was stored as GPS coords; we interpret them as *parking* locations.
const RECENT_TRIPS = [
  { id: '4feb01c7', who: 'Roeland', car: 'LEW', date: '2026-04-18', start: 233900, eind: 241929, km: 8029, total: 2007.25, parking: 'Bagnères-de-Luchon (FR)' },
  { id: '59294ac4', who: 'Tinne',   car: 'JF',  date: '2026-04-17', start: 267295, eind: 269594, km: 2299, total: 254.90,  parking: 'Antwerpen — Berchem' },
  { id: 'c1a2b001', who: 'Susanna', car: 'JF',  date: '2026-04-14', start: 267140, eind: 267295, km: 155,  total: 27.90,   parking: 'Antwerpen — Zurenborg' },
  { id: 'c1a2b002', who: 'Malvina', car: 'ETH', date: '2026-04-12', start: 142050, eind: 142612, km: 562,  total: 101.16,  parking: 'Brugge — Station' },
  { id: '35daad2e', who: 'Stefaan', car: 'JF',  date: '2026-04-05', start: 267140, eind: 267295, km: 155,  total: 31.00,   parking: 'Antwerpen — Zurenborg' },
  { id: 'c1a2b003', who: 'Susanna', car: 'ETH', date: '2026-04-02', start: 141688, eind: 141812, km: 124,  total: 24.80,   parking: 'Gent — Dampoort' },
  { id: 'c1a2b004', who: 'Malvina', car: 'ETH', date: '2026-03-28', start: 141540, eind: 141688, km: 148,  total: 26.64,   parking: 'Antwerpen — Linkeroever' },
  { id: '967a6f92', who: 'Stefaan', car: 'JF',  date: '2026-03-30', start: 266992, eind: 267140, km: 148,  total: 29.60,   parking: 'Antwerpen — Kiel' },
  { id: 'a6939af2', who: 'Roeland', car: 'JF',  date: '2026-03-23', start: 266752, eind: 266992, km: 240,  total: 48.00,   parking: 'Antwerpen — Zurenborg' },
  { id: 'c1a2b005', who: 'Susanna', car: 'JF',  date: '2026-03-15', start: 266640, eind: 266752, km: 112,  total: 20.16,   parking: 'Antwerpen — Zurenborg' },
  { id: 'c1a2b006', who: 'Malvina', car: 'ETH', date: '2026-03-08', start: 141288, eind: 141540, km: 252,  total: 45.36,   parking: 'Mechelen — Station' },
  { id: '796a0bdb', who: 'Stefaan', car: 'JF',  date: '2026-03-04', start: 266734, eind: 266752, km: 18,   total: 3.60,    parking: 'Antwerpen — Zurenborg' },
  { id: '3bc355a5', who: 'Stefaan', car: 'JF',  date: '2026-02-23', start: 266357, eind: 266734, km: 377,  total: 75.40,   parking: 'Antwerpen — Zurenborg' },
  { id: 'c1a2b007', who: 'Malvina', car: 'ETH', date: '2026-02-19', start: 141050, eind: 141288, km: 238,  total: 42.84,   parking: 'Antwerpen — Zurenborg' },
  { id: 'c1a2b008', who: 'Susanna', car: 'JF',  date: '2026-02-18', start: 266229, eind: 266357, km: 128,  total: 23.04,   parking: 'Antwerpen — Zurenborg' },
  { id: '9764819a', who: 'Roeland', car: 'JF',  date: '2026-02-14', start: 266229, eind: 266357, km: 128,  total: 25.60,   parking: 'Antwerpen — Zurenborg' },
];

// ── Recent fuel — we keep location (was missing in source) + tank-status flag
const RECENT_FUEL = [
  { id: 'ab0e5fe9', who: 'Roeland', car: 'LEW', date: '2026-04-18', bedrag: 101.50, liter: 54.3, prijs_l: 1.87, km: 242045, location: 'Total — Pau (FR)',        vol: true  },
  { id: 'e25a05a3', who: 'Roeland', car: 'LEW', date: '2026-04-18', bedrag: 50.00,  liter: 22.8, prijs_l: 2.19, km: null,   location: 'Shell — Luchon (FR)',     vol: false },
  { id: 'adb18d99', who: 'Tinne',   car: 'JF',  date: '2026-04-17', bedrag: 62.21,  liter: 31.26, prijs_l: 1.99, km: null,   location: 'Q8 — Berchem',            vol: false },
  { id: 'b36ae977', who: 'Malvina', car: 'ETH', date: '2026-04-17', bedrag: 34.22,  liter: 16.00, prijs_l: 2.14, km: null,   location: 'Dats24 — Wilrijk',        vol: false },
  { id: 'f0a2b001', who: 'Susanna', car: 'JF',  date: '2026-04-14', bedrag: 48.00,  liter: 24.00, prijs_l: 2.00, km: 267290, location: 'Q8 — Kiel',               vol: true  },
  { id: '757e27ec', who: 'Roeland', car: 'LEW', date: '2026-04-15', bedrag: 50.00,  liter: 21.00, prijs_l: 2.38, km: 241686, location: 'Esso — Antwerpen Zuid',   vol: true  },
  { id: 'f0a2b002', who: 'Malvina', car: 'ETH', date: '2026-04-12', bedrag: 72.40,  liter: 33.50, prijs_l: 2.16, km: 142600, location: 'Total — Brugge',          vol: true  },
  { id: 'f0a2b003', who: 'Susanna', car: 'ETH', date: '2026-04-02', bedrag: 28.00,  liter: 13.10, prijs_l: 2.14, km: null,   location: 'Dats24 — Gent',           vol: false },
  { id: 'f0a2b004', who: 'Malvina', car: 'ETH', date: '2026-03-08', bedrag: 55.80,  liter: 26.00, prijs_l: 2.15, km: 141535, location: 'Q8 — Mechelen',          vol: true  },
];

// ── Recent expenses
const RECENT_EXPENSES = [
  { id: 'ee028705', who: 'Roeland', car: 'JF',  date: '2026-02-23', bedrag: 326.82, kosten: 'Verkeersbelasting' },
  { id: '428de572', who: 'Stefaan', car: 'JF',  date: '2026-01-14', bedrag: 51.30,  kosten: 'Autokeuring' },
  { id: '4a6d46c2', who: 'Stefaan', car: 'JF',  date: '2026-01-13', bedrag: 62.50,  kosten: 'Donckers uitlijning' },
  { id: '16ded752', who: 'Stefaan', car: 'JF',  date: '2025-12-30', bedrag: 166.26, kosten: 'garageZuid — keuring' },
];

// ── Upcoming reservations
//  status: 'pending' = waiting for owner approval, 'confirmed', 'rejected'
const RESERVATIONS = [
  { id: 'r1', who: 'Tinne',   car: 'JF',  from: '2026-04-22', to: '2026-04-22', reason: 'Klant bezoek',  status: 'confirmed', requested: '2026-04-15' },
  { id: 'r2', who: 'Roeland', car: 'LEW', from: '2026-04-24', to: '2026-04-26', reason: 'Verhuis zus',   status: 'confirmed', requested: '2026-04-18' },
  { id: 'r3', who: 'Malvina', car: 'ETH', from: '2026-04-25', to: '2026-04-25', reason: 'Zwembad',       status: 'confirmed', requested: '2026-04-19' },
  { id: 'r4', who: 'Wim',     car: 'JF',  from: '2026-04-28', to: '2026-05-02', reason: 'Kust weekend',  status: 'pending',   requested: '2026-04-20' },
  { id: 'r5', who: 'Susanna', car: 'ETH', from: '2026-05-01', to: '2026-05-01', reason: 'Markt',         status: 'pending',   requested: '2026-04-20' },
  { id: 'r6', who: 'Armando', car: 'LEW', from: '2026-05-03', to: '2026-05-04', reason: 'Tuinhout halen',status: 'pending',   requested: '2026-04-21' },
  { id: 'r7', who: 'Joris',   car: 'JF',  from: '2026-05-05', to: '2026-05-05', reason: 'Dokter',        status: 'pending',   requested: '2026-04-21' },
];

// ── Helpers for reservations
function reservationOverlaps(a, b) {
  if (a.car !== b.car) return false;
  return !(a.to < b.from || a.from > b.to);
}
function findConflict(car, from, to, excludeId) {
  const candidate = { car, from, to };
  return RESERVATIONS.find(r =>
    r.id !== excludeId &&
    r.status !== 'rejected' &&
    reservationOverlaps(r, candidate)
  );
}

// ── Missing-trip detection: gaps in odometer between consecutive trips on same car
function findKmGaps() {
  const gaps = [];
  for (const car of CARS) {
    const trips = RECENT_TRIPS
      .filter(t => t.car === car.short)
      .sort((a, b) => a.date.localeCompare(b.date));
    for (let i = 1; i < trips.length; i++) {
      const prev = trips[i - 1], cur = trips[i];
      if (cur.start !== prev.eind) {
        gaps.push({
          id: 'gap-' + car.short + '-' + i,
          car: car.short,
          after: prev, before: cur,
          missingKm: cur.start - prev.eind,
        });
      }
    }
  }
  return gaps;
}

// ── Suspicious fuel: large bedrag + no "vol" flag, OR big interval to previous
function findSuspectFuel() {
  const flagged = [];
  for (const car of CARS) {
    const fills = RECENT_FUEL
      .filter(f => f.car === car.short)
      .sort((a, b) => a.date.localeCompare(b.date));
    for (let i = 0; i < fills.length; i++) {
      const f = fills[i];
      const reasons = [];
      if (f.bedrag > 90 && !f.vol) reasons.push('Groot bedrag, geen volle tank');
      if (i > 0) {
        const prev = fills[i - 1];
        const days = (new Date(f.date) - new Date(prev.date)) / 86400000;
        if (days > 45) reasons.push(`${Math.round(days)} dagen sinds vorige`);
      }
      if (reasons.length) flagged.push({ id: 'flag-' + f.id, fuel: f, reasons });
    }
  }
  return flagged;
}

// ── date helpers
const MONTHS_NL = ['jan','feb','mrt','apr','mei','jun','jul','aug','sep','okt','nov','dec'];
const MONTHS_EN = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const DAYS_NL = ['zo','ma','di','wo','do','vr','za'];
const DAYS_EN = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
function fmtDate(iso, lang) {
  const d = new Date(iso);
  const day = d.getDate();
  const mo = (lang === 'nl' ? MONTHS_NL : MONTHS_EN)[d.getMonth()];
  const dow = (lang === 'nl' ? DAYS_NL : DAYS_EN)[d.getDay()];
  return `${dow} ${day} ${mo}`;
}
function fmtMoney(n) {
  return '€ ' + n.toFixed(2).replace('.', ',');
}
function fmtKm(n) {
  return n.toLocaleString('nl-BE') + ' km';
}

// ── Year stats for ME (Roeland, 2026)
function myYearStats() {
  const myTrips = RECENT_TRIPS.filter(t => t.who === 'Roeland');
  const myFuel  = RECENT_FUEL.filter(f => f.who === 'Roeland');
  const myExp   = RECENT_EXPENSES.filter(e => e.who === 'Roeland');
  const fuelPaid = myFuel.reduce((s,f) => s + f.bedrag, 0);
  const expPaid  = myExp.reduce((s,e) => s + e.bedrag, 0);
  const tripsCost = myTrips.reduce((s,t) => s + t.total, 0);
  return {
    fuelPaid, expPaid, tripsCost,
    balance: fuelPaid + expPaid - tripsCost, // + = credit
    trips: myTrips.length,
    km: myTrips.reduce((s,t) => s + t.km, 0),
    fillups: myFuel.length,
  };
}

// ── Per-car km/cost aggregation for the whole year (used by admin km-price helper + owner payout)
function carYearAggregates(car) {
  const trips = RECENT_TRIPS.filter(t => t.car === car.short);
  const fuel  = RECENT_FUEL.filter(f => f.car === car.short);
  const exp   = RECENT_EXPENSES.filter(e => e.car === car.short);
  const kmDriven = trips.reduce((s,t) => s + t.km, 0);
  const tripRevenue = trips.reduce((s,t) => s + t.total, 0);  // what members paid (with discounts)
  const fuelPaid = fuel.reduce((s,f) => s + f.bedrag, 0);
  const expPaid  = exp.reduce((s,e) => s + e.bedrag, 0);
  const vasteTotal = (car.fixedCosts || []).reduce((s, c) => s + c.amount, 0);
  const ownerNet = tripRevenue - fuelPaid - expPaid - vasteTotal;
  return { kmDriven, tripRevenue, fuelPaid, expPaid, vasteTotal, ownerNet, fuel, exp, trips };
}

// ── Last-year co-op km per car at the same month (April) — used for YoY comparison strip
const LAST_YEAR_COOP_KM = { JF: 2100, ETH: 1540, LEW: 1820 };

// ── Fleet Economics — the core model for the redesign (§ Fleet Economics doc)
//   Principle: price = variablePerKm + fixedContributionPerKm
//   Every co-op-km fills a "fixed-cost recovery bucket" for the owner.
//   At break-even km, the bucket is full. Beyond that, co-op keeps overpaying into owner's pocket.
function fleetEconomics(car) {
  const a = carYearAggregates(car);
  const ownerIds = car.ownerIds || [car.eigenaar];
  const ownerSet = new Set(ownerIds);

  // Split km by owner vs co-op (others)
  const ownerTrips = a.trips.filter(t => ownerSet.has(t.who));
  const othersTrips = a.trips.filter(t => !ownerSet.has(t.who));
  const kmOwner  = ownerTrips.reduce((s, t) => s + t.km, 0);
  const kmOthers = othersTrips.reduce((s, t) => s + t.km, 0);
  const othersPaid = othersTrips.reduce((s, t) => s + t.total, 0);

  // Derived per-km costs (from last year or this year so far — whichever we have)
  const baseKm = car.jaarKm || (kmOwner + kmOthers) || 1;
  const variablePerKm = (a.fuelPaid + a.expPaid) / baseKm;
  const fixedContributionPerKm = Math.max(0, car.prijs - variablePerKm);

  // The bucket
  const vasteTotal = (car.fixedCosts || []).reduce((s, c) => s + c.amount, 0);
  const recoveredYTD = kmOthers * fixedContributionPerKm;
  const recoveredPct = Math.min(100, (recoveredYTD / vasteTotal) * 100);
  const breakEvenKm = fixedContributionPerKm > 0 ? Math.ceil(vasteTotal / fixedContributionPerKm) : Infinity;
  const kmUntilBreakEven = Math.max(0, breakEvenKm - kmOthers);
  const pastBreakEven = kmOthers >= breakEvenKm;

  // Expected
  const expected = car.expectedCoopKm || 0;
  const pctOfExpected = expected > 0 ? (kmOthers / expected) * 100 : 0;

  // Owner variable cost
  const ownerVariableCost = kmOwner * variablePerKm;

  // ── Projection (mock current month = April = 4)
  const currentMonth = 4;
  const monthlyPace = currentMonth > 0 ? kmOthers / currentMonth : 0;
  const projectedYearlyKm = monthlyPace * 12;
  const projectedRecovery = Math.min(vasteTotal, projectedYearlyKm * fixedContributionPerKm);
  const projectedBurden = vasteTotal - projectedRecovery;
  const projectedBurdenPct = projectedBurden / vasteTotal;
  const status = pastBreakEven || projectedBurden <= 0 ? 'green'
    : projectedBurdenPct <= 0.35 ? 'amber'
    : 'red';

  // ── Monthly co-op km for break-even curve chart
  const byMonth = {};
  for (const t of othersTrips) {
    const m = parseInt(t.date.split('-')[1]);
    byMonth[m] = (byMonth[m] || 0) + t.km;
  }
  let cumKm = 0;
  const curveData = [];
  for (let m = 1; m <= 12; m++) {
    if (m <= currentMonth) {
      cumKm += (byMonth[m] || 0);
      curveData.push({
        m, actual: true, cumKm,
        remaining: Math.max(0, vasteTotal - cumKm * fixedContributionPerKm),
      });
    } else {
      const projCumKm = kmOthers + monthlyPace * (m - currentMonth);
      curveData.push({
        m, actual: false, cumKm: projCumKm,
        remaining: Math.max(0, vasteTotal - projCumKm * fixedContributionPerKm),
      });
    }
  }

  // ── Per-person contribution ledger, sorted by km desc
  const contribMap = {};
  for (const t of othersTrips) {
    contribMap[t.who] = (contribMap[t.who] || 0) + t.km;
  }
  const contributions = Object.entries(contribMap)
    .map(([who, km]) => ({ who, km, recovered: km * fixedContributionPerKm }))
    .sort((a, b) => b.km - a.km);

  // ── Year-on-year comparison (same month last year)
  const lastYearCoopKm = LAST_YEAR_COOP_KM[car.short] || 0;
  const lastYearRecovered = lastYearCoopKm * fixedContributionPerKm;
  const lastYearBurden = Math.max(0, vasteTotal - lastYearRecovered);

  return {
    ownerIds,
    kmOwner, kmOthers, kmTotal: kmOwner + kmOthers,
    othersPaid, ownerVariableCost,
    variablePerKm, fixedContributionPerKm,
    vasteTotal, recoveredYTD, recoveredPct,
    breakEvenKm, kmUntilBreakEven, pastBreakEven,
    expectedCoopKm: expected, pctOfExpected,
    // projections
    currentMonth, monthlyPace, projectedYearlyKm,
    projectedBurden, projectedBurdenPct, status,
    // break-even curve data
    curveData,
    // contribution ledger
    contributions,
    // year-on-year comparison
    lastYearCoopKm, lastYearBurden,
    // raw
    agg: a,
  };
}

// ── Suggested km-price: covers all costs using last year's km
function suggestedKmPrice(car) {
  const a = carYearAggregates(car);
  const jaarKm = car.jaarKm || a.kmDriven || 1;
  const varCost = (a.fuelPaid + a.expPaid) / jaarKm;       // fuel + maintenance per km
  const fixedCost = a.vasteTotal / jaarKm;                 // insurance/tax/inspection/depreciation per km
  const catTotals = (car.fixedCosts || []).reduce((acc, fc) => {
    acc[fc.category] = (acc[fc.category] || 0) + fc.amount;
    return acc;
  }, {});
  return {
    varCost, fixedCost,
    breakdown: {
      brandstof: a.fuelPaid / jaarKm,
      onderhoud:  a.expPaid / jaarKm,
      ...Object.fromEntries(Object.entries(catTotals).map(([k, v]) => [k, v / jaarKm])),
    },
    kostprijs: varCost + fixedCost,
    currentPrice: car.prijs,
    delta: car.prijs - (varCost + fixedCost),
  };
}

// ── Yearly settlement: per-person balance for the whole cooperative
function yearlySettlement() {
  const rows = PEOPLE.map(p => {
    const paidFuel = RECENT_FUEL.filter(f => f.who === p.name).reduce((s,f) => s + f.bedrag, 0);
    const paidExp  = RECENT_EXPENSES.filter(e => e.who === p.name).reduce((s,e) => s + e.bedrag, 0);
    const tripCost = RECENT_TRIPS.filter(t => t.who === p.name).reduce((s,t) => s + t.total, 0);
    const balance = paidFuel + paidExp - tripCost; // + = co-op owes them
    return { name: p.name, paidFuel, paidExp, tripCost, balance };
  });
  rows.sort((a,b) => b.balance - a.balance);
  return rows;
}

Object.assign(window, {
  CARS, carByShort, carByName,
  PEOPLE, personByName, ME,
  calcTripAmount, calcTripBreakdown,
  RECENT_TRIPS, RECENT_FUEL, RECENT_EXPENSES, RESERVATIONS,
  MONTHS_NL, MONTHS_EN, DAYS_NL, DAYS_EN,
  fmtDate, fmtMoney, fmtKm, myYearStats,
  reservationOverlaps, findConflict, findKmGaps, findSuspectFuel,
  carYearAggregates, suggestedKmPrice, yearlySettlement, fleetEconomics,
  LAST_YEAR_COOP_KM,
});
