# Courier Fair Pay — Telemetry Pipeline V0.1

## Rule

Apps and operational services emit factual events. They do not calculate wages.

Flow:

`Client / Merchant / Courier / API / OPS / Payments events`
→ `raw clock + money telemetry`
→ `strict normalizer`
→ `canonical payroll facts`
→ `weekly projector`
→ `Fair Pay Kernel`
→ `weekly statement`

## Existing signals found in the current codebase

AVAILABLE:
- mission/order acceptance: `acceptedAt`;
- merchant/order ready state: `readyAt` / status `ready`;
- pickup: `pickedUpAt`;
- delivery: `deliveredAt`.

PARTIAL:
- tips/payment domain exists, but no canonical Courier payroll fact mapping is established.

MISSING / must be explicit:
- `courierArrivedPickupAt`;
- required reposition start/end;
- other paid work start/end;
- legally validated eligible-income credit;
- expense reimbursement credit.

## Why pickup arrival is mandatory

`acceptedAt`, `readyAt` and `pickedUpAt` do not prove when the courier reached the merchant.

Therefore the kernel must not infer restaurant waiting from those timestamps.

No `PICKUP_ARRIVED` event → no normalized mission time facts for payroll finalization.

## Normalized mission clock

When all four clock signals exist:

`MISSION_ACCEPTED → PICKUP_ARRIVED`
= ACTIVE_MISSION

`PICKUP_ARRIVED → PICKED_UP`
= PLATFORM_CONTROLLED_WAITING / pickup dwell

`PICKED_UP → DELIVERED`
= ACTIVE_MISSION

The merchant-ready event is retained as an operational diagnostic. It does not independently create or erase worker entitlement.

## France-specific duration

The French activity guarantee uses a separate `ACTIVITY_GUARANTEE_ESTIMATE` duration fact.

It is not derived from actual mission timestamps.

If a country policy requires an activity guarantee and the explicit estimate is absent, calculation fails with:

`COURIER_PAYROLL_ACTIVITY_GUARANTEE_DURATION_REQUIRED`

## OPS segments

Required repositioning and other paid work are normalized only from explicit START/END pairs sharing a segment ID.

Missing end/start → segment remains incomplete and cannot silently enter payroll.

## Audit

Every normalized fact contains:
- stable fact ID;
- policy ID;
- country;
- courier;
- week;
- raw evidence event IDs;
- source = `PAYROLL_NORMALIZER`.

This lets every statement amount be traced back to factual events.
