# Policy Ledger & Weekly Statement V0.2

## Policies

Belgique:
- ID: `BE-EMPLOYEE-POG-FAIR-PAY-LAB-v0.1`
- timezone: `Europe/Brussels`
- hash: `16ab15cf516395cef2f191a308b18062334b4d690384e36074a4a242449f39ec`
- DRAFT / production blocked.

France:
- ID: `FR-INDEPENDENT-ARPE-2026-09-01-v1`
- timezone: `Europe/Paris`
- hash: `4935d532709157d7bf8ff38969b1daabab039ea3926174f5392ba54857e7989b`
- LEGAL_REVIEW / production blocked.

Une règle modifiée exige un nouvel ID/version. Un changement sous le même ID est rejeté.

## Statement V0.2

Un statement est déterministe à partir:
- policy hash;
- faits source triés;
- faits effectifs après supersession;
- calcul;
- version du statement.

Il expose:
- `factIds` — historique complet;
- `effectiveFactIds` — faits réellement comptés;
- `supersededFactIds` — faits remplacés;
- `factCount`;
- `effectiveFactCount`;
- `factsHash`;
- `policyHash`;
- `statementId`.

Exemple Belgique:
- statement: `682f00912149af91171d036a07cbb5bf050ebc01bb704e2b9d01c76abda75ea7`
- facts hash: `5c7bd1b727c32c999520e2ee19b885f898072a80fa89e9560c7ee56924695cac`
- 90 min payées;
- 26,00 EUR revenu éligible;
- 28,50 EUR floor LAB;
- 2,50 EUR true-up;
- 5,00 EUR tips;
- 3,00 EUR frais;
- 36,50 EUR cash total.

## Corrections

Aucune correction ne modifie un fait historique.

Une correction:
1. crée un nouveau `factId`;
2. référence `supersedesFactId`;
3. conserve le même type/catégorie/scope/devise;
4. porte motif, reasonCode, approvedAt, approvedBy;
5. exige des preuves;
6. remplace l'ancien fait uniquement dans le calcul effectif.

Deux corrections concurrentes de la même cible sont rejetées.

## Persistence integrity

Les ledgers mémoire et fichier imposent:
- policy scellée avant tout enfant;
- pays cohérent avec la policy;
- statement policyHash exact;
- devise cohérente;
- ID immuable;
- replay identique idempotent;
- contenu différent sous même ID rejeté;
- doublon déjà persisté au redémarrage rejeté;
- hash falsifié rejeté.

Le statement reste `contestable: true`. La future production doit fournir support humain, correction tracée et état de règlement.
