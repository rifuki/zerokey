# Zerokey

Minimal on-chain access control for Solana. Replaces traditional JWT/RBAC backends with a single PDA-based permission system.

Built for the Superteam bounty: **"Rebuild Production Backend Systems as On-Chain Rust Programs."**

## What It Does

One account type (`AccessGrant`), three instructions (`grant`, `revoke`, `verify`). An owner grants scoped, time-bound access to any wallet. Verification is free via simulation — no transaction needed.

This project includes:
- **Smart Contract** — On-chain access control (Anchor/Rust)
- **SDK** — TypeScript library for signing & verifying HTTP requests (`@zerokey/sdk`)
- **Backend** — Bun + Hono API server with SolAuth middleware
- **Frontend** — Vite + React dashboard with App Wallet (auto-sign)

```
Owner grants access to Grantee (on-chain tx, ~0.000005 SOL)
     │
     ▼
Grantee signs HTTP requests with Ed25519
     │
     ▼
Backend verifies signature + checks on-chain (FREE, no tx)
     │
     ▼
Grantee is authorized ✓
```

## Web2 vs Solana

| Web2 Backend Pattern | Zerokey On-Chain Equivalent |
|---|---|
| RBAC table in PostgreSQL | AccessGrant PDA on-chain |
| Admin manages API keys | Owner self-service grant/revoke |
| JWT bearer token (stealable) | Ed25519 per-request signature (unstealable) |
| Session table in Redis | Stateless — no sessions needed |
| Revoke = blacklist + wait for expiry | Revoke = on-chain state update (instant) |
| Token refresh rotation | No tokens to rotate |
| Centralized auth database | Decentralized, transparent, auditable |

## Architecture

### System Overview

```
┌──────────────┐      signed HTTP      ┌──────────────────┐
│   Frontend   │      request          │     Backend      │
│  (React)     │  ─────────────────►   │   (Bun/Hono)     │
│              │                       │                  │
│  App Wallet  │  ◄─────────────────   │  1. Verify Ed25519│
│  (auto-sign) │      JSON response    │  2. Check PDA    │
└──────────────┘                       │  3. Business     │
                                       │     logic        │
     ┌─────────┐                       └────────┬─────────┘
     │  SDK    │                                │
     └────┬────┘                                │ verifyOnChain()
          │                                     │ (RPC call, FREE)
          │                                     ▼
          │                            ┌──────────────────┐
          │                            │  Zerokey Program │
          └───────────────────────────►│                  │
              signRequest()            │  AccessGrant PDA │
                                       └──────────────────┘
```

### App Wallet (Auto-Sign)

Zerokey includes an **App Wallet** feature for frictionless UX:

1. Generate non-extractable Ed25519 keypair via Web Crypto API
2. Store in IndexedDB (private key never leaves browser)
3. Main wallet grants access to app wallet on-chain (1 popup)
4. All subsequent requests signed automatically (0 popup)

```
User enables auto-sign:
  ├─ Generate keypair (Web Crypto, non-extractable)
  ├─ Save to IndexedDB
  └─ Grant access on-chain (1 wallet popup)

Subsequent API calls:
  └─ Auto-signed (no popup)
```

### AccessGrant Account

```
PDA seeds: ["access", owner, grantee]

Fields:
  owner:      Pubkey   — who granted access
  grantee:    Pubkey   — who has access
  scope:      u8       — bitmask (READ=0x01, WRITE=0x02, DELETE=0x04, ADMIN=0x08)
  expires_at: i64      — unix timestamp, 0 = never
  revoked:    bool     — instant revocation flag
  created_at: i64      — audit timestamp
  updated_at: i64      — audit timestamp
  bump:       u8       — PDA bump
```

### Instructions

| Instruction | Signer | Description |
|---|---|---|
| `grant_access(scope, expires_at)` | owner | Create or update an AccessGrant PDA |
| `revoke_access()` | owner | Set `revoked = true` |
| `verify_access(required_scope)` | none | Check grant validity (designed for simulation) |

### Scope Bitmask

```
READ   = 0x01  (0b0001)
WRITE  = 0x02  (0b0010)
DELETE = 0x04  (0b0100)
ADMIN  = 0x08  (0b1000)

Examples:
  READ only:      1
  READ + WRITE:   3
  Full access:   15
```

## Quick Start

### 1. Contract

```bash
cd contract
yarn install
anchor build
anchor test
```

### 2. SDK

```bash
cd sdk
npm install
npm run build
```

### 3. Backend

```bash
cd backend
bun install
OWNER_PUBKEY=YOUR_OWNER_PUBKEY bun run src/index.ts
```

### 4. Frontend

```bash
cd frontend
bun install
bun run dev
```

## Project Structure

```
zerokey/
├── contract/                  # On-chain program (Anchor)
│   ├── programs/zerokey/src/
│   │   ├── lib.rs            # Program entry, declare_id
│   │   ├── state.rs          # AccessGrant account struct
│   │   ├── errors.rs         # ZerokeyError enum
│   │   └── instructions/
│   │       ├── grant_access.rs
│   │       ├── revoke_access.rs
│   │       └── verify_access.rs
│   └── tests/
│       └── zerokey.ts        # Anchor integration tests
│
├── sdk/                       # TypeScript SDK
│   └── src/
│       ├── index.ts          # Barrel exports
│       ├── types.ts          # Type definitions
│       ├── sign.ts           # Sign requests
│       ├── client.ts         # SolAuthClient
│       ├── verify.ts         # Verify requests
│       ├── onchain.ts        # On-chain verification
│       └── lib/
│           ├── signature-base.ts   # RFC 9421 signatures
│           ├── content-digest.ts   # SHA-256 digest
│           ├── headers.ts          # Header parsing
│           ├── keyid.ts            # Key ID handling
│           ├── nonce.ts            # Replay protection
│           └── app-wallet.ts       # Web Crypto wallet
│
├── backend/                   # Bun + Hono API
│   └── src/
│       ├── index.ts          # Entry point
│       ├── middleware/
│       │   └── solauth.ts    # Auth middleware
│       ├── routes/
│       │   ├── protected.ts  # Protected endpoints
│       │   └── access.ts     # Public access check
│       └── lib/
│           └── solana.ts     # Connection config
│
└── frontend/                  # Vite + React
    └── src/
        ├── App.tsx           # Main app
        ├── hooks/
        │   ├── useAppWallet.tsx    # App wallet state
        │   ├── useSolAuth.ts       # Client factory
        │   ├── useGrantAccess.ts   # Grant mutation
        │   ├── useRevokeAccess.ts  # Revoke mutation
        │   └── useProtectedApi.ts  # API hooks
        ├── components/
        │   ├── WalletConnect.tsx   # Wallet button
        │   ├── GrantForm.tsx       # Grant form
        │   ├── AutoSignToggle.tsx  # App wallet toggle
        │   └── ApiTester.tsx       # API testing UI
        └── lib/
            └── solauth-adapter.ts  # Wallet adapter bridge
```

## Using the SDK

### Sign a Request

```typescript
import { createSolAuthClient, Scope } from "@zerokey/sdk";

const client = createSolAuthClient(signer, {
  scope: Scope.READ | Scope.WRITE,
  ttlSeconds: 60,
});

const res = await client.fetch("http://localhost:3000/api/data", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ message: "hello" }),
});
```

### Verify on Server

```typescript
import { verifyRequest, verifyOnChain } from "@zerokey/sdk";

// Verify signature
const result = await verifyRequest(request, {
  nonceStore: new MemoryNonceStore(),
});

// Verify on-chain
const onChain = await verifyOnChain({
  connection,
  owner,
  grantee: result.publicKey,
  requiredScope: Scope.READ,
});
```

## Backend Middleware

```typescript
import { solAuthMiddleware } from "./middleware/solauth.js";
import { connection, ownerPubkey } from "./lib/solana.js";
import { Scope } from "@zerokey/sdk";

// Protect endpoint with scope check
app.get(
  "/api/data",
  solAuthMiddleware({
    connection,
    owner: ownerPubkey,
    requiredScope: Scope.READ,
  }),
  (c) => {
    const { publicKey, scope } = c.get("solauth");
    return c.json({ wallet: publicKey, scope });
  }
);
```

## Program ID

```
GRSXhFiiaA2aDJwa2b15TtL6JHRHoEefZbEoM1aFCGqh
```

## Devnet Transactions

| Instruction | Transaction |
|---|---|
| `grant_access` | [4uRGjtFg...](https://explorer.solana.com/tx/4uRGjtFgWMGkVSj5i4dBM5WNHWPhrDCXT5taq6p11W6qMruLsuiC5uFAd11Qsz19jFpp86KWe1bYhdjqLLHJbzVC?cluster=devnet) |
| `verify_access` | [3uTDmKdi...](https://explorer.solana.com/tx/3uTDmKdiS3htnBKUahaoHSQbVR6KQvewqfJvqnWxFDbGGgrZNYiUHEvmyc4rEYgzKPsPTKqTddGfRYg2mSM8R3DT?cluster=devnet) |
| `revoke_access` | [34p6Uv4F...](https://explorer.solana.com/tx/34p6Uv4FEqWVjixJeNeSpeNAyHiMyysTow9hHcjNmFnMRmCk8VSQL8Jz3YpLsZHxD6zYLbQpzonYp1gEsPSCX17n?cluster=devnet) |

Program on Solana Explorer: [GRSXhFiiaA2aDJwa2b15TtL6JHRHoEefZbEoM1aFCGqh](https://explorer.solana.com/address/GRSXhFiiaA2aDJwa2b15TtL6JHRHoEefZbEoM1aFCGqh?cluster=devnet)

## Error Codes

| Code | Name | Description |
|---|---|---|
| 6000 | `AccessRevoked` | Grant has been revoked |
| 6001 | `AccessExpired` | Grant has expired |
| 6002 | `InsufficientScope` | Granted scope doesn't cover required scope |
| 6003 | `InvalidExpiry` | Expiry must be 0 (never) or future timestamp |

## Improvements over ERC-8128

This project adapts the ERC-8128 pattern (Ethereum) to Solana with improvements:

| ERC-8128 (Ethereum) | SolAuth (Solana) |
|---|---|
| Auth only, authz needs separate ERC-8004 | Auth + Authz integrated (verify_access via simulation) |
| keyid: `erc8128:<chainId>:<address>` | keyid: base58 pubkey directly |
| secp256k1 + ERC-191 + ERC-1271 complexity | Ed25519 only, single verification path |
| Nonce required for all requests | Split: TTL-only (reads) + nonce (writes) |
| No on-chain audit trail | Optional on-chain proof for critical operations |
| Scope not in HTTP layer | Scope bitmask in Signature-Input header |
| No browser wallet support | App Wallet with non-extractable keys (Web Crypto) |

## License

MIT
