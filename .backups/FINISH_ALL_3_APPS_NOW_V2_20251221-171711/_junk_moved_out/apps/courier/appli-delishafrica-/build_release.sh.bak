#!/bin/bash


### ========================
### Script EAS Release Full
### ========================
### Objectif : Verrouille + build iOS + Android
### 1. Prépare le projet Expo (credentials, eas.json, patchs)
### 2. Injecte les credentials EAS (via .easrc ou variables)
### 3. Build les apps et récupère les liens
### ========================


set -e # stop on error


### CONFIGURATION GLOBALE
ORG_SLUG="delishafrica"
APP_SLUG="appli-delishafrica"
OWNER="purpleorchidgroup"
PLATFORM="all" # ios | android | all


### Variables Apple API KEY (Stockées si possible dans ~/.easrc ou comme variables d'environnement)
# Expo recommande de stocker ces infos dans ~/.easrc (format JSON) ou via ci-dessous
EXPO_APPLE_APP_SPECIFIC_PASSWORD="your-app-specific-password"
EXPO_APPLE_ID="raoul643@gmail.com"
EXPO_IOS_DIST_P12_PASSWORD="your-p12-password-if-needed"
EXPO_APPLE_TEAM_ID="TEAM_ID_HERE" # facultatif si lié


export EXPO_APPLE_APP_SPECIFIC_PASSWORD
export EXPO_APPLE_ID
export EXPO_APPLE_TEAM_ID


### ACCÈS AU RÉPERTOIRE
cd /opt/delishafrica/monorepo/apps/courier || exit 1


### Patch rapide app.json pour setter les bons identifiants Expo automatiquement
node -e '
const fs=require("fs");
const p="app.json";
const j=JSON.parse(fs.readFileSync(p));
j.expo.owner="'$OWNER'";
j.expo.slug="'$APP_SLUG'";
j.expo.name="DelishAfrica Courier";
fs.writeFileSync(p, JSON.stringify(j,null,2));
console.log("[i] app.json patché")'


### Génère eas.json minimal (build internal)
cat > eas.json <<'JSON'
{
"cli": { "version": ">= 9.0.0" },
"build": {
"development": { "developmentClient": true, "distribution": "internal", "ios": { "simulator": false } },
"production": { "ios": { "simulator": false } }
},
"submit": { "production": {} }
}
JSON


### Authentification silencieuse (ou assurez-vous d'être log via `npx expo login`)
echo "[i] Authentification Apple"
mkdir -p ~/.eas
cat > ~/.eas/eas.json <<JSON
{
"appleId": "$EXPO_APPLE_ID",
"appleAppSpecificPassword": "$EXPO_APPLE_APP_SPECIFIC_PASSWORD"
}
JSON


### Build EAS + Submit (App Store / Play Store si configuré)


echo "[i] Lancement du build"
npx eas build --platform $PLATFORM --profile production --non-interactive --auto-submit


### Récup lien build si besoin
# npx eas build:inspect --platform ios --latest
# npx eas build:download --platform ios --latest


### Fin
