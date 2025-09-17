# DelishAfrica

DelishAfrica est une plateforme moderne de livraison dédiée aux cuisines africaines et diasporiques. L’objectif est de connecter des clients passionnés de gastronomie avec des restaurants curés, des épiceries et des artisans, tout en mettant l’accent sur les paniers hybrides et les packs évènementiels.

Ce dépôt rassemble la structure initiale du projet, des gabarits techniques et des documents de planification détaillée. Il constitue un point de départ pour la mise en place du monorepo DelishAfrica.

## Contenu du dépôt

* **`ROADMAP.md`** : document détaillé présentant la feuille de route 30/60/90 jours, le backlog MVP, les objectifs d’acquisition, les budgets opérationnels et la stratégie juridique/conformité.
* **`BACKLOG_MVP.md`** : priorisation des fonctionnalités du MVP selon la méthode RICE.
* **`templates/`** : dossiers contenant des modèles de documents (politique de confidentialité, DPIA, emails d’onboarding, gabarit CSV de menu, extraits de transparence algorithmique).
* **`src/controllers/`** : exemples de contrôleurs et de gateway NestJS pour le backend (import de menus, webhook Stripe, dispatch en temps réel).

## Technologies clés

Le projet s’appuie sur :

* **React Native (Expo)** pour les applications mobiles client et coursier.
* **NestJS / Node.js** pour le backend, avec **PostgreSQL** (DigitalOcean Managed) et **Prisma** pour la base de données.
* **Redis** pour la mise en cache et la gestion de files.
* **Stripe** (intégration Bancontact) pour les paiements.
* **Google Maps** et **WebSockets** pour la géolocalisation et la communication en temps réel.

## Démarrage

Ce dépôt est un squelette : clonez‑le, personnalisez les documents et ajoutez vos services. Reportez‑vous au fichier `ROADMAP.md` pour suivre les jalons de développement et organisez votre backlog à l’aide de `BACKLOG_MVP.md`.
