import { neon } from "@neondatabase/serverless";

export type DbComment = {
  id: string;
  fixtureId: string;
  wallet: string | null;
  author: string;
  countryFlag: string;
  message: string;
  imageUrl: string | null;
  imageName: string | null;
  createdAt: string;
};

export type DbRoundHistory = {
  id: string;
  fixtureId: string;
  wallet: string | null;
  countryName: string;
  countryFlag: string;
  round: number;
  answer: string;
  correctAnswer: string;
  result: string;
  signature: string | null;
  proofMode: string;
  createdAt: string;
};

export type DbLeaderboardEntry = {
  wallet: string;
  handle: string;
  countryName: string;
  countryFlag: string;
  survivedRounds: number;
  shardRounds: number;
  totalRounds: number;
};

export type DbFanProfile = {
  wallet: string;
  country: string;
  createdAt: string;
  updatedAt: string;
};

export type DbMintedMemory = {
  asset: string;
  owner: string;
  title: string;
  name: string;
  country: string;
  note: string;
  imageUri: string;
  metadataUri: string;
  signature: string;
  explorerUrl: string;
  coreExplorerUrl: string;
  mintedAt: string;
};

const databaseUrl = process.env.DB ?? process.env.DATABASE_URL;
const sql = databaseUrl ? neon(databaseUrl) : null;
let schemaReady: Promise<void> | null = null;

export function hasGameDb() {
  return Boolean(sql);
}

export function requireGameDb() {
  if (!sql) {
    throw new Error("Database is not configured. Add DB or DATABASE_URL to the environment.");
  }

  return sql;
}

export async function ensureGameSchema() {
  const db = requireGameDb();
  schemaReady ??= (async () => {
    await db`
      create table if not exists fan_comments (
        id text primary key,
        fixture_id text not null,
        wallet text,
        author text not null,
        country_flag text not null default '⚽',
        message text not null default '',
        image_url text,
        image_name text,
        created_at timestamptz not null default now()
      )
    `;

    await db`
      create index if not exists fan_comments_fixture_created_idx
      on fan_comments (fixture_id, created_at desc)
    `;

    await db`
      create table if not exists round_history (
        id text primary key,
        fixture_id text not null,
        wallet text,
        country_name text not null default 'Global',
        country_flag text not null default '⚽',
        round integer not null,
        answer text not null,
        correct_answer text not null,
        result text not null,
        signature text,
        proof_mode text not null default 'onchain',
        created_at timestamptz not null default now()
      )
    `;

    await db`
      create index if not exists round_history_fixture_wallet_created_idx
      on round_history (fixture_id, wallet, created_at desc)
    `;

    await db`
      create index if not exists round_history_fixture_result_idx
      on round_history (fixture_id, result)
    `;

    await db`
      create table if not exists fan_profiles (
        wallet text primary key,
        country text not null,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      )
    `;

    await db`
      create table if not exists minted_memories (
        asset text primary key,
        owner text not null,
        title text not null,
        name text not null,
        country text not null,
        note text not null default '',
        image_uri text not null,
        metadata_uri text not null,
        signature text not null,
        explorer_url text not null,
        core_explorer_url text not null,
        minted_at timestamptz not null default now()
      )
    `;

    await db`
      create index if not exists minted_memories_owner_minted_idx
      on minted_memories (owner, minted_at desc)
    `;

    await db`
      create index if not exists minted_memories_country_minted_idx
      on minted_memories (country, minted_at desc)
    `;
  })();

  return schemaReady;
}

function asIso(value: unknown) {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string") return new Date(value).toISOString();
  return new Date().toISOString();
}

function asString(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function asNumber(value: unknown, fallback = 0) {
  if (typeof value === "number") return value;
  if (typeof value === "bigint") return Number(value);
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

export function toDbComment(row: Record<string, unknown>): DbComment {
  return {
    id: asString(row.id),
    fixtureId: asString(row.fixture_id),
    wallet: row.wallet === null ? null : asString(row.wallet),
    author: asString(row.author, "Fan"),
    countryFlag: asString(row.country_flag, "⚽"),
    message: asString(row.message),
    imageUrl: row.image_url === null ? null : asString(row.image_url),
    imageName: row.image_name === null ? null : asString(row.image_name),
    createdAt: asIso(row.created_at),
  };
}

export function toDbRoundHistory(row: Record<string, unknown>): DbRoundHistory {
  return {
    id: asString(row.id),
    fixtureId: asString(row.fixture_id),
    wallet: row.wallet === null ? null : asString(row.wallet),
    countryName: asString(row.country_name, "Global"),
    countryFlag: asString(row.country_flag, "⚽"),
    round: asNumber(row.round),
    answer: asString(row.answer),
    correctAnswer: asString(row.correct_answer),
    result: asString(row.result),
    signature: row.signature === null ? null : asString(row.signature),
    proofMode: asString(row.proof_mode, "onchain"),
    createdAt: asIso(row.created_at),
  };
}

export function toDbLeaderboardEntry(row: Record<string, unknown>): DbLeaderboardEntry {
  const wallet = asString(row.wallet, "guest");
  return {
    wallet,
    handle: wallet.length > 10 ? `${wallet.slice(0, 4)}...${wallet.slice(-4)}` : wallet,
    countryName: asString(row.country_name, "Global"),
    countryFlag: asString(row.country_flag, "⚽"),
    survivedRounds: asNumber(row.survived_rounds),
    shardRounds: asNumber(row.shard_rounds),
    totalRounds: asNumber(row.total_rounds),
  };
}

export function toDbFanProfile(row: Record<string, unknown>): DbFanProfile {
  return {
    wallet: asString(row.wallet),
    country: asString(row.country, "Argentina"),
    createdAt: asIso(row.created_at),
    updatedAt: asIso(row.updated_at),
  };
}

export function toDbMintedMemory(row: Record<string, unknown>): DbMintedMemory {
  return {
    asset: asString(row.asset),
    owner: asString(row.owner),
    title: asString(row.title, "Atlas Memory"),
    name: asString(row.name, "Fan"),
    country: asString(row.country, "Global"),
    note: asString(row.note),
    imageUri: asString(row.image_uri),
    metadataUri: asString(row.metadata_uri),
    signature: asString(row.signature),
    explorerUrl: asString(row.explorer_url),
    coreExplorerUrl: asString(row.core_explorer_url),
    mintedAt: asIso(row.minted_at),
  };
}
