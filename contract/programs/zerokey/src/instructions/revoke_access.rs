use anchor_lang::prelude::*;

use crate::state::AccessGrant;

#[derive(Accounts)]
pub struct RevokeAccess<'info> {
    pub owner: Signer<'info>,

    /// CHECK: The grantee can be any valid pubkey
    pub grantee: UncheckedAccount<'info>,

    #[account(
        mut,
        seeds = [b"access", owner.key().as_ref(), grantee.key().as_ref()],
        bump = access_grant.bump,
        has_one = owner,
        has_one = grantee,
    )]
    pub access_grant: Account<'info, AccessGrant>,
}

impl<'info> RevokeAccess<'info> {
    pub fn process(&mut self) -> Result<()> {
        let clock = Clock::get()?;
        self.access_grant.revoked = true;
        self.access_grant.updated_at = clock.unix_timestamp;
        Ok(())
    }
}
