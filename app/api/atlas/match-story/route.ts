import { NextRequest, NextResponse } from "next/server";
import {
  createMatchEventContext,
  findFinishedWorldCupFixture,
  normalizeFixture,
  recordsFromPayload,
  structureMatchMoments,
  summarizeIntervalsWithOpenRouter,
  summarizeMatchStats,
  summarizeSoccerRecord,
  type MatchStoryFixture,
  type TxLineRecord,
} from "@/lib/match-story-data";
import { createTxLineClient } from "@/lib/txline";

export const runtime = "nodejs";

type CoverageBlock = {
  endpoint: string;
  label: string;
  records: TxLineRecord[];
  error: string | null;
};

function cleanText(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

async function fetchCoverage(client: ReturnType<typeof createTxLineClient>, endpoint: string, label: string): Promise<CoverageBlock> {
  try {
    const payload = await client.request<unknown>(endpoint);
    return {
      endpoint,
      label,
      records: recordsFromPayload(payload),
      error: null,
    };
  } catch (error) {
    return {
      endpoint,
      label,
      records: [],
      error: error instanceof Error ? error.message : "TxLINE request failed.",
    };
  }
}

async function findFixtureSnapshot(client: ReturnType<typeof createTxLineClient>, fixtureId: string) {
  const knownFixture = await findFinishedWorldCupFixture(fixtureId).catch(() => null);
  if (knownFixture) return knownFixture;

  const todayEpochDay = Math.floor(Date.now() / 86_400_000);
  const responses = await Promise.all(
    Array.from({ length: 60 }, (_, index) =>
      client
        .request<unknown>("/fixtures/snapshot", {
          query: { startEpochDay: todayEpochDay - index },
        })
        .catch(() => []),
    ),
  );

  return responses
    .flatMap(recordsFromPayload)
    .map(normalizeFixture)
    .filter((fixture): fixture is MatchStoryFixture => Boolean(fixture))
    .find((fixture) => fixture.id === fixtureId) ?? null;
}

export async function GET(request: NextRequest) {
  try {
    const fixtureId = cleanText(request.nextUrl.searchParams.get("fixtureId"), 80);
    if (!fixtureId) return NextResponse.json({ error: "Missing fixtureId." }, { status: 400 });

    const client = createTxLineClient();
    const fixture = await findFixtureSnapshot(client, fixtureId);
    const coverage = [await fetchCoverage(client, `/scores/historical/${fixtureId}`, "Full historical score sequence")];
    const allScoreRecords = coverage.flatMap((block) => block.records);
    const eventContext = createMatchEventContext(allScoreRecords, fixture);
    const timeline = allScoreRecords
      .map((record) => summarizeSoccerRecord(record, eventContext))
      .filter((item) => item.label || item.score || item.phase)
      .sort((a, b) => (a.minute ?? a.timestamp ?? 0) - (b.minute ?? b.timestamp ?? 0));
    const stats = summarizeMatchStats(allScoreRecords);
    const moments = structureMatchMoments({ fixture, timeline });
    const intervals = await summarizeIntervalsWithOpenRouter({ fixture, timeline });

    if (!fixture && allScoreRecords.length === 0) {
      return NextResponse.json(
        {
          error: "No TxLINE fixture or score coverage was found for this fixture id.",
          fixture: null,
          coverage,
          timeline: [],
          stats,
          moments: [],
          intervals,
        },
        { status: 404 },
      );
    }

    return NextResponse.json({
      fixture,
      coverage,
      timeline,
      stats,
      moments,
      intervals,
      source: "txline",
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not load TxLINE match data." },
      { status: 500 },
    );
  }
}
