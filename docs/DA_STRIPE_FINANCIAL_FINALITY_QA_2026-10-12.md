# DELISHAFRICA — STRIPE FINANCIAL FINALITY / SIGNATURE QA

**Dernière validation : 12 octobre 2026**  
**Branche : `feat/client-enrollment-secure-20261011` — PR #35 DRAFT**  
**Code certifié : `ebcc2339daf8a9d7cf0fd18fcd0777a1d1a1fe91` — quatre pipelines SUCCESS.**

## Périmètre vérifié

Le test `services/api-nest/test/payments-stripe-financial-finality.qa.test.cjs` importe **le véritable `PaymentsService`** de `services/api-nest/src/payments/payments.service.ts`, dans un environnement GitHub Actions strictement fictif. Une interception `global.fetch` contrôle en mémoire toutes les réponses Stripe, en interdisant toute requête extérieure. Identifiants de test fictifs `sk_test_QA_STRICTLY_FAKE_DO_NOT_USE` et `whsec_QA_STRICTLY_FAKE_DO_NOT_USE`, environnement `QA_SYNTHETIC_ONLY=YES`, aucune transaction Stripe TEST réelle, aucun serveur de paiement contacté. Toute donnée personnelle et tout identifiant d'origine sont synthétiques. Stockage runtime du test en `tmp` supprimé après exécution.

Preuve : [GitHub Actions Client Enrollment #38284898285](https://github.com/adminluxe/DelishAfrica/actions/runs/38284898285) **SUCCESS**. Les trois autres pipelines du même SHA sont également **SUCCESS** : [Keycloak/Nest/PG #38284898276](https://github.com/adminluxe/DelishAfrica/actions/runs/38284898276), [Commerce PG/ACL #38284898306](https://github.com/adminluxe/DelishAfrica/actions/runs/38284898306), [Admission PG #38284898266](https://github.com/adminluxe/DelishAfrica/actions/runs/38284898266).

## Défaut détecté puis corrigé avant certification

Le tout premier test financier a correctement **FAIL** ([CI #38284722774](https://github.com/adminluxe/DelishAfrica/actions/runs/38284722774)) sur `foreign_charge` : une réponse Stripe **simulée** fournissait une `latest_charge` dont `payment_intent` n'était pas le `paymentIntentId` demandé. Le code acceptait l'objet charge sans comparer explicitement cette relation. Stripe réel devrait normalement fournir une charge correspondant à l'intention récupérée, mais le contrôle explicite constitue une défense supplémentaire importante. Dans ce même passage TDD, le scénario `livemode=true` avec une clé `sk_test_` aurait également dû être refusé.

**Correction du fichier complet** `services/api-nest/src/payments/payments.service.ts` sur la PR DRAFT : lors de `verifyPaidOrder`, vérifier explicitement que `json.id === paymentIntentId`, que `json.livemode` est un booléen et correspond au préfixe de la clé serveur `sk_test_` ou `sk_live_`, puis que la Charge expansée indique le même `payment_intent` et le même `livemode` s'il est disponible. Les échecs sont rejetés avec des codes neutres `payment_provider_identity_or_mode_mismatch` ou `payment_charge_intent_or_mode_mismatch`. Aucun secret ni charge complète retournés dans les exceptions.

## Batterie adversariale réellement validée

La CI verte vérifie **un scénario positif fictif**, puis **16 négatifs** sur la récupération par API Stripe *simulée* : autre Client, issuer différent, devis modifié, mauvais orderId, autre identifiant de mutation, empreinte panier modifiée, montant différent, devise différente, statut `processing`, charge impayée, charge non capturée, montant capturé trop faible, remboursement partiel, litige, charge d'une autre intention et bascule TEST/LIVE incohérente. Chaque cas doit rejeter la prétendue preuve financière. Le scénario positif synthétique vérifie `financialFinality=charge_captured_unrefunded_undisputed_v1`, propriétaire, montant, devise et identifiant de Charge.

La CI vérifie aussi le flux `handleStripeWebhook` du même service avec une signature HMAC `Stripe-Signature` **calculée localement sur le corps brut**, sans appel Stripe : signature valide pour un événement sans autorité locale ne crée ni paiement payé ni enregistrement d'autorité ; une signature modifiée ou hors tolérance temporelle est rejetée. Le corps JSON supposé déjà analysé n'est pas accepté comme source de preuve à la place des octets bruts authentifiés.

Marqueurs consultables dans [les logs CI #38284898285](https://github.com/adminluxe/DelishAfrica/actions/runs/38284898285) : `QA_STRIPE_API_RETRIEVAL_SYNTHETIC_POSITIVE=PASS`, les seize `QA_STRIPE_FINANCIAL_DENIAL_*=PASS`, `QA_STRIPE_SIGNED_WEBHOOK_ALONE_NOT_A_PAID_ORDER=PASS`, `QA_STRIPE_INVALID_OR_EXPIRED_WEBHOOK_SIGNATURE=REJECTED`, `QA_STRIPE_PROVIDER_NETWORK=ZERO_STUBBED_RETRIEVAL_ONLY`, `QA_STRIPE_LIVE_KEYS_OR_PAYMENT=NEVER_USED`.

## Limites et GO / NO-GO

**PASS pour la validation logique du véritable PaymentsService contre des fixtures adversariales sans réseau ; NO-GO pour tout Stripe TEST réel ou LIVE**. Le test ne prouve pas un webhook reçu réellement de Stripe, les clés webhooks de notre compte, la propagation, le mode déconnecté du PSP, le remboursement réel ou un litige partenaire. La correspondance de réponse d'un stub ne garantit pas que Stripe répondra de façon identique dans tous les cas API.

L'autorité durable cible reste PostgreSQL et ne doit pas accepter une valeur `provider_verified` fournie par le mobile ou par le rôle applicatif. Il faut raccorder **une attestation Stripe TEST indépendante**, la persistance atomique des effets du webhook sous rôle spécifique minimal et un mécanisme de réconciliation en cas de succès provider suivi d'un échec SQL. Les anciens fichiers `orders.demo.store.ts` / `.runtime/payment-authority-store.json` sont encore les stockages commerciaux de l'application existante, donc multi-instance non certifié. Les vraies routes `/payments/create-intent`, `/orders/create`, le catalogue vivant, l'identité Client native dans l'API live, Merchant/Courier, SMS réel et iOS/Android doivent encore passer les validations complètes.

**Aucune fusion PR, migration VPS, changement du realm `afritaste`, clé LIVE, build EAS ni soumission Store.**
