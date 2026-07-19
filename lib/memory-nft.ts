"use client";

import { createV1, mplCore } from "@metaplex-foundation/mpl-core";
import { createGenericFileFromBrowserFile, generateSigner, publicKey as umiPublicKey, type WrappedInstruction } from "@metaplex-foundation/umi";
import { base58 } from "@metaplex-foundation/umi/serializers";
import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import { walletAdapterIdentity } from "@metaplex-foundation/umi-signer-wallet-adapters";
import { irysUploader } from "@metaplex-foundation/umi-uploader-irys";
import { clusterApiUrl, PublicKey } from "@solana/web3.js";
import type { WalletContextState } from "@solana/wallet-adapter-react";
import { buildRegisterMemoryInstruction, FANIQ_PASSPORT_PROGRAM_ID } from "@/lib/faniq-passport-program";

export type MintMemoryInput = {
  wallet: WalletContextState;
  title: string;
  name: string;
  country: string;
  note: string;
  image: File;
  passportPublicKey?: string;
  onStatus?: (status: string) => void;
};

export type MintMemoryResult = {
  asset: string;
  signature: string;
  imageUri: string;
  metadataUri: string;
  passport: string | null;
  memoryRecord: string | null;
  explorerUrl: string;
  coreExplorerUrl: string;
};

const DEVNET_RPC_URL = process.env.NEXT_PUBLIC_SOLANA_DEVNET_RPC_URL ?? clusterApiUrl("devnet");

function toUmiInstruction(item: ReturnType<typeof buildRegisterMemoryInstruction>): WrappedInstruction {
  return {
    instruction: {
      programId: umiPublicKey(item.instruction.programId.toBase58()),
      keys: item.instruction.keys.map((key) => ({
        pubkey: umiPublicKey(key.pubkey.toBase58()),
        isSigner: key.isSigner,
        isWritable: key.isWritable,
      })),
      data: item.instruction.data,
    },
    signers: [],
    bytesCreatedOnChain: 0,
  };
}

export async function mintMemoryNft({ wallet, title, name, country, note, image, passportPublicKey, onStatus }: MintMemoryInput): Promise<MintMemoryResult> {
  if (!wallet.connected || !wallet.publicKey || !wallet.signTransaction) {
    throw new Error("Connect a wallet that can sign transactions.");
  }
  if (!image.type.startsWith("image/")) {
    throw new Error("Upload an image file for this memory.");
  }
  if (image.size > 8 * 1024 * 1024) {
    throw new Error("Keep the image under 8 MB so it can upload cleanly.");
  }

  const umi = createUmi(DEVNET_RPC_URL)
    .use(mplCore())
    .use(walletAdapterIdentity(wallet))
    .use(
      irysUploader({
        address: "https://devnet.irys.xyz",
        providerUrl: DEVNET_RPC_URL,
      }),
    );
  const imageFile = await createGenericFileFromBrowserFile(image, {
    displayName: image.name,
    contentType: image.type || "image/png",
  });
  onStatus?.("Uploading your celebration image...");
  const [imageUri] = await umi.uploader.upload([imageFile]);
  onStatus?.("Saving memory metadata...");
  const metadataUri = await umi.uploader.uploadJson({
    name: title,
    description: note || `${name} minted a ${country} fan memory on FANIQ.`,
    image: imageUri,
    attributes: [
      { trait_type: "Country", value: country },
      { trait_type: "Creator Name", value: name },
      { trait_type: "Memory Type", value: "Celebration" },
      { trait_type: "Network", value: "Solana Devnet" },
      { trait_type: "Fan Passport", value: passportPublicKey ?? "FANIQ Passport" },
      { trait_type: "Passport Program", value: FANIQ_PASSPORT_PROGRAM_ID },
    ],
    properties: {
      category: "image",
      files: [{ uri: imageUri, type: image.type || "image/png" }],
    },
  });
  const asset = generateSigner(umi);
  const owner = wallet.publicKey;
  const memoryLink = buildRegisterMemoryInstruction({
    owner,
    memoryCountry: country,
    nftMint: new PublicKey(asset.publicKey),
    metadataUri,
  });

  onStatus?.("Minting and linking your memory...");
  const tx = await createV1(umi, {
    asset,
    authority: umi.identity,
    owner: umi.identity.publicKey,
    name: title,
    uri: metadataUri,
  }).add(toUmiInstruction(memoryLink)).sendAndConfirm(umi, {
    confirm: { commitment: "confirmed" },
  });
  const signature = base58.deserialize(tx.signature)[0];

  return {
    asset: asset.publicKey,
    signature,
    imageUri,
    metadataUri,
    passport: memoryLink.passport.toBase58(),
    memoryRecord: memoryLink.memory.toBase58(),
    explorerUrl: `https://explorer.solana.com/tx/${signature}?cluster=devnet`,
    coreExplorerUrl: `https://core.metaplex.com/explorer/${asset.publicKey}?env=devnet`,
  };
}
