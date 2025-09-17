# Modèle de DPIA (Analyse d'impact relative à la protection des données)

Ce document est un gabarit pour réaliser une **analyse d'impact relative à la protection des données (Data Protection Impact Assessment)** pour la plateforme DelishAfrica. Il doit être adapté à votre contexte réel et complété avec les informations spécifiques au traitement des données que vous mettez en œuvre.

## 1. Description du projet et des traitements

### Objectifs du projet

Expliquez les objectifs de DelishAfrica, les services proposés et la manière dont les données personnelles sont nécessaires à la fourniture de ces services (commande en ligne, livraison, programmes de fidélité, personnalisation, etc.).

### Données collectées

Listez les catégories de données personnelles collectées pour chaque type d'utilisateur (clients, restaurateurs, livreurs), par exemple :

- Données d'identification (nom, adresse, e‑mail, numéro de téléphone)
- Données de paiement (token de carte, IBAN via Stripe Connect)
- Données de localisation (adresse de livraison, géolocalisation du livreur)
- Préférences culinaires et restrictions alimentaires
- Journaux de chat et historiques de commandes

### Finalités du traitement

Décrivez les finalités associées à chaque catégorie de données :

- Gestion des commandes et des paiements
- Gestion des programmes de fidélité et marketing
- Optimisation logistique et dispatch algorithmique
- Compliance légale et obligations fiscales

### Durée de conservation

Indiquez la durée de conservation prévue pour chaque type de données et les critères permettant de la déterminer (par exemple, durée de la relation commerciale + obligations légales).

## 2. Analyse des risques

### Sources de risques

Identifiez les menaces susceptibles de porter atteinte à la confidentialité, l'intégrité ou la disponibilité des données (accès non autorisé, brèche de sécurité, erreur humaine, etc.).

### Impacts potentiels

Évaluez les impacts pour les personnes concernées en cas de réalisation de ces risques (atteinte à la vie privée, usurpation d'identité, perte financière, etc.).

### Probabilité d'occurrence

Estimez la probabilité de survenue des risques identifiés en tenant compte des mesures de sécurité existantes.

## 3. Mesures de protection et d'atténuation

### Sécurité technique

Décrivez les mesures de sécurité mises en place : chiffrement des données en transit (HTTPS) et au repos, stockage sécurisé des clés API, minima de permissions, surveillance et alertes, etc.

### Gouvernance et organisation

Précisez le rôle et les responsabilités de chaque partie prenante (DPO, équipes tech, support, etc.), ainsi que les procédures internes de gestion des incidents.

### Garanties offertes par les sous‑traitants

Listez les sous‑traitants (ex. Stripe, fournisseurs d'hébergement) et résumez leurs engagements en matière de protection des données.

### Minimisation et transparence

Expliquez comment la plateforme collecte uniquement les données nécessaires et informe clairement les utilisateurs (politique de confidentialité, messages contextuels).

## 4. Consultation des parties prenantes

Indiquez comment les personnes concernées (livreurs, clients, restaurateurs) et les autorités (CNIL/EDPB) seront consultées pour avis, le cas échéant.

## 5. Conclusion

Précisez si le niveau de risque résiduel est acceptable au regard des mesures proposées. Si des risques élevés subsistent, envisagez des mesures supplémentaires ou une consultation préalable de l'autorité de contrôle.

---

*Ce modèle est fourni à titre indicatif. Il doit être personnalisé et complété en fonction des traitements spécifiques mis en œuvre par DelishAfrica.*