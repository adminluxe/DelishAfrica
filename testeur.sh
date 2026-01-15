#!/usr/bin/env bash
for APP in client courier merchant; do
  FILE="apps/$APP/ui/ui.tsx"
  cp "$FILE" "${FILE}.bak_scrollfix"  # backup
  # Insérer l’import ScrollView depuis react-native
  sed -i "s/import { SafeAreaView/import { SafeAreaView, ScrollView/" "$FILE"
  # Remplacer le début du JSX : <SafeAreaView>...<View style={{ flex: 1, ... }}>
  sed -i "s/<SafeAreaView style={{ flex: 1 }}>/<SafeAreaView style={{ flex: 1 }}>\n      <ScrollView contentContainerStyle={{ flexGrow: 1 }}>/" "$FILE"
  # Remplacer la fin du JSX : </View></SafeAreaView> par </ScrollView></SafeAreaView>
  sed -i "s#</View>\\s*</SafeAreaView>#</ScrollView>\n    </SafeAreaView>#" "$FILE"
done
