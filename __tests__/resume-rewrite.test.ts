import { describe, it, expect, vi, beforeEach } from "vitest";

// Must be top-level so vitest hoisting works correctly
const mockCreate = vi.fn();

vi.mock("@anthropic-ai/sdk", () => {
  function MockAnthropic() {
    return { messages: { create: mockCreate } };
  }
  return { default: MockAnthropic };
});

process.env.ANTHROPIC_API_KEY = "test-key";

const MOCK_RESUME_OUTPUT = `John Smith — Senior Data Engineer

SUMMARY
Senior Data Engineer with 6 years of experience in Python, SQL, BigQuery, and GCP.

EXPERIENCE

Senior Data Engineer | Acme Corp | Jan 2021 – Present
• Architected BigQuery data warehouse processing 2TB daily across 15 business units
• Built Apache Airflow DAGs orchestrating 50+ ETL pipelines on GCP Cloud Composer
• Implemented dbt models reducing analytics query time by 40%

SKILLS
Cloud: GCP, BigQuery, Cloud Composer
Languages: Python, SQL
Tools: Airflow, dbt, Docker

CHANGES MADE:
- Expanded "worked with SQL" bullet to include scope and impact
- Added GCP keyword to Summary for ATS matching
- Grouped Skills by category for ATS parsing`;

const DEFAULT_INPUT = {
  clientName: "John Smith",
  currentJobTitle: "Data Engineer",
  cvText: "John Smith\nPython developer\nWorked with SQL databases",
  jobTitle: "Senior Data Engineer",
  companyName: "Acme Corp",
  jobDescription: "We need a Senior Data Engineer with Python, SQL, BigQuery, GCP, Airflow, dbt.",
  requiredSkills: ["Python", "SQL", "BigQuery", "GCP", "Airflow", "dbt"],
  missingKeywords: ["BigQuery", "Airflow", "dbt"],
  coveredKeywords: ["Python", "SQL"]
};

describe("rewriteResumeForJob", () => {
  beforeEach(() => {
    mockCreate.mockResolvedValue({
      content: [{ type: "text", text: MOCK_RESUME_OUTPUT }],
      usage: { input_tokens: 1200, output_tokens: 350 }
    });
  });

  it("returns rewrittenResume and changesSummary", async () => {
    const { rewriteResumeForJob } = await import("../lib/services/resume-rewrite");
    const result = await rewriteResumeForJob(DEFAULT_INPUT);

    expect(result.rewrittenResume).toBeTruthy();
    expect(result.rewrittenResume.length).toBeGreaterThan(100);
    expect(result.changesSummary).toBeTruthy();
    expect(result.tokensUsed).toBe(1550);
  });

  it("splits output at CHANGES MADE: marker correctly", async () => {
    const { rewriteResumeForJob } = await import("../lib/services/resume-rewrite");
    const result = await rewriteResumeForJob(DEFAULT_INPUT);

    expect(result.rewrittenResume).not.toContain("CHANGES MADE:");
    expect(result.changesSummary).not.toContain("John Smith — Senior Data Engineer");
    expect(result.changesSummary).toContain("ATS");
  });

  it("throws when ANTHROPIC_API_KEY is missing", async () => {
    const originalKey = process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;

    const { rewriteResumeForJob } = await import("../lib/services/resume-rewrite");
    await expect(rewriteResumeForJob(DEFAULT_INPUT)).rejects.toThrow("ANTHROPIC_API_KEY");

    process.env.ANTHROPIC_API_KEY = originalKey;
  });

  it("uses claude-haiku model for cost efficiency", async () => {
    const { rewriteResumeForJob } = await import("../lib/services/resume-rewrite");
    await rewriteResumeForJob(DEFAULT_INPUT);

    const callArgs = mockCreate.mock.calls[0][0];
    expect(callArgs.model).toContain("haiku");
    expect(callArgs.max_tokens).toBeGreaterThanOrEqual(4096);
  });

  it("prompt includes ATS optimisation instructions", async () => {
    const { rewriteResumeForJob } = await import("../lib/services/resume-rewrite");
    await rewriteResumeForJob(DEFAULT_INPUT);

    const prompt: string = mockCreate.mock.calls[0][0].messages[0].content;
    expect(prompt).toMatch(/never delete|never reduce|bullet count/i);
    expect(prompt).toMatch(/ATS/i);
    expect(prompt).toMatch(/action verb/i);
    expect(prompt).toMatch(/discipline/i);
  });

  it("includes missing keywords in the prompt", async () => {
    const { rewriteResumeForJob } = await import("../lib/services/resume-rewrite");
    await rewriteResumeForJob(DEFAULT_INPUT);

    const prompt: string = mockCreate.mock.calls[0][0].messages[0].content;
    expect(prompt).toContain("BigQuery");
    expect(prompt).toContain("Airflow");
  });

  it("handles output with no CHANGES MADE section gracefully", async () => {
    mockCreate.mockResolvedValueOnce({
      content: [{ type: "text", text: "Just the resume text, no changes section." }],
      usage: { input_tokens: 100, output_tokens: 20 }
    });
    const { rewriteResumeForJob } = await import("../lib/services/resume-rewrite");
    const result = await rewriteResumeForJob(DEFAULT_INPUT);

    expect(result.rewrittenResume).toBe("Just the resume text, no changes section.");
    expect(result.changesSummary).toBe("");
  });
});
