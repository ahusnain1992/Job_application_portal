import { WorkMode } from "@prisma/client";

export type ClientForFilter = {
  targetJobTitles: string[];
  alternativeJobTitles: string[];
  preferredLocations: string[];
  preferredCountries: string[];
  preferredCities: string[];
  workModePreference: WorkMode;
};

export type NormalizedJobForFilter = {
  title: string;
  location: string;
  workMode: WorkMode;
};

// Comprehensive country → location keyword map
// Includes state abbreviations so "Chicago, IL" and "Dallas, TX" are recognized as USA
const COUNTRY_KEYWORDS: Record<string, string[]> = {
  usa: [
    "united states", "usa", ", us,", ", us ", " us ", "u.s.", "america",
    // US state abbreviations (covers "Chicago, IL", "Dallas, TX", etc.)
    ", al", ", ak", ", az", ", ar", ", ca", ", co", ", ct", ", de", ", fl",
    ", ga", ", hi", ", id", ", il", ", in", ", ia", ", ks", ", ky", ", la",
    ", me", ", md", ", ma", ", mi", ", mn", ", ms", ", mo", ", mt", ", ne",
    ", nv", ", nh", ", nj", ", nm", ", ny", ", nc", ", nd", ", oh", ", ok",
    ", or", ", pa", ", ri", ", sc", ", sd", ", tn", ", tx", ", ut", ", vt",
    ", va", ", wa", ", wv", ", wi", ", wy", ", dc",
    // Major US cities as fallback
    "new york", "los angeles", "chicago", "houston", "phoenix", "philadelphia",
    "san antonio", "san diego", "dallas", "san jose", "austin", "jacksonville",
    "fort worth", "columbus", "charlotte", "san francisco", "seattle", "denver",
    "nashville", "oklahoma city", "el paso", "washington", "boston", "las vegas",
    "portland", "memphis", "louisville", "baltimore", "milwaukee", "albuquerque",
    "tucson", "fresno", "sacramento", "mesa", "atlanta", "omaha", "colorado springs",
    "raleigh", "minneapolis", "miami", "cleveland", "tulsa", "tampa", "arlington",
    "new orleans", "wichita", "bakersfield", "aurora", "anaheim", "santa ana",
    "corpus christi", "riverside", "st. louis", "lexington", "pittsburgh",
    "stockton", "anchorage", "cincinnati", "st. paul", "greensboro", "toledo",
    "newark", "plano", "henderson", "lincoln", "buffalo", "jersey city",
    "chandler", "st. petersburg", "laredo", "norfolk", "madison", "durham",
    "lubbock", "winston-salem", "garland", "glendale", "hialeah", "reno",
    "baton rouge", "irvine", "chesapeake", "scottsdale", "north las vegas",
    "fremont", "gilbert", "san bernardino", "boise", "birmingham",
  ],
  "united states": ["united states", "usa", ", us", "u.s.", "america"],
  uk: [
    "united kingdom", "england", ", uk", "britain", "scotland", "wales",
    "london", "manchester", "birmingham", "leeds", "glasgow", "liverpool",
    "sheffield", "edinburgh", "bristol", "cardiff", "leicester", "coventry",
    "bradford", "nottingham", "newcastle",
  ],
  "united kingdom": [
    "united kingdom", "england", ", uk", "britain", "scotland", "wales",
    "london", "manchester", "birmingham",
  ],
  canada: [
    "canada", ", ca,", "ontario", "toronto", "vancouver", "calgary", "edmonton",
    "montreal", "ottawa", "winnipeg", "quebec", "british columbia", "alberta",
    "saskatchewan", "manitoba", "nova scotia", "new brunswick",
  ],
  australia: [
    "australia", "sydney", "melbourne", "brisbane", "perth", "adelaide",
    "gold coast", "newcastle", "canberra", "wollongong", "hobart",
  ],
  germany: [
    "germany", "deutschland", "berlin", "munich", "münchen", "frankfurt",
    "hamburg", "cologne", "köln", "düsseldorf", "stuttgart", "dortmund",
    "essen", "leipzig", "bremen", "hannover", "nuremberg", "nürnberg",
  ],
  india: [
    "india", "bangalore", "bengaluru", "mumbai", "hyderabad", "delhi",
    "pune", "chennai", "kolkata", "ahmedabad", "jaipur", "surat",
  ],
  ireland: ["ireland", "dublin", "cork", "galway", "limerick"],
  netherlands: ["netherlands", "amsterdam", "rotterdam", "the hague", "utrecht"],
  singapore: ["singapore"],
  "new zealand": ["new zealand", "auckland", "wellington", "christchurch"],
};

function matchesCountry(loc: string, country: string): boolean {
  const keywords = COUNTRY_KEYWORDS[country.toLowerCase()] ?? [country.toLowerCase()];
  return keywords.some((kw) => loc.includes(kw));
}

export function locationMatchesClient(
  jobLocation: string,
  client: ClientForFilter
): boolean {
  const loc = jobLocation.toLowerCase();
  const isRemoteLabel =
    loc.includes("remote") || loc.includes("worldwide") || loc.includes("anywhere");
  const hasCountryPrefs = client.preferredCountries.length > 0;
  const hasCityPrefs = client.preferredCities.length > 0;

  // True worldwide/no-location remote: only accept when client has no location preferences at all
  if (isRemoteLabel && !hasCountryPrefs && !hasCityPrefs && client.preferredLocations.length === 0) {
    return true;
  }

  // City-level match (most specific)
  if (hasCityPrefs) {
    const cityHit = client.preferredCities.some((city) =>
      city
        .toLowerCase()
        .split(/[\s,]+/)
        .filter((p) => p.length > 1)
        .some((p) => loc.includes(p))
    );
    if (cityHit) return true;
  }

  // Country-level match
  if (hasCountryPrefs) {
    const countryHit = client.preferredCountries.some((c) => matchesCountry(loc, c));
    if (countryHit) return true;
    // Truly generic "Remote" / "Worldwide" / "Anywhere" with no specific country mentioned
    // → accept for any client (they can work remotely from anywhere)
    if (loc === "remote" || loc === "worldwide" || loc === "anywhere" || loc === "global") return true;
    // Remote label with a specific country that didn't match → reject
    return false;
  }

  // Legacy free-text preferredLocations fallback
  if (client.preferredLocations.length > 0) {
    return client.preferredLocations.some((pref) => {
      const parts = pref.toLowerCase().split(/[\s,]+/).filter((p) => p.length > 1);
      return parts.some((p) => loc.includes(p));
    });
  }

  return false;
}

export function isJobRelevant(
  job: NormalizedJobForFilter,
  client: ClientForFilter
): boolean {
  // Title must match at least one significant word from client's target titles
  const allTitles = [...client.targetJobTitles, ...client.alternativeJobTitles];
  const jobTitleLower = job.title.toLowerCase();
  const STOP_WORDS = new Set(["and", "the", "for", "with", "of", "in", "at", "to"]);

  const titleMatch = allTitles.some((t) => {
    const words = t
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length > 2 && !STOP_WORDS.has(w));
    return words.some((w) => jobTitleLower.includes(w));
  });
  if (!titleMatch) return false;

  // Remote-only clients: job must be remote/flexible, then apply country filter
  if (client.workModePreference === WorkMode.REMOTE) {
    const locLower = job.location.toLowerCase();
    const isRemote =
      job.workMode === WorkMode.REMOTE ||
      job.workMode === WorkMode.FLEXIBLE ||
      locLower.includes("remote") ||
      locLower.includes("worldwide") ||
      locLower.includes("anywhere");
    if (!isRemote) return false;
    // If client has country prefs, accept generic "Remote"/"Worldwide" but reject
    // location-specific remote jobs from non-matching countries (e.g. "Remote, Brazil")
    if (client.preferredCountries.length > 0) {
      if (locLower === "remote" || locLower === "worldwide" || locLower === "anywhere" || locLower === "global") return true;
      return client.preferredCountries.some((c) => matchesCountry(locLower, c));
    }
    return true;
  }

  return locationMatchesClient(job.location, client);
}
