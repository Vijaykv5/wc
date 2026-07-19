use anchor_lang::prelude::*;

declare_id!("FANXexs6P2Fst4NiiCdH9jx39sxPCGRRVpC2nevL5C6U");

const MAX_COUNTRY_LEN: usize = 40;
const MAX_METADATA_URI_LEN: usize = 200;

#[program]
pub mod faniq_passport {
    use super::*;

    pub fn create_passport(ctx: Context<CreatePassport>, country: String) -> Result<()> {
        require!(
            !country.trim().is_empty() && country.len() <= MAX_COUNTRY_LEN,
            FaniqError::InvalidCountry
        );

        let passport = &mut ctx.accounts.passport;
        passport.owner = ctx.accounts.owner.key();
        passport.country = country;
        passport.created_at = Clock::get()?.unix_timestamp;
        passport.bump = ctx.bumps.passport;

        emit!(PassportCreated {
            owner: passport.owner,
            country: passport.country.clone(),
            created_at: passport.created_at,
        });

        Ok(())
    }

    pub fn register_memory(
        ctx: Context<RegisterMemory>,
        memory_country: String,
        nft_mint: Pubkey,
        metadata_uri: String,
    ) -> Result<()> {
        require!(
            !memory_country.trim().is_empty() && memory_country.len() <= MAX_COUNTRY_LEN,
            FaniqError::InvalidCountry
        );
        require!(
            !metadata_uri.trim().is_empty() && metadata_uri.len() <= MAX_METADATA_URI_LEN,
            FaniqError::InvalidMetadataUri
        );

        let passport = &ctx.accounts.passport;
        let memory = &mut ctx.accounts.memory;
        memory.owner = ctx.accounts.owner.key();
        memory.passport = passport.key();
        memory.nft_mint = nft_mint;
        memory.memory_country = memory_country;
        memory.passport_country = passport.country.clone();
        memory.metadata_uri = metadata_uri;
        memory.created_at = Clock::get()?.unix_timestamp;
        memory.bump = ctx.bumps.memory;

        emit!(MemoryRegistered {
            owner: memory.owner,
            passport: memory.passport,
            nft_mint: memory.nft_mint,
            memory_country: memory.memory_country.clone(),
            passport_country: memory.passport_country.clone(),
            metadata_uri: memory.metadata_uri.clone(),
            created_at: memory.created_at,
        });

        Ok(())
    }
}

#[derive(Accounts)]
pub struct CreatePassport<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,
    #[account(
        init,
        payer = owner,
        space = FanPassport::SPACE,
        seeds = [b"passport", owner.key().as_ref()],
        bump
    )]
    pub passport: Account<'info, FanPassport>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(memory_country: String, nft_mint: Pubkey, metadata_uri: String)]
pub struct RegisterMemory<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,
    #[account(
        seeds = [b"passport", owner.key().as_ref()],
        bump = passport.bump,
        has_one = owner @ FaniqError::InvalidPassportOwner
    )]
    pub passport: Account<'info, FanPassport>,
    #[account(
        init,
        payer = owner,
        space = MemoryRecord::SPACE,
        seeds = [b"memory", owner.key().as_ref(), nft_mint.as_ref()],
        bump
    )]
    pub memory: Account<'info, MemoryRecord>,
    pub system_program: Program<'info, System>,
}

#[account]
pub struct FanPassport {
    pub owner: Pubkey,
    pub country: String,
    pub created_at: i64,
    pub bump: u8,
}

impl FanPassport {
    pub const SPACE: usize = 8 + 32 + (4 + MAX_COUNTRY_LEN) + 8 + 1;
}

#[account]
pub struct MemoryRecord {
    pub owner: Pubkey,
    pub passport: Pubkey,
    pub nft_mint: Pubkey,
    pub memory_country: String,
    pub passport_country: String,
    pub metadata_uri: String,
    pub created_at: i64,
    pub bump: u8,
}

impl MemoryRecord {
    pub const SPACE: usize =
        8 + 32 + 32 + 32 + (4 + MAX_COUNTRY_LEN) + (4 + MAX_COUNTRY_LEN) + (4 + MAX_METADATA_URI_LEN) + 8 + 1;
}

#[event]
pub struct PassportCreated {
    pub owner: Pubkey,
    pub country: String,
    pub created_at: i64,
}

#[event]
pub struct MemoryRegistered {
    pub owner: Pubkey,
    pub passport: Pubkey,
    pub nft_mint: Pubkey,
    pub memory_country: String,
    pub passport_country: String,
    pub metadata_uri: String,
    pub created_at: i64,
}

#[error_code]
pub enum FaniqError {
    #[msg("Country must be present and 40 characters or fewer.")]
    InvalidCountry,
    #[msg("Metadata URI must be present and 200 characters or fewer.")]
    InvalidMetadataUri,
    #[msg("The passport does not belong to this wallet.")]
    InvalidPassportOwner,
}
