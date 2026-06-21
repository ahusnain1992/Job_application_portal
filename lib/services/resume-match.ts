export type ResumeRecommendation = "AS_IS" | "MINOR_TAILORING" | "FULL_REWRITE" | "NEW_VERSION";

export type ResumeAnalysis = {
  recommendation: ResumeRecommendation;
  coverageScore: number;          // 0–100: how much of the job is covered by the CV
  missingKeywords: string[];      // skills/keywords in job but NOT in CV
  coveredKeywords: string[];      // skills/keywords found in both
  recommendationLabel: string;    // human-readable label
  recommendationReason: string;   // plain-English explanation
  clusterId?: string;             // for grouping similar jobs (same resume can cover)
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

  if (domainShift) {
    recommendation = "NEW_VERSION";
    recommendationLabel = "📄 New resume version needed";
    recommendationReason = `This role (${jobTitle}) is in a different domain than the client's primary experience. A targeted resume version focusing on relevant transferable skills will significantly improve response rates.`;
  } else if (coverageScore >= 75) {
    recommendation = "AS_IS";
    recommendationLabel = "✅ Apply as-is";
    recommendationReason = `The current resume covers ${coverageScore}% of this job's requirements. Strong match — no rewrite needed. ${missing.length > 0 ? `Minor missing terms: ${missing.slice(0, 3).join(", ")}` : ""}`;
  } else if (coverageScore >= 55) {
    recommendation = "MINOR_TAILORING";
    recommendationLabel = "✏️ Minor tailoring recommended";
    recommendationReason = `The resume covers ${coverageScore}% of requirements. Adding ${missing.slice(0, 4).join(", ")} to the skills section or summary would improve ATS scoring significantly.`;
  } else if (coverageScore >= 35) {
    recommendation = "FULL_REWRITE";
    recommendationLabel = "🔄 Resume rewrite recommended";
    recommendationReason = `Only ${coverageScore}% of job requirements appear in the current resume. Key missing items: ${missing.slice(0, 5).join(", ")}. A targeted rewrite will significantly improve callback rate.`;
  } else {
    recommendation = "NEW_VERSION";
    recommendationLabel = "📄 New resume version needed";
    recommendationReason = `Only ${coverageScore}% overlap with job requirements. Missing critical skills: ${missing.slice(0, 6).join(", ")}. A new targeted version is strongly recommended.`;
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
    if (job.resumeRecommendation === "AS_IS") continue; // No new PDF needed

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
