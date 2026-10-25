/**
 * Regenerates database/schema.sql from the live MySQL schema.
 *
 * Prisma migrations remain the AUTHORITATIVE schema-change mechanism.
 * This file is documentation — generated so it can never drift from the
 * database the way a hand-maintained .sql file would.
 *
 *   node scripts/gen-sql-docs.js <path-to-mysqldump-output>
 */
const fs = require('node:fs');
const path = require('node:path');

const [, , dumpPath] = process.argv;
if (!dumpPath) {
  console.error('Usage: node scripts/gen-sql-docs.js <dump.sql>');
  process.exit(1);
}

const root = path.resolve(__dirname, '..');
const raw = fs.readFileSync(dumpPath, 'utf8');

// Drop mysqldump's session-variable preamble/epilogue — it is noise in a
// document meant to be read.
const body = raw
  .split('\n')
  .filter((line) => !/^\/\*!\d+/.test(line.trim()))
  .filter((line) => !/^--\s*(Dump completed|Host:|Server version)/.test(line.trim()))
  .join('\n')
  .replace(/\n{3,}/g, '\n\n')
  .trim();

const tableCount = (body.match(/^CREATE TABLE/gm) || []).length;
const fkCount = (body.match(/CONSTRAINT .* FOREIGN KEY/g) || []).length;

const header = `-- =====================================================================
--  HR-ATS — database schema (GENERATED DOCUMENTATION)
--
--  Database: hr_ats_db
--  Charset:  utf8mb4 / utf8mb4_0900_ai_ci
--  Engine:   InnoDB
--
--  DO NOT APPLY THIS FILE DIRECTLY and DO NOT EDIT IT BY HAND.
--
--  Prisma migrations are the authoritative schema-change mechanism:
--
--      cd backend
--      npm run prisma:migrate     # development
--      npm run prisma:deploy      # production / containers
--
--  This file is regenerated from the live database so that it can never
--  drift from reality:
--
--      docker exec hr-ats-mysql mysqldump -u root -p --no-data \\
--        --skip-comments hr_ats_db > dump.sql
--      node scripts/gen-sql-docs.js dump.sql
--
--  Tables: ${tableCount}   Foreign keys: ${fkCount}
--  Generated: ${new Date().toISOString().slice(0, 10)}
-- =====================================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

`;

const footer = `
SET FOREIGN_KEY_CHECKS = 1;

-- =====================================================================
--  Notes on the non-obvious parts of this schema
--
--  job_applications.activeJobKey
--    Holds the jobId while an application is ACTIVE and is set to NULL
--    when it reaches a terminal status. Combined with the unique index
--    on (candidateId, activeJobKey), and because MySQL allows many
--    NULLs in a unique index, this enforces "at most one LIVE
--    application per candidate per job" while still permitting a
--    candidate to re-apply after a rejection or withdrawal.
--
--  application_status_history
--    Append-only. Every stage/status transition records the previous
--    value, the new value, who made the change, an optional reason and
--    the seconds spent in the previous stage (which powers the
--    stage-duration and time-to-hire reports).
--
--  candidate_documents.storageKey
--    An opaque, server-generated key. The client-supplied filename is
--    stored only as display metadata in originalName and never forms
--    part of a filesystem path.
--
--  refresh_sessions.tokenHash
--    Refresh tokens are stored only as SHA-256 digests, so a database
--    leak yields nothing usable. previousId chains rotated tokens so
--    that reuse of a retired token can be detected.
--
--  audit_logs
--    Append-only. metadata is JSON with credential-like keys redacted
--    before the row is written.
-- =====================================================================
`;

const target = path.join(root, 'database', 'schema.sql');
fs.writeFileSync(target, header + body + footer);

console.log(`Wrote database/schema.sql (${tableCount} tables, ${fkCount} foreign keys)`);
