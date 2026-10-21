# POG / DelishAfrica — private security-backport compatibility experiment

**2026-10-21 — QA ONLY — NOT A PRODUCTION RELEASE OR SECURITY ACCEPTANCE.**

## Lineage
- Target base: adminluxe/DelishAfrica at `4b9b648d639baa3ce16e7c250b234ba730558070`, release/store-triad-final-security-20261021 (PR #62 DRAFT).
- Source: adminluxe/orchidpay PR #27, exact `c31f277f20a3b4e26716131be00cd8f0e6e905a8`.
- Candidate archives originally produced and maintained under OrchidPay B7-C/R2; they are **not official upstream releases**.
- Local reusable archives are identical to the source PR and are transferred into `vendor/pog-security`.

## Exact packages
| Package | Retained original version | SHA-256 tarball | Advisory |
| --- | --- | --- | --- |
| `braces` | `3.0.3` | `4bff218db239804e386a20d9b4b577a13c9be7df892d652971277f33f135b5af` | GHSA-vfj7-8cjw-p6xm |
| `node-forge` | `1.4.0` | `1cbc5f02f47c42e1a748b6396f0381658fd2bf97fc99dc4c126fc308ec74dce9` | GHSA-86w9-cpqp-85rv |

- The `B7_PACKAGE_MANIFEST.json` contains SHA-256 and SHA-512 for complete archives and files, LICENSEs, original npm tarball provenance, candidateOnly markers and upstream change SHAs.
- `pnpm.overrides` resolves both names to these local archives. No dependency name spoofing or postinstall transformation is used.
- `.easignore` permits **only the two pinned archives** under `vendor/pog-security`; other archives, secrets and credentials remain blocked.

## QA gates and evidence
- `pnpm install --lockfile-only --ignore-scripts --prefer-offline`: PASS on isolated Toshiba worktree.
- Archive SHA-256 / SHA-512 and 12 braces + 60 node-forge per-file hashes: PASS.
- Isolated independent smoke: 60 braces functional comparisons PASS; recursion 101/350 rejects; RSA-2048 e=3 and 65537 valid/tamper/malformed DigestAlgorithm checks PASS. These are subset checks, not external independent certification.
- New `scripts/qa_pog_security_backports.cjs` verifies tarball/manifest/licences, installed pnpm virtual-store resolution and bounded regression cases in CI.
- The release-admission sentinel **must exit non-zero** until a qualified reviewer explicitly signs off; a misleadingly green native audit due file: package resolution does not suffice.
- Six actual Expo/Hermes JS exports, signing-tool compatibility, source-map composition, and native-device builds on this modified lockfile are **NOT YET CERTIFIED** at the time this file was written. Read GitHub run results for the exact SHA.

## Risk and licensing
- Backported cryptographic code is high-assurance. Passing tests or an external PR being open does **not** prove correctness for all inputs.
- `node-forge` carries the source's existing BSD-3-Clause OR GPL-2.0 licensing option; consult the complete unmodified LICENSE and preserve notices. `braces` retains MIT LICENSE.
- Risk still needs independent code review, secure build-chain test, EAS signing validation and ongoing patch ownership.
- The upstream security advisories still identify the retained versions as affected. Their presence must remain visible in the risk register and must not be silently suppressed.

## Deployment boundaries
- This is a separate Git worktree, not the release branch or `main`.
- OrchidPay finance LIVE, payments, settlements and payouts remain unchanged.
- No EAS paid build, Store submission, production API/database change, npm package publish, GitHub Release or migration is part of this lab.
- Explicit `STORE_NO_GO` until security acceptance, reproducible CI, physical-device QA and exact signed-artifact passports.
