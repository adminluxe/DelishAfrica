#!/usr/bin/env bash
set -e
cd "$(dirname "$0")/src"
echo "Recherche de AppModule dans $(pwd) ..."
grep -R "export class AppModule" -n . || echo "❌ AppModule introuvable dans src/"
