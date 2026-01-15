```bash
cd /opt/delishafrica/monorepo

# Remplace toutes les variantes connues dans apps/*
perl -pi -e 's#(["\x27])delishafrica/ui\1#$1\@delishafrica/ui$1#g; s#(["\x27])delishAfrica/ui\1#$1\@delishafrica/ui$1#g; s#(["\x27])delishAfrica/ui\1#$1\@delishafrica/ui$1#g'   $(find apps -type f \( -name "*.ts" -o -name "*.tsx" -o -name "*.js" \))

# Vérifier qu'il ne reste plus de "delishafrica/ui"
grep -RIn --exclude-dir=node_modules --exclude-dir=.git 'delishafrica/ui' apps || echo "✅ OK: plus aucun traînard delishafrica/ui"
```
