# Courier Fair Pay Lab — Master TODO

Updated: 27 October 2026 — checkpoint Fair Pay ↔ ORCHIDPAY

## A. Kernel / maths
- [x] Fair Pay séparé de Zone Viability.
- [x] Arbitration minimum légal / floor POG / garantie locale.
- [x] Tips hors satisfaction du floor.
- [x] Frais hors satisfaction du floor.
- [x] Risque de sous-utilisation porté par POG.
- [x] Belgique employee LAB adapter.
- [x] France ARPE reference adapter.
- [x] Durée ARPE estimée séparée du clock réel.
- [x] Fuseau payroll par policy.
- [x] Break-even / target density.
- [x] Merchant-wait / batching model.
- [x] 30 combinaisons économiques + 45 opérationnelles.

## B. Audit / corrections
- [x] Policy SHA-256 immuable.
- [x] Mutation same-version rejetée.
- [x] Faits canoniques append-only.
- [x] Duplicate fact/event protection.
- [x] Time overlap protection.
- [x] Correction par supersession explicite.
- [x] Motif/approbateur/preuves obligatoires.
- [x] Double correction concurrente rejetée.
- [x] Statement V0.2 historique + faits effectifs.
- [x] Statement déterministe / contestable.
- [x] Correction humaine produit un nouveau statement sans effacer l'ancien.

## C. Télémétrie
- [x] Contrat raw clock events.
- [x] Mission normalizer.
- [x] Reposition/other-paid normalizer.
- [x] accepted/ready/pickup/delivered inventoriés.
- [x] Runtime producer accepted/ready/pickup/delivered branché au bridge.
- [x] Pickup-arrived backend/store/route en LAB.
- [x] Pickup-arrived UI Mission Live en LAB.
- [x] Dual feature flag serveur + Expo.
- [x] Builders evidence-backed income/tip/expense.
- [x] Courier full TypeScript typecheck.
- [x] Courier iOS Expo/Hermes bundle.
- [ ] Device E2E pickup-arrived / Fair Pay.
- [x] Runtime reposition start/end — OPS-only LAB producer.
- [x] Runtime other-paid start/end — OPS-only LAB producer.
- [ ] Mapping réel eligible income.
- [ ] Mapping réel tips.
- [ ] Workflow réel expense reimbursement.

## D. Persistence / execution
- [x] Repository interface.
- [x] Ledger mémoire.
- [x] Ledger fichier privé append-only + fsync.
- [x] Integrity restart/tamper/orphan/duplicate guards.
- [x] Weekly statement persistence LAB.
- [x] Idempotent weekly calculation LAB.
- [x] Correction model sans mutation négative cachée.
- [x] SQL append-only DRAFT écrit.
- [x] Read-only statement API LAB ops-only.
- [x] Settlement/payment state model SHADOW documenté.
- [x] ORCHIDPAY settlement intent V0.1.
- [x] ORCHIDPAY internal shadow HTTP consumer.
- [x] ORCHIDPAY idempotence / tamper detection / private persistence.
- [x] Delish → ORCHIDPAY cross-language fixture PASS.
- [x] Delish shadow client OFF par défaut.
- [ ] SQL/DB persistence production validée et migrée.
- [ ] Production ledger mapping ORCHIDPAY.
- [ ] Production outbox publish contract.
- [ ] Production payout/rail authorization.
- [x] Courier statement UI — own statements only, LAB-only.
- [ ] Human dispute/correction workflow.

## E. Belgique legal/payroll
- [ ] Worker-status final.
- [ ] Commission paritaire / CCT.
- [ ] Floor légal/conventionnel.
- [ ] Primes / temps de travail.
- [ ] Waiting/reposition/break classification.
- [x] Employer-cost engine paramétrique.
- [ ] Employer contributions / holiday cost — valeurs réelles à valider.
- [ ] Accident/work-risk insurance.
- [ ] Equipment/expense policy.
- [ ] Scheduling/part-time/flex.
- [ ] Payroll cadence/payslip.
- [ ] Dispute/representation process.
- [ ] Qualified Belgian legal review.
- [ ] DRAFT → LEGAL_REVIEW → GREEN.

## F. Pilot economics
- [x] LOW/BASE/HIGH.
- [x] Sensitivity economics.
- [x] Sensitivity operations.
- [ ] Remplacer coût/h LAB par coût employeur réel.
- [ ] Remplacer contribution/order LAB par unit economics réel.
- [ ] Instrumenter wait merchant réel.
- [ ] Instrumenter reposition/empty km réel.
- [ ] Instrumenter batching réel.
- [ ] Définir première micro-zone Bruxelles.
- [ ] Définir staffing windows.
- [ ] Pilote contrôlé 4 semaines.
- [ ] Scale/no-scale thresholds.

## G. Release / sauvegarde
- [x] DRAFT policy bloquée en production.
- [x] Branche lab isolée.
- [x] Feature flags OFF par défaut.
- [x] Checkpoints Git locaux.
- [x] Checkpoint b8b0c71 backup GitHub byte-perfect.
- [x] Branche code Delish sauvegardée sur GitHub.
- [x] ORCHIDPAY runtime baseline archivé hors secrets.
- [x] ORCHIDPAY lab archive + patch SHA-256 sur VPS et Toshiba.
- [x] ORCHIDPAY lab contract sauvegardé sur GitHub.
- [x] Full backend TypeScript PASS.
- [x] Full Nest build PASS avec TypeScript 5.4.5.
- [x] Full Courier typecheck avec deps restaurées.
- [x] Full Courier iOS bundle avec deps restaurées.
- [x] No fallback country adapter.
- [ ] Device E2E Fair Pay.
- [ ] End-to-end release certification.
- [ ] Production deployment explicitement autorisé après gates GREEN.

## H. ORCHIDPAY — Orchestrateur Silencieux
- [x] Autorité runtime identifiée: `orchidpay-api.service`, FastAPI 127.0.0.1:8089.
- [x] Baseline runtime sauvegardée avant travaux.
- [x] Clone-labo Git isolé.
- [x] Contrat `ORCHIDPAY_COURIER_SETTLEMENT_INTENT_V0.1`.
- [x] Mode SHADOW obligatoire.
- [x] Auth interne obligatoire.
- [x] Idempotence économique par statement ID.
- [x] Retry avec nouvel `generated_at` sans faux conflit.
- [x] Outbox preview-only.
- [x] Aucun ledger post / payout / rail dans le lab.
- [x] Fixture réelle TypeScript Delish acceptée par Python ORCHIDPAY.
- [x] Branche GitHub ORCHIDPAY dédiée.
- [ ] Autorité DB production réconciliée.
- [ ] Migration Alembic officielle liée à la vraie lineage.
- [ ] Mapping courier → party/payee.
- [ ] Balanced ledger transaction Courier Payroll.
- [ ] Reconciliation / reversal production.
- [ ] Payout rail production.
- [ ] Promotion SHADOW → GREEN settlement après validation.

## Current QA

DelishAfrica Fair Pay / runtime / ORCHIDPAY client:
**67 / 67 tests PASS**

Backend:
- TypeScript: **PASS**
- Nest build: **PASS** avec TypeScript 5.4.5

Courier:
- TypeScript: **PASS**
- Expo iOS/Hermes bundle: **PASS** — 1114 modules, bundle 3.33 MB
- Device E2E: **OPEN**

ORCHIDPAY shadow consumer:
**9 / 9 tests PASS**

Cross-language:
**PASS** — statement TypeScript DelishAfrica accepté par consumer Python ORCHIDPAY.

Production:
**BLOCKED / NOT DEPLOYED / NO PAYOUT**

## Next priority
1. sceller et pousser le checkpoint 67/67 + statement UI + Employer Cost;
2. synchroniser Airtable/PurpleCRM avec le nouveau checkpoint;
3. construire le workflow humain dispute/correction append-only;
4. préparer le question pack CSC / Maison des Livreurs;
5. remplacer les hypothèses payroll par des valeurs validées (CP/CCT, charges, assurance);
6. calibrer les unit economics réels;
7. réconcilier l'autorité DB ORCHIDPAY avant toute migration.
