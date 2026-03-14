use anchor_lang::prelude::*;

#[error_code]
pub enum ZerokeyError {
    #[msg("Access has been revoked")]
    AccessRevoked,
    #[msg("Access has expired")]
    AccessExpired,
    #[msg("Insufficient scope for this operation")]
    InsufficientScope,
    #[msg("Expiry must be 0 (never) or a future timestamp")]
    InvalidExpiry,
}
