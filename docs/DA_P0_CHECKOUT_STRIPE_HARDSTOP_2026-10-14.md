# DelishAfrica — P0 arrêt pré-paiement non durable (QA DRAFT)

**14 octobre 2026 — PASS du verrou QA synthétique / NO-GO de l'autorité financière réelle.**

## Sources et preuves exactes

- Parent : [DelishAfrica PR #46](https://github.com/adminluxe/DelishAfrica/pull/46), SHA 69f313d931153b2a937ec058fcc89eb155b7d260, DRAFT.
- Candidat : [DelishAfrica PR #48](https://github.com/adminluxe/DelishAfrica/pull/48), branche security/p0-checkout-stripe-failclosed-20261014, DRAFT.
- **SHA TESTÉ : 06b747def12ad8fd1b4770f496a5cc6e65c3d533.**
- [CI #38619080284](https://github.com/adminluxe/DelishAfrica/actions/runs/38619080284), job 116041604202, SUCCESS ; 6 tests PASS, 0 FAIL et TypeScript API + Client PASS.

## Défaut identifié sur le code QA, pas sur le binaire Store

Le service de commande (services/api-nest/src/orders/orders.demo.store.ts) utilise par défaut un fichier .runtime/orders-demo-store.json. Sa fonction safeWrite() absorbe des échecs disque, de sorte qu'une réponse « commande réussie » pourrait ne pas correspondre à une écriture durable. Le service payments.service.ts peut, dans le parent #46, créer un Stripe PaymentIntent AVANT la création et la confirmation durable de la commande. Le Client checkout-preflight.tsx lance le paiement avant de poster /orders/demo/create et enchaîne avec une relecture.

**Risque de paiement confirmé sans persistance fiable de commande ; aucun incident bancaire réel démontré.** La réconciliation existante ne remplace pas une réservation transactionnelle pré-paiement.

## Correctif conservatoire de la branche DRAFT, NON DÉPLOYÉ

- Premier appel de PaymentsService.createPaymentIntent() : assertDurableCheckoutAuthority(), qui lance une ServiceUnavailableException 503 avec code checkout_durable_order_authority_not_certified, paymentInitiated false et retryable false.
- Verrou constant sans flag de contournement. Refus même si la clé Stripe est absente, TEST ou LIVE. Refus avant recalcul de devis et avant toute requête bancaire.
- health() annonce checkoutIntentCreationEnabled false ; providers() renvoie status checkout_blocked et userVisible false.
- Le Client traduit le code en un message compréhensible : paiement temporairement indisponible, aucun nouveau débit initié, panier conservé.
- verifyPaidOrder() et handleStripeWebhook() n'ont pas été changées, pour ne pas supprimer les chemins de réconciliation déjà en place. Ce constat n'est pas une homologation de leurs flux complets.

## Assurance QA précise

Le banc a exécuté le vrai PaymentsService et sa méthode contrôleur, sans démarrer un serveur HTTP, en simulant uniquement l'injection de métadonnées du service de politique catalogue pour ne pas contacter PostgreSQL. Les trois cas synthétiques absence de clé / TEST / LIVE ont renvoyé 503 avec zéro appel au devis, zéro fetch et aucune modification du payload. Il a aussi vérifié l'ordre du garde-fou et le mapping d'erreur côté Client. **Six tests PASS** ; aucun secret réel, paiement réel ou fichier financier muté.

## NO-GO strict avant publication

Ce patch, s'il était promu seul, **suspendrait tous les nouveaux paiements**, y compris légitimes. Il n'est PAS déployable tel quel sans décision produit et implémentation d'une autorité de réservation PostgreSQL avec idempotence liée au propriétaire, panier, montants en unités mineures et devise ; transaction pré-paiement ; état de paiement corrélé au webhook, reconciliation, échec DB, timeout et refund ; isolation multi-instance et tests adversariaux sur Stripe TEST uniquement.

Le VPS canonique /opt/delishafrica/monorepo n'a pas été touché ; ne pas écraser les 15 fichiers locaux modifiés ni leur diff SHA-256 7b07d120f99adba3666547860b4f43b579e804e3de5a0983705762da3433b3c5. La parité AfriPay janvier 33/132/33 reste PASS précédemment certifié, non rejouée.

**VERDICT : STOP pré-paiement = PASS QA. Exploitation Stripe / commandes réelles / Store = NO-GO.**

## 14 octobre — second scellement P0 : parité exacte du correctif VPS, 9/9 tests PASS

Les sources du VPS ont été relues sans aucune écriture : HEAD e504c0434db43e6d15d041154176d23ee00c1347 ; **15 fichiers suivis modifiés, 0 staged, diff SHA-256 identique** 7b07d120f99adba3666547860b4f43b579e804e3de5a0983705762da3433b3c5 ; 13 conteneurs actifs. Le fichier `services/api-nest/src/orders/orders.demo.store.ts` fait partie des 15 modifications locales. Il rejette le JSON invalide et écrit via fichier temporaire mode 0600, `fsync` puis `rename` ; SHA-256 VPS d8d2179ccc96cd63d4edacd77a924cbbbb7762b5eae648ae75e2580305d1e396.

Cette modification a été copiée textuellement dans la PR DRAFT seulement : **blob Git identique** `06699469c4502a8eae7e91047a953da83b1017a2`. Le fichier original du VPS et les 14 autres modifications restent inchangés. Son `payments.service.ts` (SHA-256 fe11789620f8662c5f8cb2e390f125c64527ea49ba3b256c08a47b07e9b2fb00) ne contient pas le nouveau garde pré-paiement ; aucun runtime Node live n'a été certifié par cette lecture du source.

**CI exacte du correctif code/test SHA `9129a7d9c3bcbc1aa8938a6f0b8103c0d91fb94b` :** [GitHub Actions 38620518970](https://github.com/adminluxe/DelishAfrica/actions/runs/38620518970), job 116046668157, **SUCCESS**, TypeScript API + Client PASS, **9 tests / 9 PASS, 0 FAIL**. Trois nouveaux tests : écriture/relecture synthétique mode 0600 sans fichier temporaire résiduel, JSON corrompu rejeté, panne ENOSPC simulée sans retour de succès ni commande fantôme. Les six tests de refus Stripe TEST/LIVE/sans clé et zéro réseau restent PASS.

**Limites :** QA synthétique hors production. Une écriture fichier plus sûre ne crée pas une autorité transactionnelle de commande reliée à Stripe. Avant toute release : réservation PostgreSQL idempotente avant PSP, inbox/outbox, réconciliation et tests d'arrêt multi-instance. Le hardstop 503 reste DRAFT et, déployé seul, suspendrait les paiements légitimes. Aucun nouveau build, merge, paiement LIVE ou changement VPS.
