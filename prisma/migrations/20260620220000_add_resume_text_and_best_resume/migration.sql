-- Add resumeText to Resume for keyword matching against master resumes
ALTER TABLE "Resume" ADD COLUMN IF NOT EXISTS "resumeText" TEXT;

-- Add bestResumeId and bestResumeName to Job so we can track which master resume best fits each job
ALTER TABLE "Job" ADD COLUMN IF NOT EXISTS "bestResumeId" TEXT;
ALTER TABLE "Job" ADD COLUMN IF NOT EXISTS "bestResumeName" TEXT;

-- FK from Job.bestResumeId → Resume.id (nullable, set null on delete)
ALTER TABLE "Job" ADD CONSTRAINT "Job_bestResumeId_fkey"
  FOREIGN KEY ("bestResumeId") REFERENCES "Resume"("id") ON DELETE SET NULL ON UPDATE CASCADE;
