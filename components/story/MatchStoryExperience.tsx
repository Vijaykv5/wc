"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { SolanaWalletButton } from "@/components/wallet/SolanaWalletButton";

type MatchFixture = {
  id: string;
  home: string;
  away: string;
  homeScore: number | null;
  awayScore: number | null;
  status: string;
  competition: string;
  startTime?: number;
};

type TxLineRecord = Record<string, unknown>;

type CoverageBlock = {
  endpoint: string;
  label: string;
  records: TxLineRecord[];
  error: string | null;
};

type TimelineItem = {
  id: string;
  timestamp?: number;
  minute: number | null;
  label: string;
  eventType: "goal" | "yellow_card" | "red_card" | "substitution" | "injury" | "penalty" | "var" | "other";
  description: string;
  participant: number | null;
  teamName: string;
  phase: string;
  score: string;
  homeScore: number | null;
  awayScore: number | null;
  isMajorEvent: boolean;
  raw: TxLineRecord;
};

type MatchStatSummary = {
  goals: [number | null, number | null];
  yellowCards: [number | null, number | null];
  redCards: [number | null, number | null];
  corners: [number | null, number | null];
};

type IntervalSummary = {
  interval: string;
  minuteStart: number;
  minuteEnd: number;
  headline: string;
  summary: string;
  keyEvents: string[];
  score: string;
  tone: "quiet" | "pressure" | "turning-point" | "decisive" | "final";
  source: "openrouter" | "fallback";
};

type MatchDataPayload = {
  fixture: MatchFixture | null;
  coverage: CoverageBlock[];
  timeline: TimelineItem[];
  stats: MatchStatSummary;
  intervals: IntervalSummary[];
  source: "txline";
  error?: string;
};

function formatDate(value?: number) {
  if (!value) return "Time unavailable";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(new Date(value));
}

function scoreLabel(fixture: MatchFixture | null) {
  if (!fixture) return "--";
  if (fixture.homeScore === null || fixture.awayScore === null) return fixture.status || "No score";
  return `${fixture.homeScore}-${fixture.awayScore}`;
}

function statValue(value: number | null) {
  return value === null ? "--" : String(value);
}

function emptyStats(): MatchStatSummary {
  return {
    goals: [null, null],
    yellowCards: [null, null],
    redCards: [null, null],
    corners: [null, null],
  };
}

function normalizePayload(body: MatchDataPayload & { error?: string }): MatchDataPayload {
  return {
    fixture: body.fixture ?? null,
    coverage: Array.isArray(body.coverage)
      ? body.coverage.map((block) => ({
          endpoint: block.endpoint,
          label: block.label,
          records: Array.isArray(block.records) ? block.records : [],
          error: block.error ?? null,
        }))
      : [],
    timeline: Array.isArray(body.timeline) ? body.timeline : [],
    stats: body.stats ?? emptyStats(),
    intervals: Array.isArray(body.intervals) ? body.intervals : [],
    source: "txline",
    error: body.error,
  };
}

function DataSkeleton() {
  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_24rem]">
      <div className="grid gap-3">
        <div className="h-44 animate-pulse rounded-3xl border border-white/10 bg-white/[0.05]" />
        {Array.from({ length: 5 }).map((_, index) => (
          <div key={index} className="h-20 animate-pulse rounded-2xl border border-white/10 bg-white/[0.04]" />
        ))}
      </div>
      <div className="h-96 animate-pulse rounded-3xl border border-white/10 bg-white/[0.04]" />
    </div>
  );
}

function ScoreboardHero({ fixture, stats, totalRecords, timelineCount }: { fixture: MatchFixture | null; stats: MatchStatSummary; totalRecords: number; timelineCount: number }) {
  const statRows = [
    ["Goals", stats.goals],
    ["Yellow cards", stats.yellowCards],
    ["Red cards", stats.redCards],
    ["Corners", stats.corners],
  ] as const;

  return (
    <section className="relative overflow-hidden rounded-[1.75rem] border border-[#f7b733]/26 bg-[#05070d]/82 p-5 shadow-2xl shadow-black/50 backdrop-blur-xl">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(247,183,51,0.18),transparent_22rem),linear-gradient(135deg,rgba(255,255,255,0.06),transparent_38%)]" />
      <div className="relative grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.24em] text-[#f7b733]">{fixture?.competition ?? "TxLINE Fixture"}</p>
          <div className="mt-5 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
            <div className="min-w-0 text-right">
              <p className="truncate text-3xl font-black text-white sm:text-4xl">{fixture?.home ?? "Home"}</p>
            </div>
            <div className="rounded-2xl border border-white/12 bg-white px-4 py-3 text-center shadow-[0_0_50px_rgba(247,183,51,0.16)]">
              <p className="font-mono text-3xl font-black text-black sm:text-4xl">{scoreLabel(fixture)}</p>
            </div>
            <div className="min-w-0">
              <p className="truncate text-3xl font-black text-white sm:text-4xl">{fixture?.away ?? "Away"}</p>
            </div>
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            <span className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1.5 font-mono text-xs font-black text-white/62">
              Fixture {fixture?.id ?? "unknown"}
            </span>
            <span className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1.5 font-mono text-xs font-black text-white/62">
              {formatDate(fixture?.startTime)}
            </span>
            <span className="rounded-full border border-[#f7b733]/26 bg-[#f7b733]/12 px-3 py-1.5 text-xs font-black text-[#f7b733]">
              {totalRecords} TxLINE records
            </span>
            <span className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1.5 text-xs font-black text-white/62">
              {timelineCount} readable events
            </span>
          </div>
        </div>

        <div className="grid gap-2 rounded-2xl border border-white/10 bg-black/24 p-3">
          {statRows.map(([label, values]) => (
            <div key={label} className="grid grid-cols-[4rem_1fr_4rem] items-center gap-3 rounded-xl bg-white/[0.04] px-3 py-2">
              <p className="text-right font-mono text-lg font-black text-white">{statValue(values[0])}</p>
              <p className="text-center text-xs font-black uppercase tracking-[0.16em] text-white/46">{label}</p>
              <p className="font-mono text-lg font-black text-white">{statValue(values[1])}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function toneClass(tone: IntervalSummary["tone"]) {
  if (tone === "decisive") return "border-[#f7b733]/36 bg-[#f7b733]/14 text-[#f7b733]";
  if (tone === "turning-point") return "border-purple-300/28 bg-purple-400/12 text-purple-100";
  if (tone === "pressure") return "border-cyan-200/24 bg-cyan-300/10 text-cyan-100";
  if (tone === "final") return "border-white/20 bg-white/[0.08] text-white";
  return "border-white/10 bg-white/[0.04] text-white/54";
}

function IntervalSummarySection({ intervals }: { intervals: IntervalSummary[] }) {
  const safeIntervals = Array.isArray(intervals) ? intervals : [];

  return (
    <section className="rounded-3xl border border-[#f7b733]/20 bg-[#05070d]/76 p-4 shadow-2xl shadow-black/40 backdrop-blur-xl">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.2em] text-[#f7b733]">OpenRouter interval recap</p>
          <h2 className="mt-1 text-2xl font-black text-white">The match in 15-minute chapters</h2>
        </div>
        <span className="w-fit rounded-full border border-white/10 bg-white/[0.05] px-3 py-1.5 font-mono text-xs font-black text-white/64">
          {safeIntervals.length} intervals
        </span>
      </div>

      {safeIntervals.length === 0 ? (
        <p className="mt-4 rounded-xl border border-white/10 bg-white/[0.035] p-3 text-sm font-bold text-white/50">
          No interval summaries yet.
        </p>
      ) : (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {safeIntervals.map((interval) => (
            <article key={interval.interval} className={`rounded-2xl border p-4 ${toneClass(interval.tone)}`}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-mono text-xs font-black uppercase tracking-[0.16em] opacity-70">{interval.interval}</p>
                  <h3 className="mt-2 text-lg font-black text-white">{interval.headline}</h3>
                </div>
                <span className="shrink-0 rounded-full bg-white px-2.5 py-1 font-mono text-xs font-black text-black">{interval.score || "--"}</span>
              </div>
              <p className="mt-3 text-sm leading-6 text-white/68">{interval.summary}</p>
              {(interval.keyEvents ?? []).length > 0 ? (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {(interval.keyEvents ?? []).map((event, eventIndex) => (
                    <span key={`${interval.interval}-${eventIndex}-${event}`} className="rounded-full border border-white/10 bg-black/18 px-2.5 py-1 text-xs font-bold text-white/56">
                      {event}
                    </span>
                  ))}
                </div>
              ) : null}
              <p className="mt-3 text-xs font-black uppercase tracking-[0.14em] text-white/34">{interval.source}</p>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

export function MatchStoryExperience({ fixtureId }: { fixtureId: string }) {
  const [payload, setPayload] = useState<MatchDataPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const totalRecords = useMemo(() => payload?.coverage.reduce((sum, block) => sum + (block.records ?? []).length, 0) ?? 0, [payload]);

  async function loadData() {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/atlas/match-story?fixtureId=${encodeURIComponent(fixtureId)}`, { cache: "no-store" });
      const body = (await response.json().catch(() => ({}))) as MatchDataPayload & { error?: string };
      if (!response.ok) throw new Error(body.error || "Could not load TxLINE match data.");
      setPayload(normalizePayload(body));
    } catch (caught) {
      setPayload(null);
      setError(caught instanceof Error ? caught.message : "Could not load TxLINE match data.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadData();
    }, 0);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fixtureId]);

  return (
    <main className="relative min-h-svh overflow-hidden bg-[#05070d] text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_12%,rgba(247,183,51,0.16),transparent_28rem),radial-gradient(circle_at_85%_48%,rgba(155,69,254,0.16),transparent_24rem),linear-gradient(180deg,#05070d,#000000)]" />

      <header className="relative z-20 border-b border-white/10 bg-black/44 backdrop-blur-xl">
        <nav className="mx-auto flex min-h-16 w-full max-w-[92rem] items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link
            href="/atlas"
            className="inline-flex min-h-11 items-center rounded-full border border-white/12 bg-white/[0.04] px-4 text-sm font-black text-white transition-colors hover:bg-white/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f7b733] focus-visible:ring-offset-2 focus-visible:ring-offset-black"
          >
            Back to Atlas
          </Link>
          <SolanaWalletButton />
        </nav>
      </header>

      <section className="relative z-10 mx-auto w-full max-w-[92rem] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-4xl">
            <p className="text-xs font-black uppercase tracking-[0.24em] text-[#f7b733]">TxLINE match coverage</p>
            <h1 className="mt-3 text-4xl font-black leading-tight text-white sm:text-5xl">
              {payload?.fixture ? `${payload.fixture.home} vs ${payload.fixture.away}` : "Match data"}
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-white/62">
              TxLINE historical score sequence summarized into eight match intervals for fixture <span className="font-mono text-white">{fixtureId}</span>.
            </p>
          </div>
          <button
            type="button"
            onClick={loadData}
            disabled={loading}
            className="min-h-11 rounded-full bg-white px-5 text-sm font-black text-black transition-colors hover:bg-[#f3f3f3] disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f7b733] focus-visible:ring-offset-2 focus-visible:ring-offset-black"
          >
            {loading ? "Loading..." : "Refresh Data"}
          </button>
        </div>

        {loading ? (
          <DataSkeleton />
        ) : error ? (
          <section className="grid min-h-[52vh] place-items-center">
            <div className="max-w-xl rounded-3xl border border-white/12 bg-[#05070d]/72 p-6 text-center shadow-2xl shadow-black/50 backdrop-blur-xl">
              <p className="text-xs font-black uppercase tracking-[0.24em] text-[#f7b733]">No coverage loaded</p>
              <h2 className="mt-3 text-3xl font-black text-white">TxLINE did not return this match.</h2>
              <p className="mt-3 text-sm leading-6 text-white/58">{error}</p>
              <button
                type="button"
                onClick={loadData}
                className="mt-6 min-h-11 rounded-full bg-[#f7b733] px-5 text-sm font-black text-black transition-colors hover:bg-[#fcd34d] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black"
              >
                Try again
              </button>
            </div>
          </section>
        ) : payload ? (
          <div className="grid gap-4">
            <div className="grid gap-4">
              <ScoreboardHero fixture={payload.fixture} stats={payload.stats} totalRecords={totalRecords} timelineCount={payload.timeline.length} />

              <IntervalSummarySection intervals={payload.intervals} />
            </div>
          </div>
        ) : null}
      </section>
    </main>
  );
}
