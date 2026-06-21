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

  const jobKeywords = [...new Set([...input.requiredSkills, ...input.missingKeywords])].slice(0, 20).join(", ");

  const prompt = `You are an ATS optimization expert and professional resume writer. Your job is to rewrite a resume so it passes Applicant Tracking System (ATS) keyword scans and ranks higher for the target role — WITHOUT inventing anything.

## Target role
Job title: ${input.jobTitle}
Company: ${input.companyName}
ATS keywords that MUST appear in the resume: ${jobKeywords}
Keywords already in the resume (emphasise these): ${input.coveredKeywords.slice(0, 10).join(", ")}

## Job description
${input.jobDescription.slice(0, 1800)}

## Original resume (REPRODUCE EVERY COMPANY AND ROLE — do not omit any)
${input.cvText.slice(0, 6000)}

## STRICT RULES — follow every one or the output is wrong:

### What you MUST do
1. **KEEP every bullet point** — never delete or merge bullets. The final resume must have the same number of bullets or MORE than the original. ATS scores improve with more relevant content, not less.
2. **EXPAND thin bullets** — if a bullet is one line and vague (e.g. "Worked with SQL databases"), expand it to 2–3 lines with context, scope, and impact using details that can be reasonably inferred from the role and company (e.g. "Designed and maintained 12+ PostgreSQL schemas supporting 500K daily transactions, reducing query latency by 30% through index optimisation").
3. **ADD new bullets** where a job role clearly involved tasks mentioned in the job description but the original resume didn't list them. Only add bullets grounded in what that role would realistically involve — based on the candidate's actual domain and seniority.
4. **Inject every missing ATS keyword** listed above at least once, naturally woven into existing or new bullets relevant to the candidate's actual work. Do not stuff keywords — integrate them into real sentences.
5. **Strengthen every bullet** with a strong action verb (Led, Architected, Delivered, Optimised, Automated, Deployed, Reduced, Increased) and a quantified result where plausible.
6. **Update the Skills section** to list ALL keywords from the job description that the candidate has any exposure to, grouped by category (Cloud, Languages, Databases, Tools, etc.).
7. **Rewrite the Summary/Profile** to directly mirror the job title and top 5 required skills.
8. **Keep every single company and role** — if the original resume has 5 jobs at 5 companies, the output MUST have all 5 jobs at all 5 companies. Count them before and after. If the count differs, you have made an error. Never drop a company because of space or relevance.

### Job title adjustment rule (IMPORTANT)
For each position in the Experience section, you MAY adjust the candidate's job title to a closer synonym of the target role — but ONLY when the two roles are in the same professional discipline:
- ✅ "Software Developer" → "Software Engineer" (same discipline, common synonym)
- ✅ "Sr. Data Engineer" → "Senior Data Engineer" (formatting only)
- ✅ "Data Analyst" → "Data Engineer" (close enough if their work involved engineering)
- ❌ "Data Engineer" → "Software Engineer" (different discipline — do NOT change)
- ❌ "QA Engineer" → "Backend Engineer" (different discipline — do NOT change)

If the candidate's discipline does NOT match the target role's discipline, keep the original title exactly. Do not cross-discipline boundaries — a data engineer's bullets must stay as data engineering work even if applying for a software engineer role.

### What you must NEVER do
- Never invent companies, job titles, dates, degrees, or certifications not in the original.
- Never change a title across disciplines (data → software, QA → dev, etc.).
- Never add responsibilities from a different discipline just because the job description asks for them.
- Never reduce bullet count. If original has 4 bullets, output must have 4 or more.
- Never use tables, columns, or special characters (ATS cannot parse them).
- Never write "Responsible for" — always use action verbs.

### ATS formatting rules
- Plain text, no symbols except hyphens and pipes
- Section headers in ALL CAPS (EXPERIENCE, EDUCATION, SKILLS, SUMMARY)
- Dates as: Jan 2021 – Mar 2024
- Each bullet starts with "• " then a strong action verb

Output the full rewritten resume as plain text.
Then add a section "CHANGES MADE:" with 5–8 bullet points explaining what you expanded, added, or changed and why it improves ATS ranking.

CHANGES MADE:
- ...`;

  const message = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 4096,
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
