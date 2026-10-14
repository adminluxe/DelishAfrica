# DelishAfrica — Scellement finalité financière / Outbox PostgreSQL 018 (QA)

**14 octobre 2026 | Statut : DRAFT, QA isolée ; aucun effet production.**

## But P0 et portée exacte

Rattacher, **sur une même commande de test**, les composants financiers déjà certifiés : réservation durable du panier avant fournisseur, Stripe TEST simulé, signature brute du webhook, inbox à anti-rejeu, vérification indépendante de la capture, état Client, portes Merchant/Courier, blocage refund et nouvel outbox PostgreSQL transactionnel. Conserver les voies existantes, sans réécrire le réconciliateur ni le moteur Merchant/Courier.

Branche empilée sur DelishAfrica PR #50 : `security/p0-financial-finality-outbox-qa-20261014`. Les contrôleurs publics Nest, `AppModule`, les routes VPS et les apps distribuées ne sont pas modifiés.

Nouveaux fichiers :
- `services/api-nest/migrations/client-commerce/20261014_018_financial_finality_outbox_qa_only.sql` ;
- `services/api-nest/test/p0-financial-finality-outbox.pg-qa.integration.cjs`.

Workflow de la lignée QA existante étendu : `.github/workflows/p0-pg-first-checkout-ports-qa.yml`.

## Architecture de preuve

```text
Commande Client QA + snapshot immuable
                 |
        COMMIT PostgreSQL17
                 |
        réserve autorité Stripe TEST
                 |
      POST fournisseur *SIMULÉ*
                 |
      intent lié à l'ordre PG
                 |
       webhook HMAC raw signé
          8 rejouements
                 |
        1 événement INBOX
      (ne marque JAMAIS paid)
                 |
   vérification indépendante via GET fake
      account, PI et charge exacts
                 |
  8 réconciliations simultanées, 2 pools
                 |
  1 capture vérifiée / état PAID
                 |
  TRIGGER après insertion du reçu
                 |
  1 événement OUTBOX dans le même COMMIT
                 |
  Merchant ready / Courier offered-accepted
                 |
  remboursement confirmé par GET fake
                 |
  verrou financier PG de la migration 008
                 |
  1 HOLD + 1 événement OUTBOX atomiques
                 |
    retour Client financial_hold,
    Courier pickup et Dispatch interdits
```

La migration 018 ne remplace ni les migrations QA 001–008, ni les modèles financiers existants. Elle ajoute une table append-only `da_qa_financial_outbox_018` à données minimales : UUID de commande, UUID d'autorité, type, identifiant de capture ou de blocage, date d'inscription et mode TEST. Aucun corps webhook, secret, nom, e-mail, téléphone, solde ou client secret n'y figure.

**Atomicité effective** : triggers `AFTER INSERT` sur le reçu financier capturé et sur les holds. Ils s'exécutent dans la même transaction PostgreSQL que la modification source. Si la transaction n'est pas commitée, l'événement outbox n'est pas visible ni durable. Les écritures répétées ne créent pas de second événement pour la même source. Les enregistrements sont immuables et une fonction bornée, accessible par un rôle QA lecteur distinct, permet l'inspection.

## Matrice adversariale attendue / preuves

- Commande et snapshot SQL avant tout POST fournisseur simulé.
- Un webhook signé invalide refusé ; **8 événements simultanés de même ID** conduisent à une seule entrée persistante ; corps modifié sous le même ID rejeté.
- Un événement inbox signé ne constitue pas un reçu de capture et n'autorise pas Merchant/Courier.
- Fournisseur factice encore en attente : pas de paiement validé, pas d'outbox.
- Account, charge et PaymentIntent vérifiés sur la même commande : un seul commit `paid` face à **8 appels concurrents**, un seul reçu et un seul événement outbox `payment_captured`.
- Merchant/Courier deviennent éligibles seulement après capture vérifiée.
- Un remboursement tardif entraîne une seule ligne hold et une seule ligne outbox `financial_hold`, même après rejeu ; le Client perd l'éligibilité Dispatch, et Courier ne peut plus faire `picked_up`.
- Rôle applicatif Client sans EXECUTE outbox, lecteur outbox sans SELECT direct ; limites de lecture contrôlées ; UPDATE/DELETE interdits.
- Rollback SQL d'un hold sans COMMIT : hold et événement outbox doivent disparaître **ensemble** et les transitions restent éligibles jusqu'à la véritable inscription du remboursement.
- Aucun paiement, capture ou remboursement réel ; aucun envoi réseau fournisseur ni service de diffusion externe.

## Verdict et limites de promotion

Ce test complète le parcours HTTP signé synthétique de la PR #50, mais ne l'importe pas dans une API publique et ne prouve pas Keycloak en production. La signature webhook et l'interrogation du fournisseur sont exercées avec **secret et réponses simulés**. La chaîne testée ne déclenche ni débit, ni règlement, ni payout.

L'**outbox 018 est un journal transactionnel, pas encore une infrastructure de livraison** : aucun worker avec lease/ACK, Dead Letter Queue, retries ou delivery externe n'est implémenté. On ne doit donc ni annoncer des notifications fiables en production ni exposer sa fonction SQL comme endpoint public. Les vraies livraisons doivent encore être homologuées, ainsi que la restauration PostgreSQL et la finalité d'une session Stripe TEST officielle.

Le rôle Merchant/Courier et leurs appartenances sont des fixtures QA des adaptateurs certifiés ; il reste à valider l'intégration complète avec les providers OIDC et registres de membership/roster authentiques sous un SHA release unique.

**NO-GO impératif :** pas de merge, migration persistante, déploiement, changement IAM, Stripe LIVE, payout, soumission Store, OTA, ou build payant. La PR #48 fail-closed reste distincte et non déployable seule.

**Prochaine décision:** QA de livraison outbox et recovery, puis rapprochement App Store Connect / EAS / SHA des trois apps ; plan de passage en production seulement après approbation explicite et certificats complets.

## Correctif QA 019 — rejeu webhook identique après capture

Au cours de l'audit complémentaire, une condition de reprise a été identifiée dans la migration QA 003 : sa fonction inbox exigeait `state='intent_created'` avant toute déduplication. Dès la capture vérifiée, l'autorité devient `succeeded` ; une rediffusion pourtant authentique et strictement identique de l'événement initial échouait. Ce comportement ne modifiait pas les comptes, mais perturbait les acquittements tardifs et risquait de générer des retries inutiles.

Le **fichier complet de migration QA 019**, `services/api-nest/migrations/client-commerce/20261014_019_webhook_postcapture_exact_replay_qa_only.sql`, remplace chirurgicalement une seule fonction PostgreSQL de la migration 003, sous les mêmes privilèges et le même schéma. L'inbox cherche d'abord l'événement déjà conservé ; il n'est acquitté que si l'autorité, le PaymentIntent, le type d'événement et le SHA-256 du corps sont strictement identiques et si le mode reste TEST. **Aucune nouvelle entrée, aucun statut financier ni aucun droit SQL supplémentaire** n'est accordé à ce chemin de rejeu.

Un **nouvel événement non connu** reste soumis à la règle initiale : autorité `intent_created` obligatoire. Après `succeeded`, tout événement nouvellement identifié est refusé, même avec une signature correcte. Les collisions d'un même ID avec un autre corps, les signatures invalides et les paiements LIVE restent refusés.

Les assertions ajoutées au test E2E QA vérifient : huit rejeux authentifiés après capture → huit accusés duplicate, **zéro nouvel événement** ; nouveau ID signé après capture → refus ; même ID avec corps modifié → refus ; rejeu identique après remboursement → aucune réactivation de Dispatch, un seul reçu/hold/outbox. La CI doit appliquer la 019 **après** les migrations 001–008 et 018, uniquement dans PostgreSQL 17 éphémère sans réseau. **Ne pas appliquer cette migration sur le VPS**.

La première série de CI sur SHA `75e32567597135e596e43751999e346029503190` était PASS avant ce nouveau cas limite. Les CI antérieures en échec sur les assertions rollback sont conservées comme preuve de détection, puis corrigées sans réattribuer des privilèges. **La promotion de la 019 dépend d'une nouvelle CI SUCCESS du SHA final contenant code, migration, test et documentation ; aucun certificat sur un SHA antérieur ne s'y substitue.**

**Frontière toujours NO-GO :** Stripe réel, livraison outbox par un worker, contrats d'ACK/lease/dead-letter, production Keycloak, migration persistante, paiement LIVE, payout, merge, App Store.
