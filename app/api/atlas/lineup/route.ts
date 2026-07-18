import { NextRequest, NextResponse } from "next/server";
import { getCountryFlag, normalizeCountry } from "@/lib/atlas-globe-data";
import { createTxLineClient } from "@/lib/txline";

type TxLineRecord = Record<string, unknown>;

type AtlasLineupFixture = {
  id: string;
  home: string;
  away: string;
  competition: string;
  status: string;
  startTime?: number;
};

type AtlasLineupPlayer = {
  id: string | null;
  name: string;
  preferredName: string | null;
  imageUrl: string | null;
  position: string;
  positionId: number | null;
  rosterNumber: string | null;
  starter: boolean | null;
  team: string | null;
  country: string | null;
  side: "home" | "away" | null;
};

const MS_PER_DAY = 86_400_000;
const PAST_DAYS = 30;
const FUTURE_DAYS = 30;

const POSITION_LABELS: Record<number, string> = {
  1: "Goalkeeper",
  2: "Defender",
  3: "Midfielder",
  4: "Forward",
};

function readText(record: TxLineRecord, keys: string[], fallback = "") {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value;
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
    if (typeof value === "boolean") return String(value);
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

  return null;
}

function readBoolean(record: TxLineRecord, keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "boolean") return value;
    if (typeof value === "number") return value === 1;
    if (typeof value === "string") {
      const normalized = value.trim().toLowerCase();
      if (["true", "yes", "y", "1", "starter", "starting"].includes(normalized)) return true;
      if (["false", "no", "n", "0", "substitute", "bench"].includes(normalized)) return false;
    }
  }

  return null;
}

function readTime(record: TxLineRecord) {
  const rawTime = readNumber(record, ["StartTime", "startTime", "startTimestamp", "kickoff", "ts", "Timestamp", "timestamp"]);
  if (!rawTime) return undefined;

  return rawTime < 10_000_000_000 ? rawTime * 1000 : rawTime;
}

function recordsFromPayload(payload: unknown): TxLineRecord[] {
  if (Array.isArray(payload)) return payload.filter((record): record is TxLineRecord => typeof record === "object" && record !== null);

  if (typeof payload === "string") {
    return payload
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.slice(5).trim())
      .map((line) => {
        try {
          return JSON.parse(line) as unknown;
        } catch {
          return null;
        }
      })
      .filter((record): record is TxLineRecord => typeof record === "object" && record !== null);
  }

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

function normalizeFixture(record: TxLineRecord): AtlasLineupFixture | null {
  const id = readText(record, ["FixtureId", "fixtureId", "id", "eventId", "matchId"]);
  const home = readText(record, ["Participant1", "participant1", "homeTeam", "home", "homeName", "team1"]);
  const away = readText(record, ["Participant2", "participant2", "awayTeam", "away", "awayName", "team2"]);
  const competition = readText(
    record,
    ["Competition", "competitionName", "competition", "leagueName", "tournament", "Fixture", "fixture", "FixtureGroup", "fixtureGroup", "fixtureGroupName", "groupName"],
    "FIFA",
  );

  if (!id || !home || !away) return null;

  return {
    id,
    home,
    away,
    competition,
    status: readText(record, ["GameState", "gameState", "status", "fixtureStatus", "state", "phase"], "Scheduled"),
    startTime: readTime(record),
  };
}

function isWorldCupFixture(fixture: AtlasLineupFixture) {
  return /world cup/i.test(fixture.competition) && !/friendly|friendlies/i.test(fixture.competition);
}

function dedupeFixtures(fixtures: AtlasLineupFixture[]) {
  const fixtureMap = new Map<string, AtlasLineupFixture>();

  for (const fixture of fixtures) {
    const current = fixtureMap.get(fixture.id);
    if (!current || (fixture.startTime ?? 0) > (current.startTime ?? 0)) {
      fixtureMap.set(fixture.id, fixture);
    }
  }

  return Array.from(fixtureMap.values());
}

function chooseFixture(fixtures: AtlasLineupFixture[], fixtureId: string | null) {
  if (fixtureId) return fixtures.find((fixture) => fixture.id === fixtureId) ?? null;

  const now = Date.now();
  const upcoming = fixtures
    .filter((fixture) => !fixture.startTime || fixture.startTime >= now)
    .sort((fixtureA, fixtureB) => (fixtureA.startTime ?? Number.MAX_SAFE_INTEGER) - (fixtureB.startTime ?? Number.MAX_SAFE_INTEGER));
  if (upcoming[0]) return upcoming[0];

  return [...fixtures].sort((fixtureA, fixtureB) => (fixtureB.startTime ?? 0) - (fixtureA.startTime ?? 0))[0] ?? null;
}

function looksLikeLineupPlayer(record: TxLineRecord) {
  const hasPlayerName = Boolean(readText(record, ["preferredName", "PreferredName", "playerName", "PlayerName", "name", "Name", "fullName", "FullName"]));
  const hasLineupShape =
    readText(record, ["rosterNumber", "RosterNumber", "shirtNumber", "ShirtNumber", "position", "Position", "team", "Team"]) ||
    readNumber(record, ["playerId", "PlayerId", "id", "Id", "positionId", "PositionId"]) !== null ||
    readBoolean(record, ["starter", "Starter", "isStarter", "IsStarter"]) !== null;

  return hasPlayerName && Boolean(hasLineupShape);
}

function collectLineupRecords(value: unknown, players: TxLineRecord[] = []) {
  if (Array.isArray(value)) {
    for (const item of value) collectLineupRecords(item, players);
    return players;
  }

  if (typeof value !== "object" || value === null) return players;

  const record = value as TxLineRecord;
  if (looksLikeLineupPlayer(record)) players.push(record);

  for (const [key, nextValue] of Object.entries(record)) {
    if (/lineup|player|roster|squad/i.test(key) || typeof nextValue === "object") {
      collectLineupRecords(nextValue, players);
    }
  }

  return players;
}

function inferSide(player: TxLineRecord, fixture: AtlasLineupFixture, country: string) {
  const team = readText(player, ["team", "Team", "teamName", "TeamName", "participant", "Participant", "participantName", "ParticipantName"]);
  const playerCountry = readText(player, ["country", "Country", "nationality", "Nationality"]);

  if (team && teamMatchesCountry(team, fixture.home)) return "home";
  if (team && teamMatchesCountry(team, fixture.away)) return "away";
  if ((team && teamMatchesCountry(team, country)) || (playerCountry && teamMatchesCountry(playerCountry, country))) {
    if (teamMatchesCountry(fixture.home, country)) return "home";
    if (teamMatchesCountry(fixture.away, country)) return "away";
  }

  return null;
}

function normalizePlayer(player: TxLineRecord, fixture: AtlasLineupFixture, country: string): AtlasLineupPlayer | null {
  const name = readText(player, ["preferredName", "PreferredName", "playerName", "PlayerName", "name", "Name", "fullName", "FullName"]);
  if (!name) return null;

  const positionId = readNumber(player, ["positionId", "PositionId"]);
  const position =
    readText(player, ["position", "Position", "positionName", "PositionName", "role", "Role"]) ||
    (positionId ? POSITION_LABELS[positionId] ?? `Position ${positionId}` : "Player");
  const side = inferSide(player, fixture, country);
  const team = readText(player, ["team", "Team", "teamName", "TeamName", "participant", "Participant", "participantName", "ParticipantName"]) || null;
  const playerCountry = readText(player, ["country", "Country", "nationality", "Nationality"]) || null;
  const countrySide = teamMatchesCountry(fixture.home, country) ? "home" : teamMatchesCountry(fixture.away, country) ? "away" : null;

  if (side && countrySide && side !== countrySide) return null;
  if (side === null && !teamMatchesCountry(team ?? "", country) && !teamMatchesCountry(playerCountry ?? "", country)) return null;

  return {
    id: readText(player, ["playerId", "PlayerId", "id", "Id"]) || null,
    name,
    preferredName: readText(player, ["preferredName", "PreferredName"]) || null,
    imageUrl:
      readText(player, ["imageUrl", "ImageUrl", "image", "Image", "photoUrl", "PhotoUrl", "photo", "Photo", "headshotUrl", "HeadshotUrl", "profileImageUrl"]) || null,
    position,
    positionId,
    rosterNumber: readText(player, ["rosterNumber", "RosterNumber", "shirtNumber", "ShirtNumber", "number", "Number"]) || null,
    starter: readBoolean(player, ["starter", "Starter", "isStarter", "IsStarter", "starting", "Starting"]),
    team,
    country: playerCountry,
    side,
  };
}

function dedupePlayers(players: AtlasLineupPlayer[]) {
  const playerMap = new Map<string, AtlasLineupPlayer>();

  for (const player of players) {
    const key = player.id ?? `${player.name}-${player.rosterNumber ?? ""}-${player.team ?? ""}`;
    const current = playerMap.get(key);
    if (!current || (!current.imageUrl && player.imageUrl) || (current.starter === null && player.starter !== null)) {
      playerMap.set(key, player);
    }
  }

  return Array.from(playerMap.values()).sort((playerA, playerB) => {
    if (playerA.starter !== playerB.starter) return playerA.starter ? -1 : 1;
    return Number(playerA.rosterNumber ?? 999) - Number(playerB.rosterNumber ?? 999) || playerA.name.localeCompare(playerB.name);
  });
}

async function fetchFixtureLineupPayloads(client: ReturnType<typeof createTxLineClient>, fixtureId: string) {
  const responses = await Promise.allSettled([
    client.request<unknown>(`/scores/snapshot/${fixtureId}`),
    client.request<unknown>(`/scores/historical/${fixtureId}`),
    client.request<unknown>(`/scores/updates/${fixtureId}/all`),
  ]);

  return responses.filter((response): response is PromiseFulfilledResult<unknown> => response.status === "fulfilled").map((response) => response.value);
}

export async function GET(request: NextRequest) {
  const country = normalizeCountry(request.nextUrl.searchParams.get("country") ?? "");
  const fixtureId = request.nextUrl.searchParams.get("fixtureId");

  if (!country) {
    return NextResponse.json({ error: "Missing country." }, { status: 400 });
  }

  try {
    const client = createTxLineClient();
    const todayEpochDay = Math.floor(Date.now() / MS_PER_DAY);
    const days = Array.from({ length: PAST_DAYS + FUTURE_DAYS + 1 }, (_, index) => todayEpochDay - PAST_DAYS + index);
    const fixtureResponses = await Promise.allSettled(
      days.map((startEpochDay) =>
        client.request<unknown>("/fixtures/snapshot", {
          query: { startEpochDay },
        }),
      ),
    );
    const fixtures = dedupeFixtures(
      fixtureResponses
        .filter((response): response is PromiseFulfilledResult<unknown> => response.status === "fulfilled")
        .flatMap((response) => recordsFromPayload(response.value))
        .map(normalizeFixture)
        .filter((fixture): fixture is AtlasLineupFixture => Boolean(fixture))
        .filter(isWorldCupFixture)
        .filter((fixture) => teamMatchesCountry(fixture.home, country) || teamMatchesCountry(fixture.away, country)),
    );

    const fixture = chooseFixture(fixtures, fixtureId);
    if (!fixture) {
      return NextResponse.json({
        country,
        flag: getCountryFlag(country),
        fixture: null,
        players: [],
        source: "txline",
        lineupType: "fixture",
        message: "No World Cup fixture found for this country in the sampled TxLINE window.",
      });
    }

    const payloads = await fetchFixtureLineupPayloads(client, fixture.id);
    const players = dedupePlayers(
      payloads
        .flatMap((payload) => collectLineupRecords(payload))
        .map((player) => normalizePlayer(player, fixture, country))
        .filter((player): player is AtlasLineupPlayer => Boolean(player)),
    );

    return NextResponse.json({
      country,
      flag: getCountryFlag(country),
      fixture,
      players,
      source: "txline",
      lineupType: "fixture",
      message:
        players.length > 0
          ? "Lineups are fixture-specific and can change from match to match."
          : "No lineup players were published for this fixture yet. TxLINE may publish lineups closer to kickoff or only for covered matches.",
    });
  } catch {
    return NextResponse.json({
      country,
      flag: getCountryFlag(country),
      fixture: null,
      players: [],
      source: "unavailable",
      lineupType: "fixture",
      message: "TxLINE lineup data is unavailable right now.",
    });
  }
}
