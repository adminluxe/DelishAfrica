# DelishAfrica® Courier — France Annex V0.1

Date: 30 September 2026  
Status: DRAFT — pre-launch legal/product readiness  
Scope: France only  
Parent framework: `docs/DELISHAFRICA_COURIER_FRAMEWORK_V0.1_20260930.md`

> Product/governance working document only. It is not legal advice and is not a contract.  
> Final wording, economic model and operating model require qualified French legal review before paid Courier operations open.

---

## 1. Why France needs its own operating kit

France already has a specific statutory and sectoral framework for independent delivery-platform workers. DelishAfrica must therefore not reuse the Belgium annex or a generic EU model.

France is treated as a separate launch gate for:
- remuneration;
- deactivation;
- accident protection;
- worker data access;
- social dialogue;
- public charter / transparency;
- app behaviour.

---

## 2. Current French baseline — verified official sources

### 2.1 Specific platform-worker rules apply to delivery couriers

The French Labour Code contains a dedicated framework for independent workers using electronic platforms, including delivery of goods by two- or three-wheel vehicles, motorised or not.

Sources:
- Code du travail, Title IV — workers using electronic intermediation platforms  
  https://www.legifrance.gouv.fr/codes/section_lc/LEGITEXT000006072050/LEGISCTA000033013014/
- Code du travail, Articles L7342-8 to L7342-11  
  https://www.legifrance.gouv.fr/codes/section_lc/LEGITEXT000006072050/LEGISCTA000039678033/

### 2.2 Social-responsibility obligations can be triggered when the platform sets service characteristics and price

Article L7342-1 establishes social responsibility where the platform determines the characteristics of the service and sets its price.

Source:
- Code du travail, Chapter II  
  https://www.legifrance.gouv.fr/codes/section_lc/LEGITEXT000006072050/LEGISCTA000033013020/

**Implication for DelishAfrica:**  
The compensation and dispatch model must be analysed before launch; the platform cannot treat pay-setting as a purely commercial UI choice.

### 2.3 19 € minimum average income per hour of activity — from 1 September 2026

The sectoral amendment signed on 10 July 2026 sets a minimum average activity income of **19 € per hour of activity**, calculated on a weekly basis for independent couriers within its scope.

The activity time used in the agreement is the cumulative estimated duration, for each delivery, between acceptance of the delivery proposal and handover to the final recipient.

If the week's actual activity income is below the guarantee, the differential is to be paid no later than 7 days after the end of the week.

Tips are excluded from the activity income used for that guarantee.

The amendment states that it takes effect on **1 September 2026**.

Source:
- ARPE — Avenant du 10 juillet 2026 instaurant une garantie minimale de revenus  
  https://www.arpe.gouv.fr/dialogue-social/les-accords/les-accords-du-secteur-des-livreurs/

**Implication for DelishAfrica:**  
A France compensation engine must be able to:
- track covered activity time;
- aggregate the guarantee weekly;
- exclude tips from the guarantee base;
- calculate a differential;
- settle the differential within the required time.

Status: **IMPLEMENT + LEGAL VALIDATION**

### 2.4 Deactivation is already heavily structured

The homologated sectoral agreement of 20 April 2023 covers rupture/deactivation.

Verified rules include:
- refusal of one or more service proposals cannot by itself justify suspension/deactivation;
- repeated incidents: advance warning, with deactivation no earlier than 48h after the warning except specified urgent cases;
- serious incident: courier is informed of alleged facts and invited to make observations; the response period cannot be less than 24h, while a protective suspension may remain possible;
- every deactivation decision requires prior examination by a natural person;
- fraud deactivation: reasons communicated no later than 48h after implementation and an internal re-examination route must exist;
- fraud appeal window made available by the platform cannot be shorter than 7 calendar days;
- platform review of that appeal cannot exceed 28 calendar days;
- final decision communication cannot exceed 7 calendar days after the platform decision;
- relevant deactivation information and procedures must be available in a dedicated digital space;
- deactivation communications should be made as accessible as possible, including French and English under the agreement.

Source:
- ARPE — Accord du 20 avril 2023 encadrant les modalités de rupture des relations commerciales  
  https://www.arpe.gouv.fr/dialogue-social/les-accords/les-accords-du-secteur-des-livreurs/

**Implication for DelishAfrica:**  
France cannot launch without an actual deactivation case workflow, SLA engine and human-review ownership.

### 2.5 Accident protection / contribution is not optional as a product topic

Article L7342-2 provides, within its statutory conditions, for platform coverage of the worker's contribution to voluntary occupational-accident insurance, or an equivalent collective contract paid by the platform.

Source:
- Code du travail, Article L7342-2  
  https://www.legifrance.gouv.fr/codes/section_lc/LEGITEXT000006072050/LEGISCTA000039677991/

Status: **VALIDATE THRESHOLDS + IMPLEMENT**

### 2.6 Couriers have access rights to their own platform-activity data

Article L7342-7 gives workers a right of access to data concerning their own activity that identifies them, plus a right to receive those data in structured form and transmit them.

Source:
- Code du travail, Article L7342-7  
  https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000039678044/

**Implication for DelishAfrica:**  
Courier product architecture should support an exportable activity-data package.

### 2.7 Public social-responsibility charter is a possible governance tool

Article L7342-9 allows a platform to establish a social-responsibility charter covering, among other matters:
- work conditions;
- non-exclusivity;
- connection/disconnection freedom;
- decent price mechanisms;
- professional risk prevention;
- information/dialogue;
- changes to working conditions;
- service quality/control;
- circumstances and safeguards for ending the commercial relationship.

The charter can be submitted for administrative approval under the statutory process.

Source:
- Code du travail, Article L7342-9  
  https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000039678037/

Status: **STRATEGIC OPTION — LEGAL REVIEW**

---

## 3. France policy matrix

Legend:
- **DECIDED** = approved product principle
- **OPEN** = business/legal choice not yet made
- **VALIDATE** = qualified French review required
- **IMPLEMENT** = engineering/ops work required

| Topic | Current position | Status |
| --- | --- | --- |
| Exclusivity | No exclusivity intended | DECIDED + VALIDATE |
| Multiple platforms | Allowed in product policy | DECIDED + VALIDATE |
| Online/offline freedom | Courier chooses availability | DECIDED |
| Accept/refuse mission | Explicit choice; refusal does not lower dispatch rank | DECIDED |
| Route choice | Route Oracle advisory | DECIDED + VALIDATE |
| Auto-assignment | Current architecture requires confirmation | DECIDED |
| Minimum income guarantee | France-specific 19 €/activity-hour weekly mechanism from 1 Sep 2026 | IMPLEMENT + VALIDATE |
| Tips | Must not be used to satisfy the sector guarantee base | IMPLEMENT + VALIDATE |
| Weekly differential | Required when covered earnings fall below guarantee | IMPLEMENT |
| Per-course/horo-km future rules | Sector negotiation announced; monitor before launch | WATCH |
| Accident protection | Applicable mechanism/thresholds to be validated and implemented | OPEN + VALIDATE |
| Activity data export | Product should support structured export | DECIDED + IMPLEMENT |
| Repeated-incident deactivation | 48h advance mechanism in sector agreement | IMPLEMENT + VALIDATE |
| Serious-incident response | At least 24h response period before deactivation, subject to protective suspension | IMPLEMENT + VALIDATE |
| Human deactivation review | Required | DECIDED + IMPLEMENT |
| Fraud post-deactivation notice | Within 48h | IMPLEMENT |
| Fraud appeal window | At least 7 calendar days | IMPLEMENT |
| Appeal review | Max 28 calendar days | IMPLEMENT |
| Final decision communication | Max 7 calendar days after decision | IMPLEMENT |
| Dedicated deactivation information space | Required by sector agreement | IMPLEMENT |
| FR/EN deactivation communications | Target baseline | IMPLEMENT |
| Social-responsibility charter | Evaluate ARPE/administrative strategy | OPEN + VALIDATE |
| Final worker status | Not to be assumed from Belgian model | OPEN + VALIDATE |

---

## 4. Product requirements — France

### Compensation ledger
Create a France-specific ledger with:
- mission accepted timestamp;
- estimated activity duration used by the applicable rule;
- handover/completion timestamp;
- activity income;
- tips separated;
- weekly activity total;
- weekly covered income;
- guaranteed floor;
- differential due;
- differential paid date;
- audit ID.

No France launch if the weekly guarantee cannot be independently reconstructed.

### Mission offer
Where legally/operationally validated, offer UI should expose:
- pickup;
- destination information at appropriate precision;
- ETA/distance;
- pay or calculation basis;
- bonus;
- known deductions;
- expected activity period;
- clear accept / decline.

### Deactivation case management
Required case states:
```
signal
→ category
→ protective suspension? (if justified)
→ notice
→ evidence available
→ observations
→ human review
→ decision
→ appeal
→ final decision
→ communication
```

System must record:
- legal/contract reason category;
- incident timestamps;
- notice timestamp;
- courier response deadline;
- human reviewer identity;
- decision timestamp;
- appeal deadline;
- appeal received timestamp;
- appeal result;
- final communication timestamp.

### Activity-data export
Prepare one downloadable package containing, subject to final legal mapping:
- mission history;
- activity periods;
- earnings;
- tips;
- adjustments;
- relevant account-status events;
- relevant data associated with platform activity.

### Public Courier France space
Do not create a generic copy of Belgium.

Future public France annex should contain:
- current remuneration guarantee;
- pay calculation explanation;
- accident-protection explanation;
- deactivation procedure;
- activity-data access/export;
- recognised representative-worker links where required/appropriate;
- contact/appeal route.

---

## 5. France launch RED gates

- [ ] France contracting party / establishment analysis
- [ ] worker-status analysis
- [ ] ARPE scope confirmation
- [ ] 19 €/activity-hour weekly guarantee engine
- [ ] tips separation
- [ ] weekly differential payout process
- [ ] accident-protection mechanism / threshold review
- [ ] deactivation case workflow
- [ ] human review ownership
- [ ] appeal SLA engine
- [ ] FR/EN deactivation messaging
- [ ] activity-data export
- [ ] privacy/geolocation notice
- [ ] algorithm register
- [ ] qualified French legal review
- [ ] Store/public app readiness

---

## 6. Immediate consultation targets

Initial target already contacted:
- Union-Indépendants

Useful discussion topics:
- practical implementation of the 19 € guarantee;
- treatment of restaurant waiting time;
- future horo-kilometric/per-course guarantee;
- what couriers need to see before acceptance;
- deactivation evidence and appeal UX;
- data export expectations;
- safety/accident protection;
- whether a public social-responsibility charter would be useful.

---

## 7. Next actions

1. Keep annex DRAFT.
2. Build France compensation-ledger specification.
3. Build deactivation-SLA state machine specification.
4. Add activity-data export requirement to Courier product backlog.
5. Prepare France stakeholder meeting brief.
6. Monitor ARPE for the announced horo-kilometric/per-course negotiation and health/safety agreement.
7. Review immediately before launch with qualified French counsel.
