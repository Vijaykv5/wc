import { NextRequest, NextResponse } from "next/server";
import { getCountryFanStats, getCountryFlag, normalizeCountry } from "@/lib/atlas-globe-data";
import { createTxLineClient } from "@/lib/txline";

type TxLineRecord = Record<string, unknown>;

type AtlasCountryFixture = {
  id: string;
  home: string;
  away: string;
  competition: string;
  status: string;
  startTime?: number;
  homeScore: number | null;
  awayScore: number | null;
};

const MS_PER_DAY = 86_400_000;
const PAST_DAYS = 30;
const FUTURE_DAYS = 14;

const HOME_SCORE_KEYS = [
  "Participant1Score",
  "participant1Score",
  "HomeScore",
  "homeScore",
  "home_score",
  "Score1",
  "score1",
  "Team1Score",
  "team1Score",
  "GoalsParticipant1",
];

const AWAY_SCORE_KEYS = [
  "Participant2Score",
  "participant2Score",
  "AwayScore",
  "awayScore",
  "away_score",
  "Score2",
  "score2",
  "Team2Score",
  "team2Score",
  "GoalsParticipant2",
];

function readText(record: TxLineRecord, keys: string[], fallback = "") {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value;
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }

  return fallback;
}

function readNumber(record: TxLineRecord, keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && value.trim()) {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) return parsed;
    }
  }

  return undefined;
}

function readNestedNumber(value: unknown, path: string[]) {
  let currentValue = value;

  for (const key of path) {
    if (typeof currentValue !== "object" || currentValue === null) return undefined;
    currentValue = (currentValue as Record<string, unknown>)[key];
  }

  if (typeof currentValue === "number" && Number.isFinite(currentValue)) return currentValue;
  if (typeof currentValue === "string" && currentValue.trim()) {
    const parsed = Number(currentValue);
    if (Number.isFinite(parsed)) return parsed;
  }

  return undefined;
}

function readTime(record: TxLineRecord) {
  const rawTime = readNumber(record, ["StartTime", "startTime", "startTimestamp", "kickoff", "ts", "Timestamp", "timestamp"]);
  if (!rawTime) return undefined;

  return rawTime < 10_000_000_000 ? rawTime * 1000 : rawTime;
}

function readEventTime(record: TxLineRecord) {
  const rawTime = readNumber(record, ["Ts", "ts", "Timestamp", "timestamp", "StartTime", "startTime"]);
  if (!rawTime) return undefined;

  return rawTime < 10_000_000_000 ? rawTime * 1000 : rawTime;
}

function scoreFromRecord(record: TxLineRecord) {
  const soccerScore = record.scoreSoccer ?? record.ScoreSoccer ?? record.Score ?? record.score;
  const homeScore =
    readNestedNumber(soccerScore, ["Participant1", "Total", "Goals"]) ??
    readNestedNumber(soccerScore, ["participant1", "total", "goals"]) ??
    readNumber(record, HOME_SCORE_KEYS);
  const awayScore =
    readNestedNumber(soccerScore, ["Participant2", "Total", "Goals"]) ??
    readNestedNumber(soccerScore, ["participant2", "total", "goals"]) ??
    readNumber(record, AWAY_SCORE_KEYS);

  return {
    homeScore: homeScore ?? null,
    awayScore: awayScore ?? null,
  };
}

function latestScore(records: TxLineRecord[]) {
  const sortedRecords = [...records].sort((recordA, recordB) => (readEventTime(recordB) ?? 0) - (readEventTime(recordA) ?? 0));

  for (const record of sortedRecords) {
    const score = scoreFromRecord(record);
    if (score.homeScore !== null && score.awayScore !== null) return score;
  }

  return null;
}

function recordsFromPayload(payload: unknown) {
  if (Array.isArray(payload)) return payload.filter((record): record is TxLineRecord => typeof record === "object" && record !== null);
  if (typeof payload === "object" && payload !== null && Array.isArray((payload as { data?: unknown }).data)) {
    return recordsFromPayload((payload as { data: unknown }).data);
  }
  return [];
}

function teamMatchesCountry(team: string, country: string) {
  const normalizedTeam = normalizeCountry(team).toLowerCase();
  const normalizedCountry = normalizeCountry(country).toLowerCase();
  const countryWords = normalizedCountry.split(/\s+/).filter(Boolean);

  return (
    normalizedTeam === normalizedCountry ||
    normalizedTeam.includes(normalizedCountry) ||
    countryWords.every((word) => normalizedTeam.includes(word))
  );
}

function normalizeFixture(record: TxLineRecord): AtlasCountryFixture | null {
  const id = readText(record, ["FixtureId", "fixtureId", "id", "eventId", "matchId"]);
  const home = readText(record, ["Participant1", "participant1", "homeTeam", "home", "homeName", "team1"]);
  const away = readText(record, ["Participant2", "participant2", "awayTeam", "away", "awayName", "team2"]);
  const competition = readText(
    record,
    ["Competition", "competitionName", "competition", "leagueName", "tournament", "Fixture", "fixture", "FixtureGroup", "fixtureGroup", "fixtureGroupName", "groupName"],
    "FIFA",
  );

  if (!id || !home || !away) return null;

  const fixtureScore = scoreFromRecord(record);

  return {
    id,
    home,
    away,
    competition,
    status: readText(record, ["GameState", "gameState", "status", "fixtureStatus", "state", "phase"], "Scheduled"),
    startTime: readTime(record),
    homeScore: fixtureScore.homeScore,
    awayScore: fixtureScore.awayScore,
  };
}

function isWorldCupFixture(fixture: AtlasCountryFixture) {
  return /world cup/i.test(fixture.competition) && !/friendly|friendlies/i.test(fixture.competition);
}

function dedupeFixtures(fixtures: AtlasCountryFixture[]) {
  const fixtureMap = new Map<string, AtlasCountryFixture>();

  for (const fixture of fixtures) {
    const existingFixture = fixtureMap.get(fixture.id);
    if (!existingFixture) {
      fixtureMap.set(fixture.id, fixture);
      continue;
    }

    const fixtureHasScore = fixture.homeScore !== null && fixture.awayScore !== null;
    const existingHasScore = existingFixture.homeScore !== null && existingFixture.awayScore !== null;
    if (fixtureHasScore && !existingHasScore) fixtureMap.set(fixture.id, fixture);
  }

  return Array.from(fixtureMap.values());
}

async function fetchFixtureScores(client: ReturnType<typeof createTxLineClient>, fixture: AtlasCountryFixture) {
  if (fixture.homeScore !== null && fixture.awayScore !== null) return fixture;

  try {
    const historicalScores = await client.request<unknown>(`/scores/historical/${fixture.id}`);
    const score = latestScore(recordsFromPayload(historicalScores));
    if (score) {
      return {
        ...fixture,
        homeScore: score.homeScore,
        awayScore: score.awayScore,
      };
    }
  } catch {
    // Older or not-yet-final fixtures may only expose score snapshots.
  }

  try {
    const snapshotScores = await client.request<unknown>(`/scores/snapshot/${fixture.id}`);
    const score = latestScore(recordsFromPayload(snapshotScores));
    if (score) {
      return {
        ...fixture,
        homeScore: score.homeScore,
        awayScore: score.awayScore,
      };
    }
  } catch {
    return fixture;
  }

  return fixture;
}

export async function GET(request: NextRequest) {
  const country = normalizeCountry(request.nextUrl.searchParams.get("country") ?? "");

  if (!country) {
    return NextResponse.json({ error: "Missing country." }, { status: 400 });
  }

  const todayEpochDay = Math.floor(Date.now() / MS_PER_DAY);
  const days = Array.from({ length: PAST_DAYS + FUTURE_DAYS + 1 }, (_, index) => todayEpochDay - PAST_DAYS + index);
  const now = Date.now();
  const fanStats = getCountryFanStats(country);

  try {
    const client = createTxLineClient();
    const settledFixtureResponses = await Promise.allSettled(
      days.map((startEpochDay) =>
        client.request<unknown>("/fixtures/snapshot", {
          query: { startEpochDay },
        }),
      ),
    );
    const fixtureResponses = settledFixtureResponses
      .filter((response): response is PromiseFulfilledResult<unknown> => response.status === "fulfilled")
      .map((response) => response.value);

    if (fixtureResponses.length === 0) {
      return NextResponse.json({
        country,
        flag: getCountryFlag(country),
        supporters: fanStats.supporters,
        liveRooms: 0,
        worldCupParticipant: null,
        nextMatch: null,
        recent: [],
        upcoming: [],
        source: "unavailable",
        error: "TxLINE is unavailable right now.",
      });
    }

    const fixtures = dedupeFixtures(
      fixtureResponses
        .flatMap(recordsFromPayload)
        .map(normalizeFixture)
        .filter((fixture): fixture is AtlasCountryFixture => Boolean(fixture))
        .filter(isWorldCupFixture)
        .filter((fixture) => teamMatchesCountry(fixture.home, country) || teamMatchesCountry(fixture.away, country)),
    );

    if (fixtures.length === 0) {
      return NextResponse.json({
        country,
        flag: getCountryFlag(country),
        supporters: fanStats.supporters,
        liveRooms: 0,
        worldCupParticipant: false,
        nextMatch: null,
        recent: [],
        upcoming: [],
        source: "txline",
      });
    }

    const pastFixtures = fixtures
      .filter((fixture) => fixture.startTime && fixture.startTime < now)
      .sort((a, b) => (b.startTime ?? 0) - (a.startTime ?? 0))
      .slice(0, 8);
    const recent = dedupeFixtures(await Promise.all(pastFixtures.map((fixture) => fetchFixtureScores(client, fixture))))
      .filter((fixture) => fixture.homeScore !== null && fixture.awayScore !== null)
      .slice(0, 3);
    const upcoming = fixtures
      .filter((fixture) => !fixture.startTime || fixture.startTime >= now)
      .sort((a, b) => (a.startTime ?? Number.MAX_SAFE_INTEGER) - (b.startTime ?? Number.MAX_SAFE_INTEGER))
      .slice(0, 3);

    return NextResponse.json({
      country,
      flag: getCountryFlag(country),
      supporters: fanStats.supporters,
      liveRooms: upcoming.length > 0 ? fanStats.liveRooms + Math.min(upcoming.length, 2) : fanStats.liveRooms,
      worldCupParticipant: true,
      nextMatch: upcoming[0] ?? null,
      recent,
      upcoming,
      source: "txline",
    });
  } catch {
    return NextResponse.json({
      country,
      flag: getCountryFlag(country),
      supporters: fanStats.supporters,
      liveRooms: 0,
      worldCupParticipant: null,
      nextMatch: null,
      recent: [],
      upcoming: [],
      source: "unavailable",
      error: "TxLINE is unavailable right now.",
    });
  }
}
