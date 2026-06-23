/**
 * ATS pass likelihood — how much work is needed to make the resume pass
 * the company's ATS (Applicant Tracking System) for this specific job.
 *
 * We ALWAYS rewrite the resume before applying. The question is:
 *   LEVERAGE  — existing resume is a strong ATS match; add missing keywords,
 *               adjust phrasing. Same base document.
 *   REWRITE   — significant keyword gaps; ATS will likely reject as-is.
 *               Restructure and reframe existing experience around the JD.
 *   NEW_VERSION — domain/role shift or very low overlap; start a new
 *                 targeted version from scratch.
 */
export type ResumeRecommendation = "LEVERAGE" | "REWRITE" | "NEW_VERSION";

export type ResumeAnalysis = {
  recommendation: ResumeRecommendation;
  coverageScore: number;          // 0–100: % of job keywords found in resume (ATS match score)
  missingKeywords: string[];      // keywords in JD but NOT in resume — add these to pass ATS
  coveredKeywords: string[];      // keywords found in both — ATS will pick these up
  recommendationLabel: string;    // human-readable label
  recommendationReason: string;   // plain-English explanation
  clusterId?: string;             // for grouping similar jobs (same resume version can cover)
};

// Technical skills, tools, and common job requirement terms to extract
const SKILL_PATTERNS: RegExp[] = [
  // Languages
  /\b(python|java|javascript|typescript|golang|go|scala|r\b|c\+\+|c#|ruby|swift|kotlin|rust|php|matlab)\b/gi,
  // Data & ML
  /\b(sql|nosql|postgresql|mysql|sqlite|oracle|mongodb|cassandra|redis|elasticsearch)\b/gi,
  /\b(spark|hadoop|kafka|airflow|dbt|luigi|prefect|dagster|flink|beam)\b/gi,
  /\b(bigquery|redshift|snowflake|databricks|azure synapse|synapse|teradata|hive)\b/gi,
  /\b(tensorflow|pytorch|scikit.learn|keras|xgboost|lightgbm|pandas|numpy|matplotlib)\b/gi,
  // Cloud
  /\b(aws|azure|gcp|google cloud|amazon web services|ec2|s3|lambda|rds|emr|glue|sagemaker)\b/gi,
  /\b(azure data factory|adf|azure databricks|blob storage|cosmos db)\b/gi,
  /\b(cloud run|cloud functions|dataflow|pubsub|composer|vertex ai)\b/gi,
  // DevOps & infra
  /\b(docker|kubernetes|k8s|terraform|ansible|jenkins|github actions|ci\/cd|helm)\b/gi,
  /\b(git|linux|bash|shell scripting|unix)\b/gi,
  // BI & Visualization
  /\b(tableau|power bi|looker|qlik|metabase|superset|grafana|domo|sisense|spotfire)\b/gi,
  // Methodologies
  /\b(agile|scrum|kanban|jira|confluence|rest api|graphql|microservices|etl|elt|data warehouse|data lake|data mesh|data lakehouse)\b/gi,
  // Healthcare / Niche
  /\b(hipaa|hl7|fhir|epic|cerner|healthcare data|phi|claims data)\b/gi,
  // Soft skills / requirements
  /\b(machine learning|deep learning|nlp|computer vision|statistics|a\/b testing|experimentation|feature engineering)\b/gi,
  // Degrees / certs
  /\b(bachelor'?s?|master'?s?|phd|mba|aws certified|google certified|azure certified|databricks certified)\b/gi,
];

const YEARS_PATTERN = /(\d+)\+?\s*years?\s+(?:of\s+)?(?:experience\s+(?:with|in)\s+)?([a-z][a-z0-9\s\+#]+)/gi;

function extractKeywords(text: string): string[] {
  const keywords = new Set<string>();
  const normalized = text.toLowerCase();

  for (const pattern of SKILL_PATTERNS) {
    const matches = normalized.matchAll(pattern);
    for (const match of matches) {
      keywords.add(match[0].trim().toLowerCase());
    }
  }

  // Also extract years-of-experience requirements as bare skill names
  const yearsMatches = normalized.matchAll(YEARS_PATTERN);
  for (const match of yearsMatches) {
    const skill = match[2].trim().toLowerCase().replace(/\s+/g, " ");
    if (skill.length > 2 && skill.length < 40) keywords.add(skill);
  }

  return [...keywords];
}

function normalize(kw: string): string {
  return kw.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function keywordInText(keyword: string, text: string): boolean {
  const normKw = normalize(keyword);
  const normText = normalize(text);
  // Direct inclusion
  if (normText.includes(normKw)) return true;
  // Common aliases
  // Each entry: canonical form → list of aliases that mean the same thing.
  // The check runs both ways: if the keyword matches the key OR any alias,
  // we look for the key OR any alias in the CV text.
  const aliases: Record<string, string[]> = {
    "python": ["py"],
    "javascript": ["js", "node", "nodejs"],
    "typescript": ["ts"],
    "postgresql": ["postgres", "psql"],
    "kubernetes": ["k8s"],
    "tensorflow": ["tf"],
    "powerbi": ["microsoftpowerbi", "pbix", "power bi"],
    "gcp": ["googlecloudplatform", "google cloud platform", "google cloud", "googlegcp"],
    "aws": ["amazonwebservices", "amazon web services"],
    "azure": ["microsoftazure", "microsoft azure"],
    "databricks": ["apachedatabricks", "apache databricks"],
    "cicd": ["continuousintegration", "continuousdelivery", "ci cd", "ci/cd"],
    "machinelearning": ["ml", "machine learning"],
    "naturallanguageprocessing": ["nlp", "natural language processing"],
  };

  for (const [key, aliasList] of Object.entries(aliases)) {
    const allForms = [key, ...aliasList].map(normalize);
    if (allForms.includes(normKw)) {
      // If any form of this keyword exists in the CV text, it's a match
      if (allForms.some((f) => f && normText.includes(f))) return true;
    }
  }

  return false;
}

export function analyzeResumeJobFit(
  cvText: string,
  jobDescription: string,
  requiredSkills: string[] = [],
  jobTitle = "",
  clientJobTitle = ""
): ResumeAnalysis {
  // Combine all sources
  const jobKeywords = [
    ...extractKeywords(jobDescription),
    ...requiredSkills.map((s) => s.toLowerCase()),
    ...extractKeywords(jobTitle)
  ];
  const uniqueJobKeywords = [...new Set(jobKeywords)];
  const cvKeywords = extractKeywords(cvText);
  const cvFull = cvText.toLowerCase();

  const covered: string[] = [];
  const missing: string[] = [];

  for (const kw of uniqueJobKeywords) {
    const inCv = keywordInText(kw, cvFull) || cvKeywords.some((ck) => normalize(ck) === normalize(kw));
    if (inCv) {
      covered.push(kw);
    } else {
      missing.push(kw);
    }
  }

  const total = uniqueJobKeywords.length;
  const coverageScore = total === 0 ? 75 : Math.round((covered.length / total) * 100);

  // Domain shift detection — if job title is very different from client's background
  const domainShift = detectDomainShift(jobTitle, clientJobTitle, cvText);

  let recommendation: ResumeRecommendation;
  let recommendationLabel: string;
  let recommendationReason: string;

  // ATS pass likelihood thresholds:
  //   ≥70% keyword coverage → existing resume will likely pass ATS — leverage & tailor it
  //   40–69%                → too many gaps for ATS to pass — rewrite around the JD
  //   <40% or domain shift  → role/domain mismatch — new targeted version needed
  if (domainShift) {
    recommendation = "NEW_VERSION";
    recommendationLabel = "🆕 New version needed";
    recommendationReason = `This role (${jobTitle}) is outside the client's primary domain. ATS will likely reject the current resume. A new targeted version built around this JD is required.`;
  } else if (coverageScore >= 70) {
    recommendation = "LEVERAGE";
    recommendationLabel = "✏️ Tailor existing resume";
    recommendationReason = `ATS score: ${coverageScore}% keyword match. The existing resume is a strong base — tailor it by weaving in the missing terms (${missing.slice(0, 4).join(", ") || "none"}) and mirroring the JD language to maximise ATS pass rate.`;
  } else if (coverageScore >= 40) {
    recommendation = "REWRITE";
    recommendationLabel = "🔄 Rewrite resume";
    recommendationReason = `ATS score: ${coverageScore}% keyword match. Too many gaps for the current resume to pass ATS. Rewrite experience bullets to target this JD — prioritise adding: ${missing.slice(0, 6).join(", ")}.`;
  } else {
    recommendation = "NEW_VERSION";
    recommendationLabel = "🆕 New version needed";
    recommendationReason = `ATS score: ${coverageScore}% — critical keyword gap. The current resume will be filtered out by ATS. A new version built specifically around this JD is needed. Missing: ${missing.slice(0, 6).join(", ")}.`;
  }

  // Generate cluster ID based on top required skills (for grouping similar jobs)
  const topSkills = [...covered, ...missing.slice(0, 3)]
    .map(normalize)
    .sort()
    .slice(0, 5)
    .join("|");
  const clusterId = topSkills || "general";

  return {
    recommendation,
    coverageScore,
    missingKeywords: missing.slice(0, 12),
    coveredKeywords: covered.slice(0, 12),
    recommendationLabel,
    recommendationReason,
    clusterId
  };
}

function detectDomainShift(jobTitle: string, clientTitle: string, cvText: string): boolean {
  const jt = jobTitle.toLowerCase();
  const ct = clientTitle.toLowerCase();
  const cv = cvText.toLowerCase();

  const domains = {
    data: ["data engineer", "data scientist", "analytics engineer", "data analyst", "ml engineer", "machine learning", "bi engineer", "etl", "data warehouse", "bigquery", "snowflake"],
    software: ["software engineer", "backend engineer", "frontend engineer", "full stack", "swe", "developer"],
    devops: ["devops", "sre", "platform engineer", "infrastructure", "cloud engineer", "mlops"],
    product: ["product manager", "product owner", "program manager"],
    design: ["ux designer", "ui designer", "product designer"],
    finance: ["financial analyst", "accountant", "cfo", "controller"],
    marketing: ["marketing manager", "seo", "content manager", "growth"]
  };

  const getJobDomain = (title: string) => {
    for (const [domain, terms] of Object.entries(domains)) {
      if (terms.some((t) => title.includes(t))) return domain;
    }
    return null;
  };

  const jobDomain = getJobDomain(jt);
  const clientDomain = getJobDomain(ct);

  // If both have a domain and they're different → domain shift
  if (jobDomain && clientDomain && jobDomain !== clientDomain) return true;

  // If the job domain doesn't appear anywhere in the CV → domain shift
  if (jobDomain) {
    const domainTerms = domains[jobDomain as keyof typeof domains] || [];
    if (!domainTerms.some((t) => cv.includes(t))) return true;
  }

  return false;
}

// Group a list of jobs by resume cluster so admin knows how many PDFs are needed
export type JobCluster = {
  clusterId: string;
  label: string;
  jobs: { id: string; title: string; company: string; recommendation: ResumeRecommendation }[];
  suggestedResumeName: string;
  keySkills: string[];
};

export function clusterJobsByResume(
  jobs: Array<{
    id: string;
    title: string;
    companyName: string;
    resumeRecommendation: string | null;
    missingKeywords: string[];
    coveredKeywords: string[];
  }>
): JobCluster[] {
  const clusterMap = new Map<string, JobCluster>();

  for (const job of jobs) {
    if (job.resumeRecommendation === "LEVERAGE") continue; // Tailor existing — no new PDF needed

    const skills = [...(job.coveredKeywords || []), ...(job.missingKeywords || [])]
      .map(normalize)
      .slice(0, 5)
      .sort();

    // Simple clustering: group by top 3 overlapping skills
    let bestCluster: string | null = null;
    let bestOverlap = 0;

    for (const [cid, cluster] of clusterMap.entries()) {
      const clusterSkills = new Set(cluster.keySkills.map(normalize));
      const overlap = skills.filter((s) => clusterSkills.has(s)).length;
      if (overlap >= 2 && overlap > bestOverlap) {
        bestOverlap = overlap;
        bestCluster = cid;
      }
    }

    if (bestCluster) {
      clusterMap.get(bestCluster)!.jobs.push({
        id: job.id,
        title: job.title,
        company: job.companyName,
        recommendation: job.resumeRecommendation as ResumeRecommendation
      });
    } else {
      const cid = skills.slice(0, 3).join("-") || `cluster-${clusterMap.size + 1}`;
      clusterMap.set(cid, {
        clusterId: cid,
        label: skills.slice(0, 3).join(" + "),
        jobs: [{
          id: job.id,
          title: job.title,
          company: job.companyName,
          recommendation: job.resumeRecommendation as ResumeRecommendation
        }],
        suggestedResumeName: deriveName(job.title, skills),
        keySkills: skills
      });
    }
  }

  return [...clusterMap.values()].sort((a, b) => b.jobs.length - a.jobs.length);
}

function deriveName(jobTitle: string, skills: string[]): string {
  const titleWords = jobTitle.replace(/senior|junior|lead|staff|principal/gi, "").trim();
  const topSkill = skills[0] ? ` — ${skills[0].toUpperCase()}` : "";
  return `${titleWords}${topSkill}`;
}
