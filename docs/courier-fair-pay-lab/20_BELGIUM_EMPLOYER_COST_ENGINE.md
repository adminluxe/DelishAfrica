# Belgium Employer Cost Engine — V0.1

Date: 27 October 2026
Status: LAB — PARAMETRIC / NOT PAYROLL ADVICE

## Purpose

Replace the old single illustrative assumption “30 EUR employer cost/hour” with a transparent composition model.

The engine does **not** invent missing Belgian payroll inputs. It exposes them.

## Implemented components

`computeEmployerCost()` accepts:
- gross hourly wage;
- employer social-contribution rate;
- holiday-load rate;
- sector-fund rate;
- accident/work-risk insurance cost/hour;
- equipment cost/hour;
- prevention/occupational-health cost/hour;
- payroll/social-secretariat admin cost/hour;
- benefits/hour;
- other explicit costs/hour;
- explicit reductions/hour.

Output exposes every component plus:

`fullyLoadedEmployerCostCentsPerPaidHour`

## Verified Belgian base input

ONSS administrative instructions 2026/3 state a base employer social-contribution rate of **24.92%** for private-sector workers.

This is only a base input, not a full employer-cost factor.

Source:
https://www.socialsecurity.be/employer/instructions/dmfa/fr/latest/instructions/socialsecuritycontributions/contributions.html

## Example — base contribution only

Gross:
19.00 EUR/hour

Base employer contribution:
24.92%

Engine:
- gross = 19.00
- base contribution = 4.74
- subtotal = 23.74 EUR/hour

The engine rounds cost components upward to the cent where a percentage creates a fractional cent.

This subtotal is **not** represented as full Belgian cost.

## Why the 30 EUR/hour lab scenario remains illustrative

Potential additional layers include:
- paid-holiday load;
- sector funds;
- accident insurance;
- equipment;
- prevention/occupational medicine;
- payroll administration;
- applicable premiums;
- benefits;
- other statutory/contractual costs;
- applicable reductions.

Until the competent CP/CBA, classification and payroll setup are fixed, these values remain OPEN.

## Design invariant

No cost layer may be silently hidden in a generic multiplier.

If POG eventually models:
- employer contribution;
- holiday;
- insurance;
- equipment;

the resulting audit should show each component separately.

Negative hidden adjustments are rejected.

## QA

Tests prove:
- 19.00 EUR + 24.92% => 4.74 EUR base employer contribution and 23.74 EUR subtotal;
- layered costs/reductions remain explicit;
- negative hidden cost entries are rejected.

## Integration

The resulting fully loaded cost can feed Zone Viability:

`breakEvenDeliveriesPerPaidHour =
  fullyLoadedEmployerCostPerPaidHour /
  contributionBeforeCourierPerDelivery`

The Employer Cost Engine does **not** feed back into the Fair Pay entitlement calculation.

Therefore a higher employer cost may make a zone unviable, but cannot lower what the worker is owed.
