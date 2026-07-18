import { NextRequest, NextResponse } from "next/server";
import { clusterApiUrl } from "@solana/web3.js";
import { fetchAssetsByOwner, mplCore } from "@metaplex-foundation/mpl-core";
import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import { ensureGameSchema, requireGameDb, toDbMintedMemory, type DbMintedMemory } from "@/lib/game-db";
import { resolveAtlasCountrySearch } from "@/lib/atlas-globe-data";

export const runtime = "nodejs";

type MemoryBody = Omit<DbMintedMemory, "mintedAt"> & {
  mintedAt?: string;
};

type DasAsset = {
  id?: string;
  content?: {
    json_uri?: string;
    metadata?: {
      name?: string;
      description?: string;
      attributes?: Array<{ trait_type?: string; value?: string }>;
    };
    links?: {
      image?: string;
    };
  };
  ownership?: {
    owner?: string;
  };
};

function cleanText(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function attribute(asset: DasAsset, trait: string) {
  return asset.content?.metadata?.attributes?.find((item) => item.trait_type?.toLowerCase() === trait.toLowerCase())?.value ?? "";
}

function normalizeMemory(memory: DbMintedMemory) {
  return memory;
}

function metadataAttribute(metadata: unknown, trait: string) {
  if (!metadata || typeof metadata !== "object") return "";
  const attributes = (metadata as { attributes?: unknown }).attributes;
  if (!Array.isArray(attributes)) return "";
  const found = attributes.find((item) => {
    if (!item || typeof item !== "object") return false;
    return String((item as { trait_type?: unknown }).trait_type ?? "").toLowerCase() === trait.toLowerCase();
  });
  return found && typeof found === "object" ? String((found as { value?: unknown }).value ?? "") : "";
}

function metadataText(metadata: unknown, key: string) {
  if (!metadata || typeof metadata !== "object") return "";
  const value = (metadata as Record<string, unknown>)[key];
  return typeof value === "string" ? value : "";
}

function metadataImage(metadata: unknown) {
  const direct = metadataText(metadata, "image");
  if (direct) return direct;
  if (!metadata || typeof metadata !== "object") return "";
  const properties = (metadata as { properties?: unknown }).properties;
  if (!properties || typeof properties !== "object") return "";
  const files = (properties as { files?: unknown }).files;
  if (!Array.isArray(files)) return "";
  const file = files.find((item) => item && typeof item === "object" && typeof (item as { uri?: unknown }).uri === "string");
  return file && typeof file === "object" ? String((file as { uri?: unknown }).uri ?? "") : "";
}

async function loadDasMemories(owner: string): Promise<DbMintedMemory[]> {
  const endpoint = process.env.SOLANA_DAS_RPC_URL ?? process.env.NEXT_PUBLIC_SOLANA_DEVNET_RPC_URL ?? clusterApiUrl("devnet");
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: "atlas-memories",
      method: "getAssetsByOwner",
      params: {
        ownerAddress: owner,
        page: 1,
        limit: 100,
        sortBy: { sortBy: "created", sortDirection: "desc" },
        options: { showUnverifiedCollections: true, showCollectionMetadata: true, showGrandTotal: false },
      },
    }),
    cache: "no-store",
  });

  if (!response.ok) return [];
  const payload = (await response.json()) as { result?: { items?: DasAsset[] } };
  const assets = payload.result?.items ?? [];

  return assets
    .map((asset) => {
      const country = resolveAtlasCountrySearch(attribute(asset, "Country"));
      const memoryType = attribute(asset, "Memory Type");
      if (!asset.id || !country || memoryType.toLowerCase() !== "celebration") return null;

      return {
        asset: asset.id,
        owner,
        title: asset.content?.metadata?.name ?? "Atlas Memory",
        name: attribute(asset, "Creator Name") || "Fan",
        country,
        note: asset.content?.metadata?.description ?? "",
        imageUri: asset.content?.links?.image ?? "",
        metadataUri: asset.content?.json_uri ?? "",
        signature: "",
        explorerUrl: `https://explorer.solana.com/address/${asset.id}?cluster=devnet`,
        coreExplorerUrl: `https://core.metaplex.com/explorer/${asset.id}?env=devnet`,
        mintedAt: new Date().toISOString(),
      } satisfies DbMintedMemory;
    })
    .filter((memory): memory is DbMintedMemory => Boolean(memory));
}

async function loadCoreOwnerMemories(owner: string): Promise<DbMintedMemory[]> {
  const endpoint = process.env.NEXT_PUBLIC_SOLANA_DEVNET_RPC_URL ?? clusterApiUrl("devnet");
  const umi = createUmi(endpoint).use(mplCore());
  const assets = await fetchAssetsByOwner(umi, owner, { skipDerivePlugins: true });
  const candidates = assets.filter((asset) => asset.uri && asset.name);
  const results = await Promise.allSettled(
    candidates.map(async (asset) => {
      const assetAddress = String(asset.publicKey);
      const response = await fetch(asset.uri, { cache: "no-store" });
      if (!response.ok) return null;
      const metadata = (await response.json()) as unknown;
      const country = resolveAtlasCountrySearch(metadataAttribute(metadata, "Country"));
      const memoryType = metadataAttribute(metadata, "Memory Type");
      if (!country || memoryType.toLowerCase() !== "celebration") return null;

      return {
        asset: assetAddress,
        owner,
        title: metadataText(metadata, "name") || asset.name || "Atlas Memory",
        name: metadataAttribute(metadata, "Creator Name") || "Fan",
        country,
        note: metadataText(metadata, "description"),
        imageUri: metadataImage(metadata),
        metadataUri: asset.uri,
        signature: "",
        explorerUrl: `https://explorer.solana.com/address/${assetAddress}?cluster=devnet`,
        coreExplorerUrl: `https://core.metaplex.com/explorer/${assetAddress}?env=devnet`,
        mintedAt: new Date().toISOString(),
      } satisfies DbMintedMemory;
    }),
  );

  return results
    .map((result) => (result.status === "fulfilled" ? result.value : null))
    .filter((memory): memory is DbMintedMemory => Boolean(memory));
}

export async function GET(request: NextRequest) {
  try {
    const wallet = cleanText(request.nextUrl.searchParams.get("wallet"), 80);
    const country = resolveAtlasCountrySearch(cleanText(request.nextUrl.searchParams.get("country"), 80));
    if (!wallet && !country) return NextResponse.json({ memories: [], source: "empty" });

    await ensureGameSchema();
    const db = requireGameDb();

    if (country && !wallet) {
      const rows = await db`
        select asset, owner, title, name, country, note, image_uri, metadata_uri, signature, explorer_url, core_explorer_url, minted_at
        from minted_memories
        where country = ${country}
        order by minted_at desc
        limit 20
      `;

      return NextResponse.json({ memories: rows.map(toDbMintedMemory).map(normalizeMemory), source: "db" });
    }

    const rows = await db`
      select asset, owner, title, name, country, note, image_uri, metadata_uri, signature, explorer_url, core_explorer_url, minted_at
      from minted_memories
      where owner = ${wallet}
      order by minted_at desc
      limit 100
    `;
    const dbMemories = rows.map(toDbMintedMemory).map(normalizeMemory);
    const dasMemories = await loadDasMemories(wallet).catch(() => []);
    const coreMemories = dasMemories.length ? [] : await loadCoreOwnerMemories(wallet).catch(() => []);
    const chainMemories = [...dasMemories, ...coreMemories.filter((memory) => !dasMemories.some((item) => item.asset === memory.asset))];
    const merged = [...dbMemories, ...chainMemories.filter((memory) => !dbMemories.some((item) => item.asset === memory.asset))];

    return NextResponse.json({ memories: merged, source: chainMemories.length ? "db+chain" : "db" });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not load minted memories." },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as MemoryBody;
    const asset = cleanText(body.asset, 80);
    const owner = cleanText(body.owner, 80);
    const title = cleanText(body.title, 120) || "Atlas Memory";
    const name = cleanText(body.name, 80) || "Fan";
    const country = resolveAtlasCountrySearch(cleanText(body.country, 80));
    const note = cleanText(body.note, 500);
    const imageUri = cleanText(body.imageUri, 700);
    const metadataUri = cleanText(body.metadataUri, 700);
    const signature = cleanText(body.signature, 140);
    const explorerUrl = cleanText(body.explorerUrl, 700);
    const coreExplorerUrl = cleanText(body.coreExplorerUrl, 700);

    if (!asset || !owner || !country || !imageUri || !metadataUri || !signature) {
      return NextResponse.json({ error: "Invalid minted memory payload." }, { status: 400 });
    }

    await ensureGameSchema();
    const db = requireGameDb();
    const rows = await db`
      insert into minted_memories (
        asset, owner, title, name, country, note, image_uri, metadata_uri, signature, explorer_url, core_explorer_url, minted_at
      )
      values (
        ${asset}, ${owner}, ${title}, ${name}, ${country}, ${note}, ${imageUri}, ${metadataUri}, ${signature}, ${explorerUrl}, ${coreExplorerUrl}, now()
      )
      on conflict (asset) do update
        set title = excluded.title,
            name = excluded.name,
            country = excluded.country,
            note = excluded.note,
            image_uri = excluded.image_uri,
            metadata_uri = excluded.metadata_uri,
            signature = excluded.signature,
            explorer_url = excluded.explorer_url,
            core_explorer_url = excluded.core_explorer_url
      returning asset, owner, title, name, country, note, image_uri, metadata_uri, signature, explorer_url, core_explorer_url, minted_at
    `;

    return NextResponse.json({ memory: toDbMintedMemory(rows[0]) }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not save minted memory." },
      { status: 500 },
    );
  }
}
