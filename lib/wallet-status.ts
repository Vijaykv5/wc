import type { PublicKey } from "@solana/web3.js";

export type WalletConnectionStatus = {
  connected: boolean;
  publicKey: PublicKey | null;
};

export function isWalletConnected(wallet: WalletConnectionStatus) {
  return wallet.connected && Boolean(wallet.publicKey);
}

export function walletConnectionMessage(wallet: WalletConnectionStatus) {
  return isWalletConnected(wallet) ? "Wallet connected" : "Connect your wallet to mint a memory.";
}
