import { AdzunaJobProvider } from "./adzuna";
import { JSearchJobProvider } from "./jsearch";
import { RemotiveJobProvider } from "./remotive";
import { RemoteOKJobProvider } from "./remoteok";
import { ArbeitnowJobProvider } from "./arbeitnow";
import { JobicyJobProvider } from "./jobicy";
import { TheMuseJobProvider } from "./themuse";
import { HimalayasJobProvider } from "./himalayas";
import { USAJobsProvider } from "./usajobs";
import { FindWorkJobProvider } from "./findwork";
import { LinkedInJobProvider } from "./linkedin";
import { IndeedJobProvider } from "./indeed";
import { GlassdoorJobProvider } from "./glassdoor";
import type { JobProvider } from "./types";

export function buildProviders(): JobProvider[] {
  const providers: JobProvider[] = [];

  if (process.env.ADZUNA_APP_ID && process.env.ADZUNA_APP_KEY) {
    providers.push(new AdzunaJobProvider({ appId: process.env.ADZUNA_APP_ID, appKey: process.env.ADZUNA_APP_KEY }));
  }
  if (process.env.JSEARCH_API_KEY) {
    providers.push(new JSearchJobProvider({ apiKey: process.env.JSEARCH_API_KEY }));
  }

  // Free providers — always included, filtered post-fetch by location relevance
  providers.push(new RemotiveJobProvider());
  providers.push(new RemoteOKJobProvider());
  providers.push(new ArbeitnowJobProvider());
  providers.push(new JobicyJobProvider());
  providers.push(new TheMuseJobProvider());
  providers.push(new HimalayasJobProvider());

  if (process.env.USAJOBS_API_KEY) providers.push(new USAJobsProvider());
  if (process.env.FINDWORK_API_KEY) providers.push(new FindWorkJobProvider());

  const apifyToken = process.env.APIFY_API_TOKEN;
  if (apifyToken) {
    providers.push(new LinkedInJobProvider(apifyToken));
    providers.push(new IndeedJobProvider(apifyToken));
    providers.push(new GlassdoorJobProvider(apifyToken));
  }

  return providers;
}
