/**
 * Database seed.
 *
 * Idempotent: every write is an upsert keyed on a natural unique column,
 * so running it repeatedly reconciles reference data without creating
 * duplicates or clobbering real records.
 *
 * Sample ACCOUNTS are created only when SEED_SAMPLE_USERS=true and
 * NODE_ENV is not production. The password comes from the environment --
 * there is no hard-coded administrator anywhere in this file.
 *
 *   npm run seed
 */
import { PrismaClient, RoleName } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

// Re-declared here rather than imported, so the seed can run via ts-node
// without pulling in the whole Nest dependency graph.
const PERMISSION_KEYS: string[] = [
  'user.read', 'user.create', 'user.update', 'user.deactivate',
  'role.assign', 'permission.manage', 'settings.read', 'settings.update', 'audit.read',
  'department.read', 'department.manage',
  'job.read.any', 'job.read.assigned', 'job.create', 'job.update', 'job.submit',
  'job.approve', 'job.publish', 'job.hold', 'job.close', 'job.cancel',
  'job.duplicate', 'job.assign_recruiter', 'job.export',
  'candidate.read.any', 'candidate.read.own', 'candidate.update.any', 'candidate.update.own',
  'candidate.note.manage', 'candidate.tag.manage', 'candidate.export',
  'document.upload.own', 'document.read.own', 'document.read.any', 'document.delete.own',
  'application.create.own', 'application.read.own', 'application.read.any',
  'application.read.assigned', 'application.withdraw.own', 'application.transition',
  'application.assign', 'application.note.manage', 'application.bulk', 'application.export',
  'interview.read.any', 'interview.read.assigned', 'interview.read.own',
  'interview.schedule', 'interview.reschedule', 'interview.cancel',
  'interview.feedback.submit', 'interview.feedback.read.any',
  'offer.read.any', 'offer.read.own', 'offer.create', 'offer.update',
  'offer.approve', 'offer.send', 'offer.withdraw', 'offer.respond.own',
  'onboarding.read.any', 'onboarding.read.own', 'onboarding.manage', 'onboarding.task.update',
  'dashboard.view', 'report.view', 'report.export',
  'notification.read.own', 'notification.template.manage',
];

const RECRUITER: string[] = [
  'job.read.assigned', 'department.read', 'candidate.read.any', 'candidate.note.manage',
  'candidate.tag.manage', 'document.read.any', 'application.read.assigned',
  'application.transition', 'application.note.manage', 'application.bulk',
  'application.export', 'interview.read.assigned', 'interview.schedule',
  'interview.reschedule', 'interview.cancel', 'interview.feedback.read.any',
  'offer.read.any', 'onboarding.read.any', 'dashboard.view', 'report.view',
  'notification.read.own',
];

const HR_ADMIN: string[] = [
  ...RECRUITER,
  'user.read', 'department.manage', 'job.read.any', 'job.create', 'job.update',
  'job.submit', 'job.approve', 'job.publish', 'job.hold', 'job.close', 'job.cancel',
  'job.duplicate', 'job.assign_recruiter', 'job.export', 'candidate.update.any',
  'candidate.export', 'application.read.any', 'application.assign', 'interview.read.any',
  'offer.create', 'offer.update', 'offer.approve', 'offer.send', 'offer.withdraw',
  'onboarding.manage', 'onboarding.task.update', 'report.export',
  'notification.template.manage',
];

const ROLE_PERMISSIONS: Record<RoleName, string[]> = {
  SUPER_ADMIN: PERMISSION_KEYS,
  HR_ADMIN,
  RECRUITER,
  HIRING_MANAGER: [
    'job.read.assigned', 'department.read', 'job.create', 'job.submit',
    'candidate.read.any', 'document.read.any', 'application.read.assigned',
    'application.transition', 'application.note.manage', 'interview.read.assigned',
    'interview.schedule', 'interview.feedback.submit', 'interview.feedback.read.any',
    'offer.read.any', 'dashboard.view', 'report.view', 'notification.read.own',
  ],
  INTERVIEWER: [
    'interview.read.assigned', 'interview.feedback.submit', 'candidate.read.any',
    'document.read.any', 'notification.read.own',
  ],
  CANDIDATE: [
    'candidate.read.own', 'candidate.update.own', 'document.upload.own',
    'document.read.own', 'document.delete.own', 'application.create.own',
    'application.read.own', 'application.withdraw.own', 'interview.read.own',
    'offer.read.own', 'offer.respond.own', 'onboarding.read.own', 'notification.read.own',
  ],
};

const ROLE_LABELS: Record<RoleName, string> = {
  SUPER_ADMIN: 'Super Admin',
  HR_ADMIN: 'HR Admin',
  RECRUITER: 'Recruiter',
  HIRING_MANAGER: 'Hiring Manager',
  INTERVIEWER: 'Interviewer',
  CANDIDATE: 'Candidate',
};

const DEPARTMENTS = [
  { code: 'ENG', name: 'Engineering', description: 'Software engineering and platform' },
  { code: 'PRD', name: 'Product', description: 'Product management and design' },
  { code: 'SAL', name: 'Sales', description: 'Revenue and business development' },
  { code: 'MKT', name: 'Marketing', description: 'Brand, demand generation and content' },
  { code: 'FIN', name: 'Finance', description: 'Finance, accounting and procurement' },
  { code: 'HR', name: 'Human Resources', description: 'People operations and talent' },
  { code: 'OPS', name: 'Operations', description: 'Business and service operations' },
  { code: 'ITS', name: 'IT Support', description: 'Internal IT and infrastructure' },
];

const SOURCES = [
  { name: 'Company Careers Page', category: 'DIRECT' },
  { name: 'LinkedIn', category: 'SOCIAL' },
  { name: 'Indeed', category: 'JOB_BOARD' },
  { name: 'Naukri', category: 'JOB_BOARD' },
  { name: 'Employee Referral', category: 'REFERRAL' },
  { name: 'Recruitment Agency', category: 'AGENCY' },
  { name: 'Campus Hiring', category: 'DIRECT' },
  { name: 'Walk-in', category: 'DIRECT' },
];

const SKILLS = [
  ['TypeScript', 'Programming'], ['JavaScript', 'Programming'], ['Python', 'Programming'],
  ['Java', 'Programming'], ['C#', 'Programming'], ['Go', 'Programming'],
  ['React', 'Frontend'], ['Angular', 'Frontend'], ['Vue', 'Frontend'], ['SCSS', 'Frontend'],
  ['Node.js', 'Backend'], ['NestJS', 'Backend'], ['Spring Boot', 'Backend'], ['.NET', 'Backend'],
  ['MySQL', 'Database'], ['PostgreSQL', 'Database'], ['Redis', 'Database'], ['Prisma', 'Database'],
  ['Docker', 'DevOps'], ['Kubernetes', 'DevOps'], ['AWS', 'Cloud'], ['Azure', 'Cloud'],
  ['CI/CD', 'DevOps'], ['Kong', 'DevOps'], ['Terraform', 'DevOps'],
  ['Product Management', 'Business'], ['Agile', 'Business'], ['Scrum', 'Business'],
  ['Communication', 'Soft Skills'], ['Leadership', 'Soft Skills'], ['Recruitment', 'HR'],
];

const EMAIL_TEMPLATES = [
  {
    key: 'account.verify_email',
    name: 'Verify your email address',
    subject: 'Confirm your HR ATS account',
    bodyHtml:
      '<p>Hello {{firstName}},</p><p>Please confirm your email address to activate your account.</p>' +
      '<p><a href="{{verifyUrl}}">Verify my email</a></p><p>This link expires in 24 hours.</p>',
    variables: '["firstName","verifyUrl"]',
  },
  {
    key: 'account.duplicate_registration',
    name: 'Registration attempt on an existing account',
    subject: 'Someone tried to register with your email',
    bodyHtml:
      '<p>Hello {{firstName}},</p><p>An account already exists for this address. ' +
      'If this was you, sign in or reset your password. If not, you can ignore this message.</p>',
    variables: '["firstName"]',
  },
  {
    key: 'account.invited',
    name: 'Staff account invitation',
    subject: 'Your HR ATS account has been created',
    bodyHtml:
      '<p>Hello {{firstName}},</p><p>An HR ATS account has been created for you. ' +
      'Use the temporary password shared with you separately, and change it at first sign-in.</p>',
    variables: '["firstName","verifyToken"]',
  },
  {
    key: 'account.password_reset',
    name: 'Password reset',
    subject: 'Reset your HR ATS password',
    bodyHtml:
      '<p>Hello {{firstName}},</p><p><a href="{{resetUrl}}">Reset your password</a></p>' +
      '<p>This link expires in one hour. If you did not request it, ignore this email.</p>',
    variables: '["firstName","resetUrl"]',
  },
  {
    key: 'application.received',
    name: 'Application received',
    subject: 'We received your application for {{jobTitle}}',
    bodyHtml:
      '<p>Hello {{firstName}},</p><p>Thank you for applying for <strong>{{jobTitle}}</strong>. ' +
      'Your application reference is <strong>{{applicationCode}}</strong>.</p>' +
      '<p>We will be in touch as your application progresses.</p>',
    variables: '["firstName","jobTitle","applicationCode"]',
  },
  {
    key: 'application.status_changed',
    name: 'Application status update',
    subject: 'Update on your application {{applicationCode}}',
    bodyHtml:
      '<p>Hello {{firstName}},</p><p>Your application for <strong>{{jobTitle}}</strong> ' +
      'has moved to <strong>{{newStage}}</strong>.</p>',
    variables: '["firstName","jobTitle","applicationCode","newStage"]',
  },
  {
    key: 'application.rejected',
    name: 'Application unsuccessful',
    subject: 'Your application for {{jobTitle}}',
    bodyHtml:
      '<p>Hello {{firstName}},</p><p>Thank you for your interest in <strong>{{jobTitle}}</strong>. ' +
      'On this occasion we will not be taking your application further.</p>' +
      '<p>We wish you every success and encourage you to apply for future roles.</p>',
    variables: '["firstName","jobTitle","applicationCode"]',
  },
  {
    key: 'interview.invitation',
    name: 'Interview invitation',
    subject: 'Interview scheduled for {{jobTitle}}',
    bodyHtml:
      '<p>Hello {{firstName}},</p><p>Your <strong>{{roundName}}</strong> for ' +
      '<strong>{{jobTitle}}</strong> is scheduled for <strong>{{scheduledAt}}</strong>.</p>' +
      '<p>Joining details: {{meetingLink}}</p>',
    variables: '["firstName","jobTitle","roundName","scheduledAt","meetingLink"]',
  },
  {
    key: 'interview.rescheduled',
    name: 'Interview rescheduled',
    subject: 'Your interview has been rescheduled',
    bodyHtml:
      '<p>Hello {{firstName}},</p><p>Your interview for <strong>{{jobTitle}}</strong> ' +
      'has been moved to <strong>{{scheduledAt}}</strong>.</p>',
    variables: '["firstName","jobTitle","scheduledAt"]',
  },
  {
    key: 'interview.reminder',
    name: 'Interview reminder',
    subject: 'Reminder: your interview tomorrow',
    bodyHtml:
      '<p>Hello {{firstName}},</p><p>A reminder that your interview for ' +
      '<strong>{{jobTitle}}</strong> is at <strong>{{scheduledAt}}</strong>.</p>',
    variables: '["firstName","jobTitle","scheduledAt"]',
  },
  {
    key: 'interview.panel_invite',
    name: 'Interview panel invitation',
    subject: 'You are on an interview panel',
    bodyHtml:
      '<p>Hello {{firstName}},</p><p>You have been added to the panel for ' +
      '<strong>{{jobTitle}}</strong> at <strong>{{scheduledAt}}</strong>.</p>',
    variables: '["firstName","jobTitle","scheduledAt"]',
  },
  {
    key: 'job.approval_requested',
    name: 'Job approval requested',
    subject: 'Approval needed: {{requirementCode}}',
    bodyHtml:
      '<p>Hello {{firstName}},</p><p>The requirement <strong>{{jobTitle}}</strong> ' +
      '({{requirementCode}}) is awaiting your approval.</p>',
    variables: '["firstName","jobTitle","requirementCode"]',
  },
  {
    key: 'offer.sent',
    name: 'Offer released',
    subject: 'Your offer for {{jobTitle}}',
    bodyHtml:
      '<p>Hello {{firstName}},</p><p>We are delighted to offer you the role of ' +
      '<strong>{{jobTitle}}</strong>, starting <strong>{{joiningDate}}</strong>.</p>' +
      '<p>Reference: {{offerCode}}. Please sign in to accept or decline.</p>',
    variables: '["firstName","jobTitle","offerCode","joiningDate"]',
  },
  {
    key: 'onboarding.started',
    name: 'Onboarding started',
    subject: 'Welcome aboard - next steps',
    bodyHtml:
      '<p>Hello {{firstName}},</p><p>Your onboarding has begun. ' +
      'Please complete the checklist before your joining date of {{joiningDate}}.</p>',
    variables: '["firstName","joiningDate"]',
  },
];

const SETTINGS = [
  { key: 'company.name', value: 'HR ATS Demo Company', category: 'general', description: 'Shown on the careers portal' },
  { key: 'company.careers_tagline', value: 'Build your career with us', category: 'general', description: 'Careers portal hero text' },
  { key: 'recruitment.default_followup_days', value: '3', valueType: 'number', category: 'recruitment', description: 'Default follow-up SLA' },
  { key: 'recruitment.auto_close_filled_jobs', value: 'true', valueType: 'boolean', category: 'recruitment', description: 'Close a job once all vacancies are filled' },
  { key: 'offer.default_validity_days', value: '7', valueType: 'number', category: 'offers', description: 'Default offer expiry window' },
  { key: 'security.session_idle_minutes', value: '30', valueType: 'number', category: 'security', description: 'Idle timeout for the SPA' },
  { key: 'security.mfa_required_roles', value: '["SUPER_ADMIN","HR_ADMIN"]', valueType: 'json', category: 'security', description: 'Roles that must enrol in MFA' },
  { key: 'privacy.candidate_retention_months', value: '24', valueType: 'number', category: 'privacy', description: 'How long candidate data is retained' },
];

async function seedRolesAndPermissions(): Promise<void> {
  console.log('  - permissions');
  for (const key of PERMISSION_KEYS) {
    const [resource, ...rest] = key.split('.');
    await prisma.permission.upsert({
      where: { key },
      create: { key, resource, action: rest.join('.') || 'access' },
      update: { resource, action: rest.join('.') || 'access' },
    });
  }

  console.log('  - roles');
  for (const name of Object.keys(ROLE_PERMISSIONS) as RoleName[]) {
    const role = await prisma.role.upsert({
      where: { name },
      create: { name, label: ROLE_LABELS[name], isSystem: true },
      update: { label: ROLE_LABELS[name] },
    });

    const permissions = await prisma.permission.findMany({
      where: { key: { in: ROLE_PERMISSIONS[name] } },
      select: { id: true },
    });

    // Reconcile: the code is the source of truth for role bundles, so
    // drift introduced by hand in the database is corrected here.
    await prisma.rolePermission.deleteMany({ where: { roleId: role.id } });
    await prisma.rolePermission.createMany({
      data: permissions.map((permission) => ({
        roleId: role.id,
        permissionId: permission.id,
      })),
    });
  }
}

async function seedReferenceData(): Promise<void> {
  console.log('  - departments');
  for (const department of DEPARTMENTS) {
    await prisma.department.upsert({
      where: { code: department.code },
      create: department,
      update: { name: department.name, description: department.description },
    });
  }

  console.log('  - recruitment sources');
  for (const source of SOURCES) {
    await prisma.recruitmentSource.upsert({
      where: { name: source.name },
      create: source,
      update: { category: source.category },
    });
  }

  console.log('  - skills');
  for (const [name, category] of SKILLS) {
    await prisma.skill.upsert({
      where: { name },
      create: { name, category },
      update: { category },
    });
  }

  console.log('  - notification templates');
  for (const template of EMAIL_TEMPLATES) {
    await prisma.notificationTemplate.upsert({
      where: { key: template.key },
      create: template,
      update: {
        name: template.name,
        subject: template.subject,
        bodyHtml: template.bodyHtml,
        variables: template.variables,
      },
    });
  }

  console.log('  - system settings');
  for (const setting of SETTINGS) {
    await prisma.systemSetting.upsert({
      where: { key: setting.key },
      create: setting,
      update: { description: setting.description },
    });
  }

  console.log('  - candidate tags');
  for (const tag of [
    { name: 'Top Talent', colour: '#16a34a' },
    { name: 'Referred', colour: '#2563eb' },
    { name: 'Rehire', colour: '#9333ea' },
    { name: 'Do Not Hire', colour: '#dc2626' },
    { name: 'Future Fit', colour: '#ca8a04' },
  ]) {
    await prisma.candidateTag.upsert({
      where: { name: tag.name },
      create: tag,
      update: { colour: tag.colour },
    });
  }
}

/**
 * Development sample accounts.
 *
 * Gated behind SEED_SAMPLE_USERS and blocked entirely in production.
 * The password is read from SEED_DEFAULT_PASSWORD -- nothing is
 * hard-coded, and no production administrator is ever created here.
 */
async function seedSampleUsers(): Promise<void> {
  const password = process.env.SEED_DEFAULT_PASSWORD;

  if (process.env.NODE_ENV === 'production') {
    console.log('  ! NODE_ENV=production -- sample users skipped');
    return;
  }
  if (!password) {
    console.log('  ! SEED_DEFAULT_PASSWORD is not set -- sample users skipped');
    return;
  }
  if (password.length < 12) {
    throw new Error('SEED_DEFAULT_PASSWORD must be at least 12 characters');
  }

  const passwordHash = await argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1,
  });

  const samples: Array<{
    email: string;
    firstName: string;
    lastName: string;
    roles: RoleName[];
  }> = [
    { email: process.env.SEED_ADMIN_EMAIL ?? 'superadmin@hr-ats.local', firstName: 'Sam', lastName: 'Admin', roles: ['SUPER_ADMIN'] },
    { email: 'hr.admin@hr-ats.local', firstName: 'Hana', lastName: 'Rahman', roles: ['HR_ADMIN'] },
    { email: 'recruiter@hr-ats.local', firstName: 'Riya', lastName: 'Kapoor', roles: ['RECRUITER'] },
    { email: 'recruiter2@hr-ats.local', firstName: 'Omar', lastName: 'Said', roles: ['RECRUITER'] },
    { email: 'manager@hr-ats.local', firstName: 'Mina', lastName: 'Torres', roles: ['HIRING_MANAGER'] },
    { email: 'interviewer@hr-ats.local', firstName: 'Ivan', lastName: 'Petrov', roles: ['INTERVIEWER'] },
    { email: 'interviewer2@hr-ats.local', firstName: 'Lena', lastName: 'Novak', roles: ['INTERVIEWER'] },
  ];

  console.log('  - sample staff accounts');
  for (const sample of samples) {
    const roles = await prisma.role.findMany({ where: { name: { in: sample.roles } } });

    const user = await prisma.user.upsert({
      where: { email: sample.email },
      create: {
        email: sample.email,
        passwordHash,
        firstName: sample.firstName,
        lastName: sample.lastName,
        // Pre-verified so the development stack is usable immediately.
        status: 'ACTIVE',
        emailVerifiedAt: new Date(),
      },
      update: {},
    });

    await prisma.userRole.deleteMany({ where: { userId: user.id } });
    await prisma.userRole.createMany({
      data: roles.map((role) => ({ userId: user.id, roleId: role.id })),
    });
  }

  // Two sample candidates, so the pipeline has something to show.
  console.log('  - sample candidate accounts');
  const candidateRole = await prisma.role.findUniqueOrThrow({ where: { name: 'CANDIDATE' } });
  const candidates = [
    { email: 'candidate1@example.com', firstName: 'Priya', lastName: 'Sharma', experience: 5.5, designation: 'Senior Developer' },
    { email: 'candidate2@example.com', firstName: 'Daniel', lastName: 'Okafor', experience: 3.0, designation: 'Frontend Developer' },
  ];

  for (const [index, entry] of candidates.entries()) {
    const user = await prisma.user.upsert({
      where: { email: entry.email },
      create: {
        email: entry.email,
        passwordHash,
        firstName: entry.firstName,
        lastName: entry.lastName,
        status: 'ACTIVE',
        emailVerifiedAt: new Date(),
        consentGivenAt: new Date(),
        userRoles: { create: { roleId: candidateRole.id } },
      },
      update: {},
    });

    await prisma.candidateProfile.upsert({
      where: { userId: user.id },
      create: {
        candidateCode: `CAND-${new Date().getFullYear()}-${String(index + 1).padStart(6, '0')}`,
        userId: user.id,
        fullName: `${entry.firstName} ${entry.lastName}`,
        normalisedEmail: entry.email,
        totalExperience: entry.experience,
        currentDesignation: entry.designation,
        location: 'Muscat, Oman',
        consentToStoreData: true,
        consentAt: new Date(),
      },
      update: {},
    });
  }

  console.log('\n  Sample accounts created. The password is the value of');
  console.log('  SEED_DEFAULT_PASSWORD in your .env file.');
  console.log('  These accounts are for LOCAL DEVELOPMENT ONLY.\n');
}

async function main(): Promise<void> {
  console.log('Seeding hr_ats_db...\n');

  await seedRolesAndPermissions();
  await seedReferenceData();

  if (process.env.SEED_SAMPLE_USERS === 'true') {
    await seedSampleUsers();
  } else {
    console.log('  ! SEED_SAMPLE_USERS is not "true" -- no user accounts created');
  }

  const counts = {
    permissions: await prisma.permission.count(),
    roles: await prisma.role.count(),
    departments: await prisma.department.count(),
    skills: await prisma.skill.count(),
    sources: await prisma.recruitmentSource.count(),
    templates: await prisma.notificationTemplate.count(),
    settings: await prisma.systemSetting.count(),
    users: await prisma.user.count(),
    candidates: await prisma.candidateProfile.count(),
  };

  console.log('\nSeed complete:');
  for (const [key, value] of Object.entries(counts)) {
    console.log(`  ${key.padEnd(14)} ${value}`);
  }
}

main()
  .catch((error) => {
    console.error('Seed failed:', error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
