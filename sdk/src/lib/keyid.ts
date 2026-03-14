import bs58 from "bs58";

/**
 * Format a Solana public key as a SolAuth keyid.
 * Unlike ERC-8128's `erc8128:<chainId>:<address>`, we use the base58 pubkey directly.
 */
export function formatKeyId(publicKey: string | { toBase58(): string }): string {
  const key = typeof publicKey === "string" ? publicKey : publicKey.toBase58();
  // Validate it's a valid base58 Solana pubkey (32 bytes)
  const decoded = bs58.decode(key);
  if (decoded.length !== 32) {
    throw new Error(`Invalid Solana public key: expected 32 bytes, got ${decoded.length}`);
  }
  return key;
}

/**
 * Parse a keyid string back to raw 32-byte public key.
 * Returns null if invalid.
 */
export function parseKeyId(keyid: string): Uint8Array | null {
  try {
    const decoded = bs58.decode(keyid);
    if (decoded.length !== 32) return null;
    return decoded;
  } catch {
    return null;
  }
}
