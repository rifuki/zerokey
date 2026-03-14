// Types
export type {
  SolAuthSigner,
  SignOptions,
  BindingMode,
  ReplayMode,
  SignatureParams,
  VerifyPolicy,
  VerifyResult,
  VerifySuccess,
  VerifyFailure,
  VerifyFailReason,
  NonceStore,
  AccessGrant,
  OnChainResult,
  OnChainFailReason,
} from "./types.js";

export { Scope } from "./types.js";

// Client — signing
export { signRequest, signedFetch } from "./sign.js";
export { createSolAuthClient } from "./client.js";
export type { SolAuthClient } from "./client.js";

// Server — verification
export { verifyRequest } from "./verify.js";
export type { VerifyRequestOptions } from "./verify.js";

// On-chain
export {
  verifyOnChain,
  deriveAccessGrantPDA,
  ZEROKEY_PROGRAM_ID,
} from "./onchain.js";

// Lib utilities
export { formatKeyId, parseKeyId } from "./lib/keyid.js";
export { computeDigest, verifyDigest } from "./lib/content-digest.js";
export { MemoryNonceStore, generateNonce } from "./lib/nonce.js";
export {
  buildSignatureBase,
  buildSignatureParams,
  parseSignatureParams,
} from "./lib/signature-base.js";
export {
  serializeSignatureInput,
  serializeSignature,
  parseSignatureInput,
  parseSignature,
} from "./lib/headers.js";

// App wallet (Web Crypto non-extractable keys + IndexedDB)
export {
  createAppWallet,
  saveAppWallet,
  loadAppWallet,
  clearAppWallet,
  hasAppWallet,
  createAppWalletSigner,
  appWalletToSigner,
} from "./lib/app-wallet.js";
export type { AppWallet } from "./lib/app-wallet.js";
