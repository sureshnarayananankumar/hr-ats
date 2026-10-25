-- =====================================================================
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
--      docker exec hr-ats-mysql mysqldump -u root -p --no-data \
--        --skip-comments hr_ats_db > dump.sql
--      node scripts/gen-sql-docs.js dump.sql
--
--  Tables: 41   Foreign keys: 64
--  Generated: 2026-10-14
-- =====================================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

DROP TABLE IF EXISTS `_prisma_migrations`;
CREATE TABLE `_prisma_migrations` (
  `id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `checksum` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `finished_at` datetime(3) DEFAULT NULL,
  `migration_name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `logs` text COLLATE utf8mb4_unicode_ci,
  `rolled_back_at` datetime(3) DEFAULT NULL,
  `started_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `applied_steps_count` int unsigned NOT NULL DEFAULT '0',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
DROP TABLE IF EXISTS `application_notes`;
CREATE TABLE `application_notes` (
  `id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `applicationId` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `authorId` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `body` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `isInternal` tinyint(1) NOT NULL DEFAULT '1',
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` datetime(3) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `application_notes_applicationId_createdAt_idx` (`applicationId`,`createdAt`),
  KEY `application_notes_authorId_idx` (`authorId`),
  CONSTRAINT `application_notes_applicationId_fkey` FOREIGN KEY (`applicationId`) REFERENCES `job_applications` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `application_notes_authorId_fkey` FOREIGN KEY (`authorId`) REFERENCES `users` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
DROP TABLE IF EXISTS `application_status_history`;
CREATE TABLE `application_status_history` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `applicationId` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `fromStage` enum('APPLIED','RESUME_SCREENING','HR_SCREENING','SHORTLISTED','ASSESSMENT','TECHNICAL_INTERVIEW','HR_INTERVIEW','FINAL_INTERVIEW','SELECTED','OFFER_RELEASED','OFFER_ACCEPTED','HIRED') COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `toStage` enum('APPLIED','RESUME_SCREENING','HR_SCREENING','SHORTLISTED','ASSESSMENT','TECHNICAL_INTERVIEW','HR_INTERVIEW','FINAL_INTERVIEW','SELECTED','OFFER_RELEASED','OFFER_ACCEPTED','HIRED') COLLATE utf8mb4_unicode_ci NOT NULL,
  `fromStatus` enum('ACTIVE','ON_HOLD','REJECTED','WITHDRAWN','OFFER_DECLINED','HIRED') COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `toStatus` enum('ACTIVE','ON_HOLD','REJECTED','WITHDRAWN','OFFER_DECLINED','HIRED') COLLATE utf8mb4_unicode_ci NOT NULL,
  `changedById` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `reason` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `durationSeconds` int DEFAULT NULL,
  `changedAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `application_status_history_applicationId_changedAt_idx` (`applicationId`,`changedAt`),
  KEY `application_status_history_toStage_changedAt_idx` (`toStage`,`changedAt`),
  KEY `application_status_history_changedById_idx` (`changedById`),
  CONSTRAINT `application_status_history_applicationId_fkey` FOREIGN KEY (`applicationId`) REFERENCES `job_applications` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `application_status_history_changedById_fkey` FOREIGN KEY (`changedById`) REFERENCES `users` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=9 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
DROP TABLE IF EXISTS `audit_logs`;
CREATE TABLE `audit_logs` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `actorUserId` char(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `actorEmail` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `action` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `entityType` varchar(60) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `entityId` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `metadata` text COLLATE utf8mb4_unicode_ci,
  `ipAddress` varchar(45) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `userAgent` varchar(400) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `requestId` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `severity` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'INFO',
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `audit_logs_actorUserId_createdAt_idx` (`actorUserId`,`createdAt`),
  KEY `audit_logs_action_createdAt_idx` (`action`,`createdAt`),
  KEY `audit_logs_entityType_entityId_idx` (`entityType`,`entityId`),
  KEY `audit_logs_requestId_idx` (`requestId`),
  CONSTRAINT `audit_logs_actorUserId_fkey` FOREIGN KEY (`actorUserId`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=96 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
DROP TABLE IF EXISTS `candidate_activities`;
CREATE TABLE `candidate_activities` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `candidateId` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `activity` varchar(120) COLLATE utf8mb4_unicode_ci NOT NULL,
  `detail` text COLLATE utf8mb4_unicode_ci,
  `actorUserId` char(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `candidate_activities_candidateId_createdAt_idx` (`candidateId`,`createdAt`),
  CONSTRAINT `candidate_activities_candidateId_fkey` FOREIGN KEY (`candidateId`) REFERENCES `candidate_profiles` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=9 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
DROP TABLE IF EXISTS `candidate_documents`;
CREATE TABLE `candidate_documents` (
  `id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `candidateId` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `documentType` enum('RESUME','COVER_LETTER','CERTIFICATE','ID_PROOF','EDUCATION_PROOF','EXPERIENCE_LETTER','OFFER_DOCUMENT','OTHER') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'RESUME',
  `originalName` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `storageKey` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `mimeType` varchar(150) COLLATE utf8mb4_unicode_ci NOT NULL,
  `sizeBytes` int NOT NULL,
  `checksum` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `version` int NOT NULL DEFAULT '1',
  `isCurrent` tinyint(1) NOT NULL DEFAULT '1',
  `supersedesId` char(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `uploadedAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `deletedAt` datetime(3) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `candidate_documents_storageKey_key` (`storageKey`),
  KEY `candidate_documents_candidateId_documentType_isCurrent_idx` (`candidateId`,`documentType`,`isCurrent`),
  CONSTRAINT `candidate_documents_candidateId_fkey` FOREIGN KEY (`candidateId`) REFERENCES `candidate_profiles` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
DROP TABLE IF EXISTS `candidate_notes`;
CREATE TABLE `candidate_notes` (
  `id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `candidateId` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `authorId` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `body` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` datetime(3) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `candidate_notes_candidateId_createdAt_idx` (`candidateId`,`createdAt`),
  KEY `candidate_notes_authorId_idx` (`authorId`),
  CONSTRAINT `candidate_notes_authorId_fkey` FOREIGN KEY (`authorId`) REFERENCES `users` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `candidate_notes_candidateId_fkey` FOREIGN KEY (`candidateId`) REFERENCES `candidate_profiles` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
DROP TABLE IF EXISTS `candidate_profiles`;
CREATE TABLE `candidate_profiles` (
  `id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `candidateCode` varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL,
  `userId` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `fullName` varchar(200) COLLATE utf8mb4_unicode_ci NOT NULL,
  `normalisedEmail` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `normalisedPhone` varchar(30) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `mobile` varchar(30) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `location` varchar(200) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `totalExperience` decimal(4,1) DEFAULT NULL,
  `currentDesignation` varchar(150) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `currentCompany` varchar(200) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `highestEducation` varchar(200) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `educationDetails` text COLLATE utf8mb4_unicode_ci,
  `expectedSalary` decimal(14,2) DEFAULT NULL,
  `currentSalary` decimal(14,2) DEFAULT NULL,
  `salaryCurrency` varchar(3) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'USD',
  `noticePeriodDays` int DEFAULT NULL,
  `linkedinUrl` varchar(400) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `portfolioUrl` varchar(400) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `preferredLocation` varchar(200) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `preferredWorkMode` enum('ONSITE','REMOTE','HYBRID') COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `preferredEmploymentType` enum('FULL_TIME','PART_TIME','CONTRACT','TEMPORARY','INTERNSHIP','FREELANCE') COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `willingToRelocate` tinyint(1) NOT NULL DEFAULT '0',
  `summary` text COLLATE utf8mb4_unicode_ci,
  `consentToStoreData` tinyint(1) NOT NULL DEFAULT '0',
  `consentAt` datetime(3) DEFAULT NULL,
  `dataDeletionRequestedAt` datetime(3) DEFAULT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` datetime(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `candidate_profiles_candidateCode_key` (`candidateCode`),
  UNIQUE KEY `candidate_profiles_userId_key` (`userId`),
  KEY `candidate_profiles_normalisedEmail_idx` (`normalisedEmail`),
  KEY `candidate_profiles_normalisedPhone_idx` (`normalisedPhone`),
  KEY `candidate_profiles_fullName_idx` (`fullName`),
  CONSTRAINT `candidate_profiles_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
DROP TABLE IF EXISTS `candidate_skills`;
CREATE TABLE `candidate_skills` (
  `id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `candidateId` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `skillId` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `years` decimal(4,1) DEFAULT NULL,
  `proficiency` enum('BEGINNER','INTERMEDIATE','ADVANCED','EXPERT') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'INTERMEDIATE',
  PRIMARY KEY (`id`),
  UNIQUE KEY `candidate_skills_candidateId_skillId_key` (`candidateId`,`skillId`),
  KEY `candidate_skills_skillId_idx` (`skillId`),
  CONSTRAINT `candidate_skills_candidateId_fkey` FOREIGN KEY (`candidateId`) REFERENCES `candidate_profiles` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `candidate_skills_skillId_fkey` FOREIGN KEY (`skillId`) REFERENCES `skills` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
DROP TABLE IF EXISTS `candidate_tag_links`;
CREATE TABLE `candidate_tag_links` (
  `candidateId` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `tagId` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `assignedById` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `assignedAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`candidateId`,`tagId`),
  KEY `candidate_tag_links_tagId_idx` (`tagId`),
  KEY `candidate_tag_links_assignedById_idx` (`assignedById`),
  CONSTRAINT `candidate_tag_links_assignedById_fkey` FOREIGN KEY (`assignedById`) REFERENCES `users` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `candidate_tag_links_candidateId_fkey` FOREIGN KEY (`candidateId`) REFERENCES `candidate_profiles` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `candidate_tag_links_tagId_fkey` FOREIGN KEY (`tagId`) REFERENCES `candidate_tags` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
DROP TABLE IF EXISTS `candidate_tags`;
CREATE TABLE `candidate_tags` (
  `id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(60) COLLATE utf8mb4_unicode_ci NOT NULL,
  `colour` varchar(9) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '#64748b',
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `candidate_tags_name_key` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
DROP TABLE IF EXISTS `departments`;
CREATE TABLE `departments` (
  `id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `code` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(150) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `headUserId` char(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `isActive` tinyint(1) NOT NULL DEFAULT '1',
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` datetime(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `departments_code_key` (`code`),
  UNIQUE KEY `departments_name_key` (`name`),
  KEY `departments_isActive_idx` (`isActive`),
  KEY `departments_headUserId_idx` (`headUserId`),
  CONSTRAINT `departments_headUserId_fkey` FOREIGN KEY (`headUserId`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
DROP TABLE IF EXISTS `document_access_logs`;
CREATE TABLE `document_access_logs` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `documentId` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `userId` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `ipAddress` varchar(45) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `action` varchar(40) COLLATE utf8mb4_unicode_ci NOT NULL,
  `accessedAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `document_access_logs_documentId_accessedAt_idx` (`documentId`,`accessedAt`),
  KEY `document_access_logs_userId_idx` (`userId`),
  CONSTRAINT `document_access_logs_documentId_fkey` FOREIGN KEY (`documentId`) REFERENCES `candidate_documents` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
DROP TABLE IF EXISTS `email_logs`;
CREATE TABLE `email_logs` (
  `id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `templateId` char(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `toEmail` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `subject` varchar(300) COLLATE utf8mb4_unicode_ci NOT NULL,
  `status` enum('QUEUED','SENT','FAILED','BOUNCED') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'QUEUED',
  `providerId` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `errorMessage` text COLLATE utf8mb4_unicode_ci,
  `attempts` int NOT NULL DEFAULT '0',
  `queuedAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `sentAt` datetime(3) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `email_logs_status_queuedAt_idx` (`status`,`queuedAt`),
  KEY `email_logs_toEmail_idx` (`toEmail`),
  KEY `email_logs_templateId_idx` (`templateId`),
  CONSTRAINT `email_logs_templateId_fkey` FOREIGN KEY (`templateId`) REFERENCES `notification_templates` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
DROP TABLE IF EXISTS `email_verification_tokens`;
CREATE TABLE `email_verification_tokens` (
  `id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `userId` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `tokenHash` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `expiresAt` datetime(3) NOT NULL,
  `usedAt` datetime(3) DEFAULT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `email_verification_tokens_tokenHash_key` (`tokenHash`),
  KEY `email_verification_tokens_userId_idx` (`userId`),
  CONSTRAINT `email_verification_tokens_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
DROP TABLE IF EXISTS `interview_feedback`;
CREATE TABLE `interview_feedback` (
  `id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `interviewId` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `interviewerId` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `technicalSkills` int DEFAULT NULL,
  `communication` int DEFAULT NULL,
  `problemSolving` int DEFAULT NULL,
  `relevantExperience` int DEFAULT NULL,
  `roleSuitability` int DEFAULT NULL,
  `teamCollaboration` int DEFAULT NULL,
  `overallRating` int NOT NULL,
  `strengths` text COLLATE utf8mb4_unicode_ci,
  `areasForImprovement` text COLLATE utf8mb4_unicode_ci,
  `comments` text COLLATE utf8mb4_unicode_ci,
  `recommendation` enum('STRONG_HIRE','HIRE','HOLD','NO_HIRE') COLLATE utf8mb4_unicode_ci NOT NULL,
  `submittedAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` datetime(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `interview_feedback_interviewId_interviewerId_key` (`interviewId`,`interviewerId`),
  KEY `interview_feedback_interviewerId_idx` (`interviewerId`),
  KEY `interview_feedback_recommendation_idx` (`recommendation`),
  CONSTRAINT `interview_feedback_interviewerId_fkey` FOREIGN KEY (`interviewerId`) REFERENCES `users` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `interview_feedback_interviewId_fkey` FOREIGN KEY (`interviewId`) REFERENCES `interviews` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
DROP TABLE IF EXISTS `interview_panel_members`;
CREATE TABLE `interview_panel_members` (
  `interviewId` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `interviewerId` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `isLead` tinyint(1) NOT NULL DEFAULT '0',
  `invitedAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `respondedAt` datetime(3) DEFAULT NULL,
  `accepted` tinyint(1) DEFAULT NULL,
  PRIMARY KEY (`interviewId`,`interviewerId`),
  KEY `interview_panel_members_interviewerId_idx` (`interviewerId`),
  CONSTRAINT `interview_panel_members_interviewerId_fkey` FOREIGN KEY (`interviewerId`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `interview_panel_members_interviewId_fkey` FOREIGN KEY (`interviewId`) REFERENCES `interviews` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
DROP TABLE IF EXISTS `interviews`;
CREATE TABLE `interviews` (
  `id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `interviewCode` varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL,
  `applicationId` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `candidateId` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `jobId` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `round` int NOT NULL DEFAULT '1',
  `roundName` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `interviewType` enum('PHONE','VIDEO','ONSITE','PANEL','ASSESSMENT','TECHNICAL','HR') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'VIDEO',
  `scheduledStart` datetime(3) NOT NULL,
  `scheduledEnd` datetime(3) NOT NULL,
  `timeZone` varchar(60) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'UTC',
  `meetingLink` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `venue` varchar(300) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `instructions` text COLLATE utf8mb4_unicode_ci,
  `status` enum('SCHEDULED','RESCHEDULED','COMPLETED','CANCELLED','NO_SHOW') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'SCHEDULED',
  `cancelReason` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `rescheduledFromId` char(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `organiserId` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` datetime(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `interviews_interviewCode_key` (`interviewCode`),
  KEY `interviews_applicationId_round_idx` (`applicationId`,`round`),
  KEY `interviews_scheduledStart_status_idx` (`scheduledStart`,`status`),
  KEY `interviews_candidateId_idx` (`candidateId`),
  KEY `interviews_jobId_idx` (`jobId`),
  KEY `interviews_organiserId_idx` (`organiserId`),
  CONSTRAINT `interviews_applicationId_fkey` FOREIGN KEY (`applicationId`) REFERENCES `job_applications` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `interviews_candidateId_fkey` FOREIGN KEY (`candidateId`) REFERENCES `candidate_profiles` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `interviews_jobId_fkey` FOREIGN KEY (`jobId`) REFERENCES `job_requirements` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `interviews_organiserId_fkey` FOREIGN KEY (`organiserId`) REFERENCES `users` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
DROP TABLE IF EXISTS `job_applications`;
CREATE TABLE `job_applications` (
  `id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `applicationCode` varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL,
  `candidateId` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `jobId` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `activeJobKey` char(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `appliedAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `resumeDocumentId` char(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `coverLetter` text COLLATE utf8mb4_unicode_ci,
  `sourceId` char(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `recruiterId` char(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `currentStage` enum('APPLIED','RESUME_SCREENING','HR_SCREENING','SHORTLISTED','ASSESSMENT','TECHNICAL_INTERVIEW','HR_INTERVIEW','FINAL_INTERVIEW','SELECTED','OFFER_RELEASED','OFFER_ACCEPTED','HIRED') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'APPLIED',
  `status` enum('ACTIVE','ON_HOLD','REJECTED','WITHDRAWN','OFFER_DECLINED','HIRED') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'ACTIVE',
  `screeningResult` enum('NOT_SCREENED','PASS','FAIL','ON_HOLD') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'NOT_SCREENED',
  `screeningRemarks` text COLLATE utf8mb4_unicode_ci,
  `rejectionReason` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `withdrawReason` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `stageEnteredAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `followUpDueAt` datetime(3) DEFAULT NULL,
  `lastUpdatedAt` datetime(3) NOT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `job_applications_applicationCode_key` (`applicationCode`),
  UNIQUE KEY `job_applications_candidateId_activeJobKey_key` (`candidateId`,`activeJobKey`),
  KEY `job_applications_jobId_currentStage_idx` (`jobId`,`currentStage`),
  KEY `job_applications_jobId_status_idx` (`jobId`,`status`),
  KEY `job_applications_candidateId_idx` (`candidateId`),
  KEY `job_applications_recruiterId_status_idx` (`recruiterId`,`status`),
  KEY `job_applications_appliedAt_idx` (`appliedAt`),
  KEY `job_applications_currentStage_stageEnteredAt_idx` (`currentStage`,`stageEnteredAt`),
  KEY `job_applications_followUpDueAt_idx` (`followUpDueAt`),
  KEY `job_applications_resumeDocumentId_idx` (`resumeDocumentId`),
  KEY `job_applications_sourceId_idx` (`sourceId`),
  CONSTRAINT `job_applications_candidateId_fkey` FOREIGN KEY (`candidateId`) REFERENCES `candidate_profiles` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `job_applications_jobId_fkey` FOREIGN KEY (`jobId`) REFERENCES `job_requirements` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `job_applications_recruiterId_fkey` FOREIGN KEY (`recruiterId`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `job_applications_resumeDocumentId_fkey` FOREIGN KEY (`resumeDocumentId`) REFERENCES `candidate_documents` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `job_applications_sourceId_fkey` FOREIGN KEY (`sourceId`) REFERENCES `recruitment_sources` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
DROP TABLE IF EXISTS `job_approvals`;
CREATE TABLE `job_approvals` (
  `id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `jobId` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `approverId` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `sequence` int NOT NULL DEFAULT '1',
  `decision` enum('PENDING','APPROVED','REJECTED') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'PENDING',
  `comments` text COLLATE utf8mb4_unicode_ci,
  `decidedAt` datetime(3) DEFAULT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `job_approvals_jobId_approverId_sequence_key` (`jobId`,`approverId`,`sequence`),
  KEY `job_approvals_approverId_decision_idx` (`approverId`,`decision`),
  CONSTRAINT `job_approvals_approverId_fkey` FOREIGN KEY (`approverId`) REFERENCES `users` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `job_approvals_jobId_fkey` FOREIGN KEY (`jobId`) REFERENCES `job_requirements` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
DROP TABLE IF EXISTS `job_requirement_history`;
CREATE TABLE `job_requirement_history` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `jobId` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `changedById` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `fieldName` varchar(80) COLLATE utf8mb4_unicode_ci NOT NULL,
  `oldValue` text COLLATE utf8mb4_unicode_ci,
  `newValue` text COLLATE utf8mb4_unicode_ci,
  `reason` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `changedAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `job_requirement_history_jobId_changedAt_idx` (`jobId`,`changedAt`),
  CONSTRAINT `job_requirement_history_jobId_fkey` FOREIGN KEY (`jobId`) REFERENCES `job_requirements` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=13 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
DROP TABLE IF EXISTS `job_requirements`;
CREATE TABLE `job_requirements` (
  `id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `requirementCode` varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL,
  `title` varchar(200) COLLATE utf8mb4_unicode_ci NOT NULL,
  `slug` varchar(250) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `responsibilities` text COLLATE utf8mb4_unicode_ci,
  `qualifications` text COLLATE utf8mb4_unicode_ci,
  `internalNotes` text COLLATE utf8mb4_unicode_ci,
  `minExperience` int NOT NULL DEFAULT '0',
  `maxExperience` int DEFAULT NULL,
  `departmentId` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `designation` varchar(150) COLLATE utf8mb4_unicode_ci NOT NULL,
  `vacancies` int NOT NULL DEFAULT '1',
  `vacanciesFilled` int NOT NULL DEFAULT '0',
  `employmentType` enum('FULL_TIME','PART_TIME','CONTRACT','TEMPORARY','INTERNSHIP','FREELANCE') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'FULL_TIME',
  `workMode` enum('ONSITE','REMOTE','HYBRID') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'ONSITE',
  `location` varchar(200) COLLATE utf8mb4_unicode_ci NOT NULL,
  `salaryMin` decimal(14,2) DEFAULT NULL,
  `salaryMax` decimal(14,2) DEFAULT NULL,
  `salaryCurrency` varchar(3) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'USD',
  `salaryConfidential` tinyint(1) NOT NULL DEFAULT '1',
  `priority` enum('LOW','MEDIUM','HIGH','CRITICAL') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'MEDIUM',
  `status` enum('DRAFT','PENDING_APPROVAL','APPROVED','PUBLISHED','ON_HOLD','CLOSED','CANCELLED') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'DRAFT',
  `requestedById` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `requestDate` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `recruiterId` char(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `hiringManagerId` char(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `createdById` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `publishedAt` datetime(3) DEFAULT NULL,
  `applicationDeadline` datetime(3) DEFAULT NULL,
  `closedAt` datetime(3) DEFAULT NULL,
  `onHoldReason` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `cancelReason` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `duplicatedFromId` char(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` datetime(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `job_requirements_requirementCode_key` (`requirementCode`),
  UNIQUE KEY `job_requirements_slug_key` (`slug`),
  KEY `job_requirements_status_idx` (`status`),
  KEY `job_requirements_departmentId_idx` (`departmentId`),
  KEY `job_requirements_recruiterId_idx` (`recruiterId`),
  KEY `job_requirements_hiringManagerId_idx` (`hiringManagerId`),
  KEY `job_requirements_requestedById_idx` (`requestedById`),
  KEY `job_requirements_createdById_idx` (`createdById`),
  KEY `job_requirements_publishedAt_idx` (`publishedAt`),
  KEY `job_requirements_status_publishedAt_idx` (`status`,`publishedAt`),
  KEY `job_requirements_applicationDeadline_idx` (`applicationDeadline`),
  CONSTRAINT `job_requirements_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `users` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `job_requirements_departmentId_fkey` FOREIGN KEY (`departmentId`) REFERENCES `departments` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `job_requirements_hiringManagerId_fkey` FOREIGN KEY (`hiringManagerId`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `job_requirements_recruiterId_fkey` FOREIGN KEY (`recruiterId`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `job_requirements_requestedById_fkey` FOREIGN KEY (`requestedById`) REFERENCES `users` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
DROP TABLE IF EXISTS `job_skills`;
CREATE TABLE `job_skills` (
  `id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `jobId` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `skillId` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `isRequired` tinyint(1) NOT NULL DEFAULT '1',
  `minYears` int DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `job_skills_jobId_skillId_key` (`jobId`,`skillId`),
  KEY `job_skills_skillId_idx` (`skillId`),
  CONSTRAINT `job_skills_jobId_fkey` FOREIGN KEY (`jobId`) REFERENCES `job_requirements` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `job_skills_skillId_fkey` FOREIGN KEY (`skillId`) REFERENCES `skills` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
DROP TABLE IF EXISTS `login_attempts`;
CREATE TABLE `login_attempts` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `email` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `ipAddress` varchar(45) COLLATE utf8mb4_unicode_ci NOT NULL,
  `successful` tinyint(1) NOT NULL,
  `reason` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `userAgent` varchar(400) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `login_attempts_email_createdAt_idx` (`email`,`createdAt`),
  KEY `login_attempts_ipAddress_createdAt_idx` (`ipAddress`,`createdAt`)
) ENGINE=InnoDB AUTO_INCREMENT=56 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
DROP TABLE IF EXISTS `notification_templates`;
CREATE TABLE `notification_templates` (
  `id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `key` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(150) COLLATE utf8mb4_unicode_ci NOT NULL,
  `channel` enum('IN_APP','EMAIL','BOTH') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'BOTH',
  `subject` varchar(300) COLLATE utf8mb4_unicode_ci NOT NULL,
  `bodyHtml` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `bodyText` text COLLATE utf8mb4_unicode_ci,
  `variables` text COLLATE utf8mb4_unicode_ci,
  `isActive` tinyint(1) NOT NULL DEFAULT '1',
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` datetime(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `notification_templates_key_key` (`key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
DROP TABLE IF EXISTS `notifications`;
CREATE TABLE `notifications` (
  `id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `userId` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `templateId` char(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `channel` enum('IN_APP','EMAIL','BOTH') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'IN_APP',
  `title` varchar(300) COLLATE utf8mb4_unicode_ci NOT NULL,
  `body` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `link` varchar(400) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `category` varchar(60) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `readAt` datetime(3) DEFAULT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `notifications_userId_readAt_idx` (`userId`,`readAt`),
  KEY `notifications_createdAt_idx` (`createdAt`),
  KEY `notifications_templateId_idx` (`templateId`),
  CONSTRAINT `notifications_templateId_fkey` FOREIGN KEY (`templateId`) REFERENCES `notification_templates` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `notifications_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
DROP TABLE IF EXISTS `offer_approvals`;
CREATE TABLE `offer_approvals` (
  `id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `offerId` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `approverId` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `sequence` int NOT NULL DEFAULT '1',
  `decision` enum('PENDING','APPROVED','REJECTED') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'PENDING',
  `comments` text COLLATE utf8mb4_unicode_ci,
  `decidedAt` datetime(3) DEFAULT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `offer_approvals_offerId_approverId_sequence_key` (`offerId`,`approverId`,`sequence`),
  KEY `offer_approvals_approverId_decision_idx` (`approverId`,`decision`),
  CONSTRAINT `offer_approvals_approverId_fkey` FOREIGN KEY (`approverId`) REFERENCES `users` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `offer_approvals_offerId_fkey` FOREIGN KEY (`offerId`) REFERENCES `offers` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
DROP TABLE IF EXISTS `offer_history`;
CREATE TABLE `offer_history` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `offerId` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `fromStatus` enum('DRAFT','PENDING_APPROVAL','APPROVED','SENT','ACCEPTED','DECLINED','EXPIRED','WITHDRAWN') COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `toStatus` enum('DRAFT','PENDING_APPROVAL','APPROVED','SENT','ACCEPTED','DECLINED','EXPIRED','WITHDRAWN') COLLATE utf8mb4_unicode_ci NOT NULL,
  `changedById` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `reason` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `changedAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `offer_history_offerId_changedAt_idx` (`offerId`,`changedAt`),
  CONSTRAINT `offer_history_offerId_fkey` FOREIGN KEY (`offerId`) REFERENCES `offers` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
DROP TABLE IF EXISTS `offers`;
CREATE TABLE `offers` (
  `id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `offerCode` varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL,
  `applicationId` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `candidateId` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `jobId` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `proposedDesignation` varchar(150) COLLATE utf8mb4_unicode_ci NOT NULL,
  `departmentName` varchar(150) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `annualSalary` decimal(14,2) NOT NULL,
  `currency` varchar(3) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'USD',
  `bonus` decimal(14,2) DEFAULT NULL,
  `benefits` text COLLATE utf8mb4_unicode_ci,
  `joiningDate` datetime(3) NOT NULL,
  `issuedAt` datetime(3) DEFAULT NULL,
  `expiresAt` datetime(3) DEFAULT NULL,
  `status` enum('DRAFT','PENDING_APPROVAL','APPROVED','SENT','ACCEPTED','DECLINED','EXPIRED','WITHDRAWN') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'DRAFT',
  `declineReason` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `withdrawReason` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `respondedAt` datetime(3) DEFAULT NULL,
  `offerDocumentKey` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `createdById` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `revision` int NOT NULL DEFAULT '1',
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` datetime(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `offers_offerCode_key` (`offerCode`),
  KEY `offers_applicationId_idx` (`applicationId`),
  KEY `offers_status_idx` (`status`),
  KEY `offers_candidateId_idx` (`candidateId`),
  KEY `offers_jobId_idx` (`jobId`),
  KEY `offers_createdById_idx` (`createdById`),
  CONSTRAINT `offers_applicationId_fkey` FOREIGN KEY (`applicationId`) REFERENCES `job_applications` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `offers_candidateId_fkey` FOREIGN KEY (`candidateId`) REFERENCES `candidate_profiles` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `offers_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `users` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `offers_jobId_fkey` FOREIGN KEY (`jobId`) REFERENCES `job_requirements` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
DROP TABLE IF EXISTS `onboarding_records`;
CREATE TABLE `onboarding_records` (
  `id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `onboardingCode` varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL,
  `applicationId` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `offerId` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `candidateId` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `status` enum('OFFER_ACCEPTED','PREBOARDING','JOINED','DID_NOT_JOIN') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'OFFER_ACCEPTED',
  `joiningDate` datetime(3) NOT NULL,
  `actualJoinDate` datetime(3) DEFAULT NULL,
  `departmentId` char(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `designation` varchar(150) COLLATE utf8mb4_unicode_ci NOT NULL,
  `reportingManagerId` char(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `employeeCode` varchar(30) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `didNotJoinReason` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `documentsVerified` tinyint(1) NOT NULL DEFAULT '0',
  `verifiedAt` datetime(3) DEFAULT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` datetime(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `onboarding_records_onboardingCode_key` (`onboardingCode`),
  UNIQUE KEY `onboarding_records_applicationId_key` (`applicationId`),
  UNIQUE KEY `onboarding_records_offerId_key` (`offerId`),
  UNIQUE KEY `onboarding_records_employeeCode_key` (`employeeCode`),
  KEY `onboarding_records_status_idx` (`status`),
  KEY `onboarding_records_joiningDate_idx` (`joiningDate`),
  KEY `onboarding_records_candidateId_idx` (`candidateId`),
  KEY `onboarding_records_departmentId_idx` (`departmentId`),
  KEY `onboarding_records_reportingManagerId_idx` (`reportingManagerId`),
  CONSTRAINT `onboarding_records_applicationId_fkey` FOREIGN KEY (`applicationId`) REFERENCES `job_applications` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `onboarding_records_candidateId_fkey` FOREIGN KEY (`candidateId`) REFERENCES `candidate_profiles` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `onboarding_records_departmentId_fkey` FOREIGN KEY (`departmentId`) REFERENCES `departments` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `onboarding_records_offerId_fkey` FOREIGN KEY (`offerId`) REFERENCES `offers` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `onboarding_records_reportingManagerId_fkey` FOREIGN KEY (`reportingManagerId`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
DROP TABLE IF EXISTS `onboarding_tasks`;
CREATE TABLE `onboarding_tasks` (
  `id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `onboardingId` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `title` varchar(200) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` text COLLATE utf8mb4_unicode_ci,
  `category` varchar(60) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `ownerUserId` char(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `dueDate` datetime(3) DEFAULT NULL,
  `status` enum('PENDING','IN_PROGRESS','COMPLETED','BLOCKED','CANCELLED') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'PENDING',
  `completedAt` datetime(3) DEFAULT NULL,
  `sequence` int NOT NULL DEFAULT '0',
  `isMandatory` tinyint(1) NOT NULL DEFAULT '1',
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` datetime(3) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `onboarding_tasks_onboardingId_sequence_idx` (`onboardingId`,`sequence`),
  KEY `onboarding_tasks_ownerUserId_status_idx` (`ownerUserId`,`status`),
  KEY `onboarding_tasks_dueDate_idx` (`dueDate`),
  CONSTRAINT `onboarding_tasks_onboardingId_fkey` FOREIGN KEY (`onboardingId`) REFERENCES `onboarding_records` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `onboarding_tasks_ownerUserId_fkey` FOREIGN KEY (`ownerUserId`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
DROP TABLE IF EXISTS `password_reset_tokens`;
CREATE TABLE `password_reset_tokens` (
  `id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `userId` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `tokenHash` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `expiresAt` datetime(3) NOT NULL,
  `usedAt` datetime(3) DEFAULT NULL,
  `requestIp` varchar(45) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `password_reset_tokens_tokenHash_key` (`tokenHash`),
  KEY `password_reset_tokens_userId_idx` (`userId`),
  CONSTRAINT `password_reset_tokens_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
DROP TABLE IF EXISTS `permissions`;
CREATE TABLE `permissions` (
  `id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `key` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `resource` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `action` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `permissions_key_key` (`key`),
  KEY `permissions_resource_idx` (`resource`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
DROP TABLE IF EXISTS `recruitment_sources`;
CREATE TABLE `recruitment_sources` (
  `id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `category` varchar(60) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `costPerMonth` decimal(12,2) DEFAULT NULL,
  `isActive` tinyint(1) NOT NULL DEFAULT '1',
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `recruitment_sources_name_key` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
DROP TABLE IF EXISTS `refresh_sessions`;
CREATE TABLE `refresh_sessions` (
  `id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `userId` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `tokenHash` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `previousId` char(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `userAgent` varchar(400) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `ipAddress` varchar(45) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `expiresAt` datetime(3) NOT NULL,
  `revokedAt` datetime(3) DEFAULT NULL,
  `revokedReason` varchar(200) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `refresh_sessions_tokenHash_key` (`tokenHash`),
  KEY `refresh_sessions_userId_idx` (`userId`),
  KEY `refresh_sessions_expiresAt_idx` (`expiresAt`),
  CONSTRAINT `refresh_sessions_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
DROP TABLE IF EXISTS `role_permissions`;
CREATE TABLE `role_permissions` (
  `roleId` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `permissionId` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  PRIMARY KEY (`roleId`,`permissionId`),
  KEY `role_permissions_permissionId_idx` (`permissionId`),
  CONSTRAINT `role_permissions_permissionId_fkey` FOREIGN KEY (`permissionId`) REFERENCES `permissions` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `role_permissions_roleId_fkey` FOREIGN KEY (`roleId`) REFERENCES `roles` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
DROP TABLE IF EXISTS `roles`;
CREATE TABLE `roles` (
  `id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` enum('SUPER_ADMIN','HR_ADMIN','RECRUITER','HIRING_MANAGER','INTERVIEWER','CANDIDATE') COLLATE utf8mb4_unicode_ci NOT NULL,
  `label` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `isSystem` tinyint(1) NOT NULL DEFAULT '1',
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` datetime(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `roles_name_key` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
DROP TABLE IF EXISTS `skills`;
CREATE TABLE `skills` (
  `id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `category` varchar(60) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `skills_name_key` (`name`),
  KEY `skills_category_idx` (`category`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
DROP TABLE IF EXISTS `system_settings`;
CREATE TABLE `system_settings` (
  `id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `key` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `value` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `valueType` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'string',
  `category` varchar(60) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'general',
  `description` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `isSecret` tinyint(1) NOT NULL DEFAULT '0',
  `updatedById` char(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` datetime(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `system_settings_key_key` (`key`),
  KEY `system_settings_category_idx` (`category`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
DROP TABLE IF EXISTS `user_roles`;
CREATE TABLE `user_roles` (
  `userId` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `roleId` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `assignedAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `assignedBy` char(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`userId`,`roleId`),
  KEY `user_roles_roleId_idx` (`roleId`),
  CONSTRAINT `user_roles_roleId_fkey` FOREIGN KEY (`roleId`) REFERENCES `roles` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `user_roles_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
DROP TABLE IF EXISTS `users`;
CREATE TABLE `users` (
  `id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `email` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `passwordHash` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `firstName` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `lastName` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `phone` varchar(30) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `status` enum('PENDING_VERIFICATION','ACTIVE','SUSPENDED','DEACTIVATED') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'PENDING_VERIFICATION',
  `emailVerifiedAt` datetime(3) DEFAULT NULL,
  `mfaEnabled` tinyint(1) NOT NULL DEFAULT '0',
  `mfaSecret` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `mfaRecoveryCodes` text COLLATE utf8mb4_unicode_ci,
  `failedLoginCount` int NOT NULL DEFAULT '0',
  `lockedUntil` datetime(3) DEFAULT NULL,
  `lastLoginAt` datetime(3) DEFAULT NULL,
  `lastLoginIp` varchar(45) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `consentGivenAt` datetime(3) DEFAULT NULL,
  `dataRetentionUntil` datetime(3) DEFAULT NULL,
  `deactivatedAt` datetime(3) DEFAULT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` datetime(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `users_email_key` (`email`),
  KEY `users_status_idx` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
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
