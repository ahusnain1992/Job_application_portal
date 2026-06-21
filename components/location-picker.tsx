"use client";

import { useState, useEffect } from "react";
import { Check, Globe } from "lucide-react";

// ── Location data ──────────────────────────────────────────────────────────
const COUNTRIES: { code: string; label: string; flag: string }[] = [
  { code: "USA", label: "United States", flag: "🇺🇸" },
  { code: "UK", label: "United Kingdom", flag: "🇬🇧" },
  { code: "Canada", label: "Canada", flag: "🇨🇦" },
  { code: "Australia", label: "Australia", flag: "🇦🇺" },
  { code: "Germany", label: "Germany", flag: "🇩🇪" },
];

const REGIONS: Record<string, { value: string; label: string }[]> = {
  USA: [
    { value: "Alabama", label: "Alabama" },
    { value: "Alaska", label: "Alaska" },
    { value: "Arizona", label: "Arizona" },
    { value: "Arkansas", label: "Arkansas" },
    { value: "California", label: "California" },
    { value: "Colorado", label: "Colorado" },
    { value: "Connecticut", label: "Connecticut" },
    { value: "Delaware", label: "Delaware" },
    { value: "Florida", label: "Florida" },
    { value: "Georgia", label: "Georgia" },
    { value: "Hawaii", label: "Hawaii" },
    { value: "Idaho", label: "Idaho" },
    { value: "Illinois", label: "Illinois" },
    { value: "Indiana", label: "Indiana" },
    { value: "Iowa", label: "Iowa" },
    { value: "Kansas", label: "Kansas" },
    { value: "Kentucky", label: "Kentucky" },
    { value: "Louisiana", label: "Louisiana" },
    { value: "Maine", label: "Maine" },
    { value: "Maryland", label: "Maryland" },
    { value: "Massachusetts", label: "Massachusetts" },
    { value: "Michigan", label: "Michigan" },
    { value: "Minnesota", label: "Minnesota" },
    { value: "Mississippi", label: "Mississippi" },
    { value: "Missouri", label: "Missouri" },
    { value: "Montana", label: "Montana" },
    { value: "Nebraska", label: "Nebraska" },
    { value: "Nevada", label: "Nevada" },
    { value: "New Hampshire", label: "New Hampshire" },
    { value: "New Jersey", label: "New Jersey" },
    { value: "New Mexico", label: "New Mexico" },
    { value: "New York", label: "New York" },
    { value: "North Carolina", label: "North Carolina" },
    { value: "North Dakota", label: "North Dakota" },
    { value: "Ohio", label: "Ohio" },
    { value: "Oklahoma", label: "Oklahoma" },
    { value: "Oregon", label: "Oregon" },
    { value: "Pennsylvania", label: "Pennsylvania" },
    { value: "Rhode Island", label: "Rhode Island" },
    { value: "South Carolina", label: "South Carolina" },
    { value: "South Dakota", label: "South Dakota" },
    { value: "Tennessee", label: "Tennessee" },
    { value: "Texas", label: "Texas" },
    { value: "Utah", label: "Utah" },
    { value: "Vermont", label: "Vermont" },
    { value: "Virginia", label: "Virginia" },
    { value: "Washington", label: "Washington" },
    { value: "West Virginia", label: "West Virginia" },
    { value: "Wisconsin", label: "Wisconsin" },
    { value: "Wyoming", label: "Wyoming" },
  ],
  UK: [
    { value: "London", label: "London" },
    { value: "Manchester", label: "Manchester" },
    { value: "Birmingham", label: "Birmingham" },
    { value: "Leeds", label: "Leeds" },
    { value: "Glasgow", label: "Glasgow" },
    { value: "Edinburgh", label: "Edinburgh" },
    { value: "Bristol", label: "Bristol" },
    { value: "Liverpool", label: "Liverpool" },
    { value: "Sheffield", label: "Sheffield" },
    { value: "Newcastle", label: "Newcastle" },
    { value: "Cardiff", label: "Cardiff" },
    { value: "Belfast", label: "Belfast" },
    { value: "Nottingham", label: "Nottingham" },
    { value: "Leicester", label: "Leicester" },
    { value: "Coventry", label: "Coventry" },
  ],
  Canada: [
    { value: "Alberta", label: "Alberta" },
    { value: "British Columbia", label: "British Columbia" },
    { value: "Manitoba", label: "Manitoba" },
    { value: "New Brunswick", label: "New Brunswick" },
    { value: "Newfoundland", label: "Newfoundland & Labrador" },
    { value: "Nova Scotia", label: "Nova Scotia" },
    { value: "Ontario", label: "Ontario" },
    { value: "Prince Edward Island", label: "Prince Edward Island" },
    { value: "Quebec", label: "Quebec" },
    { value: "Saskatchewan", label: "Saskatchewan" },
  ],
  Australia: [
    { value: "New South Wales", label: "New South Wales" },
    { value: "Victoria", label: "Victoria" },
    { value: "Queensland", label: "Queensland" },
    { value: "Western Australia", label: "Western Australia" },
    { value: "South Australia", label: "South Australia" },
    { value: "Tasmania", label: "Tasmania" },
    { value: "ACT", label: "ACT (Canberra)" },
    { value: "Northern Territory", label: "Northern Territory" },
  ],
  Germany: [
    { value: "Berlin", label: "Berlin" },
    { value: "Hamburg", label: "Hamburg" },
    { value: "Munich", label: "Munich" },
    { value: "Cologne", label: "Cologne" },
    { value: "Frankfurt", label: "Frankfurt" },
    { value: "Stuttgart", label: "Stuttgart" },
    { value: "Düsseldorf", label: "Düsseldorf" },
    { value: "Dortmund", label: "Dortmund" },
    { value: "Essen", label: "Essen" },
    { value: "Leipzig", label: "Leipzig" },
    { value: "Bavaria", label: "Bavaria" },
    { value: "North Rhine-Westphalia", label: "North Rhine-Westphalia" },
  ],
};

// ── Types ───────────────────────────────────────────────────────────────────
type Selection = {
  countries: string[];         // e.g. ["USA", "UK"]
  regions: string[];           // e.g. ["Illinois", "London"]
  includeRemote: boolean;
};

function parseInitial(
  countries: string[],
  cities: string[],
  locations: string[]
): Selection {
  const allText = [...countries, ...cities, ...locations].map((s) => s.toLowerCase());
  const includeRemote = allText.some((s) => s.includes("remote") || s.includes("worldwide"));

  const knownCountries = COUNTRIES.map((c) => c.code);
  const selectedCountries = countries.filter((c) => knownCountries.includes(c));

  const allRegions = Object.values(REGIONS).flat().map((r) => r.value);
  const selectedRegions = cities.filter((c) => allRegions.includes(c));

  return { countries: selectedCountries, regions: selectedRegions, includeRemote };
}

// ── Component ───────────────────────────────────────────────────────────────
export function LocationPicker({
  defaultCountries = [],
  defaultCities = [],
  defaultLocations = [],
}: {
  defaultCountries?: string[];
  defaultCities?: string[];
  defaultLocations?: string[];
}) {
  const [sel, setSel] = useState<Selection>(() =>
    parseInitial(defaultCountries, defaultCities, defaultLocations)
  );
  const [activeCountry, setActiveCountry] = useState<string | null>(
    sel.countries[0] ?? null
  );

  // ── Derived hidden-input values ──────────────────────────────────────────
  const countriesValue = sel.countries.join(", ");
  const citiesValue = sel.regions.join(", ");
  const locationsValue = sel.includeRemote ? "Remote" : "";

  // ── Helpers ──────────────────────────────────────────────────────────────
  function toggleCountry(code: string) {
    setSel((prev) => {
      const has = prev.countries.includes(code);
      const countries = has
        ? prev.countries.filter((c) => c !== code)
        : [...prev.countries, code];
      // If deselecting, also remove that country's regions
      const regions = has
        ? prev.regions.filter((r) => !REGIONS[code]?.some((region) => region.value === r))
        : prev.regions;
      return { ...prev, countries, regions };
    });
    if (!sel.countries.includes(code)) setActiveCountry(code);
  }

  function toggleRegion(region: string) {
    setSel((prev) => ({
      ...prev,
      regions: prev.regions.includes(region)
        ? prev.regions.filter((r) => r !== region)
        : [...prev.regions, region],
    }));
  }

  function selectAllRegions(countryCode: string) {
    const all = REGIONS[countryCode]?.map((r) => r.value) ?? [];
    const others = sel.regions.filter((r) => !all.includes(r));
    const already = all.every((r) => sel.regions.includes(r));
    setSel((prev) => ({
      ...prev,
      regions: already ? others : [...others, ...all],
    }));
  }

  function regionsForCountry(code: string) {
    return REGIONS[code] ?? [];
  }

  const activeRegions = activeCountry ? regionsForCountry(activeCountry) : [];
  const selectedInActive = activeCountry
    ? sel.regions.filter((r) => activeRegions.some((ar) => ar.value === r))
    : [];
  const allSelectedInActive =
    activeRegions.length > 0 && selectedInActive.length === activeRegions.length;

  // ── Summary label ─────────────────────────────────────────────────────────
  const parts: string[] = [];
  if (sel.includeRemote) parts.push("Remote");
  for (const c of sel.countries) {
    const inCountry = sel.regions.filter((r) =>
      REGIONS[c]?.some((ar) => ar.value === r)
    );
    const total = REGIONS[c]?.length ?? 0;
    if (inCountry.length === 0 || inCountry.length === total) {
      parts.push(`${c} (all)`);
    } else {
      parts.push(`${c}: ${inCountry.slice(0, 3).join(", ")}${inCountry.length > 3 ? ` +${inCountry.length - 3}` : ""}`);
    }
  }
  const summary = parts.length ? parts.join(" · ") : "No locations selected";

  return (
    <div className="space-y-4">
      {/* Hidden inputs that the form reads */}
      <input type="hidden" name="preferredCountries" value={countriesValue} />
      <input type="hidden" name="preferredCities" value={citiesValue} />
      <input type="hidden" name="preferredLocations" value={locationsValue} />

      {/* Remote toggle */}
      <label className="flex cursor-pointer items-center gap-3">
        <div
          onClick={() => setSel((p) => ({ ...p, includeRemote: !p.includeRemote }))}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
            sel.includeRemote ? "bg-brand" : "bg-line"
          }`}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
              sel.includeRemote ? "translate-x-6" : "translate-x-1"
            }`}
          />
        </div>
        <span className="text-sm font-medium text-ink flex items-center gap-1.5">
          <Globe size={14} className="text-muted" />
          Include remote / worldwide jobs
        </span>
      </label>

      {/* Country selector */}
      <div>
        <p className="mb-2 text-xs font-medium text-muted uppercase tracking-wide">Countries</p>
        <div className="flex flex-wrap gap-2">
          {COUNTRIES.map((c) => {
            const isSelected = sel.countries.includes(c.code);
            return (
              <button
                key={c.code}
                type="button"
                onClick={() => toggleCountry(c.code)}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                  isSelected
                    ? "border-brand bg-brand text-white"
                    : "border-line bg-white text-ink hover:border-brand/40 hover:bg-canvas"
                }`}
              >
                <span>{c.flag}</span>
                {c.label}
                {isSelected && <Check size={11} />}
              </button>
            );
          })}
        </div>
      </div>

      {/* State / region picker — only when at least one country is selected */}
      {sel.countries.length > 0 && (
        <div className="rounded-lg border border-line bg-canvas">
          {/* Country tab bar */}
          <div className="flex border-b border-line">
            {sel.countries.map((code) => {
              const country = COUNTRIES.find((c) => c.code === code)!;
              return (
                <button
                  key={code}
                  type="button"
                  onClick={() => setActiveCountry(code)}
                  className={`px-4 py-2 text-xs font-medium transition-colors ${
                    activeCountry === code
                      ? "border-b-2 border-brand text-brand bg-white"
                      : "text-muted hover:text-ink"
                  }`}
                >
                  {country.flag} {country.label}
                </button>
              );
            })}
          </div>

          {/* Region grid */}
          {activeCountry && (
            <div className="p-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs text-muted">
                  {selectedInActive.length} of {activeRegions.length} selected
                </span>
                <button
                  type="button"
                  onClick={() => selectAllRegions(activeCountry)}
                  className="text-xs font-medium text-brand hover:underline"
                >
                  {allSelectedInActive ? "Deselect all" : "Select all"}
                </button>
              </div>
              <div className="grid grid-cols-2 gap-1 sm:grid-cols-3 max-h-48 overflow-y-auto">
                {activeRegions.map((region) => {
                  const checked = sel.regions.includes(region.value);
                  return (
                    <label
                      key={region.value}
                      className={`flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-xs transition-colors ${
                        checked ? "bg-brand/10 text-brand font-medium" : "text-ink hover:bg-white"
                      }`}
                    >
                      <input
                        type="checkbox"
                        className="sr-only"
                        checked={checked}
                        onChange={() => toggleRegion(region.value)}
                      />
                      <span
                        className={`flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded border transition-colors ${
                          checked ? "border-brand bg-brand" : "border-line bg-white"
                        }`}
                      >
                        {checked && <Check size={9} className="text-white" />}
                      </span>
                      {region.label}
                    </label>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Summary pill */}
      <div className="rounded-md border border-line bg-white px-3 py-2 text-xs text-muted">
        <span className="font-medium text-ink">Selected: </span>{summary}
      </div>
    </div>
  );
}
