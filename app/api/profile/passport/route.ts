import { NextRequest, NextResponse } from "next/server";
import { ensureGameSchema, requireGameDb, toDbFanProfile } from "@/lib/game-db";
import { resolveAtlasCountrySearch } from "@/lib/atlas-globe-data";

export const runtime = "nodejs";

type PassportBody = {
  owner?: string;
  wallet?: string;
  country?: string;
};

function cleanText(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

export async function GET(request: NextRequest) {
  try {
    const wallet = cleanText(request.nextUrl.searchParams.get("wallet"), 80);
    if (!wallet) return NextResponse.json({ profile: null });

    await ensureGameSchema();
    const db = requireGameDb();
    const rows = await db`
      select wallet, country, created_at, updated_at
      from fan_profiles
      where wallet = ${wallet}
      limit 1
    `;

    const profile = rows[0] ? toDbFanProfile(rows[0]) : null;
    return NextResponse.json({ profile: profile ? { owner: profile.wallet, country: profile.country, createdAt: profile.createdAt } : null });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not load fan profile." },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as PassportBody;
    const wallet = cleanText(body.wallet, 80) || cleanText(body.owner, 80);
    const country = resolveAtlasCountrySearch(cleanText(body.country, 80));

    if (!wallet || !country) {
      return NextResponse.json({ error: "Choose a valid country and connected wallet." }, { status: 400 });
    }

    await ensureGameSchema();
    const db = requireGameDb();
    const rows = await db`
      insert into fan_profiles (wallet, country)
      values (${wallet}, ${country})
      on conflict (wallet) do update
        set country = excluded.country,
            updated_at = now()
      returning wallet, country, created_at, updated_at
    `;

    const profile = toDbFanProfile(rows[0]);
    return NextResponse.json({ profile: { owner: profile.wallet, country: profile.country, createdAt: profile.createdAt } }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not save fan profile." },
      { status: 500 },
    );
  }
}
