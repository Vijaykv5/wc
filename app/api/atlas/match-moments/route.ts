import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

function cleanText(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

export async function GET(request: NextRequest) {
  const fixtureId = cleanText(request.nextUrl.searchParams.get("fixtureId"), 80);
  if (!fixtureId) return NextResponse.json({ error: "Missing fixtureId." }, { status: 400 });

  const url = new URL(`/api/atlas/match-story?fixtureId=${encodeURIComponent(fixtureId)}`, request.url);
  const response = await fetch(url, { cache: "no-store" });
  const payload = (await response.json().catch(() => ({}))) as {
    fixture?: unknown;
    stats?: unknown;
    moments?: unknown[];
    intervals?: unknown[];
    error?: string;
  };

  if (!response.ok) {
    return NextResponse.json({ error: payload.error ?? "Could not load match moments.", moments: [] }, { status: response.status });
  }

  return NextResponse.json({
    fixture: payload.fixture ?? null,
    stats: payload.stats ?? null,
    moments: Array.isArray(payload.moments) ? payload.moments : [],
    intervals: Array.isArray(payload.intervals) ? payload.intervals : [],
    source: "txline-structured",
  });
}
