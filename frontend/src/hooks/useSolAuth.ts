import { useMemo } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { createSolAuthClient, type SolAuthClient, type SignOptions } from "@zerokey/sdk";
import { walletToSigner } from "../lib/solauth-adapter";
import { useAppWallet } from "./useAppWallet";

/**
 * Hook: create a SolAuthClient from the best available signer.
 *
 * Priority:
 * 1. App wallet (auto-sign, 0 popup) — if active
 * 2. Main wallet (popup per request) — fallback
 */
export function useSolAuth(defaults?: SignOptions): SolAuthClient | null {
  const wallet = useWallet();
  const appWallet = useAppWallet();

  return useMemo(() => {
    // Priority 1: app wallet (non-extractable, auto-sign)
    if (appWallet.isActive) {
      const signer = appWallet.getSigner();
      if (signer) return createSolAuthClient(signer, defaults);
    }

    // Priority 2: main wallet (popup per request)
    const signer = walletToSigner(wallet);
    if (!signer) return null;
    return createSolAuthClient(signer, defaults);
  }, [wallet.publicKey, wallet.signMessage, appWallet.isActive, appWallet.getSigner, defaults]);
}
