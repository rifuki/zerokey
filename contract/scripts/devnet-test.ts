import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Zerokey } from "../target/types/zerokey";
import { Keypair, PublicKey, Connection } from "@solana/web3.js";

const READ = 0x01;
const WRITE = 0x02;

async function main() {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.zerokey as Program<Zerokey>;
  const owner = provider.wallet;
  const grantee = Keypair.generate();

  console.log("Program ID:", program.programId.toBase58());
  console.log("Owner:", owner.publicKey.toBase58());
  console.log("Grantee:", grantee.publicKey.toBase58());
  console.log("");

  // 1. Grant access
  const grantTx = await program.methods
    .grantAccess(READ | WRITE, new anchor.BN(0))
    .accounts({
      owner: owner.publicKey,
      grantee: grantee.publicKey,
    })
    .rpc();
  console.log("grant_access tx:", grantTx);
  console.log(`  https://explorer.solana.com/tx/${grantTx}?cluster=devnet`);

  // 2. Verify access
  const verifyTx = await program.methods
    .verifyAccess(READ)
    .accounts({
      owner: owner.publicKey,
      grantee: grantee.publicKey,
    })
    .rpc();
  console.log("verify_access tx:", verifyTx);
  console.log(`  https://explorer.solana.com/tx/${verifyTx}?cluster=devnet`);

  // 3. Revoke access
  const revokeTx = await program.methods
    .revokeAccess()
    .accounts({
      owner: owner.publicKey,
      grantee: grantee.publicKey,
    })
    .rpc();
  console.log("revoke_access tx:", revokeTx);
  console.log(`  https://explorer.solana.com/tx/${revokeTx}?cluster=devnet`);

  // 4. Verify fails after revoke
  try {
    await program.methods
      .verifyAccess(READ)
      .accounts({
        owner: owner.publicKey,
        grantee: grantee.publicKey,
      })
      .rpc();
    console.log("ERROR: verify should have failed");
  } catch (err: any) {
    console.log("verify_access after revoke: CORRECTLY REJECTED -", err.error?.errorCode?.code);
  }

  console.log("\nDone! All devnet tests passed.");
}

main().catch(console.error);
