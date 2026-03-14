use anchor_lang::prelude::*;

pub mod errors;
pub mod instructions;
pub mod state;

use instructions::*;

declare_id!("GRSXhFiiaA2aDJwa2b15TtL6JHRHoEefZbEoM1aFCGqh");

#[program]
pub mod zerokey {
    use super::*;

    pub fn grant_access(ctx: Context<GrantAccess>, scope: u8, expires_at: i64) -> Result<()> {
        ctx.accounts.process(&ctx.bumps, scope, expires_at)
    }

    pub fn revoke_access(ctx: Context<RevokeAccess>) -> Result<()> {
        ctx.accounts.process()
    }

    pub fn verify_access(ctx: Context<VerifyAccess>, required_scope: u8) -> Result<()> {
        ctx.accounts.process(required_scope)
    }
}
