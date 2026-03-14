# Plan: SolAuth — HTTP Signed Requests for Solana

## Context

Zerokey on-chain contract sudah jadi (`contract/programs/zerokey/`) — grant/revoke/verify access via PDA. Yang kurang: **HTTP layer** yang menghubungkan wallet signing dengan on-chain access control. Ini adaptasi pattern ERC-8128 (Ethereum) ke Solana, dengan improvement.

Program ID: `GRSXhFiiaA2aDJwa2b15TtL6JHRHoEefZbEoM1aFCGqh`

---

## Improvement dari ERC-8128

| ERC-8128 (Ethereum) | SolAuth (Solana) |
|---|---|
| Auth only, authz butuh ERC-8004 terpisah | Auth + Authz terintegrasi (verify_access via simulation) |
| keyid: `erc8128:<chainId>:<address>` | keyid: base58 pubkey langsung |
| secp256k1 + ERC-191 + ERC-1271 complexity | Ed25519 saja, satu path verifikasi |
| Nonce wajib untuk semua request | Split: TTL-only (reads) + nonce (writes) |
| Tidak ada on-chain audit trail | Optional on-chain proof untuk operasi kritikal |
| Scope tidak di HTTP layer | Scope bitmask di Signature-Input header |

---

## Project Structure

```
zerokey/
├── contract/                        # EXISTING — on-chain program (tidak diubah)
│   └── programs/zerokey/src/
│
├── sdk/                             # NEW — core signing + verification library
│   ├── package.json
│   ├── tsconfig.json
│   └── src/
│       ├── index.ts                 # barrel exports
│       ├── types.ts                 # semua type definitions
│       ├── sign.ts                  # signRequest(), signedFetch()
│       ├── client.ts                # createSolAuthClient() — fetch wrapper
│       ├── verify.ts                # verifyRequest()
│       ├── onchain.ts               # verifyOnChain() — fetch + deserialize PDA
│       └── lib/
│           ├── signature-base.ts    # RFC 9421 signature base construction
│           ├── content-digest.ts    # SHA-256 body digest
│           ├── headers.ts           # parse/serialize Signature-Input & Signature
│           ├── keyid.ts             # format/parse solauth keyid
│           └── nonce.ts             # NonceStore interface + MemoryNonceStore
│
├── backend/                         # NEW — Bun + Hono API server
│   ├── package.json
│   ├── tsconfig.json
│   └── src/
│       ├── index.ts                 # entry point — Bun.serve + Hono app
│       ├── middleware/
│       │   └── solauth.ts           # Hono middleware: verify signature + on-chain check
│       ├── routes/
│       │   ├── grant.ts             # POST /api/grant — owner grants access on-chain
│       │   ├── revoke.ts            # POST /api/revoke — owner revokes access
│       │   └── protected.ts         # GET/POST /api/data — protected endpoints (demo)
│       └── lib/
│           └── solana.ts            # Connection, program helpers, shared config
│
├── frontend/                        # NEW — Vite + React + TailwindCSS + TanStack Query
│   ├── package.json
│   ├── vite.config.ts
│   ├── tailwind.config.ts
│   ├── tsconfig.json
│   ├── index.html
│   └── src/
│       ├── main.tsx                 # entry point
│       ├── App.tsx                  # router + wallet provider
│       ├── hooks/
│       │   ├── useSolAuth.ts        # hook: create SolAuthClient from connected wallet
│       │   ├── useGrantAccess.ts    # mutation: grant access on-chain
│       │   ├── useRevokeAccess.ts   # mutation: revoke access on-chain
│       │   └── useProtectedApi.ts   # query: call signed API endpoints
│       ├── components/
│       │   ├── WalletConnect.tsx     # connect wallet button
│       │   ├── GrantForm.tsx         # form: grant access (grantee, scope, expiry)
│       │   ├── AccessList.tsx        # list active grants
│       │   └── ApiTester.tsx         # test signed requests to backend
│       └── lib/
│           └── solauth-adapter.ts   # bridge: wallet-adapter → SolAuthSigner
│
└── PLAN.md
```

---

## Part 1: SDK (`sdk/`)

Core library, framework-agnostic. Dipakai oleh backend DAN frontend.

### Types (`sdk/src/types.ts`)

```typescript
interface SolAuthSigner {
  publicKey: string                  // base58 pubkey
  signMessage: (message: Uint8Array) => Promise<Uint8Array>
}

interface SignOptions {
  label?: string                     // default: "sol"
  binding?: "request-bound" | "class-bound"
  replay?: "non-replayable" | "replayable"
  ttlSeconds?: number                // default: 60
  nonce?: string | (() => Promise<string>)
  scope?: number                     // Zerokey scope bitmask
  components?: string[]
}

interface VerifyPolicy {
  maxValiditySec?: number            // default: 300
  clockSkewSec?: number              // default: 5
  replayable?: boolean
  requireScope?: boolean
  owner?: string                     // base58 pubkey
}

type VerifyResult =
  | { ok: true; publicKey: string; scope?: number; binding: string; replayable: boolean }
  | { ok: false; reason: VerifyFailReason }

type VerifyFailReason =
  | "missing_headers" | "invalid_signature" | "expired"
  | "nonce_reused" | "invalid_digest" | "invalid_keyid"
  | "access_revoked" | "access_expired" | "insufficient_scope"

interface NonceStore {
  consume(key: string, ttlSeconds: number): Promise<boolean>
}
```

### Shared Libs (`sdk/src/lib/`)

- **`signature-base.ts`** — RFC 9421 signature base construction
- **`content-digest.ts`** — SHA-256 digest (pakai `@noble/hashes`)
- **`headers.ts`** — parse/serialize Signature-Input & Signature (RFC 8941 subset)
- **`keyid.ts`** — format/parse base58 pubkey
- **`nonce.ts`** — `NonceStore` interface + `MemoryNonceStore` implementation

### Client Signing (`sdk/src/sign.ts`, `sdk/src/client.ts`)

- `signRequest(request, signer, options?)` → signed Request
- `signedFetch(input, init, signer, options?)` → Response
- `createSolAuthClient(signer, defaults?)` → `{ fetch, signRequest }`

### Server Verification (`sdk/src/verify.ts`, `sdk/src/onchain.ts`)

- `verifyRequest(request, { nonceStore?, policy? })` → VerifyResult
- `verifyOnChain({ connection, programId, owner, grantee, requiredScope })` → on-chain result

### Dependencies

```json
{
  "dependencies": {
    "@noble/hashes": "^1.4.0",
    "@noble/ed25519": "^2.1.0",
    "bs58": "^6.0.0"
  },
  "peerDependencies": {
    "@solana/web3.js": "^1.87.0"
  }
}
```

---

## Part 2: Backend (`backend/`)

Bun + Hono. Consume SDK untuk verification.

### Tech Stack

- **Runtime**: Bun
- **Framework**: Hono (lightweight, Web Standard API native)
- **SDK**: `../sdk` (local dependency)

### Hono Middleware (`backend/src/middleware/solauth.ts`)

```typescript
function solAuthMiddleware(options: {
  nonceStore?: NonceStore
  policy?: VerifyPolicy
  connection?: Connection
  programId?: PublicKey
  owner?: PublicKey
}): MiddlewareHandler
```

Flow:
1. `verifyRequest(c.req.raw)` → check Ed25519 signature
2. Jika `connection` provided: `verifyOnChain()` → check AccessGrant PDA
3. Set context: `c.set("solauth", { publicKey, scope })`
4. Atau return `401 Unauthorized` dengan reason

### Routes

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/api/grant` | owner signature | Grant access on-chain |
| `POST` | `/api/revoke` | owner signature | Revoke access on-chain |
| `GET` | `/api/data` | SolAuth (READ) | Protected read endpoint |
| `POST` | `/api/data` | SolAuth (WRITE) | Protected write endpoint |
| `GET` | `/api/access/:pubkey` | none | Check grant status (public) |

### Dependencies

```json
{
  "dependencies": {
    "hono": "^4.0.0",
    "@solana/web3.js": "^1.87.0",
    "@coral-xyz/anchor": "^0.32.0"
  },
  "devDependencies": {
    "@types/bun": "latest"
  }
}
```

---

## Part 3: Frontend (`frontend/`)

Vite + React + TailwindCSS + TanStack Query. Connect wallet → grant/revoke → test signed API calls.

### Tech Stack

- **Build**: Vite
- **UI**: React + TailwindCSS
- **State/Fetch**: TanStack React Query
- **Wallet**: `@solana/wallet-adapter-react` (Phantom, Backpack, Solflare)
- **Signing**: SDK `createSolAuthClient()` via wallet adapter bridge

### Wallet → SolAuthSigner Bridge (`frontend/src/lib/solauth-adapter.ts`)

```typescript
function walletToSigner(wallet: WalletContextState): SolAuthSigner {
  return {
    publicKey: wallet.publicKey!.toBase58(),
    signMessage: (msg) => wallet.signMessage!(msg)
  }
}
```

### Custom Hooks

| Hook | Type | Description |
|---|---|---|
| `useSolAuth()` | — | Buat SolAuthClient dari connected wallet |
| `useGrantAccess()` | mutation | Send `grant_access` tx on-chain |
| `useRevokeAccess()` | mutation | Send `revoke_access` tx on-chain |
| `useProtectedApi(path)` | query | Call backend dengan signed request |
| `useAccessGrant(pubkey)` | query | Fetch grant status dari backend |

### Pages/Components

| Component | Description |
|---|---|
| `WalletConnect` | Connect/disconnect wallet button |
| `GrantForm` | Form: input grantee pubkey, pilih scope (checkboxes), set expiry |
| `AccessList` | List grants yang sudah dibuat, dengan tombol revoke |
| `ApiTester` | Test panel: pilih endpoint, lihat signed headers, kirim request, lihat response |

### Dependencies

```json
{
  "dependencies": {
    "react": "^18.3.0",
    "react-dom": "^18.3.0",
    "@tanstack/react-query": "^5.0.0",
    "@solana/web3.js": "^1.87.0",
    "@solana/wallet-adapter-react": "^0.15.0",
    "@solana/wallet-adapter-react-ui": "^0.9.0",
    "@solana/wallet-adapter-wallets": "^0.19.0"
  },
  "devDependencies": {
    "vite": "^5.0.0",
    "@vitejs/plugin-react": "^4.0.0",
    "tailwindcss": "^4.0.0",
    "typescript": "^5.7.0"
  }
}
```

---

## Execution Order

| Step | Task | Location |
|---|---|---|
| 1 | Setup sdk/ project + install deps | `sdk/` |
| 2 | SDK: types.ts | `sdk/src/types.ts` |
| 3 | SDK: shared libs (lib/) | `sdk/src/lib/*.ts` |
| 4 | SDK: sign.ts + client.ts | `sdk/src/sign.ts`, `sdk/src/client.ts` |
| 5 | SDK: verify.ts + onchain.ts | `sdk/src/verify.ts`, `sdk/src/onchain.ts` |
| 6 | SDK: index.ts (barrel) | `sdk/src/index.ts` |
| 7 | Setup backend/ project + install deps | `backend/` |
| 8 | Backend: solauth middleware | `backend/src/middleware/solauth.ts` |
| 9 | Backend: routes + entry point | `backend/src/routes/*.ts`, `backend/src/index.ts` |
| 10 | Setup frontend/ project + install deps | `frontend/` |
| 11 | Frontend: wallet adapter + SolAuth bridge | `frontend/src/lib/solauth-adapter.ts` |
| 12 | Frontend: hooks | `frontend/src/hooks/*.ts` |
| 13 | Frontend: components + pages | `frontend/src/components/*.tsx` |
| 14 | Tests | `sdk/src/**/*.test.ts` |

---

## Verification

1. **SDK unit tests** — sign → verify roundtrip, invalid signature, expired, nonce replay, digest mismatch
2. **Backend test** — `bun run src/index.ts`, hit endpoints with signed requests via curl/script
3. **Frontend test** — `bun run dev`, connect Phantom, grant access, test signed API calls
4. **E2E flow** — start local validator → deploy program → start backend → open frontend → grant → call protected API → revoke → verify rejection
