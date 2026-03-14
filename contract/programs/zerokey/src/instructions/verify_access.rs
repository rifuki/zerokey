use anchor_lang::prelude::*;

use crate::errors::ZerokeyError;
use crate::state::AccessGrant;

#[derive(Accounts)]
pub struct VerifyAccess<'info> {
    /// CHECK: The owner whose grant we are checking
    pub owner: UncheckedAccount<'info>,

    /// CHECK: The grantee whose access we are verifying
    pub grantee: UncheckedAccount<'info>,

    #[account(
        seeds = [b"access", owner.key().as_ref(), grantee.key().as_ref()],
        bump = access_grant.bump,
        has_one = owner,
        has_one = grantee,
    )]
    pub access_grant: Account<'info, AccessGrant>,
}

impl<'info> VerifyAccess<'info> {
    pub fn process(&self, required_scope: u8) -> Result<()> {
        let grant = &self.access_grant;

        require!(!grant.revoked, ZerokeyError::AccessRevoked);

        if grant.expires_at != 0 {
            let clock = Clock::get()?;
            require!(
                clock.unix_timestamp < grant.expires_at,
                ZerokeyError::AccessExpired
            );
        }

        require!(
            grant.scope & required_scope == required_scope,
            ZerokeyError::InsufficientScope
        );

        Ok(())
    }
}
