"use client";

import type { MintMemoryResult } from "@/lib/memory-nft";

export type MintedMemory = MintMemoryResult & {
  owner: string;
  title: string;
  name: string;
  country: string;
  note: string;
  mintedAt: string;
};

export type FanPassport = {
  owner: string;
  country: string;
  createdAt: string;
};

const STORAGE_PREFIX = "atlas:minted-memories:";
const PASSPORT_PREFIX = "atlas:fan-passport:";

function storageKey(owner: string) {
  return `${STORAGE_PREFIX}${owner}`;
}

function passportKey(owner: string) {
  return `${PASSPORT_PREFIX}${owner}`;
}

export function getMintedMemories(owner: string) {
  if (typeof window === "undefined") return [];

  try {
    const stored = window.localStorage.getItem(storageKey(owner));
    if (!stored) return [];
    const memories = JSON.parse(stored);
    return Array.isArray(memories) ? (memories as MintedMemory[]) : [];
  } catch {
    return [];
  }
}

export function saveMintedMemory(memory: MintedMemory) {
  if (typeof window === "undefined") return;

  const memories = getMintedMemories(memory.owner);
  const next = [memory, ...memories.filter((item) => item.asset !== memory.asset)].slice(0, 50);
  window.localStorage.setItem(storageKey(memory.owner), JSON.stringify(next));
}

export function getFanPassport(owner: string) {
  if (typeof window === "undefined") return null;

  try {
    const stored = window.localStorage.getItem(passportKey(owner));
    if (!stored) return null;
    const passport = JSON.parse(stored);
    return passport && typeof passport.country === "string" ? (passport as FanPassport) : null;
  } catch {
    return null;
  }
}

export function saveFanPassport(passport: FanPassport) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(passportKey(passport.owner), JSON.stringify(passport));
}

export async function fetchFanPassport(owner: string) {
  const response = await fetch(`/api/profile/passport?wallet=${encodeURIComponent(owner)}`, { cache: "no-store" });
  if (!response.ok) throw new Error("Could not load fan passport.");
  const payload = (await response.json()) as { profile: FanPassport | null };
  if (payload.profile) saveFanPassport(payload.profile);
  return payload.profile;
}

export async function persistFanPassport(passport: FanPassport) {
  saveFanPassport(passport);
  const response = await fetch("/api/profile/passport", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(passport),
  });
  if (!response.ok) throw new Error("Could not save fan passport.");
  const payload = (await response.json()) as { profile: FanPassport };
  saveFanPassport(payload.profile);
  return payload.profile;
}

export async function fetchMintedMemories(owner: string) {
  const response = await fetch(`/api/profile/memories?wallet=${encodeURIComponent(owner)}`, { cache: "no-store" });
  if (!response.ok) throw new Error("Could not load minted memories.");
  const payload = (await response.json()) as { memories: MintedMemory[]; source: string };
  return payload;
}

export async function persistMintedMemory(memory: MintedMemory) {
  saveMintedMemory(memory);
  const response = await fetch("/api/profile/memories", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(memory),
  });
  if (!response.ok) throw new Error("Could not save minted memory.");
}

export function shortAddress(address: string, chars = 4) {
  if (address.length <= chars * 2 + 3) return address;
  return `${address.slice(0, chars)}...${address.slice(-chars)}`;
}
