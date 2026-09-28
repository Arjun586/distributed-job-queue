-- AlterEnum
ALTER TYPE "JobStatus" ADD VALUE 'DEAD_LETTER';

-- AlterTable
ALTER TABLE "Job" ALTER COLUMN "maxAttempts" SET DEFAULT 5;
