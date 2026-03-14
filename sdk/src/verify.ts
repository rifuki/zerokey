import * as ed from "@noble/ed25519";
import type {
  VerifyResult,
  VerifyPolicy,
  NonceStore,
  SignatureParams,
  BindingMode,
} from "./types.js";
import { parseKeyId } from "./lib/keyid.js";
import { verifyDigest } from "./lib/content-digest.js";
import { parseSignatureInput, parseSignature } from "./lib/headers.js";
import {
  buildSignatureBase,
  parseSignatureParams,
} from "./lib/signature-base.js";

// @noble/ed25519 v2 needs sha512 — use @noble/hashes
import { sha512 } from "@noble/hashes/sha512";
ed.etc.sha512Sync = (...m: Uint8Array[]) => {
  const h = sha512.create();
  for (const msg of m) h.update(msg);
  return h.digest();
};

export interface VerifyRequestOptions {
  nonceStore?: NonceStore;
  policy?: VerifyPolicy;
}

/**
 * Verify a signed HTTP request.
 *
 * 1. Parse Signature-Input + Signature headers
 * 2. Validate timestamps (created/expires)
 * 3. Check nonce (if non-replayable)
 * 4. Verify Content-Digest (if covered)
 * 5. Reconstruct signature base
 * 6. ed25519.verify(signature, message, publicKey)
 */
export async function verifyRequest(
  request: Request,
  options: VerifyRequestOptions = {}
): Promise<VerifyResult> {
  const { nonceStore, policy = {} } = options;
  const {
    maxValiditySec = 300,
    clockSkewSec = 5,
    replayable = false,
  } = policy;

  // 1. Parse headers
  const sigInputHeader = request.headers.get("signature-input");
  const sigHeader = request.headers.get("signature");

  if (!sigInputHeader || !sigHeader) {
    return { ok: false, reason: "missing_headers" };
  }

  const inputEntry = parseSignatureInput(sigInputHeader);
  if (!inputEntry) {
    return { ok: false, reason: "parse_error" };
  }

  const parsed = parseSignatureParams(inputEntry.raw);
  if (!parsed) {
    return { ok: false, reason: "parse_error" };
  }

  const { components, params } = parsed;

  // Extract signature bytes
  const signatureBytes = parseSignature(sigHeader, inputEntry.label);
  if (!signatureBytes) {
    return { ok: false, reason: "parse_error" };
  }

  // 2. Validate keyid
  const publicKeyBytes = parseKeyId(params.keyid);
  if (!publicKeyBytes) {
    return { ok: false, reason: "invalid_keyid" };
  }

  // 3. Validate timestamps
  const now = Math.floor(Date.now() / 1000);

  if (params.created > now + clockSkewSec) {
    return { ok: false, reason: "expired" }; // Created in the future
  }
  if (params.expires < now - clockSkewSec) {
    return { ok: false, reason: "expired" }; // Already expired
  }
  if (params.expires - params.created > maxValiditySec) {
    return { ok: false, reason: "expired" }; // TTL too long
  }

  // 4. Check nonce (replay protection)
  const isReplayable = params.nonce === undefined;

  if (!isReplayable && nonceStore) {
    const ttl = params.expires - now + clockSkewSec;
    const consumed = await nonceStore.consume(params.nonce!, ttl > 0 ? ttl : 60);
    if (!consumed) {
      return { ok: false, reason: "nonce_reused" };
    }
  }

  if (!isReplayable && !nonceStore && !replayable) {
    // Nonce present but no store — can't verify uniqueness
    // Still proceed (nonce exists, just can't track it)
  }

  if (isReplayable && !replayable) {
    // No nonce and policy says non-replayable required
    return { ok: false, reason: "nonce_reused" };
  }

  // 5. Verify Content-Digest if covered
  if (components.includes("content-digest")) {
    const digestHeader = request.headers.get("content-digest");
    if (!digestHeader) {
      return { ok: false, reason: "invalid_digest" };
    }
    const bodyClone = request.clone();
    const bodyBytes = new Uint8Array(await bodyClone.arrayBuffer());
    if (!verifyDigest(digestHeader, bodyBytes)) {
      return { ok: false, reason: "invalid_digest" };
    }
  }

  // 6. Reconstruct signature base
  const signatureBase = buildSignatureBase(request, components, params);
  const messageBytes = new TextEncoder().encode(signatureBase);

  // 7. Verify Ed25519 signature
  let valid: boolean;
  try {
    valid = ed.verify(signatureBytes, messageBytes, publicKeyBytes);
  } catch {
    valid = false;
  }

  if (!valid) {
    return { ok: false, reason: "invalid_signature" };
  }

  // Determine binding mode
  const binding: BindingMode =
    components.length <= 2 &&
    components.includes("@method") &&
    components.includes("@path")
      ? "class-bound"
      : "request-bound";

  return {
    ok: true,
    publicKey: params.keyid,
    scope: params.scope,
    binding,
    replayable: isReplayable,
    params,
  };
}
