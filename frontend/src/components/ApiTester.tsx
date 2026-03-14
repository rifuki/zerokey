import { useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useProtectedGet, useProtectedPost } from "../hooks/useProtectedApi";

export function ApiTester() {
  const { connected } = useWallet();
  const [postBody, setPostBody] = useState('{"message": "hello from SolAuth"}');

  const getData = useProtectedGet("/api/data", connected);
  const postData = useProtectedPost("/api/data");

  if (!connected) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
          API Tester
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Connect your wallet to test signed API requests.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 space-y-6">
      <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
        API Tester
      </h2>

      {/* GET /api/data */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
            <span className="inline-block bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 text-xs font-mono px-2 py-0.5 rounded mr-2">
              GET
            </span>
            /api/data
          </h3>
          <button
            onClick={() => getData.refetch()}
            disabled={getData.isLoading}
            className="px-3 py-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded text-sm hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50"
          >
            {getData.isLoading ? "Signing..." : "Send"}
          </button>
        </div>
        <ResultBox
          isLoading={getData.isLoading}
          isError={getData.isError}
          error={getData.error}
          data={getData.data}
        />
      </div>

      {/* POST /api/data */}
      <div className="space-y-2">
        <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
          <span className="inline-block bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 text-xs font-mono px-2 py-0.5 rounded mr-2">
            POST
          </span>
          /api/data
        </h3>
        <textarea
          value={postBody}
          onChange={(e) => setPostBody(e.target.value)}
          rows={2}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm font-mono focus:ring-2 focus:ring-purple-500 focus:border-transparent"
        />
        <button
          onClick={() => {
            try {
              postData.mutate(JSON.parse(postBody));
            } catch {
              postData.mutate(postBody);
            }
          }}
          disabled={postData.isPending}
          className="px-3 py-1 bg-purple-600 text-white rounded text-sm hover:bg-purple-700 disabled:opacity-50"
        >
          {postData.isPending ? "Signing..." : "Send"}
        </button>
        <ResultBox
          isLoading={postData.isPending}
          isError={postData.isError}
          error={postData.error}
          data={postData.data}
        />
      </div>
    </div>
  );
}

function ResultBox({
  isLoading,
  isError,
  error,
  data,
}: {
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  data: unknown;
}) {
  if (isLoading) {
    return (
      <div className="bg-gray-50 dark:bg-gray-900 rounded-md p-3 text-sm text-gray-400">
        Waiting for wallet signature...
      </div>
    );
  }

  if (isError) {
    return (
      <div className="bg-red-50 dark:bg-red-900/20 rounded-md p-3 text-sm text-red-600 dark:text-red-400 font-mono break-all">
        {error?.message || "Request failed"}
      </div>
    );
  }

  if (data) {
    return (
      <pre className="bg-gray-50 dark:bg-gray-900 rounded-md p-3 text-sm text-gray-700 dark:text-gray-300 font-mono overflow-auto max-h-48 text-left">
        {JSON.stringify(data, null, 2)}
      </pre>
    );
  }

  return null;
}
