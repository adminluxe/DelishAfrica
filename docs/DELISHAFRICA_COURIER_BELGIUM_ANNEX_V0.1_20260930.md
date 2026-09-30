# DelishAfrica® Courier — Belgium Annex V0.1

Date: 30 September 2026  
Status: DRAFT — pre-launch legal/product readiness  
Scope: Belgium only  
Parent framework: `docs/DELISHAFRICA_COURIER_FRAMEWORK_V0.1_20260930.md`

> This annex is a product/governance working document, not legal advice and not a contract.  
> Final wording and operating model require qualified Belgian legal review before paid Courier operations open.

---

## 1. Why Belgium is first

The first external courier-representative reply came from Belgium and focused immediately on three matters:

1. status;
2. remuneration;
3. deactivation / right to be heard / appeal.

Those three points are therefore treated as launch gates, not post-launch documentation.

---

## 2. Current Belgian baseline — verified official sources

### 2.1 Employment status cannot be solved by a label

Belgian official guidance distinguishes employment from self-employment through the reality of the relationship, including freedom to organise working time and work, and the existence or absence of hierarchical control.

Source:
- SPF Emploi — Nature de la relation de travail  
  https://emploi.belgique.be/fr/themes/contrats-de-travail/nature-de-la-relation-de-travail-travail-salarie-ou-travail-independant

**Implication for DelishAfrica:**  
We must not publish "independent courier" as a blanket Belgian answer before the actual controls, dispatch rules, price-setting, route constraints and account-management mechanics have been reviewed.

### 2.2 Platform-work presumption applies in Belgium since 1 January 2023

Belgium has platform-specific criteria. A platform-work relationship is presumed to be an employment contract, subject to rebuttal, when at least **3 of 8 criteria** or **2 of the last 5 criteria** are met.

The official criteria include, among other things:
- exclusivity;
- geolocation beyond the proper functioning of core services;
- restrictions on how work is carried out;
- limiting income / price freedom;
- mandatory conduct/presentation rules;
- using collected data to determine priority of future work, offered amount or rankings;
- restricting freedom to choose hours, absences, acceptance/refusal, subcontractors or replacements;
- restricting the ability to build a clientele or work for third parties.

Source:
- SPF Emploi — Nature de la relation de travail: plateforme numérique donneuse d'ordre  
  https://emploi.belgique.be/fr/themes/contrats-de-travail/nature-de-la-relation-de-travail-travail-salarie-ou-travail-independant

**Implication for DelishAfrica:**  
Dispatch architecture, geolocation, compensation and refusal behaviour are legal-design inputs. They cannot be treated as merely UX choices.

### 2.3 Independent platform workers need accident protection

Belgian official employment guidance states that independent platform workers must be insured against work accidents.

Source:
- SPF Emploi — Deal pour l'emploi: publication des mesures  
  https://emploi.belgique.be/fr/actualites/deal-pour-lemploi-publication-des-mesures

**Implication for DelishAfrica:**  
No Belgian paid Courier activation before the applicable accident-protection arrangement is identified, documented and validated.

### 2.4 Independent status carries social-security obligations

A person subject to Belgian self-employed status must in principle affiliate with a social insurance fund for self-employed workers.

Source:
- SPF Sécurité sociale — Liste des Caisses d'Assurances Sociales  
  https://socialsecurity.belgium.be/fr/elaboration-de-la-politique-sociale/independants/liste-des-caisses-dassurances-sociales

**Implication for DelishAfrica:**  
If a self-employed model survives legal review, onboarding must explain the relevant registration/social-security steps instead of merely asking the courier to tick an "independent" box.

### 2.5 The EU Platform Work Directive deadline is imminent

Directive (EU) 2024/2831 must be transposed by Member States by **2 December 2026**. It includes rules on status determination, algorithmic management, data protection, human oversight and remedies.

Source:
- EUR-Lex — Directive (EU) 2024/2831, Article 29  
  https://eur-lex.europa.eu/eli/dir/2024/2831/oj/eng

**Implication for DelishAfrica:**  
Belgian launch rules must be reviewed again immediately before launch if the Belgian transposition package changes the current national framework.

---

## 3. DelishAfrica product audit — immediate finding

### Finding BE-P0-001 — acceptance-rate scoring

The current dispatch-intelligence prototype included `acceptanceRate` as 30% of a reliability sub-score used in candidate ranking.

That creates a direct risk that refusing missions could reduce access to future work.

**Decision:** REMOVE acceptance rate from assignment ranking.

Patch:
- branch `courier-charter-v01-20260930`
- `services/api-nest/src/dispatch-intelligence/assignment-intelligence.service.ts`

New rule:
- mission refusal may be logged for operational audit;
- refusal itself does **not** reduce assignment score;
- reliability scoring must measure post-acceptance execution quality, not willingness to accept work.

Status: **DECIDED / PATCHED IN DRAFT BRANCH**

---

## 4. Belgium policy matrix

Legend:
- **DECIDED** = product principle approved for design
- **OPEN** = business/legal choice not yet made
- **VALIDATE** = requires Belgian professional/legal confirmation before launch
- **IMPLEMENT** = product/ops work required

| Topic | Current position | Status |
| --- | --- | --- |
| Exclusivity | No exclusivity requirement intended | DECIDED + VALIDATE |
| Work for competitors | No platform ban intended | DECIDED + VALIDATE |
| Go online / offline | Courier chooses when to be available | DECIDED |
| Accept / refuse mission | Explicit choice; refusal alone must not lower future mission ranking | DECIDED + PATCHED |
| Route | Route Oracle is advisory; courier keeps practical route choice subject to delivery/safety constraints | DECIDED + VALIDATE |
| Auto-assignment | Current architecture: no automatic assignment; human/courier confirmation required | DECIDED |
| Geolocation | Use only for operational availability, mission routing/ETA, safety and fraud controls that are documented | DECIDED + IMPLEMENT |
| Background tracking | Exact scope, retention and off-mission behaviour not yet approved | OPEN + VALIDATE |
| Compensation | Formula not yet approved | OPEN |
| Waiting time | Treatment not yet approved | OPEN |
| Tips | Treatment not yet approved | OPEN |
| Bonuses / incentives | Rules not yet approved | OPEN |
| Payment cadence | Not yet approved | OPEN |
| Invoicing | Model not yet approved | OPEN |
| Status | No final blanket employee/self-employed classification yet | OPEN + VALIDATE |
| Accident protection | Required arrangement must be selected before activation | OPEN + VALIDATE |
| Equipment | Minimum/optional equipment policy not yet approved | OPEN |
| Suspension | Temporary safety/fraud restriction may be needed; exact procedure not yet approved | OPEN + VALIDATE |
| Permanent deactivation | No solely automated permanent decision | DECIDED + VALIDATE |
| Right to know reason | Plain-language reason required | DECIDED |
| Right to respond | Courier must have a channel to present their version | DECIDED |
| Human review | Required for material account decisions | DECIDED |
| Representation/support | Whether a representative may assist in a dispute must be defined | OPEN + VALIDATE |
| Appeal SLA | Not yet approved | OPEN |
| Data/algorithm notice | Required before activation | DECIDED + IMPLEMENT |
| Agreement version history | Courier should be able to see the applicable version | DECIDED + IMPLEMENT |

---

## 5. Target Belgium operating model — product guardrails

These are **design constraints**, not a conclusion on worker status.

### Availability
- Courier explicitly switches availability on/off.
- No minimum number of online hours in the current design.
- No hidden punishment for being offline.

### Mission offer
Before acceptance, the product should show, once validated and available:
- pickup;
- destination information at the legally appropriate level;
- estimated distance/time;
- compensation or calculation basis;
- known bonus;
- known deductions/fees;
- relevant mission constraints.

### Refusal
- explicit "Decline" action;
- refusal stored only as an audit event unless a separate lawful operational purpose is documented;
- refusal does not reduce dispatch rank;
- no automatic suspension based solely on refusal rate.

### Dispatch
Current architecture already uses:
- recommendation;
- human confirmation for proposal;
- courier confirmation for acceptance;
- `autoAssignAllowed: false`.

This should remain the Belgian default until a later legal/product review explicitly approves otherwise.

### Geolocation
Product should distinguish:
1. territory verification;
2. online availability heartbeat;
3. active-mission location;
4. post-mission/offline state.

OPEN question:
- exact location precision and retention per state.

Default privacy direction:
- no continuous off-duty tracking.

### Deactivation
Target flow:

```
incident / signal
→ temporary protective action if strictly necessary
→ notification
→ understandable reason
→ evidence / courier response
→ human review
→ decision
→ appeal
→ final outcome
```

No permanent deactivation based solely on an automated score.

---

## 6. Algorithm register — Belgium launch minimum

Before Belgium activation, create a visible internal register for every system that materially affects a courier.

### Dispatch Intelligence
Known inputs currently include:
- pickup ETA;
- delivery ETA;
- active mission load;
- reliability;
- position freshness;
- fairness/load balancing.

**Removed from ranking:** acceptance rate.

Required documentation:
- factor;
- purpose;
- weight;
- source data;
- retention;
- whether courier can contest input;
- whether human override exists.

### Profile Trust
Current product exposes a trust inspection result/score.

Required before launch:
- exact inputs;
- exact rejection/review consequences;
- human review path;
- false-positive correction path;
- retention;
- whether the score is visible to the courier.

Status: **OPEN — AUDIT REQUIRED**

### Deactivation engine
There is currently no dedicated deactivation engine in the scanned canonical repository.

Status: **GOOD — do not invent one before appeal governance exists.**

---

## 7. Compensation — questions to answer before the Belgium meeting

Do not improvise numbers.

Prepare a model that can answer:

1. Is compensation per mission, per time block, hybrid or employment wage?
2. What is paid for:
   - travel to pickup;
   - waiting at restaurant;
   - pickup-to-customer distance;
   - customer waiting;
   - failed delivery;
   - cancellation?
3. Are tips fully passed through?
4. Are bonuses discretionary or rule-based?
5. Are vehicle/phone/data costs borne by the courier or compensated?
6. When is payment settled?
7. Who issues the invoice if relevant?
8. What dispute process applies to a missing/incorrect payment?
9. What minimum economic floor does the chosen status/sector require at launch?

Status: **OPEN**

---

## 8. Meeting position for United Freelancers / Maison des Livreurs

Do not present a finished legal model.

Present three columns:

### DECIDED
- explicit accept/refuse;
- refusal not used to penalise future dispatch;
- no silent permanent algorithmic deactivation;
- human review for material decisions;
- clear data/algorithm notice;
- Route Oracle advisory;
- public Courier rights hub.

### OPEN
- final status;
- compensation formula;
- waiting-time compensation;
- accident-protection product;
- invoicing;
- appeal SLA;
- representation in disputes.

### ASK THEM
- what they consider a credible remuneration breakdown before acceptance;
- what evidence they expect in a deactivation notice;
- acceptable review/appeal times;
- support expectations after an accident;
- what platform data couriers should always be able to see/export;
- common hidden pain points that should be designed out before launch.

---

## 9. Belgium launch RED gates

Belgium must remain CLOSED for paid Courier operations if any of these are unresolved:

- [ ] contracting party
- [ ] worker-status analysis
- [ ] remuneration model
- [ ] accident-protection arrangement
- [ ] tax/invoicing flow
- [ ] data/geolocation notice
- [ ] dispatch algorithm register
- [ ] suspension/deactivation procedure
- [ ] human appeal channel
- [ ] support escalation
- [ ] agreement/versioning
- [ ] Store/public app readiness
- [ ] qualified Belgian legal review

---

## 10. Next internal actions

1. Keep this annex DRAFT.
2. Audit all Courier scoring fields against the no-hidden-penalty principle.
3. Define the compensation model without publishing numbers yet.
4. Define geolocation states + retention.
5. Draft deactivation/appeal workflow for review.
6. Prepare 3 meeting slots only after the above are internally coherent.
7. After external feedback, revise to Belgium Annex V0.2.
