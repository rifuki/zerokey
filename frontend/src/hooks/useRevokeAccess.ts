import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { PublicKey, Transaction } from "@solana/web3.js";
import * as anchor from "@coral-xyz/anchor";
import { ZEROKEY_PROGRAM_ID } from "@zerokey/sdk";

interface RevokeAccessParams {
  grantee: string;
}

/**
 * Mutation hook: send revoke_access transaction on-chain.
 */
export function useRevokeAccess() {
  const { publicKey, sendTransaction } = useWallet();
  const { connection } = useConnection();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ grantee }: RevokeAccessParams) => {
      if (!publicKey) throw new Error("Wallet not connected");

      const granteePubkey = new PublicKey(grantee);
      const [accessGrantPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("access"), publicKey.toBuffer(), granteePubkey.toBuffer()],
        ZEROKEY_PROGRAM_ID
      );

      // revoke_access discriminator
      const discriminator = Buffer.from([
        106, 128, 38, 169, 103, 238, 102, 147,
      ]); // sha256("global:revoke_access")[..8]

      const ix = new anchor.web3.TransactionInstruction({
        programId: ZEROKEY_PROGRAM_ID,
        keys: [
          { pubkey: publicKey, isSigner: true, isWritable: false },
          { pubkey: granteePubkey, isSigner: false, isWritable: false },
          { pubkey: accessGrantPda, isSigner: false, isWritable: true },
        ],
        data: discriminator,
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
