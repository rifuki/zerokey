import { createMiddleware } from "hono/factory";
import type { Connection, PublicKey } from "@solana/web3.js";
import {
  verifyRequest,
  verifyOnChain,
  MemoryNonceStore,
  type VerifyPolicy,
  type NonceStore,
  type VerifyResult,
} from "@zerokey/sdk";

export interface SolAuthEnv {
  Variables: {
    solauth: {
      publicKey: string;
      scope?: number;
      binding: string;
      replayable: boolean;
    };
  };
}

export interface SolAuthMiddlewareOptions {
  nonceStore?: NonceStore;
  policy?: VerifyPolicy;
  /** Provide connection + owner to also verify on-chain AccessGrant */
  connection?: Connection;
  programId?: PublicKey;
  owner?: PublicKey | string;
  /** Required scope bitmask for on-chain check */
  requiredScope?: number;
}

// Shared default nonce store
const defaultNonceStore = new MemoryNonceStore();

/**
 * Hono middleware: verify SolAuth signed HTTP requests.
 *
 * Usage:
 * ```ts
 * app.use("/api/*", solAuthMiddleware({ connection, owner: ownerPubkey }));
 * ```
 */
export function solAuthMiddleware(options: SolAuthMiddlewareOptions = {}) {
  const {
    nonceStore = defaultNonceStore,
    policy,
    connection,
    programId,
    owner,
    requiredScope,
  } = options;

  return createMiddleware<SolAuthEnv>(async (c, next) => {
    // 1. Verify Ed25519 signature
    const result: VerifyResult = await verifyRequest(c.req.raw, {
      nonceStore,
      policy,
    });

    if (!result.ok) {
      return c.json(
        { error: "Unauthorized", reason: result.reason },
        401
      );
    }

    // 2. Optional: verify on-chain AccessGrant
    if (connection && owner) {
      const scope = requiredScope ?? result.scope ?? 0x01; // default: READ
      const onChainResult = await verifyOnChain({
        connection,
        owner,
        grantee: result.publicKey,
        requiredScope: scope,
        programId,
      });

      if (!onChainResult.ok) {
        return c.json(
          { error: "Forbidden", reason: onChainResult.reason },
          403
        );
      }
    }

    // 3. Set context for downstream handlers
    c.set("solauth", {
      publicKey: result.publicKey,
      scope: result.scope,
      binding: result.binding,
      replayable: result.replayable,
    });

    await next();
  });
}
