#!/bin/bash
# =====================================================================
#  HR-ATS  --  MySQL first-boot initialisation
#
#  Runs ONLY when the data volume is empty (first ever container start).
#  It is NOT re-executed on restart, so restarting never wipes data.
#
#  Why a shell script and not plain .sql?  Passwords must come from
#  environment variables rather than being baked into a committed file.
#  docker/mysql/init.sql is the human-readable reference of these grants.
# =====================================================================
set -euo pipefail

APP_USER="${HR_ATS_APP_USER:-hr_ats_app}"
MIGRATE_USER="${HR_ATS_MIGRATE_USER:-hr_ats_migrate}"
DB_NAME="${MYSQL_DATABASE:-hr_ats_db}"

if [[ -z "${HR_ATS_APP_PASSWORD:-}" || -z "${HR_ATS_MIGRATE_PASSWORD:-}" ]]; then
  echo "[hr-ats-init] FATAL: app/migrate passwords not provided." >&2
  exit 1
fi

echo "[hr-ats-init] Creating database and least-privilege accounts..."

# --password on the command line would leak into `ps`; use the env var
# MYSQL_PWD that the mysql client reads instead.
export MYSQL_PWD="${MYSQL_ROOT_PASSWORD}"

mysql --protocol=socket -u root <<SQL
CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\`
  CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

-- Prisma's shadow database, used by \`migrate dev\` to diff schemas.
CREATE DATABASE IF NOT EXISTS \`hr_ats_shadow\`
  CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

-- ---------- Application runtime account: DML only, no DDL ----------
CREATE USER IF NOT EXISTS '${APP_USER}'@'%'
  IDENTIFIED BY '${HR_ATS_APP_PASSWORD}';
ALTER USER '${APP_USER}'@'%'
  IDENTIFIED BY '${HR_ATS_APP_PASSWORD}';

GRANT SELECT, INSERT, UPDATE, DELETE ON \`${DB_NAME}\`.* TO '${APP_USER}'@'%';
GRANT EXECUTE ON \`${DB_NAME}\`.* TO '${APP_USER}'@'%';

-- ---------- Migration account: DDL, used only by migrate step ----------
CREATE USER IF NOT EXISTS '${MIGRATE_USER}'@'%'
  IDENTIFIED BY '${HR_ATS_MIGRATE_PASSWORD}';
ALTER USER '${MIGRATE_USER}'@'%'
  IDENTIFIED BY '${HR_ATS_MIGRATE_PASSWORD}';

GRANT SELECT, INSERT, UPDATE, DELETE,
      CREATE, ALTER, DROP, INDEX, REFERENCES,
      CREATE VIEW, SHOW VIEW, TRIGGER, EXECUTE
  ON \`${DB_NAME}\`.* TO '${MIGRATE_USER}'@'%';

GRANT ALL PRIVILEGES ON \`hr_ats_shadow\`.* TO '${MIGRATE_USER}'@'%';

FLUSH PRIVILEGES;
SQL

unset MYSQL_PWD
echo "[hr-ats-init] Done. App user '${APP_USER}' has no DDL rights by design."
