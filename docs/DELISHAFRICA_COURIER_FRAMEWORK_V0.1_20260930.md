# DelishAfrica® Courier Framework V0.1

Date: 30 September 2026  
Status: DRAFT — pre-launch governance baseline  
Branch: `courier-charter-v01-20260930`

## Purpose

Create one public and operational source of truth for the Courier side of DelishAfrica before paid missions or large-scale onboarding begin.

This framework responds to three immediate field concerns raised during outreach:

1. status and the rights/obligations attached to it;
2. compensation and payment mechanics;
3. suspension/deactivation, explanation and human appeal.

It also formalizes data, algorithmic-management and safety requirements already implicit in the product architecture.

## Product architecture already present

DelishAfrica already contains:

- a public `/courier/` route;
- a public `/devenir-coursier/` route;
- FR/EN counterparts;
- a Courier mobile app;
- profile, presence, territory and identity-verification flows;
- mission, ETA and route-intelligence surfaces;
- a legal center in the Courier app;
- a same-origin public landing architecture with legal/privacy/support routes.

The goal is therefore **not** to create a fourth product. The Courier framework should live inside the existing DelishAfrica house and link to the Courier app when the app is publicly ready.

## Design principle

> Build with couriers before building around them.

The public Courier route becomes the readable governance layer.  
The Courier app remains the operational tool.  
OPS/PurpleCRM later becomes the case-management and communication layer.

## Six pre-launch commitments

### 1. Status
- Never rely on a contractual label alone.
- Determine the model from actual product/operational control plus applicable local law.
- Publish country-specific rights and obligations before activation.

### 2. Compensation
Before a courier accepts a mission, the system should be able to expose the information legally and operationally required for informed choice.

Country annexes must define:
- calculation basis;
- payment cadence;
- invoicing mechanics;
- bonuses/incentives;
- waiting-time treatment where applicable;
- deductions/fees, if any;
- dispute path.

### 3. Mission choice
Product architecture must distinguish:
- available;
- mission offered;
- mission accepted;
- mission declined;
- mission cancelled.

A decline must not silently become an automatic deactivation signal without a separately justified and disclosed rule.

### 4. Deactivation and human appeal
Target workflow:

```
signal / incident
→ notice
→ courier explanation
→ human review
→ decision with reason
→ appeal channel
→ final outcome
```

Emergency safety/fraud measures may require temporary restrictions first, but the post-action review path must still exist where legally applicable.

### 5. Data and algorithmic transparency
Maintain a registry of automated systems that materially affect couriers:
- assignment/dispatch;
- prioritisation;
- fraud/risk signals;
- ratings/performance;
- route/ETA;
- incentives;
- suspension recommendations.

For each system, record:
- purpose;
- input data;
- material effect;
- human-review boundary;
- retention;
- country/legal basis.

### 6. Safety and protection
Before opening a country:
- identify required insurance;
- define accident/incident reporting;
- define emergency support;
- define minimum equipment/safety rules;
- verify working-time / road-safety constraints if applicable;
- provide a non-retaliatory incident-reporting route.

## Country readiness matrix

No country should move to paid Courier operations until its annex is GREEN.

| Gate | Belgium | France | Luxembourg | Cameroon |
| --- | --- | --- | --- | --- |
| Legal entity / contracting party | OPEN | OPEN | OPEN | OPEN |
| Status model | OPEN | OPEN | OPEN | OPEN |
| Compensation rule | OPEN | OPEN | OPEN | OPEN |
| Insurance / accident protection | OPEN | OPEN | OPEN | OPEN |
| Tax / invoicing model | OPEN | OPEN | OPEN | OPEN |
| Deactivation + appeal procedure | OPEN | OPEN | OPEN | OPEN |
| Algorithm/data notice | OPEN | OPEN | OPEN | OPEN |
| KYC/document list | OPEN | OPEN | OPEN | OPEN |
| Support / escalation channel | OPEN | OPEN | OPEN | OPEN |
| App/store availability | OPEN | OPEN | OPEN | OPEN |

## Belgium — immediate consultation topics

For the first discussion with courier representatives, prepare answers or explicit OPEN items for:

- intended status model and actual operational controls;
- freedom to connect/disconnect;
- freedom to accept/refuse missions;
- compensation calculation;
- waiting time;
- payment schedule;
- invoicing;
- bonuses;
- geolocation scope;
- dispatch logic;
- account restriction/deactivation;
- prior notice;
- ability to be heard;
- human review;
- assistance/representation during dispute;
- accident/safety protection.

Do **not** improvise a legal answer during the meeting. An OPEN item is acceptable if it is documented with an owner and decision date.

## France — immediate flag

The public France annex must be checked against the platform-delivery collective rules in force at launch, including rules on deactivation and compensation. Do not reuse a Belgian rate, status or procedure as a France default.

## Public-route rule

The public `/courier/` route may explain:
- principles;
- current readiness;
- what is and is not open;
- the future onboarding path;
- appeal/data/safety commitments.

It must not claim:
- a final employment/self-employed status before legal validation;
- a guaranteed pay rate before the country rule is approved;
- insurance coverage before the policy exists;
- operational availability before Courier is actually open.

## Mobile-app rule

The Courier app should eventually expose, in-product:
- current status/contract version;
- pay/rate-card version;
- mission economics before acceptance where required;
- data/algorithm notice;
- support;
- incident reporting;
- deactivation notice;
- appeal;
- document center;
- downloadable agreement/history where applicable.

## PurpleCRM integration target

PurpleCRM should later manage:
- representative/stakeholder contacts;
- consultation notes;
- Courier support cases;
- deactivation appeals;
- policy/version acknowledgements;
- campaign/education messages;
- audit trail.

It should not become the source of truth for live dispatch decisions.

## Release gate

Before merging this framework into production:

1. FR/EN copy review;
2. legal review by country;
3. build + landing checks;
4. no change to Client/Merchant/Courier operational runtime;
5. no KYC collection added to the public landing;
6. no claim that paid Courier missions are already open;
7. visual QA desktop/mobile;
8. reversible deploy with existing landing release procedure.

## Next actions

1. Validate this V0.1 internally.
2. Prepare Belgium V0.1 annex before replying to United Freelancers / Maison des Livreurs.
3. Hold the meeting as a listening + design session, not a presentation of a finished legal model.
4. Convert agreed principles into product requirements.
5. Only then prepare final country contracts/notices with qualified local legal review.
