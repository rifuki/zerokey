import { PublicKey, Connection } from "@solana/web3.js";
import type { AccessGrant, OnChainResult } from "./types.js";

/** Default Zerokey program ID */
export const ZEROKEY_PROGRAM_ID = new PublicKey(
  "GRSXhFiiaA2aDJwa2b15TtL6JHRHoEefZbEoM1aFCGqh"
);

/** Anchor account discriminator for AccessGrant (first 8 bytes) */
const ACCESS_GRANT_DISCRIMINATOR = [
  167, 55, 184, 237, 74, 242, 0, 109,
]; // sha256("account:AccessGrant")[..8]

/**
 * Derive the AccessGrant PDA address.
 * Seeds: ["access", owner, grantee]
 */
export function deriveAccessGrantPDA(
  owner: PublicKey,
  grantee: PublicKey,
  programId: PublicKey = ZEROKEY_PROGRAM_ID
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("access"), owner.toBuffer(), grantee.toBuffer()],
    programId
  );
}

/**
 * Verify access on-chain by fetching and deserializing the AccessGrant PDA.
 * This is FREE — just an RPC read, no transaction.
 */
export async function verifyOnChain(options: {
  connection: Connection;
  owner: PublicKey | string;
  grantee: PublicKey | string;
  requiredScope: number;
  programId?: PublicKey;
}): Promise<OnChainResult> {
  const {
    connection,
    requiredScope,
    programId = ZEROKEY_PROGRAM_ID,
  } = options;

  const owner =
    typeof options.owner === "string"
      ? new PublicKey(options.owner)
      : options.owner;
  const grantee =
    typeof options.grantee === "string"
      ? new PublicKey(options.grantee)
      : options.grantee;

  const [pda] = deriveAccessGrantPDA(owner, grantee, programId);

  const accountInfo = await connection.getAccountInfo(pda);
  if (!accountInfo || !accountInfo.data) {
    return { ok: false, reason: "not_found" };
  }

  const grant = deserializeAccessGrant(accountInfo.data);
  if (!grant) {
    return { ok: false, reason: "not_found" };
  }

  // Check revoked
  if (grant.revoked) {
    return { ok: false, reason: "access_revoked" };
  }

  // Check expired
  if (grant.expiresAt !== 0) {
    const now = Math.floor(Date.now() / 1000);
    if (now >= grant.expiresAt) {
      return { ok: false, reason: "access_expired" };
    }
  }

  // Check scope
  if ((grant.scope & requiredScope) !== requiredScope) {
    return { ok: false, reason: "insufficient_scope" };
  }

  return { ok: true, grant };
}

/**
 * Deserialize AccessGrant from raw account data (Anchor format).
 *
 * Layout (after 8-byte discriminator):
 *   owner:      32 bytes (Pubkey)
 *   grantee:    32 bytes (Pubkey)
 *   scope:      1 byte (u8)
 *   expires_at: 8 bytes (i64, little-endian)
 *   revoked:    1 byte (bool)
 *   created_at: 8 bytes (i64, little-endian)
 *   updated_at: 8 bytes (i64, little-endian)
 *   bump:       1 byte (u8)
 */
function deserializeAccessGrant(data: Buffer | Uint8Array): AccessGrant | null {
  const buf = data instanceof Buffer ? data : Buffer.from(data);

  if (buf.length < 8 + 32 + 32 + 1 + 8 + 1 + 8 + 8 + 1) {
    return null;
  }

  // Verify discriminator
  for (let i = 0; i < 8; i++) {
    if (buf[i] !== ACCESS_GRANT_DISCRIMINATOR[i]) return null;
  }

  let offset = 8;

  const owner = new PublicKey(buf.subarray(offset, offset + 32)).toBase58();
  offset += 32;

  const grantee = new PublicKey(buf.subarray(offset, offset + 32)).toBase58();
  offset += 32;

  const scope = buf[offset];
  offset += 1;

  const expiresAt = Number(buf.readBigInt64LE(offset));
  offset += 8;

  const revoked = buf[offset] !== 0;
  offset += 1;

  const createdAt = Number(buf.readBigInt64LE(offset));
  offset += 8;

  const updatedAt = Number(buf.readBigInt64LE(offset));
  offset += 8;

  const bump = buf[offset];

  return { owner, grantee, scope, expiresAt, revoked, createdAt, updatedAt, bump };
}
