# Correction & Supersession Model V0.1

## But

Corriger une erreur de paie sans effacer l'histoire et sans introduire de débit opaque.

## Règle

Un fait n'est jamais UPDATE/DELETE.

Correction:
`original fact → corrected fact (supersedes original)`

Le statement conserve les deux faits mais ne compte que le fait terminal effectif.

## Métadonnées obligatoires

- `supersedesFactId`
- `reasonCode`
- `reason`
- `approvedAt`
- `approvedBy`
- `evidenceRefs[]`

## Contrôles

Rejet si:
- cible absente;
- auto-supersession;
- scope coursier/semaine/policy/pays différent;
- kind ou catégorie différent;
- devise différente pour MONEY;
- approbation antérieure au fait corrigé ou postérieure au fait correctif;
- deux corrections concurrentes ciblent le même fait;
- preuves absentes;
- cycle de correction.

## Doctrine

Une correction n'est pas un droit à créer une retenue négative arbitraire.

Le modèle actuel remplace une valeur déclarée par une nouvelle valeur auditée. Les futures reprises/déductions légalement autorisées devront faire l'objet d'un modèle séparé, explicite, plafonné et validé juridiquement avant production.
