# Settlement Algorithm — Mathematical Specification

Implementation: `lib/queries/settlement.ts`  
Verification: $\sum_p S_1(p) + \sum_o S_1^{\text{cross}}(o) + \sum_o S_2(o) \approx 0$

---

## 1. Primitives (per person $p$, car $c$, settlement year $y$)

| Symbol    | Formula                                        | Description                                                                         |
| --------- | ---------------------------------------------- | ----------------------------------------------------------------------------------- |
| $T(p,c)$  | `SUM(trips.amount)`                            | Euro trip charges for $p$ on car $c$                                                |
| $TK(p,c)$ | `SUM(trips.km)`                                | Km driven by $p$ on car $c$ (always shown, even for own-car rows)                   |
| $F(p,c)$  | `SUM(fuel.amount WHERE settled_outside=0)`     | Fuel paid by $p$ for car $c$                                                        |
| $E(p,c)$  | `SUM(expenses.amount WHERE settled_outside=0)` | Expenses paid by $p$ for car $c$                                                    |
| $b(p,c)$  | $T(p,c) - F(p,c) - E(p,c)$                     | Net contribution of $p$ to car $c$ (positive = $p$ paid in more than they advanced) |

---

## 2. Own-Car Rule (vestzak/broekzak)

Owner $o$'s own trips on their car $c^*$ cost **€0** to the settlement.  
When computing $N(c)$, $S_2$, or any settlement quantity:

$$\text{if } p = \text{owner}(c): \quad T(p,c) = F(p,c) = E(p,c) = 0$$

$TK(p,c)$ is still displayed (transparency), but every euro amount is 0.  
**Owner driving their own car is free — no revenue generated, no expense reimbursed.**

---

## 3. $N(c)$ — Net Revenue of Car $c$ (what co-op owes owner)

$$N(c) = \sum_{p \,\neq\, \text{owner}(c)} b(p,c) = \sum_{p \,\neq\, \text{owner}(c)} \bigl[T(p,c) - F(p,c) - E(p,c)\bigr]$$

Includes: regular members + cross-owners (other car owners driving car $c$).  
Excludes: car's own owner (own-car rule).  
**Positive $N(c)$ = co-op collected net revenue on this car → owes owner $N(c)$.**

---

## 4. $S_1(p)$ — Non-Owner's Balance with Co-op (Step 1)

For each **non-owner** member $p$:

$$S_1(p) = \sum_c \bigl[-T(p,c) + F(p,c) + E(p,c)\bigr] = -\sum_c b(p,c)$$

| $S_1(p)$     | Meaning                 | Transfer                                              |
| ------------ | ----------------------- | ----------------------------------------------------- |
| $S_1(p) < 0$ | $p$ owes co-op          | $p \to \text{co-op}$, amount $= \lvert S_1(p) \rvert$ |
| $S_1(p) > 0$ | co-op owes $p$ (credit) | $\text{co-op} \to p$, amount $= S_1(p)$               |
| $S_1(p) = 0$ | settled                 | no transfer                                           |

**Step 1 total** (shown in UI header): $\sum_p S_1(p)$ — positive = co-op net collects from members.

---

## 5. $S_2(o)$ — Owner's Car Payout (Step 2)

For each **owner** $o$:

$$S_2(o) = \sum_{\{c \,:\, \text{owner}(c) = o\}} N(c)$$

**Always positive** in normal usage (co-op pays owner).  
Transfer: $\text{co-op} \to o$, amount $= S_2(o)$.

---

## 6. $S_1^{\text{cross}}(o)$ — Cross-Owner Balance (Step 1, owner side)

When owner $o$ drives another owner's car, $o$ has a Step 1 balance for those cars only:

$$S_1^{\text{cross}}(o) = \sum_{\{c \,:\, \text{owner}(c) \neq o\}} \bigl[-T(o,c) + F(o,c) + E(o,c)\bigr]$$

| $S_1^{\text{cross}}(o)$     | Meaning                                    | Transfer             |
| --------------------------- | ------------------------------------------ | -------------------- |
| $S_1^{\text{cross}}(o) < 0$ | $o$ owes co-op for cross-car usage         | $o \to \text{co-op}$ |
| $S_1^{\text{cross}}(o) > 0$ | co-op owes $o$ for cross-car fuel/expenses | $\text{co-op} \to o$ |

Routed through co-op (not direct owner-to-owner). This eliminated the old Step 3.

---

## 7. $\text{Net}(o)$ — Owner's Total Settlement Position

$$\text{Net}(o) = S_2(o) + S_1^{\text{cross}}(o)$$

This is what the owner ultimately receives (positive) or pays (negative, rare).  
Displayed in `OwnerMemberCard` as the single headline amount.

---

## 8. Transfer Generation

### Step 1 (all members + cross-owners)

For each non-owner $p$:

- $S_1(p) < 0 \;\Rightarrow\; p \to \text{co-op}$, amount $= \lvert S_1(p) \rvert$
- $S_1(p) > 0 \;\Rightarrow\; \text{co-op} \to p$, amount $= S_1(p)$

For each owner $o$ (cross-owner balance):

- $S_1^{\text{cross}}(o) < 0 \;\Rightarrow\; o \to \text{co-op}$, amount $= \lvert S_1^{\text{cross}}(o) \rvert$
- $S_1^{\text{cross}}(o) > 0 \;\Rightarrow\; \text{co-op} \to o$, amount $= S_1^{\text{cross}}(o)$

### Step 2 (owners — net payout)

For each owner $o$, the step 2 transfer uses $\text{Net}(o) = S_2(o) + S_1^{\text{cross}}(o)$:

- $\text{Net}(o) > 0 \;\Rightarrow\; \text{co-op} \to o$, amount $= \text{Net}(o)$
- $\text{Net}(o) < 0 \;\Rightarrow\; o \to \text{co-op}$, amount $= \lvert\text{Net}(o)\rvert$
- $\text{Net}(o) \approx 0 \;\Rightarrow\;$ no transfer

The step 1 $S_1^{\text{cross}}$ transfer also exists in the transfer list (for display), but carries `payment_status = null` — it is subsumed into the step 2 net. No Step 3.

---

## 9. Verification Identity

$$\sum_p S_1(p) \;+\; \sum_o S_1^{\text{cross}}(o) \;+\; \sum_o S_2(o) \;\approx\; 0 \quad (\text{within } \text{€}0.05)$$

Co-op is a pass-through: every euro collected from members ($S_1 + S_1^{\text{cross}}$) equals every euro paid out to owners ($S_2$). If this fails, `verify_ok = false` is surfaced in the UI.

---

## 10. Payment Tracking

After transfers are generated, each is annotated with payment status.

### Payment sign convention in DB (`payments` table)

| amount sign  | meaning                                                                |
| ------------ | ---------------------------------------------------------------------- |
| **positive** | member paid co-op (settling their Step 1 debt)                         |
| **negative** | co-op paid person (disbursement: credit member refund or owner payout) |

`payments.year` = `date.year − 1` (a 2026 payment settles 2025).

### Annotation rules

**Step 2 transfer** (amount $= \lvert\text{Net}(o)\rvert$, direction per sign):

$$\text{paid} = \left\lvert \sum_{\text{payments for owner in year}} \text{amount} \right\rvert \quad [\text{net of positive + negative}]$$
$$\text{open} = \max\!\bigl(0,\; \lvert\text{Net}(o)\rvert - \text{paid}\bigr)$$

_Note: "virtual vereffening" was recorded as $\text{Net}(o) = S_2 + S_1^{\text{cross}}$ in one entry — hence tracking uses net of all payments._

**Step 1 credit transfer** ($\text{co-op} \to p$, $S_1(p) > 0$):

$$\text{paid} = \sum_{\{\text{pmts} : \text{amount} < 0\}} \lvert\text{amount}\rvert, \qquad \text{open} = \max\!\bigl(0,\; S_1(p) - \text{paid}\bigr)$$

**Step 1 debit transfer** ($p \to \text{co-op}$, $S_1(p) < 0$):

$$\text{paid} = \sum_{\{\text{pmts} : \text{amount} > 0\}} \text{amount}, \qquad \text{open} = \max\!\bigl(0,\; \lvert S_1(p)\rvert - \text{paid}\bigr)$$

**Step 1 cross-owner transfers** ($S_1^{\text{cross}}$): `payment_status = null` — subsumed into Step 2 net payment.

### Resolved / outstanding

$$\text{exact\_match}(t) \;=\; \lvert \text{paid} - t.\text{amount} \rvert < 0.05$$
$$\text{outstanding} = \neg\,\text{exact\_match} \quad [\text{covers underpaid AND overpaid}]$$
$$\text{all\_paid} = \forall\, t \in \text{tracked transfers}: \text{exact\_match}(t)$$

Overpaid: $\text{paid} > \text{amount}$ — shown as "teveel betaald" in red, card stays expanded.

---

## 11. UI Card Slim Rule

A settlement card collapses to slim if and only if:

$$\text{isSlim} = \neg\,\text{showAll} \;\wedge\; \bigl(\text{no\_transfer} \;\vee\; \text{exact\_match}\bigr)$$

Where $\text{no\_transfer}$ = person has no transfer for this year (net $\approx 0$).  
$\text{exact\_match}$ = $\lvert \text{paid} - t.\text{amount} \rvert < 0.05$.

| Border color          | Meaning                                                 |
| --------------------- | ------------------------------------------------------- |
| Black (`paper.ink`)   | No transfer — net zero, nothing to settle               |
| Blue (`paper.blue`)   | Open credit — co-op owes person, not yet paid           |
| Red (`paper.accent`)  | Open debit — person owes co-op, or overpaid discrepancy |
| Green (`paper.green`) | Exact match — fully settled                             |

---

## 12. Row Types in Car Settlement Display

| row_type      | Who               | $T(p,c)$ | $F,E$  | $b(p,c)$ |
| ------------- | ----------------- | -------- | ------ | -------- |
| `member`      | Regular non-owner | actual   | actual | actual   |
| `cross_owner` | Other car owner   | actual   | actual | actual   |
| `own`         | This car's owner  | **0**    | **0**  | **0**    |

`own` rows show $TK$ (km driven) for transparency but all euro fields are 0.

---

## 13. Worked Example

Two owners (Malvina, Roeland), several members, one year:

$$N(\text{Malvina's car}) = \sum_{p \neq \text{Malvina}} b(p, \text{Malvina's car})$$

$$N(\text{Roeland's car}) = \sum_{p \neq \text{Roeland}} b(p, \text{Roeland's car})$$

$$S_2(\text{Malvina}) = N(\text{Malvina's car}), \qquad S_2(\text{Roeland}) = N(\text{Roeland's car})$$

If Malvina drives Roeland's car (cross-owner):

$$S_1^{\text{cross}}(\text{Malvina}) = -T(\text{Malvina}, \text{Roeland's car}) + F(\text{Malvina}, \text{Roeland's car}) + E(\ldots)$$

$$\text{Net}(\text{Malvina}) = S_2(\text{Malvina}) + S_1^{\text{cross}}(\text{Malvina})$$

And $N(\text{Roeland's car})$ includes $b(\text{Malvina}, \text{Roeland's car})$ — Roeland effectively receives Malvina's cross-car contribution via co-op.

**Verification:**

$$S_1(\text{members}) + S_1^{\text{cross}}(\text{Malvina}) + S_1^{\text{cross}}(\text{Roeland}) + S_2(\text{Malvina}) + S_2(\text{Roeland}) = 0$$
