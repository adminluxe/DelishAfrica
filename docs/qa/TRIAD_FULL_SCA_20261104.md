# Full workspace SCA closure candidate

QA only. Parent is draft #84 at 64dbbf7cda2b8d0548f1ff5df99c0426a8a5c0ea; it preserves the existing OIDC hotfix and release-branch ancestry. This does not reconstruct or replace the production image and does not select a production source automatically.

Runtime baseline: 14 HIGH, 0 CRITICAL. Candidate PROD: 0 HIGH, 0 CRITICAL, 20 MODERATE, 5 LOW. FULL: 0 HIGH, 0 CRITICAL, 32 MODERATE, 11 LOW. Both unchanged HIGH-threshold CLI gates exit zero; pnpm 9 JSON audit mode separately reports all severities and can return one for remaining lower findings. Those findings stay open.

Official dependency remediations include Forge, Multer, Body Parser, Undici, the decoder and affected build tools. Astro moves from 7.1.6 to 7.2.8 to close a CRITICAL finding. The decoder's official 0.5.1 algorithm is unchanged; a two-line packaging patch preserves legacy CommonJS consumers while retaining ESM default-import compatibility. A direct override without this patch reproduces 'decodeComponent is not a function'.

CI must validate the frozen graph, both query-string 7.1.3 and 9.3.1 consumers, malformed-input handling with a bounded stress subprocess, all three app typechecks, Nest build, landing build, six unsigned Hermes exports, bundle attestations and both FULL/PROD native audits. No audit suppression, lifecycle script or new financial admission is introduced.

Remaining release gates include independent security review, exact source-to-image provenance, legitimate membership/KYB, real-device E2E, ledger compensation review and rollback rehearsal. No production deployment, Store upload, IAM change, LIVE payment, payout, real-key read or signing operation is performed. No automatic merge of this draft, #84 or #85.
