import { sha256 } from "@noble/hashes/sha256";

/**
 * Compute Content-Digest header value for a request body.
 * Format: `sha-256=:<base64>:` (RFC 9530)
 */
export function computeDigest(body: Uint8Array): string {
  const hash = sha256(body);
  const b64 = uint8ToBase64(hash);
  return `sha-256=:${b64}:`;
}

/**
 * Verify a Content-Digest header against the actual body.
 */
export function verifyDigest(header: string, body: Uint8Array): boolean {
  const match = header.match(/^sha-256=:([A-Za-z0-9+/=]+):$/);
  if (!match) return false;

  const expected = computeDigest(body);
  return header === expected;
}

function uint8ToBase64(bytes: Uint8Array): string {
  // Works in both Node.js and browser
  if (typeof Buffer !== "undefined") {
    return Buffer.from(bytes).toString("base64");
  }
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

export function base64ToUint8(b64: string): Uint8Array {
  if (typeof Buffer !== "undefined") {
    return new Uint8Array(Buffer.from(b64, "base64"));
  }
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}
