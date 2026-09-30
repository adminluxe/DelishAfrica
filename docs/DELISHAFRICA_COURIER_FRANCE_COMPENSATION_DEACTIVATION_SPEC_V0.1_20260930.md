# DelishAfrica® Courier — France Compensation & Deactivation Spec V0.1

Date: 30 September 2026  
Status: INTERNAL PRODUCT SPEC — NOT PRODUCTION

## A. Weekly compensation guarantee ledger

Required mission fields:
- `courierId`
- `missionId`
- `acceptedAt`
- `estimatedActivitySeconds`
- `deliveredAt`
- `activityIncomeCents`
- `tipsCents`
- `bonusCents`
- `adjustmentCents`
- `weekKey`
- `auditId`

Weekly derived fields:
- `coveredActivitySeconds`
- `coveredIncomeCents`
- `minimumGuaranteedIncomeCents`
- `differentialDueCents`
- `differentialPaidAt`
- `calculationVersion`

Guardrails:
- tips must not reduce the differential;
- calculation must be reproducible;
- every rule change gets a version;
- courier-facing statement must explain the calculation;
- finance/ops view must show unresolved differentials.

## B. Courier-facing weekly statement

Show:
- activity hours covered by guarantee;
- covered income;
- tips separately;
- guarantee floor;
- any top-up/differential;
- payment date;
- link to dispute an amount.

## C. Deactivation case state machine

```
OPEN_SIGNAL
→ TRIAGED
→ PROTECTIVE_SUSPENSION? 
→ NOTICE_SENT
→ COURIER_RESPONSE_OPEN
→ HUMAN_REVIEW
→ DECISION
→ APPEAL_OPEN?
→ APPEAL_REVIEW
→ FINAL
→ COMMUNICATED
```

Core timestamps:
- incident received;
- notice sent;
- response deadline;
- response received;
- human reviewer assigned;
- decision made;
- appeal deadline;
- appeal received;
- appeal reviewed;
- final communication sent.

Core controls:
- permanent deactivation cannot be executed without a human reviewer;
- reason category must be understandable;
- evidence availability must be recorded;
- platform must distinguish immediate protective suspension from final deactivation;
- SLA alarms are mandatory.

## D. SLA policy placeholders

Populate only after legal validation.

Known sectoral baselines to encode as configurable rules:
- repeated incidents warning: 48h before deactivation in covered cases;
- serious incident observations: at least 24h before deactivation in covered cases, without preventing justified protective suspension;
- fraud reason notice: max 48h after deactivation;
- fraud appeal window: minimum 7 calendar days;
- fraud appeal review: maximum 28 calendar days;
- final decision communication: maximum 7 calendar days after final decision.

## E. Data export

Prepare structured export endpoint/file with:
- mission activity;
- earnings;
- tips;
- adjustments;
- account-status events;
- policy/contract versions;
- relevant activity-identifying data.

Format target:
- JSON + CSV summary;
- downloadable from Courier;
- request/audit log.

## F. QA scenarios

1. courier declines 10 missions → dispatch ranking must not decrease because of refusal;
2. tips increase → guarantee differential remains unchanged by tip amount;
3. week below floor → top-up appears;
4. week above floor → no top-up;
5. protective suspension → not mislabelled as final deactivation;
6. final deactivation attempt without human reviewer → blocked;
7. missed appeal SLA → ops alarm;
8. export → all own activity data included according to final mapped scope.
