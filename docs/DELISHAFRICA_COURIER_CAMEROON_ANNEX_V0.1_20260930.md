# DelishAfrica® Courier — Cameroon Annex V0.1

Date: 30 September 2026  
Status: DRAFT — pre-launch legal/product readiness  
Scope: Cameroon only  
Parent framework: `docs/DELISHAFRICA_COURIER_FRAMEWORK_V0.1_20260930.md`

> Product/governance working document only. It is not legal advice and is not a contract.  
> Final worker-status, transport, social-protection, tax and data-processing rules require qualified Cameroon review before paid Courier operations open.

---

## 1. Why Cameroon needs its own operating kit

Cameroon cannot be treated as a copy of the EU launch markets.

The launch model must separately resolve:
- worker status under the Labour Code;
- CNPS treatment;
- protection gaps for an independent model;
- the road-transport / delivery classification of motorcycle or other vehicle couriers;
- municipal/local operating constraints where relevant;
- tax registration/classification;
- the 2024 personal-data law, whose compliance period expired in June 2026;
- a human deactivation/appeal process even where no platform-specific labour statute currently provides the same detail as France.

---

## 2. Current Cameroon baseline — verified sources

### 2.1 Worker status depends on the real relationship, not a label

Cameroon's Labour Code (Law No. 92/007 of 14 August 1992) defines a worker as a person who provides services for remuneration **under the direction and control of another person**. The Code states that the legal position used by the parties is not decisive for determining whether a person is a worker.

Source:
- ILO NATLEX — Law No. 92/007 of 14 August 1992, Labour Code  
  https://natlex.ilo.org/dyn/natlex2/r/natlex/fe/details?p3_isn=31629

**Implication for DelishAfrica:**  
Do not publish a blanket "independent courier" model before reviewing actual dispatch control, pricing, working-time freedom, route constraints, sanctions and supervision.

Status: **OPEN + VALIDATE**

### 2.2 CNPS treatment differs sharply between workers and independent workers

CNPS states that:
- employers must affiliate/register workers covered by the Labour Code, including permanent, seasonal, temporary and occasional workers;
- independent workers, informal-sector workers and rural workers may voluntarily subscribe to the voluntary-insurance regime.

CNPS also states that its voluntary-insurance regime covers old-age, invalidity and death pension protection, rather than the full mandatory employee branches.

Sources:
- CNPS — Services en ligne pour employeurs / FAQ  
  https://www.cnps.cm/fr/employeurs/services-en-ligne-pour-employeurs.html
- CNPS — Assuré(e) / assurance volontaire  
  https://www.cnps.cm/fr/assures/assure-e.html

**Implication for DelishAfrica:**  
If an employment model applies, worker CNPS registration is a launch gate.  
If an independent model is validated, voluntary CNPS alone must not be presented as equivalent to an employee occupational-accident protection package.

Status: **VALIDATE + IMPLEMENT**

### 2.3 Transport-of-goods classification must be resolved before activation

Law No. 2001/015 regulates road transport operators and road-transport auxiliaries. It defines a road transporter broadly as a person transporting people or goods for profit with owned or leased vehicles.

The 2004 access decree also identifies road-goods auxiliary activities such as:
- organiser of road goods transport;
- organiser of parcel/messenger services.

Sources:
- World Bank Law Library — Cameroon transport legislation index  
  https://eba.worldbank.org/en/law-library
- Decree No. 2004/0607/PM text available through Cameroon legal repositories.

**Important limitation:**  
The well-known 2008 "moto-taxi" decree is specifically framed around **public passenger transport**, not food/parcel delivery. DelishAfrica must therefore **not** assume that the S2 moto-taxi licensing regime automatically applies to a food-delivery courier simply because a motorcycle is used.

**Launch question to obtain in writing from the competent transport authority:**  
What licence/registration/vehicle/insurance rules apply to an individual or platform-arranged courier delivering meals or parcels for reward by motorcycle, bicycle or car?

Status: **RED GATE — OPEN + VALIDATE**

### 2.4 Tax classification must be confirmed rather than guessed

The Direction Générale des Impôts states that the Impôt Général Synthétique (IGS), introduced by the 2024 local-tax law, covers qualifying commercial, industrial, artisanal or agropastoral taxpayers outside the real regime with annual turnover below 50 million FCFA.

Source:
- DGI Cameroon — Tout savoir sur l'IRPP / IGS  
  https://www.impots.cm/fr/document/tout-savoir-sur-lirpp

**Implication for DelishAfrica:**  
Do not tell couriers that IGS necessarily applies until the delivery activity and the chosen worker/business model have been classified by the competent tax authority/adviser.

Status: **OPEN + VALIDATE**

### 2.5 Cameroon now has a dedicated personal-data law

Law No. 2024/017 of 23 December 2024 applies broadly to personal-data processing concerning persons established, resident or in transit in Cameroon.

The law includes:
- privacy/confidentiality principles;
- prior, free, informed, specific and unambiguous consent as the default basis, subject to statutory exceptions;
- purpose limitation;
- data-quality/correction obligations;
- an independent personal-data authority in the statutory framework;
- data-subject rights including access, rectification, erasure, limitation, objection and portability.

The 18-month compliance period expired on **23 June 2026**.

Sources:
- Presidency of the Republic — Law No. 2024/017  
  https://www.prc.cm/fr/multimedia/documents/10258-loi-n-2024-017-du-23-12-2024-web
- Government privacy implementation example listing the statutory rights  
  https://services.mintoul.gov.cm/Home/Privacy

**Current implementation caveat:**  
Public legal analyses in 2026 report that the operational personal-data authority/decree framework is still incomplete. This does **not** make the law optional. Interim filing/authorisation strategy requires local counsel.

Status: **RED GATE — IMPLEMENT + VALIDATE**

---

## 3. Cameroon policy matrix

Legend:
- **DECIDED** = product principle approved
- **OPEN** = business/legal choice not yet made
- **VALIDATE** = Cameroon professional/authority confirmation required
- **IMPLEMENT** = engineering/ops work required

| Topic | Current position | Status |
| --- | --- | --- |
| Final worker status | Not decided | OPEN + VALIDATE |
| Direction/control audit | Required before model selection | DECIDED + VALIDATE |
| Online/offline freedom | Courier chooses availability | DECIDED |
| Accept/refuse mission | Explicit choice; refusal does not lower dispatch rank | DECIDED |
| Multiple platforms | No exclusivity intended | DECIDED + VALIDATE |
| Route | Route Oracle advisory | DECIDED + VALIDATE |
| Auto-assignment | Current architecture requires human/courier confirmation | DECIDED |
| Employee CNPS | Mandatory if Labour Code worker relationship applies | VALIDATE + IMPLEMENT |
| Independent CNPS | Voluntary regime possible; not equivalent to full employee protection | VALIDATE |
| Occupational accident protection | Separate protection model must be resolved before launch | OPEN + VALIDATE |
| Transport licence — motorcycle delivery | Exact category not yet confirmed | RED / VALIDATE |
| Transport licence — bicycle/car | Exact category not yet confirmed | RED / VALIDATE |
| Platform as organiser/messenger | Potential transport-auxiliary classification to confirm | OPEN + VALIDATE |
| Tax / IGS | Activity classification to confirm | OPEN + VALIDATE |
| Compensation | Not decided | OPEN |
| Payment cadence | Not decided | OPEN |
| Tips | Not decided | OPEN |
| Deactivation | Human review + appeal baseline | DECIDED + IMPLEMENT |
| Data-processing register | Required product/compliance direction | IMPLEMENT |
| Geolocation notice | Required before activation | DECIDED + IMPLEMENT |
| Data-subject rights | Access/rectification/erasure/limitation/objection/portability workflow | IMPLEMENT |
| Cross-border hosting/transfers | Must be mapped and legally validated | OPEN + VALIDATE |
| Local representative consultation | Required before scaled onboarding | DECIDED |

---

## 4. Cameroon product guardrails

### Availability
- courier explicitly selects online/offline state;
- no hidden punishment for being offline;
- no minimum acceptance ratio in dispatch ranking.

### Mission offer
Before acceptance, target UI should expose, once locally validated:
- restaurant/pickup;
- delivery zone/destination information at the appropriate precision;
- distance/ETA;
- compensation or calculation basis;
- known bonus;
- known deductions/fees;
- vehicle/safety constraints.

### Refusal
- explicit decline action;
- refusal logged for audit only unless a separately documented lawful purpose exists;
- refusal does not lower dispatch ranking;
- refusal alone does not trigger account deactivation.

### Geolocation
Use the common Courier state model:
```
OFFLINE
→ TERRITORY_VERIFY
→ ONLINE_AVAILABLE
→ MISSION_ACTIVE
→ MISSION_COMPLETE
```

For Cameroon, every state must additionally be mapped into the Law 2024/017 data register:
- purpose;
- data fields;
- legal basis/consent strategy;
- retention;
- recipient/access roles;
- hosting location;
- international transfer, if any;
- courier-facing rights route.

### Deactivation
Group baseline:
```
signal / incident
→ protective action only if necessary
→ notice
→ courier explanation
→ human review
→ decision + reason
→ appeal
→ final outcome
```

No final deactivation solely from an algorithmic score.

---

## 5. Social-protection fork

### If employee model applies
Before activation:
- employer/CNPS affiliation;
- worker registration;
- employment documentation;
- payroll/remuneration;
- occupational accident/social branches;
- working-time and health/safety review;
- termination/disciplinary procedure.

### If independent model is validated
Before activation:
- business/tax classification;
- CNPS voluntary option explained accurately;
- separate accident/injury protection decision;
- transport licence/permit answer;
- vehicle/insurance requirements;
- payment/invoice process;
- data/geolocation notice;
- dispute/deactivation process.

---

## 6. Transport authority question set

Obtain a written or documented answer before scaled onboarding:

1. Does a meal/parcel courier transporting third-party goods for reward qualify as a road transporter under Law 2001/015?
2. Does DelishAfrica qualify as an organiser of road goods transport or organiser of messenger/parcel services?
3. What licence/authorisation applies to:
   - bicycle courier;
   - motorcycle courier;
   - car courier?
4. Does motorcycle food delivery fall outside the passenger "moto-taxi" S2 regime?
5. What vehicle registration, inspection and insurance documents are required?
6. Are municipal identifiers/zone restrictions relevant for goods couriers?
7. Are different requirements triggered when the courier owns versus rents the vehicle?

Until answered: **transport gate remains RED.**

---

## 7. Data-protection readiness

Before Cameroon activation:

- [ ] data-processing inventory
- [ ] lawful-basis/consent mapping
- [ ] privacy notice in appropriate language(s)
- [ ] geolocation purpose/retention matrix
- [ ] processor contracts
- [ ] hosting / transfer map
- [ ] rights-request workflow
- [ ] breach-response process
- [ ] high-risk processing assessment for location/scoring
- [ ] authority/authorisation interim strategy reviewed by local counsel
- [ ] deletion/retention schedule
- [ ] courier export package

---

## 8. Cameroon launch RED gates

- [ ] contracting party
- [ ] worker-status analysis
- [ ] transport/motorcycle-delivery classification
- [ ] vehicle/insurance requirements
- [ ] CNPS model
- [ ] accident/injury protection
- [ ] tax/IGS classification
- [ ] compensation model
- [ ] payment/invoicing
- [ ] geolocation/data-law compliance
- [ ] hosting/international-transfer review
- [ ] deactivation/appeal procedure
- [ ] algorithm register
- [ ] local support/escalation ownership
- [ ] qualified Cameroon legal review
- [ ] Store/public app readiness

---

## 9. Consultation targets

Already identified:
- MinaJobs — future recruitment channel / labour-market signal
- Projet Moto Afrique — potential field/safety/motorcycle ecosystem dialogue

Add for validation:
- competent Ministry of Transport / territorial delegation;
- CNPS;
- DGI / tax adviser;
- local labour counsel;
- courier / rider associations and field groups;
- insurer with motorcycle/delivery accident capability.

---

## 10. Next actions

1. Keep annex DRAFT.
2. Build Cameroon transport/social/data technical spec.
3. Obtain transport-category determination.
4. Choose status model only after control audit.
5. Define compensation/payment model.
6. Define accident/injury protection.
7. Prepare Cameroon stakeholder meeting brief.
8. Map Law 2024/017 requirements into Courier privacy/data tooling.
9. Revise to Cameroon Annex V0.2 after field and authority feedback.
