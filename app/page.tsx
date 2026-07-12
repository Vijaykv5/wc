"use client";

import { useEffect, useMemo, useState } from "react";

type SignalPhase = "queued" | "reading" | "confirmed" | "volatile" | "settled";
type RaidAction = "Strike" | "Shield" | "Charge";
type RaidMode = "replay" | "live";
type LoadState = "idle" | "loading" | "success" | "error";

type Fixture = {
  id: string;
  home: string;
  away: string;
  competition: string;
  status: string;
};

type Country = {
  code: string;
  name: string;
  flag: string;
  flagImage?: string;
  region: string;
};

type CountryApiRecord = {
  code?: string;
  cca2?: string;
  iso2?: string;
  name?:
    | {
    common?: string;
      }
    | string;
  flag?: string;
  flagImage?: string;
  unicodeFlag?: string;
  region?: string;
};

type RaidEvent = {
  tick: number;
  title: string;
  detail: string;
  phase: SignalPhase;
  correctAction: RaidAction;
  endpoint: string;
  oddsMove: number;
  scoreMove: number;
};

const fallbackCountries: Country[] = [
  { code: "US", name: "United States", flag: "🇺🇸", flagImage: "https://flags.restcountries.com/v5/svg/us.svg", region: "Americas" },
  { code: "MY", name: "Malaysia", flag: "🇲🇾", flagImage: "https://flags.restcountries.com/v5/svg/my.svg", region: "Asia" },
  { code: "AR", name: "Argentina", flag: "🇦🇷", flagImage: "https://flags.restcountries.com/v5/svg/ar.svg", region: "Americas" },
  { code: "BR", name: "Brazil", flag: "🇧🇷", flagImage: "https://flags.restcountries.com/v5/svg/br.svg", region: "Americas" },
  { code: "FR", name: "France", flag: "🇫🇷", flagImage: "https://flags.restcountries.com/v5/svg/fr.svg", region: "Europe" },
  { code: "JP", name: "Japan", flag: "🇯🇵", flagImage: "https://flags.restcountries.com/v5/svg/jp.svg", region: "Asia" },
  { code: "MA", name: "Morocco", flag: "🇲🇦", flagImage: "https://flags.restcountries.com/v5/svg/ma.svg", region: "Africa" },
  { code: "GB", name: "United Kingdom", flag: "🇬🇧", flagImage: "https://flags.restcountries.com/v5/svg/gb.svg", region: "Europe" },
  { code: "DE", name: "Germany", flag: "🇩🇪", flagImage: "https://flags.restcountries.com/v5/svg/de.svg", region: "Europe" },
  { code: "ES", name: "Spain", flag: "🇪🇸", flagImage: "https://flags.restcountries.com/v5/svg/es.svg", region: "Europe" },
  { code: "MX", name: "Mexico", flag: "🇲🇽", flagImage: "https://flags.restcountries.com/v5/svg/mx.svg", region: "Americas" },
  { code: "KR", name: "South Korea", flag: "🇰🇷", flagImage: "https://flags.restcountries.com/v5/svg/kr.svg", region: "Asia" },
];

const fallbackFixtures: Fixture[] = [
  {
    id: "1001",
    home: "Malaysia XI",
    away: "Argentina",
    competition: "World Cup Demo",
    status: "Replay ready",
  },
  {
    id: "1002",
    home: "Japan",
    away: "Brazil",
    competition: "World Cup Demo",
    status: "Replay ready",
  },
  {
    id: "1003",
    home: "Morocco",
    away: "France",
    competition: "World Cup Demo",
    status: "Replay ready",
  },
];

const raidScript: RaidEvent[] = [
  {
    tick: 0,
    title: "Fixture opened",
    detail: "TxLINE snapshot is live. Fans start with a clean read.",
    phase: "queued",
    correctAction: "Charge",
    endpoint: "/fixtures/snapshot",
    oddsMove: 4,
    scoreMove: 0,
  },
  {
    tick: 1,
    title: "Momentum window",
    detail: "A sharp movement creates a short skill window for the squad.",
    phase: "confirmed",
    correctAction: "Strike",
    endpoint: "/odds/updates/:fixtureId",
    oddsMove: 19,
    scoreMove: 0,
  },
  {
    tick: 2,
    title: "Noisy market",
    detail: "The move reverses quickly. The right play is to protect the streak.",
    phase: "volatile",
    correctAction: "Shield",
    endpoint: "/odds/snapshot/:fixtureId",
    oddsMove: -11,
    scoreMove: 0,
  },
  {
    tick: 3,
    title: "Score confirmed",
    detail: "A score update turns the crowd read into a high-value moment.",
    phase: "confirmed",
    correctAction: "Strike",
    endpoint: "/scores/updates/:fixtureId",
    oddsMove: 26,
    scoreMove: 1,
  },
  {
    tick: 4,
    title: "Pressure building",
    detail: "The data is positive, but not decisive. Bank energy for the final read.",
    phase: "reading",
    correctAction: "Charge",
    endpoint: "/scores/snapshot/:fixtureId",
    oddsMove: 7,
    scoreMove: 0,
  },
  {
    tick: 5,
    title: "Replay settled",
    detail: "Historical data confirms the outcome and closes the raid receipt.",
    phase: "settled",
    correctAction: "Strike",
    endpoint: "/scores/historical/:fixtureId",
    oddsMove: 31,
    scoreMove: 1,
  },
];

const phaseCopy: Record<SignalPhase, string> = {
  queued: "Queued",
  reading: "Reading",
  confirmed: "Confirmed",
  volatile: "Volatile",
  settled: "Settled",
};

const actionCopy: Record<RaidAction, { label: string; helper: string }> = {
  Strike: {
    label: "Strike",
    helper: "Act on a confirmed move",
  },
  Shield: {
    label: "Shield",
    helper: "Protect the streak",
  },
  Charge: {
    label: "Charge",
    helper: "Build crowd energy",
  },
};

const soccerPhaseRows = [
  ["NS", "1", "Not started"],
  ["H1", "2", "First half"],
  ["HT", "3", "Halftime"],
  ["H2", "4", "Second half"],
  ["F", "5", "Finished"],
  ["ET", "7-10", "Extra time states"],
  ["PE", "11-13", "Penalty shootout states"],
  ["P", "19", "Postponed"],
];

const soccerStatRows = [
  ["1-2", "Total goals"],
  ["3-4", "Yellow cards"],
  ["5-6", "Red cards"],
  ["7-8", "Corners"],
  ["1000", "First-half prefix"],
  ["3000", "Second-half prefix"],
];

const integratorNotes = [
  "Free coverage includes World Cup 2026 and international friendlies with real-time or 60-second delayed tiers.",
  "Hydration breaks arrive as comment actions, not dedicated stat keys.",
  "Offside is represented through free_kick with FreeKickType set to Offside.",
  "VAR and penalty outcomes are explicit enums for validation and replay logic.",
];

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function iso2ToFlag(code: string) {
  if (!/^[A-Z]{2}$/.test(code)) return "🏳️";

  return String.fromCodePoint(...code.split("").map((char) => 127397 + char.charCodeAt(0)));
}

function normalizeCountries(payload: unknown): Country[] {
  const records = Array.isArray(payload)
    ? payload
    : Array.isArray((payload as { countries?: unknown[] })?.countries)
      ? (payload as { countries: unknown[] }).countries
    : Array.isArray((payload as { data?: unknown[] })?.data)
      ? (payload as { data: unknown[] }).data
      : [];

  if (records.length === 0) return fallbackCountries;

  const countries = records
    .filter((record): record is CountryApiRecord => {
      return typeof record === "object" && record !== null;
    })
    .map((record) => {
      const name = typeof record.name === "string" ? record.name : record.name?.common;
      const code = record.code ?? record.iso2 ?? record.cca2 ?? name?.slice(0, 2).toUpperCase() ?? "XX";

      return {
        code,
        name: name ?? "Unknown country",
        flag: record.unicodeFlag || record.flag || iso2ToFlag(code),
        flagImage: record.flagImage,
        region: record.region ?? "Global",
      };
    })
    .filter((country) => country.name !== "Unknown country")
    .sort((a, b) => a.name.localeCompare(b.name));

  return countries.length > 0 ? countries : fallbackCountries;
}

function readText(record: Record<string, unknown>, keys: string[], fallback: string) {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value;
    if (typeof value === "number") return String(value);
  }

  return fallback;
}

function normalizeFixtures(payload: unknown): Fixture[] {
  const records = Array.isArray(payload)
    ? payload
    : Array.isArray((payload as { data?: unknown[] })?.data)
      ? (payload as { data: unknown[] }).data
      : [];

  return records
    .filter((record): record is Record<string, unknown> => {
      return typeof record === "object" && record !== null;
    })
    .slice(0, 8)
    .map((record, index) => {
      const id = readText(record, ["fixtureId", "id", "eventId", "matchId"], `${index + 1}`);
      return {
        id,
        home: readText(record, ["homeTeam", "home", "homeName", "team1"], "Home Side"),
        away: readText(record, ["awayTeam", "away", "awayName", "team2"], "Away Side"),
        competition: readText(
          record,
          ["competitionName", "competition", "leagueName", "tournament"],
          "World Cup",
        ),
        status: readText(record, ["status", "fixtureStatus", "state"], "TxLINE fixture"),
      };
    });
}

function ProgressBar({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "risk" | "signal" | "proof";
}) {
  const toneClass = {
    risk: "bg-rose-300",
    signal: "bg-cyan-300",
    proof: "bg-lime-300",
  }[tone];

  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-3 text-xs font-medium uppercase text-slate-400">
        <span>{label}</span>
        <span className="font-mono tabular-nums text-slate-300">{Math.round(value)}%</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-slate-800">
        <div
          className={`h-full rounded-full ${toneClass} motion-safe:transition-[width] motion-safe:duration-300 motion-safe:ease-out`}
          style={{ width: `${clamp(value, 0, 100)}%` }}
        />
      </div>
    </div>
  );
}

function Panel({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-lg border border-slate-800 bg-slate-900/70 ${className}`}>
      {children}
    </section>
  );
}

function CountryPicker({
  countries,
  onSelect,
}: {
  countries: Country[];
  onSelect: (country: Country) => void;
}) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [pickedIndex, setPickedIndex] = useState(0);
  const [failedFlagCodes, setFailedFlagCodes] = useState<string[]>([]);
  const activeCountry = countries[activeIndex] ?? fallbackCountries[0];
  const pickedCountry = countries[pickedIndex] ?? activeCountry;
  const canShowFlagImage = Boolean(activeCountry.flagImage && !failedFlagCodes.includes(activeCountry.code));

  function moveCountry(direction: "previous" | "next") {
    setActiveIndex((current) => {
      const nextIndex =
        direction === "previous"
          ? (current - 1 + countries.length) % countries.length
          : (current + 1) % countries.length;
      setPickedIndex(nextIndex);
      return nextIndex;
    });
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="site-backdrop" aria-hidden="true" />
      <section className="relative flex min-h-screen items-center justify-center px-4 py-10">
        <div className="w-full max-w-3xl rounded-[1.75rem] border border-slate-800 bg-slate-950/90 p-6 text-center shadow-2xl shadow-cyan-950/30 sm:p-10">
          <h1 className="text-3xl font-bold text-white sm:text-4xl">Who do you support?</h1>
          <div className="mt-10 flex items-center justify-between gap-4 sm:gap-8">
            <button
              type="button"
              onClick={() => moveCountry("previous")}
              className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full border border-slate-700 bg-slate-900 text-3xl font-medium text-slate-100 motion-safe:transition-colors hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 sm:h-20 sm:w-20"
              aria-label="Previous country"
            >
              ←
            </button>
            <button
              type="button"
              onClick={() => setPickedIndex(activeIndex)}
              className={`country-flag-button flex h-60 w-60 shrink-0 items-center justify-center rounded-full border text-9xl motion-safe:transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 sm:h-80 sm:w-80 sm:text-[10rem] ${
                pickedIndex === activeIndex
                  ? "border-cyan-300 bg-cyan-300/10"
                  : "border-slate-800 bg-slate-900"
              }`}
              aria-label={`Select ${activeCountry.name}`}
            >
              {canShowFlagImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={activeCountry.flagImage}
                  alt=""
                  className="country-flag-art"
                  onError={() => {
                    setFailedFlagCodes((codes) =>
                      codes.includes(activeCountry.code) ? codes : [...codes, activeCountry.code],
                    );
                  }}
                />
              ) : (
                <span className="country-flag-emoji" aria-hidden="true">
                  {activeCountry.flag}
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={() => moveCountry("next")}
              className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full border border-slate-700 bg-slate-900 text-3xl font-medium text-slate-100 motion-safe:transition-colors hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 sm:h-20 sm:w-20"
              aria-label="Next country"
            >
              →
            </button>
          </div>
          <button
            type="button"
            onClick={() => onSelect(pickedCountry)}
            className="mt-10 min-h-20 w-full rounded-xl bg-cyan-500 px-5 text-2xl font-medium text-white motion-safe:transition-colors hover:bg-cyan-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
          >
            Pick
          </button>
        </div>
      </section>
    </main>
  );
}

export default function Home() {
  const [showLoadscreen, setShowLoadscreen] = useState(true);
  const [loadProgress, setLoadProgress] = useState(0);
  const [countries, setCountries] = useState<Country[]>(fallbackCountries);
  const [selectedCountry, setSelectedCountry] = useState<Country | null>(null);
  const [fixtures, setFixtures] = useState<Fixture[]>(fallbackFixtures);
  const [fixtureState, setFixtureState] = useState<LoadState>("idle");
  const [fixtureError, setFixtureError] = useState("");
  const [selectedFixtureId, setSelectedFixtureId] = useState(fallbackFixtures[0].id);
  const [mode, setMode] = useState<RaidMode>("replay");
  const [tick, setTick] = useState(0);
  const [raidHealth, setRaidHealth] = useState(88);
  const [risk, setRisk] = useState(22);
  const [crowdEnergy, setCrowdEnergy] = useState(44);
  const [damage, setDamage] = useState(0);
  const [combo, setCombo] = useState(0);
  const [bestCombo, setBestCombo] = useState(0);
  const [actions, setActions] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [lockedAction, setLockedAction] = useState<RaidAction | null>(null);
  const [resultText, setResultText] = useState("Read the signal, then choose a squad action.");
  const [feed, setFeed] = useState<RaidEvent[]>([raidScript[0]]);
  const [proofState, setProofState] = useState<"idle" | "ready" | "issued">("idle");

  useEffect(() => {
    const progressTimer = window.setInterval(() => {
      setLoadProgress((value) => {
        if (value >= 100) return 100;
        return Math.min(value + 5, 100);
      });
    }, 90);

    return () => {
      window.clearInterval(progressTimer);
    };
  }, []);

  useEffect(() => {
    if (loadProgress < 100) return;

    const timer = window.setTimeout(() => {
      setShowLoadscreen(false);
    }, 260);

    return () => {
      window.clearTimeout(timer);
    };
  }, [loadProgress]);

  useEffect(() => {
    let cancelled = false;

    async function loadCountries() {
      try {
        const response = await fetch("/api/countries", {
          cache: "no-store",
        });
        if (!response.ok) throw new Error("Country API did not respond.");
        const payload = await response.json();
        if (cancelled) return;
        setCountries(normalizeCountries(payload));
      } catch {
        if (cancelled) return;
        setCountries(fallbackCountries);
      }
    }

    loadCountries();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadFixtures() {
      setFixtureState("loading");
      setFixtureError("");

      try {
        const response = await fetch("/api/txline/data/fixtures/snapshot", {
          cache: "no-store",
        });
        if (!response.ok) throw new Error("TxLINE fixture route returned an error.");
        const payload = await response.json();
        const normalized = normalizeFixtures(payload);
        if (cancelled) return;
        if (normalized.length > 0) {
          setFixtures(normalized);
          setSelectedFixtureId(normalized[0].id);
        }
        setFixtureState("success");
      } catch (error) {
        if (cancelled) return;
        setFixtureState("error");
        setFixtureError(error instanceof Error ? error.message : "Could not load TxLINE fixtures.");
      }
    }

    loadFixtures();

    return () => {
      cancelled = true;
    };
  }, []);

  const selectedFixture = useMemo(() => {
    return fixtures.find((fixture) => fixture.id === selectedFixtureId) ?? fixtures[0];
  }, [fixtures, selectedFixtureId]);

  const activeEvent = raidScript[tick % raidScript.length];
  const raidRank =
    damage > 420 ? "S-Rank Crowd Breaker" : damage > 260 ? "A-Rank Signal Reader" : "B-Rank Squad Starter";
  const accuracy = actions === 0 ? 0 : Math.round((correct / actions) * 100);
  const proofCode = `whispo://${selectedFixture.id}/${Math.round(damage)}-${accuracy}-${bestCombo}`;
  const statusText =
    fixtureState === "loading" ? "Syncing TxLINE" : fixtureState === "error" ? "Demo fallback" : "Live route ready";

  const stats = [
    ["Damage", Math.round(damage).toString()],
    ["Accuracy", `${accuracy}%`],
    ["Combo", `${combo}x`],
    ["Best", `${bestCombo}x`],
  ];

  function nextRaidEvent() {
    const nextTick = (tick + 1) % raidScript.length;
    const nextEvent = raidScript[nextTick];
    setTick(nextTick);
    setFeed((current) => [nextEvent, ...current].slice(0, 5));
    setLockedAction(null);
    setResultText("New TxLINE signal received. Choose the next squad action.");
    setProofState("ready");

    if (mode === "live") {
      fetch(`/api/txline/data/${nextEvent.endpoint.replace(":fixtureId", selectedFixture.id)}`, {
        cache: "no-store",
      }).catch(() => undefined);
    }
  }

  function chooseAction(action: RaidAction) {
    if (lockedAction) return;

    const fastBonus = Math.max(4, 18 - tick * 2);
    const isCorrect = action === activeEvent.correctAction;
    setLockedAction(action);
    setActions((value) => value + 1);

    if (isCorrect) {
      const hit = 44 + Math.abs(activeEvent.oddsMove) + activeEvent.scoreMove * 18 + combo * 6;
      setDamage((value) => value + hit);
      setRaidHealth((value) => clamp(value - hit / 8, 4, 100));
      setCrowdEnergy((value) => clamp(value + fastBonus, 0, 100));
      setRisk((value) => clamp(value - 10, 0, 100));
      setCombo((value) => {
        const nextCombo = value + 1;
        setBestCombo((best) => Math.max(best, nextCombo));
        return nextCombo;
      });
      setCorrect((value) => value + 1);
      setResultText(`${action} was the right read. The squad converted the live signal.`);
    } else {
      setRisk((value) => clamp(value + 18, 0, 100));
      setCrowdEnergy((value) => clamp(value - 8, 0, 100));
      setCombo(0);
      setResultText(`${action} was early. The app keeps the receipt but resets the streak.`);
    }
  }

  function resetRaid() {
    setTick(0);
    setRaidHealth(88);
    setRisk(22);
    setCrowdEnergy(44);
    setDamage(0);
    setCombo(0);
    setBestCombo(0);
    setActions(0);
    setCorrect(0);
    setLockedAction(null);
    setResultText("Read the signal, then choose a squad action.");
    setFeed([raidScript[0]]);
    setProofState("idle");
  }

  function issueProof() {
    setProofState("issued");
  }

  if (!showLoadscreen && !selectedCountry) {
    return (
      <CountryPicker
        countries={countries}
        onSelect={setSelectedCountry}
      />
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      {showLoadscreen ? (
        <section
          aria-label="Loading"
          aria-busy="true"
          className={`loadscreen fixed inset-0 z-50 flex min-h-screen items-center justify-center overflow-hidden px-6 motion-safe:transition-opacity motion-safe:duration-200 motion-safe:ease-out ${
            loadProgress >= 100 ? "opacity-0" : "opacity-100"
          }`}
        >
          <div className="loadscreen-data loadscreen-data-left" aria-hidden="true" />
          <div className="loadscreen-data loadscreen-data-left-low" aria-hidden="true" />
          <div className="loadscreen-data loadscreen-data-right" aria-hidden="true" />
          <div className="loadscreen-data loadscreen-data-right-low" aria-hidden="true" />
          <div className="relative z-10 w-full max-w-xl text-center">
            <p className="loadscreen-title text-sm font-bold uppercase text-white sm:text-base">
              Loading Whispo
            </p>
            <div
              className="loadscreen-bar mt-4 h-6 overflow-hidden rounded-md border border-slate-500/80 bg-slate-950/70 p-1"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={loadProgress}
            >
              <div
                className="loadscreen-bar-fill h-full rounded-sm"
                style={{ width: `${loadProgress}%` }}
              />
            </div>
            <p className="loadscreen-percent mt-4 font-mono text-lg font-bold text-cyan-100">
              {loadProgress}%
            </p>
          </div>
        </section>
      ) : null}

      <div className="site-backdrop" aria-hidden="true" />
      <div className="relative mx-auto flex min-h-screen w-full max-w-7xl flex-col px-4 py-5 sm:px-6 lg:px-8">
        <header className="flex flex-col gap-4 border-b border-slate-800 pb-5 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-md border border-cyan-300/35 bg-cyan-300/10 text-sm font-bold text-cyan-100">
              W
            </div>
            <div>
              <p className="text-base font-semibold text-white">Whispo</p>
              <p className="text-sm text-slate-400">
                {selectedCountry ? `${selectedCountry.flag} ${selectedCountry.name}` : "Live fan raids from TxLINE data"}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setSelectedCountry(null)}
              className="min-h-10 rounded-md border border-slate-700 bg-slate-900 px-4 text-sm font-semibold text-slate-200 motion-safe:transition-colors hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
            >
              Change country
            </button>
            {(["replay", "live"] as RaidMode[]).map((raidMode) => (
              <button
                key={raidMode}
                type="button"
                onClick={() => setMode(raidMode)}
                className={`min-h-10 rounded-md px-4 text-sm font-semibold capitalize motion-safe:transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 ${
                  mode === raidMode
                    ? "bg-cyan-300 text-slate-950"
                    : "bg-slate-900 text-slate-200 ring-1 ring-slate-700 hover:bg-slate-800"
                }`}
              >
                {raidMode}
              </button>
            ))}
          </div>
        </header>

        <section className="grid gap-6 py-8 lg:grid-cols-[1fr_440px] lg:items-stretch">
          <div className="flex flex-col justify-between rounded-lg border border-slate-800 bg-slate-900/55 p-6 sm:p-8">
            <div>
              <p className="text-sm font-semibold uppercase text-cyan-200">Hackathon build</p>
              <h1 className="mt-4 max-w-3xl text-4xl font-bold leading-tight text-white sm:text-5xl">
                Turn live soccer data into playable fan moments.
              </h1>
              <p className="mt-5 max-w-2xl text-base leading-7 text-slate-300">
                Whispo uses the TxLINE soccer feed for fixtures, score phases, stat keys,
                odds movement, and historical replay. Fans from {selectedCountry?.name ?? "their country"} read the
                match, make timed squad decisions, and create a proof-style raid receipt.
              </p>
            </div>
            <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {[
                ["Data", statusText],
                ["Country", selectedCountry ? selectedCountry.name : "Not selected"],
                ["Mode", `${mode} demo`],
                ["Proof", proofState === "issued" ? "Issued" : "Ready path"],
              ].map(([label, value]) => (
                <div key={label} className="rounded-md border border-slate-800 bg-slate-950/55 p-4">
                  <p className="text-xs font-semibold uppercase text-slate-500">{label}</p>
                  <p className="mt-2 text-sm font-semibold text-slate-100">{value}</p>
                </div>
              ))}
            </div>
          </div>

          <Panel className="p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-slate-400">{selectedFixture.competition}</p>
                <h2 className="mt-2 text-2xl font-bold text-white">
                  {selectedFixture.home} vs {selectedFixture.away}
                </h2>
              </div>
              <span className="rounded-md border border-cyan-300/30 bg-cyan-300/10 px-3 py-1 text-xs font-semibold text-cyan-100">
                {phaseCopy[activeEvent.phase]}
              </span>
            </div>

            <div className="mt-6 space-y-4">
              <ProgressBar label="Raid health" value={raidHealth} tone="signal" />
              <ProgressBar label="Crowd energy" value={crowdEnergy} tone="proof" />
              <ProgressBar label="Signal risk" value={risk} tone="risk" />
            </div>

            <div className="mt-6 rounded-lg border border-slate-800 bg-slate-950/60 p-4">
              <p className="text-xs font-semibold uppercase text-slate-500">Current signal</p>
              <h3 className="mt-2 text-xl font-bold text-white">{activeEvent.title}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-300">{activeEvent.detail}</p>
              <div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-400">
                <span className="rounded-md bg-slate-900 px-2 py-1 font-mono">{activeEvent.endpoint}</span>
                <span className="rounded-md bg-slate-900 px-2 py-1">
                  Odds {activeEvent.oddsMove > 0 ? "+" : ""}
                  {activeEvent.oddsMove}
                </span>
                <span className="rounded-md bg-slate-900 px-2 py-1">Score +{activeEvent.scoreMove}</span>
              </div>
            </div>
          </Panel>
        </section>

        <section className="grid flex-1 gap-5 pb-8 lg:grid-cols-[300px_1fr_330px]">
          <aside className="space-y-5">
            <Panel className="p-4">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-base font-bold text-white">Match queue</h2>
                <span className="rounded-md bg-slate-800 px-2 py-1 text-xs font-semibold text-slate-300">
                  {fixtures.length}
                </span>
              </div>
              {fixtureState === "loading" ? (
                <div className="mt-4 space-y-2" aria-label="Loading matches">
                  {[0, 1, 2].map((item) => (
                    <div key={item} className="h-16 rounded-md bg-slate-800/70" />
                  ))}
                </div>
              ) : fixtures.length === 0 ? (
                <div className="mt-4 rounded-md border border-slate-800 bg-slate-950/55 p-4 text-sm text-slate-300">
                  No fixtures returned yet. Replay mode is ready for the demo.
                </div>
              ) : (
                <div className="mt-4 space-y-2">
                  {fixtures.map((fixture) => (
                    <button
                      key={fixture.id}
                      type="button"
                      onClick={() => {
                        setSelectedFixtureId(fixture.id);
                        resetRaid();
                      }}
                      className={`w-full rounded-md p-3 text-left motion-safe:transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 ${
                        selectedFixtureId === fixture.id
                          ? "bg-cyan-300 text-slate-950"
                          : "bg-slate-950/55 text-slate-100 ring-1 ring-slate-800 hover:bg-slate-800"
                      }`}
                    >
                      <span className="block text-sm font-bold">
                        {fixture.home} vs {fixture.away}
                      </span>
                      <span className="mt-1 block text-xs opacity-75">
                        {fixture.competition} | {fixture.status}
                      </span>
                    </button>
                  ))}
                </div>
              )}
              {fixtureState === "error" ? (
                <div className="mt-4 rounded-md border border-amber-300/25 bg-amber-300/10 p-3 text-sm text-amber-100">
                  {fixtureError} Demo fixtures are active.
                </div>
              ) : null}
            </Panel>

            <Panel className="p-4">
              <h2 className="text-base font-bold text-white">Scoreboard</h2>
              <div className="mt-4 grid grid-cols-2 gap-3">
                {stats.map(([label, value]) => (
                  <div key={label} className="rounded-md border border-slate-800 bg-slate-950/55 p-3">
                    <p className="text-xs font-semibold uppercase text-slate-500">{label}</p>
                    <p className="mt-2 font-mono text-2xl font-bold tabular-nums text-white">{value}</p>
                  </div>
                ))}
              </div>
            </Panel>
          </aside>

          <Panel className="p-4 sm:p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="text-xl font-bold text-white">Squad decision</h2>
                <p className="mt-1 text-sm text-slate-400">
                  Pick the action that matches the current TxLINE signal.
                </p>
              </div>
              <button
                type="button"
                onClick={nextRaidEvent}
                className="min-h-10 rounded-md bg-white px-4 text-sm font-bold text-slate-950 motion-safe:transition-colors hover:bg-cyan-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
              >
                Next signal
              </button>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              {(["Strike", "Shield", "Charge"] as RaidAction[]).map((action) => (
                <button
                  key={action}
                  type="button"
                  disabled={Boolean(lockedAction)}
                  onClick={() => chooseAction(action)}
                  className={`min-h-24 rounded-lg border p-4 text-left motion-safe:transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 disabled:cursor-not-allowed ${
                    lockedAction === action
                      ? "border-lime-300 bg-lime-300 text-slate-950"
                      : "border-slate-800 bg-slate-950/55 text-slate-100 hover:border-cyan-300/50 hover:bg-slate-800 disabled:opacity-55"
                  }`}
                >
                  <span className="block text-base font-bold">{actionCopy[action].label}</span>
                  <span className="mt-2 block text-sm opacity-75">{actionCopy[action].helper}</span>
                </button>
              ))}
            </div>

            <div className="mt-5 rounded-md border border-slate-800 bg-slate-950/55 p-4">
              <p className="text-sm leading-6 text-slate-300">{resultText}</p>
            </div>

            <div className="mt-5">
              <h3 className="text-sm font-bold uppercase text-slate-400">Signal feed</h3>
              <div className="mt-3 space-y-3">
                {feed.map((event) => (
                  <div
                    key={`${event.tick}-${event.title}`}
                    className="grid gap-3 rounded-md border border-slate-800 bg-slate-950/45 p-3 sm:grid-cols-[1fr_auto]"
                  >
                    <div>
                      <p className="text-sm font-bold text-white">{event.title}</p>
                      <p className="mt-1 text-sm text-slate-400">{event.detail}</p>
                    </div>
                    <span className="self-start rounded-md bg-slate-900 px-2 py-1 text-xs font-semibold text-slate-300">
                      {phaseCopy[event.phase]}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </Panel>

          <aside className="space-y-5">
            <Panel className="p-4">
              <h2 className="text-base font-bold text-white">Raid receipt</h2>
              <div className="mt-4 space-y-3 text-sm text-slate-300">
                <p>
                  Rank: <span className="font-semibold text-cyan-100">{raidRank}</span>
                </p>
                <p>Current phase: {phaseCopy[activeEvent.phase]}</p>
                <p>No betting, no custody, no odds recommendation.</p>
              </div>
              <button
                type="button"
                onClick={issueProof}
                className="mt-5 min-h-11 w-full rounded-md bg-lime-300 px-4 text-sm font-bold text-slate-950 motion-safe:transition-colors hover:bg-lime-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
              >
                Generate proof
              </button>
              <div className="mt-3 rounded-md border border-slate-800 bg-slate-950/55 p-3 text-xs leading-5 text-slate-400">
                {proofState === "issued"
                  ? `Proof issued: ${proofCode}`
                  : proofState === "ready"
                    ? "Proof is ready after this signal. Wallet transaction flow can plug in here."
                    : "Complete a few signals to prepare the proof path."}
              </div>
            </Panel>

            <Panel className="p-4">
              <h2 className="text-base font-bold text-white">Soccer feed reference</h2>
              <p className="mt-2 text-sm leading-6 text-slate-400">
                Built around TxLINE soccer phases, stat keys, and replay-safe integrator notes.
              </p>

              <div className="mt-4">
                <h3 className="text-xs font-bold uppercase text-slate-500">Phase encoding</h3>
                <div className="mt-2 overflow-hidden rounded-md border border-slate-800">
                  {soccerPhaseRows.map(([name, id, description]) => (
                    <div
                      key={`${name}-${id}`}
                      className="grid grid-cols-[3.5rem_4rem_1fr] border-b border-slate-800 px-3 py-2 text-xs text-slate-300 last:border-b-0"
                    >
                      <span className="font-mono font-bold text-cyan-100">{name}</span>
                      <span className="font-mono tabular-nums text-slate-400">{id}</span>
                      <span>{description}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-4">
                <h3 className="text-xs font-bold uppercase text-slate-500">Stat keys</h3>
                <div className="mt-2 grid gap-2">
                  {soccerStatRows.map(([key, label]) => (
                    <div
                      key={`${key}-${label}`}
                      className="flex items-center justify-between gap-3 rounded-md border border-slate-800 bg-slate-950/55 px-3 py-2 text-xs"
                    >
                      <span className="text-slate-300">{label}</span>
                      <span className="font-mono font-bold text-cyan-100">{key}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-4 space-y-3 text-sm text-slate-300">
                {integratorNotes.map((item) => (
                  <div key={item} className="flex gap-3">
                    <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-cyan-300" aria-hidden="true" />
                    <p>{item}</p>
                  </div>
                ))}
              </div>
            </Panel>
          </aside>
        </section>
      </div>
    </main>
  );
}
