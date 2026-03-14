import type { SolAuthSigner, SignOptions } from "./types.js";
import { signRequest, signedFetch } from "./sign.js";

export interface SolAuthClient {
  /** Sign and send a fetch request */
  fetch: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
  /** Sign a request without sending it */
  signRequest: (input: RequestInfo | URL, init?: RequestInit) => Promise<Request>;
}

/**
 * Create a SolAuth client that automatically signs every request.
 *
 * ```ts
 * const client = createSolAuthClient(signer, { scope: Scope.READ | Scope.WRITE });
 * const res = await client.fetch("https://api.example.com/data", { method: "POST", body: "..." });
 * ```
 */
export function createSolAuthClient(
  signer: SolAuthSigner,
  defaults?: SignOptions
): SolAuthClient {
  return {
    fetch: (input, init?) => signedFetch(input, init, signer, defaults),
    signRequest: (input, init?) =>
      signRequest(new Request(input, init), signer, defaults),
  };
}
