"use client";

import { useState, useRef } from "react";
import { X, Plus } from "lucide-react";
import { TagInput } from "@/components/tag-input";
import { LocationPicker } from "@/components/location-picker";
import { FileUploadOrUrl } from "@/components/file-upload-or-url";

// Skill suggestions keyed by job title keywords
const SKILL_SUGGESTIONS: Record<string, string[]> = {
  "data engineer": ["Python", "SQL", "Spark", "Kafka", "Airflow", "dbt", "AWS", "GCP", "Azure", "BigQuery", "Snowflake", "Databricks", "ETL", "Hadoop", "Scala"],
  "data scientist": ["Python", "R", "SQL", "Machine Learning", "TensorFlow", "PyTorch", "Pandas", "NumPy", "Scikit-learn", "Statistics", "NLP", "Deep Learning", "Jupyter"],
  "data analyst": ["SQL", "Python", "Tableau", "Power BI", "Excel", "Looker", "Google Analytics", "A/B Testing", "Statistics", "Data Visualization", "dbt"],
  "software engineer": ["JavaScript", "TypeScript", "Python", "Java", "C++", "React", "Node.js", "AWS", "Docker", "Kubernetes", "Git", "REST APIs", "SQL", "NoSQL"],
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

interface ResumeSection {
  title: string;
  fileValue: string;
  resumeText: string;
}

interface AddClientFormProps {
  teamMembers: { id: string; name: string }[];
}

export function AddClientForm({ teamMembers }: AddClientFormProps) {
  const [targetTitles, setTargetTitles] = useState<string[]>([]);
  const [mainSkills, setMainSkills] = useState<string[]>([]);
  const [excludeKeywords, setExcludeKeywords] = useState<string[]>([]);
  const [resumes, setResumes] = useState<ResumeSection[]>([{ title: "", fileValue: "", resumeText: "" }]);
  const [skillInput, setSkillInput] = useState("");
  const [excludeInput, setExcludeInput] = useState("");

  const suggestedSkills = getSkillSuggestions(targetTitles).filter(s => !mainSkills.includes(s));

  function addSkill(skill: string) {
    if (!mainSkills.includes(skill)) setMainSkills(prev => [...prev, skill]);
  }

  function removeSkill(skill: string) {
    setMainSkills(prev => prev.filter(s => s !== skill));
  }

  function addExclude(kw: string) {
    if (!excludeKeywords.includes(kw)) setExcludeKeywords(prev => [...prev, kw]);
  }

  function removeExclude(kw: string) {
    setExcludeKeywords(prev => prev.filter(k => k !== kw));
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
  }

  return (
    <form action="/api/clients" method="post" className="space-y-5">

      {/* Basic info */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="block text-sm font-medium text-ink">Client full name *</label>
          <input name="clientName" required placeholder="e.g. Nadia Rahman"
            className="mt-1 w-full rounded-md border border-line px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-brand/30" />
        </div>
        <div>
          <label className="block text-sm font-medium text-ink">Current job title *</label>
          <input name="currentJobTitle" required placeholder="e.g. Senior Data Engineer"
            className="mt-1 w-full rounded-md border border-line px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-brand/30" />
        </div>
      </div>

      {/* Target titles — drives skill suggestions */}
      <div>
        <label className="block text-sm font-medium text-ink mb-1">
          Target job titles * <span className="text-muted font-normal">(3–4 titles, press Enter)</span>
        </label>
        <TagInput
          name="targetJobTitles"
          placeholder="e.g. Senior Data Engineer"
          required
          onTagsChange={setTargetTitles}
        />
        <p className="mt-1 text-xs text-muted">Skills suggestions below update based on these titles</p>
      </div>

      {/* Alternative titles */}
      <div>
        <label className="block text-sm font-medium text-ink mb-1">
          Alternative titles <span className="text-muted font-normal">(optional)</span>
        </label>
        <TagInput name="alternativeJobTitles" placeholder="e.g. ETL Developer, BI Engineer" />
      </div>

      {/* Main skills with suggestions */}
      <div>
        <label className="block text-sm font-medium text-ink mb-1">
          Main skills * <span className="text-muted font-normal">(used for job matching)</span>
        </label>
        {/* Hidden inputs for form submission */}
        <input type="hidden" name="mainSkills" value={mainSkills.join(", ")} />
        {mainSkills.length === 0 && (
          <input tabIndex={-1} aria-hidden required value="" onChange={() => {}}
            className="absolute h-0 w-0 opacity-0 pointer-events-none" />
        )}

        {/* Selected skills */}
        <div className="flex flex-wrap gap-1.5 rounded-md border border-line bg-white px-3 py-2 min-h-[42px] cursor-text"
          onClick={() => document.getElementById("skill-input")?.focus()}>
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
        <p className="mt-1 text-xs text-muted">Press Enter or comma to add · Click suggestions to add instantly</p>

        {/* Suggestions */}
        {suggestedSkills.length > 0 && (
          <div className="mt-2">
            <p className="text-xs text-muted mb-1.5">Suggested for {targetTitles[0] || "this role"}:</p>
            <div className="flex flex-wrap gap-1.5">
              {suggestedSkills.slice(0, 12).map(skill => (
                <button
                  key={skill}
                  type="button"
                  onClick={() => addSkill(skill)}
                  className="rounded-full border border-brand/30 bg-[#F0FAF7] px-2.5 py-0.5 text-xs font-medium text-[#186A5E] hover:bg-[#DFF5ED] hover:border-brand/60 transition-colors"
                >
                  + {skill}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Location */}
      <div>
        <label className="block text-sm font-medium text-ink mb-2">Job locations</label>
        <LocationPicker />
      </div>

      {/* Work mode & Employment type */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-ink">Work mode</label>
          <select name="workModePreference"
            className="mt-1 w-full rounded-md border border-line px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-brand/30">
            <option value="FLEXIBLE">Flexible</option>
            <option value="REMOTE">Remote only</option>
            <option value="HYBRID">Hybrid</option>
            <option value="ONSITE">Onsite</option>
          </select>
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
          <input type="number" name="minimumSalary" placeholder="130000"
            className="mt-1 w-full rounded-md border border-line px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-brand/30" />
        </div>
        <div>
          <label className="block text-sm font-medium text-ink">Max salary ($)</label>
          <input type="number" name="maximumSalary" placeholder="180000"
            className="mt-1 w-full rounded-md border border-line px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-brand/30" />
        </div>
      </div>

      {/* Exclude keywords with suggestions */}
      <div>
        <label className="block text-sm font-medium text-ink mb-1">
          Exclude keywords <span className="text-muted font-normal">(skip jobs containing these)</span>
        </label>
        <input type="hidden" name="keywordsExclude" value={excludeKeywords.join(", ")} />

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
            <button
              key={kw}
              type="button"
              onClick={() => addExclude(kw)}
              className="rounded-full border border-red-200 bg-red-50 px-2.5 py-0.5 text-xs font-medium text-red-700 hover:bg-red-100 transition-colors"
            >
              + {kw}
            </button>
          ))}
        </div>
      </div>

      {/* LinkedIn */}
      <div>
        <label className="block text-sm font-medium text-ink">LinkedIn URL</label>
        <input name="linkedinUrl" placeholder="https://linkedin.com/in/..."
          className="mt-1 w-full rounded-md border border-line px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-brand/30" />
      </div>

      {/* Resumes — up to 3, one per target title */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="block text-sm font-medium text-ink">
            Resumes <span className="text-muted font-normal">(up to 3 — one per target role)</span>
          </label>
          {resumes.length < 3 && (
            <button type="button" onClick={addResumeSection}
              className="inline-flex items-center gap-1 rounded-md border border-brand/40 bg-[#F0FAF7] px-2.5 py-1 text-xs font-medium text-[#186A5E] hover:bg-[#DFF5ED]">
              <Plus size={12} /> Add resume
            </button>
          )}
        </div>

        <div className="space-y-4">
          {resumes.map((resume, i) => (
            <div key={i} className="rounded-lg border border-line bg-canvas p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold uppercase tracking-wide text-muted">Resume {i + 1}</span>
                {resumes.length > 1 && (
                  <button type="button" onClick={() => removeResumeSection(i)}
                    className="text-xs text-red-500 hover:text-red-700">Remove</button>
                )}
              </div>

              {/* Hidden inputs for this resume */}
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
                    placeholder={`e.g. ${targetTitles[i] ? targetTitles[i] + " Resume" : "Data Engineer Resume"}`}
                    className="w-full rounded-md border border-line px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-brand/30"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-ink mb-1">File or URL</label>
                  <FileUploadOrUrl
                    name={`resumeFile_${i}`}
                    placeholder="https://drive.google.com/..."
                    accept=".pdf,.doc,.docx"
                    onValueChange={v => updateResume(i, "fileValue", v)}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-ink mb-1">
                    Resume text <span className="text-muted font-normal">(paste for AI job matching)</span>
                  </label>
                  <textarea
                    name={`resumeText_${i}`}
                    value={resume.resumeText}
                    onChange={e => updateResume(i, "resumeText", e.target.value)}
                    placeholder="Paste the full resume text here..."
                    rows={4}
                    className="w-full rounded-md border border-line px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-brand/30 resize-y"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
        <p className="mt-1.5 text-xs text-muted">At least one resume is recommended but not required. More can be added after creating the client.</p>
      </div>

      {/* CV text for matching (kept for backward compat — uses first resume text if blank) */}
      <div>
        <label className="block text-sm font-medium text-ink">
          CV text <span className="text-muted font-normal">(fallback for matching if no resume text above)</span>
        </label>
        <textarea
          name="cvText"
          placeholder="Optional — if you filled in resume text above, this field is not needed."
          rows={3}
          className="mt-1 w-full rounded-md border border-line px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-brand/30 resize-y"
        />
      </div>

      {/* Notes */}
      <div>
        <label className="block text-sm font-medium text-ink">
          Notes for your team <span className="text-muted font-normal">(shown on every job)</span>
        </label>
        <textarea
          name="applicationNotes"
          placeholder="e.g. Prioritize company career pages. Avoid roles requiring security clearance."
          rows={2}
          className="mt-1 w-full rounded-md border border-line px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-brand/30 resize-y"
        />
      </div>

      {/* Assign team member */}
      <div>
        <label className="block text-sm font-medium text-ink">Assign resource</label>
        <select name="teamMemberId"
          className="mt-1 w-full rounded-md border border-line px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-brand/30">
          <option value="">Unassigned for now</option>
          {teamMembers.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>
      </div>

      <button type="submit"
        className="w-full rounded-md bg-brand px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand/90 transition-colors">
        Create client profile
      </button>
    </form>
  );
}
