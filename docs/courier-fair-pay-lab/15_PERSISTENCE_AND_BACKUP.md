# Persistence & Backup V0.1

## LAB ledger

Repository abstrait:
- policy ledger;
- raw clock events;
- payroll facts;
- weekly statements.

File implementation:
- NDJSON append-only;
- directory mode 0700;
- files mode 0600;
- fsync après append;
- deterministic SHA-256 per record;
- restart/reload verification.

Rejet au redémarrage:
- JSON corrompu;
- hash altéré;
- duplicate persisted ID;
- child sans policy scellée;
- policy/country mismatch;
- statement policyHash/devise mismatch.

## SQL draft

`sql/001_COURIER_FAIR_PAY_APPEND_ONLY_DRAFT.sql`

Statut: DRAFT / NOT APPLIED.

Il décrit tables + triggers anti UPDATE/DELETE. Aucun DDL n'a été exécuté en production.

## Git checkpoints

Base:
`9a7d69b0ffcfbdd7d0e3b44d1320f17d947d1bb3`

Checkpoint 1:
`6fe00d0a154ff24f7b723fd0c8900febb8181ab0`

Checkpoint 2:
`b8b0c719547bdea28aefd596c87f52540f2ea327`

## Off-machine backup checkpoint 2

GitHub backup branch:
`backup/courier-fair-pay-lab-20261027`

Patch exact:
- 203409 bytes;
- SHA-256 `09bf62ae1f9e073de7fdd05b2d4b3e43dcd2020f7d81014cdac7aeed6ff32126`;
- 11 chunks base64;
- 11/11 chunks relus depuis GitHub et identiques;
- manifest relu et identique.

Cette sauvegarde est restaurable sans le Toshiba.

## Rule

Chaque tranche majeure doit être:
1. tests PASS;
2. git diff --check PASS;
3. commit local;
4. patch exact SHA-256;
5. backup GitHub chunked vérifié tant que le DNS Toshiba empêche un push normal;
6. Airtable/PurpleCRM synchronisés.


## Checkpoints après pipeline initial

Checkpoint Delish code:
- `5e2c46c` — persistance runtime facts;
- `122c279` — runtime LAB auditable + API/bridge.

Remote code branch:
`lab/courier-fair-pay-kernel-code-20261027`

Cette branche est distincte du backup multipart historique `lab/courier-fair-pay-kernel-20261027`, qui ne doit pas être force-pushé.

## ORCHIDPAY baseline + shadow lab

Operational runtime baseline:
- source: `/srv/orchidpay/orchidpay-api`;
- secrets / venv / logs excluded;
- archive SHA-256: `60e0253bd6b25b137ed21cacfd33a77ff4eac7f044c8a7223761a9a6fbcef721`.

VPS lab:
- baseline commit: `9bb7c14`;
- shadow consumer commit: `78edc49`.

Evidence copied to Toshiba:
`/home/tontoncestcarre/DA_EXPORTS/ORCHIDPAY_COURIER_PAYROLL_LAB_20261027/`

Hashes:
- lab tar: `0966d94ad6b5f4c164eb168121b8075a36bed463013626cca2806cd0be623220`;
- baseline→shadow patch: `333cc26df24650b8d9b0485cfcdf12bcc0737fd39d553847886221b563f27e7a`.

Local SHA-256 verification: PASS.

GitHub ORCHIDPAY preservation:
- branch: `lab/courier-fair-pay-orchestrator-contract-20261027`;
- commit: `7bce84d`.

No ORCHIDPAY production runtime modification was required to establish this backup.
