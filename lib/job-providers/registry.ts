import { AdzunaJobProvider } from "./adzuna";
import { LinkedInJobProvider } from "./linkedin";
import { IndeedJobProvider } from "./indeed";
import { GlassdoorJobProvider } from "./glassdoor";
import { RemotiveJobProvider } from "./remotive";
import { RemoteOKJobProvider } from "./remoteok";
import { ArbeitnowJobProvider } from "./arbeitnow";
import { JobicyJobProvider } from "./jobicy";
import { TheMuseJobProvider } from "./themuse";
import { HimalayasJobProvider } from "./himalayas";
import { JSearchJobProvider } from "./jsearch";
import { USAJobsProvider } from "./usajobs";
import { FindWorkJobProvider } from "./findwork";
import type { JobProvider } from "./types";

export type ProviderManifestEntry = {
  name: string;
  enabled: boolean;
  keyPresent: boolean;
  type: "free" | "paid" | "apify";
};

export function buildProviders(): JobProvider[] {
  const providers: JobProvider[] = [];

  // Free providers (no API key required)
  // Remotive & RemoteOK excluded — Remotive returns HTTP 526 (Cloudflare down),
  // RemoteOK returns 0 results (rate-limited). Re-enable when APIs stabilise.
  providers.push(new ArbeitnowJobProvider());
  providers.push(new JobicyJobProvider());
  providers.push(new TheMuseJobProvider());
  providers.push(new HimalayasJobProvider());

  // Adzuna — paid, reliable apply links
  if (process.env.ADZUNA_APP_ID && process.env.ADZUNA_APP_KEY) {
    providers.push(new AdzunaJobProvider({ appId: process.env.ADZUNA_APP_ID, appKey: process.env.ADZUNA_APP_KEY }));
  }

  // JSearch via RapidAPI
  if (process.env.JSEARCH_API_KEY) {
    providers.push(new JSearchJobProvider({ apiKey: process.env.JSEARCH_API_KEY }));
  }

  // USAJobs
  if (process.env.USAJOBS_API_KEY) {
    providers.push(new USAJobsProvider());
  }

  // FindWork
  if (process.env.FINDWORK_API_KEY) {
    providers.push(new FindWorkJobProvider());
  }

  // Apify-backed providers — LinkedIn, Indeed, Glassdoor
  const apifyToken = process.env.APIFY_API_TOKEN;
  if (apifyToken) {
    providers.push(new LinkedInJobProvider(apifyToken));
    providers.push(new IndeedJobProvider(apifyToken));
    providers.push(new GlassdoorJobProvider(apifyToken));
  }

  return providers;
}

export function getProviderManifest(): ProviderManifestEntry[] {
  const adzunaKey = !!(process.env.ADZUNA_APP_ID && process.env.ADZUNA_APP_KEY);
  const jsearchKey = !!process.env.JSEARCH_API_KEY;
  const usajobsKey = !!process.env.USAJOBS_API_KEY;
  const findworkKey = !!process.env.FINDWORK_API_KEY;
  const apifyKey = !!process.env.APIFY_API_TOKEN;

  return [
    { name: "Remotive",   enabled: false,       keyPresent: true,       type: "free" },
    { name: "RemoteOK",   enabled: false,       keyPresent: true,       type: "free" },
    { name: "Arbeitnow",  enabled: true,        keyPresent: true,       type: "free" },
    { name: "Jobicy",     enabled: true,        keyPresent: true,       type: "free" },
    { name: "TheMuse",    enabled: true,        keyPresent: true,       type: "free" },
    { name: "Himalayas",  enabled: true,        keyPresent: true,       type: "free" },
    { name: "Adzuna",     enabled: adzunaKey,   keyPresent: adzunaKey,  type: "paid" },
    { name: "JSearch",    enabled: jsearchKey,  keyPresent: jsearchKey, type: "paid" },
    { name: "USAJobs",    enabled: usajobsKey,  keyPresent: usajobsKey, type: "paid" },
    { name: "FindWork",   enabled: findworkKey, keyPresent: findworkKey,type: "paid" },
    { name: "LinkedIn",   enabled: apifyKey,    keyPresent: apifyKey,   type: "apify" },
    { name: "Indeed",     enabled: apifyKey,    keyPresent: apifyKey,   type: "apify" },
    { name: "Glassdoor",  enabled: apifyKey,    keyPresent: apifyKey,   type: "apify" },
  ];
}
