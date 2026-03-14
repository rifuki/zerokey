import { Connection, PublicKey } from "@solana/web3.js";
import { ZEROKEY_PROGRAM_ID } from "@zerokey/sdk";

export const RPC_URL = process.env.RPC_URL || "https://api.devnet.solana.com";
export const connection = new Connection(RPC_URL, "confirmed");
export const programId = ZEROKEY_PROGRAM_ID;

/** Owner pubkey — set via OWNER_PUBKEY env var */
export const ownerPubkey = process.env.OWNER_PUBKEY
  ? new PublicKey(process.env.OWNER_PUBKEY)
  : null;
