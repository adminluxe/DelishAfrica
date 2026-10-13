# DELISHAFRICA® — ARCHITECTURE PIN : legacy Client lecture seule
**Date : 13 octobre 2026. Référence préalable : `2ba9b74cc1e22d4ea3359313679a8dd5f9fc049b`. CANDIDAT QA, NON LIVE.**

```text
                     ROUTES NESTJS (CONTROLEURS REELS)
                                  |
                       AUTHORIZATION Bearer
                                  |
                      SIGNATURE / ISSUER PIN
                   ┌──────────────┴──────────────┐
                   |                             |
            AUTH LEGACY                    ISSUER NATIF CLIENT
         AuthService RS256             NativeClientCommerceIssuerBridge
         + Redis révocation           (GitHub Actions QA EXCLUSIVEMENT)
                   |                             |
             role=client                       RS256 signature
                   |                          email_verified
             LECTURE SEULE                 SMS sandbox + ledger
        Orders/list et Orders/get                |
            (owner issuer+sub)              Client admis
                   |                             |
          TOUTE ECRITURE 403               Routes commerce en QA
                   |
           Payments/create-intent 403
     (même si JWT Client ancien valide et non révoqué)

Merchant/Courier/Ops historiques : chemins, vérificateur JWKS et
autorisations d'origine CONSERVÉS, aucun passage par l'admission Client.
```

## Contrôle d'identité
- Le rôle et la provenance ne viennent **jamais** de headers `X-Role`,
  `X-User`, d'un identifiant JSON ou de la route ; uniquement du JWT signé
  vérifié et du résultat autoritatif d'admission.
- Le routage natif utilise un `iss` non authentifié **comme indice uniquement**.
  Une signature invalide, une autre clé du même kid, un mauvais issuer,
  une admission absente ou révoquée ne doit produire aucun effet métier.
- Un `OrdersAuthGuard` legacy appliqué au contrôleur entier
  continue de filtrer les opérations : **seuls `list` et `get` sont
  autorisés au Client non admis** ; `OrdersAccessService` limite ensuite
  les ressources consultables à leur propriétaire (issuer, subject).
- `PaymentsAuthGuard` n'admet aucun Client legacy pour un PaymentIntent.
- La politique prévue pour `client` natif reste sous `QA_SYNTHETIC_ONLY` :
  elle ne crée aucun droit production. Aucune mutation du module des gardes.

## Non équivalence
CI synthétique verte ≠ preuve d'un JWT réel iOS/Android, d'une base PG
de production, d'un SMS réel, du Stripe officiel, de la restauration
isolée ou de l'absence de contournements secondaires. Le classement
PRODUCTION reste soumis à ces gates et à la décision de mise en service.
