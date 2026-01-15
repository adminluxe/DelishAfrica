const fs = require('fs');
const path = require('path');

const ROOT = '/opt/delishafrica/monorepo';
const APPS = ['client', 'courier', 'merchant'];

for (const app of APPS) {
  const appRoot = path.join(ROOT, 'apps', app);
  const pkgPath = path.join(appRoot, 'package.json');

  if (!fs.existsSync(pkgPath)) {
    console.log(`[WARN] ${app}: package.json introuvable (${pkgPath})`);
    continue;
  }

  let pkg;
  try {
    const raw = fs.readFileSync(pkgPath, 'utf8');
    pkg = JSON.parse(raw);
  } catch (e) {
    console.error(`[ERREUR] ${app}: JSON invalide dans package.json : ${e.message}`);
    continue;
  }

  const deps = {
    ...(pkg.dependencies || {}),
    ...(pkg.devDependencies || {}),
  };
  const usesRouter = !!deps['expo-router'];

  const appTsx = path.join(appRoot, 'App.tsx');
  const appJs  = path.join(appRoot, 'App.js');

  if (fs.existsSync(appTsx) || fs.existsSync(appJs)) {
    console.log(`[OK] ${app}: App.tsx/App.js existe déjà, je ne touche à rien.`);
    continue;
  }

  if (usesRouter) {
    const content = `import React from 'react';
import { ExpoRoot } from 'expo-router';
import { registerRootComponent } from 'expo';

export function App() {
  // Charge toutes les routes depuis le dossier "app"
  const ctx = require.context('./app');
  return <ExpoRoot context={ctx} />;
}

registerRootComponent(App);

export default App;
`;
    fs.writeFileSync(appTsx, content);
    console.log(`[OK] ${app}: App.tsx créé avec expo-router (${appTsx}).`);
  } else {
    const name = pkg.name || app;
    const content = `import React from 'react';
import { Text, View } from 'react-native';
import { registerRootComponent } from 'expo';

function App() {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <Text>DelishAfrica – ${name} (placeholder)</Text>
    </View>
  );
}

registerRootComponent(App);

export default App;
`;
    fs.writeFileSync(appTsx, content);
    console.log(`[OK] ${app}: App.tsx minimal créé (${appTsx}).`);
  }
}
