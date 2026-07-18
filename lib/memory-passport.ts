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

const STORAGE_PREFIX = "atlas:minted-memories:";

function storageKey(owner: string) {
  return `${STORAGE_PREFIX}${owner}`;
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

export function shortAddress(address: string, chars = 4) {
  if (address.length <= chars * 2 + 3) return address;
  return `${address.slice(0, chars)}...${address.slice(-chars)}`;
}
