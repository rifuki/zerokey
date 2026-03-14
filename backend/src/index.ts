import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import protectedRoutes from "./routes/protected.js";
import accessRoutes from "./routes/access.js";
import { ownerPubkey, RPC_URL } from "./lib/solana.js";

const app = new Hono();

// Global middleware
app.use("*", logger());
app.use(
  "*",
  cors({
    origin: ["http://localhost:5173", "http://localhost:3000"],
    allowHeaders: [
      "Content-Type",
      "Signature-Input",
      "Signature",
      "Content-Digest",
    ],
    exposeHeaders: ["Signature-Input", "Signature", "Content-Digest"],
  })
);

// Health check
app.get("/", (c) =>
  c.json({
    name: "Zerokey SolAuth API",
    version: "0.1.0",
    owner: ownerPubkey?.toBase58() ?? "not configured",
    rpc: RPC_URL,
  })
);

// Routes
app.route("/api", protectedRoutes);
app.route("/api/access", accessRoutes);

const port = parseInt(process.env.PORT || "3000");

console.log(`Zerokey backend running on http://localhost:${port}`);
if (ownerPubkey) {
  console.log(`Owner: ${ownerPubkey.toBase58()}`);
} else {
  console.log("WARNING: OWNER_PUBKEY not set — on-chain checks disabled");
}

export default {
  port,
  fetch: app.fetch,
};
