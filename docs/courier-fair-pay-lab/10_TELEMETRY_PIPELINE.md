# Courier Fair Pay — Telemetry Pipeline V0.2

## Architecture

Apps/services émettent des faits terrain. Ils ne calculent pas eux-mêmes la paie.

`Courier / Merchant / API / OPS / Payments`
→ événements/faits bruts
→ normalizer strict
→ ledger append-only
→ projector hebdomadaire
→ Fair Pay Kernel
→ statement V0.2

## Signaux

### AVAILABLE — runtime LAB
- `acceptedAt` — Orders runtime → Fair Pay bridge;
- `readyAt` — Orders runtime → Fair Pay bridge;
- `courierArrivedPickupAt` — endpoint/store/UI + Fair Pay bridge;
- `pickedUpAt` — Orders runtime → Fair Pay bridge;
- `deliveredAt` — Orders runtime → Fair Pay bridge.

`courierArrivedPickupAt` controls:
- store serveur: oui;
- route dispatch: oui;
- assigned-courier guard: oui;
- idempotence: oui;
- flag serveur: oui;
- UI Mission Live distincte: oui;
- flag Expo: oui;
- relecture serveur: oui;
- full Courier TypeScript: PASS;
- iOS Expo/Hermes bundle: PASS;
- device E2E: restant.

### PARTIAL

`eligibleIncomeCredit`, `tipCredit`, `expenseReimbursementCredit`
- builders evidence-backed: oui;
- mapping réel paiement/payroll/policy: restant.

### MISSING
- `requiredRepositionStartedAt/EndedAt` runtime;
- `otherPaidWorkStartedAt/EndedAt` runtime.

## Pickup waiting

Le système ne déduit jamais l'arrivée à partir de `acceptedAt`, `readyAt` ou GPS seul.

Clock mission:
- ACCEPTED → PICKUP_ARRIVED = active mission;
- PICKUP_ARRIVED → PICKED_UP = pickup dwell / waiting;
- PICKED_UP → DELIVERED = active mission.

Sans `PICKUP_ARRIVED` explicite, la mission reste incomplète et aucun statement final n'est produit.

## France

La durée ARPE estimée est un fait `ACTIVITY_GUARANTEE_ESTIMATE`, distinct du temps réel.

Aucune estimation présente → calcul garantie refusé.

## Reposition / other paid

Ces temps ne pourront entrer dans la paie qu'avec couples START/END explicites et segmentId partagé.

## Week key

La semaine payroll est calculée dans le fuseau de la policy:
- Belgique: Europe/Brussels;
- France: Europe/Paris.

Une mission qui traverse une frontière de semaine locale est actuellement bloquée pour traitement explicite au lieu d'être ventilée implicitement.

## Feature flags

Serveur:
`DA_COURIER_FAIR_PAY_LAB_ENABLED`

Courier Expo:
`EXPO_PUBLIC_COURIER_FAIR_PAY_LAB_ENABLED`

Les deux restent OFF par défaut.
