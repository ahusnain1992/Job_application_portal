import { describe, it, expect, vi, beforeEach } from "vitest";
import { WorkMode, EmploymentType } from "@prisma/client";

// ── RemoteOK ────────────────────────────────────────────────────────────────
describe("RemoteOKJobProvider", () => {
  beforeEach(() => { vi.restoreAllMocks(); });

  it("filters out metadata entry (first element has no position/company)", async () => {
    const mockData = [
      { legal: "CC BY-SA", attribution: "RemoteOK" }, // metadata row
      { id: "123", position: "Senior Python Developer", company: "Acme", url: "https://remoteok.com/jobs/123", tags: ["python", "django"], date: "2024-01-15T00:00:00Z" }
    ];
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => mockData }));
    const { RemoteOKJobProvider } = await import("../lib/job-providers/remoteok");
    const provider = new RemoteOKJobProvider();
    const jobs = await provider.fetchJobs({ titles: ["python"], locations: [], countries: [], remoteOnly: true, postedWithinDays: 7, excludeKeywords: [] });
    expect(jobs).toHaveLength(1);
    expect(jobs[0].title).toBe("Senior Python Developer");
    expect(jobs[0].workMode).toBe(WorkMode.REMOTE);
    expect(jobs[0].externalId).toBe("remoteok-123");
  });

  it("returns empty array on HTTP error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 429 }));
    const { RemoteOKJobProvider } = await import("../lib/job-providers/remoteok");
    const provider = new RemoteOKJobProvider();
    const jobs = await provider.fetchJobs({ titles: ["python"], locations: [], countries: [], remoteOnly: true, postedWithinDays: 7, excludeKeywords: [] });
    expect(jobs).toHaveLength(0);
  });

  it("skips jobs missing position or company", async () => {
    const mockData = [
      { id: "1", position: "Engineer", company: "Co", url: "https://remoteok.com/1" },
      { id: "2", position: "", company: "Co" },   // no position
      { id: "3", position: "Dev", company: "" },  // no company
    ];
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => mockData }));
    const { RemoteOKJobProvider } = await import("../lib/job-providers/remoteok");
    const jobs = await (new RemoteOKJobProvider()).fetchJobs({ titles: ["engineer"], locations: [], countries: [], remoteOnly: true, postedWithinDays: 7, excludeKeywords: [] });
    expect(jobs).toHaveLength(1);
  });
});

// ── Arbeitnow ────────────────────────────────────────────────────────────────
describe("ArbeitnowJobProvider", () => {
  beforeEach(() => { vi.restoreAllMocks(); });

  it("parses remote flag correctly", async () => {
    const mockData = {
      data: [
        { slug: "abc", title: "Data Engineer", company_name: "TechCo", location: "Berlin", remote: true, tags: ["python"], description: "Build pipelines", created_at: 1700000000, job_types: ["full_time"], url: "https://www.arbeitnow.com/jobs/abc" }
      ]
    };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => mockData }));
    const { ArbeitnowJobProvider } = await import("../lib/job-providers/arbeitnow");
    const jobs = await (new ArbeitnowJobProvider()).fetchJobs({ titles: ["data engineer"], locations: [], countries: [], remoteOnly: false, postedWithinDays: 7, excludeKeywords: [] });
    expect(jobs[0].workMode).toBe(WorkMode.REMOTE);
    expect(jobs[0].employmentType).toBe(EmploymentType.FULL_TIME);
    expect(jobs[0].externalId).toBe("arbeitnow-abc");
  });

  it("strips HTML from description", async () => {
    const mockData = {
      data: [{ slug: "x", title: "Dev", company_name: "Co", description: "<p>Hello <strong>world</strong></p>", remote: false, tags: [], created_at: 1700000000, job_types: [], url: "https://arbeitnow.com/x" }]
    };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => mockData }));
    const { ArbeitnowJobProvider } = await import("../lib/job-providers/arbeitnow");
    const jobs = await (new ArbeitnowJobProvider()).fetchJobs({ titles: ["dev"], locations: [], countries: [], remoteOnly: false, postedWithinDays: 7, excludeKeywords: [] });
    expect(jobs[0].description).not.toContain("<p>");
    expect(jobs[0].description).toContain("Hello");
  });
});

// ── Jobicy ───────────────────────────────────────────────────────────────────
describe("JobicyJobProvider", () => {
  beforeEach(() => { vi.restoreAllMocks(); });

  it("maps jobTag to requiredSkills", async () => {
    const mockData = {
      jobs: [{ id: 99, jobTitle: "Backend Engineer", companyName: "StartupX", jobGeo: "Worldwide", jobType: "full_time", jobTag: ["node.js", "postgres"], url: "https://jobicy.com/99" }]
    };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => mockData }));
    const { JobicyJobProvider } = await import("../lib/job-providers/jobicy");
    const jobs = await (new JobicyJobProvider()).fetchJobs({ titles: ["backend"], locations: [], countries: [], remoteOnly: true, postedWithinDays: 7, excludeKeywords: [] });
    expect(jobs[0].requiredSkills).toContain("node.js");
    expect(jobs[0].requiredSkills).toContain("postgres");
    expect(jobs[0].workMode).toBe(WorkMode.REMOTE);
  });
});

// ── TheMuse ──────────────────────────────────────────────────────────────────
describe("TheMuseJobProvider", () => {
  beforeEach(() => { vi.restoreAllMocks(); });

  it("detects remote work mode from location name", async () => {
    const mockData = {
      results: [{
        id: 1,
        name: "Software Engineer",
        company: { name: "BigCo" },
        locations: [{ name: "Flexible / Remote" }],
        refs: { landing_page: "https://themuse.com/jobs/1" },
        tags: [{ name: "Engineering" }],
        publication_date: "2024-01-10T00:00:00Z"
      }]
    };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => mockData }));
    const { TheMuseJobProvider } = await import("../lib/job-providers/themuse");
    const jobs = await (new TheMuseJobProvider()).fetchJobs({ titles: ["software engineer"], locations: [], countries: [], remoteOnly: false, postedWithinDays: 7, excludeKeywords: [] });
    expect(jobs[0].workMode).toBe(WorkMode.REMOTE);
    expect(jobs[0].externalId).toBe("themuse-1");
  });

  it("detects onsite when location has no remote keyword", async () => {
    const mockData = {
      results: [{ id: 2, name: "PM", company: { name: "Co" }, locations: [{ name: "New York, NY" }], refs: { landing_page: "https://themuse.com/2" }, tags: [], publication_date: null }]
    };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => mockData }));
    const { TheMuseJobProvider } = await import("../lib/job-providers/themuse");
    const jobs = await (new TheMuseJobProvider()).fetchJobs({ titles: ["pm"], locations: [], countries: [], remoteOnly: false, postedWithinDays: 7, excludeKeywords: [] });
    expect(jobs[0].workMode).toBe(WorkMode.ONSITE);
  });
});

// ── Himalayas ────────────────────────────────────────────────────────────────
describe("HimalayasJobProvider", () => {
  beforeEach(() => { vi.restoreAllMocks(); });

  it("joins locationRestrictions into location string", async () => {
    const mockData = {
      jobs: [{ id: "h1", slug: "data-eng-h1", title: "Data Engineer", companyName: "RemoteCo", locationRestrictions: ["USA", "Canada"], jobType: "full_time", description: "Build things", publishedAt: "2024-02-01T00:00:00Z", skills: ["python", "sql"], url: "https://himalayas.app/jobs/h1" }]
    };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => mockData }));
    const { HimalayasJobProvider } = await import("../lib/job-providers/himalayas");
    const jobs = await (new HimalayasJobProvider()).fetchJobs({ titles: ["data engineer"], locations: [], countries: [], remoteOnly: true, postedWithinDays: 7, excludeKeywords: [] });
    expect(jobs[0].location).toBe("USA, Canada");
    expect(jobs[0].workMode).toBe(WorkMode.REMOTE);
    expect(jobs[0].requiredSkills).toContain("python");
  });
});

// ── LinkedIn Easy Apply filter ────────────────────────────────────────────────
describe("LinkedInJobProvider Easy Apply filter", () => {
  beforeEach(() => { vi.restoreAllMocks(); });

  it("excludes jobs where easyApply is true", async () => {
    const mockItems = [
      { id: "1", title: "Engineer", companyName: "Co A", location: "Remote", easyApply: false, jobUrl: "https://coa.com/apply", applyUrl: "https://coa.com/apply" },
      { id: "2", title: "Developer", companyName: "Co B", location: "NYC", easyApply: true, jobUrl: "https://linkedin.com/jobs/2", applyUrl: "https://linkedin.com/jobs/apply/2" },
    ];
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => mockItems }));
    const { LinkedInJobProvider } = await import("../lib/job-providers/linkedin");
    const provider = new LinkedInJobProvider("fake-token");
    const jobs = await provider.fetchJobs({ titles: ["engineer"], locations: [], countries: [], remoteOnly: false, postedWithinDays: 7, excludeKeywords: [] });
    expect(jobs).toHaveLength(1);
    expect(jobs[0].companyName).toBe("Co A");
  });

  it("excludes jobs where applyUrl contains linkedin.com/jobs/apply", async () => {
    const mockItems = [
      { id: "3", title: "Analyst", companyName: "Co C", location: "Remote", easyApply: false, jobUrl: "https://linkedin.com/jobs/3", applyUrl: "https://linkedin.com/jobs/apply/3" },
    ];
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => mockItems }));
    const { LinkedInJobProvider } = await import("../lib/job-providers/linkedin");
    const jobs = await (new LinkedInJobProvider("fake-token")).fetchJobs({ titles: ["analyst"], locations: [], countries: [], remoteOnly: false, postedWithinDays: 7, excludeKeywords: [] });
    expect(jobs).toHaveLength(0);
  });

  it("keeps jobs that redirect to company portal", async () => {
    const mockItems = [
      { id: "4", title: "Staff Eng", companyName: "Stripe", location: "SF", easyApply: false, jobUrl: "https://stripe.com/jobs/4", applyUrl: "https://stripe.com/jobs/apply/4" },
    ];
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => mockItems }));
    const { LinkedInJobProvider } = await import("../lib/job-providers/linkedin");
    const jobs = await (new LinkedInJobProvider("fake-token")).fetchJobs({ titles: ["staff eng"], locations: [], countries: [], remoteOnly: false, postedWithinDays: 7, excludeKeywords: [] });
    expect(jobs).toHaveLength(1);
    expect(jobs[0].applyUrl).toBe("https://stripe.com/jobs/apply/4");
  });

  it("returns empty array when fetch fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network timeout")));
    const { LinkedInJobProvider } = await import("../lib/job-providers/linkedin");
    const jobs = await (new LinkedInJobProvider("fake-token")).fetchJobs({ titles: ["engineer"], locations: [], countries: [], remoteOnly: false, postedWithinDays: 7, excludeKeywords: [] });
    expect(jobs).toHaveLength(0);
  });

  it("returns empty array when APIFY token is missing", async () => {
    vi.stubGlobal("fetch", vi.fn());
    const { LinkedInJobProvider } = await import("../lib/job-providers/linkedin");
    const jobs = await (new LinkedInJobProvider("")).fetchJobs({ titles: ["engineer"], locations: [], countries: [], remoteOnly: false, postedWithinDays: 7, excludeKeywords: [] });
    expect(jobs).toHaveLength(0);
    expect(fetch).not.toHaveBeenCalled();
  });
});
