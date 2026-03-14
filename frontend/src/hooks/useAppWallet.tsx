import {
  useState,
  useEffect,
  useCallback,
  useRef,
  createContext,
  useContext,
  type ReactNode,
} from "react";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { PublicKey, Transaction, SystemProgram } from "@solana/web3.js";
import {
  createAppWallet,
  saveAppWallet,
  loadAppWallet,
  clearAppWallet,
  appWalletToSigner,
  ZEROKEY_PROGRAM_ID,
  type AppWallet,
  type SolAuthSigner,
} from "@zerokey/sdk";

// Anchor discriminator: sha256("global:grant_access")[..8]
const GRANT_DISCRIMINATOR = new Uint8Array([66, 88, 87, 113, 39, 22, 27, 165]);

export interface AppWalletState {
  isActive: boolean;
  isLoading: boolean;
  publicKey: string | null;
  expiresAt: number | null;
  timeRemaining: string;
  enable: (scope: number, ttlSeconds?: number) => Promise<void>;
  disable: () => Promise<void>;
  getSigner: () => SolAuthSigner | null;
}

const AppWalletContext = createContext<AppWalletState | null>(null);

/**
 * Provider: wraps the app to share app wallet state globally.
 */
export function AppWalletProvider({ children }: { children: ReactNode }) {
  const wallet = useWallet();
  const { connection } = useConnection();

  const [appWallet, setAppWallet] = useState<AppWallet | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const signerRef = useRef<SolAuthSigner | null>(null);

  // Load existing app wallet from IndexedDB on mount
  useEffect(() => {
    loadAppWallet()
      .then((stored) => {
        if (stored) {
          setAppWallet(stored);
          signerRef.current = appWalletToSigner(stored);
        }
      })
      .finally(() => setIsLoading(false));
  }, []);

  // Countdown timer
  const [timeRemaining, setTimeRemaining] = useState("");
  useEffect(() => {
    if (!appWallet) {
      setTimeRemaining("");
      return;
    }

    const update = () => {
      const remaining = Math.max(0, appWallet.expiresAt - Date.now());
      if (remaining <= 0) {
        setAppWallet(null);
        signerRef.current = null;
        clearAppWallet();
        setTimeRemaining("expired");
        return;
      }
      const mins = Math.floor(remaining / 60_000);
      const secs = Math.floor((remaining % 60_000) / 1000);
      setTimeRemaining(`${mins}m ${secs.toString().padStart(2, "0")}s`);
    };

    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [appWallet]);

  // Enable auto-sign: generate app wallet + grant on-chain
  const enable = useCallback(
    async (scope: number, ttlSeconds: number = 3600) => {
      if (!wallet.publicKey || !wallet.sendTransaction) {
        throw new Error("Wallet not connected");
      }

      setIsLoading(true);
      try {
        // 1. Generate non-extractable keypair
        const newWallet = await createAppWallet(ttlSeconds * 1000);

        // 2. Save to IndexedDB
        await saveAppWallet(newWallet);

        // 3. Grant access on-chain (1 popup)
        const granteePubkey = new PublicKey(newWallet.publicKeyBase58);
        const [accessGrantPda] = PublicKey.findProgramAddressSync(
          [
            Buffer.from("access"),
            wallet.publicKey.toBuffer(),
            granteePubkey.toBuffer(),
          ],
          ZEROKEY_PROGRAM_ID
        );

        const expiresAt = Math.floor(Date.now() / 1000) + ttlSeconds;

        // Build instruction data: discriminator + scope(u8) + expires_at(i64)
        const data = Buffer.alloc(8 + 1 + 8);
        data.set(GRANT_DISCRIMINATOR, 0);
        data.writeUInt8(scope, 8);
        data.writeBigInt64LE(BigInt(expiresAt), 9);

        const ix = {
          programId: ZEROKEY_PROGRAM_ID,
          keys: [
            { pubkey: wallet.publicKey, isSigner: true, isWritable: true },
            { pubkey: granteePubkey, isSigner: false, isWritable: false },
            { pubkey: accessGrantPda, isSigner: false, isWritable: true },
            {
              pubkey: SystemProgram.programId,
              isSigner: false,
              isWritable: false,
            },
          ],
          data,
        };

        const tx = new Transaction().add(ix);
        const sig = await wallet.sendTransaction(tx, connection);
        await connection.confirmTransaction(sig, "confirmed");

        // 4. Activate
        setAppWallet(newWallet);
        signerRef.current = appWalletToSigner(newWallet);
      } catch (err) {
        await clearAppWallet();
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [wallet, connection]
  );

  // Disable auto-sign
  const disable = useCallback(async () => {
    await clearAppWallet();
    setAppWallet(null);
    signerRef.current = null;
  }, []);

  const getSigner = useCallback((): SolAuthSigner | null => {
    return signerRef.current;
  }, []);

  const value: AppWalletState = {
    isActive: appWallet !== null,
    isLoading,
    publicKey: appWallet?.publicKeyBase58 ?? null,
    expiresAt: appWallet?.expiresAt ?? null,
    timeRemaining,
    enable,
    disable,
    getSigner,
  };

  return (
    <AppWalletContext.Provider value={value}>
      {children}
    </AppWalletContext.Provider>
  );
}

/**
 * Hook: access shared app wallet state.
 */
export function useAppWallet(): AppWalletState {
  const ctx = useContext(AppWalletContext);
  if (!ctx) {
    throw new Error("useAppWallet must be used within AppWalletProvider");
  }
  return ctx;
}
