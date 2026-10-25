-- =====================================================================
--  HR-ATS  --  MySQL container initialisation
--
--  IMPORTANT: Scripts in /docker-entrypoint-initdb.d run ONLY when the
--  data volume is empty (first ever start). They are NOT re-executed on
--  container restart, so restarting can never wipe your data.
--
--  This file creates the two least-privilege accounts. The application
--  NEVER uses root.
--
--    hr_ats_app      -> DML only (SELECT/INSERT/UPDATE/DELETE). No DDL.
--    hr_ats_migrate  -> DDL rights, used only by `prisma migrate deploy`.
-- =====================================================================

CREATE DATABASE IF NOT EXISTS hr_ats_db
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_0900_ai_ci;

-- Prisma's shadow database, used by `migrate dev` to diff schemas.
CREATE DATABASE IF NOT EXISTS hr_ats_shadow
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_0900_ai_ci;

-- ---------------------------------------------------------------------
--  Application account -- runtime API user.
--  Deliberately has NO CREATE/ALTER/DROP: a compromised API cannot
--  change the schema or drop tables.
-- ---------------------------------------------------------------------
CREATE USER IF NOT EXISTS 'hr_ats_app'@'%'
  IDENTIFIED BY 'REPLACED_BY_ENTRYPOINT_APP';

GRANT SELECT, INSERT, UPDATE, DELETE
  ON hr_ats_db.*
  TO 'hr_ats_app'@'%';

-- Required for Prisma's interactive transactions.
GRANT EXECUTE ON hr_ats_db.* TO 'hr_ats_app'@'%';

-- ---------------------------------------------------------------------
--  Migration account -- schema changes only, run as a deployment step.
-- ---------------------------------------------------------------------
CREATE USER IF NOT EXISTS 'hr_ats_migrate'@'%'
  IDENTIFIED BY 'REPLACED_BY_ENTRYPOINT_MIGRATE';

GRANT SELECT, INSERT, UPDATE, DELETE,
      CREATE, ALTER, DROP, INDEX, REFERENCES,
      CREATE VIEW, SHOW VIEW, TRIGGER, EXECUTE
  ON hr_ats_db.*
  TO 'hr_ats_migrate'@'%';

-- Prisma needs full control of its shadow database.
GRANT ALL PRIVILEGES ON hr_ats_shadow.* TO 'hr_ats_migrate'@'%';

FLUSH PRIVILEGES;
