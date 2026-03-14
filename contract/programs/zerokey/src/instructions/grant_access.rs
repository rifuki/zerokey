use anchor_lang::prelude::*;

use crate::errors::ZerokeyError;
use crate::state::AccessGrant;

#[derive(Accounts)]
#[instruction(scope: u8, expires_at: i64)]
pub struct GrantAccess<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,

    /// CHECK: The grantee can be any valid pubkey
    pub grantee: UncheckedAccount<'info>,

    #[account(
        init_if_needed,
        payer = owner,
        space = 8 + AccessGrant::INIT_SPACE,
        seeds = [b"access", owner.key().as_ref(), grantee.key().as_ref()],
        bump,
    )]
    pub access_grant: Account<'info, AccessGrant>,

    pub system_program: Program<'info, System>,
}

impl<'info> GrantAccess<'info> {
    pub fn process(&mut self, bumps: &GrantAccessBumps, scope: u8, expires_at: i64) -> Result<()> {
        let clock = Clock::get()?;

        require!(
            expires_at == 0 || expires_at > clock.unix_timestamp,
            ZerokeyError::InvalidExpiry
        );

        let grant = &mut self.access_grant;

        if grant.created_at == 0 {
            // New grant
            grant.owner = self.owner.key();
            grant.grantee = self.grantee.key();
            grant.created_at = clock.unix_timestamp;
            grant.bump = bumps.access_grant;
        }

        grant.scope = scope;
        grant.expires_at = expires_at;
        grant.revoked = false;
        grant.updated_at = clock.unix_timestamp;

        Ok(())
    }
}
