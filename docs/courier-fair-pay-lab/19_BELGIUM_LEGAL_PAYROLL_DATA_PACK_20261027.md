# Belgium Courier — Legal & Payroll Data Pack

Date: 27 October 2026
Status: INTERNAL RESEARCH PACK — NOT LEGAL ADVICE
Purpose: inputs required to move `BE-EMPLOYEE-POG-FAIR-PAY-LAB-v0.1` from DRAFT toward LEGAL_REVIEW.

## Executive position

The current POG laboratory direction — a Core Fleet employee model that pays platform-controlled time rather than only active-delivery minutes — is compatible with the **direction** of verified Belgian working-time principles, but it is not yet a production payroll rule.

No final hourly rate, joint committee, wage scale, premium schedule, insurance premium, shift pattern or payroll cadence is approved by this pack.

## 1. Worker status / platform presumption — VERIFIED

Belgian official guidance states that since 1 January 2023 specific criteria apply to activities performed through a digital ordering platform.

A platform-work relationship is presumed to be an employment contract when at least 3 of 8 criteria, or 2 of the last 5 criteria, are met, subject to rebuttal.

Relevant design signals include:
- exclusivity;
- platform control over work execution;
- limits on price/income freedom;
- data-driven priority/ranking;
- limits on freedom to choose hours, absences, acceptance/refusal, substitutes or work for third parties;
- geolocation/control mechanisms.

Source:
https://emploi.belgique.be/fr/themes/contrats-de-travail/nature-de-la-relation-de-travail-travail-salarie-ou-travail-independant

POG implication:
- status is an architecture decision, not a contract-label decision;
- dispatch, acceptance/refusal, rating, geolocation and compensation remain legal-design inputs;
- the employee Core Fleet lab is a credible conservative design direction, but still requires qualified review.

## 2. Working time — VERIFIED

Belgian labour law defines working time as the time during which personnel are at the disposal of the employer.

Official SPF guidance explicitly states that working time can be longer than the periods of effective work.

Examples treated as working time include:
- waiting for customers in a shop;
- training/instructions related to work;
- travel between two workplaces/clients for the same employer.

Time that the worker can freely dispose of is, in principle, excluded.

Source:
https://emploi.belgique.be/fr/themes/reglementation-du-travail/duree-du-travail-et-temps-de-repos/duree-du-travail-et-diminution

POG implication:
- the Fair Pay architecture is right to separate active mission, controlled waiting, required reposition and freely disposable time;
- restaurant waiting cannot automatically be treated as unpaid merely because no delivery is moving;
- required movement between work locations can be materially different from home-to-work commuting;
- final classification of every Courier time bucket must still be validated against the chosen operating model and sector rules.

## 3. RMMMG — VERIFIED, NOT A COURIER RATE

Since 1 April 2026, the Belgian guaranteed average minimum monthly income (RMMMG) is:

**EUR 2,189.81 / month for workers aged 18+.**

The National Labour Council notes that workers may receive a generally higher sectoral minimum.

Sources:
https://cnt-nar.be/fr/dossiers-thematiques/salaire-minimum
https://cnt-nar.be/sites/default/files/press_releases/fr/2026-03-24-F.pdf

POG implication:
- the RMMMG is a baseline reference, not the Courier hourly rate;
- it must NOT be converted mechanically into a production hourly floor before the applicable sector/joint committee/CBA is identified;
- the POG 19 EUR/hour lab floor remains a voluntary simulation assumption only.

## 4. Competent Joint Committee / CBA — OPEN, PRIORITY P0

Official SPF guidance states that the competent joint committee is principally determined by:
- the legal employer;
- the **actual activity exercised in Belgium**;
- which activity justifies the existence/nature of the enterprise;
- personnel allocation and objective operating facts.

It is not determined simply by:
- the worker's job title;
- the social-object wording;
- the declared commercial label.

An employer can request an administrative opinion from the Directorate-General for Collective Labour Relations, but that opinion is not legally binding. The SPF states that the administrative procedure can take at least four months.

Source:
https://emploi.belgique.be/fr/themes/commissions-paritaires-et-conventions-collectives-de-travail-cct/commissions-paritaires-0?id=511

POG action:
- obtain qualified Belgian advice before setting the production wage table;
- consider requesting an SPF joint-committee affiliation opinion once the Belgian employing entity/activity structure is sufficiently fixed;
- do not hard-code a presumed CP into the Fair Pay adapter yet.

## 5. Employer social contributions — VERIFIED BASE INPUT, NOT FULL COST

ONSS administrative instructions for 2026/3 state a base employer contribution rate of:

**24.92% for private-sector workers.**

Source:
https://www.socialsecurity.be/employer/instructions/dmfa/fr/latest/instructions/socialsecuritycontributions/contributions.html

Critical limitation:
24.92% is NOT the complete employer-cost multiplier.

The real fully loaded Courier cost may also depend on:
- employee category;
- holiday/vacation regime;
- sector funds;
- special contributions;
- insurance;
- equipment;
- occupational medicine/prevention;
- payroll/secretariat costs;
- premiums;
- meal/travel/other benefits;
- applicable reductions.

POG implication:
- the current 30 EUR/hour employer-cost scenario remains a lab sensitivity input;
- build the cost engine as parameters, not a single statutory multiplier.

## 6. Accident insurance for employees — VERIFIED

Fedris states that in the private sector the employer must insure remunerated workers against occupational accidents **from the first day of work**.

The obligation covers full-time, part-time, fixed, temporary and occasional workers and includes workplace and commuting accidents.

Source:
https://www.fedris.be/fr/themes/definition-et-assurance/qui-est-assure-contre-les-accidents-du-travail

POG gate:
- no paid Belgian employee Courier pilot before the insurance contract/policy is in force.

Independent platform-worker insurance:
- legislative/transitional material found in 2026 shows this area has had postponements and remains sensitive;
- do not reuse the employee rule as a legal conclusion for independent couriers;
- keep independent insurance treatment OPEN for counsel.

## 7. Part-time architecture — VERIFIED CONSTRAINTS

SPF guidance states:
- a part-time employment contract requires a written agreement no later than start of work;
- the weekly work regime and schedule must be identified;
- fixed and variable arrangements are possible;
- in principle, weekly part-time duration cannot be below 1/10 of the full-time duration for the comparable category, subject to exceptions;
- sector/company derogations may exist.

Source:
https://emploi.belgique.be/fr/themes/contrats-de-travail/contrats-de-travail-particuliers/contrat-de-travail-temps-partiel

Separate SPF guidance states that an individual work period is in principle at least **3 continuous hours**, subject to legal/CBA exceptions.

Source:
https://emploi.belgique.be/fr/themes/reglementation-du-travail/duree-du-travail-et-temps-de-repos/duree-du-travail-et-diminution

POG implication:
- 'only staff 90-minute dinner peaks' is not a safe default assumption;
- micro-shift economics must respect minimum shift/part-time rules;
- a variable or flexible scheduling design may be possible but requires correct contract/work-regulation/CBA implementation.

## 8. Variable schedules — VERIFIED

Part-time schedules may be fixed or variable.

SPF guidance describes:
- fixed weekly regimes;
- variable regimes with average weekly duration over a reference period;
- fixed or variable schedules;
- publication/notification requirements;
- reference periods generally up to three months, extendable in defined cases up to one year by CBA/work regulations.

Source:
https://emploi.belgique.be/fr/themes/reglementation-du-travail/travail-temps-partiel/organisation-du-travail-temps-partiel

POG implication:
- Core Fleet does not require a rigid 9-to-5 architecture;
- demand-aligned staffing can be legally structured, but cannot be improvised by algorithm after the fact;
- the scheduling engine must ultimately respect notice, regime, reference-period and work-regulation rules.

## 9. Platform Work Directive — CURRENT STATUS / RECHECK REQUIRED

Directive (EU) 2024/2831 must be transposed by:

**2 December 2026.**

Official Belgian parliamentary material in 2026 describes the Belgian transposition work as ongoing, involving the SPF Employment, social partners/CNT and other authorities.

Official Foreign Affairs maintains a monthly Belgian transposition state-of-play page; the latest list available during this research is dated 30 September 2026.

Sources:
https://eur-lex.europa.eu/eli/dir/2024/2831/oj
https://www.dekamer.be/doc/CCRI/html/56/ic427x.html
https://diplomatie.belgium.be/fr/politique/coordination-des-affaires-europeennes/transposition-des-directives-europeennes-etat-des-lieux

POG conclusion as of 27 October 2026:
- do NOT assume the Belgian framework is frozen;
- perform a fresh legal check immediately before any launch/pilot;
- algorithmic management, human review, data protection, status determination and remedies remain launch-gate topics.

## 10. Fair Pay adapter — data fields that may become legal inputs

The kernel already has the correct architectural slots:

### Time
- active mission;
- platform-controlled waiting;
- required reposition;
- other paid work;
- excluded/free time.

### Pay
- legal/conventional floor;
- POG voluntary fairness floor;
- eligible wage income;
- differential;
- tips;
- expense reimbursement;
- bonuses/adjustments.

### Audit
- policy version/hash;
- raw facts;
- corrections by supersession;
- statement ID/hash;
- human-review path.

This allows Belgian rules to change **the adapter**, not the global kernel.

## 11. Belgium production-GREEN evidence still required

### Legal / status
- [ ] final employing entity / contracting architecture;
- [ ] qualified status review;
- [ ] competent CP/CBA;
- [ ] wage scale and classification;
- [ ] premiums/night/Sunday/holiday rules;
- [ ] waiting/reposition/break rules;
- [ ] working-time maxima/rest periods;
- [ ] scheduling/notice rules;
- [ ] accident/work-risk insurance;
- [ ] prevention/well-being obligations;
- [ ] equipment/expense policy;
- [ ] platform-directive transposition refresh.

### Payroll
- [ ] payroll secretariat/process selected;
- [ ] payslip fields mapped;
- [ ] employee master data minimum set;
- [ ] employer-cost matrix;
- [ ] holiday cost;
- [ ] applicable reductions/contributions;
- [ ] payroll cadence;
- [ ] correction/recovery rules;
- [ ] dispute/representation workflow.

### Technology
- [x] immutable policy version;
- [x] work-time categories;
- [x] weekly statement;
- [x] correction/supersession;
- [x] ORCHIDPAY shadow settlement intent;
- [ ] production party/payee mapping;
- [ ] production ledger;
- [ ] production payout/reconciliation.

## 12. Recommended next institutional moves

1. Prepare a concise question pack for CSC United Freelancers / Maison des Livreurs:
   - which time categories should never become unpaid?
   - what fairness failures do couriers currently experience?
   - what statement/transparency format is useful?
   - what dispute/representation process would be credible?

2. Ask Belgian payroll/legal counsel or social secretariat to validate:
   - status;
   - CP/CBA;
   - wage scale;
   - scheduling;
   - fully loaded employer-cost inputs.

3. When the employing entity/activity is fixed, consider requesting an SPF administrative CP affiliation opinion.

## Lab conclusion

The current Fair Pay architecture remains technically compatible with the facts verified here because it does **not** hard-code Belgium into the core.

The right design rule remains:

> **Belgian law/CBA determines the mandatory floor. POG may choose a higher fairness floor. The system always protects the higher applicable worker entitlement.**

No production activation follows from this research pack alone.
