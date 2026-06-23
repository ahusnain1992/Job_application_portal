const STOP_WORDS = new Set([
  "senior", "junior", "lead", "principal", "staff", "the", "and", "for", "with",
  "engineer", "developer", "analyst", "manager", "specialist", "consultant",
]);

export function buildJobSearchQueries(input: {
  titles: string[];
  includeKeywords?: string[];
  max?: number;
}): string[] {
  const max = input.max ?? 5;
  const seen = new Set<string>();
  const queries: string[] = [];

  const add = (value: string) => {
    const normalized = value.replace(/\s+/g, " ").trim();
    if (normalized.length < 2) return;
    const key = normalized.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    queries.push(normalized);
  };

  for (const title of input.titles) add(title);

  for (const title of input.titles) {
    const domainWords = title
      .toLowerCase()
      .replace(/[^a-z0-9+#.\s-]/g, " ")
      .split(/\s+/)
      .filter((word) => word.length > 2 && !STOP_WORDS.has(word));

    if (domainWords.length) {
      add(domainWords.join(" "));
      add(`${domainWords[0]} engineer`);
    }
  }

  for (const keyword of input.includeKeywords ?? []) add(keyword);

  return queries.slice(0, max);
}

export function buildProviderTags(input: {
  titles: string[];
  includeKeywords?: string[];
  max?: number;
}): string[] {
  const tags = buildJobSearchQueries(input)
    .flatMap((query) => query.toLowerCase().split(/[\s,/|]+/))
    .map((term) => term.replace(/[^a-z0-9+#.]/g, ""))
    .filter((term) => term.length > 2 && !STOP_WORDS.has(term))
    .filter((term, index, all) => all.indexOf(term) === index)
    .slice(0, input.max ?? 5);

  if (tags.length > 0) return tags;

  return input.titles
    .map((title) => title.toLowerCase().replace(/[^a-z0-9+#.\s-]/g, " ").replace(/\s+/g, "-").trim())
    .filter(Boolean)
    .slice(0, input.max ?? 5);
}
