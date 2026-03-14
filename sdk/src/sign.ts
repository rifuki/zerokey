import type { SolAuthSigner, SignOptions, SignatureParams } from "./types.js";
import { formatKeyId } from "./lib/keyid.js";
import { computeDigest } from "./lib/content-digest.js";
import { buildSignatureBase } from "./lib/signature-base.js";
import { serializeSignatureInput, serializeSignature } from "./lib/headers.js";
import { generateNonce } from "./lib/nonce.js";

/** Default components for request-bound signing */
const REQUEST_BOUND_COMPONENTS = [
  "@method",
  "@authority",
  "@path",
  "content-digest",
];

/** Default components for class-bound signing (lighter) */
const CLASS_BOUND_COMPONENTS = ["@method", "@path"];

/**
 * Sign a Request with Ed25519 via SolAuth (RFC 9421 + Solana).
 * Returns a new Request with Signature-Input, Signature, and Content-Digest headers.
 */
export async function signRequest(
  request: Request,
  signer: SolAuthSigner,
  options: SignOptions = {}
): Promise<Request> {
  const {
    label = "sol",
    binding = "request-bound",
    replay = "non-replayable",
    ttlSeconds = 60,
    scope,
  } = options;

  const now = Math.floor(Date.now() / 1000);
  const keyid = formatKeyId(signer.publicKey);

  // Resolve nonce
  let nonce: string | undefined;
  if (replay === "non-replayable") {
    if (typeof options.nonce === "function") {
      nonce = await options.nonce();
    } else if (typeof options.nonce === "string") {
      nonce = options.nonce;
    } else {
      nonce = generateNonce();
    }
  }

  // Determine components
  let components =
    options.components ??
    (binding === "request-bound"
      ? [...REQUEST_BOUND_COMPONENTS]
      : [...CLASS_BOUND_COMPONENTS]);

  // Read body once as bytes (avoid stream consumption issues)
  let bodyBytes: Uint8Array | null = null;
  if (request.body) {
    const cloned = request.clone();
    bodyBytes = new Uint8Array(await cloned.arrayBuffer());
    if (bodyBytes.length === 0) bodyBytes = null;
  }

  // Compute Content-Digest if body exists
  const headers = new Headers(request.headers);
  if (components.includes("content-digest") && bodyBytes) {
    headers.set("content-digest", computeDigest(bodyBytes));
  } else {
    components = components.filter((c) => c !== "content-digest");
  }

  // Build signature params
  const params: SignatureParams = {
    created: now,
    expires: now + ttlSeconds,
    keyid,
    nonce,
    scope,
  };

  // Build a temporary request with headers for signature base construction
  const tempRequest = new Request(request.url, {
    method: request.method,
    headers,
  });

  const signatureBase = buildSignatureBase(tempRequest, components, params);

  // Sign with Ed25519
  const messageBytes = new TextEncoder().encode(signatureBase);
  const signature = await signer.signMessage(messageBytes);

  // Set signature headers
  headers.set("signature-input", serializeSignatureInput(label, components, params));
  headers.set("signature", serializeSignature(label, signature));

  // Return new request with body as raw bytes (not stream)
  return new Request(request.url, {
    method: request.method,
    headers,
    body: bodyBytes as BodyInit | null,
  });
}

/**
 * Sign a request and immediately fetch it.
 */
export async function signedFetch(
  input: RequestInfo | URL,
  init: RequestInit | undefined,
  signer: SolAuthSigner,
  options?: SignOptions
): Promise<Response> {
  const request = new Request(input, init);
  const signed = await signRequest(request, signer, options);
  return fetch(signed);
}
