"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { type FormEvent, useEffect, useRef, useState } from "react";
import type { GlobeMethods } from "react-globe.gl";
import { ATLAS_MEMORIES, getCountryFanStats, getCountryFlag, normalizeCountry, resolveAtlasCountrySearch } from "@/lib/atlas-globe-data";
import { shortAddress, type MintedMemory } from "@/lib/memory-passport";
import { FaniqMusicButton } from "@/components/audio/FaniqMusicButton";
import { AtlasModeSwitch } from "@/components/globe/AtlasModeSwitch";
import { SolanaWalletButton } from "@/components/wallet/SolanaWalletButton";

const BuilderGlobe = dynamic(() => import("./BuilderGlobe"), {
  ssr: false,
  loading: () => <GlobeLoadingState />,
});

function GlobeLoadingState() {
  return (
    <div className="grid h-svh min-h-[640px] w-screen place-items-center bg-[#05070d] text-white">
      <div className="w-64 text-center">
        <p className="loadscreen-title">FANIQ</p>
        <div className="loadscreen-bar mt-4">
          <span className="loadscreen-bar-fill" />
        </div>
        <p className="loadscreen-percent mt-3">building globe</p>
      </div>
    </div>
  );
}

type CountryFixture = {
  id: string;
  home: string;
  away: string;
  competition: string;
  status: string;
  startTime?: number;
  homeScore: number | null;
  awayScore: number | null;
};

type CountryInsight = {
  country: string;
  flag: string;
  supporters: number;
  liveRooms: number;
  worldCupParticipant: boolean | null;
  nextMatch: CountryFixture | null;
  recent: CountryFixture[];
  upcoming: CountryFixture[];
  source: "txline" | "unavailable";
  error?: string;
};

function formatCompactNumber(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) return "--";
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1).replace(/\.0$/, "")}K`;
  return new Intl.NumberFormat("en-US").format(value);
}

function formatCountdown(startTime?: number) {
  if (!startTime) return "No match";
  const remaining = Math.max(0, startTime - Date.now());
  const hours = Math.floor(remaining / 3_600_000);
  const minutes = Math.floor((remaining % 3_600_000) / 60_000);
  const seconds = Math.floor((remaining % 60_000) / 1000);

  return [hours, minutes, seconds].map((part) => String(part).padStart(2, "0")).join(":");
}

function formatMatchTime(startTime?: number) {
  if (!startTime) return "Time TBA";

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(startTime));
}

function formatMemoryTime(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(new Date(value));
}

function matchScore(fixture: CountryFixture) {
  if (fixture.homeScore === null || fixture.awayScore === null) return fixture.status || "Scheduled";
  return `${fixture.homeScore}-${fixture.awayScore}`;
}

function insightFallback(country: string): CountryInsight {
  const normalizedCountry = normalizeCountry(country);
  const fanStats = getCountryFanStats(normalizedCountry);

  return {
    country: normalizedCountry,
    flag: getCountryFlag(normalizedCountry),
    supporters: fanStats.supporters,
    liveRooms: fanStats.liveRooms,
    worldCupParticipant: null,
    nextMatch: null,
    recent: [],
    upcoming: [],
    source: "unavailable",
  };
}

function FixtureRow({ fixture, tone }: { fixture: CountryFixture; tone: "recent" | "upcoming" }) {
  const canViewStory = tone === "recent" && fixture.homeScore !== null && fixture.awayScore !== null;

  return (
    <article className="rounded-xl border border-white/10 bg-white/[0.045] p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-black text-white">
            {fixture.home} <span className="text-white/38">vs</span> {fixture.away}
          </p>
          <p className="mt-1 truncate text-xs font-bold text-white/42">{fixture.competition}</p>
        </div>
        <span
          className={`shrink-0 rounded-full px-2 py-1 font-mono text-xs font-black tabular-nums ${
            tone === "recent" ? "bg-white text-black" : "bg-[#9B45FE]/24 text-[#e9d5ff]"
          }`}
        >
          {matchScore(fixture)}
        </span>
      </div>
      <div className="mt-3 flex items-center justify-between gap-3">
        <p className="font-mono text-xs font-bold tabular-nums text-white/48">{formatMatchTime(fixture.startTime)}</p>
        {canViewStory ? (
          <Link
            href={`/story/match/${encodeURIComponent(fixture.id)}`}
            className="inline-flex min-h-9 shrink-0 items-center rounded-full bg-[#f7b733] px-3 text-xs font-black text-black transition-colors hover:bg-[#fcd34d] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black"
          >
            View Story
          </Link>
        ) : null}
      </div>
    </article>
  );
}

function CountryInsightPanel({
  activeCountry,
  insight,
  loading,
  selected,
}: {
  activeCountry: string;
  insight: CountryInsight;
  loading: boolean;
  selected: boolean;
}) {
  const nextCountdown = formatCountdown(insight.nextMatch?.startTime);
  const dataUnavailable = insight.source === "unavailable";
  const hasNoWorldCupFixtures = insight.worldCupParticipant === false;
  const createMemoryHref = `/create/memory?country=${encodeURIComponent(activeCountry)}`;

  return (
    <aside className="pointer-events-auto fixed bottom-32 left-4 right-4 z-20 sm:left-auto sm:right-6 sm:w-[25rem] lg:right-8">
      <section className="rounded-2xl border border-white/12 bg-[#05070d]/62 p-4 shadow-2xl shadow-black/50 backdrop-blur-xl" aria-busy={loading}>
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-white/44">{selected ? "pinned country" : "hover country"}</p>
            <h2 className="mt-2 truncate text-2xl font-black uppercase leading-none text-white">
              {activeCountry} <span aria-hidden="true">{insight.flag}</span>
            </h2>
          </div>
          {selected ? (
            <Link
              href={createMemoryHref}
              title={`Create a fan memory for ${activeCountry}`}
              className="shrink-0 rounded-full bg-[#f7b733] px-3 py-2 text-xs font-black text-black transition-colors duration-100 hover:bg-[#fcd34d] active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black"
            >
              Mint Memory
            </Link>
          ) : null}
        </div>

        <div className="mt-5 grid grid-cols-3 gap-2">
          <div className="rounded-xl border border-white/10 bg-white/[0.045] p-3">
            <p className="font-mono text-lg font-black tabular-nums text-white">{formatCompactNumber(insight.supporters)}</p>
            <p className="mt-1 text-xs font-bold text-white/42">Supporters</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/[0.045] p-3">
            <p className="font-mono text-lg font-black tabular-nums text-white">{insight.liveRooms}</p>
            <p className="mt-1 text-xs font-bold text-white/42">Fan Rooms</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/[0.045] p-3">
            <p className="font-mono text-lg font-black tabular-nums text-white">{nextCountdown}</p>
            <p className="mt-1 text-xs font-bold text-white/42">Next Match</p>
          </div>
        </div>

        {loading ? (
          <div className="mt-4 grid gap-2">
            <div className="h-20 animate-pulse rounded-xl bg-white/[0.06]" />
            <div className="h-20 animate-pulse rounded-xl bg-white/[0.04]" />
          </div>
        ) : hasNoWorldCupFixtures ? (
          <div className="mt-4 rounded-xl border border-white/10 bg-white/[0.045] p-4">
            <p className="text-sm font-black text-white">This country has not participated in the World Cup 2026.</p>
          </div>
        ) : (
          <div className="mt-4 grid gap-4">
            <div>
              <div className="mb-2 flex items-center justify-between">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-white/42">Scheduled Matches</p>
              </div>
              <div className="grid gap-2">
                {insight.upcoming.length > 0 ? (
                  insight.upcoming.slice(0, 2).map((fixture) => <FixtureRow key={fixture.id} fixture={fixture} tone="upcoming" />)
                ) : (
                  <p className="rounded-xl border border-white/10 bg-white/[0.035] p-3 text-sm text-white/50">
                    {dataUnavailable ? "No live matches right now." : "No scheduled matches."}
                  </p>
                )}
              </div>
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-white/42">Previous Finished Matches</p>
              </div>
              <div className="grid gap-2">
                {insight.recent.length > 0 ? (
                  insight.recent.slice(0, 2).map((fixture) => <FixtureRow key={fixture.id} fixture={fixture} tone="recent" />)
                ) : (
                  <p className="rounded-xl border border-white/10 bg-white/[0.035] p-3 text-sm text-white/50">
                    No finished TxLINE-covered matches with scorelines.
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {insight.error ? <p className="mt-3 text-xs leading-5 text-white/38">{insight.error} Showing current fan activity only.</p> : null}
      </section>
    </aside>
  );
}

function CountryMemoryRail({
  country,
  memories,
  loading,
}: {
  country: string;
  memories: MintedMemory[];
  loading: boolean;
}) {
  if (!loading && memories.length === 0) return null;

  return (
    <aside className="pointer-events-auto fixed left-4 top-28 z-20 hidden w-[21rem] lg:block">
      <section className="rounded-2xl border border-white/12 bg-[#05070d]/66 p-3 shadow-2xl shadow-black/50 backdrop-blur-xl" aria-busy={loading}>
        <div className="flex items-center justify-between gap-3 px-1">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-[#f7b733]">Fan Memories</p>
            <h2 className="mt-1 truncate text-lg font-black uppercase text-white">
              {country} <span aria-hidden="true">{getCountryFlag(country)}</span>
            </h2>
          </div>
          {loading ? <span className="h-2 w-2 rounded-full bg-[#f7b733]" aria-hidden="true" /> : null}
        </div>

        {loading ? (
          <div className="mt-3 grid gap-2">
            <div className="h-24 animate-pulse rounded-xl bg-white/[0.06]" />
            <div className="h-24 animate-pulse rounded-xl bg-white/[0.04]" />
          </div>
        ) : (
          <div className="mt-3 grid max-h-[56vh] gap-2 overflow-auto pr-1">
            {memories.slice(0, 6).map((memory) => (
              <a
                key={memory.asset}
                href={memory.coreExplorerUrl || memory.explorerUrl}
                target="_blank"
                rel="noreferrer"
                className="grid grid-cols-[4.75rem_1fr] gap-3 rounded-xl border border-white/10 bg-white/[0.045] p-2 transition-colors duration-100 hover:bg-white/[0.075] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f7b733] focus-visible:ring-offset-2 focus-visible:ring-offset-black"
              >
                <div className="aspect-square overflow-hidden rounded-lg bg-white/[0.06]">
                  {memory.imageUri ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={memory.imageUri} alt="" className="h-full w-full object-cover" loading="lazy" />
                  ) : (
                    <div className="grid h-full w-full place-items-center text-2xl" aria-hidden="true">
                      {getCountryFlag(memory.country)}
                    </div>
                  )}
                </div>
                <div className="min-w-0 py-1">
                  <p className="line-clamp-1 text-sm font-black text-white">{memory.title}</p>
                  <p className="mt-1 line-clamp-2 text-xs font-bold leading-4 text-white/48">
                    {memory.note || `${shortAddress(memory.owner)} minted a fan celebration.`}
                  </p>
                  <p className="mt-2 font-mono text-[0.68rem] font-bold uppercase tracking-[0.08em] text-white/32">
                    {shortAddress(memory.owner, 3)} • {formatMemoryTime(memory.mintedAt)}
                  </p>
                </div>
              </a>
            ))}
          </div>
        )}
      </section>
    </aside>
  );
}

function AtlasCountrySearch({
  value,
  error,
  onChange,
  onSubmit,
}: {
  value: string;
  error: string | null;
  onChange: (value: string) => void;
  onSubmit: () => void;
}) {
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSubmit();
  }

  return (
    <form onSubmit={handleSubmit} className="pointer-events-auto fixed bottom-5 left-4 right-4 z-30 mx-auto max-w-[36rem]">
      <div className="rounded-[1.65rem] border border-white/12 bg-black/54 p-1.5 shadow-2xl shadow-black/50 backdrop-blur-xl ring-1 ring-black">
        <div className="flex min-h-12 items-center gap-2 rounded-[1.25rem] border border-white/8 bg-white/[0.035] px-4">
          <label htmlFor="atlas-country-search" className="sr-only">
            Search country
          </label>
          <input
            id="atlas-country-search"
            value={value}
            onChange={(event) => onChange(event.target.value)}
            autoComplete="country-name"
            placeholder="Search any country"
            className="h-10 min-w-0 flex-1 bg-transparent text-sm font-black text-white caret-white outline-none placeholder:text-white/34 sm:text-base"
          />
          <button
            type="submit"
            className="min-h-10 rounded-[1.1rem] bg-white/12 px-5 text-sm font-black text-white/62 transition-colors duration-100 hover:bg-white/18 hover:text-white active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black sm:px-7"
          >
            Search
          </button>
        </div>
      </div>
      {error ? <p className="mt-2 pl-5 text-sm font-bold text-white/54">{error}</p> : null}
    </form>
  );
}

export function GlobeExperience() {
  const globeRef = useRef<GlobeMethods | undefined>(undefined);
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null);
  const [hoveredCountry, setHoveredCountry] = useState<string | null>(null);
  const [searchValue, setSearchValue] = useState("");
  const [searchError, setSearchError] = useState<string | null>(null);
  const [insightCache, setInsightCache] = useState<Record<string, CountryInsight>>({});
  const [memoryCache, setMemoryCache] = useState<Record<string, MintedMemory[]>>({});
  const [loadingCountry, setLoadingCountry] = useState<string | null>(null);
  const [loadingMemoriesCountry, setLoadingMemoriesCountry] = useState<string | null>(null);
  const [, setClockTick] = useState(0);
  const activeCountry = hoveredCountry ?? selectedCountry ?? "Argentina";
  const activeInsight = insightCache[activeCountry] ?? insightFallback(activeCountry);
  const selectedCountryMemories = selectedCountry ? (memoryCache[selectedCountry] ?? []) : [];

  useEffect(() => {
    const timer = window.setInterval(() => setClockTick((tick) => tick + 1), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const country = activeCountry;

    if (insightCache[country]) return;

    async function loadCountryInsight() {
      setLoadingCountry(country);

      try {
        const response = await fetch(`/api/atlas/country?country=${encodeURIComponent(country)}`, {
          cache: "no-store",
        });
        if (!response.ok) throw new Error("Could not load country data.");
        const insight = (await response.json()) as CountryInsight;
        if (!cancelled) {
          setInsightCache((current) => ({
            ...current,
            [country]: insight,
          }));
        }
      } catch (error) {
        if (!cancelled) {
          setInsightCache((current) => ({
            ...current,
            [country]: {
              ...insightFallback(country),
              error: error instanceof Error ? error.message : "Country data unavailable.",
            },
          }));
        }
      } finally {
        if (!cancelled) setLoadingCountry(null);
      }
    }

    loadCountryInsight();

    return () => {
      cancelled = true;
    };
  }, [activeCountry, insightCache]);

  useEffect(() => {
    let cancelled = false;
    const countryName = selectedCountry;

    if (!countryName || memoryCache[countryName]) return;
    const memoryCountry = countryName;

    async function loadCountryMemories() {
      setLoadingMemoriesCountry(memoryCountry);

      try {
        const response = await fetch(`/api/profile/memories?country=${encodeURIComponent(memoryCountry)}`, {
          cache: "no-store",
        });
        if (!response.ok) throw new Error("Could not load country memories.");
        const payload = (await response.json()) as { memories: MintedMemory[] };
        if (!cancelled) {
          setMemoryCache((current) => ({
            ...current,
            [memoryCountry]: payload.memories,
          }));
        }
      } catch {
        if (!cancelled) {
          setMemoryCache((current) => ({
            ...current,
            [memoryCountry]: [],
          }));
        }
      } finally {
        if (!cancelled) setLoadingMemoriesCountry(null);
      }
    }

    loadCountryMemories();

    return () => {
      cancelled = true;
    };
  }, [selectedCountry, memoryCache]);

  function handleSearchSubmit() {
    const country = resolveAtlasCountrySearch(searchValue);
    if (!country) {
      setSearchError("Type a full country name, like Argentina.");
      return;
    }

    setSearchError(null);
    setHoveredCountry(null);
    setSelectedCountry(country);
    setSearchValue(country);
  }

  return (
    <main className="relative h-svh min-h-[640px] overflow-hidden bg-[#05070d] text-white">
      <div
        className="pointer-events-none absolute inset-0 z-10 bg-[radial-gradient(circle_at_50%_45%,rgba(155,69,254,0.1),transparent_30rem),linear-gradient(180deg,rgba(5,7,13,0.02),rgba(5,7,13,0.58))]"
        aria-hidden="true"
      />

      <BuilderGlobe
        globeRef={globeRef}
        memories={ATLAS_MEMORIES}
        highlightedCountry={selectedCountry}
        onCountryClick={setSelectedCountry}
        onCountryHover={setHoveredCountry}
      />

      <header className="pointer-events-auto fixed inset-x-0 top-0 z-30">
        <nav className="mx-auto flex min-h-16 w-full max-w-[92rem] items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link
            href="/"
            className="flex min-h-11 items-center gap-2 rounded-full border border-white/10 bg-black/20 px-3 backdrop-blur-md transition-colors duration-100 hover:bg-white/[0.06] active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d8b4fe] focus-visible:ring-offset-2 focus-visible:ring-offset-[#05070d]"
          >
            <span className="atlas-logo-mark" aria-hidden="true" />
            <span className="text-base font-black lowercase tracking-tight text-white">FANIQ</span>
          </Link>
          <div className="flex items-center gap-2">
            <FaniqMusicButton />
            <SolanaWalletButton />
          </div>
        </nav>
      </header>

      <AtlasModeSwitch mode="explore" />

      <CountryInsightPanel
        activeCountry={activeCountry}
        insight={activeInsight}
        loading={loadingCountry === activeCountry}
        selected={Boolean(selectedCountry && selectedCountry === activeCountry)}
      />

      {selectedCountry ? (
        <CountryMemoryRail country={selectedCountry} memories={selectedCountryMemories} loading={loadingMemoriesCountry === selectedCountry} />
      ) : null}

      <AtlasCountrySearch
        value={searchValue}
        error={searchError}
        onChange={(value) => {
          setSearchValue(value);
          if (searchError) setSearchError(null);
        }}
        onSubmit={handleSearchSubmit}
      />
    </main>
  );
}
