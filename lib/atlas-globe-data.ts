export type AtlasMemory = {
  id: string;
  title: string;
  country: string;
  kind: string;
  creator?: string;
  txHash?: string;
  description?: string;
  imageCid?: string;
  imageDataUrl?: string;
  voiceDataUrl?: string;
  createdAt?: string;
  coordinates: {
    lat: number;
    lng: number;
  };
};

export type MemoryArc = {
  id: string;
  startLat: number;
  startLng: number;
  endLat: number;
  endLng: number;
  label: string;
};

export type CountryStats = {
  country: string;
  count: number;
  kinds: string[];
  coordinates: {
    lat: number;
    lng: number;
  };
};

export type CountryFanStats = {
  supporters: number;
  liveRooms: number;
};

type GeoFeature = {
  properties?: Record<string, unknown>;
};

export const COUNTRY_ALIASES: Record<string, string> = {
  america: "United States",
  "united states of america": "United States",
  us: "United States",
  usa: "United States",
  uk: "United Kingdom",
  britain: "United Kingdom",
  england: "United Kingdom",
  uae: "United Arab Emirates",
};

export const COUNTRY_COORDS: Record<string, { lat: number; lng: number }> = {
  Argentina: { lat: -34.6, lng: -58.4 },
  Australia: { lat: -33.9, lng: 151.2 },
  Brazil: { lat: -15.8, lng: -47.9 },
  Canada: { lat: 45.4, lng: -75.7 },
  France: { lat: 48.9, lng: 2.3 },
  Germany: { lat: 52.5, lng: 13.4 },
  India: { lat: 28.6, lng: 77.2 },
  Indonesia: { lat: -6.2, lng: 106.8 },
  Japan: { lat: 35.7, lng: 139.7 },
  Malaysia: { lat: 3.1, lng: 101.7 },
  Mexico: { lat: 19.4, lng: -99.1 },
  Morocco: { lat: 34, lng: -6.8 },
  Nigeria: { lat: 9.1, lng: 7.5 },
  Portugal: { lat: 38.7, lng: -9.1 },
  Qatar: { lat: 25.3, lng: 51.5 },
  Spain: { lat: 40.4, lng: -3.7 },
  "United Arab Emirates": { lat: 25.2, lng: 55.3 },
  "United Kingdom": { lat: 51.5, lng: -0.1 },
  "United States": { lat: 40.7, lng: -74 },
};

export const COUNTRY_FLAGS: Record<string, string> = {
  Argentina: "🇦🇷",
  Australia: "🇦🇺",
  Brazil: "🇧🇷",
  Canada: "🇨🇦",
  France: "🇫🇷",
  Germany: "🇩🇪",
  India: "🇮🇳",
  Indonesia: "🇮🇩",
  Japan: "🇯🇵",
  Malaysia: "🇲🇾",
  Mexico: "🇲🇽",
  Morocco: "🇲🇦",
  Nigeria: "🇳🇬",
  Portugal: "🇵🇹",
  Qatar: "🇶🇦",
  Spain: "🇪🇸",
  "United Arab Emirates": "🇦🇪",
  "United Kingdom": "🇬🇧",
  "United States": "🇺🇸",
};

const COUNTRY_LOOKUP = Object.fromEntries(
  Array.from(new Set([...Object.keys(COUNTRY_COORDS), ...Object.keys(COUNTRY_FLAGS)])).map((country) => [country.toLowerCase(), country]),
);

export const ATLAS_MEMORIES: AtlasMemory[] = [
  {
    id: "tokyo-blue-hour",
    title: "Blue hour chants before kickoff",
    country: "Japan",
    kind: "chant",
    creator: "0x8f...21a",
    description: "A watch party in Shibuya starts calling the first goal before the teams walk out.",
    coordinates: COUNTRY_COORDS.Japan,
    createdAt: "2026-07-10T18:20:00Z",
  },
  {
    id: "buenos-aires-counter",
    title: "Late counter sparks the city",
    country: "Argentina",
    kind: "reaction",
    creator: "0x3c...91d",
    description: "Buenos Aires pushes the room into a perfect streak after a stoppage-time break.",
    coordinates: COUNTRY_COORDS.Argentina,
    createdAt: "2026-07-12T22:06:00Z",
  },
  {
    id: "casablanca-pressure",
    title: "Pressure wave from Casablanca",
    country: "Morocco",
    kind: "prediction",
    description: "Prediction rooms across Morocco turn defensive pressure into a shared read.",
    coordinates: COUNTRY_COORDS.Morocco,
    createdAt: "2026-07-13T20:42:00Z",
  },
  {
    id: "sao-paulo-var",
    title: "VAR silence, then ignition",
    country: "Brazil",
    kind: "reaction",
    creator: "0x47...c3b",
    description: "A tense review flips into celebration and the globe catches the surge.",
    coordinates: COUNTRY_COORDS.Brazil,
    createdAt: "2026-07-14T01:12:00Z",
  },
  {
    id: "kl-night-room",
    title: "Kuala Lumpur late room",
    country: "Malaysia",
    kind: "story",
    description: "A midnight crowd keeps the room alive through penalties.",
    coordinates: COUNTRY_COORDS.Malaysia,
    createdAt: "2026-07-15T16:38:00Z",
  },
  {
    id: "lagos-goal-call",
    title: "Lagos calls the goal early",
    country: "Nigeria",
    kind: "prediction",
    creator: "0xa1...e90",
    description: "The room locks GOAL seconds before the feed catches up.",
    coordinates: COUNTRY_COORDS.Nigeria,
    createdAt: "2026-07-16T19:05:00Z",
  },
  {
    id: "nyc-match-room",
    title: "Five boroughs, one room",
    country: "United States",
    kind: "story",
    description: "Fans stitch a transatlantic final into one noisy archive.",
    coordinates: COUNTRY_COORDS["United States"],
    createdAt: "2026-07-17T03:45:00Z",
  },
];

export const MEMORY_ARCS: MemoryArc[] = [
  {
    id: "tokyo-kl",
    startLat: COUNTRY_COORDS.Japan.lat,
    startLng: COUNTRY_COORDS.Japan.lng,
    endLat: COUNTRY_COORDS.Malaysia.lat,
    endLng: COUNTRY_COORDS.Malaysia.lng,
    label: "Asia night rooms",
  },
  {
    id: "casablanca-buenos",
    startLat: COUNTRY_COORDS.Morocco.lat,
    startLng: COUNTRY_COORDS.Morocco.lng,
    endLat: COUNTRY_COORDS.Argentina.lat,
    endLng: COUNTRY_COORDS.Argentina.lng,
    label: "Prediction echo",
  },
  {
    id: "sao-paulo-lagos",
    startLat: COUNTRY_COORDS.Brazil.lat,
    startLng: COUNTRY_COORDS.Brazil.lng,
    endLat: COUNTRY_COORDS.Nigeria.lat,
    endLng: COUNTRY_COORDS.Nigeria.lng,
    label: "Reaction surge",
  },
];

export function normalizeCountry(country: string) {
  const cleaned = country.trim().replace(/\s+/g, " ");
  const alias = COUNTRY_ALIASES[cleaned.toLowerCase()];
  const canonicalCountry = COUNTRY_LOOKUP[cleaned.toLowerCase()];
  return alias ?? canonicalCountry ?? cleaned;
}

export function resolveAtlasCountrySearch(country: string) {
  const normalizedCountry = normalizeCountry(country);
  const lookupKey = normalizedCountry.toLowerCase();

  return COUNTRY_LOOKUP[lookupKey] ?? null;
}

function countrySeed(country: string) {
  return Array.from(country).reduce((seed, char) => seed + char.charCodeAt(0), 0);
}

export function getCountryFlag(country: string) {
  return COUNTRY_FLAGS[normalizeCountry(country)] ?? "⚽";
}

export function getCountryFanStats(country: string): CountryFanStats {
  const seed = countrySeed(normalizeCountry(country));

  return {
    supporters: 18_400 + ((seed * 137) % 72_000),
    liveRooms: 1 + (seed % 5),
  };
}

export function getGeoCountryName(feature: GeoFeature) {
  const properties = feature.properties ?? {};
  const name =
    properties.name ??
    properties.NAME ??
    properties.ADMIN ??
    properties.admin ??
    properties.country ??
    properties.COUNTRY;

  return typeof name === "string" ? normalizeCountry(name) : "Unknown";
}

export function getCountryStats(memories: AtlasMemory[]) {
  const stats = new Map<string, CountryStats>();

  for (const memory of memories) {
    const country = normalizeCountry(memory.country);
    const current = stats.get(country);

    if (current) {
      current.count += 1;
      if (!current.kinds.includes(memory.kind)) current.kinds.push(memory.kind);
      continue;
    }

    stats.set(country, {
      country,
      count: 1,
      kinds: [memory.kind],
      coordinates: memory.coordinates,
    });
  }

  return Array.from(stats.values()).sort((a, b) => b.count - a.count || a.country.localeCompare(b.country));
}
