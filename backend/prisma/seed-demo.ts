/**
 * Demo data generator.
 *
 *   npm run seed:demo              # add demo data
 *   npm run seed:demo -- --reset   # remove previous demo data first
 *
 * WHAT IT DOES NOT TOUCH
 * ----------------------
 * The seven staff accounts created by prisma/seed.ts (superadmin,
 * hr.admin, recruiter, recruiter2, manager, interviewer, interviewer2)
 * and the two original sample candidates are left exactly as they are —
 * same ids, same passwords. Demo users are created in their own
 * @demo.hr-ats.local namespace so they can be identified and removed
 * without touching anything real.
 *
 * DESIGN NOTES
 * ------------
 * - Dates are spread across the last 14 months so the dashboard charts
 *   show a trend rather than a single spike.
 * - Applications follow a realistic funnel: most sit early, a few reach
 *   offer, fewer still are hired.
 * - The duplicate-application guard is respected: a candidate never
 *   holds two ACTIVE applications for the same job.
 * - vacanciesFilled is reconciled from actual HIRED applications at the
 *   end, so the dashboard's "open positions" figure is truthful.
 */
import {
  ApplicationStage,
  ApplicationStatus,
  EmploymentType,
  InterviewStatus,
  InterviewType,
  JobStatus,
  OfferStatus,
  OnboardingStatus,
  Priority,
  PrismaClient,
  Recommendation,
  TaskStatus,
  WorkMode,
  type Prisma,
} from '@prisma/client';
import * as argon2 from 'argon2';
import {
  COMPANIES,
  COVER_LETTER_BODIES,
  COVER_LETTER_OPENERS,
  CURRENT_TITLES,
  DECLINE_REASONS,
  DEGREES,
  DEPARTMENTS,
  FIRST_NAMES_FEMALE,
  FIRST_NAMES_MALE,
  INTERVIEW_COMMENTS,
  INTERVIEW_IMPROVEMENTS,
  INTERVIEW_STRENGTHS,
  JOB_TEMPLATES,
  LAST_NAMES,
  LOCATIONS,
  RECRUITER_NOTES,
  REJECTION_REASONS,
  SCREENING_REMARKS,
  SKILL_GROUPS,
  SOURCES,
  UNIVERSITIES,
  WITHDRAW_REASONS,
  type JobTemplate,
} from './demo-data';

const prisma = new PrismaClient();

// ---------------------------------------------------------------------
//  Volume
// ---------------------------------------------------------------------
const TARGET = {
  jobs: 58,
  candidates: 240,
  applicationsPerJob: [4, 22] as [number, number],
  demoDomain: '@demo.hr-ats.local',
};

// ---------------------------------------------------------------------
//  Deterministic RNG
//
//  A fixed seed means repeated runs produce the same shaped dataset,
//  which makes screenshots and bug reports reproducible.
// ---------------------------------------------------------------------
let rngState = 20261015;
function random(): number {
  rngState = (rngState * 1664525 + 1013904223) % 4294967296;
  return rngState / 4294967296;
}
const randomInt = (min: number, max: number) => Math.floor(random() * (max - min + 1)) + min;
const pick = <T>(items: readonly T[]): T => items[Math.floor(random() * items.length)];

function pickMany<T>(items: readonly T[], count: number): T[] {
  const pool = [...items];
  const out: T[] = [];
  for (let i = 0; i < count && pool.length > 0; i += 1) {
    out.push(pool.splice(Math.floor(random() * pool.length), 1)[0]);
  }
  return out;
}

/** Weighted pick: entries with a higher weight are chosen more often. */
function pickWeighted<T extends { weight: number }>(items: readonly T[]): T {
  const total = items.reduce((sum, item) => sum + item.weight, 0);
  let roll = random() * total;
  for (const item of items) {
    roll -= item.weight;
    if (roll <= 0) return item;
  }
  return items[items.length - 1];
}

const chance = (percent: number) => random() * 100 < percent;

const DAY = 86_400_000;
const now = Date.now();

/** A date between `fromDaysAgo` and `toDaysAgo`. */
function dateAgo(fromDaysAgo: number, toDaysAgo = 0): Date {
  const days = randomInt(Math.min(fromDaysAgo, toDaysAgo), Math.max(fromDaysAgo, toDaysAgo));
  return new Date(now - days * DAY - randomInt(0, 23) * 3_600_000);
}

const addDays = (date: Date, days: number) => new Date(date.getTime() + days * DAY);

function slugify(title: string, suffix: string): string {
  const base = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 180);
  return `${base || 'job'}-${suffix}`;
}

// ---------------------------------------------------------------------
//  Reset
// ---------------------------------------------------------------------

/**
 * Removes only data this script created. Demo users are identified by
 * their email domain; cascading deletes take their profiles,
 * applications, interviews, offers and onboarding with them.
 */
async function resetDemoData(): Promise<void> {
  console.log('\nRemoving previous demo data...');

  const demoUsers = await prisma.user.findMany({
    where: { email: { endsWith: TARGET.demoDomain } },
    select: { id: true },
  });
  const demoUserIds = demoUsers.map((user) => user.id);

  const demoJobs = await prisma.jobRequirement.findMany({
    where: { requirementCode: { startsWith: 'JR-DEMO-' } },
    select: { id: true },
  });
  const demoJobIds = demoJobs.map((job) => job.id);

  if (demoJobIds.length > 0) {
    // Explicit order: children before parents, so no FK is ever violated
    // even where onDelete is Restrict rather than Cascade.
    await prisma.interviewFeedback.deleteMany({ where: { interview: { jobId: { in: demoJobIds } } } });
    await prisma.interviewPanelMember.deleteMany({ where: { interview: { jobId: { in: demoJobIds } } } });
    await prisma.interview.deleteMany({ where: { jobId: { in: demoJobIds } } });
    await prisma.onboardingTask.deleteMany({ where: { onboarding: { offer: { jobId: { in: demoJobIds } } } } });
    await prisma.onboardingRecord.deleteMany({ where: { offer: { jobId: { in: demoJobIds } } } });
    await prisma.offerHistory.deleteMany({ where: { offer: { jobId: { in: demoJobIds } } } });
    await prisma.offerApproval.deleteMany({ where: { offer: { jobId: { in: demoJobIds } } } });
    await prisma.offer.deleteMany({ where: { jobId: { in: demoJobIds } } });
    await prisma.applicationStatusHistory.deleteMany({ where: { application: { jobId: { in: demoJobIds } } } });
    await prisma.applicationNote.deleteMany({ where: { application: { jobId: { in: demoJobIds } } } });
    await prisma.jobApplication.deleteMany({ where: { jobId: { in: demoJobIds } } });
    await prisma.jobRequirementHistory.deleteMany({ where: { jobId: { in: demoJobIds } } });
    await prisma.jobApproval.deleteMany({ where: { jobId: { in: demoJobIds } } });
    await prisma.jobSkill.deleteMany({ where: { jobId: { in: demoJobIds } } });
    await prisma.jobRequirement.deleteMany({ where: { id: { in: demoJobIds } } });
  }

  if (demoUserIds.length > 0) {
    await prisma.notification.deleteMany({ where: { userId: { in: demoUserIds } } });
    await prisma.auditLog.deleteMany({ where: { actorUserId: { in: demoUserIds } } });
    // candidate_profiles cascade from users.
    await prisma.user.deleteMany({ where: { id: { in: demoUserIds } } });
  }

  console.log(`  removed ${demoJobIds.length} job(s) and ${demoUserIds.length} demo user(s)`);
}

// ---------------------------------------------------------------------
//  Reference data
// ---------------------------------------------------------------------

async function ensureReferenceData() {
  console.log('\nReference data...');

  for (const department of DEPARTMENTS) {
    await prisma.department.upsert({
      where: { code: department.code },
      create: department,
      update: { name: department.name, description: department.description },
    });
  }
  console.log(`  departments: ${DEPARTMENTS.length}`);

  let skillCount = 0;
  for (const [category, names] of Object.entries(SKILL_GROUPS)) {
    for (const name of names) {
      await prisma.skill.upsert({
        where: { name },
        create: { name, category },
        update: { category },
      });
      skillCount += 1;
    }
  }
  console.log(`  skills: ${skillCount}`);

  for (const source of SOURCES) {
    await prisma.recruitmentSource.upsert({
      where: { name: source.name },
      create: { name: source.name, category: source.category },
      update: { category: source.category },
    });
  }
  console.log(`  recruitment sources: ${SOURCES.length}`);

  const departments = await prisma.department.findMany();
  const skills = await prisma.skill.findMany();
  const sources = await prisma.recruitmentSource.findMany();

  return {
    departmentsByCode: new Map(departments.map((d) => [d.code, d])),
    skillsByName: new Map(skills.map((s) => [s.name, s])),
    sources,
  };
}

// ---------------------------------------------------------------------
//  Staff (existing accounts are reused, never modified)
// ---------------------------------------------------------------------

async function loadStaff() {
  const users = await prisma.user.findMany({
    where: { email: { not: { endsWith: TARGET.demoDomain } } },
    include: { userRoles: { include: { role: true } } },
  });

  const byRole = (role: string) =>
    users.filter((user) => user.userRoles.some((link) => link.role.name === role));

  const staff = {
    superAdmins: byRole('SUPER_ADMIN'),
    hrAdmins: byRole('HR_ADMIN'),
    recruiters: byRole('RECRUITER'),
    managers: byRole('HIRING_MANAGER'),
    interviewers: byRole('INTERVIEWER'),
  };

  if (staff.hrAdmins.length === 0 || staff.recruiters.length === 0) {
    throw new Error(
      'Expected the base staff accounts to exist. Run `npm run seed` first.',
    );
  }

  console.log(
    `\nUsing existing staff: ${staff.superAdmins.length} super admin, ` +
      `${staff.hrAdmins.length} HR, ${staff.recruiters.length} recruiter(s), ` +
      `${staff.managers.length} manager(s), ${staff.interviewers.length} interviewer(s)`,
  );

  return staff;
}

// ---------------------------------------------------------------------
//  Candidates
// ---------------------------------------------------------------------

async function createCandidates(passwordHash: string) {
  console.log(`\nCreating ${TARGET.candidates} candidates...`);

  const candidateRole = await prisma.role.findUniqueOrThrow({ where: { name: 'CANDIDATE' } });
  const year = new Date().getFullYear();
  const usedEmails = new Set<string>();
  const created: Array<{ id: string; userId: string; fullName: string; departmentBias: string }> = [];

  for (let index = 0; index < TARGET.candidates; index += 1) {
    const isFemale = chance(42);
    const firstName = pick(isFemale ? FIRST_NAMES_FEMALE : FIRST_NAMES_MALE);
    const lastName = pick(LAST_NAMES);

    let email = `${firstName}.${lastName}`.toLowerCase().replace(/[^a-z.]/g, '') + TARGET.demoDomain;
    let suffix = 1;
    while (usedEmails.has(email)) {
      suffix += 1;
      email = `${firstName}.${lastName}${suffix}`.toLowerCase().replace(/[^a-z.0-9]/g, '') + TARGET.demoDomain;
    }
    usedEmails.add(email);

    const departmentBias = pick(Object.keys(CURRENT_TITLES));
    const experience = Number((random() * 14).toFixed(1));
    const registeredAt = dateAgo(420, 1);

    // Skills drawn from the pools relevant to their discipline, so a
    // finance candidate does not come out holding Kubernetes.
    const relevantGroups =
      departmentBias === 'ENG' ? ['Programming', 'Frontend', 'Backend', 'Database', 'DevOps', 'Cloud']
      : departmentBias === 'QAE' ? ['Testing', 'Programming']
      : departmentBias === 'DAT' ? ['Data', 'Programming', 'Database']
      : departmentBias === 'SEC' ? ['Security', 'DevOps']
      : departmentBias === 'PRD' ? ['Business', 'Design']
      : departmentBias === 'PMO' ? ['Business']
      : departmentBias === 'ITS' ? ['Support', 'DevOps']
      : departmentBias === 'SAL' ? ['Sales', 'Business']
      : departmentBias === 'MKT' ? ['Marketing', 'Business']
      : departmentBias === 'CSU' ? ['Support', 'Sales']
      : departmentBias === 'FIN' ? ['Finance', 'Business']
      : departmentBias === 'HR' ? ['HR', 'Business']
      : ['Business', 'SoftSkills'];

    const skillPool = relevantGroups.flatMap((group) => SKILL_GROUPS[group] ?? []);
    const chosenSkills = pickMany(skillPool, randomInt(4, 9));
    chosenSkills.push(pick(SKILL_GROUPS.SoftSkills));

    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        firstName,
        lastName,
        phone: `+968 9${randomInt(1000000, 9999999)}`,
        status: 'ACTIVE',
        emailVerifiedAt: registeredAt,
        consentGivenAt: registeredAt,
        createdAt: registeredAt,
        lastLoginAt: chance(70) ? dateAgo(60, 0) : null,
        userRoles: { create: { roleId: candidateRole.id } },
      },
    });

    const profile = await prisma.candidateProfile.create({
      data: {
        candidateCode: `CAND-${year}-D${String(index + 1).padStart(5, '0')}`,
        userId: user.id,
        fullName: `${firstName} ${lastName}`,
        normalisedEmail: email,
        normalisedPhone: user.phone?.replace(/\D/g, '') ?? null,
        mobile: user.phone,
        location: pick(LOCATIONS),
        totalExperience: experience,
        currentDesignation: pick(CURRENT_TITLES[departmentBias] ?? ['Specialist']),
        currentCompany: pick(COMPANIES),
        highestEducation: `${pick(DEGREES)}, ${pick(UNIVERSITIES)}`,
        expectedSalary: Math.round((18000 + experience * 4200 + randomInt(-4000, 9000)) / 500) * 500,
        salaryCurrency: 'USD',
        noticePeriodDays: pick([0, 15, 30, 30, 30, 60, 60, 90]),
        linkedinUrl: chance(65)
          ? `https://linkedin.com/in/${firstName}-${lastName}`.toLowerCase().replace(/[^a-z:/.-]/g, '')
          : null,
        portfolioUrl: chance(18) ? `https://${firstName.toLowerCase()}.dev` : null,
        preferredLocation: chance(60) ? pick(LOCATIONS) : null,
        preferredWorkMode: pick([WorkMode.ONSITE, WorkMode.HYBRID, WorkMode.HYBRID, WorkMode.REMOTE]),
        preferredEmploymentType: EmploymentType.FULL_TIME,
        willingToRelocate: chance(45),
        summary: chance(55)
          ? `${pick(CURRENT_TITLES[departmentBias] ?? ['Specialist'])} with ${Math.floor(experience)} years of experience, currently at ${pick(COMPANIES)}.`
          : null,
        consentToStoreData: true,
        consentAt: registeredAt,
        createdAt: registeredAt,
      },
    });

    // Attach skills.
    const skillRecords = await prisma.skill.findMany({
      where: { name: { in: [...new Set(chosenSkills)] } },
      select: { id: true },
    });
    if (skillRecords.length > 0) {
      await prisma.candidateSkill.createMany({
        data: skillRecords.map((skill) => ({
          candidateId: profile.id,
          skillId: skill.id,
          years: Number(Math.min(experience, random() * experience + 1).toFixed(1)),
          proficiency: pick(['BEGINNER', 'INTERMEDIATE', 'INTERMEDIATE', 'ADVANCED', 'ADVANCED', 'EXPERT'] as const),
        })),
        skipDuplicates: true,
      });
    }

    created.push({
      id: profile.id,
      userId: user.id,
      fullName: profile.fullName,
      departmentBias,
    });

    if ((index + 1) % 60 === 0) console.log(`  ${index + 1}/${TARGET.candidates}`);
  }

  console.log(`  done: ${created.length} candidates`);
  return created;
}

// ---------------------------------------------------------------------
//  Job requirements
// ---------------------------------------------------------------------

type Reference = Awaited<ReturnType<typeof ensureReferenceData>>;
type Staff = Awaited<ReturnType<typeof loadStaff>>;

async function createJobs(reference: Reference, staff: Staff) {
  console.log(`\nCreating ${TARGET.jobs} job requirements...`);

  const year = new Date().getFullYear();
  const created: Array<{
    id: string;
    template: JobTemplate;
    status: JobStatus;
    publishedAt: Date | null;
    vacancies: number;
    recruiterId: string;
    hiringManagerId: string;
    createdAt: Date;
  }> = [];

  // A realistic board is mostly live, with a tail of drafts, holds and
  // completed hiring.
  const statusPlan: JobStatus[] = [
    ...Array<JobStatus>(24).fill(JobStatus.PUBLISHED),
    ...Array<JobStatus>(7).fill(JobStatus.CLOSED),
    ...Array<JobStatus>(6).fill(JobStatus.DRAFT),
    ...Array<JobStatus>(5).fill(JobStatus.PENDING_APPROVAL),
    ...Array<JobStatus>(5).fill(JobStatus.APPROVED),
    ...Array<JobStatus>(4).fill(JobStatus.ON_HOLD),
    ...Array<JobStatus>(2).fill(JobStatus.CANCELLED),
  ];

  for (let index = 0; index < TARGET.jobs; index += 1) {
    const template = JOB_TEMPLATES[index % JOB_TEMPLATES.length];
    const department = reference.departmentsByCode.get(template.department);
    if (!department) continue;

    const status = statusPlan[index % statusPlan.length];
    const createdAt = dateAgo(400, 5);
    const isLive = status === JobStatus.PUBLISHED || status === JobStatus.CLOSED || status === JobStatus.ON_HOLD;
    const publishedAt = isLive ? addDays(createdAt, randomInt(2, 12)) : null;

    const recruiter = pick(staff.recruiters);
    const manager = staff.managers.length > 0 ? pick(staff.managers) : pick(staff.hrAdmins);
    const requester = pick([...staff.hrAdmins, ...staff.managers]);
    const vacancies = chance(22) ? randomInt(2, 5) : 1;

    // A second instance of the same template gets a location suffix so
    // the board does not look like it is repeating itself.
    const repeatCount = Math.floor(index / JOB_TEMPLATES.length);
    const location = pick(LOCATIONS);
    const title = repeatCount > 0 ? `${template.title} — ${location.split(',')[0]}` : template.title;

    const job = await prisma.jobRequirement.create({
      data: {
        requirementCode: `JR-DEMO-${year}-${String(index + 1).padStart(4, '0')}`,
        slug: slugify(title, `d${index + 1}`),
        title,
        description:
          `${template.summary}\n\n` +
          `Business Gateways is a leading regional provider of B2B e-procurement and ` +
          `supply-chain solutions, working with government entities and large private-sector ` +
          `organisations across Oman and the wider Gulf.`,
        responsibilities: template.responsibilities.map((line) => `• ${line}`).join('\n'),
        qualifications: template.qualifications.map((line) => `• ${line}`).join('\n'),
        internalNotes: chance(45)
          ? pick([
              'Budget approved in the current financial year. Backfill for an internal move.',
              'Replacement hire — incumbent resigned, handover required before the end of the quarter.',
              'New headcount approved by the leadership team. Priority role.',
              'Hiring manager has asked to see at least five shortlisted candidates before deciding.',
              'Role previously advertised and withdrawn; scope has since been revised.',
            ])
          : null,
        minExperience: template.minExp,
        maxExperience: template.maxExp,
        departmentId: department.id,
        designation: template.designation,
        vacancies,
        vacanciesFilled: 0, // reconciled at the end from actual hires
        employmentType: chance(8)
          ? pick([EmploymentType.CONTRACT, EmploymentType.INTERNSHIP, EmploymentType.PART_TIME])
          : EmploymentType.FULL_TIME,
        workMode: pick([WorkMode.ONSITE, WorkMode.ONSITE, WorkMode.HYBRID, WorkMode.HYBRID, WorkMode.REMOTE]),
        location,
        salaryMin: template.salaryMin,
        salaryMax: template.salaryMax,
        salaryCurrency: 'USD',
        // Most roles keep pay confidential; a minority advertise it.
        salaryConfidential: !chance(35),
        priority: pick([Priority.LOW, Priority.MEDIUM, Priority.MEDIUM, Priority.HIGH, Priority.HIGH, Priority.CRITICAL]),
        status,
        requestedById: requester.id,
        requestDate: createdAt,
        recruiterId: recruiter.id,
        hiringManagerId: manager.id,
        createdById: requester.id,
        publishedAt,
        applicationDeadline:
          isLive && chance(55) ? addDays(publishedAt ?? createdAt, randomInt(25, 110)) : null,
        closedAt: status === JobStatus.CLOSED ? dateAgo(60, 2) : null,
        onHoldReason:
          status === JobStatus.ON_HOLD
            ? pick([
                'Headcount paused pending budget review for the next quarter.',
                'Hiring manager on extended leave; resuming on their return.',
                'Awaiting confirmation of the client contract that funds this role.',
              ])
            : null,
        cancelReason:
          status === JobStatus.CANCELLED
            ? pick([
                'Requirement withdrawn — work absorbed by the existing team.',
                'Budget reallocated to a higher-priority programme.',
              ])
            : null,
        createdAt,
        updatedAt: createdAt,
      },
    });

    // ---- Skills ----
    const requiredSkills = await prisma.skill.findMany({ where: { name: { in: template.required } } });
    const preferredSkills = await prisma.skill.findMany({ where: { name: { in: template.preferred } } });

    if (requiredSkills.length + preferredSkills.length > 0) {
      await prisma.jobSkill.createMany({
        data: [
          ...requiredSkills.map((skill) => ({
            jobId: job.id,
            skillId: skill.id,
            isRequired: true,
            minYears: Math.max(1, template.minExp - 1),
          })),
          ...preferredSkills.map((skill) => ({
            jobId: job.id,
            skillId: skill.id,
            isRequired: false,
          })),
        ],
        skipDuplicates: true,
      });
    }

    // ---- Approval trail for anything past draft ----
    if (status !== JobStatus.DRAFT && status !== JobStatus.CANCELLED) {
      const approver = pick(staff.hrAdmins);
      const decided = status !== JobStatus.PENDING_APPROVAL;
      await prisma.jobApproval.create({
        data: {
          jobId: job.id,
          approverId: approver.id,
          sequence: 1,
          decision: decided ? 'APPROVED' : 'PENDING',
          comments: decided
            ? pick([
                'Approved. Budget confirmed for this financial year.',
                'Approved — please prioritise local candidates where possible.',
                'Approved. Keep the panel to three rounds maximum.',
                'Approved.',
              ])
            : null,
          decidedAt: decided ? addDays(createdAt, randomInt(1, 6)) : null,
          createdAt: addDays(createdAt, 1),
        },
      });

      await prisma.jobRequirementHistory.createMany({
        data: [
          {
            jobId: job.id,
            changedById: requester.id,
            fieldName: 'status',
            oldValue: 'DRAFT',
            newValue: 'PENDING_APPROVAL',
            changedAt: addDays(createdAt, 1),
          },
          ...(decided
            ? [{
                jobId: job.id,
                changedById: approver.id,
                fieldName: 'status',
                oldValue: 'PENDING_APPROVAL',
                newValue: 'APPROVED',
                changedAt: addDays(createdAt, randomInt(2, 6)),
              }]
            : []),
          ...(publishedAt
            ? [{
                jobId: job.id,
                changedById: pick(staff.hrAdmins).id,
                fieldName: 'status',
                oldValue: 'APPROVED',
                newValue: 'PUBLISHED',
                changedAt: publishedAt,
              }]
            : []),
        ],
      });
    }

    created.push({
      id: job.id,
      template,
      status,
      publishedAt,
      vacancies,
      recruiterId: recruiter.id,
      hiringManagerId: manager.id,
      createdAt,
    });

    if ((index + 1) % 20 === 0) console.log(`  ${index + 1}/${TARGET.jobs}`);
  }

  console.log(`  done: ${created.length} jobs`);
  return created;
}

// ---------------------------------------------------------------------
//  Applications, interviews, offers, onboarding
// ---------------------------------------------------------------------

/** Where an application ends up, as a realistic funnel. */
const FUNNEL: Array<{ stage: ApplicationStage; status: ApplicationStatus; weight: number }> = [
  { stage: 'APPLIED', status: 'ACTIVE', weight: 18 },
  { stage: 'RESUME_SCREENING', status: 'ACTIVE', weight: 12 },
  { stage: 'HR_SCREENING', status: 'ACTIVE', weight: 8 },
  { stage: 'SHORTLISTED', status: 'ACTIVE', weight: 7 },
  { stage: 'ASSESSMENT', status: 'ACTIVE', weight: 4 },
  { stage: 'TECHNICAL_INTERVIEW', status: 'ACTIVE', weight: 6 },
  { stage: 'HR_INTERVIEW', status: 'ACTIVE', weight: 4 },
  { stage: 'FINAL_INTERVIEW', status: 'ACTIVE', weight: 3 },
  { stage: 'SELECTED', status: 'ACTIVE', weight: 2 },
  { stage: 'OFFER_RELEASED', status: 'ACTIVE', weight: 2 },
  { stage: 'OFFER_ACCEPTED', status: 'ACTIVE', weight: 2 },
  { stage: 'HIRED', status: 'HIRED', weight: 4 },
  // Rejections dominate real pipelines, spread across the stages where
  // they actually happen.
  { stage: 'RESUME_SCREENING', status: 'REJECTED', weight: 14 },
  { stage: 'HR_SCREENING', status: 'REJECTED', weight: 7 },
  { stage: 'TECHNICAL_INTERVIEW', status: 'REJECTED', weight: 6 },
  { stage: 'FINAL_INTERVIEW', status: 'REJECTED', weight: 3 },
  { stage: 'ASSESSMENT', status: 'REJECTED', weight: 3 },
  { stage: 'APPLIED', status: 'WITHDRAWN', weight: 2 },
  { stage: 'TECHNICAL_INTERVIEW', status: 'WITHDRAWN', weight: 2 },
  { stage: 'OFFER_RELEASED', status: 'OFFER_DECLINED', weight: 2 },
];

const STAGE_SEQUENCE: ApplicationStage[] = [
  'APPLIED', 'RESUME_SCREENING', 'HR_SCREENING', 'SHORTLISTED', 'ASSESSMENT',
  'TECHNICAL_INTERVIEW', 'HR_INTERVIEW', 'FINAL_INTERVIEW', 'SELECTED',
  'OFFER_RELEASED', 'OFFER_ACCEPTED', 'HIRED',
];

async function createApplications(
  jobs: Awaited<ReturnType<typeof createJobs>>,
  candidates: Awaited<ReturnType<typeof createCandidates>>,
  reference: Reference,
  staff: Staff,
) {
  console.log('\nCreating applications, interviews, offers and onboarding...');

  const year = new Date().getFullYear();
  const openJobs = jobs.filter((job) => job.publishedAt !== null);
  let applicationCount = 0;
  let interviewCount = 0;
  let feedbackCount = 0;
  let offerCount = 0;
  let onboardingCount = 0;
  let noteCount = 0;

  const hiresPerJob = new Map<string, number>();

  for (const job of openJobs) {
    const target = randomInt(...TARGET.applicationsPerJob);

    // Favour candidates whose background matches the department, so the
    // pipeline does not look randomly assembled.
    const matching = candidates.filter((c) => c.departmentBias === job.template.department);
    const pool = matching.length >= target ? matching : candidates;
    const applicants = pickMany(pool, Math.min(target, pool.length));

    for (const candidate of applicants) {
      const outcome = pickWeighted(FUNNEL);
      const appliedAt = dateAgo(
        Math.max(5, Math.floor((now - (job.publishedAt as Date).getTime()) / DAY)),
        2,
      );
      if (appliedAt < (job.publishedAt as Date)) continue;

      const isTerminal = outcome.status !== 'ACTIVE';
      const source = pickWeighted(SOURCES);
      const sourceRecord = reference.sources.find((s) => s.name === source.name);

      const stageIndex = STAGE_SEQUENCE.indexOf(outcome.stage);
      const daysAvailable = Math.max(1, Math.floor((now - appliedAt.getTime()) / DAY));
      const stageEnteredAt = addDays(appliedAt, Math.min(daysAvailable - 1, stageIndex * randomInt(2, 6)));

      let application;
      try {
        application = await prisma.jobApplication.create({
          data: {
            applicationCode: `APP-${year}-D${String(applicationCount + 1).padStart(6, '0')}`,
            candidateId: candidate.id,
            jobId: job.id,
            // NULL for terminal applications releases the unique index,
            // so the candidate could apply for this job again later.
            activeJobKey: isTerminal ? null : job.id,
            appliedAt,
            coverLetter: chance(45)
              ? `${pick(COVER_LETTER_OPENERS).replace('{title}', job.template.title)}\n\n${pick(COVER_LETTER_BODIES)}\n\nI would welcome the opportunity to discuss my application further.`
              : null,
            sourceId: sourceRecord?.id,
            recruiterId: job.recruiterId,
            currentStage: outcome.stage,
            status: outcome.status,
            screeningResult:
              stageIndex >= 1
                ? outcome.status === 'REJECTED' && stageIndex <= 2 ? 'FAIL' : 'PASS'
                : 'NOT_SCREENED',
            screeningRemarks: stageIndex >= 1 && chance(60) ? pick(SCREENING_REMARKS) : null,
            rejectionReason: outcome.status === 'REJECTED' ? pick(REJECTION_REASONS) : null,
            withdrawReason: outcome.status === 'WITHDRAWN' ? pick(WITHDRAW_REASONS) : null,
            stageEnteredAt,
            followUpDueAt:
              !isTerminal && chance(55)
                ? addDays(stageEnteredAt, randomInt(-8, 10))
                : null,
            createdAt: appliedAt,
          },
        });
      } catch {
        // Unique guard fired (same candidate already live on this job).
        continue;
      }

      applicationCount += 1;

      // ---- Status history: one row per stage actually traversed ----
      const history: Prisma.ApplicationStatusHistoryCreateManyInput[] = [];
      let previousStage: ApplicationStage | null = null;
      let cursor = appliedAt;

      for (let step = 0; step <= stageIndex; step += 1) {
        const stage = STAGE_SEQUENCE[step];
        const changedAt = step === 0 ? appliedAt : addDays(cursor, randomInt(1, 7));
        if (changedAt.getTime() > now) break;

        history.push({
          applicationId: application.id,
          fromStage: previousStage,
          toStage: stage,
          fromStatus: step === 0 ? null : 'ACTIVE',
          toStatus: 'ACTIVE',
          changedById: step === 0 ? candidate.userId : job.recruiterId,
          reason: step === 0 ? 'Application submitted' : null,
          durationSeconds: step === 0 ? null : Math.floor((changedAt.getTime() - cursor.getTime()) / 1000),
          changedAt,
        });

        previousStage = stage;
        cursor = changedAt;
      }

      // Terminal outcome gets its own closing row.
      if (isTerminal) {
        history.push({
          applicationId: application.id,
          fromStage: outcome.stage,
          toStage: outcome.stage,
          fromStatus: 'ACTIVE',
          toStatus: outcome.status,
          changedById: outcome.status === 'WITHDRAWN' ? candidate.userId : job.recruiterId,
          reason:
            outcome.status === 'REJECTED' ? pick(REJECTION_REASONS)
            : outcome.status === 'WITHDRAWN' ? pick(WITHDRAW_REASONS)
            : outcome.status === 'OFFER_DECLINED' ? pick(DECLINE_REASONS)
            : 'Candidate joined',
          durationSeconds: randomInt(3600, 20 * 86400),
          changedAt: addDays(cursor, randomInt(1, 5)),
        });
      }

      if (history.length > 0) {
        await prisma.applicationStatusHistory.createMany({ data: history });
      }

      // ---- Recruiter notes ----
      if (chance(35)) {
        await prisma.applicationNote.create({
          data: {
            applicationId: application.id,
            authorId: job.recruiterId,
            body: pick(RECRUITER_NOTES),
            isInternal: true,
            createdAt: addDays(appliedAt, randomInt(1, 10)),
          },
        });
        noteCount += 1;
      }

      // ---- Interviews for anyone who got that far ----
      const reachedInterview = stageIndex >= STAGE_SEQUENCE.indexOf('TECHNICAL_INTERVIEW');
      if (reachedInterview && staff.interviewers.length > 0) {
        const rounds = Math.min(
          stageIndex - STAGE_SEQUENCE.indexOf('ASSESSMENT'),
          chance(40) ? 3 : 2,
        );

        for (let round = 1; round <= Math.max(1, rounds); round += 1) {
          const scheduledStart = addDays(stageEnteredAt, round * randomInt(2, 7));
          const isPast = scheduledStart.getTime() < now;
          const panel = pickMany(staff.interviewers, Math.min(randomInt(1, 2), staff.interviewers.length));
          if (panel.length === 0) break;

          const roundName =
            round === 1 ? 'Technical Round 1'
            : round === 2 ? (chance(50) ? 'Technical Round 2' : 'HR Round')
            : 'Final Round with Hiring Manager';

          const interviewStatus: InterviewStatus =
            !isPast ? InterviewStatus.SCHEDULED
            : outcome.status === 'WITHDRAWN' && chance(40) ? InterviewStatus.CANCELLED
            : chance(6) ? InterviewStatus.NO_SHOW
            : InterviewStatus.COMPLETED;

          const interview = await prisma.interview.create({
            data: {
              interviewCode: `INT-${year}-D${String(interviewCount + 1).padStart(6, '0')}`,
              applicationId: application.id,
              candidateId: candidate.id,
              jobId: job.id,
              round,
              roundName,
              interviewType:
                round === 1 ? InterviewType.TECHNICAL
                : roundName.startsWith('HR') ? InterviewType.HR
                : pick([InterviewType.VIDEO, InterviewType.PANEL, InterviewType.ONSITE]),
              scheduledStart,
              scheduledEnd: new Date(scheduledStart.getTime() + randomInt(45, 90) * 60_000),
              timeZone: 'Asia/Muscat',
              meetingLink: chance(70) ? `https://meet.businessgateways.com/${application.applicationCode.toLowerCase()}-r${round}` : null,
              venue: chance(30) ? 'Knowledge Oasis Muscat, Building 3, Meeting Room 2' : null,
              instructions: chance(40)
                ? 'Please join five minutes early. The first 10 minutes will cover your background, followed by a technical discussion.'
                : null,
              status: interviewStatus,
              cancelReason: interviewStatus === InterviewStatus.CANCELLED ? 'Candidate withdrew from the process.' : null,
              organiserId: job.recruiterId,
              createdAt: addDays(stageEnteredAt, 1),
            },
          });
          interviewCount += 1;

          await prisma.interviewPanelMember.createMany({
            data: panel.map((member, position) => ({
              interviewId: interview.id,
              interviewerId: member.id,
              isLead: position === 0,
              invitedAt: addDays(stageEnteredAt, 1),
              respondedAt: addDays(stageEnteredAt, 2),
              accepted: true,
            })),
          });

          // ---- Feedback for completed interviews ----
          if (interviewStatus === InterviewStatus.COMPLETED && chance(85)) {
            // Candidates who progressed score better than those who did not.
            const progressed = outcome.status !== 'REJECTED';
            const base = progressed ? randomInt(3, 5) : randomInt(1, 3);

            for (const member of panel) {
              const overall = Math.max(1, Math.min(5, base + (chance(30) ? randomInt(-1, 1) : 0)));
              await prisma.interviewFeedback.create({
                data: {
                  interviewId: interview.id,
                  interviewerId: member.id,
                  technicalSkills: Math.max(1, Math.min(5, overall + randomInt(-1, 1))),
                  communication: Math.max(1, Math.min(5, overall + randomInt(-1, 1))),
                  problemSolving: Math.max(1, Math.min(5, overall + randomInt(-1, 1))),
                  relevantExperience: Math.max(1, Math.min(5, overall + randomInt(-1, 1))),
                  roleSuitability: overall,
                  teamCollaboration: Math.max(1, Math.min(5, overall + randomInt(-1, 1))),
                  overallRating: overall,
                  strengths: pick(INTERVIEW_STRENGTHS),
                  areasForImprovement: chance(70) ? pick(INTERVIEW_IMPROVEMENTS) : null,
                  comments: chance(60) ? pick(INTERVIEW_COMMENTS) : null,
                  recommendation:
                    overall >= 5 ? Recommendation.STRONG_HIRE
                    : overall === 4 ? Recommendation.HIRE
                    : overall === 3 ? Recommendation.HOLD
                    : Recommendation.NO_HIRE,
                  submittedAt: addDays(scheduledStart, randomInt(0, 3)),
                },
              });
              feedbackCount += 1;
            }
          }
        }
      }

      // ---- Offers ----
      const reachedOffer = stageIndex >= STAGE_SEQUENCE.indexOf('OFFER_RELEASED');
      if (reachedOffer) {
        const offerStatus: OfferStatus =
          outcome.status === 'HIRED' ? OfferStatus.ACCEPTED
          : outcome.status === 'OFFER_DECLINED' ? OfferStatus.DECLINED
          : outcome.stage === 'OFFER_ACCEPTED' ? OfferStatus.ACCEPTED
          : OfferStatus.SENT;

        const issuedAt = addDays(stageEnteredAt, randomInt(1, 5));
        const salary =
          Math.round(
            (job.template.salaryMin +
              random() * (job.template.salaryMax - job.template.salaryMin)) / 500,
          ) * 500;
        const joiningDate = addDays(issuedAt, randomInt(30, 75));

        const offer = await prisma.offer.create({
          data: {
            offerCode: `OFR-${year}-D${String(offerCount + 1).padStart(6, '0')}`,
            applicationId: application.id,
            candidateId: candidate.id,
            jobId: job.id,
            proposedDesignation: job.template.designation,
            departmentName: reference.departmentsByCode.get(job.template.department)?.name,
            annualSalary: salary,
            currency: 'USD',
            bonus: chance(45) ? Math.round(salary * 0.1) : null,
            benefits: 'Medical insurance for employee and dependants, 30 days annual leave, annual flight allowance, and an annual performance bonus.',
            joiningDate,
            issuedAt,
            expiresAt: addDays(issuedAt, 14),
            status: offerStatus,
            declineReason: offerStatus === OfferStatus.DECLINED ? pick(DECLINE_REASONS) : null,
            respondedAt:
              offerStatus === OfferStatus.ACCEPTED || offerStatus === OfferStatus.DECLINED
                ? addDays(issuedAt, randomInt(2, 11))
                : null,
            createdById: pick(staff.hrAdmins).id,
            createdAt: addDays(stageEnteredAt, 1),
          },
        });
        offerCount += 1;

        await prisma.offerApproval.create({
          data: {
            offerId: offer.id,
            approverId: pick(staff.hrAdmins).id,
            sequence: 1,
            decision: 'APPROVED',
            comments: 'Approved. Compensation within the agreed band for this grade.',
            decidedAt: addDays(stageEnteredAt, 1),
            createdAt: addDays(stageEnteredAt, 1),
          },
        });

        await prisma.offerHistory.createMany({
          data: [
            { offerId: offer.id, fromStatus: null, toStatus: OfferStatus.DRAFT, changedById: offer.createdById, changedAt: addDays(stageEnteredAt, 1) },
            { offerId: offer.id, fromStatus: OfferStatus.DRAFT, toStatus: OfferStatus.PENDING_APPROVAL, changedById: offer.createdById, changedAt: addDays(stageEnteredAt, 1) },
            { offerId: offer.id, fromStatus: OfferStatus.PENDING_APPROVAL, toStatus: OfferStatus.APPROVED, changedById: offer.createdById, changedAt: addDays(stageEnteredAt, 2) },
            { offerId: offer.id, fromStatus: OfferStatus.APPROVED, toStatus: OfferStatus.SENT, changedById: offer.createdById, changedAt: issuedAt },
            ...(offerStatus === OfferStatus.ACCEPTED || offerStatus === OfferStatus.DECLINED
              ? [{
                  offerId: offer.id,
                  fromStatus: OfferStatus.SENT,
                  toStatus: offerStatus,
                  changedById: candidate.userId,
                  reason: offerStatus === OfferStatus.DECLINED ? pick(DECLINE_REASONS) : null,
                  changedAt: addDays(issuedAt, randomInt(2, 11)),
                }]
              : []),
          ],
        });

        // ---- Onboarding for accepted offers ----
        if (offerStatus === OfferStatus.ACCEPTED) {
          const joined = outcome.status === 'HIRED';
          const onboardingStatus: OnboardingStatus =
            joined ? OnboardingStatus.JOINED
            : chance(20) ? OnboardingStatus.DID_NOT_JOIN
            : chance(55) ? OnboardingStatus.PREBOARDING
            : OnboardingStatus.OFFER_ACCEPTED;

          const onboarding = await prisma.onboardingRecord.create({
            data: {
              onboardingCode: `ONB-${year}-D${String(onboardingCount + 1).padStart(6, '0')}`,
              applicationId: application.id,
              offerId: offer.id,
              candidateId: candidate.id,
              status: onboardingStatus,
              joiningDate,
              actualJoinDate: onboardingStatus === OnboardingStatus.JOINED ? joiningDate : null,
              departmentId: reference.departmentsByCode.get(job.template.department)?.id,
              designation: job.template.designation,
              reportingManagerId: job.hiringManagerId,
              employeeCode:
                onboardingStatus === OnboardingStatus.JOINED
                  ? `BG-${year}-${String(onboardingCount + 1001).padStart(4, '0')}`
                  : null,
              didNotJoinReason:
                onboardingStatus === OnboardingStatus.DID_NOT_JOIN
                  ? pick([
                      'Accepted a counter-offer from their current employer before the start date.',
                      'Could not obtain a release letter in time for the agreed joining date.',
                      'Personal circumstances changed; unable to relocate.',
                    ])
                  : null,
              documentsVerified: onboardingStatus === OnboardingStatus.JOINED,
              verifiedAt: onboardingStatus === OnboardingStatus.JOINED ? addDays(joiningDate, -5) : null,
              createdAt: addDays(issuedAt, randomInt(2, 11)),
            },
          });
          onboardingCount += 1;

          const checklist = [
            { title: 'Collect signed offer letter', category: 'DOCUMENTATION', isMandatory: true },
            { title: 'Verify identity documents', category: 'DOCUMENTATION', isMandatory: true },
            { title: 'Verify education certificates', category: 'DOCUMENTATION', isMandatory: true },
            { title: 'Collect previous experience letters', category: 'DOCUMENTATION', isMandatory: false },
            { title: 'Background verification', category: 'HR', isMandatory: true },
            { title: 'Create employee record and payroll setup', category: 'HR', isMandatory: true },
            { title: 'Provision laptop and accessories', category: 'IT', isMandatory: true },
            { title: 'Create email and system accounts', category: 'IT', isMandatory: true },
            { title: 'Assign reporting manager and buddy', category: 'HR', isMandatory: true },
            { title: 'Schedule day-one orientation', category: 'TRAINING', isMandatory: true },
          ];

          await prisma.onboardingTask.createMany({
            data: checklist.map((task, position) => ({
              onboardingId: onboarding.id,
              title: task.title,
              category: task.category,
              isMandatory: task.isMandatory,
              sequence: position,
              dueDate: addDays(joiningDate, -randomInt(1, 10)),
              ownerUserId: task.category === 'IT' ? null : pick(staff.hrAdmins).id,
              status:
                onboardingStatus === OnboardingStatus.JOINED ? TaskStatus.COMPLETED
                : onboardingStatus === OnboardingStatus.DID_NOT_JOIN ? TaskStatus.CANCELLED
                : onboardingStatus === OnboardingStatus.PREBOARDING
                  ? (position < 5 ? TaskStatus.COMPLETED : chance(40) ? TaskStatus.IN_PROGRESS : TaskStatus.PENDING)
                  : TaskStatus.PENDING,
              completedAt: onboardingStatus === OnboardingStatus.JOINED ? addDays(joiningDate, -randomInt(1, 8)) : null,
              createdAt: addDays(issuedAt, randomInt(2, 11)),
            })),
          });
        }
      }

      if (outcome.status === 'HIRED') {
        hiresPerJob.set(job.id, (hiresPerJob.get(job.id) ?? 0) + 1);
      }
    }
  }

  console.log(
    `  applications ${applicationCount} · interviews ${interviewCount} · ` +
      `feedback ${feedbackCount} · offers ${offerCount} · onboarding ${onboardingCount} · notes ${noteCount}`,
  );

  return { applicationCount, hiresPerJob };
}

// ---------------------------------------------------------------------
//  Reconciliation and extras
// ---------------------------------------------------------------------

/**
 * Sets vacanciesFilled from the actual number of HIRED applications,
 * capped at the approved headcount. Without this the dashboard's "open
 * positions" figure would be fiction.
 */
async function reconcileVacancies(hiresPerJob: Map<string, number>) {
  console.log('\nReconciling filled vacancies against actual hires...');
  let updated = 0;

  for (const [jobId, hires] of hiresPerJob) {
    const job = await prisma.jobRequirement.findUnique({
      where: { id: jobId },
      select: { vacancies: true },
    });
    if (!job) continue;

    await prisma.jobRequirement.update({
      where: { id: jobId },
      data: { vacanciesFilled: Math.min(hires, job.vacancies) },
    });
    updated += 1;
  }

  console.log(`  updated ${updated} job(s)`);
}

async function createCandidateTags(candidates: Awaited<ReturnType<typeof createCandidates>>, staff: Staff) {
  console.log('\nTagging candidates...');

  const tags = await prisma.candidateTag.findMany();
  if (tags.length === 0) return;

  let tagged = 0;
  for (const candidate of candidates) {
    if (!chance(22)) continue;
    const tag = pick(tags);
    await prisma.candidateTagLink
      .create({
        data: {
          candidateId: candidate.id,
          tagId: tag.id,
          assignedById: pick(staff.recruiters).id,
          assignedAt: dateAgo(200, 1),
        },
      })
      .then(() => { tagged += 1; })
      .catch(() => undefined);
  }

  console.log(`  tagged ${tagged} candidate(s)`);
}

async function createNotifications(staff: Staff) {
  console.log('\nGenerating in-app notifications for staff...');

  const recipients = [...staff.hrAdmins, ...staff.recruiters, ...staff.managers];
  const templates = [
    { title: 'New application received', body: 'A candidate has applied for a role you are recruiting for.', category: 'APPLICATION', link: '/applications' },
    { title: 'Interview feedback overdue', body: 'Feedback is outstanding for an interview that has already taken place.', category: 'REMINDER', link: '/interviews' },
    { title: 'Approval needed', body: 'A job requirement has been submitted for your approval.', category: 'APPROVAL', link: '/job-approvals' },
    { title: 'Offer accepted', body: 'A candidate has accepted their offer. Onboarding has been created.', category: 'OFFER', link: '/onboarding' },
    { title: 'Follow-up overdue', body: 'Applications in your pipeline are past their follow-up date.', category: 'REMINDER', link: '/applications?overdueOnly=true' },
    { title: 'Candidate withdrew', body: 'A shortlisted candidate has withdrawn their application.', category: 'APPLICATION', link: '/applications' },
  ];

  const rows: Prisma.NotificationCreateManyInput[] = [];
  for (const user of recipients) {
    for (let i = 0; i < randomInt(3, 9); i += 1) {
      const template = pick(templates);
      const createdAt = dateAgo(30, 0);
      rows.push({
        userId: user.id,
        title: template.title,
        body: template.body,
        link: template.link,
        category: template.category,
        channel: 'IN_APP',
        readAt: chance(45) ? addDays(createdAt, 1) : null,
        createdAt,
      });
    }
  }

  await prisma.notification.createMany({ data: rows });
  console.log(`  created ${rows.length} notification(s)`);
}

// ---------------------------------------------------------------------
//  Main
// ---------------------------------------------------------------------

async function main() {
  const shouldReset = process.argv.includes('--reset');

  console.log('='.repeat(62));
  console.log('  HR-ATS demo data generator');
  console.log('='.repeat(62));
  console.log('\nExisting staff accounts and their passwords are NOT modified.');

  if (shouldReset) await resetDemoData();

  const reference = await ensureReferenceData();
  const staff = await loadStaff();

  // Hashed once and reused across demo candidates. Argon2id takes ~100ms
  // per hash by design, so hashing 240 times would add ~25 seconds for
  // no benefit in a demo dataset. Real accounts are hashed individually.
  const password = process.env.SEED_DEFAULT_PASSWORD;
  if (!password) throw new Error('SEED_DEFAULT_PASSWORD must be set.');
  console.log('\nHashing the demo candidate password (Argon2id)...');
  const passwordHash = await argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1,
  });

  const candidates = await createCandidates(passwordHash);
  const jobs = await createJobs(reference, staff);
  const { hiresPerJob } = await createApplications(jobs, candidates, reference, staff);

  await reconcileVacancies(hiresPerJob);
  await createCandidateTags(candidates, staff);
  await createNotifications(staff);

  // ---- Summary straight from the database ----
  const counts = {
    departments: await prisma.department.count(),
    skills: await prisma.skill.count(),
    users: await prisma.user.count(),
    candidates: await prisma.candidateProfile.count(),
    jobs: await prisma.jobRequirement.count(),
    publishedJobs: await prisma.jobRequirement.count({ where: { status: 'PUBLISHED' } }),
    applications: await prisma.jobApplication.count(),
    statusHistory: await prisma.applicationStatusHistory.count(),
    interviews: await prisma.interview.count(),
    feedback: await prisma.interviewFeedback.count(),
    offers: await prisma.offer.count(),
    onboarding: await prisma.onboardingRecord.count(),
    onboardingTasks: await prisma.onboardingTask.count(),
    notifications: await prisma.notification.count(),
    notes: await prisma.applicationNote.count(),
  };

  console.log(`\n${'='.repeat(62)}`);
  console.log('  Database totals');
  console.log('='.repeat(62));
  for (const [key, value] of Object.entries(counts)) {
    console.log(`  ${key.padEnd(20)} ${String(value).padStart(6)}`);
  }

  const hired = await prisma.jobApplication.count({ where: { status: 'HIRED' } });
  const active = await prisma.jobApplication.count({ where: { status: 'ACTIVE' } });
  const rejected = await prisma.jobApplication.count({ where: { status: 'REJECTED' } });
  console.log(`\n  pipeline: ${active} active · ${hired} hired · ${rejected} rejected`);
  console.log(`\n  Demo candidates sign in with the same password as the staff accounts.`);
  console.log(`  Their emails end in ${TARGET.demoDomain}\n`);
}

main()
  .catch((error) => {
    console.error('\nDemo seed failed:', error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
