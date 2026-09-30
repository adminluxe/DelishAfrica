# DelishAfrica® Courier — Belgium Stakeholder Meeting Brief V0.1

Date: 30 September 2026  
Audience: ACV-CSC United Freelancers / La Maison des Livreurs / related courier representatives  
Status: INTERNAL DRAFT

## Context

Martin Willems (ACV-CSC United Freelancers / La Maison des Livreurs) replied positively to DelishAfrica's outreach and explicitly welcomed the fact that DelishAfrica wants dialogue before launch.

He identified three priority topics:
1. status and the rights/obligations and economic viability attached to it;
2. remuneration mechanics;
3. account deactivation and the right to be heard before a decision.

He also noted that the public "Courier space" was not accessible.

## DelishAfrica response before the meeting

Actions already taken in draft:
- public Courier hub designed at `/courier/`;
- blank `courier.delishafrica.me` removed from public CTAs;
- FR/EN public framework prepared;
- Belgium-specific readiness annex prepared;
- acceptance rate removed from dispatch ranking so a refusal does not lower future access to offers;
- human/courier confirmation remains required in current dispatch architecture;
- no final status or compensation promise published before validation.

## Meeting objective

Not: sell a finished model.

Yes:
- show the architecture and principles already decided;
- expose OPEN questions honestly;
- ask representatives to stress-test the model before launch;
- obtain concrete expectations for remuneration transparency and deactivation procedure;
- identify issues that should become product requirements before Courier goes live in Belgium.

## 45-minute structure

### 0–5 min — Why DelishAfrica asked for the meeting
- three-sided ecosystem: Client / Merchant / Courier;
- Merchant live;
- Courier application in final publication phase;
- no mass onboarding before the Courier framework is coherent.

### 5–12 min — What we changed after their first email
- public Courier hub;
- no refusal penalty in dispatch ranking;
- no automatic permanent deactivation;
- country-by-country framework;
- no hidden KYC collection on the public landing.

### 12–25 min — Status + economics
Questions:
- Which practical controls most often create false-independence risk in food delivery?
- What level of freedom on time, route, substitution and other-platform work is essential in practice?
- Which remuneration elements must be visible before acceptance?
- How should restaurant waiting time be treated?
- What is the most understandable payment/invoicing format for couriers?

### 25–37 min — Deactivation / dispute
Present target:
```
notice → facts → courier response → human review → decision → appeal
```

Ask:
- What information must a notification contain?
- Should accompaniment/representation be explicitly available?
- What situations justify temporary immediate restriction before hearing?
- What response and appeal times are realistic?
- What evidence should the courier be able to access?

### 37–42 min — Data / algorithmic management
Explain:
- dispatch recommendation factors;
- Route Oracle advisory principle;
- acceptance rate removed from ranking;
- geolocation states still being specified.

Ask:
- Which ranking/dispatch signals should always be disclosed?
- Which data should a courier be able to inspect/export?
- What location tracking is considered unacceptable outside active work?

### 42–45 min — Next step
- send revised Belgium Annex V0.2;
- ask for factual corrections;
- convert agreed items into product/legal gates;
- keep a direct channel before onboarding.

## What we can say is DECIDED

- No exclusivity intended.
- No ban on working for competing platforms intended.
- Courier explicitly chooses availability.
- Courier explicitly accepts or declines a mission.
- Declining a mission does not lower dispatch ranking.
- Current dispatch does not auto-assign; proposal and acceptance require confirmation.
- Route Oracle is advisory.
- Permanent deactivation will not be solely automated.
- A material adverse decision requires a human-review path.
- Public Courier rights/framework information belongs on DelishAfrica, not behind an inaccessible app wall.

## What must remain OPEN in the meeting

- final Belgian worker status;
- compensation formula/rate;
- treatment of waiting time;
- payment cadence;
- invoicing mechanism;
- accident-insurance provider/product;
- exact geolocation retention;
- deactivation notice period/SLA;
- representation rules;
- contracting entity at Belgian launch.

## Statements to avoid

Do not say:
- "all couriers will be independent";
- "all couriers will be employees";
- "the rate will be X";
- "our algorithm is neutral";
- "our model is already fully compliant";
- "we track couriers continuously";
- "a low acceptance rate affects reliability";
- "Courier is live in Belgium" until it actually is.

## Useful evidence to have ready

- public `/courier/` page;
- Belgium Annex V0.1;
- current dispatch policy showing `autoAssignAllowed: false`;
- code diff removing acceptance-rate ranking;
- high-level data-flow diagram;
- draft deactivation workflow;
- draft compensation schema with placeholders, not final rates.

## Follow-up artifact

Meeting notes should be converted into:
`DELISHAFRICA_COURIER_BELGIUM_ANNEX_V0.2_<DATE>.md`

Each external recommendation must be tagged:
- ACCEPTED;
- NEEDS LEGAL REVIEW;
- NEEDS PRODUCT REVIEW;
- DECLINED + reason.
