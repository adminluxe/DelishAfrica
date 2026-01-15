✅ Fix appliqué.
- Lockfiles parasites déplacés: /opt/delishafrica/monorepo/.tonton_reports/eas_doctor_20260115_040705/moved_lockfiles.txt (si existant)
- Root package.json patché: packageManager + workspaces
Prochain step:
  cd /opt/delishafrica/monorepo/apps/client && eas build -p ios --profile preview
Si ça re-casse:
  bash /opt/delishafrica/monorepo/scripts/tonton_eas_doctor.sh autopsy client --latest
