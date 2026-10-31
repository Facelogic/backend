-- Generated from Administrador/database/esquema.sql (Spanish) — English schema, owned by the Backend.

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('SUPERADMIN', 'PRINCIPAL', 'COORDINATOR', 'SECRETARY', 'GATEKEEPER');

-- CreateEnum
CREATE TYPE "AccountStatus" AS ENUM ('INVITED', 'ACTIVE', 'DISABLED');

-- CreateEnum
CREATE TYPE "RegistrationStatus" AS ENUM ('DRAFT', 'COMPLETE');

-- CreateEnum
CREATE TYPE "PhotoServiceStatus" AS ENUM ('PENDING', 'ACTIVE', 'SUSPENDED', 'INACTIVE');

-- CreateEnum
CREATE TYPE "Level" AS ENUM ('PRESCHOOL', 'PRIMARY', 'SECONDARY');

-- CreateEnum
CREATE TYPE "AppStatus" AS ENUM ('NOT_INVITED', 'INVITATION_SENT', 'INSTALLED', 'NOTIFICATIONS_ENABLED');

-- CreateEnum
CREATE TYPE "ArrivalMethod" AS ENUM ('QR', 'NATIONAL_ID', 'MANUAL');

-- CreateEnum
CREATE TYPE "ValidationMethod" AS ENUM ('FACE', 'CODE', 'NATIONAL_ID', 'UNACCOMPANIED', 'MANUAL');

-- CreateEnum
CREATE TYPE "PickupStatus" AS ENUM ('AUTHORIZED', 'DENIED', 'MANUAL');

-- CreateEnum
CREATE TYPE "PhotoType" AS ENUM ('FACE_VALIDATION', 'QR_SCAN', 'EXIT');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('ARRIVAL', 'EXIT', 'UNAUTHORIZED_ALERT', 'REMINDER');

-- CreateEnum
CREATE TYPE "AlertType" AS ENUM ('UNREGISTERED_FACE', 'POSSIBLE_FRAUD', 'CODE_REJECTED', 'GUARDIAN_DISPUTED');

-- CreateEnum
CREATE TYPE "ShiftType" AS ENUM ('FIXED', 'FLEXIBLE');

-- CreateEnum
CREATE TYPE "TimeEntrySource" AS ENUM ('STATION', 'MANUAL');

-- CreateEnum
CREATE TYPE "CodeStatus" AS ENUM ('VALID', 'USED', 'EXPIRED', 'REVOKED');

-- CreateEnum
CREATE TYPE "CodeValidity" AS ENUM ('UNTIL_18H', 'FOUR_HOURS');

-- CreateEnum
CREATE TYPE "CodeIssuer" AS ENUM ('PRIMARY_GUARDIANS', 'ALL_GUARDIANS');

-- CreateEnum
CREATE TYPE "ReportType" AS ENUM ('ATTENDANCE', 'PICKUPS');

-- CreateTable
CREATE TABLE "School" (
    "id" UUID NOT NULL,
    "slug" VARCHAR(40) NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "modularCode" CHAR(7) NOT NULL,
    "taxId" CHAR(11) NOT NULL,
    "address" VARCHAR(200),
    "region" VARCHAR(60) NOT NULL,
    "province" VARCHAR(60) NOT NULL,
    "district" VARCHAR(60) NOT NULL,
    "principalName" VARCHAR(120),
    "registrationStatus" "RegistrationStatus" NOT NULL DEFAULT 'DRAFT',
    "photoService" "PhotoServiceStatus" NOT NULL DEFAULT 'PENDING',
    "photoServiceSince" TIMESTAMPTZ(3),
    "photoServiceCancelledAt" TIMESTAMPTZ(3),
    "photoServiceNote" VARCHAR(160),
    "appPublishedAt" TIMESTAMPTZ(3),
    "contractSignedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "School_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LevelSchedule" (
    "schoolId" UUID NOT NULL,
    "level" "Level" NOT NULL,
    "dismissalFrom" CHAR(5) NOT NULL,
    "dismissalTo" CHAR(5) NOT NULL,

    CONSTRAINT "LevelSchedule_pkey" PRIMARY KEY ("schoolId","level")
);

-- CreateTable
CREATE TABLE "SchoolSettings" (
    "schoolId" UUID NOT NULL,
    "photoOnlyWithConsent" BOOLEAN NOT NULL DEFAULT true,
    "flagUnopened" BOOLEAN NOT NULL DEFAULT true,
    "unopenedMinutes" INTEGER NOT NULL DEFAULT 10,
    "disputeButtonEnabled" BOOLEAN NOT NULL DEFAULT true,
    "photoRetentionDays" INTEGER NOT NULL DEFAULT 30,
    "reminderEnabled" BOOLEAN NOT NULL DEFAULT true,
    "reminderMinutes" INTEGER NOT NULL DEFAULT 30,
    "reminderRepeats" INTEGER NOT NULL DEFAULT 2,
    "reminderIntervalMin" INTEGER NOT NULL DEFAULT 30,
    "codeEnabled" BOOLEAN NOT NULL DEFAULT true,
    "codeValidity" "CodeValidity" NOT NULL DEFAULT 'UNTIL_18H',
    "codesPerStudentPerDay" INTEGER NOT NULL DEFAULT 1,
    "codeIssuer" "CodeIssuer" NOT NULL DEFAULT 'PRIMARY_GUARDIANS',
    "attemptsBeforeLock" INTEGER NOT NULL DEFAULT 3,
    "validateFaceOnArrival" BOOLEAN NOT NULL DEFAULT true,
    "notifyArrival" BOOLEAN NOT NULL DEFAULT true,
    "allowNationalId" BOOLEAN NOT NULL DEFAULT true,
    "notificationShowsValidation" BOOLEAN NOT NULL DEFAULT true,
    "notificationShowsPhoto" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "SchoolSettings_pkey" PRIMARY KEY ("schoolId")
);

-- CreateTable
CREATE TABLE "Station" (
    "id" UUID NOT NULL,
    "schoolId" UUID NOT NULL,
    "code" VARCHAR(20) NOT NULL,
    "name" VARCHAR(80) NOT NULL,
    "version" VARCHAR(20),
    "serialNumber" VARCHAR(60),
    "lastSyncAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Station_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" UUID NOT NULL,
    "email" VARCHAR(160) NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "role" "Role" NOT NULL,
    "schoolId" UUID,
    "status" "AccountStatus" NOT NULL DEFAULT 'INVITED',
    "passwordHash" VARCHAR(200),
    "pinHash" VARCHAR(200),
    "requireTwoFactor" BOOLEAN NOT NULL DEFAULT false,
    "twoFactorEnabledAt" TIMESTAMPTZ(3),
    "failedAttempts" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" TIMESTAMPTZ(3),
    "lastLoginAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "tokenHash" CHAR(64) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "lastActivityAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Invitation" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "tokenHash" CHAR(64) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "usedAt" TIMESTAMPTZ(3),

    CONSTRAINT "Invitation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Student" (
    "id" UUID NOT NULL,
    "schoolId" UUID NOT NULL,
    "firstName" VARCHAR(80) NOT NULL,
    "lastName" VARCHAR(80) NOT NULL,
    "nationalId" CHAR(8),
    "level" "Level" NOT NULL,
    "grade" VARCHAR(20) NOT NULL,
    "section" VARCHAR(10),
    "badgeCode" VARCHAR(30) NOT NULL,
    "badgeVersion" INTEGER NOT NULL DEFAULT 1,
    "canLeaveAlone" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Student_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Guardian" (
    "id" UUID NOT NULL,
    "schoolId" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "nationalId" CHAR(8) NOT NULL,
    "phone" VARCHAR(16),
    "appStatus" "AppStatus" NOT NULL DEFAULT 'NOT_INVITED',
    "appInvitedAt" TIMESTAMPTZ(3),
    "receivesPhotos" BOOLEAN NOT NULL DEFAULT true,
    "consentSignedAt" TIMESTAMPTZ(3),
    "imageUseAuthorized" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Guardian_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Authorization" (
    "id" UUID NOT NULL,
    "studentId" UUID NOT NULL,
    "guardianId" UUID NOT NULL,
    "relationship" VARCHAR(40) NOT NULL,
    "canPickUp" BOOLEAN NOT NULL DEFAULT true,
    "receivesNotifications" BOOLEAN NOT NULL DEFAULT false,
    "isPrimaryGuardian" BOOLEAN NOT NULL DEFAULT false,
    "validUntil" DATE,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMPTZ(3),

    CONSTRAINT "Authorization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Shift" (
    "id" UUID NOT NULL,
    "schoolId" UUID NOT NULL,
    "name" VARCHAR(60) NOT NULL,
    "type" "ShiftType" NOT NULL,
    "startTime" CHAR(5),
    "endTime" CHAR(5),
    "breakStart" CHAR(5),
    "breakEnd" CHAR(5),
    "breakDeductionMin" INTEGER NOT NULL DEFAULT 0,
    "graceMin" INTEGER NOT NULL DEFAULT 0,
    "countOvertime" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Shift_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Staff" (
    "id" UUID NOT NULL,
    "schoolId" UUID NOT NULL,
    "nationalId" CHAR(8) NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "position" VARCHAR(80) NOT NULL,
    "department" VARCHAR(60) NOT NULL,
    "shiftId" UUID,
    "email" VARCHAR(160),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Staff_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TimeEntry" (
    "id" UUID NOT NULL,
    "schoolId" UUID NOT NULL,
    "staffId" UUID NOT NULL,
    "stationId" UUID,
    "date" DATE NOT NULL,
    "clockInAt" TIMESTAMPTZ(3) NOT NULL,
    "clockOutAt" TIMESTAMPTZ(3),
    "shiftName" VARCHAR(60) NOT NULL,
    "lateMin" INTEGER NOT NULL DEFAULT 0,
    "workedMin" INTEGER,
    "overtimeMin" INTEGER NOT NULL DEFAULT 0,
    "source" "TimeEntrySource" NOT NULL DEFAULT 'STATION',
    "manualReason" VARCHAR(120),
    "remarks" VARCHAR(300),
    "autoClosed" BOOLEAN NOT NULL DEFAULT false,
    "confidence" DOUBLE PRECISION,
    "recordedById" UUID,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "TimeEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FaceEnrollment" (
    "id" UUID NOT NULL,
    "schoolId" UUID NOT NULL,
    "staffId" UUID,
    "guardianId" UUID,
    "poses" INTEGER NOT NULL,
    "enrolledAt" TIMESTAMPTZ(3) NOT NULL,
    "consentAt" TIMESTAMPTZ(3) NOT NULL,
    "learnedTemplates" INTEGER NOT NULL DEFAULT 0,
    "lastTemplateAt" TIMESTAMPTZ(3),
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "FaceEnrollment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Arrival" (
    "id" UUID NOT NULL,
    "schoolId" UUID NOT NULL,
    "stationId" UUID,
    "studentId" UUID NOT NULL,
    "occurredAt" TIMESTAMPTZ(3) NOT NULL,
    "method" "ArrivalMethod" NOT NULL,
    "droppedOffBy" VARCHAR(120),

    CONSTRAINT "Arrival_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Pickup" (
    "id" UUID NOT NULL,
    "code" VARCHAR(24) NOT NULL,
    "schoolId" UUID NOT NULL,
    "stationId" UUID,
    "studentId" UUID NOT NULL,
    "occurredAt" TIMESTAMPTZ(3) NOT NULL,
    "status" "PickupStatus" NOT NULL,
    "method" "ValidationMethod" NOT NULL,
    "guardianId" UUID,
    "pickedUpBy" VARCHAR(120) NOT NULL,
    "confidence" DOUBLE PRECISION,
    "recordedById" UUID,
    "manualReason" VARCHAR(160),
    "noPhotoReason" VARCHAR(160),
    "photosExpireAt" TIMESTAMPTZ(3),
    "pickupCodeId" UUID,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Pickup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PickupPhoto" (
    "id" UUID NOT NULL,
    "pickupId" UUID NOT NULL,
    "sequence" INTEGER NOT NULL,
    "type" "PhotoType" NOT NULL,
    "takenAt" TIMESTAMPTZ(3) NOT NULL,
    "storageKey" VARCHAR(200),
    "deletedAt" TIMESTAMPTZ(3),

    CONSTRAINT "PickupPhoto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PickupCounter" (
    "date" CHAR(8) NOT NULL,
    "value" INTEGER NOT NULL,

    CONSTRAINT "PickupCounter_pkey" PRIMARY KEY ("date")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" UUID NOT NULL,
    "schoolId" UUID NOT NULL,
    "studentId" UUID NOT NULL,
    "guardianId" UUID NOT NULL,
    "type" "NotificationType" NOT NULL,
    "pickupId" UUID,
    "attemptNumber" INTEGER NOT NULL DEFAULT 1,
    "sentAt" TIMESTAMPTZ(3) NOT NULL,
    "delivered" BOOLEAN NOT NULL DEFAULT true,
    "undeliveredReason" VARCHAR(120),
    "withPhoto" BOOLEAN NOT NULL DEFAULT false,
    "openedAt" TIMESTAMPTZ(3),
    "response" VARCHAR(200),
    "respondedAt" TIMESTAMPTZ(3),

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Alert" (
    "id" UUID NOT NULL,
    "schoolId" UUID NOT NULL,
    "type" "AlertType" NOT NULL,
    "studentId" UUID,
    "pickupId" UUID,
    "detail" VARCHAR(300) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMPTZ(3),
    "resolvedById" UUID,
    "note" VARCHAR(300),

    CONSTRAINT "Alert_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PickupCode" (
    "id" UUID NOT NULL,
    "schoolId" UUID NOT NULL,
    "studentId" UUID NOT NULL,
    "requestedById" UUID NOT NULL,
    "recipientName" VARCHAR(120) NOT NULL,
    "recipientNationalId" CHAR(8) NOT NULL,
    "fingerprint" CHAR(64) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "status" "CodeStatus" NOT NULL DEFAULT 'VALID',
    "usedAt" TIMESTAMPTZ(3),

    CONSTRAINT "PickupCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FaceParameters" (
    "version" SERIAL NOT NULL,
    "values" JSONB NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" UUID,

    CONSTRAINT "FaceParameters_pkey" PRIMARY KEY ("version")
);

-- CreateTable
CREATE TABLE "ReportDownload" (
    "id" UUID NOT NULL,
    "schoolId" UUID NOT NULL,
    "userId" UUID,
    "type" "ReportType" NOT NULL,
    "description" VARCHAR(160) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReportDownload_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" UUID NOT NULL,
    "occurredAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" UUID,
    "schoolId" UUID,
    "action" VARCHAR(60) NOT NULL,
    "detail" JSONB,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "School_slug_key" ON "School"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "School_modularCode_key" ON "School"("modularCode");

-- CreateIndex
CREATE UNIQUE INDEX "Station_code_key" ON "Station"("code");

-- CreateIndex
CREATE INDEX "Station_schoolId_idx" ON "Station"("schoolId");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_schoolId_idx" ON "User"("schoolId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_tokenHash_key" ON "Session"("tokenHash");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Invitation_tokenHash_key" ON "Invitation"("tokenHash");

-- CreateIndex
CREATE INDEX "Invitation_userId_idx" ON "Invitation"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Student_badgeCode_key" ON "Student"("badgeCode");

-- CreateIndex
CREATE INDEX "Student_schoolId_lastName_idx" ON "Student"("schoolId", "lastName");

-- CreateIndex
CREATE UNIQUE INDEX "Student_schoolId_nationalId_key" ON "Student"("schoolId", "nationalId");

-- CreateIndex
CREATE UNIQUE INDEX "Guardian_schoolId_nationalId_key" ON "Guardian"("schoolId", "nationalId");

-- CreateIndex
CREATE INDEX "Authorization_guardianId_idx" ON "Authorization"("guardianId");

-- CreateIndex
CREATE UNIQUE INDEX "Authorization_studentId_guardianId_key" ON "Authorization"("studentId", "guardianId");

-- CreateIndex
CREATE UNIQUE INDEX "Shift_schoolId_name_key" ON "Shift"("schoolId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Staff_schoolId_nationalId_key" ON "Staff"("schoolId", "nationalId");

-- CreateIndex
CREATE INDEX "TimeEntry_schoolId_date_idx" ON "TimeEntry"("schoolId", "date");

-- CreateIndex
CREATE INDEX "TimeEntry_staffId_date_idx" ON "TimeEntry"("staffId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "FaceEnrollment_staffId_key" ON "FaceEnrollment"("staffId");

-- CreateIndex
CREATE UNIQUE INDEX "FaceEnrollment_guardianId_key" ON "FaceEnrollment"("guardianId");

-- CreateIndex
CREATE INDEX "FaceEnrollment_schoolId_idx" ON "FaceEnrollment"("schoolId");

-- CreateIndex
CREATE INDEX "Arrival_schoolId_occurredAt_idx" ON "Arrival"("schoolId", "occurredAt");

-- CreateIndex
CREATE INDEX "Arrival_studentId_occurredAt_idx" ON "Arrival"("studentId", "occurredAt");

-- CreateIndex
CREATE UNIQUE INDEX "Pickup_code_key" ON "Pickup"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Pickup_pickupCodeId_key" ON "Pickup"("pickupCodeId");

-- CreateIndex
CREATE INDEX "Pickup_schoolId_occurredAt_idx" ON "Pickup"("schoolId", "occurredAt");

-- CreateIndex
CREATE INDEX "Pickup_studentId_occurredAt_idx" ON "Pickup"("studentId", "occurredAt");

-- CreateIndex
CREATE UNIQUE INDEX "PickupPhoto_pickupId_sequence_key" ON "PickupPhoto"("pickupId", "sequence");

-- CreateIndex
CREATE INDEX "Notification_schoolId_sentAt_idx" ON "Notification"("schoolId", "sentAt");

-- CreateIndex
CREATE INDEX "Notification_studentId_sentAt_idx" ON "Notification"("studentId", "sentAt");

-- CreateIndex
CREATE INDEX "Notification_pickupId_idx" ON "Notification"("pickupId");

-- CreateIndex
CREATE INDEX "Alert_schoolId_resolvedAt_idx" ON "Alert"("schoolId", "resolvedAt");

-- CreateIndex
CREATE UNIQUE INDEX "PickupCode_fingerprint_key" ON "PickupCode"("fingerprint");

-- CreateIndex
CREATE INDEX "PickupCode_studentId_createdAt_idx" ON "PickupCode"("studentId", "createdAt");

-- CreateIndex
CREATE INDEX "ReportDownload_schoolId_createdAt_idx" ON "ReportDownload"("schoolId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_schoolId_occurredAt_idx" ON "AuditLog"("schoolId", "occurredAt");

-- CreateIndex
CREATE INDEX "AuditLog_action_occurredAt_idx" ON "AuditLog"("action", "occurredAt");

-- AddForeignKey
ALTER TABLE "LevelSchedule" ADD CONSTRAINT "LevelSchedule_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SchoolSettings" ADD CONSTRAINT "SchoolSettings_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Station" ADD CONSTRAINT "Station_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invitation" ADD CONSTRAINT "Invitation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Student" ADD CONSTRAINT "Student_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Guardian" ADD CONSTRAINT "Guardian_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Authorization" ADD CONSTRAINT "Authorization_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Authorization" ADD CONSTRAINT "Authorization_guardianId_fkey" FOREIGN KEY ("guardianId") REFERENCES "Guardian"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Shift" ADD CONSTRAINT "Shift_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Staff" ADD CONSTRAINT "Staff_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Staff" ADD CONSTRAINT "Staff_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "Shift"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimeEntry" ADD CONSTRAINT "TimeEntry_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimeEntry" ADD CONSTRAINT "TimeEntry_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimeEntry" ADD CONSTRAINT "TimeEntry_stationId_fkey" FOREIGN KEY ("stationId") REFERENCES "Station"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimeEntry" ADD CONSTRAINT "TimeEntry_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FaceEnrollment" ADD CONSTRAINT "FaceEnrollment_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FaceEnrollment" ADD CONSTRAINT "FaceEnrollment_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FaceEnrollment" ADD CONSTRAINT "FaceEnrollment_guardianId_fkey" FOREIGN KEY ("guardianId") REFERENCES "Guardian"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Arrival" ADD CONSTRAINT "Arrival_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Arrival" ADD CONSTRAINT "Arrival_stationId_fkey" FOREIGN KEY ("stationId") REFERENCES "Station"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Arrival" ADD CONSTRAINT "Arrival_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pickup" ADD CONSTRAINT "Pickup_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pickup" ADD CONSTRAINT "Pickup_stationId_fkey" FOREIGN KEY ("stationId") REFERENCES "Station"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pickup" ADD CONSTRAINT "Pickup_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pickup" ADD CONSTRAINT "Pickup_guardianId_fkey" FOREIGN KEY ("guardianId") REFERENCES "Guardian"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pickup" ADD CONSTRAINT "Pickup_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pickup" ADD CONSTRAINT "Pickup_pickupCodeId_fkey" FOREIGN KEY ("pickupCodeId") REFERENCES "PickupCode"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PickupPhoto" ADD CONSTRAINT "PickupPhoto_pickupId_fkey" FOREIGN KEY ("pickupId") REFERENCES "Pickup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_guardianId_fkey" FOREIGN KEY ("guardianId") REFERENCES "Guardian"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_pickupId_fkey" FOREIGN KEY ("pickupId") REFERENCES "Pickup"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Alert" ADD CONSTRAINT "Alert_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Alert" ADD CONSTRAINT "Alert_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Alert" ADD CONSTRAINT "Alert_pickupId_fkey" FOREIGN KEY ("pickupId") REFERENCES "Pickup"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Alert" ADD CONSTRAINT "Alert_resolvedById_fkey" FOREIGN KEY ("resolvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PickupCode" ADD CONSTRAINT "PickupCode_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PickupCode" ADD CONSTRAINT "PickupCode_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PickupCode" ADD CONSTRAINT "PickupCode_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "Guardian"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FaceParameters" ADD CONSTRAINT "FaceParameters_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportDownload" ADD CONSTRAINT "ReportDownload_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportDownload" ADD CONSTRAINT "ReportDownload_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE SET NULL ON UPDATE CASCADE;
