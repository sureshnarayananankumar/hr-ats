-- CreateTable
CREATE TABLE `users` (
    `id` CHAR(36) NOT NULL,
    `email` VARCHAR(255) NOT NULL,
    `passwordHash` VARCHAR(255) NOT NULL,
    `firstName` VARCHAR(100) NOT NULL,
    `lastName` VARCHAR(100) NOT NULL,
    `phone` VARCHAR(30) NULL,
    `status` ENUM('PENDING_VERIFICATION', 'ACTIVE', 'SUSPENDED', 'DEACTIVATED') NOT NULL DEFAULT 'PENDING_VERIFICATION',
    `emailVerifiedAt` DATETIME(3) NULL,
    `mfaEnabled` BOOLEAN NOT NULL DEFAULT false,
    `mfaSecret` VARCHAR(255) NULL,
    `mfaRecoveryCodes` TEXT NULL,
    `failedLoginCount` INTEGER NOT NULL DEFAULT 0,
    `lockedUntil` DATETIME(3) NULL,
    `lastLoginAt` DATETIME(3) NULL,
    `lastLoginIp` VARCHAR(45) NULL,
    `consentGivenAt` DATETIME(3) NULL,
    `dataRetentionUntil` DATETIME(3) NULL,
    `deactivatedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `users_email_key`(`email`),
    INDEX `users_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `roles` (
    `id` CHAR(36) NOT NULL,
    `name` ENUM('SUPER_ADMIN', 'HR_ADMIN', 'RECRUITER', 'HIRING_MANAGER', 'INTERVIEWER', 'CANDIDATE') NOT NULL,
    `label` VARCHAR(100) NOT NULL,
    `description` VARCHAR(500) NULL,
    `isSystem` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `roles_name_key`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `permissions` (
    `id` CHAR(36) NOT NULL,
    `key` VARCHAR(100) NOT NULL,
    `resource` VARCHAR(50) NOT NULL,
    `action` VARCHAR(50) NOT NULL,
    `description` VARCHAR(500) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `permissions_key_key`(`key`),
    INDEX `permissions_resource_idx`(`resource`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `role_permissions` (
    `roleId` CHAR(36) NOT NULL,
    `permissionId` CHAR(36) NOT NULL,

    INDEX `role_permissions_permissionId_idx`(`permissionId`),
    PRIMARY KEY (`roleId`, `permissionId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `user_roles` (
    `userId` CHAR(36) NOT NULL,
    `roleId` CHAR(36) NOT NULL,
    `assignedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `assignedBy` CHAR(36) NULL,

    INDEX `user_roles_roleId_idx`(`roleId`),
    PRIMARY KEY (`userId`, `roleId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `refresh_sessions` (
    `id` CHAR(36) NOT NULL,
    `userId` CHAR(36) NOT NULL,
    `tokenHash` VARCHAR(255) NOT NULL,
    `previousId` CHAR(36) NULL,
    `userAgent` VARCHAR(400) NULL,
    `ipAddress` VARCHAR(45) NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `revokedAt` DATETIME(3) NULL,
    `revokedReason` VARCHAR(200) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `refresh_sessions_tokenHash_key`(`tokenHash`),
    INDEX `refresh_sessions_userId_idx`(`userId`),
    INDEX `refresh_sessions_expiresAt_idx`(`expiresAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `email_verification_tokens` (
    `id` CHAR(36) NOT NULL,
    `userId` CHAR(36) NOT NULL,
    `tokenHash` VARCHAR(255) NOT NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `usedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `email_verification_tokens_tokenHash_key`(`tokenHash`),
    INDEX `email_verification_tokens_userId_idx`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `password_reset_tokens` (
    `id` CHAR(36) NOT NULL,
    `userId` CHAR(36) NOT NULL,
    `tokenHash` VARCHAR(255) NOT NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `usedAt` DATETIME(3) NULL,
    `requestIp` VARCHAR(45) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `password_reset_tokens_tokenHash_key`(`tokenHash`),
    INDEX `password_reset_tokens_userId_idx`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `login_attempts` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `email` VARCHAR(255) NOT NULL,
    `ipAddress` VARCHAR(45) NOT NULL,
    `successful` BOOLEAN NOT NULL,
    `reason` VARCHAR(100) NULL,
    `userAgent` VARCHAR(400) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `login_attempts_email_createdAt_idx`(`email`, `createdAt`),
    INDEX `login_attempts_ipAddress_createdAt_idx`(`ipAddress`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `departments` (
    `id` CHAR(36) NOT NULL,
    `code` VARCHAR(20) NOT NULL,
    `name` VARCHAR(150) NOT NULL,
    `description` VARCHAR(500) NULL,
    `headUserId` CHAR(36) NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `departments_code_key`(`code`),
    UNIQUE INDEX `departments_name_key`(`name`),
    INDEX `departments_isActive_idx`(`isActive`),
    INDEX `departments_headUserId_idx`(`headUserId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `skills` (
    `id` CHAR(36) NOT NULL,
    `name` VARCHAR(100) NOT NULL,
    `category` VARCHAR(60) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `skills_name_key`(`name`),
    INDEX `skills_category_idx`(`category`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `recruitment_sources` (
    `id` CHAR(36) NOT NULL,
    `name` VARCHAR(100) NOT NULL,
    `category` VARCHAR(60) NULL,
    `costPerMonth` DECIMAL(12, 2) NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `recruitment_sources_name_key`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `job_requirements` (
    `id` CHAR(36) NOT NULL,
    `requirementCode` VARCHAR(30) NOT NULL,
    `title` VARCHAR(200) NOT NULL,
    `slug` VARCHAR(250) NOT NULL,
    `description` TEXT NOT NULL,
    `responsibilities` TEXT NULL,
    `qualifications` TEXT NULL,
    `internalNotes` TEXT NULL,
    `minExperience` INTEGER NOT NULL DEFAULT 0,
    `maxExperience` INTEGER NULL,
    `departmentId` CHAR(36) NOT NULL,
    `designation` VARCHAR(150) NOT NULL,
    `vacancies` INTEGER NOT NULL DEFAULT 1,
    `vacanciesFilled` INTEGER NOT NULL DEFAULT 0,
    `employmentType` ENUM('FULL_TIME', 'PART_TIME', 'CONTRACT', 'TEMPORARY', 'INTERNSHIP', 'FREELANCE') NOT NULL DEFAULT 'FULL_TIME',
    `workMode` ENUM('ONSITE', 'REMOTE', 'HYBRID') NOT NULL DEFAULT 'ONSITE',
    `location` VARCHAR(200) NOT NULL,
    `salaryMin` DECIMAL(14, 2) NULL,
    `salaryMax` DECIMAL(14, 2) NULL,
    `salaryCurrency` VARCHAR(3) NOT NULL DEFAULT 'USD',
    `salaryConfidential` BOOLEAN NOT NULL DEFAULT true,
    `priority` ENUM('LOW', 'MEDIUM', 'HIGH', 'CRITICAL') NOT NULL DEFAULT 'MEDIUM',
    `status` ENUM('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'PUBLISHED', 'ON_HOLD', 'CLOSED', 'CANCELLED') NOT NULL DEFAULT 'DRAFT',
    `requestedById` CHAR(36) NOT NULL,
    `requestDate` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `recruiterId` CHAR(36) NULL,
    `hiringManagerId` CHAR(36) NULL,
    `createdById` CHAR(36) NOT NULL,
    `publishedAt` DATETIME(3) NULL,
    `applicationDeadline` DATETIME(3) NULL,
    `closedAt` DATETIME(3) NULL,
    `onHoldReason` VARCHAR(500) NULL,
    `cancelReason` VARCHAR(500) NULL,
    `duplicatedFromId` CHAR(36) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `job_requirements_requirementCode_key`(`requirementCode`),
    UNIQUE INDEX `job_requirements_slug_key`(`slug`),
    INDEX `job_requirements_status_idx`(`status`),
    INDEX `job_requirements_departmentId_idx`(`departmentId`),
    INDEX `job_requirements_recruiterId_idx`(`recruiterId`),
    INDEX `job_requirements_hiringManagerId_idx`(`hiringManagerId`),
    INDEX `job_requirements_requestedById_idx`(`requestedById`),
    INDEX `job_requirements_createdById_idx`(`createdById`),
    INDEX `job_requirements_publishedAt_idx`(`publishedAt`),
    INDEX `job_requirements_status_publishedAt_idx`(`status`, `publishedAt`),
    INDEX `job_requirements_applicationDeadline_idx`(`applicationDeadline`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `job_skills` (
    `id` CHAR(36) NOT NULL,
    `jobId` CHAR(36) NOT NULL,
    `skillId` CHAR(36) NOT NULL,
    `isRequired` BOOLEAN NOT NULL DEFAULT true,
    `minYears` INTEGER NULL,

    INDEX `job_skills_skillId_idx`(`skillId`),
    UNIQUE INDEX `job_skills_jobId_skillId_key`(`jobId`, `skillId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `job_approvals` (
    `id` CHAR(36) NOT NULL,
    `jobId` CHAR(36) NOT NULL,
    `approverId` CHAR(36) NOT NULL,
    `sequence` INTEGER NOT NULL DEFAULT 1,
    `decision` ENUM('PENDING', 'APPROVED', 'REJECTED') NOT NULL DEFAULT 'PENDING',
    `comments` TEXT NULL,
    `decidedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `job_approvals_approverId_decision_idx`(`approverId`, `decision`),
    UNIQUE INDEX `job_approvals_jobId_approverId_sequence_key`(`jobId`, `approverId`, `sequence`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `job_requirement_history` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `jobId` CHAR(36) NOT NULL,
    `changedById` CHAR(36) NOT NULL,
    `fieldName` VARCHAR(80) NOT NULL,
    `oldValue` TEXT NULL,
    `newValue` TEXT NULL,
    `reason` VARCHAR(500) NULL,
    `changedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `job_requirement_history_jobId_changedAt_idx`(`jobId`, `changedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `candidate_profiles` (
    `id` CHAR(36) NOT NULL,
    `candidateCode` VARCHAR(30) NOT NULL,
    `userId` CHAR(36) NOT NULL,
    `fullName` VARCHAR(200) NOT NULL,
    `normalisedEmail` VARCHAR(255) NOT NULL,
    `normalisedPhone` VARCHAR(30) NULL,
    `mobile` VARCHAR(30) NULL,
    `location` VARCHAR(200) NULL,
    `totalExperience` DECIMAL(4, 1) NULL,
    `currentDesignation` VARCHAR(150) NULL,
    `currentCompany` VARCHAR(200) NULL,
    `highestEducation` VARCHAR(200) NULL,
    `educationDetails` TEXT NULL,
    `expectedSalary` DECIMAL(14, 2) NULL,
    `currentSalary` DECIMAL(14, 2) NULL,
    `salaryCurrency` VARCHAR(3) NOT NULL DEFAULT 'USD',
    `noticePeriodDays` INTEGER NULL,
    `linkedinUrl` VARCHAR(400) NULL,
    `portfolioUrl` VARCHAR(400) NULL,
    `preferredLocation` VARCHAR(200) NULL,
    `preferredWorkMode` ENUM('ONSITE', 'REMOTE', 'HYBRID') NULL,
    `preferredEmploymentType` ENUM('FULL_TIME', 'PART_TIME', 'CONTRACT', 'TEMPORARY', 'INTERNSHIP', 'FREELANCE') NULL,
    `willingToRelocate` BOOLEAN NOT NULL DEFAULT false,
    `summary` TEXT NULL,
    `consentToStoreData` BOOLEAN NOT NULL DEFAULT false,
    `consentAt` DATETIME(3) NULL,
    `dataDeletionRequestedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `candidate_profiles_candidateCode_key`(`candidateCode`),
    UNIQUE INDEX `candidate_profiles_userId_key`(`userId`),
    INDEX `candidate_profiles_normalisedEmail_idx`(`normalisedEmail`),
    INDEX `candidate_profiles_normalisedPhone_idx`(`normalisedPhone`),
    INDEX `candidate_profiles_fullName_idx`(`fullName`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `candidate_skills` (
    `id` CHAR(36) NOT NULL,
    `candidateId` CHAR(36) NOT NULL,
    `skillId` CHAR(36) NOT NULL,
    `years` DECIMAL(4, 1) NULL,
    `proficiency` ENUM('BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'EXPERT') NOT NULL DEFAULT 'INTERMEDIATE',

    INDEX `candidate_skills_skillId_idx`(`skillId`),
    UNIQUE INDEX `candidate_skills_candidateId_skillId_key`(`candidateId`, `skillId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `candidate_documents` (
    `id` CHAR(36) NOT NULL,
    `candidateId` CHAR(36) NOT NULL,
    `documentType` ENUM('RESUME', 'COVER_LETTER', 'CERTIFICATE', 'ID_PROOF', 'EDUCATION_PROOF', 'EXPERIENCE_LETTER', 'OFFER_DOCUMENT', 'OTHER') NOT NULL DEFAULT 'RESUME',
    `originalName` VARCHAR(255) NOT NULL,
    `storageKey` VARCHAR(255) NOT NULL,
    `mimeType` VARCHAR(150) NOT NULL,
    `sizeBytes` INTEGER NOT NULL,
    `checksum` VARCHAR(64) NOT NULL,
    `version` INTEGER NOT NULL DEFAULT 1,
    `isCurrent` BOOLEAN NOT NULL DEFAULT true,
    `supersedesId` CHAR(36) NULL,
    `uploadedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `deletedAt` DATETIME(3) NULL,

    UNIQUE INDEX `candidate_documents_storageKey_key`(`storageKey`),
    INDEX `candidate_documents_candidateId_documentType_isCurrent_idx`(`candidateId`, `documentType`, `isCurrent`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `document_access_logs` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `documentId` CHAR(36) NOT NULL,
    `userId` CHAR(36) NOT NULL,
    `ipAddress` VARCHAR(45) NULL,
    `action` VARCHAR(40) NOT NULL,
    `accessedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `document_access_logs_documentId_accessedAt_idx`(`documentId`, `accessedAt`),
    INDEX `document_access_logs_userId_idx`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `candidate_tags` (
    `id` CHAR(36) NOT NULL,
    `name` VARCHAR(60) NOT NULL,
    `colour` VARCHAR(9) NOT NULL DEFAULT '#64748b',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `candidate_tags_name_key`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `candidate_tag_links` (
    `candidateId` CHAR(36) NOT NULL,
    `tagId` CHAR(36) NOT NULL,
    `assignedById` CHAR(36) NOT NULL,
    `assignedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `candidate_tag_links_tagId_idx`(`tagId`),
    INDEX `candidate_tag_links_assignedById_idx`(`assignedById`),
    PRIMARY KEY (`candidateId`, `tagId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `candidate_notes` (
    `id` CHAR(36) NOT NULL,
    `candidateId` CHAR(36) NOT NULL,
    `authorId` CHAR(36) NOT NULL,
    `body` TEXT NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `candidate_notes_candidateId_createdAt_idx`(`candidateId`, `createdAt`),
    INDEX `candidate_notes_authorId_idx`(`authorId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `candidate_activities` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `candidateId` CHAR(36) NOT NULL,
    `activity` VARCHAR(120) NOT NULL,
    `detail` TEXT NULL,
    `actorUserId` CHAR(36) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `candidate_activities_candidateId_createdAt_idx`(`candidateId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `job_applications` (
    `id` CHAR(36) NOT NULL,
    `applicationCode` VARCHAR(30) NOT NULL,
    `candidateId` CHAR(36) NOT NULL,
    `jobId` CHAR(36) NOT NULL,
    `activeJobKey` CHAR(36) NULL,
    `appliedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `resumeDocumentId` CHAR(36) NULL,
    `coverLetter` TEXT NULL,
    `sourceId` CHAR(36) NULL,
    `recruiterId` CHAR(36) NULL,
    `currentStage` ENUM('APPLIED', 'RESUME_SCREENING', 'HR_SCREENING', 'SHORTLISTED', 'ASSESSMENT', 'TECHNICAL_INTERVIEW', 'HR_INTERVIEW', 'FINAL_INTERVIEW', 'SELECTED', 'OFFER_RELEASED', 'OFFER_ACCEPTED', 'HIRED') NOT NULL DEFAULT 'APPLIED',
    `status` ENUM('ACTIVE', 'ON_HOLD', 'REJECTED', 'WITHDRAWN', 'OFFER_DECLINED', 'HIRED') NOT NULL DEFAULT 'ACTIVE',
    `screeningResult` ENUM('NOT_SCREENED', 'PASS', 'FAIL', 'ON_HOLD') NOT NULL DEFAULT 'NOT_SCREENED',
    `screeningRemarks` TEXT NULL,
    `rejectionReason` VARCHAR(500) NULL,
    `withdrawReason` VARCHAR(500) NULL,
    `stageEnteredAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `followUpDueAt` DATETIME(3) NULL,
    `lastUpdatedAt` DATETIME(3) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `job_applications_applicationCode_key`(`applicationCode`),
    INDEX `job_applications_jobId_currentStage_idx`(`jobId`, `currentStage`),
    INDEX `job_applications_jobId_status_idx`(`jobId`, `status`),
    INDEX `job_applications_candidateId_idx`(`candidateId`),
    INDEX `job_applications_recruiterId_status_idx`(`recruiterId`, `status`),
    INDEX `job_applications_appliedAt_idx`(`appliedAt`),
    INDEX `job_applications_currentStage_stageEnteredAt_idx`(`currentStage`, `stageEnteredAt`),
    INDEX `job_applications_followUpDueAt_idx`(`followUpDueAt`),
    INDEX `job_applications_resumeDocumentId_idx`(`resumeDocumentId`),
    INDEX `job_applications_sourceId_idx`(`sourceId`),
    UNIQUE INDEX `job_applications_candidateId_activeJobKey_key`(`candidateId`, `activeJobKey`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `application_status_history` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `applicationId` CHAR(36) NOT NULL,
    `fromStage` ENUM('APPLIED', 'RESUME_SCREENING', 'HR_SCREENING', 'SHORTLISTED', 'ASSESSMENT', 'TECHNICAL_INTERVIEW', 'HR_INTERVIEW', 'FINAL_INTERVIEW', 'SELECTED', 'OFFER_RELEASED', 'OFFER_ACCEPTED', 'HIRED') NULL,
    `toStage` ENUM('APPLIED', 'RESUME_SCREENING', 'HR_SCREENING', 'SHORTLISTED', 'ASSESSMENT', 'TECHNICAL_INTERVIEW', 'HR_INTERVIEW', 'FINAL_INTERVIEW', 'SELECTED', 'OFFER_RELEASED', 'OFFER_ACCEPTED', 'HIRED') NOT NULL,
    `fromStatus` ENUM('ACTIVE', 'ON_HOLD', 'REJECTED', 'WITHDRAWN', 'OFFER_DECLINED', 'HIRED') NULL,
    `toStatus` ENUM('ACTIVE', 'ON_HOLD', 'REJECTED', 'WITHDRAWN', 'OFFER_DECLINED', 'HIRED') NOT NULL,
    `changedById` CHAR(36) NOT NULL,
    `reason` VARCHAR(500) NULL,
    `durationSeconds` INTEGER NULL,
    `changedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `application_status_history_applicationId_changedAt_idx`(`applicationId`, `changedAt`),
    INDEX `application_status_history_toStage_changedAt_idx`(`toStage`, `changedAt`),
    INDEX `application_status_history_changedById_idx`(`changedById`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `application_notes` (
    `id` CHAR(36) NOT NULL,
    `applicationId` CHAR(36) NOT NULL,
    `authorId` CHAR(36) NOT NULL,
    `body` TEXT NOT NULL,
    `isInternal` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `application_notes_applicationId_createdAt_idx`(`applicationId`, `createdAt`),
    INDEX `application_notes_authorId_idx`(`authorId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `interviews` (
    `id` CHAR(36) NOT NULL,
    `interviewCode` VARCHAR(30) NOT NULL,
    `applicationId` CHAR(36) NOT NULL,
    `candidateId` CHAR(36) NOT NULL,
    `jobId` CHAR(36) NOT NULL,
    `round` INTEGER NOT NULL DEFAULT 1,
    `roundName` VARCHAR(100) NOT NULL,
    `interviewType` ENUM('PHONE', 'VIDEO', 'ONSITE', 'PANEL', 'ASSESSMENT', 'TECHNICAL', 'HR') NOT NULL DEFAULT 'VIDEO',
    `scheduledStart` DATETIME(3) NOT NULL,
    `scheduledEnd` DATETIME(3) NOT NULL,
    `timeZone` VARCHAR(60) NOT NULL DEFAULT 'UTC',
    `meetingLink` VARCHAR(500) NULL,
    `venue` VARCHAR(300) NULL,
    `instructions` TEXT NULL,
    `status` ENUM('SCHEDULED', 'RESCHEDULED', 'COMPLETED', 'CANCELLED', 'NO_SHOW') NOT NULL DEFAULT 'SCHEDULED',
    `cancelReason` VARCHAR(500) NULL,
    `rescheduledFromId` CHAR(36) NULL,
    `organiserId` CHAR(36) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `interviews_interviewCode_key`(`interviewCode`),
    INDEX `interviews_applicationId_round_idx`(`applicationId`, `round`),
    INDEX `interviews_scheduledStart_status_idx`(`scheduledStart`, `status`),
    INDEX `interviews_candidateId_idx`(`candidateId`),
    INDEX `interviews_jobId_idx`(`jobId`),
    INDEX `interviews_organiserId_idx`(`organiserId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `interview_panel_members` (
    `interviewId` CHAR(36) NOT NULL,
    `interviewerId` CHAR(36) NOT NULL,
    `isLead` BOOLEAN NOT NULL DEFAULT false,
    `invitedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `respondedAt` DATETIME(3) NULL,
    `accepted` BOOLEAN NULL,

    INDEX `interview_panel_members_interviewerId_idx`(`interviewerId`),
    PRIMARY KEY (`interviewId`, `interviewerId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `interview_feedback` (
    `id` CHAR(36) NOT NULL,
    `interviewId` CHAR(36) NOT NULL,
    `interviewerId` CHAR(36) NOT NULL,
    `technicalSkills` INTEGER NULL,
    `communication` INTEGER NULL,
    `problemSolving` INTEGER NULL,
    `relevantExperience` INTEGER NULL,
    `roleSuitability` INTEGER NULL,
    `teamCollaboration` INTEGER NULL,
    `overallRating` INTEGER NOT NULL,
    `strengths` TEXT NULL,
    `areasForImprovement` TEXT NULL,
    `comments` TEXT NULL,
    `recommendation` ENUM('STRONG_HIRE', 'HIRE', 'HOLD', 'NO_HIRE') NOT NULL,
    `submittedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `interview_feedback_interviewerId_idx`(`interviewerId`),
    INDEX `interview_feedback_recommendation_idx`(`recommendation`),
    UNIQUE INDEX `interview_feedback_interviewId_interviewerId_key`(`interviewId`, `interviewerId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `offers` (
    `id` CHAR(36) NOT NULL,
    `offerCode` VARCHAR(30) NOT NULL,
    `applicationId` CHAR(36) NOT NULL,
    `candidateId` CHAR(36) NOT NULL,
    `jobId` CHAR(36) NOT NULL,
    `proposedDesignation` VARCHAR(150) NOT NULL,
    `departmentName` VARCHAR(150) NULL,
    `annualSalary` DECIMAL(14, 2) NOT NULL,
    `currency` VARCHAR(3) NOT NULL DEFAULT 'USD',
    `bonus` DECIMAL(14, 2) NULL,
    `benefits` TEXT NULL,
    `joiningDate` DATETIME(3) NOT NULL,
    `issuedAt` DATETIME(3) NULL,
    `expiresAt` DATETIME(3) NULL,
    `status` ENUM('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'SENT', 'ACCEPTED', 'DECLINED', 'EXPIRED', 'WITHDRAWN') NOT NULL DEFAULT 'DRAFT',
    `declineReason` VARCHAR(500) NULL,
    `withdrawReason` VARCHAR(500) NULL,
    `respondedAt` DATETIME(3) NULL,
    `offerDocumentKey` VARCHAR(255) NULL,
    `createdById` CHAR(36) NOT NULL,
    `revision` INTEGER NOT NULL DEFAULT 1,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `offers_offerCode_key`(`offerCode`),
    INDEX `offers_applicationId_idx`(`applicationId`),
    INDEX `offers_status_idx`(`status`),
    INDEX `offers_candidateId_idx`(`candidateId`),
    INDEX `offers_jobId_idx`(`jobId`),
    INDEX `offers_createdById_idx`(`createdById`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `offer_approvals` (
    `id` CHAR(36) NOT NULL,
    `offerId` CHAR(36) NOT NULL,
    `approverId` CHAR(36) NOT NULL,
    `sequence` INTEGER NOT NULL DEFAULT 1,
    `decision` ENUM('PENDING', 'APPROVED', 'REJECTED') NOT NULL DEFAULT 'PENDING',
    `comments` TEXT NULL,
    `decidedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `offer_approvals_approverId_decision_idx`(`approverId`, `decision`),
    UNIQUE INDEX `offer_approvals_offerId_approverId_sequence_key`(`offerId`, `approverId`, `sequence`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `offer_history` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `offerId` CHAR(36) NOT NULL,
    `fromStatus` ENUM('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'SENT', 'ACCEPTED', 'DECLINED', 'EXPIRED', 'WITHDRAWN') NULL,
    `toStatus` ENUM('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'SENT', 'ACCEPTED', 'DECLINED', 'EXPIRED', 'WITHDRAWN') NOT NULL,
    `changedById` CHAR(36) NOT NULL,
    `reason` VARCHAR(500) NULL,
    `changedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `offer_history_offerId_changedAt_idx`(`offerId`, `changedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `onboarding_records` (
    `id` CHAR(36) NOT NULL,
    `onboardingCode` VARCHAR(30) NOT NULL,
    `applicationId` CHAR(36) NOT NULL,
    `offerId` CHAR(36) NOT NULL,
    `candidateId` CHAR(36) NOT NULL,
    `status` ENUM('OFFER_ACCEPTED', 'PREBOARDING', 'JOINED', 'DID_NOT_JOIN') NOT NULL DEFAULT 'OFFER_ACCEPTED',
    `joiningDate` DATETIME(3) NOT NULL,
    `actualJoinDate` DATETIME(3) NULL,
    `departmentId` CHAR(36) NULL,
    `designation` VARCHAR(150) NOT NULL,
    `reportingManagerId` CHAR(36) NULL,
    `employeeCode` VARCHAR(30) NULL,
    `didNotJoinReason` VARCHAR(500) NULL,
    `documentsVerified` BOOLEAN NOT NULL DEFAULT false,
    `verifiedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `onboarding_records_onboardingCode_key`(`onboardingCode`),
    UNIQUE INDEX `onboarding_records_applicationId_key`(`applicationId`),
    UNIQUE INDEX `onboarding_records_offerId_key`(`offerId`),
    UNIQUE INDEX `onboarding_records_employeeCode_key`(`employeeCode`),
    INDEX `onboarding_records_status_idx`(`status`),
    INDEX `onboarding_records_joiningDate_idx`(`joiningDate`),
    INDEX `onboarding_records_candidateId_idx`(`candidateId`),
    INDEX `onboarding_records_departmentId_idx`(`departmentId`),
    INDEX `onboarding_records_reportingManagerId_idx`(`reportingManagerId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `onboarding_tasks` (
    `id` CHAR(36) NOT NULL,
    `onboardingId` CHAR(36) NOT NULL,
    `title` VARCHAR(200) NOT NULL,
    `description` TEXT NULL,
    `category` VARCHAR(60) NULL,
    `ownerUserId` CHAR(36) NULL,
    `dueDate` DATETIME(3) NULL,
    `status` ENUM('PENDING', 'IN_PROGRESS', 'COMPLETED', 'BLOCKED', 'CANCELLED') NOT NULL DEFAULT 'PENDING',
    `completedAt` DATETIME(3) NULL,
    `sequence` INTEGER NOT NULL DEFAULT 0,
    `isMandatory` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `onboarding_tasks_onboardingId_sequence_idx`(`onboardingId`, `sequence`),
    INDEX `onboarding_tasks_ownerUserId_status_idx`(`ownerUserId`, `status`),
    INDEX `onboarding_tasks_dueDate_idx`(`dueDate`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `notification_templates` (
    `id` CHAR(36) NOT NULL,
    `key` VARCHAR(100) NOT NULL,
    `name` VARCHAR(150) NOT NULL,
    `channel` ENUM('IN_APP', 'EMAIL', 'BOTH') NOT NULL DEFAULT 'BOTH',
    `subject` VARCHAR(300) NOT NULL,
    `bodyHtml` TEXT NOT NULL,
    `bodyText` TEXT NULL,
    `variables` TEXT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `notification_templates_key_key`(`key`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `notifications` (
    `id` CHAR(36) NOT NULL,
    `userId` CHAR(36) NOT NULL,
    `templateId` CHAR(36) NULL,
    `channel` ENUM('IN_APP', 'EMAIL', 'BOTH') NOT NULL DEFAULT 'IN_APP',
    `title` VARCHAR(300) NOT NULL,
    `body` TEXT NOT NULL,
    `link` VARCHAR(400) NULL,
    `category` VARCHAR(60) NULL,
    `readAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `notifications_userId_readAt_idx`(`userId`, `readAt`),
    INDEX `notifications_createdAt_idx`(`createdAt`),
    INDEX `notifications_templateId_idx`(`templateId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `email_logs` (
    `id` CHAR(36) NOT NULL,
    `templateId` CHAR(36) NULL,
    `toEmail` VARCHAR(255) NOT NULL,
    `subject` VARCHAR(300) NOT NULL,
    `status` ENUM('QUEUED', 'SENT', 'FAILED', 'BOUNCED') NOT NULL DEFAULT 'QUEUED',
    `providerId` VARCHAR(255) NULL,
    `errorMessage` TEXT NULL,
    `attempts` INTEGER NOT NULL DEFAULT 0,
    `queuedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `sentAt` DATETIME(3) NULL,

    INDEX `email_logs_status_queuedAt_idx`(`status`, `queuedAt`),
    INDEX `email_logs_toEmail_idx`(`toEmail`),
    INDEX `email_logs_templateId_idx`(`templateId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `audit_logs` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `actorUserId` CHAR(36) NULL,
    `actorEmail` VARCHAR(255) NULL,
    `action` VARCHAR(100) NOT NULL,
    `entityType` VARCHAR(60) NULL,
    `entityId` VARCHAR(64) NULL,
    `metadata` TEXT NULL,
    `ipAddress` VARCHAR(45) NULL,
    `userAgent` VARCHAR(400) NULL,
    `requestId` VARCHAR(64) NULL,
    `severity` VARCHAR(20) NOT NULL DEFAULT 'INFO',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `audit_logs_actorUserId_createdAt_idx`(`actorUserId`, `createdAt`),
    INDEX `audit_logs_action_createdAt_idx`(`action`, `createdAt`),
    INDEX `audit_logs_entityType_entityId_idx`(`entityType`, `entityId`),
    INDEX `audit_logs_requestId_idx`(`requestId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `system_settings` (
    `id` CHAR(36) NOT NULL,
    `key` VARCHAR(100) NOT NULL,
    `value` TEXT NOT NULL,
    `valueType` VARCHAR(20) NOT NULL DEFAULT 'string',
    `category` VARCHAR(60) NOT NULL DEFAULT 'general',
    `description` VARCHAR(500) NULL,
    `isSecret` BOOLEAN NOT NULL DEFAULT false,
    `updatedById` CHAR(36) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `system_settings_key_key`(`key`),
    INDEX `system_settings_category_idx`(`category`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `role_permissions` ADD CONSTRAINT `role_permissions_roleId_fkey` FOREIGN KEY (`roleId`) REFERENCES `roles`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `role_permissions` ADD CONSTRAINT `role_permissions_permissionId_fkey` FOREIGN KEY (`permissionId`) REFERENCES `permissions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `user_roles` ADD CONSTRAINT `user_roles_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `user_roles` ADD CONSTRAINT `user_roles_roleId_fkey` FOREIGN KEY (`roleId`) REFERENCES `roles`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `refresh_sessions` ADD CONSTRAINT `refresh_sessions_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `email_verification_tokens` ADD CONSTRAINT `email_verification_tokens_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `password_reset_tokens` ADD CONSTRAINT `password_reset_tokens_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `departments` ADD CONSTRAINT `departments_headUserId_fkey` FOREIGN KEY (`headUserId`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `job_requirements` ADD CONSTRAINT `job_requirements_departmentId_fkey` FOREIGN KEY (`departmentId`) REFERENCES `departments`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `job_requirements` ADD CONSTRAINT `job_requirements_requestedById_fkey` FOREIGN KEY (`requestedById`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `job_requirements` ADD CONSTRAINT `job_requirements_recruiterId_fkey` FOREIGN KEY (`recruiterId`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `job_requirements` ADD CONSTRAINT `job_requirements_hiringManagerId_fkey` FOREIGN KEY (`hiringManagerId`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `job_requirements` ADD CONSTRAINT `job_requirements_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `job_skills` ADD CONSTRAINT `job_skills_jobId_fkey` FOREIGN KEY (`jobId`) REFERENCES `job_requirements`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `job_skills` ADD CONSTRAINT `job_skills_skillId_fkey` FOREIGN KEY (`skillId`) REFERENCES `skills`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `job_approvals` ADD CONSTRAINT `job_approvals_jobId_fkey` FOREIGN KEY (`jobId`) REFERENCES `job_requirements`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `job_approvals` ADD CONSTRAINT `job_approvals_approverId_fkey` FOREIGN KEY (`approverId`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `job_requirement_history` ADD CONSTRAINT `job_requirement_history_jobId_fkey` FOREIGN KEY (`jobId`) REFERENCES `job_requirements`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `candidate_profiles` ADD CONSTRAINT `candidate_profiles_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `candidate_skills` ADD CONSTRAINT `candidate_skills_candidateId_fkey` FOREIGN KEY (`candidateId`) REFERENCES `candidate_profiles`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `candidate_skills` ADD CONSTRAINT `candidate_skills_skillId_fkey` FOREIGN KEY (`skillId`) REFERENCES `skills`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `candidate_documents` ADD CONSTRAINT `candidate_documents_candidateId_fkey` FOREIGN KEY (`candidateId`) REFERENCES `candidate_profiles`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `document_access_logs` ADD CONSTRAINT `document_access_logs_documentId_fkey` FOREIGN KEY (`documentId`) REFERENCES `candidate_documents`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `candidate_tag_links` ADD CONSTRAINT `candidate_tag_links_candidateId_fkey` FOREIGN KEY (`candidateId`) REFERENCES `candidate_profiles`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `candidate_tag_links` ADD CONSTRAINT `candidate_tag_links_tagId_fkey` FOREIGN KEY (`tagId`) REFERENCES `candidate_tags`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `candidate_tag_links` ADD CONSTRAINT `candidate_tag_links_assignedById_fkey` FOREIGN KEY (`assignedById`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `candidate_notes` ADD CONSTRAINT `candidate_notes_candidateId_fkey` FOREIGN KEY (`candidateId`) REFERENCES `candidate_profiles`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `candidate_notes` ADD CONSTRAINT `candidate_notes_authorId_fkey` FOREIGN KEY (`authorId`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `candidate_activities` ADD CONSTRAINT `candidate_activities_candidateId_fkey` FOREIGN KEY (`candidateId`) REFERENCES `candidate_profiles`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `job_applications` ADD CONSTRAINT `job_applications_candidateId_fkey` FOREIGN KEY (`candidateId`) REFERENCES `candidate_profiles`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `job_applications` ADD CONSTRAINT `job_applications_jobId_fkey` FOREIGN KEY (`jobId`) REFERENCES `job_requirements`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `job_applications` ADD CONSTRAINT `job_applications_resumeDocumentId_fkey` FOREIGN KEY (`resumeDocumentId`) REFERENCES `candidate_documents`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `job_applications` ADD CONSTRAINT `job_applications_sourceId_fkey` FOREIGN KEY (`sourceId`) REFERENCES `recruitment_sources`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `job_applications` ADD CONSTRAINT `job_applications_recruiterId_fkey` FOREIGN KEY (`recruiterId`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `application_status_history` ADD CONSTRAINT `application_status_history_applicationId_fkey` FOREIGN KEY (`applicationId`) REFERENCES `job_applications`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `application_status_history` ADD CONSTRAINT `application_status_history_changedById_fkey` FOREIGN KEY (`changedById`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `application_notes` ADD CONSTRAINT `application_notes_applicationId_fkey` FOREIGN KEY (`applicationId`) REFERENCES `job_applications`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `application_notes` ADD CONSTRAINT `application_notes_authorId_fkey` FOREIGN KEY (`authorId`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `interviews` ADD CONSTRAINT `interviews_applicationId_fkey` FOREIGN KEY (`applicationId`) REFERENCES `job_applications`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `interviews` ADD CONSTRAINT `interviews_candidateId_fkey` FOREIGN KEY (`candidateId`) REFERENCES `candidate_profiles`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `interviews` ADD CONSTRAINT `interviews_jobId_fkey` FOREIGN KEY (`jobId`) REFERENCES `job_requirements`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `interviews` ADD CONSTRAINT `interviews_organiserId_fkey` FOREIGN KEY (`organiserId`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `interview_panel_members` ADD CONSTRAINT `interview_panel_members_interviewId_fkey` FOREIGN KEY (`interviewId`) REFERENCES `interviews`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `interview_panel_members` ADD CONSTRAINT `interview_panel_members_interviewerId_fkey` FOREIGN KEY (`interviewerId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `interview_feedback` ADD CONSTRAINT `interview_feedback_interviewId_fkey` FOREIGN KEY (`interviewId`) REFERENCES `interviews`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `interview_feedback` ADD CONSTRAINT `interview_feedback_interviewerId_fkey` FOREIGN KEY (`interviewerId`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `offers` ADD CONSTRAINT `offers_applicationId_fkey` FOREIGN KEY (`applicationId`) REFERENCES `job_applications`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `offers` ADD CONSTRAINT `offers_candidateId_fkey` FOREIGN KEY (`candidateId`) REFERENCES `candidate_profiles`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `offers` ADD CONSTRAINT `offers_jobId_fkey` FOREIGN KEY (`jobId`) REFERENCES `job_requirements`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `offers` ADD CONSTRAINT `offers_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `offer_approvals` ADD CONSTRAINT `offer_approvals_offerId_fkey` FOREIGN KEY (`offerId`) REFERENCES `offers`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `offer_approvals` ADD CONSTRAINT `offer_approvals_approverId_fkey` FOREIGN KEY (`approverId`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `offer_history` ADD CONSTRAINT `offer_history_offerId_fkey` FOREIGN KEY (`offerId`) REFERENCES `offers`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `onboarding_records` ADD CONSTRAINT `onboarding_records_applicationId_fkey` FOREIGN KEY (`applicationId`) REFERENCES `job_applications`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `onboarding_records` ADD CONSTRAINT `onboarding_records_offerId_fkey` FOREIGN KEY (`offerId`) REFERENCES `offers`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `onboarding_records` ADD CONSTRAINT `onboarding_records_candidateId_fkey` FOREIGN KEY (`candidateId`) REFERENCES `candidate_profiles`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `onboarding_records` ADD CONSTRAINT `onboarding_records_departmentId_fkey` FOREIGN KEY (`departmentId`) REFERENCES `departments`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `onboarding_records` ADD CONSTRAINT `onboarding_records_reportingManagerId_fkey` FOREIGN KEY (`reportingManagerId`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `onboarding_tasks` ADD CONSTRAINT `onboarding_tasks_onboardingId_fkey` FOREIGN KEY (`onboardingId`) REFERENCES `onboarding_records`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `onboarding_tasks` ADD CONSTRAINT `onboarding_tasks_ownerUserId_fkey` FOREIGN KEY (`ownerUserId`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `notifications` ADD CONSTRAINT `notifications_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `notifications` ADD CONSTRAINT `notifications_templateId_fkey` FOREIGN KEY (`templateId`) REFERENCES `notification_templates`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `email_logs` ADD CONSTRAINT `email_logs_templateId_fkey` FOREIGN KEY (`templateId`) REFERENCES `notification_templates`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `audit_logs` ADD CONSTRAINT `audit_logs_actorUserId_fkey` FOREIGN KEY (`actorUserId`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
