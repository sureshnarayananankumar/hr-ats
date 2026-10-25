-- =====================================================================
--  HR-ATS — reference data seed (SQL reference copy)
--
--  The AUTHORITATIVE seed is backend/prisma/seed.ts:
--
--      cd backend && npm run seed
--
--  Prefer it. It is idempotent, it hashes passwords with Argon2id, and
--  it reconciles role→permission bundles from the TypeScript source of
--  truth. This file exists so the reference data can be inspected and
--  loaded without Node.js.
--
--  SECURITY NOTE
--  -------------
--  This file contains NO user accounts and NO passwords. Creating a
--  user requires an Argon2id hash, which cannot be produced in SQL.
--  There is deliberately no hard-coded administrator anywhere in this
--  project. Use `npm run seed` with SEED_SAMPLE_USERS=true for
--  development accounts.
--
--  Safe to re-run: every statement is INSERT ... ON DUPLICATE KEY UPDATE.
-- =====================================================================

SET NAMES utf8mb4;
USE hr_ats_db;

-- ---------------------------------------------------------------------
--  Roles
-- ---------------------------------------------------------------------
INSERT INTO `roles` (`id`, `name`, `label`, `description`, `isSystem`, `createdAt`, `updatedAt`) VALUES
  (UUID(), 'SUPER_ADMIN',    'Super Admin',    'Full platform administration, including users, permissions, settings and audit logs.', 1, NOW(3), NOW(3)),
  (UUID(), 'HR_ADMIN',       'HR Admin',       'Manages job requirements, approvals, recruitment, interviews, offers and reports.',    1, NOW(3), NOW(3)),
  (UUID(), 'RECRUITER',      'Recruiter',      'Manages assigned vacancies and candidate applications.',                               1, NOW(3), NOW(3)),
  (UUID(), 'HIRING_MANAGER', 'Hiring Manager', 'Reviews assigned candidates and provides hiring decisions.',                           1, NOW(3), NOW(3)),
  (UUID(), 'INTERVIEWER',    'Interviewer',    'Accesses assigned interviews and submits structured feedback.',                        1, NOW(3), NOW(3)),
  (UUID(), 'CANDIDATE',      'Candidate',      'Manages their own profile, applications and documents.',                               1, NOW(3), NOW(3))
ON DUPLICATE KEY UPDATE `label` = VALUES(`label`), `description` = VALUES(`description`);

-- ---------------------------------------------------------------------
--  Departments
-- ---------------------------------------------------------------------
INSERT INTO `departments` (`id`, `code`, `name`, `description`, `isActive`, `createdAt`, `updatedAt`) VALUES
  (UUID(), 'ENG', 'Engineering',     'Software engineering and platform',      1, NOW(3), NOW(3)),
  (UUID(), 'PRD', 'Product',         'Product management and design',          1, NOW(3), NOW(3)),
  (UUID(), 'SAL', 'Sales',           'Revenue and business development',       1, NOW(3), NOW(3)),
  (UUID(), 'MKT', 'Marketing',       'Brand, demand generation and content',   1, NOW(3), NOW(3)),
  (UUID(), 'FIN', 'Finance',         'Finance, accounting and procurement',    1, NOW(3), NOW(3)),
  (UUID(), 'HR',  'Human Resources', 'People operations and talent',           1, NOW(3), NOW(3)),
  (UUID(), 'OPS', 'Operations',      'Business and service operations',        1, NOW(3), NOW(3)),
  (UUID(), 'ITS', 'IT Support',      'Internal IT and infrastructure',         1, NOW(3), NOW(3))
ON DUPLICATE KEY UPDATE `name` = VALUES(`name`), `description` = VALUES(`description`);

-- ---------------------------------------------------------------------
--  Recruitment sources
-- ---------------------------------------------------------------------
INSERT INTO `recruitment_sources` (`id`, `name`, `category`, `isActive`, `createdAt`) VALUES
  (UUID(), 'Company Careers Page', 'DIRECT',    1, NOW(3)),
  (UUID(), 'LinkedIn',             'SOCIAL',    1, NOW(3)),
  (UUID(), 'Indeed',               'JOB_BOARD', 1, NOW(3)),
  (UUID(), 'Naukri',               'JOB_BOARD', 1, NOW(3)),
  (UUID(), 'Employee Referral',    'REFERRAL',  1, NOW(3)),
  (UUID(), 'Recruitment Agency',   'AGENCY',    1, NOW(3)),
  (UUID(), 'Campus Hiring',        'DIRECT',    1, NOW(3)),
  (UUID(), 'Walk-in',              'DIRECT',    1, NOW(3))
ON DUPLICATE KEY UPDATE `category` = VALUES(`category`);

-- ---------------------------------------------------------------------
--  Skills
-- ---------------------------------------------------------------------
INSERT INTO `skills` (`id`, `name`, `category`, `createdAt`) VALUES
  (UUID(), 'TypeScript',         'Programming'), (UUID(), 'JavaScript',  'Programming'),
  (UUID(), 'Python',             'Programming'), (UUID(), 'Java',        'Programming'),
  (UUID(), 'C#',                 'Programming'), (UUID(), 'Go',          'Programming'),
  (UUID(), 'React',              'Frontend'),    (UUID(), 'Angular',     'Frontend'),
  (UUID(), 'Vue',                'Frontend'),    (UUID(), 'SCSS',        'Frontend'),
  (UUID(), 'Node.js',            'Backend'),     (UUID(), 'NestJS',      'Backend'),
  (UUID(), 'Spring Boot',        'Backend'),     (UUID(), '.NET',        'Backend'),
  (UUID(), 'MySQL',              'Database'),    (UUID(), 'PostgreSQL',  'Database'),
  (UUID(), 'Redis',              'Database'),    (UUID(), 'Prisma',      'Database'),
  (UUID(), 'Docker',             'DevOps'),      (UUID(), 'Kubernetes',  'DevOps'),
  (UUID(), 'AWS',                'Cloud'),       (UUID(), 'Azure',       'Cloud'),
  (UUID(), 'CI/CD',              'DevOps'),      (UUID(), 'Kong',        'DevOps'),
  (UUID(), 'Terraform',          'DevOps'),      (UUID(), 'Agile',       'Business'),
  (UUID(), 'Product Management', 'Business'),    (UUID(), 'Scrum',       'Business'),
  (UUID(), 'Communication',      'Soft Skills'), (UUID(), 'Leadership',  'Soft Skills'),
  (UUID(), 'Recruitment',        'HR')
ON DUPLICATE KEY UPDATE `category` = VALUES(`category`);

-- ---------------------------------------------------------------------
--  Candidate tags
-- ---------------------------------------------------------------------
INSERT INTO `candidate_tags` (`id`, `name`, `colour`, `createdAt`) VALUES
  (UUID(), 'Top Talent',  '#16a34a', NOW(3)),
  (UUID(), 'Referred',    '#2563eb', NOW(3)),
  (UUID(), 'Rehire',      '#9333ea', NOW(3)),
  (UUID(), 'Do Not Hire', '#dc2626', NOW(3)),
  (UUID(), 'Future Fit',  '#ca8a04', NOW(3))
ON DUPLICATE KEY UPDATE `colour` = VALUES(`colour`);

-- ---------------------------------------------------------------------
--  System settings
-- ---------------------------------------------------------------------
INSERT INTO `system_settings` (`id`, `key`, `value`, `valueType`, `category`, `description`, `isSecret`, `createdAt`, `updatedAt`) VALUES
  (UUID(), 'company.name',                        'HR ATS Demo Company',           'string',  'general',     'Shown on the careers portal',                 0, NOW(3), NOW(3)),
  (UUID(), 'company.careers_tagline',             'Build your career with us',     'string',  'general',     'Careers portal hero text',                    0, NOW(3), NOW(3)),
  (UUID(), 'recruitment.default_followup_days',   '3',                             'number',  'recruitment', 'Default follow-up SLA in days',               0, NOW(3), NOW(3)),
  (UUID(), 'recruitment.auto_close_filled_jobs',  'true',                          'boolean', 'recruitment', 'Close a job once all vacancies are filled',   0, NOW(3), NOW(3)),
  (UUID(), 'offer.default_validity_days',         '7',                             'number',  'offers',      'Default offer expiry window in days',         0, NOW(3), NOW(3)),
  (UUID(), 'security.session_idle_minutes',       '30',                            'number',  'security',    'Idle timeout for the SPA',                    0, NOW(3), NOW(3)),
  (UUID(), 'security.mfa_required_roles',         '["SUPER_ADMIN","HR_ADMIN"]',    'json',    'security',    'Roles that must enrol in MFA',                0, NOW(3), NOW(3)),
  (UUID(), 'privacy.candidate_retention_months',  '24',                            'number',  'privacy',     'How long candidate data is retained',         0, NOW(3), NOW(3))
ON DUPLICATE KEY UPDATE `description` = VALUES(`description`);

-- =====================================================================
--  NOT seeded here (use backend/prisma/seed.ts instead):
--
--    * 70 permissions and the role→permission bundles
--      These are generated from common/auth/permissions.ts so that the
--      code stays the single source of truth.
--
--    * 14 notification/email templates
--      Long HTML bodies; maintained in TypeScript alongside the code
--      that renders them.
--
--    * All user accounts
--      Require Argon2id hashes, which SQL cannot produce.
-- =====================================================================

SELECT
  (SELECT COUNT(*) FROM `roles`)               AS roles,
  (SELECT COUNT(*) FROM `departments`)         AS departments,
  (SELECT COUNT(*) FROM `recruitment_sources`) AS sources,
  (SELECT COUNT(*) FROM `skills`)              AS skills,
  (SELECT COUNT(*) FROM `candidate_tags`)      AS tags,
  (SELECT COUNT(*) FROM `system_settings`)     AS settings;
