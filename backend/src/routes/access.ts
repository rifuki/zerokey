import { Hono } from "hono";
import { PublicKey } from "@solana/web3.js";
import { deriveAccessGrantPDA } from "@zerokey/sdk";
import { connection, programId, ownerPubkey } from "../lib/solana.js";

const app = new Hono();

/**
 * GET /api/access/:grantee
 * Public endpoint — check if a wallet has access.
 * No signature required (read-only, public info).
 */
app.get("/:grantee", async (c) => {
  const granteeStr = c.req.param("grantee");

  if (!ownerPubkey) {
    return c.json({ error: "OWNER_PUBKEY not configured" }, 500);
  }

  let granteePubkey: PublicKey;
  try {
    granteePubkey = new PublicKey(granteeStr);
  } catch {
    return c.json({ error: "Invalid public key" }, 400);
  }

  const [pda] = deriveAccessGrantPDA(ownerPubkey, granteePubkey, programId);

  const accountInfo = await connection.getAccountInfo(pda);
  if (!accountInfo) {
    return c.json({ hasAccess: false, reason: "no_grant_found" });
  }

  // Raw account exists — return basic info
  // (Full deserialization is in the SDK, but for a quick check this suffices)
  return c.json({
    hasAccess: true,
    pda: pda.toBase58(),
    owner: ownerPubkey.toBase58(),
    grantee: granteeStr,
  });
});

export default app;
