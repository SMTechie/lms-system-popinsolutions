ALTER TABLE "User" ADD COLUMN "registrationStatus" TEXT NOT NULL DEFAULT 'APPROVED';
ALTER TABLE "User" ADD COLUMN "registrationReviewedAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN "registrationReviewedBy" TEXT;
ALTER TABLE "User" ADD COLUMN "registrationRejectionReason" TEXT;
