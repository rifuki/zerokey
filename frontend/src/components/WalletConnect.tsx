import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";

export function WalletConnect() {
  const { publicKey, connected } = useWallet();

  return (
    <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
      <div>
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">
          Zerokey
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          SolAuth Dashboard
        </p>
      </div>
      <div className="flex items-center gap-3">
        {connected && publicKey && (
          <span className="text-xs font-mono bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded text-gray-600 dark:text-gray-300">
            {publicKey.toBase58().slice(0, 4)}...{publicKey.toBase58().slice(-4)}
          </span>
        )}
        <WalletMultiButton />
      </div>
    </div>
  );
}
