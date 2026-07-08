#!/bin/bash
set -e


### 🔐 Load Apple credentials from local .env file
source .env


### 📁 Project name (extracted from folder name)
APP_NAME=$(basename "$PWD")


### 🧩 Generate app.json dynamically
cat > app.json <<EOF
{
"expo": {
"name": "DelishAfrica $APP_NAME",
"slug": "$APP_NAME",
"owner": "purpleorchidgroup",
"scheme": "$APP_NAME",
"extra": {
"API_BASE_URL": "https://api.delishafrica.me"
},
"ios": {
"bundleIdentifier": "me.delishafrica.$APP_NAME"
},
"android": {
"package": "me.delishafrica.$APP_NAME"
}
}
}
EOF


### ⚙️ Generate eas.json build configuration
cat > eas.json <<EOF
{
"cli": { "version": ">= 9.0.0" },
"build": {
"development": {
"developmentClient": true,
"distribution": "internal",
"ios": { "simulator": true }
},
"preview": {
"distribution": "internal"
},
"production": {
"ios": { "simulator": false }
}
},
"submit": {
"production": {}
}
}
EOF


### 🔗 Ensure project is linked to EAS
npx expo init --id "$APP_NAME" || true


### 🚀 Trigger iOS + Android builds and auto-submit to stores
EXPO_APPLE_APP_SPECIFIC_PASSWORD=$EXPO_APPLE_APP_SPECIFIC_PASSWORD \
EXPO_APPLE_ID=$EXPO_APPLE_ID \
EXPO_APPLE_TEAM_ID=$EXPO_APPLE_TEAM_ID \
eas build --platform all --profile production --non-interactive --auto-submit


### ✅ Done
echo "✅ Build & Submit triggered for: $APP_NAME"
