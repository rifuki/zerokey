/** Signer interface — bridge from wallet or keypair */
export interface SolAuthSigner {
  publicKey: string;
  signMessage: (message: Uint8Array) => Promise<Uint8Array>;
}

/** Binding mode — how tightly signature is bound to the request */
export type BindingMode = "request-bound" | "class-bound";

/** Replay mode — can the signature be reused? */
export type ReplayMode = "non-replayable" | "replayable";

/** Options for signing a request */
export interface SignOptions {
  /** Signature label in headers (default: "sol") */
  label?: string;
  /** Request-bound covers all components, class-bound covers method+path only */
  binding?: BindingMode;
  /** Non-replayable includes nonce, replayable uses TTL only */
  replay?: ReplayMode;
  /** Signature validity in seconds (default: 60) */
  ttlSeconds?: number;
  /** Custom nonce or nonce generator */
  nonce?: string | (() => Promise<string>);
  /** Zerokey scope bitmask to declare in header */
  scope?: number;
  /** Override which components to sign */
  components?: string[];
}

/** Parsed signature params from Signature-Input header */
export interface SignatureParams {
  created: number;
  expires: number;
  keyid: string;
  nonce?: string;
  scope?: number;
}

/** Policy for verifying requests */
export interface VerifyPolicy {
  /** Max age of signature in seconds (default: 300) */
  maxValiditySec?: number;
  /** Clock skew tolerance in seconds (default: 5) */
  clockSkewSec?: number;
  /** Allow nonce-less signatures (default: false) */
  replayable?: boolean;
}

/** Successful verification result */
export interface VerifySuccess {
  ok: true;
  publicKey: string;
  scope?: number;
  binding: BindingMode;
  replayable: boolean;
  params: SignatureParams;
}

/** Failed verification result */
export interface VerifyFailure {
  ok: false;
  reason: VerifyFailReason;
}

export type VerifyResult = VerifySuccess | VerifyFailure;

export type VerifyFailReason =
  | "missing_headers"
  | "invalid_signature"
  | "expired"
  | "nonce_reused"
  | "invalid_digest"
  | "invalid_keyid"
  | "parse_error";

/** Nonce store interface — track consumed nonces to prevent replay */
export interface NonceStore {
  /** Returns true if nonce was successfully consumed (first use), false if already seen */
  consume(key: string, ttlSeconds: number): Promise<boolean>;
}

/** On-chain access grant data (mirrors Zerokey AccessGrant) */
export interface AccessGrant {
  owner: string;
  grantee: string;
  scope: number;
  expiresAt: number;
  revoked: boolean;
  createdAt: number;
  updatedAt: number;
  bump: number;
}

/** On-chain verification result */
export type OnChainResult =
  | { ok: true; grant: AccessGrant }
  | { ok: false; reason: OnChainFailReason };

export type OnChainFailReason =
  | "not_found"
  | "access_revoked"
  | "access_expired"
  | "insufficient_scope";

/** Scope bitmask constants */
export const Scope = {
  READ: 0x01,
  WRITE: 0x02,
  DELETE: 0x04,
  ADMIN: 0x08,
} as const;
