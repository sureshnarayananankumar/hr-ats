/**
 * Removes the "Smoke Test Engineer" requisitions that scripts/smoke-test.sh
 * creates each time it runs.
 *
 * They are functional test artifacts, not demo content, and they clutter
 * the careers portal. Running the smoke suite again will create new ones;
 * re-run this afterwards to tidy up.
 *
 * Scope is deliberately narrow: it matches ONLY requisitions titled
 * "Smoke Test Engineer" and deletes their dependent rows in
 * foreign-key-safe order. Nothing else is touched.
 *
 * Run from the backend directory so @prisma/client resolves:
 *
 *   cd backend
 *   node scripts/clean-test-artifacts.mjs           # dry run
 *   node scripts/clean-test-artifacts.mjs --delete  # actually delete
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const shouldDelete = process.argv.includes('--delete');

async function main() {
  const jobs = await prisma.jobRequirement.findMany({
    where: { title: { contains: 'Smoke Test' } },
    select: {
      id: true,
      requirementCode: true,
      title: true,
      _count: { select: { applications: true, interviews: true } },
    },
  });

  if (jobs.length === 0) {
    console.log('No test artifacts found. Nothing to do.');
    return;
  }

  console.log(`Found ${jobs.length} test requisition(s):\n`);
  for (const job of jobs) {
    console.log(
      `  ${job.requirementCode}  ${job.title}  ` +
        `(${job._count.applications} application(s), ${job._count.interviews} interview(s))`,
    );
  }

  if (!shouldDelete) {
    console.log('\nDry run. Re-run with --delete to remove them.');
    return;
  }

  const ids = jobs.map((job) => job.id);

  // Children first, so no foreign key is ever violated.
  const removed = {
    feedback: (await prisma.interviewFeedback.deleteMany({ where: { interview: { jobId: { in: ids } } } })).count,
    panel: (await prisma.interviewPanelMember.deleteMany({ where: { interview: { jobId: { in: ids } } } })).count,
    interviews: (await prisma.interview.deleteMany({ where: { jobId: { in: ids } } })).count,
    onboardingTasks: (await prisma.onboardingTask.deleteMany({ where: { onboarding: { offer: { jobId: { in: ids } } } } })).count,
    onboarding: (await prisma.onboardingRecord.deleteMany({ where: { offer: { jobId: { in: ids } } } })).count,
    offerHistory: (await prisma.offerHistory.deleteMany({ where: { offer: { jobId: { in: ids } } } })).count,
    offerApprovals: (await prisma.offerApproval.deleteMany({ where: { offer: { jobId: { in: ids } } } })).count,
    offers: (await prisma.offer.deleteMany({ where: { jobId: { in: ids } } })).count,
    statusHistory: (await prisma.applicationStatusHistory.deleteMany({ where: { application: { jobId: { in: ids } } } })).count,
    applicationNotes: (await prisma.applicationNote.deleteMany({ where: { application: { jobId: { in: ids } } } })).count,
    applications: (await prisma.jobApplication.deleteMany({ where: { jobId: { in: ids } } })).count,
    jobHistory: (await prisma.jobRequirementHistory.deleteMany({ where: { jobId: { in: ids } } })).count,
    jobApprovals: (await prisma.jobApproval.deleteMany({ where: { jobId: { in: ids } } })).count,
    jobSkills: (await prisma.jobSkill.deleteMany({ where: { jobId: { in: ids } } })).count,
    jobs: (await prisma.jobRequirement.deleteMany({ where: { id: { in: ids } } })).count,
  };

  console.log('\nRemoved:');
  for (const [table, count] of Object.entries(removed)) {
    if (count > 0) console.log(`  ${table.padEnd(18)} ${count}`);
  }
}

main()
  .catch((error) => {
    console.error('Cleanup failed:', error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
