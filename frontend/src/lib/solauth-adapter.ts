import type { WalletContextState } from "@solana/wallet-adapter-react";
import type { SolAuthSigner } from "@zerokey/sdk";

/**
 * Bridge from Solana wallet-adapter to SolAuthSigner.
 * This lets the SDK sign HTTP requests using the connected wallet.
 */
export function walletToSigner(wallet: WalletContextState): SolAuthSigner | null {
  if (!wallet.publicKey || !wallet.signMessage) return null;

  const publicKey = wallet.publicKey.toBase58();
  const signMessage = wallet.signMessage;

  return {
    publicKey,
    signMessage: async (message: Uint8Array) => {
      return await signMessage(message);
    },
  };
}
