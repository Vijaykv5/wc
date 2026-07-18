"use client";

import { createV1, mplCore } from "@metaplex-foundation/mpl-core";
import { createGenericFileFromBrowserFile, generateSigner } from "@metaplex-foundation/umi";
import { base58 } from "@metaplex-foundation/umi/serializers";
import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import { walletAdapterIdentity } from "@metaplex-foundation/umi-signer-wallet-adapters";
import { irysUploader } from "@metaplex-foundation/umi-uploader-irys";
import { clusterApiUrl } from "@solana/web3.js";
import type { WalletContextState } from "@solana/wallet-adapter-react";

export type MintMemoryInput = {
  wallet: WalletContextState;
  title: string;
  name: string;
  country: string;
  note: string;
  image: File;
  onStatus?: (status: string) => void;
};

export type MintMemoryResult = {
  asset: string;
  signature: string;
  imageUri: string;
  metadataUri: string;
  explorerUrl: string;
  coreExplorerUrl: string;
};

const DEVNET_RPC_URL = process.env.NEXT_PUBLIC_SOLANA_DEVNET_RPC_URL ?? clusterApiUrl("devnet");

export async function mintMemoryNft({ wallet, title, name, country, note, image, onStatus }: MintMemoryInput): Promise<MintMemoryResult> {
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
  onStatus?.("Uploading memory...");
  const [imageUri] = await umi.uploader.upload([imageFile]);
  onStatus?.("Preparing NFT...");
  const metadataUri = await umi.uploader.uploadJson({
    name: title,
    description: note || `${name} minted a ${country} fan memory on Atlas.`,
    image: imageUri,
    attributes: [
      { trait_type: "Country", value: country },
      { trait_type: "Creator Name", value: name },
      { trait_type: "Memory Type", value: "Celebration" },
      { trait_type: "Network", value: "Solana Devnet" },
    ],
    properties: {
      category: "image",
      files: [{ uri: imageUri, type: image.type || "image/png" }],
    },
  });
  const asset = generateSigner(umi);
  onStatus?.("Minting memory...");
  const tx = await createV1(umi, {
    asset,
    authority: umi.identity,
    owner: umi.identity.publicKey,
    name: title,
    uri: metadataUri,
  }).sendAndConfirm(umi, {
    confirm: { commitment: "confirmed" },
  });
  const signature = base58.deserialize(tx.signature)[0];

  return {
    asset: asset.publicKey,
    signature,
    imageUri,
    metadataUri,
    explorerUrl: `https://explorer.solana.com/tx/${signature}?cluster=devnet`,
    coreExplorerUrl: `https://core.metaplex.com/explorer/${asset.publicKey}?env=devnet`,
  };
}
