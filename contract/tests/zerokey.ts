import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Zerokey } from "../target/types/zerokey";
import { expect } from "chai";
import { Keypair, PublicKey } from "@solana/web3.js";

// Scope bitmask constants
const READ = 0x01;
const WRITE = 0x02;
const DELETE = 0x04;
const ADMIN = 0x08;

function findAccessGrantPDA(
  programId: PublicKey,
  owner: PublicKey,
  grantee: PublicKey
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("access"), owner.toBuffer(), grantee.toBuffer()],
    programId
  );
}

describe("zerokey", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.zerokey as Program<Zerokey>;
  const owner = provider.wallet;
  const grantee = Keypair.generate();

  it("grant_access → verify_access succeeds", async () => {
    const scope = READ | WRITE; // 0x03
    const expiresAt = new anchor.BN(0); // never

    await program.methods
      .grantAccess(scope, expiresAt)
      .accounts({
        owner: owner.publicKey,
        grantee: grantee.publicKey,
      })
      .rpc();

    // Verify the grant was created
    const [pda] = findAccessGrantPDA(
      program.programId,
      owner.publicKey,
      grantee.publicKey
    );
    const grant = await program.account.accessGrant.fetch(pda);
    expect(grant.owner.toBase58()).to.equal(owner.publicKey.toBase58());
    expect(grant.grantee.toBase58()).to.equal(grantee.publicKey.toBase58());
    expect(grant.scope).to.equal(scope);
    expect(grant.expiresAt.toNumber()).to.equal(0);
    expect(grant.revoked).to.equal(false);

    // Verify access succeeds
    await program.methods
      .verifyAccess(READ)
      .accounts({
        owner: owner.publicKey,
        grantee: grantee.publicKey,
      })
      .rpc();
  });

  it("revoke_access → verify_access fails with AccessRevoked", async () => {
    await program.methods
      .revokeAccess()
      .accounts({
        owner: owner.publicKey,
        grantee: grantee.publicKey,
      })
      .rpc();

    // Verify access now fails
    try {
      await program.methods
        .verifyAccess(READ)
        .accounts({
          owner: owner.publicKey,
          grantee: grantee.publicKey,
        })
        .rpc();
      expect.fail("Should have thrown AccessRevoked");
    } catch (err: any) {
      expect(err.error.errorCode.code).to.equal("AccessRevoked");
    }
  });

  it("re-grant after revoke restores access", async () => {
    const scope = READ | WRITE | DELETE; // 0x07

    await program.methods
      .grantAccess(scope, new anchor.BN(0))
      .accounts({
        owner: owner.publicKey,
        grantee: grantee.publicKey,
      })
      .rpc();

    // Verify the grant is active again
    const [pda] = findAccessGrantPDA(
      program.programId,
      owner.publicKey,
      grantee.publicKey
    );
    const grant = await program.account.accessGrant.fetch(pda);
    expect(grant.revoked).to.equal(false);
    expect(grant.scope).to.equal(scope);

    // Verify access works
    await program.methods
      .verifyAccess(DELETE)
      .accounts({
        owner: owner.publicKey,
        grantee: grantee.publicKey,
      })
      .rpc();
  });

  it("insufficient scope → verify_access fails", async () => {
    try {
      await program.methods
        .verifyAccess(ADMIN) // ADMIN not granted
        .accounts({
          owner: owner.publicKey,
          grantee: grantee.publicKey,
        })
        .rpc();
      expect.fail("Should have thrown InsufficientScope");
    } catch (err: any) {
      expect(err.error.errorCode.code).to.equal("InsufficientScope");
    }
  });

  it("expired grant → verify_access fails", async () => {
    const grantee2 = Keypair.generate();
    const scope = READ;
    // Set expiry to 1 second from now
    const now = Math.floor(Date.now() / 1000);
    const expiresAt = new anchor.BN(now + 2);

    await program.methods
      .grantAccess(scope, expiresAt)
      .accounts({
        owner: owner.publicKey,
        grantee: grantee2.publicKey,
      })
      .rpc();

    // Wait for expiry
    await new Promise((resolve) => setTimeout(resolve, 3000));

    try {
      await program.methods
        .verifyAccess(READ)
        .accounts({
          owner: owner.publicKey,
          grantee: grantee2.publicKey,
        })
        .rpc();
      expect.fail("Should have thrown AccessExpired");
    } catch (err: any) {
      expect(err.error.errorCode.code).to.equal("AccessExpired");
    }
  });
});
