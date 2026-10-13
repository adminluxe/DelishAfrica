# DELISHAFRICA® — PASSATION F4L / IDENTITÉ MACHINE DISPATCH ET AFFECTATIONS SÉCURISÉES

**13 octobre 2026 | PR #44 DRAFT | QA GitHub Actions éphémère | NO-PRODUCTION | NO-PAYOUT**

> **Nature de la preuve :** les logiciels Keycloak 26.4.7 et PostgreSQL 17 fonctionnent réellement dans un banc Docker isolé. Toutes les identités, affectations, entreprises, documents de conformité, commandes, paiements et montants de cette preuve sont **fictifs**. L'authentification machine est éprouvée en QA, **pas déployée** chez DelishAfrica.

## 1. Provenance, autorité et garde-fous

- Dépôt : `adminluxe/DelishAfrica`.
- [PR #43 F4K](https://github.com/adminluxe/DelishAfrica/pull/43), **DRAFT non fusionnée** : base certifiée `f9f4af32692bbc2820a1987ea5d2f85ba764a71e`.
- Triple preuve F4K parent sur le même SHA : [Keycloak + mutations + wallets #38363525534](https://github.com/adminluxe/DelishAfrica/actions/runs/38363525534), [API + 3 apps #38363525548](https://github.com/adminluxe/DelishAfrica/actions/runs/38363525548), [PG17 finance historique #38363525526](https://github.com/adminluxe/DelishAfrica/actions/runs/38363525526) — trois SUCCESS.
- **F4L** : [PR #44 DRAFT](https://github.com/adminluxe/DelishAfrica/pull/44), branche `feat/f4l-oidc-machine-dispatch-assign-qa-20261013`, basée exactement sur F4K et non sur `main`.
- Worktree Toshiba `/home/tontoncestcarre/work/DA_STRIPE_RECON_QA_20261012` : **non touché**.
- Runtime VPS `/opt/delishafrica/monorepo/apps/{client,merchant,courier}` : **non touché**.
- Aucune fusion, migration, action Stripe TEST officielle, Stripe LIVE, transaction réelle, payout, build EAS ou soumission Store.

## 2. Lacune F4K corrigée

La fonction SQL 007 `public.da_qa_dispatch_assign_offer(uuid,text,uuid)` savait vérifier le paiement et verrouiller l'ordre, mais **ne prouvait pas elle-même l'autorité de l'appelant**. F4K avait recours à un initialiseur PostgreSQL privilégié et temporaire pour deux offres fictives. Ce n'était pas une identité Dispatch certifiée.

F4L remplace cette étape dans son **nouveau laboratoire** par une identité de machine issue du véritable Keycloak éphémère, une attestation cryptographique vérifiée en processus distinct et une fonction SQL 016 utilisable par **une seule identité PostgreSQL de machine**, indépendamment des applications Merchant et Courier. L'historique F4K est rejoué intégralement avant les tests F4L, sans modifier ses fonctions.

## 3. Architecture du laboratoire F4L

```text
[Keycloak 26.4.7 réel, realm QA synthétique]
  Service account CONFIDENTIEL / client_credentials ONLY
  client_id=da-f4l-dispatch-machine-qa
  scope=da.dispatch.assign
  aud=delishafrica-dispatch-authority
  rôle=da_dispatch_assign / JWT RS256 / introspection active
                        |
                        v
[Worker machine isolé, UID 1000, SQL da_qa_dispatch_machine_016]
  SQL begin_016: challenge lié au login/PID/démarrage backend
                        |
                        v
[Attesteur PRIVÉ, UID 1002, socket Unix protégé 0660]
  clé de machine ABSENTE ; secret introspection PRIVÉ
  signature JWKS RSA, issuer, aud, azp, scope, rôle, exp, jti
  SQL da_qa_dispatch_attest_016: tickets uniques à courte vie
                        |
                        v
[SQL 016 SECURITY DEFINER / propriétaire NOLOGIN non-superuser]
  machine + ticket non rejouable et lié au même backend
  LOCK order FOR UPDATE AVANT finance / refund (SQL 008)
  LOCK registre machine + partenaire/entité/territoire
  LOCK identité Courier + roster/contrat/KYC
  appel borné SQL 007 ; un seul Courier/commande
                        |
                        v
[Offre et reçu Dispatch 016 append-only]
  zéro accès SQL 007 rétabli à Merchant/Courier
  zéro déclenchement automatique picked_up / delivered
  paiement/payout réels : ABSENTS
```

**Fichiers contrôlés :**

- SQL : `services/api-nest/migrations/client-commerce/20261013_016_oidc_machine_dispatch_authority_qa_only.sql`.
- Workflow : `.github/workflows/f4l-oidc-machine-dispatch-qa.yml`.
- Keycloak client_credentials : `services/api-nest/test/f4l-dispatch-oidc-machine.setup.pg-qa.cjs`.
- JWT JWKS/introspection : `services/api-nest/test/f4l-dispatch-oidc-verifier.pg-qa.cjs`.
- Attesteur privé : `services/api-nest/test/f4l-dispatch-private-attestor.pg-qa.service.cjs`.
- Tests : `services/api-nest/test/f4l-dispatch-*.pg-qa.integration.cjs`, `f4l-dispatch-courier-pickup.pg-qa.cjs`, `f4l-dispatch-final-accounting.pg-qa.sql`.

**Séparation de privilèges :** `da_qa_dispatch_owner_016` est **NOLOGIN** ; `da_qa_dispatch_machine_016` et `da_qa_dispatch_attestor_016` sont des logins SQL indépendants avec mots de passe SCRAM générés une seule fois sur le runner. Seul le propriétaire NOLOGIN a le droit d'appeler la fonction historique Dispatch 007. Les logins mobiles Merchant/Courier ne peuvent ni reprendre ce rôle ni appeler 007, 016 ou lire les reçus 016. Le socket d'attestation n'est publié sur aucun port HTTP/TCP externe.

**Important :** F4L reste un **laboratoire QA** : les fonctions SQL 007 historiques sont des fonctions `SECURITY DEFINER` héritées du banc synthétique. Aucun de ces SQL ne constitue une migration prête à déployer sur une base persistante ; une future chaîne de propriétaires SQL et une authentification mTLS ou autre défense réseau pourront encore être exigées avant une exploitation réelle.

## 4. Matrice d'attaque et de concurrence réellement exécutée

| Test | Attendu QA | Preuve |
|---|---|---|
| Merchant/Courier s'octroient une course directement, `SET ROLE` NOLOGIN, fonctions SQL 007/016 | Refus | `QA_F4L_MERCHANT_COURIER_DISPATCH_SQL_PERMISSIONS=DENIED` |
| JWT humain Merchant/Courier, jeton RS256 falsifié, audience/scope/azp incorrects | Refus | `QA_F4L_MACHINE_TOKEN_ISOLATION_AND_SIGNATURE=PASS` |
| Confidential Keycloak machine `client_credentials`, aud/azp/rôle/scope signé | Acceptation machine QA | `QA_F4L_KEYCLOAK_REAL_CLIENT_CREDENTIALS_SCOPED=PASS` |
| Machine SQL + attesteur indépendants et socket protégé | Acceptation | `QA_F4L_STRONG_MACHINE_OIDC_AND_PRIVATE_SOCKET=PASS` |
| Sept affectations simultanées du même ordre | Un seul premier reçu, six replays | `QA_F4L_MACHINE_DISPATCH_ASSIGN_AND_CONCURRENCY=PASS` |
| Commande non prête, Courier étranger, organisation/territoire étrangers | Refus | `QA_F4L_MACHINE_DISPATCH_ASSIGN_AND_CONCURRENCY=PASS` |
| Mission déjà enlevée par Courier attesté F4K ; réaffectation | Refus | `QA_F4L_PICKED_UP_PROTECTED_AND_TICKET_SINGLE_USE=PASS` |
| Deuxième consommation du même ticket sur le même backend | Refus | `QA_F4L_PICKED_UP_PROTECTED_AND_TICKET_SINGLE_USE=PASS` |
| Remboursement validé avant nouvelle affectation | Refus | `QA_F4L_REFUND_FIRST=DENIED` |
| Remboursement concurrent gardant l'ordre sous `FOR UPDATE` | Dispatch attend puis refuse | `QA_F4L_CONCURRENT_REFUND_POSTGRES_ORDER_LOCK=PASS` |
| Roster Courier révoqué alors que son JWT est encore signé | Refus | `QA_F4L_COURIER_REVOKED=DENIED` |
| Courier déplacé vers une autre entité et juridiction | Refus | `QA_F4L_ORG_MOVED=DENIED` |
| Autorisation de service machine révoquée en base | Refus | `QA_F4L_MACHINE_REVOKED=DENIED` |
| Reçu Dispatch immuable ; ancienne ACL 007 toujours fermée | Refus des mutations directes | `QA_F4L_MACHINE_ASSIGNMENT_RECEIPTS_IMMUTABLE_5=PASS` |

**Résultat financier du banc cumulatif F4K + F4L :** trois allocations synthétiques de la baseline F4K plus **treize commandes synthétiques capturées** dans F4L, soit **16 allocations** et **64 écritures signées** de somme **exactement nulle**. Le laboratoire compte **5 reçus Dispatch 016 immuables** (les commandes synthétiques non attribuées ne deviennent pas automatiquement des missions). La commission de **20 %** reste une simple fixture financière QA, sans portée contractuelle. Aucune sortie bancaire : `withdrawableMinor=0`, `payoutEnabled=false`.

## 5. Preuve des trois CI sur le commit de code

**Premier HEAD de code F4L vérifié, avant les mises à jour documentaires :** `eb077d8c5e176b74f0dbae62386319be1a4a442d`.

- [F4L Keycloak réel + PostgreSQL 17 + rôle machine + mutations + remboursement en concurrence — run #38368706755](https://github.com/adminluxe/DelishAfrica/actions/runs/38368706755) — **SUCCESS**.
- [API Nest + Client + Merchant + Courier — run #38368706742](https://github.com/adminluxe/DelishAfrica/actions/runs/38368706742) — **SUCCESS**.
- [PostgreSQL 17 / réconciliation et concurrence historiques — run #38368706881](https://github.com/adminluxe/DelishAfrica/actions/runs/38368706881) — **SUCCESS**.

Les trois exécutions portent **strictement le même SHA**. F4K est rejoué au début du workflow F4L ; les sorties confirment le parcours Merchant/Courier attesté et ses six pulses financiers avant l'introduction de SQL 016.

**Historique des corrections du laboratoire :** la première sonde de disponibilité cherchait le socket dans un dossier volontairement non traversable par le runner ; sonde déplacée à l'intérieur du conteneur **sans ouvrir les permissions**. L'assertion comptable initiale attendait 60 écritures pour 13 fixtures nouvelles, alors que le résultat réel était **64 écritures / somme zéro** ; seule l'assertion a été réalignée. Aucune suppression de verrou ni élévation de droits app pour contourner ces incidents.

## 6. Certification finale documentaire : procédure non ambiguë

La création du présent fichier, l'ajout au roadbook et au pin d'architecture **changent le HEAD Git**. Le SHA `eb077d8…` reste la preuve du code de laboratoire ; il **ne doit pas être confondu** avec le SHA du commit documentaire final.

La **signature finale** doit être publiée dans la discussion de la [PR #44](https://github.com/adminluxe/DelishAfrica/pull/44), en listant le **SHA HEAD complet et les trois nouvelles URLs CI SUCCESS de ce même SHA**, sans nouveau commit ensuite. Ce procédé évite un auto-référencement impossible du hash dans son propre commit.

## 7. NO-GO et suite

- **Pas de véritable réseau Dispatch de production :** ce service Keycloak, les affiliations/KYB/KYC, commandes et comptes restent isolés et fictifs. Le Socket F4L et les logins SQL sont exclusivement utilisés en CI.
- **Pas de modification applicative :** les trois véritables apps Expo ne consomment pas encore les nouvelles affectations sécurisées ; aucune migration VPS n'a eu lieu.
- **Pas d'autorité légale vérifiée** pour les entités, territoires, contrats, bénéficiaires, KYB/KYC, comptes ou versements réels.
- **Pas de garantie atomique** entre révocation externe Keycloak et transaction PostgreSQL ; seule la révocation du registre local SQL est verrouillée atomiquement.
- **Aucune autorisation** de Stripe TEST officiel, Stripe LIVE, payout, settlement, fusion, EAS payant, Store ou production.
- **Prochaines gates** : intégration contrôlée du service Dispatch dans le backend, identité opérateur et audit indépendant des réaffectations/annulations, sécurité réseau et ownership SQL sans superuser, vrais registres juridiques, vérification G0–G7 et tests de restauration.

**Signature provisoire de code : F4L-KEYCLOAK-MACHINE-OIDC-SQL016-3CI-SUCCESS / DISPATCH-ATTESTED-QA-ONLY / REFUND-ROW-LOCK / NO-PAYOUT / NO-VPS / NO-MERGE / PR-DRAFT.**
