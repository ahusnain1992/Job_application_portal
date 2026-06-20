import { describe, it, expect } from "vitest";
import { scoreJobForClient } from "../lib/services/matching";
import { WorkMode, EmploymentType } from "@prisma/client";

const baseClient = {
  targetJobTitles: ["Senior Data Engineer"],
  alternativeJobTitles: ["Analytics Engineer", "ETL Developer"],
  mainSkills: ["SQL", "Python", "GCP", "BigQuery", "Airflow"],
  secondarySkills: ["Tableau", "Power BI", "dbt"],
  preferredLocations: ["Remote", "Chicago, IL"],
  workModePreference: WorkMode.REMOTE,
  employmentTypePreference: EmploymentType.FULL_TIME,
  minimumSalary: 145000,
  maximumSalary: 185000,
  keywordsExclude: ["active security clearance", "onsite only"],
  industriesPreferred: ["Healthcare", "SaaS"],
  industriesToAvoid: ["Defense", "gambling"]
};

const baseJob = {
  title: "Senior Data Engineer",
  companyName: "Acme Health",
  location: "Remote",
  workMode: WorkMode.REMOTE,
  employmentType: EmploymentType.FULL_TIME,
  salaryMin: 150000,
  salaryMax: 180000,
  description: "Build data pipelines with SQL, Python, GCP, BigQuery, Airflow.",
  requiredSkills: ["SQL", "Python", "GCP", "BigQuery", "Airflow"],
  preferredSkills: ["dbt"],
  postedDate: new Date()
};

describe("scoreJobForClient", () => {
  it("scores a strong match highly (≥ 80)", () => {
    const result = scoreJobForClient(baseJob, baseClient);
    expect(result.score).toBeGreaterThanOrEqual(80);
    expect(result.warnings).toHaveLength(0);
  });

  it("reduces score when excluded keyword is present", () => {
    const job = { ...baseJob, description: baseJob.description + " active security clearance required" };
    const result = scoreJobForClient(job, baseClient);
    expect(result.score).toBeLessThan(80);
    expect(result.warnings.some((w) => w.includes("active security clearance"))).toBe(true);
  });

  it("adds a warning for onsite job when client prefers remote", () => {
    const job = { ...baseJob, workMode: WorkMode.ONSITE };
    const result = scoreJobForClient(job, baseClient);
    expect(result.warnings.some((w) => /onsite/i.test(w) || /remote/i.test(w))).toBe(true);
  });

  it("matches alternative titles with a lower score than target", () => {
    const target = scoreJobForClient(baseJob, baseClient);
    const alternative = scoreJobForClient({ ...baseJob, title: "Analytics Engineer" }, baseClient);
    expect(target.score).toBeGreaterThan(alternative.score);
  });

  it("warns when salary max is below client minimum", () => {
    const job = { ...baseJob, salaryMin: 100000, salaryMax: 130000 };
    const result = scoreJobForClient(job, baseClient);
    expect(result.warnings.some((w) => /salary/i.test(w) || /minimum/i.test(w))).toBe(true);
  });

  it("score is always between 0 and 100", () => {
    const worst = scoreJobForClient({
      ...baseJob,
      title: "Unrelated Role",
      description: "active security clearance gambling defense",
      workMode: WorkMode.ONSITE,
      salaryMax: 50000,
      requiredSkills: [],
      preferredSkills: []
    }, baseClient);
    expect(worst.score).toBeGreaterThanOrEqual(0);
    expect(worst.score).toBeLessThanOrEqual(100);
  });
});
