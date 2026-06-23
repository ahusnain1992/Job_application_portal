import { AdzunaJobProvider } from "./adzuna";
import { LinkedInJobProvider } from "./linkedin";
import { IndeedJobProvider } from "./indeed";
import { GlassdoorJobProvider } from "./glassdoor";
import type { JobProvider } from "./types";

export function buildProviders(): JobProvider[] {
  const providers: JobProvider[] = [];

  // Adzuna — paid, reliable apply links
  if (process.env.ADZUNA_APP_ID && process.env.ADZUNA_APP_KEY) {
    providers.push(new AdzunaJobProvider({ appId: process.env.ADZUNA_APP_ID, appKey: process.env.ADZUNA_APP_KEY }));
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
