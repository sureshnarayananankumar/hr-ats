/**
 * Generates the Spring Data repository interfaces.
 *
 * Each entry lists the entity, its id type, and the finder methods that
 * entity actually needs. Anything beyond a derived query or a short JPQL
 * fragment belongs in a hand-written service, not here.
 *
 *   node codegen/repositories.mjs
 */
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const DIR = path.join(root, 'src/main/java/com/businessgateways/hrats/repository');
fs.mkdirSync(DIR, { recursive: true });

const q = (jpql, signature) => `@Query("""\n${jpql}\n           """)\n    ${signature}`;

const REPOS = [
  ['User', 'String', {
    spec: true,
    imports: ['com.businessgateways.hrats.domain.enums.Enums.RoleName', 'com.businessgateways.hrats.domain.enums.Enums.UserStatus'],
    methods: [
      'Optional<User> findByEmailIgnoreCase(String email);',
      'boolean existsByEmailIgnoreCase(String email);',
      'List<User> findByStatus(UserStatus status);',
      q(`           select u from User u join u.userRoles ur
           where ur.role.name = :role and u.status = :status`,
        'List<User> findByRoleAndStatus(@Param("role") RoleName role, @Param("status") UserStatus status);'),
      'long countByStatus(UserStatus status);',
    ],
  }],
  ['Role', 'String', {
    imports: ['com.businessgateways.hrats.domain.enums.Enums.RoleName'],
    methods: ['Optional<Role> findByName(RoleName name);', 'List<Role> findAllByOrderByNameAsc();'],
  }],
  ['Permission', 'String', {
    methods: ['Optional<Permission> findByPermissionKey(String permissionKey);'],
  }],
  ['UserRole', 'UserRoleId', {
    methods: [
      'List<UserRole> findByUserId(String userId);',
      'void deleteByUserId(String userId);',
      'long countByRoleId(String roleId);',
    ],
  }],
  ['RolePermission', 'RolePermissionId', {
    methods: ['List<RolePermission> findByRoleId(String roleId);', 'void deleteByRoleId(String roleId);'],
  }],

  ['RefreshSession', 'String', {
    methods: [
      'Optional<RefreshSession> findByTokenHash(String tokenHash);',
      'List<RefreshSession> findByUserIdAndRevokedAtIsNull(String userId);',
      'List<RefreshSession> findByPreviousId(String previousId);',
      `@Modifying\n    ` + q(`           update RefreshSession s set s.revokedAt = :now, s.revokedReason = :reason
           where s.userId = :userId and s.revokedAt is null`,
        'int revokeAllForUser(@Param("userId") String userId, @Param("now") Instant now, @Param("reason") String reason);'),
      `@Modifying\n    ` + q(`           delete from RefreshSession s where s.expiresAt < :cutoff`,
        'int deleteExpiredBefore(@Param("cutoff") Instant cutoff);'),
    ],
  }],
  ['EmailVerificationToken', 'String', {
    methods: [
      'Optional<EmailVerificationToken> findByTokenHash(String tokenHash);',
      '@Modifying\n    void deleteByUserId(String userId);',
    ],
  }],
  ['PasswordResetToken', 'String', {
    methods: [
      'Optional<PasswordResetToken> findByTokenHash(String tokenHash);',
      '@Modifying\n    void deleteByUserId(String userId);',
    ],
  }],
  ['LoginAttempt', 'Long', {
    methods: [
      'long countByEmailAndSuccessfulFalseAndCreatedAtAfter(String email, Instant since);',
      'long countByIpAddressAndSuccessfulFalseAndCreatedAtAfter(String ipAddress, Instant since);',
      'List<LoginAttempt> findTop20ByEmailOrderByCreatedAtDesc(String email);',
    ],
  }],

  ['Department', 'String', {
    methods: [
      'Optional<Department> findByCodeIgnoreCase(String code);',
      'Optional<Department> findByNameIgnoreCase(String name);',
      'List<Department> findByIsActiveTrueOrderByNameAsc();',
      'List<Department> findAllByOrderByNameAsc();',
    ],
  }],
  ['Skill', 'String', {
    methods: [
      'Optional<Skill> findByNameIgnoreCase(String name);',
      'List<Skill> findTop20ByNameContainingIgnoreCaseOrderByNameAsc(String term);',
      'List<Skill> findAllByOrderByNameAsc();',
    ],
  }],
  ['RecruitmentSource', 'String', {
    methods: [
      'Optional<RecruitmentSource> findByNameIgnoreCase(String name);',
      'List<RecruitmentSource> findByIsActiveTrueOrderByNameAsc();',
      'List<RecruitmentSource> findAllByOrderByNameAsc();',
    ],
  }],

  ['JobRequirement', 'String', {
    spec: true,
    imports: ['com.businessgateways.hrats.domain.enums.Enums.JobStatus'],
    methods: [
      'Optional<JobRequirement> findBySlug(String slug);',
      'Optional<JobRequirement> findByRequirementCode(String requirementCode);',
      'boolean existsBySlug(String slug);',
      'long countByStatus(JobStatus status);',
      'List<JobRequirement> findByStatusAndApplicationDeadlineBefore(JobStatus status, Instant cutoff);',
      'Optional<JobRequirement> findFirstByRequirementCodeStartingWithOrderByRequirementCodeDesc(String prefix);',
    ],
  }],
  ['JobSkill', 'String', {
    methods: ['List<JobSkill> findByJobId(String jobId);', '@Modifying\n    void deleteByJobId(String jobId);'],
  }],
  ['JobApproval', 'String', {
    imports: ['com.businessgateways.hrats.domain.enums.Enums.ApprovalDecision'],
    methods: [
      'List<JobApproval> findByJobIdOrderBySequenceAsc(String jobId);',
      'List<JobApproval> findByApproverIdAndDecisionOrderByCreatedAtDesc(String approverId, ApprovalDecision decision);',
      'long countByJobIdAndDecision(String jobId, ApprovalDecision decision);',
    ],
  }],
  ['JobRequirementHistory', 'Long', {
    methods: ['List<JobRequirementHistory> findByJobIdOrderByChangedAtDesc(String jobId);'],
  }],

  ['CandidateProfile', 'String', {
    spec: true,
    methods: [
      'Optional<CandidateProfile> findByUserId(String userId);',
      'Optional<CandidateProfile> findByCandidateCode(String candidateCode);',
      'Optional<CandidateProfile> findByNormalisedEmail(String normalisedEmail);',
      'List<CandidateProfile> findByNormalisedPhone(String normalisedPhone);',
      'List<CandidateProfile> findByDataDeletionRequestedAtIsNotNull();',
      'Optional<CandidateProfile> findFirstByCandidateCodeStartingWithOrderByCandidateCodeDesc(String prefix);',
    ],
  }],
  ['CandidateSkill', 'String', {
    methods: ['List<CandidateSkill> findByCandidateId(String candidateId);', '@Modifying\n    void deleteByCandidateId(String candidateId);'],
  }],
  ['CandidateDocument', 'String', {
    imports: ['com.businessgateways.hrats.domain.enums.Enums.DocumentType'],
    methods: [
      'List<CandidateDocument> findByCandidateIdAndDeletedAtIsNullOrderByUploadedAtDesc(String candidateId);',
      'Optional<CandidateDocument> findByIdAndDeletedAtIsNull(String id);',
      'Optional<CandidateDocument> findFirstByCandidateIdAndDocumentTypeAndIsCurrentTrueAndDeletedAtIsNull(String candidateId, DocumentType documentType);',
      'Optional<CandidateDocument> findFirstByChecksumAndCandidateIdAndDeletedAtIsNull(String checksum, String candidateId);',
    ],
  }],
  ['DocumentAccessLog', 'Long', {
    methods: ['List<DocumentAccessLog> findTop100ByDocumentIdOrderByAccessedAtDesc(String documentId);'],
  }],
  ['CandidateTag', 'String', {
    methods: ['Optional<CandidateTag> findByNameIgnoreCase(String name);', 'List<CandidateTag> findAllByOrderByNameAsc();'],
  }],
  ['CandidateTagLink', 'CandidateTagLinkId', {
    methods: [
      'List<CandidateTagLink> findByCandidateId(String candidateId);',
      '@Modifying\n    void deleteByCandidateIdAndTagId(String candidateId, String tagId);',
    ],
  }],
  ['CandidateNote', 'String', {
    methods: ['Page<CandidateNote> findByCandidateIdOrderByCreatedAtDesc(String candidateId, Pageable pageable);'],
  }],
  ['CandidateActivity', 'Long', {
    methods: ['Page<CandidateActivity> findByCandidateIdOrderByCreatedAtDesc(String candidateId, Pageable pageable);'],
  }],

  ['JobApplication', 'String', {
    spec: true,
    imports: ['com.businessgateways.hrats.domain.enums.Enums.ApplicationStage', 'com.businessgateways.hrats.domain.enums.Enums.ApplicationStatus'],
    methods: [
      'Optional<JobApplication> findByApplicationCode(String applicationCode);',
      'Optional<JobApplication> findByCandidateIdAndActiveJobKey(String candidateId, String activeJobKey);',
      'List<JobApplication> findByJobId(String jobId);',
      'List<JobApplication> findByCandidateIdOrderByAppliedAtDesc(String candidateId);',
      'long countByJobIdAndStatus(String jobId, ApplicationStatus status);',
      'long countByStatus(ApplicationStatus status);',
      'Optional<JobApplication> findFirstByApplicationCodeStartingWithOrderByApplicationCodeDesc(String prefix);',
      q(`           select a.currentStage, count(a) from JobApplication a
           where a.status = :status and (:jobId is null or a.jobId = :jobId)
           group by a.currentStage`,
        'List<Object[]> countByStageGrouped(@Param("status") ApplicationStatus status, @Param("jobId") String jobId);'),
      q(`           select a from JobApplication a
           where a.status = :status and a.followUpDueAt is not null and a.followUpDueAt < :now`,
        'List<JobApplication> findOverdueFollowUps(@Param("status") ApplicationStatus status, @Param("now") Instant now);'),
      'long countByAppliedAtBetween(Instant from, Instant to);',
      q(`           select a.sourceId, count(a) from JobApplication a
           where a.sourceId is not null and a.appliedAt between :from and :to
           group by a.sourceId`,
        'List<Object[]> countBySourceBetween(@Param("from") Instant from, @Param("to") Instant to);'),
    ],
  }],
  ['ApplicationStatusHistory', 'Long', {
    methods: [
      'List<ApplicationStatusHistory> findByApplicationIdOrderByChangedAtAsc(String applicationId);',
      q(`           select h.toStage, avg(h.durationSeconds) from ApplicationStatusHistory h
           where h.durationSeconds is not null
           group by h.toStage`,
        'List<Object[]> averageSecondsPerStage();'),
    ],
  }],
  ['ApplicationNote', 'String', {
    methods: ['List<ApplicationNote> findByApplicationIdOrderByCreatedAtDesc(String applicationId);'],
  }],

  ['Interview', 'String', {
    spec: true,
    imports: ['com.businessgateways.hrats.domain.enums.Enums.InterviewStatus'],
    methods: [
      'Optional<Interview> findByInterviewCode(String interviewCode);',
      'List<Interview> findByApplicationIdOrderByRoundAsc(String applicationId);',
      'List<Interview> findByCandidateIdOrderByScheduledStartDesc(String candidateId);',
      'List<Interview> findByStatusAndScheduledStartBetween(InterviewStatus status, Instant from, Instant to);',
      'Optional<Interview> findFirstByInterviewCodeStartingWithOrderByInterviewCodeDesc(String prefix);',
      q(`           select i from Interview i, InterviewPanelMember p
           where p.interviewId = i.id and p.interviewerId = :interviewerId
             and i.scheduledStart >= :from
           order by i.scheduledStart asc`,
        'List<Interview> findUpcomingForInterviewer(@Param("interviewerId") String interviewerId, @Param("from") Instant from);'),
      // Double-booking check: any SCHEDULED/RESCHEDULED interview for this
      // panellist whose window overlaps [start, end).
      q(`           select count(i) from Interview i, InterviewPanelMember p
           where p.interviewId = i.id and p.interviewerId = :interviewerId
             and i.status in :liveStatuses
             and i.scheduledStart < :end and i.scheduledEnd > :start
             and i.id <> :excludeId`,
        'long countConflicts(@Param("interviewerId") String interviewerId, @Param("liveStatuses") List<InterviewStatus> liveStatuses, @Param("start") Instant start, @Param("end") Instant end, @Param("excludeId") String excludeId);'),
    ],
  }],
  ['InterviewPanelMember', 'InterviewPanelMemberId', {
    methods: [
      'List<InterviewPanelMember> findByInterviewId(String interviewId);',
      '@Modifying\n    void deleteByInterviewId(String interviewId);',
      'boolean existsByInterviewIdAndInterviewerId(String interviewId, String interviewerId);',
    ],
  }],
  ['InterviewFeedback', 'String', {
    methods: [
      'List<InterviewFeedback> findByInterviewId(String interviewId);',
      'Optional<InterviewFeedback> findByInterviewIdAndInterviewerId(String interviewId, String interviewerId);',
      'List<InterviewFeedback> findByInterviewIdIn(List<String> interviewIds);',
    ],
  }],

  ['Offer', 'String', {
    spec: true,
    imports: ['com.businessgateways.hrats.domain.enums.Enums.OfferStatus'],
    methods: [
      'Optional<Offer> findByOfferCode(String offerCode);',
      'Optional<Offer> findByApplicationId(String applicationId);',
      'List<Offer> findByCandidateIdOrderByCreatedAtDesc(String candidateId);',
      'List<Offer> findByStatusAndExpiresAtBefore(OfferStatus status, Instant cutoff);',
      'long countByStatus(OfferStatus status);',
      'Optional<Offer> findFirstByOfferCodeStartingWithOrderByOfferCodeDesc(String prefix);',
    ],
  }],
  ['OfferApproval', 'String', {
    imports: ['com.businessgateways.hrats.domain.enums.Enums.ApprovalDecision'],
    methods: [
      'List<OfferApproval> findByOfferIdOrderBySequenceAsc(String offerId);',
      'long countByOfferIdAndDecision(String offerId, ApprovalDecision decision);',
    ],
  }],
  ['OfferHistory', 'Long', {
    methods: ['List<OfferHistory> findByOfferIdOrderByChangedAtAsc(String offerId);'],
  }],

  ['OnboardingRecord', 'String', {
    spec: true,
    imports: ['com.businessgateways.hrats.domain.enums.Enums.OnboardingStatus'],
    methods: [
      'Optional<OnboardingRecord> findByOfferId(String offerId);',
      'Optional<OnboardingRecord> findByApplicationId(String applicationId);',
      'Optional<OnboardingRecord> findByEmployeeCode(String employeeCode);',
      'List<OnboardingRecord> findByStatus(OnboardingStatus status);',
      'List<OnboardingRecord> findByJoiningDateBetween(Instant from, Instant to);',
      'Optional<OnboardingRecord> findFirstByOnboardingCodeStartingWithOrderByOnboardingCodeDesc(String prefix);',
    ],
  }],
  ['OnboardingTask', 'String', {
    imports: ['com.businessgateways.hrats.domain.enums.Enums.TaskStatus'],
    methods: [
      'List<OnboardingTask> findByOnboardingIdOrderBySequenceAsc(String onboardingId);',
      'List<OnboardingTask> findByOwnerUserIdAndStatus(String ownerUserId, TaskStatus status);',
      'long countByOnboardingIdAndStatus(String onboardingId, TaskStatus status);',
      'long countByOnboardingId(String onboardingId);',
    ],
  }],

  ['NotificationTemplate', 'String', {
    methods: ['Optional<NotificationTemplate> findByTemplateKey(String templateKey);', 'List<NotificationTemplate> findByIsActiveTrue();'],
  }],
  ['Notification', 'String', {
    methods: [
      'Page<Notification> findByUserIdOrderByCreatedAtDesc(String userId, Pageable pageable);',
      'long countByUserIdAndReadAtIsNull(String userId);',
      `@Modifying\n    ` + q(`           update Notification n set n.readAt = :now
           where n.userId = :userId and n.readAt is null`,
        'int markAllRead(@Param("userId") String userId, @Param("now") Instant now);'),
    ],
  }],
  ['EmailLog', 'String', {
    imports: ['com.businessgateways.hrats.domain.enums.Enums.EmailStatus'],
    methods: [
      'Page<EmailLog> findByStatusOrderByQueuedAtDesc(EmailStatus status, Pageable pageable);',
      'List<EmailLog> findTop50ByStatusAndAttemptsLessThanOrderByQueuedAtAsc(EmailStatus status, int maxAttempts);',
    ],
  }],
  ['AuditLog', 'Long', {
    spec: true,
    methods: [
      'Page<AuditLog> findByActorUserIdOrderByCreatedAtDesc(String actorUserId, Pageable pageable);',
      'List<AuditLog> findTop100ByEntityTypeAndEntityIdOrderByCreatedAtDesc(String entityType, String entityId);',
    ],
  }],
  ['SystemSetting', 'String', {
    methods: [
      'Optional<SystemSetting> findBySettingKey(String settingKey);',
      'List<SystemSetting> findByCategoryOrderBySettingKeyAsc(String category);',
      'List<SystemSetting> findAllByOrderByCategoryAscSettingKeyAsc();',
    ],
  }],
];

let count = 0;

for (const [entity, idType, config] of REPOS) {
  const methods = config.methods ?? [];
  const joined = methods.join('\n');
  const uses = (token) => joined.includes(token);

  const imports = new Set([
    `com.businessgateways.hrats.domain.entity.${entity}`,
    'org.springframework.data.jpa.repository.JpaRepository',
    'org.springframework.stereotype.Repository',
    ...(config.imports ?? []),
  ]);
  if (idType !== 'String' && idType !== 'Long') {
    imports.add(`com.businessgateways.hrats.domain.entity.${idType}`);
  }
  if (uses('Optional<')) imports.add('java.util.Optional');
  if (uses('List<')) imports.add('java.util.List');
  if (uses('Instant')) imports.add('java.time.Instant');
  if (uses('Page<')) imports.add('org.springframework.data.domain.Page');
  if (uses('Pageable')) imports.add('org.springframework.data.domain.Pageable');
  if (uses('@Query')) imports.add('org.springframework.data.jpa.repository.Query');
  if (uses('@Param')) imports.add('org.springframework.data.repository.query.Param');
  if (uses('@Modifying')) imports.add('org.springframework.data.jpa.repository.Modifying');
  if (config.spec) imports.add('org.springframework.data.jpa.repository.JpaSpecificationExecutor');

  const extendsClause = config.spec
    ? `JpaRepository<${entity}, ${idType}>, JpaSpecificationExecutor<${entity}>`
    : `JpaRepository<${entity}, ${idType}>`;

  const src = `package com.businessgateways.hrats.repository;

${[...imports].sort().map((i) => `import ${i};`).join('\n')}

/** Data access for {@link ${entity}}. */
@Repository
public interface ${entity}Repository extends ${extendsClause} {

${methods.map((m) => '    ' + m).join('\n\n')}
}
`;

  fs.writeFileSync(path.join(DIR, `${entity}Repository.java`), src);
  count += 1;
}

console.log(`Generated ${count} repository interface(s) in repository/`);
