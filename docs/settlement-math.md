# Settlement Algorithm — Mathematical Specification

Implementation: `lib/queries/settlement.ts`  
Verification: `Σ S1 + Σ S1Cross + Σ S2 ≈ 0`

---

## 1. Primitives (per person p, car c, settlement year y)

| Symbol      | Formula                                        | Description                                                                   |
| ----------- | ---------------------------------------------- | ----------------------------------------------------------------------------- |
| **T(p,c)**  | `SUM(trips.amount)`                            | Euro trip charges for p on car c                                              |
| **TK(p,c)** | `SUM(trips.km)`                                | Km driven by p on car c (always shown, even for own-car rows)                 |
| **F(p,c)**  | `SUM(fuel.amount WHERE settled_outside=0)`     | Fuel paid by p for car c                                                      |
| **E(p,c)**  | `SUM(expenses.amount WHERE settled_outside=0)` | Expenses paid by p for car c                                                  |
| **b(p,c)**  | `T(p,c) − F(p,c) − E(p,c)`                     | Net contribution of p to car c (positive = p paid in more than they advanced) |

---

## 2. Own-Car Rule (vestzak/broekzak)

Owner o's own trips on their car c\* cost **€0** to the settlement.  
When computing N(c), S2, or any settlement quantity:

```
if p == owner(c):  T(p,c) = F(p,c) = E(p,c) = 0   [zeroed in calculation]
```

TK(p,c) is still displayed (transparency), but every euro amount is 0.  
**Owner driving their own car is free — no revenue generated, no expense reimbursed.**

---

## 3. N(c) — Net Revenue of Car c (what co-op owes owner)

```
N(c) = Σ_{p ≠ owner(c)} b(p,c)
     = Σ_{p ≠ owner(c)} [ T(p,c) − F(p,c) − E(p,c) ]
```

Includes: regular members + cross-owners (other car owners driving car c).  
Excludes: car's own owner (own-car rule).  
**Positive N(c) = co-op collected net revenue on this car → owes owner N(c).**

---

## 4. S1(p) — Non-Owner's Balance with Co-op (Step 1)

For each **non-owner** member p:

```
S1(p) = Σ_c [ −T(p,c) + F(p,c) + E(p,c) ]
       = −Σ_c b(p,c)
```

| S1(p)     | Meaning               | Transfer                      |
| --------- | --------------------- | ----------------------------- |
| S1(p) < 0 | p owes co-op          | p → co-op, amount = \|S1(p)\| |
| S1(p) > 0 | co-op owes p (credit) | co-op → p, amount = S1(p)     |
| S1(p) = 0 | settled               | no transfer                   |

**Step 1 total** (shown in UI header): `Σ_p S1(p)` — positive = co-op net collects from members.

---

## 5. S2(o) — Owner's Car Payout (Step 2)

For each **owner** o:

```
S2(o) = Σ_{c : owner(c) = o} N(c)
```

**Always positive** in normal usage (co-op pays owner).  
Transfer: `co-op → o, amount = S2(o)`.

---

## 6. S1Cross(o) — Cross-Owner Balance (Step 1, owner side)

When owner o drives another owner's car, o has a Step 1 balance for those cars only:

```
S1Cross(o) = Σ_{c : owner(c) ≠ o} [ −T(o,c) + F(o,c) + E(o,c) ]
```

| S1Cross(o)     | Meaning                                  | Transfer  |
| -------------- | ---------------------------------------- | --------- |
| S1Cross(o) < 0 | o owes co-op for cross-car usage         | o → co-op |
| S1Cross(o) > 0 | co-op owes o for cross-car fuel/expenses | co-op → o |

Routed through co-op (not direct owner-to-owner). This eliminated the old Step 3.

---

## 7. Net(o) — Owner's Total Settlement Position

```
Net(o) = S2(o) + S1Cross(o)
```

This is what the owner ultimately receives (positive) or pays (negative, rare).  
Displayed in `OwnerMemberCard` as the single headline amount.

---

## 8. Transfer Generation

### Step 1 (all members + cross-owners)

```
∀ non-owner p:
  S1(p) < 0  →  transfer  p → co-op,  amount = |S1(p)|
  S1(p) > 0  →  transfer  co-op → p,  amount =  S1(p)

∀ owner o (cross-owner balance):
  S1Cross(o) < 0  →  transfer  o → co-op,  amount = |S1Cross(o)|
  S1Cross(o) > 0  →  transfer  co-op → o,  amount =  S1Cross(o)
```

### Step 2 (owners receive payout)

```
∀ owner o:
  transfer  co-op → o,  amount = S2(o)
```

No Step 3. Cross-owner is fully handled in Step 1.

---

## 9. Verification Identity

```
Σ_p S1(p)  +  Σ_o S1Cross(o)  +  Σ_o S2(o)  ≈  0   (within €0.05)
```

Co-op is a pass-through: every euro collected from members (S1 + S1Cross) equals every euro paid out to owners (S2). If this fails, `verify_ok = false` is surfaced in the UI.

---

## 10. Payment Tracking

After transfers are generated, each is annotated with payment status.

### Payment sign convention in DB (`payments` table)

| amount sign  | meaning                                                                |
| ------------ | ---------------------------------------------------------------------- |
| **positive** | member paid co-op (settling their Step 1 debt)                         |
| **negative** | co-op paid person (disbursement: credit member refund or owner payout) |

`payments.year` = date.year − 1 (a 2026 payment settles 2025).

### Annotation rules

```
Step 2 transfer (co-op → owner):
  paid = |Σ all payments for owner in year|   [net of positive + negative]
  open = max(0, S2(o) − paid)
  ← "virtual vereffening" was recorded as net(o) = S2 + S1Cross in one entry

Step 1 credit transfer (co-op → member, S1(p) > 0):
  paid = Σ |amount| for payments where amount < 0
  open = max(0, S1(p) − paid)

Step 1 debit transfer (member → co-op, S1(p) < 0):
  paid = Σ amount for payments where amount > 0
  open = max(0, |S1(p)| − paid)

Step 1 cross-owner transfers (owner's S1Cross):
  payment_status = null   ← subsumed into step 2 net payment
```

### Resolved / outstanding

```
exact_match(transfer) = |paid − transfer.amount| < €0.05
outstanding           = ¬exact_match   [covers underpaid AND overpaid]
all_paid              = all tracked transfers are exact_match
```

Overpaid: `paid > amount` — shown as "teveel betaald" in red, card stays expanded.

---

## 11. UI Card Slim Rule

A settlement card collapses to slim if and only if:

```
isSlim = !showAll  AND  (no_transfer  OR  exact_match)
```

Where `no_transfer` = person has no transfer for this year (net ≈ 0).  
`exact_match` = `|paid − transfer.amount| < €0.05`.

| Border color          | Meaning                                                 |
| --------------------- | ------------------------------------------------------- |
| Black (`paper.ink`)   | No transfer — net zero, nothing to settle               |
| Blue (`paper.blue`)   | Open credit — co-op owes person, not yet paid           |
| Red (`paper.accent`)  | Open debit — person owes co-op, or overpaid discrepancy |
| Green (`paper.green`) | Exact match — fully settled                             |

---

## 12. Row Types in Car Settlement Display

| row_type      | Who               | T(p,c) | F,E    | Balance b(p,c) |
| ------------- | ----------------- | ------ | ------ | -------------- |
| `member`      | Regular non-owner | actual | actual | actual         |
| `cross_owner` | Other car owner   | actual | actual | actual         |
| `own`         | This car's owner  | **0**  | **0**  | **0**          |

`own` rows show TK (km driven) for transparency but all euro fields are 0.

---

## 13. Worked Example

Two owners (Malvina, Roeland), several members, one year:

```
Members pay trips on both cars, fill up fuel, pay some expenses.

N(Malvina's car) = Σ b(p, Malvina's car) for p ≠ Malvina
                 = (member trips) − (all fuel on car) − (all expenses on car)

N(Roeland's car) = same for Roeland's car

S2(Malvina) = N(Malvina's car)
S2(Roeland) = N(Roeland's car)

If Malvina drives Roeland's car (cross-owner):
  S1Cross(Malvina) = −T(Malvina, Roeland's car) + F(Malvina, Roeland's car) + E(...)
  Net(Malvina) = S2(Malvina) + S1Cross(Malvina)

  And N(Roeland's car) includes Malvina's b(Malvina, Roeland's car)
  → Roeland effectively receives Malvina's cross-car contribution via co-op

Verification:
  Σ S1(members) + S1Cross(Malvina) + S1Cross(Roeland) + S2(Malvina) + S2(Roeland) = 0
```
