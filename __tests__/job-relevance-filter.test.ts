import { describe, expect, it } from "vitest";
import { WorkMode } from "@prisma/client";
import { isJobRelevant, type ClientForFilter, type NormalizedJobForFilter } from "../lib/job-filter";

const makeJob = (overrides: Partial<NormalizedJobForFilter>): NormalizedJobForFilter => ({
  title: "Senior Data Engineer",
  location: "Chicago, IL",
  workMode: WorkMode.ONSITE,
  ...overrides
});

const usaDataClient: ClientForFilter = {
  targetJobTitles: ["Senior Data Engineer", "Data Engineer"],
  alternativeJobTitles: ["Analytics Engineer", "ETL Developer"],
  preferredLocations: [],
  preferredCountries: ["USA"],
  preferredCities: ["Illinois"],
  workModePreference: WorkMode.HYBRID
};

describe("isJobRelevant — title filtering", () => {
  it("accepts matching target and alternative domain titles", () => {
    expect(isJobRelevant(makeJob({ title: "Senior Data Engineer" }), usaDataClient)).toBe(true);
    expect(isJobRelevant(makeJob({ title: "Analytics Engineer III" }), usaDataClient)).toBe(true);
    expect(isJobRelevant(makeJob({ title: "ETL Pipeline Developer" }), usaDataClient)).toBe(true);
  });

  it("rejects unrelated titles and generic role-word matches", () => {
    expect(isJobRelevant(makeJob({ title: "Marketing Manager" }), usaDataClient)).toBe(false);
    expect(isJobRelevant(makeJob({ title: "Electrical Engineer" }), usaDataClient)).toBe(false);
    expect(isJobRelevant(makeJob({ title: "Software Quality Assurance Analyst" }), usaDataClient)).toBe(false);
  });
});

describe("isJobRelevant — country and location filtering", () => {
  it("accepts USA city/state locations for a USA client", () => {
    expect(isJobRelevant(makeJob({ location: "Chicago, IL" }), usaDataClient)).toBe(true);
    expect(isJobRelevant(makeJob({ location: "Dallas, TX" }), { ...usaDataClient, preferredCities: [] })).toBe(true);
    expect(isJobRelevant(makeJob({ location: "New York, NY" }), { ...usaDataClient, preferredCities: [] })).toBe(true);
  });

  it("rejects non-USA locations for a USA-only client", () => {
    expect(isJobRelevant(makeJob({ location: "Berlin, Germany" }), usaDataClient)).toBe(false);
    expect(isJobRelevant(makeJob({ location: "Toronto, Canada" }), usaDataClient)).toBe(false);
    expect(isJobRelevant(makeJob({ location: "Amsterdam, NL", workMode: WorkMode.HYBRID }), usaDataClient)).toBe(false);
  });

  it("rejects generic worldwide remote jobs for a country-restricted client", () => {
    expect(isJobRelevant(makeJob({ location: "Worldwide", workMode: WorkMode.REMOTE }), usaDataClient)).toBe(false);
    expect(isJobRelevant(makeJob({ location: "Remote", workMode: WorkMode.REMOTE }), usaDataClient)).toBe(false);
  });

  it("accepts remote jobs with explicit matching country", () => {
    expect(isJobRelevant(makeJob({ location: "Remote, United States", workMode: WorkMode.REMOTE }), usaDataClient)).toBe(true);
    expect(isJobRelevant(makeJob({ location: "Remote / US", workMode: WorkMode.REMOTE }), usaDataClient)).toBe(true);
  });
});

describe("isJobRelevant — remote-only clients", () => {
  const remoteUsClient: ClientForFilter = {
    targetJobTitles: ["Data Engineer"],
    alternativeJobTitles: [],
    preferredLocations: [],
    preferredCountries: ["USA"],
    preferredCities: [],
    workModePreference: WorkMode.REMOTE
  };

  it("accepts USA remote and rejects onsite jobs", () => {
    expect(isJobRelevant(makeJob({ location: "Remote, USA", workMode: WorkMode.REMOTE }), remoteUsClient)).toBe(true);
    expect(isJobRelevant(makeJob({ location: "Chicago, IL", workMode: WorkMode.ONSITE }), remoteUsClient)).toBe(false);
  });

  it("rejects worldwide remote when a country is selected", () => {
    expect(isJobRelevant(makeJob({ location: "Worldwide", workMode: WorkMode.REMOTE }), remoteUsClient)).toBe(false);
  });

  it("allows worldwide remote only when no country or city preference exists", () => {
    const unrestrictedRemote: ClientForFilter = {
      ...remoteUsClient,
      preferredCountries: [],
      preferredCities: [],
      preferredLocations: []
    };
    expect(isJobRelevant(makeJob({ location: "Worldwide", workMode: WorkMode.REMOTE }), unrestrictedRemote)).toBe(true);
  });
});
