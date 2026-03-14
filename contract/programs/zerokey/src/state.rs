use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct AccessGrant {
    pub owner: Pubkey,
    pub grantee: Pubkey,
    /// Bitmask: READ=0x01, WRITE=0x02, DELETE=0x04, ADMIN=0x08
    pub scope: u8,
    /// Unix timestamp; 0 = never expires
    pub expires_at: i64,
    pub revoked: bool,
    pub created_at: i64,
    pub updated_at: i64,
    pub bump: u8,
}
