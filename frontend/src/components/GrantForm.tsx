import { useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useGrantAccess } from "../hooks/useGrantAccess";
import { Scope } from "@zerokey/sdk";

export function GrantForm() {
  const { connected } = useWallet();
  const grantAccess = useGrantAccess();

  const [grantee, setGrantee] = useState("");
  const [scopes, setScopes] = useState({ read: true, write: false, delete: false, admin: false });
  const [expiresIn, setExpiresIn] = useState("0"); // 0 = never

  const scopeValue =
    (scopes.read ? Scope.READ : 0) |
    (scopes.write ? Scope.WRITE : 0) |
    (scopes.delete ? Scope.DELETE : 0) |
    (scopes.admin ? Scope.ADMIN : 0);

  const expiresAt = expiresIn === "0" ? 0 : Math.floor(Date.now() / 1000) + parseInt(expiresIn);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!grantee.trim()) return;
    grantAccess.mutate({ grantee: grantee.trim(), scope: scopeValue, expiresAt });
  };

  if (!connected) return null;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
      <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
        Grant Access
      </h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Grantee Public Key
          </label>
          <input
            type="text"
            value={grantee}
            onChange={(e) => setGrantee(e.target.value)}
            placeholder="Base58 Solana public key..."
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm font-mono focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Scope
          </label>
          <div className="flex gap-4 flex-wrap">
            {(["read", "write", "delete", "admin"] as const).map((s) => (
              <label key={s} className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
                <input
                  type="checkbox"
                  checked={scopes[s]}
                  onChange={(e) => setScopes({ ...scopes, [s]: e.target.checked })}
                  className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                />
                {s.toUpperCase()}
              </label>
            ))}
          </div>
          <p className="text-xs text-gray-400 mt-1">
            Bitmask: {scopeValue} (0b{scopeValue.toString(2).padStart(4, "0")})
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Expires In
          </label>
          <select
            value={expiresIn}
            onChange={(e) => setExpiresIn(e.target.value)}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm"
          >
            <option value="0">Never</option>
            <option value="3600">1 hour</option>
            <option value="86400">1 day</option>
            <option value="604800">1 week</option>
            <option value="2592000">30 days</option>
          </select>
        </div>

        <button
          type="submit"
          disabled={grantAccess.isPending || !grantee.trim() || scopeValue === 0}
          className="w-full px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
        >
          {grantAccess.isPending ? "Sending Transaction..." : "Grant Access"}
        </button>

        {grantAccess.isSuccess && (
          <p className="text-sm text-green-600 dark:text-green-400">
            Access granted! TX: {String(grantAccess.data).slice(0, 16)}...
          </p>
        )}
        {grantAccess.isError && (
          <p className="text-sm text-red-600 dark:text-red-400">
            Error: {grantAccess.error.message}
          </p>
        )}
      </form>
    </div>
  );
}
