import { Hono } from "hono";
import { solAuthMiddleware, type SolAuthEnv } from "../middleware/solauth.js";
import { connection, programId, ownerPubkey } from "../lib/solana.js";
import { Scope } from "@zerokey/sdk";

const app = new Hono<SolAuthEnv>();

// In-memory store (per wallet)
const store = new Map<string, { data: unknown; timestamp: number }[]>();

// GET /api/data — requires READ scope
app.get(
  "/data",
  solAuthMiddleware({
    connection,
    programId,
    owner: ownerPubkey ?? undefined,
    requiredScope: Scope.READ,
    policy: { replayable: true },
  }),
  (c) => {
    const { publicKey, scope } = c.get("solauth");
    const entries = store.get(publicKey) ?? [];
    return c.json({
      wallet: publicKey,
      scope,
      timestamp: Date.now(),
      entries,
    });
  }
);

// POST /api/data — requires WRITE scope
app.post(
  "/data",
  solAuthMiddleware({
    connection,
    programId,
    owner: ownerPubkey ?? undefined,
    requiredScope: Scope.WRITE,
  }),
  async (c) => {
    const { publicKey } = c.get("solauth");
    const body = await c.req.json();

    if (!store.has(publicKey)) store.set(publicKey, []);
    const entry = { data: body, timestamp: Date.now() };
    store.get(publicKey)!.push(entry);

    return c.json({
      message: "Data written",
      wallet: publicKey,
      entry,
      total: store.get(publicKey)!.length,
    });
  }
);

// DELETE /api/data/:id — requires DELETE scope
app.delete(
  "/data/:id",
  solAuthMiddleware({
    connection,
    programId,
    owner: ownerPubkey ?? undefined,
    requiredScope: Scope.DELETE,
  }),
  (c) => {
    const { publicKey } = c.get("solauth");
    const idx = parseInt(c.req.param("id"));
    const entries = store.get(publicKey);

    if (!entries || idx < 0 || idx >= entries.length) {
      return c.json({ error: "Not found" }, 404);
    }

    entries.splice(idx, 1);
    return c.json({
      message: `Entry ${idx} deleted`,
      wallet: publicKey,
      remaining: entries.length,
    });
  }
);

export default app;
