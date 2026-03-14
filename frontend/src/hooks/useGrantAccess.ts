import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useWallet } from "@solana/wallet-adapter-react";
import { useConnection } from "@solana/wallet-adapter-react";
import { PublicKey, Transaction, SystemProgram } from "@solana/web3.js";
import * as anchor from "@coral-xyz/anchor";
import { ZEROKEY_PROGRAM_ID } from "@zerokey/sdk";

interface GrantAccessParams {
  grantee: string;
  scope: number;
  expiresAt: number; // 0 = never
}

/**
 * Mutation hook: send grant_access transaction on-chain.
 */
export function useGrantAccess() {
  const { publicKey, sendTransaction } = useWallet();
  const { connection } = useConnection();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ grantee, scope, expiresAt }: GrantAccessParams) => {
      if (!publicKey) throw new Error("Wallet not connected");

      const granteePubkey = new PublicKey(grantee);
      const [accessGrantPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("access"), publicKey.toBuffer(), granteePubkey.toBuffer()],
        ZEROKEY_PROGRAM_ID
      );

      // Build the instruction data manually (Anchor format)
      // grant_access discriminator + scope(u8) + expires_at(i64)
      const discriminator = Buffer.from([
        66, 88, 87, 113, 39, 22, 27, 165,
      ]); // sha256("global:grant_access")[..8]
      const data = Buffer.alloc(1 + 8);
      data.writeUInt8(scope, 0);
      data.writeBigInt64LE(BigInt(expiresAt), 1);

      const ix = new anchor.web3.TransactionInstruction({
        programId: ZEROKEY_PROGRAM_ID,
        keys: [
          { pubkey: publicKey, isSigner: true, isWritable: true },
          { pubkey: granteePubkey, isSigner: false, isWritable: false },
          { pubkey: accessGrantPda, isSigner: false, isWritable: true },
          { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        ],
        data: Buffer.concat([discriminator, data]),
      });

      const tx = new Transaction().add(ix);
      const sig = await sendTransaction(tx, connection);
      await connection.confirmTransaction(sig, "confirmed");
      return sig;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["access"] });
    },
  });
}
