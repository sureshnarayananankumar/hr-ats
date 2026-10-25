# HR-ATS Database Guide

MySQL 8.4 LTS · database `hr_ats_db` · character set `utf8mb4` ·
collation `utf8mb4_0900_ai_ci`

---

## 1. Where the database runs

This machine had **no native MySQL Server installed** when the project
was set up (only MySQL Workbench, plus unrelated XAMPP MariaDB bundles).
The database therefore runs as **MySQL 8.4 in Docker**, published to
`127.0.0.1:3307` so MySQL Workbench can connect to it normally.

Port **3307** is used deliberately so that if you ever install a native
MySQL Server on the default **3306**, the two never collide.

> The `127.0.0.1:` prefix in `docker-compose.yml` is a security control,
> not cosmetic. It binds the port to the loopback interface only, so the
> database is unreachable from your local network.

---

## 2. Accounts and privilege separation

Three accounts exist. **The application never uses root.**

| Account | Used by | Privileges |
|---|---|---|
| `root` | Container initialisation only | All (never used by the app) |
| `hr_ats_app` | The running NestJS API | `SELECT, INSERT, UPDATE, DELETE, EXECUTE` |
| `hr_ats_migrate` | `prisma migrate deploy` only | The above **plus** `CREATE, ALTER, DROP, INDEX, REFERENCES, CREATE VIEW, SHOW VIEW, TRIGGER` |

The application account has **no DDL rights by design**: a compromised
API cannot drop a table or alter the schema.

Verify this at any time:

```powershell
docker exec -it hr-ats-mysql mysql -u root -p -e "SHOW GRANTS FOR 'hr_ats_app'@'%';"
```

Expected output (verified on 2026-10-14):

```
GRANT USAGE ON *.* TO `hr_ats_app`@`%`
GRANT SELECT, INSERT, UPDATE, DELETE, EXECUTE ON `hr_ats_db`.* TO `hr_ats_app`@`%`
```

Passwords come from `.env` and are injected by `docker/mysql/init.sh` on
first boot. They are never written into a committed file.

---

## 3. Connecting with MySQL Workbench

1. Open MySQL Workbench.
2. Click **+** beside *MySQL Connections*.
3. Fill in:

   | Field | Value |
   |---|---|
   | Connection Name | `HR ATS (Docker)` |
   | Hostname | `127.0.0.1` |
   | Port | `3307` |
   | Username | `hr_ats_app` (or `hr_ats_migrate` for schema work) |
   | Default Schema | `hr_ats_db` |

4. Click **Store in Vault…** and paste the matching password from your
   `.env` file (`MYSQL_APP_PASSWORD` / `MYSQL_MIGRATE_PASSWORD`).
5. **Test Connection**, then **OK**.

### Viewing the schema

- Expand **hr_ats_db → Tables** in the Navigator.
- Right-click a table → **Select Rows** to browse data.
- To see relationships: **Database → Reverse Engineer…**, pick the
  connection and `hr_ats_db`, and Workbench draws the full EER diagram
  from the 64 foreign keys.

### Useful inspection queries

```sql
-- Object counts
SELECT
  (SELECT COUNT(*) FROM information_schema.TABLES
     WHERE TABLE_SCHEMA = 'hr_ats_db')                      AS tables,
  (SELECT COUNT(*) FROM information_schema.REFERENTIAL_CONSTRAINTS
     WHERE CONSTRAINT_SCHEMA = 'hr_ats_db')                 AS foreign_keys,
  (SELECT COUNT(DISTINCT TABLE_NAME, INDEX_NAME) FROM information_schema.STATISTICS
     WHERE TABLE_SCHEMA = 'hr_ats_db')                      AS indexes;

-- The duplicate-application guard
SHOW INDEX FROM hr_ats_db.job_applications
  WHERE Key_name = 'job_applications_candidateId_activeJobKey_key';

-- Current pipeline, straight from the database
SELECT currentStage, status, COUNT(*) AS total
FROM hr_ats_db.job_applications
GROUP BY currentStage, status
ORDER BY total DESC;
```

---

## 4. Schema overview

**40 tables · 64 foreign keys · 157 indexes** (verified after the
initial migration).

| Area | Tables |
|---|---|
| Identity & access | `users`, `roles`, `permissions`, `role_permissions`, `user_roles`, `refresh_sessions`, `email_verification_tokens`, `password_reset_tokens`, `login_attempts` |
| Organisation | `departments`, `skills`, `recruitment_sources` |
| Requisitions | `job_requirements`, `job_skills`, `job_approvals`, `job_requirement_history` |
| Candidates | `candidate_profiles`, `candidate_skills`, `candidate_documents`, `document_access_logs`, `candidate_tags`, `candidate_tag_links`, `candidate_notes`, `candidate_activities` |
| Applications | `job_applications`, `application_status_history`, `application_notes` |
| Interviews | `interviews`, `interview_panel_members`, `interview_feedback` |
| Offers | `offers`, `offer_approvals`, `offer_history` |
| Onboarding | `onboarding_records`, `onboarding_tasks` |
| Platform | `notifications`, `notification_templates`, `email_logs`, `audit_logs`, `system_settings` |

### The duplicate-application guard

Section 19 requires preventing *duplicate active applications* while
still allowing a candidate to re-apply later. A plain
`UNIQUE(candidateId, jobId)` would block re-application forever.

The solution is a nullable key column:

```prisma
activeJobKey String? @db.Char(36)
@@unique([candidateId, activeJobKey])
```

`activeJobKey` holds the `jobId` while the application is live and is
set to `NULL` when it reaches a terminal status. MySQL permits many
`NULL`s in a unique index, so:

- two live applications for the same job → **rejected by the database**
- re-applying after rejection/withdrawal → **allowed**

Because this is a database constraint rather than a read-then-write
check, two simultaneous submissions cannot both succeed.

---

## 5. Migrations

Prisma migrations are the **authoritative** schema-change mechanism.
`schema.sql` in this folder is generated documentation and must never be
hand-edited or applied directly.

### Development

```powershell
cd D:\HR-ATS\backend
npm run prisma:migrate       # creates + applies a migration
```

### Production / containers

Migrations run as a **separate, one-shot step** under the elevated
account, never automatically on application start. That prevents several
API replicas racing to migrate the same database:

```powershell
cd D:\HR-ATS
docker compose --profile migrate run --rm migrate
```

Check status without changing anything:

```powershell
docker compose exec backend npx prisma migrate status
```

---

## 6. Seeding

```powershell
cd D:\HR-ATS\backend
npm run seed
```

The seed is **idempotent** — every write is an upsert on a natural key,
so running it repeatedly reconciles reference data instead of creating
duplicates.

It always seeds: 70 permissions, 6 roles, 8 departments, 31 skills,
8 recruitment sources, 14 notification templates, 8 system settings and
5 candidate tags.

Sample **user accounts** are created only when both of these hold:

- `SEED_SAMPLE_USERS=true`
- `NODE_ENV` is not `production`

The password comes from `SEED_DEFAULT_PASSWORD` in `.env`. **No
administrator password is hard-coded anywhere in this project.**

---

## 7. Backup and restore

### Backup

```powershell
docker exec hr-ats-mysql sh -c 'exec mysqldump -u root -p"$MYSQL_ROOT_PASSWORD" --single-transaction --routines --triggers hr_ats_db' > D:\HR-ATS\backup-hr_ats_db.sql
```

`--single-transaction` takes a consistent snapshot without locking
InnoDB tables, so the application keeps working during the dump.

### Restore

```powershell
Get-Content D:\HR-ATS\backup-hr_ats_db.sql | docker exec -i hr-ats-mysql sh -c 'exec mysql -u root -p"$MYSQL_ROOT_PASSWORD" hr_ats_db'
```

> A backup you have never restored is not a verified backup. Test the
> restore into a scratch database before relying on it.

---

## 8. Data safety rules

- `docker compose down` stops the stack and **keeps** your data.
- `docker compose down -v` **destroys** the `hr_ats_mysql_data` volume
  and every record in it. It is never part of a normal stop, restart or
  upgrade.
- `scripts/docker-reset.ps1` can remove volumes, but it refuses to run
  without an explicit typed confirmation.
- Scripts in `/docker-entrypoint-initdb.d` run **only** when the data
  volume is empty. Restarting the container never re-runs them, so a
  restart cannot wipe data.

### Data survives restarts — verified

```powershell
docker compose restart mysql
# then re-query: row counts are unchanged
```

---

## 9. Troubleshooting

**MySQL container restarts in a loop.**
Check `docker compose logs mysql`. One cause seen during this build:
`--default-authentication-plugin` was **removed in MySQL 8.4** and makes
the server abort at startup. Use `--authentication-policy` instead.

**Workbench cannot connect on 3307.**
Confirm the container is healthy and the port is published:
```powershell
docker compose ps
docker compose port mysql 3306
```

**`Access denied for user 'hr_ats_app'`.**
The accounts are created on *first* volume initialisation only. If you
changed the passwords in `.env` after that, update them in MySQL rather
than expecting the init script to re-run:
```sql
ALTER USER 'hr_ats_app'@'%' IDENTIFIED BY 'new-password';
```

**Prisma reports drift or a failed migration.**
Never "fix" it with a reset against real data. Inspect first:
```powershell
docker compose exec backend npx prisma migrate status
```
