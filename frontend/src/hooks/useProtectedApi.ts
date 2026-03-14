import { useQuery, useMutation } from "@tanstack/react-query";
import { useSolAuth } from "./useSolAuth";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:3000";

/**
 * Query hook: call a protected GET endpoint with signed request.
 */
export function useProtectedGet(path: string, enabled = true) {
  const client = useSolAuth({ replay: "replayable" });

  return useQuery({
    queryKey: ["api", path],
    queryFn: async () => {
      if (!client) throw new Error("Wallet not connected");
      const res = await client.fetch(`${API_BASE}${path}`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(err.error || err.reason || res.statusText);
      }
      return res.json();
    },
    enabled: enabled && !!client,
    retry: false,
  });
}

/**
 * Mutation hook: call a protected POST endpoint with signed request.
 */
export function useProtectedPost(path: string) {
  const client = useSolAuth();

  return useMutation({
    mutationFn: async (body: unknown) => {
      if (!client) throw new Error("Wallet not connected");
      const res = await client.fetch(`${API_BASE}${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(err.error || err.reason || res.statusText);
      }
      return res.json();
    },
  });
}
