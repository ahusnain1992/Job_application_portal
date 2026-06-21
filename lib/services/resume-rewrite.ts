import Anthropic from "@anthropic-ai/sdk";

type ResumeRewriteInput = {
  clientName: string;
  currentJobTitle: string;
  cvText: string;
  jobTitle: string;
  companyName: string;
  jobDescription: string;
  requiredSkills: string[];
  missingKeywords: string[];
  coveredKeywords: string[];
};

type ResumeRewriteResult = {
  rewrittenResume: string;
  changesSummary: string;
  tokensUsed: number;
};

export async function rewriteResumeForJob(input: ResumeRewriteInput): Promise<ResumeRewriteResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not set");

  const client = new Anthropic({ apiKey });

  const missingList = input.missingKeywords.length
    ? `Missing keywords to incorporate if truthful: ${input.missingKeywords.slice(0, 10).join(", ")}.`
    : "";

  const coveredList = input.coveredKeywords.length
    ? `Already covered keywords to emphasise: ${input.coveredKeywords.slice(0, 10).join(", ")}.`
    : "";

  const prompt = `You are an expert resume writer helping a job seeker tailor their resume for a specific role.

## Target job
- Title: ${input.jobTitle}
- Company: ${input.companyName}
- Required skills: ${input.requiredSkills.slice(0, 15).join(", ")}
${missingList}
${coveredList}

## Job description (excerpt)
${input.jobDescription.slice(0, 2000)}

## Candidate's current resume
${input.cvText.slice(0, 4000)}

## Instructions
Rewrite the resume to better match the target role. Rules:
1. Never invent experience, skills, companies, dates, or qualifications that are not in the original resume.
2. Reorder and rephrase bullet points to lead with the most relevant experience first.
3. Replace weak generic phrases with stronger action verbs and quantified outcomes where the original data supports it.
4. Incorporate missing keywords naturally only where the candidate's actual experience supports them.
5. Keep the same sections (Summary, Experience, Education, Skills etc) — do not remove sections.
6. Output the full rewritten resume as plain text, ready to copy into a Word document.
7. After the resume, add a section titled "CHANGES MADE:" with 3–5 bullet points summarising what you changed and why.

Output format:
[Full rewritten resume in plain text]

CHANGES MADE:
- ...`;

  const message = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 2048,
    messages: [{ role: "user", content: prompt }]
  });

  const fullText = message.content
    .filter((b) => b.type === "text")
    .map((b) => (b as { type: "text"; text: string }).text)
    .join("");

  const changesSplit = fullText.indexOf("CHANGES MADE:");
  const rewrittenResume = changesSplit > -1 ? fullText.slice(0, changesSplit).trim() : fullText.trim();
  const changesSummary = changesSplit > -1 ? fullText.slice(changesSplit + "CHANGES MADE:".length).trim() : "";

  return {
    rewrittenResume,
    changesSummary,
    tokensUsed: message.usage.input_tokens + message.usage.output_tokens
  };
}
