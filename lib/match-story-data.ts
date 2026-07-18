import { createTxLineClient } from "@/lib/txline";

export type TxLineRecord = Record<string, unknown>;

export type MatchStoryFixture = {
  id: string;
  home: string;
  away: string;
  homeScore: number | null;
  awayScore: number | null;
  status: string;
  competition: string;
  startTime?: number;
};

export type MatchStoryPanelDraft = {
  panelIndex: number;
  beatTitle: string;
  caption: string;
  phase: string;
  imagePrompt: string;
  imageUri: string;
  imageSource: "openai" | "template";
};

export type MatchStatSummary = {
  goals: [number | null, number | null];
  yellowCards: [number | null, number | null];
  redCards: [number | null, number | null];
  corners: [number | null, number | null];
};

type MatchEventContext = {
  participantNames: Record<number, string>;
  playerNames: Map<number, string>;
};

export type MatchTimelineItem = ReturnType<typeof summarizeSoccerRecord>;

export type StructuredMatchMoment = {
  id: string;
  minute: string;
  phase: string;
  type: "kickoff" | "goal" | "card" | "pressure" | "final" | "story";
  headline: string;
  caption: string;
  score: string;
  visualPrompt: string;
  source: "txline" | "derived";
  sourceRecordId: string | null;
};

export type IntervalSummary = {
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

const MS_PER_DAY = 86_400_000;
const LOOKBACK_DAYS = 45;
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

function readMatchClockMinute(record: TxLineRecord) {
  const soccer = readSoccerStats(record);
  const dataSoccer = record.dataSoccer ?? record.DataSoccer;
  const directMinute = readNumber(record, [
    "Minute",
    "minute",
    "MatchMinute",
    "matchMinute",
    "GameMinute",
    "gameMinute",
    "Elapsed",
    "elapsed",
    "ElapsedMinute",
    "elapsedMinute",
    "Clock",
    "clock",
  ]);
  const soccerMinute =
    soccer
      ? readNestedNumber(soccer, ["Minute"]) ??
        readNestedNumber(soccer, ["MatchMinute"]) ??
        readNestedNumber(soccer, ["Clock", "Minute"]) ??
        readNestedNumber(soccer, ["Time", "Minute"]) ??
        readNestedNumber(soccer, ["TimeElapsed"])
      : undefined;
  const dataMinute =
    dataSoccer && typeof dataSoccer === "object"
      ? readNestedNumber(dataSoccer, ["Minute"]) ??
        readNestedNumber(dataSoccer, ["MatchMinute"]) ??
        readNestedNumber(dataSoccer, ["Clock", "Minute"]) ??
        readNestedNumber(dataSoccer, ["Time", "Minute"]) ??
        readNestedNumber(dataSoccer, ["TimeElapsed"])
      : undefined;
  const minute = directMinute ?? soccerMinute ?? dataMinute;
  const clockSeconds = readNestedNumber(record.Clock, ["Seconds"]) ?? readNestedNumber(record.clock, ["seconds"]);
  if (minute === undefined && clockSeconds !== undefined) return Math.floor(clockSeconds / 60);

  return minute !== undefined && minute >= 0 && minute <= 140 ? minute : null;
}

function readSoccerStats(record: TxLineRecord) {
  const scoreSoccer = record.scoreSoccer ?? record.ScoreSoccer ?? record.Score ?? record.score;
  if (scoreSoccer && typeof scoreSoccer === "object") return scoreSoccer as Record<string, unknown>;
  return null;
}

function readParticipantStat(stats: Record<string, unknown> | null, participant: "Participant1" | "Participant2", key: string) {
  if (!stats) return null;
  const direct = readNestedNumber(stats, [participant, "Total", key]);
  const lowercase = readNestedNumber(stats, [participant.toLowerCase(), "total", key.toLowerCase()]);
  return direct ?? lowercase ?? null;
}

export function summarizeMatchStats(records: TxLineRecord[]): MatchStatSummary {
  const latest = [...records].reverse().find((record) => readSoccerStats(record));
  const stats = latest ? readSoccerStats(latest) : null;

  return {
    goals: [readParticipantStat(stats, "Participant1", "Goals"), readParticipantStat(stats, "Participant2", "Goals")],
    yellowCards: [readParticipantStat(stats, "Participant1", "YellowCards"), readParticipantStat(stats, "Participant2", "YellowCards")],
    redCards: [readParticipantStat(stats, "Participant1", "RedCards"), readParticipantStat(stats, "Participant2", "RedCards")],
    corners: [readParticipantStat(stats, "Participant1", "Corners"), readParticipantStat(stats, "Participant2", "Corners")],
  };
}

function readAction(record: TxLineRecord) {
  const soccer = readSoccerStats(record);
  const dataSoccer = record.dataSoccer ?? record.DataSoccer;
  const soccerAction =
    soccer && typeof soccer.Action === "string"
      ? soccer.Action
      : dataSoccer && typeof dataSoccer === "object" && typeof (dataSoccer as Record<string, unknown>).Action === "string"
        ? String((dataSoccer as Record<string, unknown>).Action)
        : "";

  return (
    soccerAction ||
    readText(record, ["Action", "action", "Event", "event", "Type", "type", "GameState", "gameState", "status", "phase"])
  );
}

function readData(record: TxLineRecord) {
  const data = record.Data ?? record.data;
  return data && typeof data === "object" ? (data as Record<string, unknown>) : {};
}

function readParticipant(record: TxLineRecord) {
  const data = readData(record);
  const participant = readNumber(record, ["Participant", "participant"]) ?? readNumber(data, ["Participant", "participant", "Team", "team"]);
  return participant === 1 || participant === 2 ? participant : null;
}

function readPlayerNameFromLineupPlayer(value: unknown) {
  if (!value || typeof value !== "object") return "";
  const record = value as Record<string, unknown>;
  const player = record.player && typeof record.player === "object" ? (record.player as Record<string, unknown>) : record;
  const name = player.preferredName ?? player.name ?? player.displayName ?? player.shortName;
  return typeof name === "string" ? name : "";
}

function readPlayerIdFromLineupPlayer(value: unknown) {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const player = record.player && typeof record.player === "object" ? (record.player as Record<string, unknown>) : record;
  const id = player.normativeId ?? player.id ?? record.playerId ?? record.PlayerId;
  const parsed = typeof id === "number" ? id : typeof id === "string" ? Number(id) : NaN;
  return Number.isFinite(parsed) ? parsed : null;
}

export function createMatchEventContext(records: TxLineRecord[], fixture: MatchStoryFixture | null): MatchEventContext {
  const participantNames: Record<number, string> = {
    1: fixture?.home ?? "Team 1",
    2: fixture?.away ?? "Team 2",
  };
  const playerNames = new Map<number, string>();

  for (const record of records) {
    const lineups = record.Lineups ?? record.lineups;
    if (!Array.isArray(lineups)) continue;

    lineups.forEach((teamLineup, index) => {
      if (!teamLineup || typeof teamLineup !== "object") return;
      const teamRecord = teamLineup as Record<string, unknown>;
      const participant = index === 0 ? 1 : 2;
      if (typeof teamRecord.preferredName === "string" && teamRecord.preferredName) {
        participantNames[participant] = teamRecord.preferredName;
      }

      const players = teamRecord.lineups;
      if (!Array.isArray(players)) return;
      for (const playerRecord of players) {
        const playerId = readPlayerIdFromLineupPlayer(playerRecord);
        const playerName = readPlayerNameFromLineupPlayer(playerRecord);
        if (playerId !== null && playerName) playerNames.set(playerId, playerName);
      }
    });
  }

  return { participantNames, playerNames };
}

function playerName(context: MatchEventContext | undefined, value: unknown) {
  const parsed = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  if (!Number.isFinite(parsed)) return "";
  return context?.playerNames.get(parsed) ?? `player ${parsed}`;
}

function teamName(context: MatchEventContext | undefined, participant: number | null) {
  if (participant !== 1 && participant !== 2) return "";
  return context?.participantNames[participant] ?? `Team ${participant}`;
}

function eventTypeFromAction(action: string): "goal" | "yellow_card" | "red_card" | "substitution" | "injury" | "penalty" | "var" | "other" {
  const cleaned = action.toLowerCase();
  if (cleaned === "goal" || cleaned.includes("goal_awarded")) return "goal";
  if (cleaned.includes("yellow")) return "yellow_card";
  if (cleaned.includes("red")) return "red_card";
  if (cleaned.includes("substitution")) return "substitution";
  if (cleaned.includes("injury")) return "injury";
  if (cleaned.includes("penalty")) return "penalty";
  if (cleaned.includes("var")) return "var";
  return "other";
}

function eventDescription(record: TxLineRecord, context: MatchEventContext | undefined, action: string) {
  const data = readData(record);
  const participant = readParticipant(record);
  const team = teamName(context, participant);
  const eventType = eventTypeFromAction(action);
  const player = playerName(context, data.PlayerId ?? data.playerId ?? data.Player ?? data.player);
  const playerIn = playerName(context, data.PlayerInId ?? data.playerInId);
  const playerOut = playerName(context, data.PlayerOutId ?? data.playerOutId);

  if (eventType === "goal") return player ? `${player} scored for ${team || "their team"}` : `${team || "A team"} scored`;
  if (eventType === "yellow_card") return player ? `${player} got a yellow card for ${team || "their team"}` : `${team || "A team"} got a yellow card`;
  if (eventType === "red_card") return player ? `${player} got a red card for ${team || "their team"}` : `${team || "A team"} got a red card`;
  if (eventType === "substitution") {
    if (playerIn && playerOut) return `${team || "A team"} substitution: ${playerIn} came on for ${playerOut}`;
    return `${team || "A team"} made a substitution`;
  }
  if (eventType === "injury") return player ? `${player} had an injury stoppage for ${team || "their team"}` : `${team || "A team"} had an injury stoppage`;
  if (eventType === "penalty") return player ? `${player} was involved in a penalty event for ${team || "their team"}` : `${team || "A team"} had a penalty event`;
  if (eventType === "var") return `${team ? `${team} had a ` : ""}VAR check`;
  return "";
}

function readPhase(record: TxLineRecord) {
  const soccer = readSoccerStats(record);
  const rawPhase =
    readNumber(record, ["period", "Period", "statusId", "StatusId"]) ??
    (soccer ? readNestedNumber(soccer, ["Period"]) ?? readNestedNumber(soccer, ["StatusId"]) : undefined);

  if (rawPhase === 100) return "Final";
  if (rawPhase === 2) return "First half";
  if (rawPhase === 3) return "Halftime";
  if (rawPhase === 4) return "Second half";
  if (rawPhase !== undefined) return `Phase ${rawPhase}`;

  return readText(record, ["Period", "period", "Phase", "phase", "GameState", "gameState", "status"], "");
}

export function summarizeSoccerRecord(record: TxLineRecord, context?: MatchEventContext) {
  const score = scoreFromRecord(record);
  const timestamp = readEventTime(record);
  const minute = readMatchClockMinute(record);
  const label = readAction(record);
  const phase = readPhase(record);
  const homeScore = score.homeScore;
  const awayScore = score.awayScore;
  const participant = readParticipant(record);
  const eventType = eventTypeFromAction(label);
  const description = eventDescription(record, context, label);
  const isMajorEvent = eventType !== "other";

  return {
    id: readText(record, ["Id", "id", "Sequence", "sequence", "TxHash", "txHash"], `${timestamp ?? 0}-${label}-${phase}`),
    timestamp,
    minute,
    label,
    eventType,
    description,
    participant,
    teamName: teamName(context, participant),
    phase,
    score: homeScore !== null && awayScore !== null ? `${homeScore}-${awayScore}` : "",
    homeScore,
    awayScore,
    isMajorEvent,
    raw: record,
  };
}

function matchMinute(timestamp: number | undefined, fixtureStartTime: number | undefined) {
  if (!timestamp || !fixtureStartTime) return "";
  const minute = Math.max(0, Math.round((timestamp - fixtureStartTime) / 60_000));
  if (minute <= 45) return `${minute}'`;
  if (minute <= 90) return `${minute}'`;
  if (minute <= 120) return `${minute}'`;
  return "FT";
}

function minuteNumber(timestamp: number | undefined, fixtureStartTime: number | undefined, recordMinute?: number | null) {
  if (typeof recordMinute === "number" && Number.isFinite(recordMinute)) return recordMinute;
  if (!timestamp || !fixtureStartTime) return null;
  return Math.max(0, Math.round((timestamp - fixtureStartTime) / 60_000));
}

function cleanLabel(value: string) {
  return value
    .replace(/_/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .trim();
}

function promptForMoment(fixture: MatchStoryFixture | null, momentType: StructuredMatchMoment["type"], caption: string) {
  const teams = fixture ? `${fixture.home} vs ${fixture.away}` : "World Cup match";
  return [
    "family-friendly cartoon football panel",
    "generic fictional players only",
    "no real player likenesses, no club logos, no sponsor text",
    "bold comic ink, expressive crowd, cinematic stadium lights",
    "Atlas brand mood: deep space black with warm orange highlights",
    `${teams}: ${caption}`,
    `moment type: ${momentType}`,
  ].join(", ");
}

function momentTypeFromTimeline(item: MatchTimelineItem, previousScore: string): StructuredMatchMoment["type"] {
  const label = item.label.toLowerCase();
  if (item.eventType === "goal" || (item.score && item.score !== previousScore)) return "goal";
  if (label.includes("yellow") || label.includes("red") || label.includes("card")) return "card";
  if (label.includes("final") || item.phase.toLowerCase() === "final") return "final";
  if (label.includes("corner") || label.includes("attack") || label.includes("shot")) return "pressure";
  return "story";
}

function headlineForMoment(fixture: MatchStoryFixture | null, item: MatchTimelineItem, type: StructuredMatchMoment["type"]) {
  const label = cleanLabel(item.label);
  if (item.description) return item.description;
  if (type === "goal") return item.score ? `Score moves to ${item.score}` : "The score changes";
  if (type === "card") return label || "Discipline moment";
  if (type === "final") return "Final whistle";
  if (type === "pressure") return label || "Pressure builds";
  if (fixture && item.score) return `${fixture.home} ${item.score} ${fixture.away}`;
  return label || "Match moment";
}

function captionForMoment(fixture: MatchStoryFixture | null, item: MatchTimelineItem, type: StructuredMatchMoment["type"]) {
  const label = cleanLabel(item.label).toLowerCase();
  const score = item.score ? ` The score is ${item.score}.` : "";
  if (item.description) return `${item.description}.${score}`;
  if (type === "goal") return `A score update changes the match energy.${score}`;
  if (type === "card") return `A card event adds tension to the match.${score}`;
  if (type === "final") return fixture ? `${fixture.home} and ${fixture.away} reach the final whistle.${score}` : `The match reaches the final whistle.${score}`;
  if (label) return `${cleanLabel(item.label)} arrives in the TxLINE feed.${score}`;
  return `TxLINE records a match update.${score}`;
}

function derivedMoment(
  fixture: MatchStoryFixture | null,
  index: number,
  type: StructuredMatchMoment["type"],
  headline: string,
  caption: string,
  phase: string,
  score: string,
): StructuredMatchMoment {
  return {
    id: `derived-${index}`,
    minute: type === "kickoff" ? "0'" : type === "final" ? "FT" : "",
    phase,
    type,
    headline,
    caption,
    score,
    visualPrompt: promptForMoment(fixture, type, caption),
    source: "derived",
    sourceRecordId: null,
  };
}

export function structureMatchMoments({
  fixture,
  timeline,
}: {
  fixture: MatchStoryFixture | null;
  timeline: MatchTimelineItem[];
}) {
  const moments: StructuredMatchMoment[] = [];
  const finalScore =
    fixture && fixture.homeScore !== null && fixture.awayScore !== null
      ? `${fixture.homeScore}-${fixture.awayScore}`
      : timeline.findLast((item) => item.score)?.score ?? "";

  if (fixture) {
    moments.push(
      derivedMoment(
        fixture,
        1,
        "kickoff",
        `${fixture.home} vs ${fixture.away} begins`,
        `The match opens with ${fixture.home} and ${fixture.away} under World Cup pressure.`,
        "Kickoff",
        "0-0",
      ),
    );
  }

  let previousScore = "0-0";
  for (const item of timeline) {
    const type = momentTypeFromTimeline(item, previousScore);
    const minute = item.minute !== null && item.minute !== undefined ? `${item.minute}'` : matchMinute(item.timestamp, fixture?.startTime);
    const shouldKeep = item.isMajorEvent || type === "goal" || type === "card" || type === "final" || moments.length < 6;
    if (!shouldKeep) {
      if (item.score) previousScore = item.score;
      continue;
    }

    const caption = captionForMoment(fixture, item, type);
    moments.push({
      id: `txline-${moments.length + 1}`,
      minute: minute || item.phase || "",
      phase: item.phase,
      type,
      headline: headlineForMoment(fixture, item, type),
      caption,
      score: item.score || previousScore,
      visualPrompt: promptForMoment(fixture, type, caption),
      source: "txline",
      sourceRecordId: item.id,
    });

    if (item.score) previousScore = item.score;
  }

  if (fixture && !moments.some((moment) => moment.type === "final")) {
    moments.push(
      derivedMoment(
        fixture,
        moments.length + 1,
        "final",
        `${fixture.home} ${finalScore || "vs"} ${fixture.away}`,
        finalScore
          ? `The match closes at ${fixture.home} ${finalScore} ${fixture.away}.`
          : `The final whistle closes the match between ${fixture.home} and ${fixture.away}.`,
        fixture.status || "Final",
        finalScore,
      ),
    );
  }

  return moments.slice(0, 8);
}

const MATCH_INTERVALS = [
  [0, 15],
  [16, 30],
  [31, 45],
  [46, 60],
  [61, 75],
  [76, 90],
  [91, 105],
  [106, 120],
] as const;

function intervalLabel(start: number, end: number) {
  if (start === 91) return "90+ / Extra time 1";
  if (start === 106) return "Extra time 2";
  return `${start}-${end}'`;
}

function fallbackTone(index: number, eventCount: number, changedScore: boolean): IntervalSummary["tone"] {
  if (index >= 7) return "final";
  if (changedScore) return index >= 4 ? "decisive" : "turning-point";
  if (eventCount >= 3) return "pressure";
  return "quiet";
}

export function createFallbackIntervalSummaries({
  fixture,
  timeline,
}: {
  fixture: MatchStoryFixture | null;
  timeline: MatchTimelineItem[];
}): IntervalSummary[] {
  let lastScore = "0-0";

  return MATCH_INTERVALS.map(([start, end], index) => {
    const events = timeline.filter((item) => {
      const minute = minuteNumber(item.timestamp, fixture?.startTime, item.minute);
      return minute !== null && minute >= start && minute <= end;
    });
    const scoreEvents = events.filter((item) => item.score);
    const intervalScore = scoreEvents.at(-1)?.score ?? lastScore;
    const changedScore = intervalScore !== lastScore;
    lastScore = intervalScore;
    const majorEvents = events.filter((item) => item.isMajorEvent);
    const keyEvents = majorEvents.slice(0, 6).map((item) => item.description || cleanLabel(item.label) || item.phase || "Match update");
    const teams = fixture ? `${fixture.home} vs ${fixture.away}` : "The match";

    return {
      interval: intervalLabel(start, end),
      minuteStart: start,
      minuteEnd: end,
      headline: keyEvents[0] ?? "No major event published",
      summary:
        keyEvents.length > 0
          ? `${keyEvents.join("; ")}. Score context: ${intervalScore}.`
          : `${teams} had no published goal, card, substitution, or injury event in this window. Score context: ${intervalScore}.`,
      keyEvents,
      score: intervalScore,
      tone: fallbackTone(index, majorEvents.length, changedScore),
      source: "fallback",
    };
  });
}

function sanitizeIntervalSummary(value: unknown, fallback: IntervalSummary): IntervalSummary {
  if (!value || typeof value !== "object") return fallback;
  const record = value as Record<string, unknown>;
  const keyEvents = Array.isArray(record.keyEvents)
    ? record.keyEvents.map((event) => String(event).trim()).filter(Boolean).slice(0, 4)
    : fallback.keyEvents;
  const rawTone = String(record.tone ?? fallback.tone);
  const tone = ["quiet", "pressure", "turning-point", "decisive", "final"].includes(rawTone)
    ? (rawTone as IntervalSummary["tone"])
    : fallback.tone;
  const summary = typeof record.summary === "string" ? record.summary.trim() : "";
  const headline = typeof record.headline === "string" ? record.headline.trim() : "";
  const soundsLikePacketCounting = /(?:\b\d+\s+txline\s+updates\b|\bupdates?\s+in\s+this\s+window\b|\bhad\s+\d+\s+updates\b)/i;

  return {
    ...fallback,
    headline: headline && !soundsLikePacketCounting.test(headline) ? headline.slice(0, 90) : fallback.headline,
    summary: summary && !soundsLikePacketCounting.test(summary) ? summary.slice(0, 280) : fallback.summary,
    keyEvents,
    score: typeof record.score === "string" && record.score.trim() ? record.score.trim().slice(0, 20) : fallback.score,
    tone,
    source: "openrouter",
  };
}

export async function summarizeIntervalsWithOpenRouter({
  fixture,
  timeline,
}: {
  fixture: MatchStoryFixture | null;
  timeline: MatchTimelineItem[];
}) {
  const fallback = createFallbackIntervalSummaries({ fixture, timeline });
  const apiKey = process.env.OPENROUTER_KEY ?? process.env.OPENROUTER_API_KEY;
  if (!apiKey) return fallback;

  const compactEvents = timeline
    .filter((item) => item.isMajorEvent)
    .slice(0, 160)
    .map((item) => ({
      minute: item.minute !== null && item.minute !== undefined ? `${item.minute}'` : matchMinute(item.timestamp, fixture?.startTime) || item.phase || "",
      event: item.description || cleanLabel(item.label),
      action: cleanLabel(item.label),
      team: item.teamName,
      phase: item.phase,
      score: item.score,
      homeScore: item.homeScore,
      awayScore: item.awayScore,
    }));
  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
      "X-Title": "Atlas Match Intervals",
    },
    body: JSON.stringify({
      model: process.env.OPENROUTER_INTERVAL_MODEL ?? "cohere/north-mini-code:free",
      messages: [
        {
          role: "system",
          content:
              "You summarize football match data into kid-friendly cartoon-story intervals. Return strict JSON only. Mention concrete events: scorers, cards, substitutions, injuries, penalties, VAR when present. Do not invent players, goals, cards, exact minutes, or incidents not present in the provided events. Never summarize by saying how many updates happened.",
        },
        {
          role: "user",
          content: JSON.stringify({
            task:
              "Summarize this match into exactly 8 intervals: 0-15, 16-30, 31-45, 46-60, 61-75, 76-90, 91-105, 106-120. Each interval needs headline, summary, keyEvents, score, tone. Focus on what happened, who scored, who got cards, who was substituted, and injuries/penalties/VAR if present. If no major event exists, say no major event was published.",
            schema: {
              intervals: [
                {
                  interval: "0-15'",
                  headline: "short title",
                  summary: "1-2 sentences",
                  keyEvents: ["short factual event"],
                  score: "0-0",
                  tone: "quiet | pressure | turning-point | decisive | final",
                },
              ],
            },
            fixture,
            events: compactEvents,
            fallbackIntervals: fallback.map(({ interval, score, keyEvents }) => ({ interval, score, keyEvents })),
          }),
        },
      ],
      temperature: 0.35,
      response_format: { type: "json_object" },
    }),
  });

  if (!response.ok) return fallback;

  const payload = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const content = payload.choices?.[0]?.message?.content;
  if (!content) return fallback;

  try {
    const parsed = JSON.parse(content) as { intervals?: unknown[] };
    const intervals = Array.isArray(parsed.intervals) ? parsed.intervals : [];
    return fallback.map((item, index) => sanitizeIntervalSummary(intervals[index], item));
  } catch {
    return fallback;
  }
}

export function recordsFromPayload(payload: unknown) {
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

export function normalizeFixture(record: TxLineRecord): MatchStoryFixture | null {
  const id = readText(record, ["FixtureId", "fixtureId", "id", "eventId", "matchId"]);
  const home = readText(record, ["Participant1", "participant1", "homeTeam", "home", "homeName", "team1"]);
  const away = readText(record, ["Participant2", "participant2", "awayTeam", "away", "awayName", "team2"]);
  const competition = readText(
    record,
    ["Competition", "competitionName", "competition", "leagueName", "tournament", "Fixture", "fixture", "FixtureGroup", "fixtureGroup", "fixtureGroupName", "groupName"],
    "World Cup",
  );

  if (!id || !home || !away) return null;
  if (!/world cup|fifa/i.test(competition) || /friendly|friendlies/i.test(competition)) return null;

  const fixtureScore = scoreFromRecord(record);

  return {
    id,
    home,
    away,
    homeScore: fixtureScore.homeScore,
    awayScore: fixtureScore.awayScore,
    status: readText(record, ["GameState", "gameState", "status", "fixtureStatus", "state", "phase"], "FT"),
    competition,
    startTime: readTime(record),
  };
}

function dedupeFixtures(fixtures: MatchStoryFixture[]) {
  const fixtureMap = new Map<string, MatchStoryFixture>();

  for (const fixture of fixtures) {
    const existingFixture = fixtureMap.get(fixture.id);
    if (!existingFixture) {
      fixtureMap.set(fixture.id, fixture);
      continue;
    }

    const nextHasScore = fixture.homeScore !== null && fixture.awayScore !== null;
    const existingHasScore = existingFixture.homeScore !== null && existingFixture.awayScore !== null;
    if (nextHasScore && !existingHasScore) fixtureMap.set(fixture.id, fixture);
  }

  return Array.from(fixtureMap.values());
}

async function fetchFixtureScores(client: ReturnType<typeof createTxLineClient>, fixture: MatchStoryFixture) {
  if (fixture.homeScore !== null && fixture.awayScore !== null) return fixture;

  try {
    const historicalScores = await client.request<unknown>(`/scores/historical/${fixture.id}`);
    const score = latestScore(recordsFromPayload(historicalScores));
    if (score) return { ...fixture, homeScore: score.homeScore, awayScore: score.awayScore };
  } catch {
    // Some matches only expose score snapshots.
  }

  try {
    const snapshotScores = await client.request<unknown>(`/scores/snapshot/${fixture.id}`);
    const score = latestScore(recordsFromPayload(snapshotScores));
    if (score) return { ...fixture, homeScore: score.homeScore, awayScore: score.awayScore };
  } catch {
    return fixture;
  }

  return fixture;
}

export async function findFinishedWorldCupFixture(fixtureId: string) {
  const cleanFixtureId = fixtureId.trim();
  if (!cleanFixtureId) return null;

  const client = createTxLineClient();
  const todayEpochDay = Math.floor(Date.now() / MS_PER_DAY);
  const fixtureResponses = await Promise.all(
    Array.from({ length: LOOKBACK_DAYS }, (_, index) =>
      client
        .request<unknown>("/fixtures/snapshot", {
          query: { startEpochDay: todayEpochDay - index },
        })
        .catch(() => []),
    ),
  );
  const fixture = dedupeFixtures(
    fixtureResponses
      .flatMap(recordsFromPayload)
      .map(normalizeFixture)
      .filter((item): item is MatchStoryFixture => Boolean(item))
      .filter((item) => item.id === cleanFixtureId),
  )[0];

  if (!fixture) return null;
  const scoredFixture = await fetchFixtureScores(client, fixture);
  if (scoredFixture.homeScore === null || scoredFixture.awayScore === null) return null;
  if (scoredFixture.startTime && scoredFixture.startTime > Date.now()) return null;

  return scoredFixture as MatchStoryFixture & { homeScore: number; awayScore: number };
}
