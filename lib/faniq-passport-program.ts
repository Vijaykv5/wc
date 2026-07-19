"use client";

import {
  clusterApiUrl,
  Connection,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
} from "@solana/web3.js";
import type { WalletContextState } from "@solana/wallet-adapter-react";
import { Buffer } from "buffer";

export type OnChainFanPassport = {
  owner: string;
  country: string;
  createdAt: string;
  publicKey: string;
  bump: number;
};

export const FANIQ_PASSPORT_PROGRAM_ID = process.env.NEXT_PUBLIC_FANIQ_PASSPORT_PROGRAM_ID ?? "FANXexs6P2Fst4NiiCdH9jx39sxPCGRRVpC2nevL5C6U";
const PROGRAM_ID = new PublicKey(FANIQ_PASSPORT_PROGRAM_ID);
const DEVNET_RPC_URL = process.env.NEXT_PUBLIC_SOLANA_DEVNET_RPC_URL ?? clusterApiUrl("devnet");
const ACCOUNT_DISCRIMINATORS = {
  fanPassport: [1, 142, 231, 244, 34, 226, 199, 176],
};
const INSTRUCTION_DISCRIMINATORS = {
  createPassport: [107, 136, 98, 163, 167, 217, 174, 84],
  registerMemory: [76, 186, 130, 224, 108, 156, 185, 253],
};

function connection() {
  return new Connection(DEVNET_RPC_URL, "confirmed");
}

function encodeString(value: string) {
  const encoded = new TextEncoder().encode(value);
  const buffer = new Uint8Array(4 + encoded.length);
  new DataView(buffer.buffer).setUint32(0, encoded.length, true);
  buffer.set(encoded, 4);
  return buffer;
}

function concatBytes(chunks: Uint8Array[]) {
  const length = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const buffer = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    buffer.set(chunk, offset);
    offset += chunk.length;
  }
  return buffer;
}

function readString(data: Buffer, offset: number) {
  const length = data.readUInt32LE(offset);
  const start = offset + 4;
  const end = start + length;
  return {
    value: data.subarray(start, end).toString("utf8"),
    offset: end,
  };
}

function readI64(data: Buffer, offset: number) {
  return Number(data.readBigInt64LE(offset));
}

function assertWallet(wallet: WalletContextState) {
  if (!wallet.connected || !wallet.publicKey || !wallet.sendTransaction) {
    throw new Error("Connect a wallet that can send Solana transactions.");
  }
}

async function assertProgramDeployed(rpc: Connection) {
  const programAccount = await rpc.getAccountInfo(PROGRAM_ID, "confirmed");
  if (!programAccount?.executable) {
    throw new Error(
      `FANIQ passport program is not deployed on devnet yet. Deploy ${PROGRAM_ID.toBase58()} before stamping passports or minting memories.`,
    );
  }
}

export function passportPda(owner: PublicKey) {
  return PublicKey.findProgramAddressSync([Buffer.from("passport"), owner.toBuffer()], PROGRAM_ID);
}

export function memoryPda(owner: PublicKey, nftMint: PublicKey) {
  return PublicKey.findProgramAddressSync([Buffer.from("memory"), owner.toBuffer(), nftMint.toBuffer()], PROGRAM_ID);
}

export function buildRegisterMemoryInstruction({
  owner,
  memoryCountry,
  nftMint,
  metadataUri,
}: {
  owner: PublicKey;
  memoryCountry: string;
  nftMint: PublicKey;
  metadataUri: string;
}) {
  const [passportKey] = passportPda(owner);
  const [memory] = memoryPda(owner, nftMint);

  return {
    passport: passportKey,
    memory,
    instruction: new TransactionInstruction({
      programId: PROGRAM_ID,
      keys: [
        { pubkey: owner, isSigner: true, isWritable: true },
        { pubkey: passportKey, isSigner: false, isWritable: false },
        { pubkey: memory, isSigner: false, isWritable: true },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ],
      data: Buffer.from(
        concatBytes([
          Uint8Array.from(INSTRUCTION_DISCRIMINATORS.registerMemory),
          encodeString(memoryCountry),
          nftMint.toBytes(),
          encodeString(metadataUri),
        ]),
      ),
    }),
  };
}

export async function fetchOnChainFanPassport(owner: PublicKey): Promise<OnChainFanPassport | null> {
  const [passport] = passportPda(owner);
  const account = await connection().getAccountInfo(passport, "confirmed");
  if (!account) return null;

  const data = account.data;
  const expected = Buffer.from(ACCOUNT_DISCRIMINATORS.fanPassport);
  if (!data.subarray(0, 8).equals(expected)) {
    throw new Error("Found an account at the passport address, but it is not a FANIQ passport.");
  }

  const accountOwner = new PublicKey(data.subarray(8, 40));
  const country = readString(data, 40);
  const createdAt = readI64(data, country.offset);
  const bump = data[country.offset + 8] ?? 0;

  return {
    owner: accountOwner.toBase58(),
    country: country.value,
    createdAt: new Date(createdAt * 1000).toISOString(),
    publicKey: passport.toBase58(),
    bump,
  };
}

export async function createFanPassportOnChain({
  wallet,
  country,
  onStatus,
}: {
  wallet: WalletContextState;
  country: string;
  onStatus?: (status: string) => void;
}) {
  assertWallet(wallet);
  const owner = wallet.publicKey!;
  const rpc = connection();
  await assertProgramDeployed(rpc);
  const existing = await fetchOnChainFanPassport(owner);
  if (existing) return { passport: existing, signature: null };

  const [passport] = passportPda(owner);
  const tx = new Transaction().add(
    new TransactionInstruction({
      programId: PROGRAM_ID,
      keys: [
        { pubkey: owner, isSigner: true, isWritable: true },
        { pubkey: passport, isSigner: false, isWritable: true },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ],
      data: Buffer.from(
        concatBytes([
          Uint8Array.from(INSTRUCTION_DISCRIMINATORS.createPassport),
          encodeString(country),
        ]),
      ),
    }),
  );

  onStatus?.("Stamping passport on devnet...");
  let signature: string;
  try {
    signature = await wallet.sendTransaction(tx, rpc);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Wallet could not send the passport transaction.";
    throw new Error(message.includes("Internal error") ? "Wallet could not simulate the passport transaction. Make sure the FANIQ passport program is deployed on devnet." : message);
  }
  await rpc.confirmTransaction(signature, "confirmed");
  const passportAccount = await fetchOnChainFanPassport(owner);
  if (!passportAccount) throw new Error("Passport transaction confirmed, but the passport account was not found yet.");
  return { passport: passportAccount, signature };
}

export async function registerMemoryOnChain({
  wallet,
  memoryCountry,
  nftMint,
  metadataUri,
  onStatus,
}: {
  wallet: WalletContextState;
  memoryCountry: string;
  nftMint: string;
  metadataUri: string;
  onStatus?: (status: string) => void;
}) {
  assertWallet(wallet);
  const owner = wallet.publicKey!;
  const rpc = connection();
  await assertProgramDeployed(rpc);
  const passport = await fetchOnChainFanPassport(owner);
  if (!passport) throw new Error("Create your FANIQ fan passport before minting a memory.");

  const nftMintKey = new PublicKey(nftMint);
  const { passport: passportKey, memory, instruction } = buildRegisterMemoryInstruction({
    owner,
    memoryCountry,
    nftMint: nftMintKey,
    metadataUri,
  });
  const existingMemory = await rpc.getAccountInfo(memory, "confirmed");
  if (existingMemory) return { signature: null, memory: memory.toBase58(), passport: passportKey.toBase58() };

  const tx = new Transaction().add(instruction);

  onStatus?.("Linking memory to your passport...");
  let signature: string;
  try {
    signature = await wallet.sendTransaction(tx, rpc);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Wallet could not send the memory registration transaction.";
    throw new Error(message.includes("Internal error") ? "Wallet could not simulate the memory registration. Make sure the FANIQ passport program is deployed on devnet." : message);
  }
  await rpc.confirmTransaction(signature, "confirmed");
  return { signature, memory: memory.toBase58(), passport: passportKey.toBase58() };
}
