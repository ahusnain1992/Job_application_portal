import { describe, it, expect } from "vitest";
import { analyzeResumeJobFit } from "../lib/services/resume-match";

const strongCv = `
John Smith — Senior Data Engineer
SKILLS: Python, SQL, GCP, BigQuery, Apache Airflow, dbt, Spark, Kafka, Terraform, Docker
EXPERIENCE:
• Designed and maintained BigQuery data warehouses processing 2TB/day
• Built Airflow DAGs for ETL pipelines on GCP Cloud Composer
• Implemented dbt models for analytics layer serving 50+ dashboards
• Containerised data services using Docker and deployed on GCP GKE
EDUCATION: Bachelor's in Computer Science
`;

const weakCv = `
Jane Doe — Marketing Manager
SKILLS: Google Ads, Facebook Ads, SEO, Copywriting, HubSpot
EXPERIENCE:
• Managed $500K annual paid media budget
• Wrote blog posts and email campaigns
`;

const dataEngineerJob = {
  description: "We need a Senior Data Engineer to build BigQuery pipelines using Python, SQL, Airflow, dbt, and GCP. Experience with Kafka and Spark a plus.",
  requiredSkills: ["Python", "SQL", "BigQuery", "Airflow", "dbt", "GCP"],
  jobTitle: "Senior Data Engineer",
  clientJobTitle: "Data Engineer"
};

describe("analyzeResumeJobFit", () => {
  it("AS_IS for strong CV that covers ≥75% of keywords", () => {
    const result = analyzeResumeJobFit(
      strongCv,
      dataEngineerJob.description,
      dataEngineerJob.requiredSkills,
      dataEngineerJob.jobTitle,
      dataEngineerJob.clientJobTitle
    );
    expect(result.recommendation).toBe("AS_IS");
    expect(result.coverageScore).toBeGreaterThanOrEqual(75);
    expect(result.coveredKeywords.length).toBeGreaterThan(0);
  });

  it("FULL_REWRITE or NEW_VERSION for completely unrelated CV", () => {
    const result = analyzeResumeJobFit(
      weakCv,
      dataEngineerJob.description,
      dataEngineerJob.requiredSkills,
      dataEngineerJob.jobTitle,
      "Marketing Manager"
    );
    expect(["FULL_REWRITE", "NEW_VERSION"]).toContain(result.recommendation);
    expect(result.coverageScore).toBeLessThan(55);
    expect(result.missingKeywords.length).toBeGreaterThan(0);
  });

  it("coveredKeywords are all present in CV text", () => {
    const result = analyzeResumeJobFit(
      strongCv,
      dataEngineerJob.description,
      dataEngineerJob.requiredSkills,
      dataEngineerJob.jobTitle,
      dataEngineerJob.clientJobTitle
    );
    for (const kw of result.coveredKeywords) {
      expect(strongCv.toLowerCase()).toContain(kw.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 3));
    }
  });

  it("missingKeywords are not in covered list", () => {
    const result = analyzeResumeJobFit(
      weakCv,
      dataEngineerJob.description,
      dataEngineerJob.requiredSkills,
      dataEngineerJob.jobTitle,
      "Marketing Manager"
    );
    const covered = new Set(result.coveredKeywords.map((k) => k.toLowerCase()));
    for (const kw of result.missingKeywords) {
      expect(covered.has(kw.toLowerCase())).toBe(false);
    }
  });

  it("coverageScore is always 0–100", () => {
    const r1 = analyzeResumeJobFit("", "some job requiring python sql", ["Python", "SQL"], "Engineer", "");
    const r2 = analyzeResumeJobFit(strongCv, "", [], "", "");
    expect(r1.coverageScore).toBeGreaterThanOrEqual(0);
    expect(r1.coverageScore).toBeLessThanOrEqual(100);
    expect(r2.coverageScore).toBeGreaterThanOrEqual(0);
    expect(r2.coverageScore).toBeLessThanOrEqual(100);
  });

  it("domain shift triggers NEW_VERSION", () => {
    const result = analyzeResumeJobFit(
      weakCv,
      "Software engineer role building REST APIs in Node.js",
      ["Node.js", "TypeScript", "REST API"],
      "Software Engineer",
      "Marketing Manager"
    );
    expect(result.recommendation).toBe("NEW_VERSION");
  });

  it("alias matching: GCP recognised from 'google cloud'", () => {
    const cvWithAlias = "Experience with Google Cloud Platform, Python, SQL";
    const result = analyzeResumeJobFit(
      cvWithAlias,
      "Role requires GCP, Python, SQL",
      ["GCP", "Python", "SQL"],
      "Data Engineer",
      "Data Engineer"
    );
    expect(result.coverageScore).toBeGreaterThanOrEqual(75);
  });
});

// Multi-resume selection logic — simulated here since it lives in the cron
describe("multi-resume best-pick simulation", () => {
  const resumes = [
    { id: "r1", name: "Data Engineer - GCP", text: strongCv },
    { id: "r2", name: "Marketing Resume", text: weakCv },
    { id: "r3", name: "Partial Match", text: "Python developer with SQL experience" }
  ];

  it("picks the resume with the highest coverageScore", () => {
    let best: { id: string; name: string } | null = null;
    let bestScore = -1;

    for (const resume of resumes) {
      const analysis = analyzeResumeJobFit(
        resume.text,
        dataEngineerJob.description,
        dataEngineerJob.requiredSkills,
        dataEngineerJob.jobTitle,
        dataEngineerJob.clientJobTitle
      );
      if (analysis.coverageScore > bestScore) {
        bestScore = analysis.coverageScore;
        best = { id: resume.id, name: resume.name };
      }
    }

    expect(best?.id).toBe("r1");
    expect(best?.name).toBe("Data Engineer - GCP");
    expect(bestScore).toBeGreaterThanOrEqual(75);
  });

  it("never picks a resume with 0% coverage when a better one exists", () => {
    let best: { id: string } | null = null;
    let bestScore = -1;

    for (const resume of resumes) {
      const analysis = analyzeResumeJobFit(
        resume.text,
        dataEngineerJob.description,
        dataEngineerJob.requiredSkills,
        dataEngineerJob.jobTitle,
        dataEngineerJob.clientJobTitle
      );
      if (analysis.coverageScore > bestScore) {
        bestScore = analysis.coverageScore;
        best = { id: resume.id };
      }
    }

    expect(best?.id).not.toBe("r2"); // Marketing resume should never win
  });
});
