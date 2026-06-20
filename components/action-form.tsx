"use client";

import { useState } from "react";
import { Select, SubmitButton, TextArea, TextInput } from "@/components/ui";

type ResumeOption = { id: string; name: string };

type ActionFormProps = {
  jobId: string;
  clientId: string;
  currentStatus: string;
  resumes: ResumeOption[];
  defaultResumeId?: string | null;
  defaultNotes?: string | null;
  defaultConfirmation?: string | null;
  defaultProof?: string | null;
  defaultReasonSkipped?: string | null;
  defaultCoverLetter?: string | null;
  hasProof: boolean;
};

const SKIP_REASONS = [
  "Already applied through another source",
  "Job requirements don't match client profile",
  "Salary below client minimum",
  "Location is not suitable",
  "Contract/freelance — client wants full-time",
  "Application portal broken or unavailable",
  "Company is on client's avoid list",
  "Duplicate posting",
  "Job too senior or too junior",
  "Other — see notes"
];

const COULD_NOT_APPLY_REASONS = [
  "Application page not working",
  "Requires account creation — couldn't complete",
  "Job was taken down / expired",
  "Requires referral or internal only",
  "Portal requires specific file format not available",
  "Could not get past screening questions",
  "Other — see notes"
];

export function ActionForm({
  jobId,
  clientId,
  currentStatus,
  resumes,
  defaultResumeId,
  defaultNotes,
  defaultConfirmation,
  defaultProof,
  defaultReasonSkipped,
  defaultCoverLetter,
  hasProof
}: ActionFormProps) {
  const initialAction = currentStatus === "APPLIED" ? "applied"
    : currentStatus === "SKIPPED" || currentStatus === "NOT_RELEVANT" ? "skip"
    : currentStatus === "ERROR_COULD_NOT_APPLY" ? "problem"
    : currentStatus === "FOLLOW_UP_NEEDED" ? "help"
    : "applied";

  const [action, setAction] = useState<"applied" | "skip" | "problem" | "help">(initialAction);

  const statusValue = action === "applied" ? "APPLIED"
    : action === "skip" ? "SKIPPED"
    : action === "problem" ? "ERROR_COULD_NOT_APPLY"
    : "FOLLOW_UP_NEEDED";

  return (
    <div className="space-y-4">
      {/* Action selector tabs */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <ActionTab
          label="✅ Applied"
          active={action === "applied"}
          onClick={() => setAction("applied")}
          activeClass="border-brand/60 bg-[#ECF7F4] text-[#186A5E]"
        />
        <ActionTab
          label="⏭ Skip"
          active={action === "skip"}
          onClick={() => setAction("skip")}
          activeClass="border-warn/60 bg-[#FFF6EB] text-[#8A4604]"
        />
        <ActionTab
          label="❌ Problem"
          active={action === "problem"}
          onClick={() => setAction("problem")}
          activeClass="border-red-200 bg-red-50 text-red-700"
        />
        <ActionTab
          label="🆘 Needs Help"
          active={action === "help"}
          onClick={() => setAction("help")}
          activeClass="border-signal/40 bg-[#EEF5FF] text-blue-700"
        />
      </div>

      <form action="/api/applications" method="post" className="space-y-3">
        <input type="hidden" name="jobId" value={jobId} />
        <input type="hidden" name="clientId" value={clientId} />
        <input type="hidden" name="status" value={statusValue} />

        {/* Applied fields */}
        {action === "applied" && (
          <>
            <div className="rounded-md border border-brand/20 bg-[#ECF7F4] px-3 py-2 text-sm text-[#186A5E]">
              <strong>Great work!</strong> Fill in the confirmation number or screenshot link to prove the application was submitted.
            </div>

            {resumes.length > 0 && (
              <label className="block text-sm font-medium text-ink">
                Which resume did you use?
                <Select name="resumeId" defaultValue={defaultResumeId || ""} className="mt-1">
                  <option value="">Not recorded</option>
                  {resumes.map((r) => (
                    <option key={r.id} value={r.id}>{r.name}</option>
                  ))}
                </Select>
              </label>
            )}

            <label className="block text-sm font-medium text-ink">
              Confirmation number{" "}
              <span className="font-normal text-muted">(from the ATS confirmation page or email)</span>
              <TextInput
                name="confirmationNumber"
                placeholder="e.g. APP-29401"
                defaultValue={defaultConfirmation || ""}
                className="mt-1"
              />
            </label>

            <label className="block text-sm font-medium text-ink">
              Screenshot link{" "}
              <span className="font-normal text-muted">(Google Drive, Imgur, etc.)</span>
              <TextInput
                name="proofUrl"
                type="url"
                placeholder="https://drive.google.com/..."
                defaultValue={defaultProof || ""}
                className="mt-1"
              />
            </label>

            {!hasProof && (
              <p className="text-xs text-warn font-medium">
                ⚠ Please provide at least one proof item — confirmation number or screenshot.
              </p>
            )}

            <label className="block text-sm font-medium text-ink">
              Cover letter used{" "}
              <span className="font-normal text-muted">(paste the generated letter if you used one)</span>
              <TextArea
                name="coverLetterUsed"
                placeholder="Paste the cover letter you submitted, or leave blank if none was required."
                defaultValue={defaultCoverLetter || ""}
                className="mt-1 min-h-40"
              />
            </label>
          </>
        )}

        {/* Skip fields */}
        {action === "skip" && (
          <>
            <div className="rounded-md border border-warn/30 bg-[#FFF6EB] px-3 py-2 text-sm text-[#8A4604]">
              Select the reason this job is being skipped.
            </div>
            <label className="block text-sm font-medium text-ink">
              Reason for skipping
              <Select name="reasonSkipped" defaultValue={defaultReasonSkipped || ""} required className="mt-1">
                <option value="">Select a reason…</option>
                {SKIP_REASONS.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </Select>
            </label>
          </>
        )}

        {/* Could not apply fields */}
        {action === "problem" && (
          <>
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              What went wrong? Select the reason and add notes so the admin can follow up.
            </div>
            <label className="block text-sm font-medium text-ink">
              What happened?
              <Select name="reasonSkipped" defaultValue={defaultReasonSkipped || ""} required className="mt-1">
                <option value="">Select a reason…</option>
                {COULD_NOT_APPLY_REASONS.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </Select>
            </label>
          </>
        )}

        {/* Needs help */}
        {action === "help" && (
          <div className="rounded-md border border-signal/30 bg-[#EEF5FF] px-3 py-2 text-sm text-blue-700">
            Flag this job for admin review. Add notes below to explain what help is needed.
          </div>
        )}

        {/* Notes — always shown */}
        <label className="block text-sm font-medium text-ink">
          Notes{" "}
          <span className="font-normal text-muted">
            {action === "applied" ? "(cover letter tweaks, any issues)" : "(required — explain what happened)"}
          </span>
          <TextArea
            name="notes"
            placeholder={
              action === "applied" ? "Any notes about the application…"
              : action === "skip" ? "Additional detail about why this is being skipped…"
              : action === "problem" ? "Describe what went wrong so admin can follow up…"
              : "What help do you need? What's blocking you?"
            }
            defaultValue={defaultNotes || ""}
            className="mt-1"
            required={action !== "applied"}
          />
        </label>

        <SubmitButton>
          {action === "applied" ? "Save — Mark as Applied"
            : action === "skip" ? "Skip this job"
            : action === "problem" ? "Report problem"
            : "Flag for admin help"}
        </SubmitButton>
      </form>
    </div>
  );
}

function ActionTab({
  label,
  active,
  onClick,
  activeClass
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  activeClass: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-md border px-2 py-2 text-xs font-medium transition-colors ${
        active ? activeClass : "border-line bg-white text-muted hover:bg-canvas"
      }`}
    >
      {label}
    </button>
  );
}
