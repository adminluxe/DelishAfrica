# Viability Mathematics — Courier Fair Pay Lab

## Separation

Payroll answers what the courier is owed.

Zone economics answers whether DelishAfrica® can sustain the operating cell.

These computations are intentionally separate.

## Core equations

Let:

- `C_h` = fully loaded employer courier cost per paid hour;
- `D_h` = deliveries per paid hour;
- `M_d` = contribution available before courier cost per delivery;
- `F` = fixed zone cost;
- `H` = paid hours;
- `D` = deliveries.

Then:

`courierCostPerDelivery = C_h / D_h`

and:

`residualZoneContribution = (M_d * D) - (C_h * H) - F`

Simple break-even density, excluding fixed zone cost:

`breakEvenDeliveriesPerPaidHour = C_h / M_d`

If POG wants a target residual contribution `R_d` per delivery:

`targetDeliveriesPerPaidHour = C_h / (M_d - R_d)`

provided `M_d > R_d`.

## Utilization

`utilization = activeMissionHours / paidHours`

Low utilization is not automatically a labor problem. It may indicate:
- zone too large;
- insufficient order density;
- bad shift design;
- restaurant preparation delays;
- weak batching;
- too much empty repositioning;
- forecasting error.

## LAB example only

Assume:
- fully loaded courier cost = 30.00 EUR / paid hour;
- contribution before courier = 12.00 EUR / delivery.

Break-even:

`30 / 12 = 2.5 deliveries per paid hour`

At 1.8 deliveries/hour the zone is negative. The worker pay does not decrease.

At 3.0 deliveries/hour:
- courier cost/delivery = 10.00 EUR;
- residual before fixed zone costs = 2.00 EUR/delivery.

These numbers are **illustrative laboratory assumptions**, not approved POG production economics.

## Pilot metrics

Daily/weekly:
- paid hours;
- active mission hours;
- utilization;
- deliveries/paid hour;
- average waiting at merchant;
- required reposition time/km;
- batching rate;
- on-time pickup/delivery;
- courier incidents;
- courier cost/delivery;
- contribution before courier/delivery;
- residual contribution/delivery;
- pay differentials;
- courier disputes;
- courier satisfaction;
- merchant satisfaction;
- client satisfaction.

A zone should not scale merely because order count looks impressive.
