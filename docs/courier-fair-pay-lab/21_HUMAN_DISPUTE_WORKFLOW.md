# Courier Fair Pay — Human Dispute Workflow V0.1

Date: 27 October 2026
Status: LAB — APPEND-ONLY / HUMAN REVIEW

## Purpose

A Fair Pay statement must be understandable **and contestable**.

The dispute workflow is deliberately separate from correction logic:

1. Courier opens a dispute against their own immutable statement.
2. OPS/human reviewer investigates.
3. Reviewer resolves:
   - no change; or
   - correction required.
4. A correction-required resolution does **not** mutate the statement.
5. Any actual payroll correction must use the existing append-only supersession mechanism.
6. Recalculation creates a new statement ID while preserving the old statement.

## Courier access boundary

Endpoint:
`POST /courier-payroll/lab/courier/disputes/open`

The server derives the Courier identity from the authenticated principal.

The client cannot supply a different `courierId` to access or dispute another worker's statement.

One dispute ID is deterministically derived from:
- statement ID;
- authenticated Courier ID.

Re-opening the same statement is therefore idempotent.

## Courier reason categories

Current LAB UI:
- `TIME_REVIEW_REQUESTED`
- `AMOUNT_REVIEW_REQUESTED`
- `OTHER_REVIEW_REQUESTED`

The current note is intentionally simple:
`Revue du relevé demandée depuis l’app Courier.`

A richer evidence/comment capture can be added after co-design with Courier representatives.

## Human review states

```
OPEN
  -> UNDER_REVIEW
  -> RESOLVED_NO_CHANGE
  -> or RESOLVED_CORRECTION_REQUIRED
```

Final states cannot be silently reopened or overwritten.

## Append-only record

Every dispute event records:
- dispute ID;
- statement ID;
- Courier ID;
- week/policy;
- event type/status;
- actor role;
- actor subject;
- reason code;
- note;
- evidence references;
- occurredAt.

Storage:
- private directory: 0700;
- NDJSON file: 0600;
- append-only;
- fsync;
- SHA-256 record integrity;
- restart verification;
- tamper detection.

## OPS endpoints

- `POST /courier-payroll/lab/disputes/list`
- `POST /courier-payroll/lab/disputes/review`

Review events require:
- authenticated OPS principal;
- explicit action;
- reason code;
- human note;
- evidence.

## Correction boundary

`RESOLVED_CORRECTION_REQUIRED` is **not money**.

It is an instruction that the audited correction path must create:
- new fact(s);
- `supersedesFactId`;
- human approval metadata;
- evidence;
- new deterministic weekly statement.

The original statement remains queryable.

## QA

Tests prove:
- idempotent opening;
- persistence across restart;
- 0700/0600 permissions;
- Courier list isolation;
- human review timeline;
- final resolution cannot be rewritten;
- evidence is mandatory;
- backdated review is rejected;
- file tampering is detected.

Current global Fair Pay suite after this workflow:
**72/72 PASS**.

## Mobile LAB

The Courier Fair Pay screen now:
- shows own statements;
- shows existing dispute status;
- offers Temps / Montant / Autre review requests;
- states that a human must review;
- explains that correction creates a new traceable statement.

Courier TypeScript:
**PASS**

iOS Expo/Hermes:
**PASS — 1114 modules, 3.34 MB HBC**

Device E2E:
**OPEN**

## Production rule

The dispute workflow is LAB-only until:
- Belgian legal/payroll dispute requirements are validated;
- representation/support rights are defined;
- SLA is defined;
- notification/escalation is defined;
- retention/privacy is validated;
- production persistence is migrated.
