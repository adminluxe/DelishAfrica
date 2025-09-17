# DelishAfrica — Plan d’exécution 30/60/90, Backlog MVP, Proto UX & Conformité (Sept. 2025)

## Objectifs généraux

Cible de lancement : Bruxelles & périphérie (Belgique).

Stratégie : cuisine africaine & diasporas + épiceries & artisans + packs événements.

Pile : React Native (Expo) / Node + NestJS + Postgres (DigitalOcean Managed) + Prisma + Redis / Stripe (Bancontact) / Google Maps / WebSockets.

---

## Sommaire

1. Roadmap 30/60/90 (objectif, jalons, livrables, critères de sortie)
2. Backlog MVP priorisé (RICE)
3. Chiffres d’acquisition & objectifs par phase
4. Budget coursiers & opérations (unit economics, staffing, SLA)
5. Scripts d’onboarding Marchands (playbook + emails + checklists)
6. Proto UX — 3 apps (Client, Marchand, Coursier)
7. Algorithme de dispatch “Chaleur & Intégrité” (spécification)
8. Pack juridique & conformité (UE/Belgique) + modèles de transparence
9. Prochaines actions (dès aujourd’hui)

---

## 1) Roadmap 30/60/90

### Objectifs macro

* **J+30 :** MVP interne cliquable + pilote restreint (≥ 15 restaurants, ≥ 100 testeurs) + app Coursier fonctionnelle en zone 1.
* **J+60 :** Bêta privée élargie (≥ 40 restaurants + 10 épiceries) ; ≥ 400 commandes/semaine ; ETA médian < 35 min ; NPS ≥ 60 ; lancement Delish+ (abonnement) limité.
* **J+90 :** Lancement public Bruxelles ; ≥ 800–1 000 commandes/semaine ; récurrence Semaine 2 ≥ 30 % ; panier moyen (AOV) 28–35 € ; conformité UE/BE activée (v1).

### Semaine 0 (pré‑vol)

* Kickoff produit/tech/ops/juridique, organisation Notion/Jira, naming des environnements, accès DO/Stripe/Maps.
* Atelier “signature d’expérience” (découverte éditoriale + paniers hybrides + packs).
* Recrutement express : 1 PM, 1 Lead Mobile, 2 Full‑stack, 1 Designer, 1 Ops city lead.

### Phase 1 (J+1 → J+30) : fondations & pilote

**Livrables clés**

* **Mobile Client v0.9 :** onboarding, recherche, fiche restaurant/produit, panier hybride, checkout (Stripe + Bancontact), suivi commande, notes/avis, profil.
* **Merchant v0.9 (web mobile‑first)** : prises de commandes, préparation, statut, chat client, modifications rapides de menu.
* **Courier v0.8 (mobile)** : disponibilité, acceptation mission, navigation, preuve de remise (photo/signature).
* **Backend v1 :** authentification JWT, catalogue, pricing, commandes, paiements, dispatch v1, notifications (Expo), WebSockets (tracking + chat), observabilité (Sentry/PostHog).
* **Ops :** cartographie zones (Z1 : centre/Matonge/Etterbeek/Ixelles), partenaires packaging, formation “SLA chaleur”.
* **Conformité v1 :** mentions légales, CGU/CGV, politique de confidentialité (GDPR), registre des traitements, base transparence algorithme (texte v1).

**Critères de sortie**

* ≥ 15 restaurants actifs.
* ≥ 100 testeurs.
* Taux de réussite paiement ≥ 97 %.
* Crash rate < 1 %.
* ETA médian < 40 min.

### Phase 2 (J+31 → J+60) : bêta élargie & Delish+

**Livrables clés**

* **Client v1.2 :** abonnements Delish+ (frais réduits), packs communauté/événements, recommandations IA (piquant/accompagnements), programmes de parrainage.
* **Merchant v1.1 :** édition avancée de menus (options/variantes), calendrier, anomalies/ruptures, analytics simples.
* **Courier v1.0 :** heatmap zones, bonus créneaux, check packaging guidé, multi‑pick sécurisé (batch limité).
* **Dispatch v1.2 “Chaleur & Intégrité” :** pondérations par typologie de plat + contenant, anti‑batch pour ragoûts, logique pluie/pic.
* **Ops :** 40 restaurants + 10 épiceries/artisans ; 80–100 coursiers validés ; support 7 jours.
* **Marketing :** création “Histoires des plats”, partenariats communauté ; tracking acquisition complet.

**Critères de sortie**

* ≥ 400 commandes/semaine.
* ETA médian < 35 min.
* Note moyenne ≥ 4,6/5.
* Panier moyen ≥ 28 €.
* Réachat semaine 2 ≥ 30 %.

### Phase 3 (J+61 → J+90) : ouverture publique Bruxelles

**Livrables clés**

* **Client v1.4 :** filtres nutrition/culture, pack entreprise (Office Lunch Sharing), expérimentation pub transparente (sponsored labellisés).
* **Merchant v1.3 :** promos, codes, stock en temps réel, tickets cuisine, SLA analytics.
* **Courier v1.2 :** navigation améliorée, anti‑fraude GPS, indicateurs de revenus.
* **Conformité v2 :** transparence algorithme enrichie (explicabilité dispatch/ranking), tableau de bord travailleurs (données perso, décisions automatiques, voies de recours).

**Critères de sortie**

* ≥ 800–1 000 commandes/semaine.
* ETA médian < 32 min.
* NPS ≥ 60.
* Rétention M1 ≥ 35 %.
* Incidents packaging < 1 %.

---

## 2) Backlog MVP priorisé (RICE)

Barème : Reach (R), Impact (I), Confidence (C), Effort (E, en points). Score = (R × I × C) / E.

### A. Cœur Client

* **Checkout Stripe + Bancontact** (R8 I8 C0.9 E6) → Score 9.6
* **Suivi temps réel (ETA/carte)** (R8 I8 C0.8 E8) → 6.4
* **Panier hybride (resto+épicerie)** (R7 I9 C0.7 E10) → 4.4
* **Fiche plat éditorialisée (story, origines)** (R7 I7 C0.8 E6) → 6.5
* **Notes/avis + photos** (R7 I6 C0.8 E5) → 6.7
* **Abonnement Delish+** (R6 I8 C0.7 E8) → 4.2

### B. Marchand

7. **Flux commande → préparation → prêt** (R7 I9 C0.9 E6) → 9.5  
8. **Chat client (Live Order)** (R6 I8 C0.8 E6) → 6.4  
9. **Menu & options** (R7 I8 C0.8 E8) → 5.6  
10. **Ruptures/indisponibilités** (R6 I7 C0.8 E5) → 6.7  

### C. Coursier

11. **Go‑online/acceptation/naviguation** (R7 I9 C0.9 E7) → 8.1  
12. **Preuve de remise (photo/signature)** (R7 I7 C0.9 E4) → 11.0  
13. **Multi‑pick sécurisé** (R6 I7 C0.7 E8) → 3.7  

### D. Growth & Fidélité

14. **Parrainage** (R6 I6 C0.8 E4) → 7.2  
15. **Push/Email lifecycle** (R6 I5 C0.8 E4) → 6.0  

### E. Observabilité & Conformité

16. **Sentry/PostHog** (R8 I7 C0.9 E3) → 16.8  
17. **Journalisation des décisions algorithmiques** (R6 I8 C0.8 E5) → 7.7  

Capacité MVP = items 1–12 + 16–17. Les autres passeront en Phase 2.

---

## 3) Chiffres d’acquisition & objectifs

### Embarquement testeurs (J+1 → J+30)

* 1 000 inscriptions, 300 activations, 150 premiers achats (conversion 15 %).
* Coût d’acquisition (CPA) cible ≤ 8 € (publicité + influence + partenariats communauté).

### Bêta élargie (J+31 → J+60)

* 3 000 inscriptions, 1 000 activations, ≥ 800 acheteurs ; ≥ 400 commandes/semaine.
* Panier moyen 28–35 € ; Delish+ early adopters : 300–500.

### Lancement (J+61 → J+90)

* 8 000 inscriptions, 3 000 acheteurs, ≥ 1 000 commandes/semaine.
* Rétention semaine 2 ≥ 30 % ; semaine 4 ≥ 25 % ; churn < 8 %/semaine.

### Canaux & leviers

* Partenariats diaspora/associations/événementiel.
* Contenus “origines des plats” (vidéos courtes).
* Offres entreprises (office lunch).
* Parrainage : 8 € donneur / 8 € filleul.
* Cashback pick‑up (réduit commission marchands, améliore la marge).

---

## 4) Budget coursiers & opérations (v1 Bruxelles)

### Hypothèses

* Zones Z1–Z2 ; amplitude 10 :30–14 :30 / 17 :30–22 :30 ; panier moyen 31 € ; 1,6 commande/heure en moyenne.
* Modèle de rémunération hybride : base/mission + km + bonus pic/pluie + pourboires 100 % coursier.

### Grille de rémunération v1 (indicative)

* Base prise en charge : 3,00 €.
* Variable distance : 1,10 €/km (point‑à‑point resto→client).
* Bonus pic/pluie : +2,00–4,00 € par course.
* Contre‑productivité batch : cap à 2 commandes max, uniquement si score chaleur ≥ seuil.

### Coût livraison moyen (Z1)

* Distance médiane 2,8 km → 3,00 € + 3,08 € = 6,08 € (+ bonus selon conditions).
* Objectif coût/logistique ≤ 7,20 € par commande (incluant assurance, app, support).

### Staffing

* **J+30 :** 40–60 coursiers actifs/semaine ; 1 dispatcher ; 1 support.
* **J+60 :** 80–100 coursiers ; 2 dispatchers ; 2 support.
* **J+90 :** 120–150 coursiers ; 3 dispatchers ; 3 support.

### SLA & qualité

* ETA médian < 35 min.
* Delta‑chaleur (température à réception) mesuré sur échantillon.
* Incidents packaging < 1 %.
* Taux d’acceptation ≥ 88 %.

### Unit economics (ordre de grandeur)

* **Revenu :** commission 18 % + frais service 1,20 € + frais livraison (abonné vs non abonné).
* **Coûts directs :** paiement coursier (≈ 6–7 €), support, paiement, cartographie, assurance.
* **Cible :** marge contribution ≥ +1,0–1,5 € / commande à maturité Z1 (hors marketing fixe).

---

## 5) Scripts d’onboarding Marchands

### Playbook (J+1 → J+30)

1. **Sourcing (liste courte)**  
2. **RDV 30’** (démo + promesse différenciante)  
3. **Stripe Connect (KYC/IBAN)**  
4. **Menu & photos (guides)**  
5. **Test commande fantôme**  
6. **Go‑live**  

### Checklist contrat & data

* KYC (dirigeant), IBAN, extrait BCE.
* Attestations allergènes/traçabilité.
* Horaires, zones, SLA préparation.
* Nomenclature plats/options.
* Prix & taxes.
* Logo/photos HD.

### Script appel (20–30 min)

1. **Introduction (2’) :** description de DelishAfrica et promesse (curation, panier hybride, packs).  
2. **Démo (8’) :** fiche plat éditorialisée, panier hybride, chat commande, analytics simples.  
3. **Économie (5’) :** commission, cashback pick‑up, Delish+ (flux incrémental).  
4. **Ops (5’) :** packaging chaleur, plages de préparation, pics midi/soir, calendrier.  
5. **Prochaines étapes (5’) :** Stripe Connect, intégration menu, séance photo, test.  

### Emails types

**#1 Invitation :** RDV + USP (curation, panier hybride, packs).  
**#2 Onboarding :** lien Stripe Connect, gabarit CSV menu (ou import), guide photos, SLA.  
**#3 Go‑live :** assets réseaux + code promo lancement, calendrier push.  

### Qualité menu & médias

* Gabarit CSV (nom, catégorie, variantes/options, allergènes, prix, photos).
* Guide photo (lumière chaude, angle 45°, contenant étanche, couvercle transparent).
* Story courte (origine du plat, niveau de piquant, accompagnements recommandés).

---

## 6) Proto UX — 3 apps

Des spécifications filaires pour trois applications distinctes : client, marchand, coursier. L’approche se veut élégante, minimaliste et colorée.

### A. App Client (React Native)

* **Onboarding :** langue (FR/EN), adresse, préférences (piquant/halal/allergènes).
* **Accueil :** carrousel éditorial (“Origines du mafé”, “Bissap artisanal”), accès rapide aux packs & épiceries.
* **Recherche/Filtre :** par région (Ouest, Maghreb, Corne…), plats, niveau de piquant, halal/veg, délais.
* **Fiche Resto/Plat :** photos, story, options (igname/riz, sauces), recommandations IA, labels allergènes.
* **Panier hybride :** lignes resto + lignes épicerie ; créneaux ; frais & promos ; estimation ETA.
* **Checkout :** Stripe Payment Element (Bancontact, cartes, Apple/Google Pay).
* **Suivi :** carte en temps réel, étapes (accepté, en préparation, en route, livré), chat marchand, support.
* **Profil :** Delish+, moyens de paiement, adresses, commandes, préférences, RGPD (export/suppression).

*Critères d’acceptation (exemples) :* paiement autorisé en < 4 s ; taux réussite ≥ 97 % ; 0 crash bloquant ; latence carte < 200 ms ; accessibilité AA ; offline basique.

### B. App Marchand (web PWA/mobile‑first)

* File d’attente des commandes (nouvelle/en cours/prête/livrée/incident).
* Mise à jour du statut + temps de préparation estimé.
* Chat client (modèles rapides : rupture, alternative, retard).
* Menu : catégories, options, prix, stock, ruptures, horaires.
* Analytics : top plats, pics horaires, délais, notes, SLA.

*Critères d’acceptation :* temps de prise en main < 15 min ; erreur de statut < 1 % ; synchronisation des ruptures en < 15 s.

### C. App Coursier (React Native)

* Go‑online : disponibilité, zone, véhicule, batterie.
* Mission : adresse de pickup/drop, distance, score chaleur du plat, rémunération estimée, bouton accepter/refuser.
* Navigation : ouverture Maps, étapes pickup (photo sac fermé), dropoff (photo/signature), pourboire.
* Revenus : missions, km, bonus, heatmap zones actives, planning.

*Critères d’acceptation :* acceptation > 88 % ; “preuve de remise” < 10 s ; fraude GPS détectée ; crash < 1 %.

---

## 7) Algorithme de dispatch “Chaleur & Intégrité” — Spécification

### Objectif

Minimiser la perte de chaleur/qualité et les retards, tout en respectant l’équité coursiers et la rentabilité.

### Entrées (features)

* **Plat/commande :** typologie (ragoût/sauce/plat frit/froid), sensibilité chaleur (0–1), besoin d’étanchéité, délai de préparation, fenêtre de livraison, priorité.
* **Packaging :** score étanchéité (0–1), isolation (0–1), volume, interdiction de batch.
* **Géospatial :** distances resto→client, coursier→resto, trafic/pluie, étages, ascenseur.
* **Coursier :** position, contenance sac, historique fiabilité, vitesse estimée, mode (vélo/scooter), charge batterie.
* **Système :** temps réel vs pré‑commande, SLA, capacité zone, pics.

### Score de coût (à minimiser)

```
Cost =  w1 × ETA_total
     +  w2 × (1 − HeatRetentionScore)
     +  w3 × SpillRisk
     +  w4 × BatchPenalty
     +  w5 × FairnessPenalty

ETA_total            = t(coursier→resto) + t(attente) + t(resto→client)
HeatRetentionScore   = f(type_plat, isolation, météo, distance) ∈ [0,1]
SpillRisk            élevé si sauces + faible étanchéité + pavés/pluie
BatchPenalty         > 0 si ajout d’une 2e commande et (HeatRetentionScore < seuil ou SpillRisk > seuil)
FairnessPenalty      équilibre revenu/heure & distance vs moyenne rolling (anti‑biais)
```

Pondérations v1 (indicatives) : **w1 = 0,40** ; **w2 = 0,30** ; **w3 = 0,15** ; **w4 = 0,10** ; **w5 = 0,05**.  
Seuils : batch interdit si HeatRetentionScore < 0,55 ou SpillRisk > 0,6.

### Pseudocode (assignation)

```
for order in incoming_orders:
  candidates = nearby_couriers(radius=R, capacity_ok=True)
  best = argmin_{c ∈ candidates} Cost(order, c)
  assign(order, best)
  log_explanation(order, best)
```

### Explicabilité (logging)

* Pourquoi ce coursier ? ETA + score chaleur + distance + batch (oui/non) + équité.
* Traces exportables (RGPD) + modèles de texte (voir Pack juridique).

### Évaluation & simulation

* Jeu de données synthétique (500–1 000 commandes) avec mix ragoûts/frits/froids, météo, trafic.
* Métriques : ETA, température estimée à l’arrivée, taux d’incidents, revenus coursiers, coût/logistique, satisfaction.
* A/B : v1 (ETA‑only) vs v1.2 (chaleur).

---

## 8) Pack juridique & conformité (UE/BE) + modèles de transparence

### Avertissement

Ce plan ne constitue pas un conseil juridique ; il s’agit d’un canevas opérationnel à faire valider par un conseil local.

### A. Obligations clés (UE)

* **Plateformes de travail :** présomption d’emploi (selon critères nationaux), transparence des algorithmes (décisions automatiques, supervision humaine, voies de recours), transposition d’ici fin 2026.
* **DSA (marketplace)** : signalement de contenu illicite, notices claires, transparence du ranking et des contenus sponsorisés, point de contact, conservation des rapports, modération.
* **GDPR :** minimisation, base légale, DPIA (suivi localisation & profilage), droits (accès/export/effacement), registres, délais de conservation.

### B. Belgique (v1)

* **Présomption de salariat spécifique plateformes (8 critères)** — renversement possible ; assurance accidents de travail ; transparence tarifs.
* **Informations claires aux coursiers :** mode de rémunération, algorithmes utilisés (affectation/évaluation), supervision humaine, recours.
* **Contrats marchands & CGV :** responsabilités aliments/allergènes, TVA, étiquetage prix, droit de rétractation (exceptions denrées périssables).

### C. Modèles “transparence algorithme”

#### C.1 Classement restaurants/produits

> « Par défaut, nous classons par pertinence (distance, délai estimé, fiabilité, qualité mesurée par notes & taux de retour).  
> Les contenus sponsorisés sont toujours signalés par l’étiquette *Sponsorisé* et n’affectent pas les notes. »

#### C.2 Affectation d’une course

> « Votre commande a été confiée au coursier **{{prenom}}** principalement en raison d’un temps d’arrivée estimé plus court et d’un score de préservation de chaleur plus élevé (type de plat & contenant). Les décisions sont surveillées par des opérateurs humains. Vous pouvez contester via **{{lien_recours}}**. »

#### C.3 Profilage & recommandations

> « Nous personnalisons l’app (niveau de piquant, plats régionaux, halal/veg) à partir de vos préférences. Vous pouvez désactiver la personnalisation à tout moment et continuer à utiliser DelishAfrica. »

### D. Checklists & artefacts

* DPIA (suivi GPS, profilage) — modèle de risque & mesures.
* Politique cookies (SDKs mobiles, analytics).
* Registre des traitements.
* Politique de conservation.
* Règles d’annulation/remboursement (préparation entamée, retard > x min, commande erronée).
* Procédure de réclamation (24–48 h) — canal prioritaire.

---

## 9) Prochaines actions (dès aujourd’hui)

* Cloner le repo mono (apps + backend) & configurer DO/Stripe/Maps.
* Épingler le Backlog MVP (items 1–12, 16–17) dans Jira — sprints S1–S3.
* Lancer sourcing marchands (top 15) + RDV photos & intégration menu.
* Recruter des coursiers noyau (30–40) + formation packaging chaleur.
* Démarrer implémentation dispatch v1 & journal d’explicabilité.
* Valider les textes de transparence & CGU/CGV/Privacy (v1) avec un conseil.

### Annexes (à venir)

* Gabarit CSV menu, gabarit DPIA, gabarit Politique confidentialité, templates e‑mails complets.
* Table des pondérations par typologie de plat & contenant (dispatch).