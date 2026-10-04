-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "postgis";

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('DOSJE_SUPER_ADMIN', 'DOSJE_ADMIN', 'PMU_OFFICER', 'NGO_MANAGER', 'NGO_DATA_SUBMITTER', 'BENEFICIARY');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'SUSPENDED', 'PENDING_VERIFICATION');

-- CreateEnum
CREATE TYPE "ProjectStatus" AS ENUM ('PLANNED', 'IN_PROGRESS', 'UNDER_INSPECTION', 'COMPLETED', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "InspectionStatus" AS ENUM ('SCHEDULED', 'IN_PROGRESS', 'REPORT_SUBMITTED', 'REPORT_UNDER_REVIEW', 'APPROVED', 'REJECTED', 'FLAGGED');

-- CreateEnum
CREATE TYPE "ReportMediaType" AS ENUM ('PHOTO', 'VIDEO', 'AUDIO', 'DOCUMENT');

-- CreateEnum
CREATE TYPE "AnomalyType" AS ENUM ('UNEXPECTED_ABSENCE', 'FACILITY_DEVIATION', 'BENEFICIARY_COUNT_MISMATCH', 'MEDIA_TAMPER_DETECTED', 'GEO_FENCE_VIOLATION', 'CCTV_FEED_INTERRUPTED', 'FINANCIAL_IRREGULARITY', 'OTHER');

-- CreateEnum
CREATE TYPE "AnomalySeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "AnomalyStatus" AS ENUM ('DETECTED', 'INVESTIGATING', 'RESOLVED', 'FALSE_POSITIVE', 'ESCALATED');

-- CreateEnum
CREATE TYPE "CCTVStatus" AS ENUM ('ONLINE', 'OFFLINE', 'DEGRADED', 'MAINTENANCE');

-- CreateEnum
CREATE TYPE "StreamingProtocol" AS ENUM ('RTSP', 'HLS', 'WEBRTC', 'ONVIF');

-- CreateEnum
CREATE TYPE "VCSessionStatus" AS ENUM ('SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'MISSED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('INSPECTION_ASSIGNED', 'INSPECTION_DUE', 'REPORT_FLAGGED', 'ANOMALY_DETECTED', 'VC_SCHEDULED', 'SYSTEM_ANNOUNCEMENT');

-- CreateEnum
CREATE TYPE "DataClassification" AS ENUM ('PUBLIC', 'INTERNAL', 'CONFIDENTIAL', 'RESTRICTED');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "phone" VARCHAR(15),
    "passwordHash" VARCHAR(255) NOT NULL,
    "firstName" VARCHAR(100) NOT NULL,
    "lastName" VARCHAR(100) NOT NULL,
    "role" "Role" NOT NULL,
    "status" "UserStatus" NOT NULL DEFAULT 'PENDING_VERIFICATION',
    "avatarUrl" VARCHAR(512),
    "departmentCode" VARCHAR(50),
    "employeeId" VARCHAR(50),
    "jurisdictionState" VARCHAR(100),
    "jurisdictionDist" VARCHAR(100),
    "lastLoginAt" TIMESTAMPTZ,
    "lastLoginIp" VARCHAR(45),
    "failedLoginCount" INTEGER NOT NULL DEFAULT 0,
    "lockoutUntil" TIMESTAMPTZ,
    "totpSecret" VARCHAR(255),
    "totpEnabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "deletedAt" TIMESTAMPTZ,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "tokenHash" VARCHAR(255) NOT NULL,
    "userAgent" VARCHAR(512),
    "ipAddress" VARCHAR(45),
    "expiresAt" TIMESTAMPTZ NOT NULL,
    "rotatedAt" TIMESTAMPTZ,
    "revokedAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "institute_ngos" (
    "id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "registrationNo" VARCHAR(50) NOT NULL,
    "type" VARCHAR(50) NOT NULL,
    "contactEmail" VARCHAR(255) NOT NULL,
    "contactPhone" VARCHAR(15) NOT NULL,
    "addressLine1" VARCHAR(500) NOT NULL,
    "addressLine2" VARCHAR(500),
    "state" VARCHAR(100) NOT NULL,
    "district" VARCHAR(100) NOT NULL,
    "pinCode" VARCHAR(10) NOT NULL,
    "location" geometry(Point,4326) NOT NULL,
    "gstNumber" VARCHAR(20),
    "panNumber" VARCHAR(10),
    "annualBudget" DECIMAL(15,2),
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "accreditationDoc" VARCHAR(512),
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "deletedAt" TIMESTAMPTZ,
    "managerId" UUID,
    "staffId" UUID,

    CONSTRAINT "institute_ngos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "projects" (
    "id" UUID NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "schemeCode" VARCHAR(50) NOT NULL,
    "instituteNgoId" UUID NOT NULL,
    "status" "ProjectStatus" NOT NULL DEFAULT 'PLANNED',
    "sanctionedAmount" DECIMAL(15,2),
    "utilizationAmount" DECIMAL(15,2),
    "sanctionedDate" TIMESTAMPTZ,
    "startDate" TIMESTAMPTZ,
    "expectedEndDate" TIMESTAMPTZ,
    "actualEndDate" TIMESTAMPTZ,
    "location" geometry(Point,4326) NOT NULL,
    "radiusMeters" INTEGER NOT NULL DEFAULT 500,
    "beneficiaryCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "deletedAt" TIMESTAMPTZ,

    CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cctv_feeds" (
    "id" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "instituteNgoId" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "rtspUrl" VARCHAR(1024) NOT NULL,
    "streamProtocol" "StreamingProtocol" NOT NULL DEFAULT 'RTSP',
    "status" "CCTVStatus" NOT NULL DEFAULT 'OFFLINE',
    "lastHealthCheckAt" TIMESTAMPTZ,
    "healthCheckIntervalSec" INTEGER NOT NULL DEFAULT 30,
    "fps" INTEGER NOT NULL DEFAULT 25,
    "resolution" VARCHAR(20) NOT NULL,
    "storageRetentionDays" INTEGER NOT NULL DEFAULT 30,
    "webRtcEndpoint" VARCHAR(512),
    "installDate" TIMESTAMPTZ,
    "lastMaintenanceAt" TIMESTAMPTZ,
    "ipAddress" VARCHAR(45),
    "macAddress" VARCHAR(17),
    "firmwareVersion" VARCHAR(50),
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "cctv_feeds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inspections" (
    "id" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "assignedOfficerId" UUID NOT NULL,
    "status" "InspectionStatus" NOT NULL DEFAULT 'SCHEDULED',
    "scheduledDate" TIMESTAMPTZ NOT NULL,
    "scheduledTimeSlot" VARCHAR(50),
    "startedAt" TIMESTAMPTZ,
    "completedAt" TIMESTAMPTZ,
    "isRandomAssignment" BOOLEAN NOT NULL DEFAULT true,
    "assignmentBatchId" UUID,
    "notes" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "inspections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inspection_reports" (
    "id" UUID NOT NULL,
    "inspectionId" UUID NOT NULL,
    "submittedById" UUID NOT NULL,
    "submitLocation" geometry(Point,4326) NOT NULL,
    "geoFenceValid" BOOLEAN NOT NULL,
    "locationAccuracyM" DECIMAL(10,2),
    "narrativeNotes" TEXT,
    "inspectionSummary" TEXT,
    "conformsToScheme" BOOLEAN,
    "deviceModel" VARCHAR(200),
    "deviceOs" VARCHAR(100),
    "appVersion" VARCHAR(20),
    "submittedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "serverReceivedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "inspection_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "report_media" (
    "id" UUID NOT NULL,
    "reportId" UUID NOT NULL,
    "mediaType" "ReportMediaType" NOT NULL,
    "s3Key" VARCHAR(1024) NOT NULL,
    "originalFileName" VARCHAR(255) NOT NULL,
    "fileSizeBytes" BIGINT NOT NULL,
    "mimeType" VARCHAR(100) NOT NULL,
    "mediaLocation" geometry(Point,4326) NOT NULL,
    "capturedAt" TIMESTAMPTZ NOT NULL,
    "exifData" JSONB,
    "contentHash" VARCHAR(64) NOT NULL,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "verificationNote" VARCHAR(500),
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "report_media_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exif_validations" (
    "id" UUID NOT NULL,
    "mediaId" UUID NOT NULL,
    "timestampDeltaMs" INTEGER NOT NULL,
    "timestampValid" BOOLEAN NOT NULL,
    "gpsDeltaMeters" DECIMAL(10,2) NOT NULL,
    "gpsValid" BOOLEAN NOT NULL,
    "deviceConsistent" BOOLEAN NOT NULL,
    "allChecksPassed" BOOLEAN NOT NULL,
    "rawExifSnapshot" JSONB NOT NULL,
    "validatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "inspectionReportId" UUID,

    CONSTRAINT "exif_validations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vc_sessions" (
    "id" UUID NOT NULL,
    "inspectionId" UUID,
    "roomId" VARCHAR(100) NOT NULL,
    "roomToken" VARCHAR(512) NOT NULL,
    "status" "VCSessionStatus" NOT NULL DEFAULT 'SCHEDULED',
    "scheduledAt" TIMESTAMPTZ NOT NULL,
    "startedAt" TIMESTAMPTZ,
    "endedAt" TIMESTAMPTZ,
    "durationSeconds" INTEGER,
    "janusSessionId" BIGINT,
    "janusHandleId" BIGINT,
    "recordingPath" VARCHAR(512),
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "vc_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vc_participants" (
    "id" UUID NOT NULL,
    "sessionId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "participantToken" VARCHAR(512) NOT NULL,
    "joinedAt" TIMESTAMPTZ,
    "leftAt" TIMESTAMPTZ,
    "connectionQuality" VARCHAR(20),
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vc_participants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "anomaly_alerts" (
    "id" UUID NOT NULL,
    "anomalyType" "AnomalyType" NOT NULL,
    "severity" "AnomalySeverity" NOT NULL DEFAULT 'MEDIUM',
    "status" "AnomalyStatus" NOT NULL DEFAULT 'DETECTED',
    "title" VARCHAR(255) NOT NULL,
    "description" TEXT NOT NULL,
    "source" VARCHAR(100) NOT NULL,
    "projectId" UUID,
    "instituteNgoId" UUID,
    "inspectionId" UUID,
    "cctvFeedId" UUID,
    "reportMediaId" UUID,
    "confidenceScore" DECIMAL(5,4),
    "evidenceJson" JSONB,
    "detectedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMPTZ,
    "resolutionNote" TEXT,
    "createdById" UUID,
    "assignedToId" UUID,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "anomaly_alerts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL,
    "userId" UUID,
    "action" VARCHAR(100) NOT NULL,
    "entity" VARCHAR(100) NOT NULL,
    "entityId" UUID,
    "beforeJson" JSONB,
    "afterJson" JSONB,
    "ipAddress" VARCHAR(45),
    "userAgent" VARCHAR(512),
    "classification" "DataClassification" NOT NULL DEFAULT 'INTERNAL',
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "type" "NotificationType" NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "body" TEXT NOT NULL,
    "dataJson" JSONB,
    "readAt" TIMESTAMPTZ,
    "sentVia" TEXT[],
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "system_config" (
    "key" VARCHAR(100) NOT NULL,
    "value" JSONB NOT NULL,
    "description" TEXT,
    "updatedBy" UUID,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "system_config_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_phone_key" ON "users"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "users_employeeId_key" ON "users"("employeeId");

-- CreateIndex
CREATE INDEX "users_role_status_idx" ON "users"("role", "status");

-- CreateIndex
CREATE INDEX "users_jurisdictionState_jurisdictionDist_idx" ON "users"("jurisdictionState", "jurisdictionDist");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_tokenHash_key" ON "refresh_tokens"("tokenHash");

-- CreateIndex
CREATE INDEX "refresh_tokens_userId_idx" ON "refresh_tokens"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "institute_ngos_registrationNo_key" ON "institute_ngos"("registrationNo");

-- CreateIndex
CREATE UNIQUE INDEX "institute_ngos_managerId_key" ON "institute_ngos"("managerId");

-- CreateIndex
CREATE UNIQUE INDEX "institute_ngos_staffId_key" ON "institute_ngos"("staffId");

-- CreateIndex
CREATE INDEX "institute_ngos_state_district_idx" ON "institute_ngos"("state", "district");

-- CreateIndex
CREATE INDEX "projects_instituteNgoId_idx" ON "projects"("instituteNgoId");

-- CreateIndex
CREATE INDEX "projects_status_idx" ON "projects"("status");

-- CreateIndex
CREATE INDEX "cctv_feeds_projectId_idx" ON "cctv_feeds"("projectId");

-- CreateIndex
CREATE INDEX "cctv_feeds_status_idx" ON "cctv_feeds"("status");

-- CreateIndex
CREATE INDEX "inspections_assignedOfficerId_status_idx" ON "inspections"("assignedOfficerId", "status");

-- CreateIndex
CREATE INDEX "inspections_projectId_status_idx" ON "inspections"("projectId", "status");

-- CreateIndex
CREATE INDEX "inspections_scheduledDate_idx" ON "inspections"("scheduledDate");

-- CreateIndex
CREATE INDEX "inspection_reports_inspectionId_idx" ON "inspection_reports"("inspectionId");

-- CreateIndex
CREATE INDEX "inspection_reports_submittedAt_idx" ON "inspection_reports"("submittedAt");

-- CreateIndex
CREATE INDEX "report_media_reportId_idx" ON "report_media"("reportId");

-- CreateIndex
CREATE UNIQUE INDEX "exif_validations_mediaId_key" ON "exif_validations"("mediaId");

-- CreateIndex
CREATE UNIQUE INDEX "vc_sessions_roomId_key" ON "vc_sessions"("roomId");

-- CreateIndex
CREATE INDEX "vc_sessions_inspectionId_idx" ON "vc_sessions"("inspectionId");

-- CreateIndex
CREATE INDEX "vc_sessions_scheduledAt_idx" ON "vc_sessions"("scheduledAt");

-- CreateIndex
CREATE UNIQUE INDEX "vc_participants_sessionId_userId_key" ON "vc_participants"("sessionId", "userId");

-- CreateIndex
CREATE INDEX "anomaly_alerts_anomalyType_severity_idx" ON "anomaly_alerts"("anomalyType", "severity");

-- CreateIndex
CREATE INDEX "anomaly_alerts_status_idx" ON "anomaly_alerts"("status");

-- CreateIndex
CREATE INDEX "anomaly_alerts_projectId_idx" ON "anomaly_alerts"("projectId");

-- CreateIndex
CREATE INDEX "audit_logs_userId_idx" ON "audit_logs"("userId");

-- CreateIndex
CREATE INDEX "audit_logs_entity_entityId_idx" ON "audit_logs"("entity", "entityId");

-- CreateIndex
CREATE INDEX "audit_logs_action_idx" ON "audit_logs"("action");

-- CreateIndex
CREATE INDEX "audit_logs_createdAt_idx" ON "audit_logs"("createdAt");

-- CreateIndex
CREATE INDEX "notifications_userId_readAt_idx" ON "notifications"("userId", "readAt");

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "institute_ngos" ADD CONSTRAINT "institute_ngos_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "institute_ngos" ADD CONSTRAINT "institute_ngos_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_instituteNgoId_fkey" FOREIGN KEY ("instituteNgoId") REFERENCES "institute_ngos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cctv_feeds" ADD CONSTRAINT "cctv_feeds_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cctv_feeds" ADD CONSTRAINT "cctv_feeds_instituteNgoId_fkey" FOREIGN KEY ("instituteNgoId") REFERENCES "institute_ngos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inspections" ADD CONSTRAINT "inspections_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inspections" ADD CONSTRAINT "inspections_assignedOfficerId_fkey" FOREIGN KEY ("assignedOfficerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inspection_reports" ADD CONSTRAINT "inspection_reports_inspectionId_fkey" FOREIGN KEY ("inspectionId") REFERENCES "inspections"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inspection_reports" ADD CONSTRAINT "inspection_reports_submittedById_fkey" FOREIGN KEY ("submittedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report_media" ADD CONSTRAINT "report_media_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "inspection_reports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exif_validations" ADD CONSTRAINT "exif_validations_mediaId_fkey" FOREIGN KEY ("mediaId") REFERENCES "report_media"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exif_validations" ADD CONSTRAINT "exif_validations_inspectionReportId_fkey" FOREIGN KEY ("inspectionReportId") REFERENCES "inspection_reports"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vc_sessions" ADD CONSTRAINT "vc_sessions_inspectionId_fkey" FOREIGN KEY ("inspectionId") REFERENCES "inspections"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vc_participants" ADD CONSTRAINT "vc_participants_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "vc_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vc_participants" ADD CONSTRAINT "vc_participants_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "anomaly_alerts" ADD CONSTRAINT "anomaly_alerts_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "anomaly_alerts" ADD CONSTRAINT "anomaly_alerts_instituteNgoId_fkey" FOREIGN KEY ("instituteNgoId") REFERENCES "institute_ngos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "anomaly_alerts" ADD CONSTRAINT "anomaly_alerts_cctvFeedId_fkey" FOREIGN KEY ("cctvFeedId") REFERENCES "cctv_feeds"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "anomaly_alerts" ADD CONSTRAINT "anomaly_alerts_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "anomaly_alerts" ADD CONSTRAINT "anomaly_alerts_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
