import type { NonceStore } from "../types.js";

/**
 * Generate a random nonce string (UUID v4-like).
 */
export function generateNonce(): string {
  const bytes = new Uint8Array(16);
  if (typeof globalThis.crypto !== "undefined" && globalThis.crypto.getRandomValues) {
    globalThis.crypto.getRandomValues(bytes);
  } else {
    // Fallback for environments without crypto (shouldn't happen in modern runtimes)
    for (let i = 0; i < bytes.length; i++) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }

  // Format as hex string
  let hex = "";
  for (const b of bytes) {
    hex += b.toString(16).padStart(2, "0");
  }
  return hex;
}

/**
 * In-memory nonce store. Good for single-server deployments.
 * For production multi-server: swap to Redis-based store.
 */
export class MemoryNonceStore implements NonceStore {
  private seen = new Map<string, number>();
  private cleanupInterval: ReturnType<typeof setInterval> | null = null;

  constructor(cleanupIntervalMs: number = 60_000) {
    this.cleanupInterval = setInterval(() => this.cleanup(), cleanupIntervalMs);
    // Allow process to exit even if interval is running
    if (typeof this.cleanupInterval === "object" && "unref" in this.cleanupInterval) {
      this.cleanupInterval.unref();
    }
  }

  async consume(key: string, ttlSeconds: number): Promise<boolean> {
    const now = Math.floor(Date.now() / 1000);

    // Check if already consumed and not expired
    const expiresAt = this.seen.get(key);
    if (expiresAt !== undefined && expiresAt > now) {
      return false; // Already seen — replay attempt
    }

    // Mark as consumed
    this.seen.set(key, now + ttlSeconds);
    return true; // First use — OK
  }

  private cleanup(): void {
    const now = Math.floor(Date.now() / 1000);
    for (const [key, expiresAt] of this.seen) {
      if (expiresAt <= now) {
        this.seen.delete(key);
      }
    }
  }

  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.seen.clear();
  }
}
