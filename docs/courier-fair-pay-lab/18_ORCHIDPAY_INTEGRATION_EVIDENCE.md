# Courier Fair Pay + ORCHIDPAY — Integration Evidence 2026-10-27

## Cross-language fixture

File:
`16_ORCHIDPAY_SETTLEMENT_INTENT_FIXTURE.json`

Statement ID:
`7cf5c31a0eb09deb3a0a8a377e6c90139b1d90659b93ec897ee9926d9e0413f0`

Properties:
- source: real DelishAfrica TypeScript Fair Pay builder;
- country: BE;
- policy: DRAFT;
- production eligible: false;
- mode: SHADOW;
- total cash due: 2700 minor units / 27.00 EUR.

The exact fixture is consumed by the ORCHIDPAY Python test suite.

Result:
**PASS**.

## QA totals

DelishAfrica Fair Pay suite:
**61/61 PASS**

ORCHIDPAY shadow suite:
**13/13 PASS**

## Safety

No production deployment.
No ORCHIDPAY database migration.
No ledger posting.
No payout.
No payment rail.
