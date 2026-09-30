# DelishAfrica® Courier — Luxembourg Cross-Border & Geolocation Spec V0.1

Date: 30 September 2026  
Status: INTERNAL PRODUCT SPEC — NOT PRODUCTION

## A. Cross-border screening

Collect only what is needed to route the case for review:

- country of residence;
- country/countries where courier expects to perform missions;
- existing salaried activity? yes/no;
- country of salaried activity;
- existing self-employed activity? yes/no;
- country/countries of self-employed activity;
- existing CCSS affiliation? yes/no/unknown;
- existing A1 certificate? yes/no/unknown;
- work authorisation/residence status where relevant.

Do not:
- let the app decide the applicable social-security system;
- tell a courier that an A1 is unnecessary without competent review;
- assume Luxembourg affiliation merely because missions occur in Luxembourg.

Output:
- `STANDARD_LU_REVIEW`
- `CROSS_BORDER_REVIEW_REQUIRED`
- `WORK_AUTH_REVIEW_REQUIRED`

## B. Establishment-authorisation gate

Before activation, compliance must record:
- vehicle type;
- nature of delivery activity;
- habitual vs occasional activity;
- independent vs employee model;
- competent-authority answer/reference;
- authorisation required? yes/no;
- evidence/permit ID if applicable.

No activation while answer is `UNKNOWN`.

## C. Geolocation state machine

### OFFLINE
- active tracking: OFF
- one-shot user-triggered compliance action: possible
- dispatch eligibility: NO

### TERRITORY_VERIFY
- purpose: verify declared operating area
- precision/frequency: minimum required
- automatic stop after proof

### ONLINE_AVAILABLE
- purpose: dispatch proximity/availability
- heartbeat: configurable minimum
- courier sees tracking indicator
- dispatch eligibility: YES

### MISSION_ACTIVE
- purpose: pickup/delivery ETA, operational coordination, safety
- tracking frequency may increase
- access limited by role
- retention mapped to approved purpose

### MISSION_COMPLETE
- active route tracking stops
- only approved audit evidence retained

## D. Mandatory metadata per location use

- purpose;
- legal basis;
- state;
- precision;
- frequency;
- start trigger;
- stop trigger;
- retention;
- viewers/roles;
- exportability;
- courier-facing explanation.

## E. Product guardrails

- no silent tracking when OFFLINE;
- no unrelated reuse of location data;
- no indefinite raw-location retention;
- no refusal penalty in dispatch;
- no final deactivation solely from an algorithmic signal;
- every geolocation state visible in the privacy/worker notice.

## F. QA scenarios

1. app offline → no background route tracking;
2. territory verification completes → location sampling stops;
3. online availability → heartbeat only at configured rate;
4. mission accepted → active mission tracking begins;
5. mission delivered → active tracking stops;
6. cross-border answer detected → activation blocked pending review;
7. establishment-authorisation status UNKNOWN → activation blocked;
8. human review missing on permanent deactivation → action blocked.
