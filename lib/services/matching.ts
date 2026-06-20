import { ClientProfile, EmploymentType, Job, WorkMode } from "@prisma/client";

type JobInput = Pick<Job, "title" | "location" | "workMode" | "employmentType" | "salaryMin" | "salaryMax" | "description" | "requiredSkills" | "preferredSkills" | "postedDate" | "companyName">;
type ClientInput = Pick<ClientProfile, "targetJobTitles" | "alternativeJobTitles" | "mainSkills" | "secondarySkills" | "preferredLocations" | "workModePreference" | "employmentTypePreference" | "minimumSalary" | "maximumSalary" | "keywordsExclude" | "industriesPreferred" | "industriesToAvoid">;

function containsAny(text: string, terms: string[]) {
  const haystack = text.toLowerCase();
  return terms.filter((term) => haystack.includes(term.toLowerCase()));
}

function titleMatches(jobTitle: string, titles: string[]) {
  const normalized = jobTitle.toLowerCase();
  return titles.some((title) => normalized.includes(title.toLowerCase()) || title.toLowerCase().includes(normalized));
}

export function scoreJobForClient(job: JobInput, client: ClientInput) {
  let score = 0;
  const reasons: string[] = [];
  const warnings: string[] = [];
  const jobText = `${job.title} ${job.companyName} ${job.description} ${job.requiredSkills.join(" ")} ${job.preferredSkills.join(" ")}`;

  if (titleMatches(job.title, client.targetJobTitles)) {
    score += 28;
    reasons.push(`${job.title} matches a target title`);
  } else if (titleMatches(job.title, client.alternativeJobTitles)) {
    score += 18;
    reasons.push(`${job.title} matches an alternative title`);
  }

  const mainSkillMatches = containsAny(jobText, client.mainSkills);
  score += Math.min(mainSkillMatches.length * 6, 30);
  if (mainSkillMatches.length) reasons.push(`matches core skills: ${mainSkillMatches.slice(0, 5).join(", ")}`);

  const secondaryMatches = containsAny(jobText, client.secondarySkills);
  score += Math.min(secondaryMatches.length * 3, 12);

  if (client.workModePreference === WorkMode.FLEXIBLE || job.workMode === client.workModePreference) {
    score += 12;
    reasons.push(`${job.workMode.toLowerCase()} work matches preference`);
  } else if (job.workMode === WorkMode.ONSITE && client.workModePreference === WorkMode.REMOTE) {
    warnings.push("Role appears onsite while the client prefers remote work.");
  }

  if (client.employmentTypePreference === EmploymentType.UNKNOWN || job.employmentType === client.employmentTypePreference) {
    score += 8;
  }

  const locationMatches = containsAny(job.location, client.preferredLocations);
  if (locationMatches.length || job.location.toLowerCase().includes("remote")) {
    score += 10;
    reasons.push(`location aligns with ${locationMatches[0] || "remote preference"}`);
  } else {
    warnings.push("Location does not clearly match the client's preferred locations.");
  }

  if (job.salaryMax && client.minimumSalary && job.salaryMax < client.minimumSalary) {
    warnings.push("Listed salary may be below the client's minimum.");
    score -= 8;
  } else if (job.salaryMin && client.maximumSalary && job.salaryMin > client.maximumSalary) {
    warnings.push("Listed salary may exceed the client's target range.");
    score -= 4;
  } else if (job.salaryMin || job.salaryMax) {
    score += 7;
  }

  const excluded = containsAny(jobText, client.keywordsExclude);
  if (excluded.length) {
    score -= 25;
    warnings.push(`Excluded keyword found: ${excluded.join(", ")}.`);
  }

  const avoidedIndustries = containsAny(jobText, client.industriesToAvoid);
  if (avoidedIndustries.length) {
    score -= 10;
    warnings.push(`Avoided industry signal found: ${avoidedIndustries.join(", ")}.`);
  }

  if (job.postedDate) {
    const ageDays = (Date.now() - job.postedDate.getTime()) / (1000 * 60 * 60 * 24);
    if (ageDays <= 7) score += 5;
    if (ageDays > 30) warnings.push("Job is more than 30 days old.");
  }

  const boundedScore = Math.max(0, Math.min(100, Math.round(score)));
  const explanation = reasons.length
    ? `This job scores ${boundedScore} because it ${reasons.join(", ")}.`
    : `This job scores ${boundedScore}; it needs manual review because strong profile signals were not detected.`;

  return { score: boundedScore, explanation, warnings };
}
