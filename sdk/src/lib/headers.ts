import type { SignatureParams } from "../types.js";
import { base64ToUint8 } from "./content-digest.js";

/**
 * Serialize Signature-Input header.
 * Format: sol=("@method" "@authority" "@path" "content-digest");created=...;keyid="..."
 */
export function serializeSignatureInput(
  label: string,
  components: string[],
  params: SignatureParams
): string {
  const componentList = components.map((c) => `"${c}"`).join(" ");
  let result = `${label}=(${componentList})`;

  result += `;created=${params.created}`;
  result += `;expires=${params.expires}`;
  result += `;keyid="${params.keyid}"`;

  if (params.nonce !== undefined) {
    result += `;nonce="${params.nonce}"`;
  }

  if (params.scope !== undefined) {
    result += `;scope=${params.scope}`;
  }

  return result;
}

/**
 * Serialize Signature header.
 * Format: sol=:<base64_signature>:
 */
export function serializeSignature(label: string, signature: Uint8Array): string {
  let b64: string;
  if (typeof Buffer !== "undefined") {
    b64 = Buffer.from(signature).toString("base64");
  } else {
    let binary = "";
    for (const byte of signature) {
      binary += String.fromCharCode(byte);
    }
    b64 = btoa(binary);
  }
  return `${label}=:${b64}:`;
}

/**
 * Parse Signature-Input header to extract label and params string.
 * Returns null if parsing fails.
 */
export function parseSignatureInput(
  header: string,
  preferredLabel?: string
): { label: string; raw: string } | null {
  // Format: label=(...);params...
  // Could have multiple labels separated by ", "
  const entries = splitStructuredDict(header);

  if (preferredLabel) {
    const entry = entries.find((e) => e.label === preferredLabel);
    if (entry) return entry;
  }

  // Return first entry
  return entries[0] ?? null;
}

/**
 * Parse Signature header to extract raw signature bytes for a label.
 */
export function parseSignature(
  header: string,
  label: string
): Uint8Array | null {
  const entries = splitStructuredDict(header);
  const entry = entries.find((e) => e.label === label);
  if (!entry) return null;

  // Format: :base64:
  const match = entry.raw.match(/^:([A-Za-z0-9+/=]+):$/);
  if (!match) return null;

  return base64ToUint8(match[1]);
}

/**
 * Split a structured dictionary header into label + value entries.
 * Handles: `sol=(...);params..., eth=(...);params...`
 */
function splitStructuredDict(header: string): { label: string; raw: string }[] {
  const results: { label: string; raw: string }[] = [];

  // Simple split by ", " at top level (not inside parens or quotes)
  let depth = 0;
  let inQuote = false;
  let current = "";

  for (let i = 0; i < header.length; i++) {
    const ch = header[i];

    if (ch === '"' && header[i - 1] !== "\\") {
      inQuote = !inQuote;
    } else if (!inQuote) {
      if (ch === "(" || ch === ":") depth++;
      else if (ch === ")" || (ch === ":" && depth > 0)) depth--;
    }

    if (ch === "," && depth === 0 && !inQuote && header[i + 1] === " ") {
      pushEntry(current.trim(), results);
      current = "";
      i++; // skip space
      continue;
    }

    current += ch;
  }

  if (current.trim()) {
    pushEntry(current.trim(), results);
  }

  return results;
}

function pushEntry(
  segment: string,
  results: { label: string; raw: string }[]
): void {
  const eqIdx = segment.indexOf("=");
  if (eqIdx === -1) return;

  const label = segment.slice(0, eqIdx);
  const raw = segment.slice(eqIdx + 1);
  results.push({ label, raw });
}
