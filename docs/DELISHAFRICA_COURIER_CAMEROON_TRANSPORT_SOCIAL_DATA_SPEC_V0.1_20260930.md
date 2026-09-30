# DelishAfrica® Courier — Cameroon Transport / Social / Data Spec V0.1

Date: 30 September 2026  
Status: INTERNAL PRODUCT SPEC — NOT PRODUCTION

## A. Activation gate object

```ts
type CameroonCourierActivationGate = {
  workerModel: "employee" | "independent" | "review_required";
  transportClass: "confirmed" | "review_required";
  vehicleClass: "bicycle" | "motorcycle" | "car" | "other";
  vehicleDocumentsReady: boolean;
  insuranceReady: boolean;
  cnpsReady: boolean;
  accidentProtectionReady: boolean;
  taxClassificationReady: boolean;
  dataComplianceReady: boolean;
  appealChannelReady: boolean;
  approvedBy: string[];
}
```

Activation rule:
- any `review_required` or false critical gate blocks paid activation.

## B. Worker-model audit

Capture operational facts, not labels:
- who sets price;
- who chooses hours;
- who chooses route;
- who can refuse missions;
- whether refusals affect future work;
- exclusivity;
- equipment ownership;
- replacement/substitution ability;
- supervision;
- sanctions;
- performance scoring;
- deactivation control.

Output:
- `EMPLOYMENT_REVIEW`
- `INDEPENDENT_REVIEW`
- `MIXED_FACTS_ESCALATE`

The application must not self-classify the courier.

## C. CNPS fork

### Employee
Require:
- employer affiliation;
- worker registration;
- payroll/social declaration path;
- applicable protection branches confirmed.

### Independent
Display accurately:
- voluntary CNPS option;
- coverage scope;
- separate DelishAfrica/third-party accident protection if adopted.

Do not present voluntary pension coverage as occupational accident insurance.

## D. Vehicle / transport gate

Record:
- vehicle;
- owner/renter;
- registration;
- driving licence where required;
- insurance;
- inspection where required;
- local/municipal permit if applicable;
- transport licence/category determination reference;
- authority/date/reference number.

Until the exact delivery category is confirmed:
- no automatic reuse of passenger moto-taxi S2 logic.

## E. Compensation statement

Future mission statement should support:
- base amount;
- distance component;
- waiting component;
- bonus;
- tip;
- adjustment;
- deduction;
- net amount;
- payment date;
- dispute action.

All formula changes versioned.

## F. Cameroon data register

For every processing:
- purpose;
- data category;
- consent/legal basis;
- source;
- recipients;
- processor;
- hosting country;
- international transfer;
- retention;
- security controls;
- rights route;
- deletion logic;
- incident owner.

High-priority entries:
- KYC;
- geolocation;
- profile-trust;
- dispatch scoring;
- earnings/payment;
- support;
- deactivation cases.

## G. Geolocation states

```
OFFLINE
TERRITORY_VERIFY
ONLINE_AVAILABLE
MISSION_ACTIVE
MISSION_COMPLETE
```

Requirements:
- tracking indicator;
- no silent off-duty route tracking;
- minimum precision/frequency for each purpose;
- configurable retention;
- access log;
- rights/export support.

## H. Deactivation controls

A permanent deactivation action requires:
- reason category;
- evidence summary;
- courier notice;
- response opportunity;
- named human reviewer;
- decision;
- appeal route;
- audit ID.

No permanent action from a dispatch/profile score alone.

## I. QA scenarios

1. decline 10 offers → ranking unchanged because of refusals;
2. offline → no background route tracking;
3. transport category unknown → paid activation blocked;
4. employee model + CNPS incomplete → activation blocked;
5. independent model + accident protection unresolved → activation blocked;
6. data compliance incomplete → activation blocked;
7. deactivation without human reviewer → blocked;
8. data-export request → courier activity package produced;
9. passenger moto-taxi licence assumption without authority reference → validation fails.
