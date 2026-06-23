"use client";

import { useState, useRef } from "react";
import { X, Plus, AlertCircle } from "lucide-react";
import { TagInput } from "@/components/tag-input";
import { LocationPicker } from "@/components/location-picker";
import { FileUploadOrUrl } from "@/components/file-upload-or-url";

// Skill suggestions keyed by job title keywords
const SKILL_SUGGESTIONS: Record<string, string[]> = {
  "data engineer": ["Python", "SQL", "Spark", "Kafka", "Airflow", "dbt", "AWS", "GCP", "Azure", "BigQuery", "Snowflake", "Databricks", "ETL", "Hadoop", "Scala"],
  "data scientist": ["Python", "R", "SQL", "Machine Learning", "TensorFlow", "PyTorch", "Pandas", "NumPy", "Scikit-learn", "Statistics", "NLP", "Deep Learning", "Jupyter"],
  "data analyst": ["SQL", "Python", "Tableau", "Power BI", "Excel", "Looker", "Google Analytics", "A/B Testing", "Statistics", "Data Visualization", "dbt"],
  "software engineer": ["JavaScript", "TypeScript", "Python", "Java", "C++", "React", "Node.js", "AWS", "Docker", "Kubernetes", "Git", "REST APIs", "SQL", "NoSQL"],
  "automation engineer": ["Selenium", "Python", "Java", "Pytest", "TestNG", "CI/CD", "Jenkins", "GitHub Actions", "REST APIs", "Postman", "SQL", "Docker", "Appium"],
  "backend engineer": ["Python", "Java", "Node.js", "Go", "Rust", "PostgreSQL", "MongoDB", "Redis", "AWS", "Docker", "Kubernetes", "REST APIs", "GraphQL", "Microservices"],
  "frontend engineer": ["React", "TypeScript", "JavaScript", "Next.js", "Vue.js", "CSS", "HTML", "Tailwind CSS", "Redux", "GraphQL", "Jest", "Figma"],
  "full stack": ["React", "Node.js", "TypeScript", "Python", "PostgreSQL", "MongoDB", "AWS", "Docker", "REST APIs", "GraphQL", "Git"],
  "devops": ["AWS", "GCP", "Azure", "Docker", "Kubernetes", "Terraform", "CI/CD", "Jenkins", "GitHub Actions", "Linux", "Bash", "Ansible", "Prometheus"],
  "machine learning": ["Python", "TensorFlow", "PyTorch", "Scikit-learn", "MLflow", "Kubeflow", "AWS SageMaker", "NLP", "Computer Vision", "Deep Learning", "Statistics"],
  "product manager": ["Product Strategy", "Roadmapping", "Agile", "Scrum", "Jira", "User Research", "A/B Testing", "SQL", "Figma", "Stakeholder Management"],
  "ui ux": ["Figma", "Sketch", "Adobe XD", "User Research", "Wireframing", "Prototyping", "Usability Testing", "Design Systems", "HTML", "CSS", "Accessibility"],
  "cloud engineer": ["AWS", "GCP", "Azure", "Terraform", "Docker", "Kubernetes", "CI/CD", "Linux", "Networking", "Security", "IaC", "Serverless"],
  "security": ["Penetration Testing", "SIEM", "Vulnerability Assessment", "Network Security", "AWS Security", "ISO 27001", "SOC 2", "Incident Response", "Python", "OWASP"],
  "default": ["Python", "SQL", "JavaScript", "AWS", "Docker", "Git", "REST APIs", "Agile", "Communication", "Problem Solving"],
};

const EXCLUDE_SUGGESTIONS = [
  "Requires security clearance", "On-site only", "No sponsorship", "C2C not accepted",
  "Internship", "Entry level only", "Director level", "VP level",
  "Sales role", "Commission only", "Unpaid", "Part-time only",
  "Relocation required", "Travel required", "Night shift", "Weekend work",
];

function getSkillSuggestions(titles: string[]): string[] {
  const titleStr = titles.join(" ").toLowerCase();
  for (const [key, skills] of Object.entries(SKILL_SUGGESTIONS)) {
    if (key === "default") continue;
    if (titleStr.includes(key)) return skills;
  }
  return SKILL_SUGGESTIONS.default;
}

function normalizeUrl(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) return trimmed;
  return `https://${trimmed}`;
}

interface ResumeSection {
  title: string;
  fileValue: string;
  resumeText: string;
}

interface AddClientFormProps {
  teamMembers: { id: string; name: string }[];
}

type FieldErrors = Partial<Record<string, string>>;

function FieldError({ error }: { error?: string }) {
  if (!error) return null;
  return (
    <p className="mt-1 flex items-center gap-1 text-xs text-red-600">
      <AlertCircle size={12} className="shrink-0" />
      {error}
    </p>
  );
}

export function AddClientForm({ teamMembers }: AddClientFormProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const [targetTitles, setTargetTitles] = useState<string[]>([]);
  const [mainSkills, setMainSkills] = useState<string[]>([]);
  const [excludeKeywords, setExcludeKeywords] = useState<string[]>([]);
  const [resumes, setResumes] = useState<ResumeSection[]>([{ title: "", fileValue: "", resumeText: "" }]);
  const [skillInput, setSkillInput] = useState("");
  const [excludeInput, setExcludeInput] = useState("");
  const [workMode, setWorkMode] = useState("FLEXIBLE");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitting, setSubmitting] = useState(false);

  // Refs for hidden inputs that need imperative sync
  const skillsHiddenRef = useRef<HTMLInputElement>(null);
  const excludeHiddenRef = useRef<HTMLInputElement>(null);

  const suggestedSkills = getSkillSuggestions(targetTitles).filter(s => !mainSkills.includes(s));

  function addSkill(skill: string) {
    if (!mainSkills.includes(skill)) {
      const next = [...mainSkills, skill];
      setMainSkills(next);
      if (skillsHiddenRef.current) skillsHiddenRef.current.value = next.join(", ");
      if (errors.mainSkills) setErrors(prev => ({ ...prev, mainSkills: undefined }));
    }
  }

  function removeSkill(skill: string) {
    const next = mainSkills.filter(s => s !== skill);
    setMainSkills(next);
    if (skillsHiddenRef.current) skillsHiddenRef.current.value = next.join(", ");
  }

  function addExclude(kw: string) {
    if (!excludeKeywords.includes(kw)) {
      const next = [...excludeKeywords, kw];
      setExcludeKeywords(next);
      if (excludeHiddenRef.current) excludeHiddenRef.current.value = next.join(", ");
    }
  }

  function removeExclude(kw: string) {
    const next = excludeKeywords.filter(k => k !== kw);
    setExcludeKeywords(next);
    if (excludeHiddenRef.current) excludeHiddenRef.current.value = next.join(", ");
  }

  function addResumeSection() {
    if (resumes.length < 3) {
      setResumes(prev => [...prev, { title: "", fileValue: "", resumeText: "" }]);
    }
  }

  function removeResumeSection(i: number) {
    setResumes(prev => prev.filter((_, idx) => idx !== i));
  }

  function updateResume(i: number, field: keyof ResumeSection, value: string) {
    setResumes(prev => prev.map((r, idx) => idx === i ? { ...r, [field]: value } : r));
    if (errors.resume) setErrors(prev => ({ ...prev, resume: undefined }));
  }

  function validate(form: HTMLFormElement): FieldErrors {
    const errs: FieldErrors = {};
    const data = new FormData(form);

    if (!String(data.get("clientName") || "").trim()) {
      errs.clientName = "Client full name is required.";
    }
    if (!String(data.get("currentJobTitle") || "").trim()) {
      errs.currentJobTitle = "Current job title is required.";
    }

    // Flush pending skill input for validation
    const pendingSkill = skillInput.trim();
    const effectiveSkills = [...mainSkills, ...(pendingSkill ? [pendingSkill] : [])];
    if (effectiveSkills.length === 0) {
      errs.mainSkills = "Please add at least one main skill.";
    }

    // Target titles — check DOM hidden input (always sync via syncHidden) AND React state
    // DOM is set synchronously by syncHidden even before React processes state updates
    const titlesHiddenEl = form.elements.namedItem("targetJobTitles") as HTMLInputElement | null;
    const titlesFromDom = titlesHiddenEl?.value?.trim() ?? "";
    const effectiveTitleCount = titlesFromDom
      ? titlesFromDom.split(",").map(s => s.trim()).filter(Boolean).length
      : targetTitles.length;
    if (effectiveTitleCount === 0) {
      errs.targetJobTitles = "Please add at least one target job title.";
    }

    // Location requirement
    const countries = String(data.get("preferredCountries") || "").trim();
    const cities = String(data.get("preferredCities") || "").trim();
    const locations = String(data.get("preferredLocations") || "").trim();
    const wm = String(data.get("workModePreference") || "");
    if (!countries && !cities && !locations && wm !== "REMOTE") {
      errs.location = "Please select at least one country, city/state, or set work mode to Remote only.";
    }

    // Resume text requirement — at least one resume section must have text
    const hasResumeText = resumes.some(r => r.resumeText.trim()) ||
      String(data.get("cvText") || "").trim().length > 0;
    if (!hasResumeText) {
      errs.resume = "Please paste the resume/CV text for at least one resume. This is used for job matching — a file alone is not enough.";
    } else {
      // Check for file without text (warn but don't block if cvText is present)
      const fileWithoutText = resumes.some(r => r.fileValue && !r.resumeText.trim());
      if (fileWithoutText && !String(data.get("cvText") || "").trim()) {
        errs.resume = "A file was uploaded but the resume text is missing. Please paste the resume text below the file — this is needed for job matching.";
      }
    }

    // Optional URL validation
    const linkedin = String(data.get("linkedinUrl") || "").trim();
    if (linkedin && !linkedin.startsWith("http://") && !linkedin.startsWith("https://")) {
      // We'll auto-normalize, not an error
    }

    return errs;
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;

    // Flush pending typed-but-not-entered inputs into DOM before validation
    if (skillInput.trim()) {
      const next = [...mainSkills, skillInput.trim()].filter((v, i, a) => a.indexOf(v) === i);
      if (skillsHiddenRef.current) skillsHiddenRef.current.value = next.join(", ");
    }
    if (excludeInput.trim()) {
      const next = [...excludeKeywords, excludeInput.trim()].filter((v, i, a) => a.indexOf(v) === i);
      if (excludeHiddenRef.current) excludeHiddenRef.current.value = next.join(", ");
    }

    // Auto-normalize LinkedIn and GitHub URLs
    const linkedinInput = form.elements.namedItem("linkedinUrl") as HTMLInputElement | null;
    if (linkedinInput?.value) linkedinInput.value = normalizeUrl(linkedinInput.value);

    const githubInput = form.elements.namedItem("githubUrl") as HTMLInputElement | null;
    if (githubInput?.value) githubInput.value = normalizeUrl(githubInput.value);

    const errs = validate(form);
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      // Scroll to first error
      setTimeout(() => {
        form.querySelector("[data-error]")?.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 50);
      return;
    }

    setErrors({});
    setSubmitting(true);

    // Sync tag state to hidden inputs right before native submit.
    // Merge DOM value (set synchronously by syncHidden on every tag change) with React state
    // (covers both: DOM-reset-by-React and state-stale-from-blur-timing scenarios).
    const titlesHidden = form.elements.namedItem("targetJobTitles") as HTMLInputElement | null;
    if (titlesHidden) {
      const fromDom = titlesHidden.value.split(",").map(s => s.trim()).filter(Boolean);
      const merged = [...new Set([...fromDom, ...targetTitles])];
      titlesHidden.value = merged.join(", ");
    }

    const skillsHidden = form.elements.namedItem("mainSkills") as HTMLInputElement | null;
    const pendingSkillFinal = skillInput.trim();
    if (skillsHidden) {
      const fromSkillsDom = skillsHidden.value.split(",").map(s => s.trim()).filter(Boolean);
      const effectiveSkills = [...new Set([...fromSkillsDom, ...mainSkills, ...(pendingSkillFinal ? [pendingSkillFinal] : [])])];
      skillsHidden.value = effectiveSkills.join(", ");
    }

    form.submit();
  }

  return (
    <form ref={formRef} action="/api/clients" method="post" onSubmit={handleSubmit} className="space-y-6">

      {/* Basic info */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div data-error={errors.clientName ? true : undefined}>
          <label className="block text-sm font-medium text-ink">Client full name *</label>
          <input name="clientName" placeholder="e.g. Nadia Rahman"
            className={`mt-1 w-full rounded-md border px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-brand/30 ${errors.clientName ? "border-red-400 bg-red-50" : "border-line"}`} />
          <FieldError error={errors.clientName} />
        </div>
        <div data-error={errors.currentJobTitle ? true : undefined}>
          <label className="block text-sm font-medium text-ink">Current job title *</label>
          <input name="currentJobTitle" placeholder="e.g. Senior Data Engineer"
            className={`mt-1 w-full rounded-md border px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-brand/30 ${errors.currentJobTitle ? "border-red-400 bg-red-50" : "border-line"}`} />
          <FieldError error={errors.currentJobTitle} />
        </div>
      </div>

      {/* Target titles */}
      <div data-error={errors.targetJobTitles ? true : undefined}>
        <label className="block text-sm font-medium text-ink mb-1">
          Target job titles * <span className="text-muted font-normal">(3–4 titles recommended)</span>
        </label>
        <TagInput
          name="targetJobTitles"
          placeholder="e.g. Senior Data Engineer — press Enter or comma to add"
          onTagsChange={(tags) => {
            setTargetTitles(tags);
            if (errors.targetJobTitles) setErrors(prev => ({ ...prev, targetJobTitles: undefined }));
          }}
        />
        <FieldError error={errors.targetJobTitles} />
      </div>

      {/* Alternative titles */}
      <div>
        <label className="block text-sm font-medium text-ink mb-1">
          Alternative titles <span className="text-muted font-normal">(optional broadeners)</span>
        </label>
        <TagInput name="alternativeJobTitles" placeholder="e.g. ETL Developer, BI Engineer" />
      </div>

      {/* Main skills */}
      <div data-error={errors.mainSkills ? true : undefined}>
        <label className="block text-sm font-medium text-ink mb-1">
          Main skills * <span className="text-muted font-normal">(used for job matching)</span>
        </label>
        <input ref={skillsHiddenRef} type="hidden" name="mainSkills" defaultValue="" />

        <div
          className={`flex flex-wrap gap-1.5 rounded-md border bg-white px-3 py-2 min-h-[42px] cursor-text ${errors.mainSkills ? "border-red-400 bg-red-50" : "border-line"}`}
          onClick={() => document.getElementById("skill-input")?.focus()}
        >
          {mainSkills.map(skill => (
            <span key={skill} className="inline-flex items-center gap-1 rounded-md bg-brand/10 px-2 py-0.5 text-sm font-medium text-brand">
              {skill}
              <button type="button" onClick={() => removeSkill(skill)} className="text-brand/60 hover:text-brand">
                <X size={11} />
              </button>
            </span>
          ))}
          <input
            id="skill-input"
            value={skillInput}
            onChange={e => setSkillInput(e.target.value)}
            onKeyDown={e => {
              if ((e.key === "Enter" || e.key === ",") && skillInput.trim()) {
                e.preventDefault();
                addSkill(skillInput.trim());
                setSkillInput("");
              }
            }}
            onBlur={() => { if (skillInput.trim()) { addSkill(skillInput.trim()); setSkillInput(""); } }}
            placeholder={mainSkills.length === 0 ? "Type a skill or click suggestions below" : ""}
            className="flex-1 min-w-[160px] bg-transparent text-sm text-ink outline-none placeholder:text-muted"
          />
        </div>
        <p className="mt-1 text-xs text-muted">Click suggestions to add · Typed text is saved when you submit</p>
        <FieldError error={errors.mainSkills} />

        {suggestedSkills.length > 0 && (
          <div className="mt-2">
            <p className="text-xs text-muted mb-1.5">Suggested for {targetTitles[0] || "this role"}:</p>
            <div className="flex flex-wrap gap-1.5">
              {suggestedSkills.slice(0, 12).map(skill => (
                <button key={skill} type="button" onClick={() => addSkill(skill)}
                  className="rounded-full border border-brand/30 bg-[#F0FAF7] px-2.5 py-0.5 text-xs font-medium text-[#186A5E] hover:bg-[#DFF5ED] hover:border-brand/60 transition-colors">
                  + {skill}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Location — required */}
      <div data-error={errors.location ? true : undefined}>
        <label className="block text-sm font-medium text-ink mb-1">
          Job search locations * <span className="text-muted font-normal">(where to look for jobs)</span>
        </label>
        <LocationPicker />
        <FieldError error={errors.location} />
      </div>

      {/* Work mode & Employment type */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-ink">Work mode</label>
          <select name="workModePreference" value={workMode} onChange={e => setWorkMode(e.target.value)}
            className="mt-1 w-full rounded-md border border-line px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-brand/30">
            <option value="FLEXIBLE">Flexible (any)</option>
            <option value="REMOTE">Remote only</option>
            <option value="HYBRID">Hybrid</option>
            <option value="ONSITE">Onsite</option>
          </select>
          {workMode === "REMOTE" && (
            <p className="mt-1 text-xs text-brand">Remote only — no location selection required.</p>
          )}
        </div>
        <div>
          <label className="block text-sm font-medium text-ink">Employment type</label>
          <select name="employmentTypePreference"
            className="mt-1 w-full rounded-md border border-line px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-brand/30">
            <option value="UNKNOWN">Any</option>
            <option value="FULL_TIME">Full-time</option>
            <option value="CONTRACT">Contract</option>
            <option value="C2C">C2C</option>
            <option value="W2">W2</option>
          </select>
        </div>
      </div>

      {/* Salary */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-ink">Min salary ($)</label>
          <input type="number" name="minimumSalary" placeholder="130000" min="0" max="10000000"
            className="mt-1 w-full rounded-md border border-line px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-brand/30" />
        </div>
        <div>
          <label className="block text-sm font-medium text-ink">Max salary ($)</label>
          <input type="number" name="maximumSalary" placeholder="180000" min="0" max="10000000"
            className="mt-1 w-full rounded-md border border-line px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-brand/30" />
        </div>
      </div>

      {/* Exclude keywords */}
      <div>
        <label className="block text-sm font-medium text-ink mb-1">
          Exclude keywords <span className="text-muted font-normal">(skip jobs containing these)</span>
        </label>
        <input ref={excludeHiddenRef} type="hidden" name="keywordsExclude" defaultValue="" />

        <div className="flex flex-wrap gap-1.5 rounded-md border border-line bg-white px-3 py-2 min-h-[42px] cursor-text"
          onClick={() => document.getElementById("exclude-input")?.focus()}>
          {excludeKeywords.map(kw => (
            <span key={kw} className="inline-flex items-center gap-1 rounded-md bg-red-50 px-2 py-0.5 text-sm font-medium text-red-700">
              {kw}
              <button type="button" onClick={() => removeExclude(kw)} className="text-red-400 hover:text-red-700">
                <X size={11} />
              </button>
            </span>
          ))}
          <input
            id="exclude-input"
            value={excludeInput}
            onChange={e => setExcludeInput(e.target.value)}
            onKeyDown={e => {
              if ((e.key === "Enter" || e.key === ",") && excludeInput.trim()) {
                e.preventDefault();
                addExclude(excludeInput.trim());
                setExcludeInput("");
              }
            }}
            onBlur={() => { if (excludeInput.trim()) { addExclude(excludeInput.trim()); setExcludeInput(""); } }}
            placeholder={excludeKeywords.length === 0 ? "Type keyword or click suggestions" : ""}
            className="flex-1 min-w-[160px] bg-transparent text-sm text-ink outline-none placeholder:text-muted"
          />
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {EXCLUDE_SUGGESTIONS.filter(s => !excludeKeywords.includes(s)).map(kw => (
            <button key={kw} type="button" onClick={() => addExclude(kw)}
              className="rounded-full border border-red-200 bg-red-50 px-2.5 py-0.5 text-xs font-medium text-red-700 hover:bg-red-100 transition-colors">
              + {kw}
            </button>
          ))}
        </div>
      </div>

      {/* Resumes — required, at least one with text */}
      <div data-error={errors.resume ? true : undefined}>
        <div className="flex items-center justify-between mb-1">
          <label className="block text-sm font-medium text-ink">
            Resume / CV * <span className="text-muted font-normal">(at least one resume with text)</span>
          </label>
          {resumes.length < 3 && (
            <button type="button" onClick={addResumeSection}
              className="inline-flex items-center gap-1 rounded-md border border-brand/40 bg-[#F0FAF7] px-2.5 py-1 text-xs font-medium text-[#186A5E] hover:bg-[#DFF5ED]">
              <Plus size={12} /> Add resume
            </button>
          )}
        </div>
        <p className="mb-3 text-xs text-muted">
          Resume/CV text is used to match jobs and recommend which resume employees should use. File upload lets employees download the resume, but job matching always needs the pasted text.
        </p>

        {errors.resume && (
          <div className="mb-3 flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
            <AlertCircle size={14} className="mt-0.5 shrink-0" />
            <span>{errors.resume}</span>
          </div>
        )}

        <div className="space-y-4">
          {resumes.map((resume, i) => (
            <div key={i} className={`rounded-lg border p-4 ${errors.resume ? "border-red-300 bg-red-50/50" : "border-line bg-canvas"}`}>
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold uppercase tracking-wide text-muted">Resume {i + 1}{i === 0 ? " (required)" : " (optional)"}</span>
                {resumes.length > 1 && (
                  <button type="button" onClick={() => removeResumeSection(i)} className="text-xs text-red-500 hover:text-red-700">Remove</button>
                )}
              </div>
              <input type="hidden" name={`resumeTitle_${i}`} value={resume.title} />
              <input type="hidden" name={`resumeFile_${i}`} value={resume.fileValue} />

              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-ink mb-1">
                    Resume label <span className="text-muted font-normal">(e.g. &ldquo;Senior Data Engineer Resume&rdquo;)</span>
                  </label>
                  <input
                    value={resume.title}
                    onChange={e => updateResume(i, "title", e.target.value)}
                    placeholder={targetTitles[i] ? `${targetTitles[i]} Resume` : "e.g. Data Engineer Resume"}
                    className="w-full rounded-md border border-line px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-brand/30"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-ink mb-1">
                    File or URL <span className="text-muted font-normal">(optional — employees can download this)</span>
                  </label>
                  <FileUploadOrUrl
                    name={`resumeFile_${i}`}
                    placeholder="https://drive.google.com/..."
                    accept=".pdf,.doc,.docx"
                    onValueChange={v => updateResume(i, "fileValue", v)}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-ink mb-1">
                    Resume text * <span className="text-muted font-normal">(required for job matching)</span>
                  </label>
                  <textarea
                    name={`resumeText_${i}`}
                    value={resume.resumeText}
                    onChange={e => updateResume(i, "resumeText", e.target.value)}
                    placeholder="Paste the full resume text here. This is what the system uses to match jobs and score fit."
                    rows={5}
                    className="w-full rounded-md border border-line px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-brand/30 resize-y"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
        <p className="mt-1.5 text-xs text-muted">You can add more resumes after creating the client from the client detail page.</p>
      </div>

      {/* LinkedIn */}
      <div>
        <label className="block text-sm font-medium text-ink">LinkedIn URL <span className="text-muted font-normal">(optional)</span></label>
        <input name="linkedinUrl" placeholder="linkedin.com/in/yourname"
          className="mt-1 w-full rounded-md border border-line px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-brand/30" />
        <p className="mt-1 text-xs text-muted">https:// is added automatically if missing.</p>
      </div>

      {/* GitHub */}
      <div>
        <label className="block text-sm font-medium text-ink">GitHub URL <span className="text-muted font-normal">(optional)</span></label>
        <input name="githubUrl" placeholder="github.com/yourname"
          className="mt-1 w-full rounded-md border border-line px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-brand/30" />
        <p className="mt-1 text-xs text-muted">https:// is added automatically if missing.</p>
      </div>

      {/* Notes */}
      <div>
        <label className="block text-sm font-medium text-ink">
          Notes for your team <span className="text-muted font-normal">(shown on every job)</span>
        </label>
        <textarea name="applicationNotes"
          placeholder="e.g. Prioritize company career pages. Avoid roles requiring security clearance."
          rows={2}
          className="mt-1 w-full rounded-md border border-line px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-brand/30 resize-y" />
      </div>

      {/* Assign team member */}
      <div>
        <label className="block text-sm font-medium text-ink">Assign team member <span className="text-muted font-normal">(optional — can be done later)</span></label>
        <select name="teamMemberId"
          className="mt-1 w-full rounded-md border border-line px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-brand/30">
          <option value="">Unassigned for now</option>
          {teamMembers.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>
        <p className="mt-1 text-xs text-muted">You can assign or change the team member any time from the client profile page.</p>
      </div>

      {Object.keys(errors).length > 0 && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3">
          <p className="text-sm font-medium text-red-700">Please fix the errors above before continuing.</p>
        </div>
      )}

      <button type="submit" disabled={submitting}
        className="w-full rounded-md bg-brand px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand/90 transition-colors disabled:opacity-60">
        {submitting ? "Creating client profile…" : "Create client profile"}
      </button>
    </form>
  );
}
