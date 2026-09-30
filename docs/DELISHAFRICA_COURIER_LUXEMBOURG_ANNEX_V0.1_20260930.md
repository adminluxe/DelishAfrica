# DelishAfrica® Courier — Luxembourg Annex V0.1

Date: 30 September 2026  
Status: DRAFT — pre-launch legal/product readiness  
Scope: Luxembourg only  
Parent framework: `docs/DELISHAFRICA_COURIER_FRAMEWORK_V0.1_20260930.md`

> Product/governance working document only. It is not legal advice and is not a contract.  
> Luxembourg is currently in an active platform-work legislative transition. Final launch rules require qualified Luxembourg review immediately before launch.

---

## 1. Why Luxembourg needs its own kit

Luxembourg differs materially from Belgium and France:
- current worker classification still depends heavily on the general distinction between employment and self-employment;
- independent economic activity can trigger establishment/registration requirements;
- social-security registration is highly structured;
- cross-border work is common and can alter social-security handling;
- platform-work transposition is still in progress in 2026;
- geolocation/surveillance rules are particularly important if the model is employment.

---

## 2. Current Luxembourg baseline — verified official sources

### 2.1 Employment relationship depends on subordination, work and remuneration

Guichet.lu describes an employment relationship through three elements:
- a link of subordination under the employer's direction;
- performance of work;
- remuneration.

Source:
- Guichet.lu — Contrat à durée indéterminée  
  https://guichet.public.lu/fr/citoyens/travail/conditions-travail/types-contrat-travail/contrat-duree-indeterminee.html

**Implication for DelishAfrica:**  
Do not import a Belgian or French "independent courier" label. Actual control over time, route, mission choice, price, sanctions and supervision must be reviewed.

### 2.2 Self-employed workers must register with CCSS

CCSS states that a person working for their own account must declare the activity to CCSS within **8 days**.

In principle, an affiliated self-employed person is covered for:
- health/maternity;
- occupational accident;
- pension;
- dependency.

Source:
- CCSS — S'affilier  
  https://ccss.public.lu/fr/independants/commencer-arreter-activite/affilier.html

**Implication for DelishAfrica:**  
If the independent model is valid, onboarding must include a Luxembourg-specific registration/compliance checklist.

### 2.3 Independent economic activity can require an establishment authorisation

Guichet.lu states that, except for specific exemptions, habitual economic activity such as commercial/services activity generally requires an `autorisation d'établissement`.

Sources:
- Guichet.lu — Demande initiale ou modification d'autorisation d'établissement  
  https://guichet.public.lu/fr/entreprises/creation-developpement/autorisation-etablissement/autorisation-honorabilite/autorisation-etablissement.html
- Guichet.lu — Activités et services commerciaux  
  https://guichet.public.lu/fr/entreprises/creation-developpement/autorisation-etablissement/commerce/commerce.html

**Important OPEN point:**  
The exact authorisation category/applicability for an individual app-based food-delivery courier must be confirmed with the competent Luxembourg authority/House of Entrepreneurship before onboarding.

Status: **OPEN + VALIDATE**

### 2.4 Cross-border social-security rules are a launch issue, not an edge case

CCSS explains that a self-employed person carrying out activity in several countries must notify CCSS; an A1 determination may be required to establish the applicable social-security system.

Source:
- CCSS — Travailler à l'étranger  
  https://ccss.public.lu/fr/independants/travailler-etranger.html

**Implication for DelishAfrica:**  
The Luxembourg onboarding flow must ask enough information to identify a cross-border case without attempting to decide the applicable system itself.

### 2.5 Geolocation of employees requires strong transparency safeguards

For employees, Luxembourg guidance requires prior information about workplace monitoring. Guichet.lu lists GPS geolocation among surveillance methods and states that information should include:
- detailed purpose;
- implementation modalities;
- retention duration/criteria;
- commitment not to use the data for another purpose.

CNPD guidance warns in particular about real-time tracking outside working periods or use for purposes other than those stated.

Sources:
- Guichet.lu — Information des salariés et des tiers de la surveillance du lieu de travail  
  https://guichet.public.lu/fr/entreprises/ressources-humaines/conditions-travail/protection-donnees/informer-salaries.html
- CNPD — Géolocalisation des véhicules mis à disposition des salariés  
  https://cnpd.public.lu/fr/dossiers-thematiques/surveillance/geolocalisation-vehicules.html

**Implication for DelishAfrica:**  
Even before worker-status selection, the product should separate:
- offline;
- territory verification;
- available/online;
- active mission;
- post-mission.

Default product direction remains: **no continuous off-duty tracking**.

### 2.6 Luxembourg platform-work law is still moving in 2026

The Chamber of Deputies lists proposal **8699**, filed on 10 February 2026, to transpose Directive (EU) 2024/2831. As of the Chamber's latest listed update on **5 August 2026**, the proposal is still **in committee**.

The Chamber also reported that the Minister of Labour is working on a government bill and that the EU transposition deadline is **2 December 2026**.

Sources:
- Chambre des Députés — dossier 8699  
  https://www.chd.lu/fr/dossier/8699
- Chambre des Députés — Travail via une plateforme, 6 May 2026  
  https://www.chd.lu/fr/proposition-de-loi-travail-via-plateforme

**Implication for DelishAfrica:**  
Luxembourg legal review must be refreshed immediately before launch. A September 2026 annex cannot be treated as final for a post-transposition launch.

---

## 3. Luxembourg policy matrix

Legend:
- **DECIDED**
- **OPEN**
- **VALIDATE**
- **IMPLEMENT**
- **WATCH**

| Topic | Current position | Status |
| --- | --- | --- |
| Final worker status | Not decided | OPEN + VALIDATE |
| Link of subordination | Product controls must be audited | VALIDATE |
| Online/offline freedom | Courier chooses availability | DECIDED |
| Accept/refuse mission | Explicit choice; no dispatch-rank penalty | DECIDED |
| Multiple platforms | No exclusivity intended | DECIDED + VALIDATE |
| Route | Route Oracle advisory | DECIDED + VALIDATE |
| Auto-assignment | Current architecture requires confirmation | DECIDED |
| Independent CCSS registration | 8-day rule to be built into onboarding guidance if applicable | IMPLEMENT + VALIDATE |
| Accident coverage | Included in ordinary self-employed CCSS coverage in principle | VALIDATE |
| Establishment authorisation | Exact courier classification must be confirmed | OPEN + VALIDATE |
| Cross-border/A1 | Screening question + official referral required | IMPLEMENT |
| Geolocation states | Offline/verification/online/mission/post-mission split | DECIDED + IMPLEMENT |
| Off-duty tracking | No continuous off-duty tracking intended | DECIDED |
| Employee surveillance notice | Required if employment model/monitoring scope engages rules | VALIDATE + IMPLEMENT |
| Compensation model | Not decided | OPEN |
| Payment/invoicing | Not decided | OPEN |
| Deactivation procedure | Human review + appeal principle adopted | DECIDED + IMPLEMENT |
| Platform-work transposition | Legislative position still moving | WATCH |
| Data/algorithm notice | Required as product principle | DECIDED + IMPLEMENT |

---

## 4. Luxembourg-specific onboarding requirements

### Status decision must come first
No onboarding path should ask the courier to self-select "employee" or "independent" as if that settled the law.

### If independent model is validated
Prepare a checklist for:
- establishment-authorisation applicability;
- CCSS affiliation;
- tax/VAT/invoicing applicability;
- accident/social coverage;
- cross-border/A1 case;
- required identity/work authorisation;
- vehicle/road requirements.

### If employee model is validated
Prepare:
- employment contract;
- ADEM/employer formalities as applicable;
- social-security declaration;
- working-time rules;
- pay rules;
- workplace monitoring/geolocation notice;
- employee-representation information where applicable.

### Cross-border gate
Because Luxembourg naturally attracts residents of neighbouring states, onboarding should ask:
- country of residence;
- other salaried activity;
- other self-employed activity;
- countries where work is physically performed.

The app must not itself determine the social-security country. It should trigger a compliance review/referral.

---

## 5. Geolocation state machine

Target:

```
OFFLINE
  location: off except user-triggered compliance/territory action

TERRITORY_VERIFY
  location: one-shot / bounded proof

ONLINE_AVAILABLE
  location: minimum operational heartbeat required for dispatch

MISSION_ACTIVE
  location: route/ETA/safety operational tracking

MISSION_COMPLETE
  location: stop active tracking; retain only approved audit evidence
```

For every state define:
- legal basis;
- purpose;
- precision;
- frequency;
- retention;
- who can access;
- courier-facing explanation.

---

## 6. Deactivation / appeal

Luxembourg does not yet have a final transposed 2024/2831 platform framework in the sources verified for this annex.

DelishAfrica should therefore adopt the group baseline now:
- no permanent solely automated deactivation;
- understandable reason;
- human reviewer;
- courier response;
- appeal route;
- auditable decision.

Then update the Luxembourg procedure when the transposition is final.

Status: **DECIDED BASELINE + WATCH LAW**

---

## 7. Luxembourg launch RED gates

- [ ] contracting entity
- [ ] final status analysis
- [ ] establishment-authorisation classification
- [ ] CCSS onboarding model
- [ ] compensation/pay model
- [ ] tax/invoicing model
- [ ] cross-border/A1 screening
- [ ] accident/social coverage confirmation
- [ ] geolocation state/retention map
- [ ] privacy notice
- [ ] deactivation/appeal procedure
- [ ] algorithm register
- [ ] Directive 2024/2831 Luxembourg transposition re-check
- [ ] qualified Luxembourg legal review
- [ ] Store/public app readiness

---

## 8. Stakeholder questions

For OGBL / LCGB / worker representatives:
- which status/control features are the most sensitive in platform delivery?
- what do couriers need to know before accepting a mission?
- what geolocation boundaries are expected?
- what is a credible appeal procedure?
- how should cross-border workers be supported?
- what social-protection gaps appear most often?

For House of Entrepreneurship / competent authority:
- what establishment authorisation, if any, applies to an individual app-based food-delivery courier using bicycle/scooter/car?
- what differs by vehicle type?
- what is required for habitual versus occasional activity?

For CCSS:
- onboarding guidance for self-employed courier;
- cross-border/A1 trigger;
- accident coverage confirmation;
- multi-activity cases.

---

## 9. Next actions

1. Keep annex DRAFT.
2. Prepare Luxembourg stakeholder meeting brief.
3. Create cross-border/A1 screening schema.
4. Create geolocation-state technical specification.
5. Obtain establishment-authorisation classification before onboarding.
6. Monitor dossier 8699 and government transposition work.
7. Re-run legal review immediately before launch.
