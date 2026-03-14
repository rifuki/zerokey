import { useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useAppWallet } from "../hooks/useAppWallet";
import { Scope } from "@zerokey/sdk";

export function AutoSignToggle() {
  const { connected } = useWallet();
  const appWallet = useAppWallet();

  const [scope, setScope] = useState(Scope.READ | Scope.WRITE);
  const [ttl, setTtl] = useState("3600");
  const [error, setError] = useState<string | null>(null);

  if (!connected) return null;

  const handleEnable = async () => {
    setError(null);
    try {
      await appWallet.enable(scope, parseInt(ttl));
    } catch (err: any) {
      setError(err.message || "Failed to enable auto-sign");
    }
  };

  if (appWallet.isActive) {
    return (
      <div className="bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            <span className="text-sm font-medium text-green-700 dark:text-green-300">
              AUTO-SIGN ENABLED
            </span>
          </div>
          <button
            onClick={appWallet.disable}
            className="text-xs px-3 py-1 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded hover:bg-red-200 dark:hover:bg-red-900/50"
          >
            Disable
          </button>
        </div>
        <div className="mt-2 text-xs text-green-600 dark:text-green-400 font-mono">
          {appWallet.publicKey?.slice(0, 8)}...{appWallet.publicKey?.slice(-8)}
          {" · "}
          expires in {appWallet.timeRemaining}
        </div>
        <p className="mt-2 text-xs text-green-600/70 dark:text-green-400/70">
          Private key non-extractable (Web Crypto). Requests signed automatically.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
      <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
        Auto-Sign (App Wallet)
      </h3>
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
        Generate a non-extractable Ed25519 keypair in your browser. Your main
        wallet grants access to it on-chain (1 popup). All subsequent requests
        are signed automatically.
      </p>

      <div className="flex gap-3 mb-3">
        <div className="flex-1">
          <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
            Scope
          </label>
          <select
            value={scope}
            onChange={(e) => setScope(parseInt(e.target.value))}
            className="w-full px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-900 text-sm text-gray-900 dark:text-white"
          >
            <option value={Scope.READ}>READ (1)</option>
            <option value={Scope.READ | Scope.WRITE}>READ + WRITE (3)</option>
            <option value={Scope.READ | Scope.WRITE | Scope.DELETE}>
              READ + WRITE + DELETE (7)
            </option>
            <option value={0x0f}>Full Access (15)</option>
          </select>
        </div>
        <div className="flex-1">
          <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
            TTL
          </label>
          <select
            value={ttl}
            onChange={(e) => setTtl(e.target.value)}
            className="w-full px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-900 text-sm text-gray-900 dark:text-white"
          >
            <option value="300">5 minutes</option>
            <option value="1800">30 minutes</option>
            <option value="3600">1 hour</option>
            <option value="7200">2 hours</option>
          </select>
        </div>
      </div>

      <button
        onClick={handleEnable}
        disabled={appWallet.isLoading}
        className="w-full px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
      >
        {appWallet.isLoading ? "Generating keypair..." : "Enable Auto-Sign"}
      </button>

      {error && (
        <p className="mt-2 text-xs text-red-600 dark:text-red-400">{error}</p>
      )}
    </div>
  );
}
