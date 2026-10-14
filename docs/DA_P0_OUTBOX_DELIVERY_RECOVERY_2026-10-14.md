# DelishAfrica P0 — Livraison et récupération de l'outbox (QA 020)

14 octobre 2026. **DRAFT / laboratoire PostgreSQL 17 isolé / NO-GO production.**

## Objectif

Rendre démontrable la livraison durable des événements de capture et de blocage financier produits par les migrations QA 018 et 019, sans toucher au journal append-only existant ni lancer un véritable service.

## Les quatre ajouts

1. Migration 020 : table d'état séparée, trois tentatives maximum, backoff, leases bornés, jetons de fencing, ACK sûr, expiration et dead-letter ; permissions SQL strictes.
2. Un driver TypeScript QA qui fait une itération bornée et ne fonctionne que dans GitHub Actions synthétique.
3. Une suite d'intégration PostgreSQL 17 avec deux workers, simulation de crash après application d'effet et avant ACK, reprise, déduplication côté consommateur simulé et quarantaines.
4. La CI de la PR #51 étendue à la suite 020, sans changer les suites précédentes.

## Invariants et interprétation

**At-least-once, pas exactly-once externe.** Une réponse perdue après l'effet externe peut provoquer un rejeu. Le consommateur doit être idempotent sur event_id. Dans la QA, une table consommateur séparée avec clé primaire simule ce contrat, sous un rôle distinct du worker.

Les données sources sont immuables. L'état livré / pending / leased / dead est séparé et ne contient ni secrets, ni PII, ni solde, ni erreurs libres. Les erreurs acceptées sont des codes fixes. Les jetons expirés ou d'un autre worker ne peuvent acquitter un message.

**Cas à prouver par la CI exacte** : concurrence et SKIP LOCKED ; perte ACK après l'effet ; reprise avec une seule ligne consommateur ; trois échecs menant à dead ; troisième bail expiré menant à dead sans limbo ; rôle client non autorisé ; aucun accès SQL direct aux tables depuis worker et consommateur ; aucune requête externe.

## Frontière de production

Le driver QA n'est pas branché dans AppModule et n'est pas un daemon opérationnel. Pas de service mobile, pas de délivrance SMS, pas de véritable bus, aucun paiement ni payout. Reste à approuver l'identité machine, alertes, SLO, politique de réparation DLQ, HA, sauvegarde/restauration et traçage de provenance Store. Aucune migration persistante, merge, déploiement, transaction LIVE, build payant ni soumission sans autorisation spécifique.

Parent : PR #51 DRAFT, SHA certifié c81e824e09d40862681358c52708990e60a970e6, CI push #38634130095 et PR #38634138624 SUCCESS. Le présent candidat 020 nécessite un nouveau SHA exact et une nouvelle CI avant de pouvoir être annoncé PASS.
