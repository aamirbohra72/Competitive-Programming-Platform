ALTER TABLE "InterviewSession" ADD COLUMN "mobileMonitoringRequired" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "proctorStartedAt" TIMESTAMP(3);

CREATE TABLE "InterviewMobileMonitor" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "pairingHash" TEXT NOT NULL,
    "deviceHash" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "connectedAt" TIMESTAMP(3),
    "lastSeenAt" TIMESTAMP(3),
    "nextWarningAt" TIMESTAMP(3),
    "schedule" JSONB NOT NULL DEFAULT '[]',
    "results" JSONB NOT NULL DEFAULT '[]',
    "version" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "InterviewMobileMonitor_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "InterviewMobileMonitor_sessionId_key" ON "InterviewMobileMonitor"("sessionId");
CREATE UNIQUE INDEX "InterviewMobileMonitor_pairingHash_key" ON "InterviewMobileMonitor"("pairingHash");
CREATE UNIQUE INDEX "InterviewMobileMonitor_deviceHash_key" ON "InterviewMobileMonitor"("deviceHash");
ALTER TABLE "InterviewMobileMonitor" ADD CONSTRAINT "InterviewMobileMonitor_sessionId_fkey"
FOREIGN KEY ("sessionId") REFERENCES "InterviewSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;