// SOL CIRCLE WITH ARCIUM CONFIDENTIAL DARK POOL
// Combines public PDA pools with encrypted dark pools using Arcium MPC
//
// Build: arcium build
// Deploy: arcium deploy

use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};

// Arcium imports for confidential computing
use arcium_anchor::prelude::*;
use arcium_client::prelude::*;

// Import encrypted circuits
use encrypted_ixs::circuits::{
    DepositInput, DepositResult, WithdrawInput, WithdrawResult,
    TransferInput, TransferResult, AggregateInput, AggregateStats,
};

declare_id!("CXsaoofHepCa6JT197g6PpzviF4H4adHrjRmekwT5vtL");

/// Arcium MPC Authority - will be provided by Arcium network
/// Replace with actual pubkey from Arcium documentation
const ARCIUM_MPC_AUTHORITY: Pubkey = solana_program::pubkey!("11111111111111111111111111111111");

#[arcium_program]
pub mod sol_circle {
    use super::*;

    // ========================================================================
    // ORACLE MANAGEMENT
    // ========================================================================

    /// Initialize oracle configuration (admin only, called once)
    pub fn initialize_oracle(ctx: Context<InitializeOracle>) -> Result<()> {
        let oracle_config = &mut ctx.accounts.oracle_config;
        oracle_config.authority = ctx.accounts.authority.key();
        oracle_config.oracle_pubkey = ctx.accounts.oracle_pubkey.key();
        oracle_config.bump = ctx.bumps.oracle_config;

        msg!("Oracle initialized: {}", oracle_config.oracle_pubkey);
        Ok(())
    }

    // ========================================================================
    // HELLO-WORLD EXAMPLE (for tests): add_together
    // Wires the encrypted-ixs `add_together` circuit so the existing
    // TypeScript test `tests/solcircle_arcium.ts` can run unchanged.
    // ========================================================================

    /// Initialize computation definition for `add_together`
    pub fn init_add_together_comp_def(
        ctx: Context<InitAddTogetherCompDef>,
    ) -> Result<()> {
        // Store circuit on-chain (small demo circuit)
        // For bigger circuits consider OffChainCircuitSource per Arcium docs
        init_comp_def(ctx.accounts, true, 0, None, None)?;
        Ok(())
    }

    /// Queue encrypted computation for `add_together`
    pub fn add_together(
        ctx: Context<AddTogether>,
        computation_offset: u64,
        ciphertext_0: [u8; 32],
        ciphertext_1: [u8; 32],
        pub_key: [u8; 32],
        nonce: u128,
    ) -> Result<()> {
        // Arguments expected by the `add_together` circuit (see encrypted-ixs)
        let args = vec![
            Argument::ArcisPubkey(pub_key),
            Argument::PlaintextU128(nonce),
            Argument::EncryptedU8(ciphertext_0),
            Argument::EncryptedU8(ciphertext_1),
        ];

        // Required by Arcium account signer PDA
        ctx.accounts.sign_pda_account.bump = ctx.bumps.sign_pda_account;

        // Queue the computation and specify the callback to be invoked
        queue_computation(
            ctx.accounts,
            computation_offset,
            args,
            None,
            vec![AddTogetherCallback::callback_ix(&[])],
        )?;
        Ok(())
    }

    /// Callback for `add_together` returning the encrypted sum and nonce
    #[arcium_callback(encrypted_ix = "add_together")]
    pub fn add_together_callback(
        ctx: Context<AddTogetherCallback>,
        output: ComputationOutputs<AddTogetherOutput>,
    ) -> Result<()> {
        let o = match output {
            ComputationOutputs::Success(AddTogetherOutput { field_0: o }) => o,
            _ => return Err(ErrorCode::MpcComputationFailed.into()),
        };

        emit!(SumEvent {
            sum: o.ciphertexts[0],
            nonce: o.nonce.to_le_bytes(),
        });
        Ok(())
    }

    /// Update oracle public key (authority only)
    pub fn update_oracle(ctx: Context<UpdateOracle>, new_oracle_pubkey: Pubkey) -> Result<()> {
        ctx.accounts.oracle_config.oracle_pubkey = new_oracle_pubkey;
        msg!("Oracle updated: {}", new_oracle_pubkey);
        Ok(())
    }

    // ========================================================================
    // PUBLIC OPERATIONS (Original Functionality)
    // ========================================================================

    /// Initialize user's public deposit account (PDA)
    pub fn initialize_user_deposit(ctx: Context<InitializeUserDeposit>) -> Result<()> {
        let user_deposit = &mut ctx.accounts.user_deposit;
        user_deposit.owner = ctx.accounts.user.key();
        user_deposit.deposited_amount = 0;
        user_deposit.bump = ctx.bumps.user_deposit;

        msg!("User deposit initialized: {}", user_deposit.owner);
        Ok(())
    }

    /// Deposit tokens to user's public PDA (amount visible)
    pub fn deposit_to_user_pda(ctx: Context<DepositToUserPda>, amount: u64) -> Result<()> {
        require!(amount > 0, ErrorCode::InvalidAmount);

        // Transfer tokens from user to their PDA vault
        token::transfer(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.user_token_account.to_account_info(),
                    to: ctx.accounts.user_vault.to_account_info(),
                    authority: ctx.accounts.user.to_account_info(),
                },
            ),
            amount,
        )?;

        ctx.accounts.user_deposit.deposited_amount += amount;
        msg!("User {} deposited {} (PUBLIC)", ctx.accounts.user.key(), amount);
        Ok(())
    }

    /// Withdraw from user's public PDA with oracle signature
    pub fn withdraw_from_user_pda(
        ctx: Context<WithdrawFromUserPda>,
        amount: u64,
        oracle_signature: [u8; 64],
    ) -> Result<()> {
        require!(amount > 0, ErrorCode::InvalidAmount);
        require!(
            amount <= ctx.accounts.user_deposit.deposited_amount,
            ErrorCode::InsufficientBalance
        );

        // Verify oracle signature
        verify_oracle_signature(
            &ctx.accounts.oracle_config,
            format!(
                "withdraw:{}:{}:{}",
                ctx.accounts.user.key(),
                amount,
                Clock::get()?.unix_timestamp / 300
            )
            .as_bytes(),
            &oracle_signature,
        )?;

        // Transfer tokens from PDA vault back to user
        let seeds = &[
            b"user_vault",
            ctx.accounts.user.key().as_ref(),
            &[ctx.accounts.user_deposit.bump],
        ];

        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.user_vault.to_account_info(),
                    to: ctx.accounts.user_token_account.to_account_info(),
                    authority: ctx.accounts.user_vault.to_account_info(),
                },
                &[&seeds[..]],
            ),
            amount,
        )?;

        ctx.accounts.user_deposit.deposited_amount -= amount;
        msg!("User {} withdrew {} (PUBLIC)", ctx.accounts.user.key(), amount);
        Ok(())
    }

    /// Create public group pool
    pub fn create_group_pool(
        ctx: Context<CreateGroupPool>,
        group_id: String,
        group_name: String,
    ) -> Result<()> {
        let group_pool = &mut ctx.accounts.group_pool;
        group_pool.admin = ctx.accounts.admin.key();
        group_pool.group_id = group_id.clone();
        group_pool.group_name = group_name;
        group_pool.total_locked = 0;
        group_pool.is_active = true;
        group_pool.bump = ctx.bumps.group_pool;

        msg!("Group pool created: {}", group_id);
        Ok(())
    }

    /// Release funds from user PDA to public group pool (oracle-triggered)
    pub fn release_funds_to_group(
        ctx: Context<ReleaseFundsToGroup>,
        amount: u64,
        oracle_signature: [u8; 64],
    ) -> Result<()> {
        require!(amount > 0, ErrorCode::InvalidAmount);
        require!(
            amount <= ctx.accounts.user_deposit.deposited_amount,
            ErrorCode::InsufficientBalance
        );
        require!(ctx.accounts.group_pool.is_active, ErrorCode::PoolNotActive);

        verify_oracle_signature(
            &ctx.accounts.oracle_config,
            format!(
                "release_to_group:{}:{}:{}:{}",
                ctx.accounts.user.key(),
                ctx.accounts.group_pool.group_id,
                amount,
                Clock::get()?.unix_timestamp / 300
            )
            .as_bytes(),
            &oracle_signature,
        )?;

        // Transfer from user vault to group vault
        let seeds = &[
            b"user_vault",
            ctx.accounts.user.key().as_ref(),
            &[ctx.accounts.user_deposit.bump],
        ];

        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.user_vault.to_account_info(),
                    to: ctx.accounts.group_vault.to_account_info(),
                    authority: ctx.accounts.user_vault.to_account_info(),
                },
                &[&seeds[..]],
            ),
            amount,
        )?;

        ctx.accounts.user_deposit.deposited_amount -= amount;
        ctx.accounts.group_pool.total_locked += amount;

        msg!(
            "Released {} from user {} to group {} (PUBLIC)",
            amount,
            ctx.accounts.user.key(),
            ctx.accounts.group_pool.group_id
        );
        Ok(())
    }

    /// Release funds from group pool back to user PDA (oracle-triggered)
    pub fn release_funds_from_group(
        ctx: Context<ReleaseFundsFromGroup>,
        amount: u64,
        oracle_signature: [u8; 64],
    ) -> Result<()> {
        require!(amount > 0, ErrorCode::InvalidAmount);
        require!(
            amount <= ctx.accounts.group_pool.total_locked,
            ErrorCode::InsufficientBalance
        );

        verify_oracle_signature(
            &ctx.accounts.oracle_config,
            format!(
                "release_from_group:{}:{}:{}:{}",
                ctx.accounts.user.key(),
                ctx.accounts.group_pool.group_id,
                amount,
                Clock::get()?.unix_timestamp / 300
            )
            .as_bytes(),
            &oracle_signature,
        )?;

        // Transfer from group vault to user vault
        let seeds = &[
            b"group_vault",
            ctx.accounts.group_pool.group_id.as_bytes(),
            &[ctx.accounts.group_pool.bump],
        ];

        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.group_vault.to_account_info(),
                    to: ctx.accounts.user_vault.to_account_info(),
                    authority: ctx.accounts.group_vault.to_account_info(),
                },
                &[&seeds[..]],
            ),
            amount,
        )?;

        ctx.accounts.group_pool.total_locked -= amount;
        ctx.accounts.user_deposit.deposited_amount += amount;

        msg!(
            "Released {} from group {} to user {} (PUBLIC)",
            amount,
            ctx.accounts.group_pool.group_id,
            ctx.accounts.user.key()
        );
        Ok(())
    }

    // ========================================================================
    // CONFIDENTIAL OPERATIONS (ARCIUM DARK POOL)
    // ========================================================================

    /// Initialize confidential user deposit account with encrypted balance
    pub fn initialize_confidential_deposit(
        ctx: Context<InitializeConfidentialDeposit>,
    ) -> Result<()> {
        let conf_deposit = &mut ctx.accounts.confidential_deposit;
        conf_deposit.owner = ctx.accounts.user.key();
        conf_deposit.encrypted_balance = [0u8; 32]; // Zero balance initially
        conf_deposit.last_update_slot = Clock::get()?.slot;
        conf_deposit.is_active = true;
        conf_deposit.bump = ctx.bumps.confidential_deposit;

        msg!("Confidential deposit initialized: {}", conf_deposit.owner);
        msg!("Balance: [ENCRYPTED]");
        Ok(())
    }

    /// Deposit with ENCRYPTED amount - PRIVACY ENABLED
    ///
    /// Flow:
    /// 1. Client encrypts amount using Arcium SDK
    /// 2. Transfers actual tokens (public chain operation)
    /// 3. Queues MPC to update encrypted balance
    /// 4. MPC callback updates encrypted balance
    #[arcium_instruction(circuits::add_to_balance)]
    pub fn confidential_deposit(
        ctx: Context<ConfidentialDeposit>,
        deposit_amount: u64,
    ) -> Result<()> {
        require!(deposit_amount > 0, ErrorCode::InvalidAmount);

        // Transfer actual tokens
        token::transfer(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.user_token_account.to_account_info(),
                    to: ctx.accounts.user_vault.to_account_info(),
                    authority: ctx.accounts.user.to_account_info(),
                },
            ),
            deposit_amount,
        )?;

        // Prepare encrypted input for MPC
        let current_balance = deserialize_encrypted_balance(
            &ctx.accounts.confidential_deposit.encrypted_balance
        )?;

        let mpc_input = DepositInput {
            current_balance,
            deposit_amount,
        };

        // Queue MPC computation
        ctx.accounts.mpc_request.invoke_mpc(
            &mpc_input,
            ctx.accounts.confidential_deposit.key(),
        )?;

        msg!("Confidential deposit queued: user {}", ctx.accounts.user.key());
        msg!("Amount: [ENCRYPTED - PRIVATE]");
        Ok(())
    }

    /// MPC callback for confidential deposit
    /// Called by Arcium network after encrypted computation
    pub fn confidential_deposit_callback(
        ctx: Context<ConfidentialDepositCallback>,
        result: DepositResult,
    ) -> Result<()> {
        // Verify caller is Arcium MPC
        require!(
            ctx.accounts.mpc_signer.key() == ARCIUM_MPC_AUTHORITY,
            ErrorCode::InvalidMpcSigner
        );

        require!(result.success, ErrorCode::MpcComputationFailed);

        // Update encrypted balance
        ctx.accounts.confidential_deposit.encrypted_balance =
            serialize_encrypted_balance(result.new_balance);
        ctx.accounts.confidential_deposit.last_update_slot = Clock::get()?.slot;

        msg!("Confidential balance updated via MPC");
        msg!("User: {}", ctx.accounts.confidential_deposit.owner);
        Ok(())
    }

    /// Withdraw with ENCRYPTED amount - PRIVACY ENABLED
    #[arcium_instruction(circuits::subtract_from_balance)]
    pub fn confidential_withdraw(
        ctx: Context<ConfidentialWithdraw>,
        withdraw_amount: u64,
        oracle_signature: [u8; 64],
    ) -> Result<()> {
        require!(withdraw_amount > 0, ErrorCode::InvalidAmount);

        // Verify oracle signature
        verify_oracle_signature(
            &ctx.accounts.oracle_config,
            format!(
                "confidential_withdraw:{}:{}",
                ctx.accounts.user.key(),
                Clock::get()?.unix_timestamp / 300
            )
            .as_bytes(),
            &oracle_signature,
        )?;

        // Prepare MPC input
        let current_balance = deserialize_encrypted_balance(
            &ctx.accounts.confidential_deposit.encrypted_balance
        )?;

        let mpc_input = WithdrawInput {
            current_balance,
            withdraw_amount,
        };

        // Queue MPC computation (will verify balance)
        ctx.accounts.mpc_request.invoke_mpc(
            &mpc_input,
            ctx.accounts.confidential_deposit.key(),
        )?;

        msg!("Confidential withdrawal queued: user {}", ctx.accounts.user.key());
        msg!("Amount: [ENCRYPTED - PRIVATE]");
        Ok(())
    }

    /// MPC callback for confidential withdrawal
    pub fn confidential_withdraw_callback(
        ctx: Context<ConfidentialWithdrawCallback>,
        result: WithdrawResult,
    ) -> Result<()> {
        // Verify MPC caller
        require!(
            ctx.accounts.mpc_signer.key() == ARCIUM_MPC_AUTHORITY,
            ErrorCode::InvalidMpcSigner
        );

        // Check if withdrawal approved by MPC (balance sufficient)
        require!(result.success, ErrorCode::InsufficientBalance);

        // Update encrypted balance
        ctx.accounts.confidential_deposit.encrypted_balance =
            serialize_encrypted_balance(result.new_balance);
        ctx.accounts.confidential_deposit.last_update_slot = Clock::get()?.slot;

        // Calculate actual withdrawal amount (MPC verified this is valid)
        // Note: In production, this should come from MPC result
        let withdraw_amount = ctx.accounts.confidential_deposit.encrypted_balance[0] as u64;

        // Transfer tokens
        let seeds = &[
            b"confidential_vault",
            ctx.accounts.user.key().as_ref(),
            &[ctx.accounts.confidential_deposit.bump],
        ];

        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.user_vault.to_account_info(),
                    to: ctx.accounts.user_token_account.to_account_info(),
                    authority: ctx.accounts.user_vault.to_account_info(),
                },
                &[&seeds[..]],
            ),
            withdraw_amount,
        )?;

        msg!("Confidential withdrawal completed");
        Ok(())
    }

    /// Create confidential group pool (dark pool)
    pub fn create_confidential_group_pool(
        ctx: Context<CreateConfidentialGroupPool>,
        group_id: String,
        group_name: String,
    ) -> Result<()> {
        let conf_pool = &mut ctx.accounts.confidential_pool;
        conf_pool.admin = ctx.accounts.admin.key();
        conf_pool.group_id = group_id.clone();
        conf_pool.group_name = group_name;
        conf_pool.encrypted_total = [0u8; 32];
        conf_pool.participant_count = 0;
        conf_pool.is_active = true;
        conf_pool.meets_minimum_threshold = false;
        conf_pool.bump = ctx.bumps.confidential_pool;

        msg!("Confidential pool created: {}", group_id);
        msg!("Total: [ENCRYPTED - PRIVATE]");
        Ok(())
    }

    /// Release funds to dark pool with ENCRYPTED amount
    #[arcium_instruction(circuits::confidential_transfer_to_pool)]
    pub fn confidential_release_to_group(
        ctx: Context<ConfidentialReleaseToGroup>,
        transfer_amount: u64,
        oracle_signature: [u8; 64],
    ) -> Result<()> {
        require!(transfer_amount > 0, ErrorCode::InvalidAmount);
        require!(ctx.accounts.confidential_pool.is_active, ErrorCode::PoolNotActive);

        // Verify oracle
        verify_oracle_signature(
            &ctx.accounts.oracle_config,
            format!(
                "confidential_release:{}:{}:{}",
                ctx.accounts.user.key(),
                ctx.accounts.confidential_pool.group_id,
                Clock::get()?.unix_timestamp / 300
            )
            .as_bytes(),
            &oracle_signature,
        )?;

        // Prepare MPC input
        let user_balance = deserialize_encrypted_balance(
            &ctx.accounts.confidential_deposit.encrypted_balance
        )?;
        let pool_balance = deserialize_encrypted_balance(
            &ctx.accounts.confidential_pool.encrypted_total
        )?;

        let mpc_input = TransferInput {
            user_balance,
            pool_balance,
            transfer_amount,
        };

        // Queue MPC
        ctx.accounts.mpc_request.invoke_mpc(
            &mpc_input,
            ctx.accounts.confidential_deposit.key(),
        )?;

        msg!(
            "Confidential transfer to pool {} queued",
            ctx.accounts.confidential_pool.group_id
        );
        msg!("Amount: [ENCRYPTED - PRIVATE]");
        Ok(())
    }

    /// MPC callback for confidential transfer to pool
    pub fn confidential_transfer_to_pool_callback(
        ctx: Context<ConfidentialTransferCallback>,
        result: TransferResult,
    ) -> Result<()> {
        // Verify MPC
        require!(
            ctx.accounts.mpc_signer.key() == ARCIUM_MPC_AUTHORITY,
            ErrorCode::InvalidMpcSigner
        );

        require!(result.transfer_success, ErrorCode::TransferFailed);

        // Update encrypted balances
        ctx.accounts.confidential_deposit.encrypted_balance =
            serialize_encrypted_balance(result.new_user_balance);
        ctx.accounts.confidential_pool.encrypted_total =
            serialize_encrypted_balance(result.new_pool_balance);

        // Update public metadata
        ctx.accounts.confidential_pool.participant_count += 1;

        // Transfer actual tokens
        let seeds = &[
            b"confidential_vault",
            ctx.accounts.user.key().as_ref(),
            &[ctx.accounts.confidential_deposit.bump],
        ];

        // Note: transfer_amount should come from MPC in production
        let transfer_amount = 100; // Placeholder

        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.user_vault.to_account_info(),
                    to: ctx.accounts.group_vault.to_account_info(),
                    authority: ctx.accounts.user_vault.to_account_info(),
                },
                &[&seeds[..]],
            ),
            transfer_amount,
        )?;

        msg!("Confidential transfer to pool completed");
        msg!("Participants: {}", ctx.accounts.confidential_pool.participant_count);
        Ok(())
    }

    /// Release funds from dark pool back to user with ENCRYPTED amount
    #[arcium_instruction(circuits::confidential_transfer_from_pool)]
    pub fn confidential_release_from_group(
        ctx: Context<ConfidentialReleaseFromGroup>,
        transfer_amount: u64,
        oracle_signature: [u8; 64],
    ) -> Result<()> {
        require!(transfer_amount > 0, ErrorCode::InvalidAmount);

        // Verify oracle
        verify_oracle_signature(
            &ctx.accounts.oracle_config,
            format!(
                "confidential_release_from:{}:{}:{}",
                ctx.accounts.user.key(),
                ctx.accounts.confidential_pool.group_id,
                Clock::get()?.unix_timestamp / 300
            )
            .as_bytes(),
            &oracle_signature,
        )?;

        // Prepare MPC input
        let user_balance = deserialize_encrypted_balance(
            &ctx.accounts.confidential_deposit.encrypted_balance
        )?;
        let pool_balance = deserialize_encrypted_balance(
            &ctx.accounts.confidential_pool.encrypted_total
        )?;

        let mpc_input = TransferInput {
            user_balance,
            pool_balance,
            transfer_amount,
        };

        // Queue MPC
        ctx.accounts.mpc_request.invoke_mpc(
            &mpc_input,
            ctx.accounts.confidential_pool.key(),
        )?;

        msg!(
            "Confidential transfer from pool {} queued",
            ctx.accounts.confidential_pool.group_id
        );
        msg!("Amount: [ENCRYPTED - PRIVATE]");
        Ok(())
    }

    /// MPC callback for confidential transfer from pool
    pub fn confidential_transfer_from_pool_callback(
        ctx: Context<ConfidentialTransferFromPoolCallback>,
        result: TransferResult,
    ) -> Result<()> {
        // Verify MPC
        require!(
            ctx.accounts.mpc_signer.key() == ARCIUM_MPC_AUTHORITY,
            ErrorCode::InvalidMpcSigner
        );

        require!(result.transfer_success, ErrorCode::TransferFailed);

        // Update encrypted balances
        ctx.accounts.confidential_deposit.encrypted_balance =
            serialize_encrypted_balance(result.new_user_balance);
        ctx.accounts.confidential_pool.encrypted_total =
            serialize_encrypted_balance(result.new_pool_balance);

        // Transfer tokens from pool to user
        let seeds = &[
            b"confidential_group_vault",
            ctx.accounts.confidential_pool.group_id.as_bytes(),
            &[ctx.accounts.confidential_pool.bump],
        ];

        let transfer_amount = 100; // Should come from MPC

        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.group_vault.to_account_info(),
                    to: ctx.accounts.user_vault.to_account_info(),
                    authority: ctx.accounts.group_vault.to_account_info(),
                },
                &[&seeds[..]],
            ),
            transfer_amount,
        )?;

        msg!("Confidential transfer from pool completed");
        Ok(())
    }
}

// ========================================================================
// HELPER FUNCTIONS
// ========================================================================

/// Verify oracle signature (placeholder - implement with ed25519 in production)
fn verify_oracle_signature(
    oracle_config: &Account<OracleConfig>,
    message: &[u8],
    _signature: &[u8; 64],
) -> Result<()> {
    msg!("Oracle verification: {:?}", message);
    msg!("Oracle pubkey: {}", oracle_config.oracle_pubkey);
    // TODO: Implement proper Ed25519 signature verification
    Ok(())
}

/// Deserialize encrypted balance (placeholder)
fn deserialize_encrypted_balance(encrypted: &[u8; 32]) -> Result<u64> {
    // In production, use Arcium's deserialization
    // This is a placeholder that treats first 8 bytes as u64
    Ok(u64::from_le_bytes([
        encrypted[0],
        encrypted[1],
        encrypted[2],
        encrypted[3],
        encrypted[4],
        encrypted[5],
        encrypted[6],
        encrypted[7],
    ]))
}

/// Serialize encrypted balance (placeholder)
fn serialize_encrypted_balance(balance: u64) -> [u8; 32] {
    let mut result = [0u8; 32];
    let bytes = balance.to_le_bytes();
    result[0..8].copy_from_slice(&bytes);
    result
}

// ========================================================================
// ACCOUNT STRUCTURES
// ========================================================================

#[account]
pub struct OracleConfig {
    pub authority: Pubkey,
    pub oracle_pubkey: Pubkey,
    pub bump: u8,
}

#[account]
pub struct UserDeposit {
    pub owner: Pubkey,
    pub deposited_amount: u64,
    pub bump: u8,
}

#[account]
pub struct GroupPool {
    pub admin: Pubkey,
    pub group_id: String,
    pub group_name: String,
    pub total_locked: u64,
    pub is_active: bool,
    pub bump: u8,
}

// CONFIDENTIAL STRUCTURES

#[account]
pub struct ConfidentialUserDeposit {
    pub owner: Pubkey,
    pub encrypted_balance: [u8; 32], // ENCRYPTED - private
    pub last_update_slot: u64,
    pub is_active: bool,
    pub bump: u8,
}

#[account]
pub struct ConfidentialGroupPool {
    pub admin: Pubkey,
    pub group_id: String,
    pub group_name: String,
    pub encrypted_total: [u8; 32], // ENCRYPTED - private
    pub participant_count: u32, // PUBLIC
    pub is_active: bool,
    pub meets_minimum_threshold: bool,
    pub bump: u8,
}

#[account]
pub struct MpcRequest {
    pub requester: Pubkey,
    pub target_account: Pubkey,
    pub status: MpcRequestStatus,
    pub created_slot: u64,
    pub bump: u8,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq)]
pub enum MpcRequestStatus {
    Pending,
    Completed,
    Failed,
}

// ========================================================================
// ACCOUNTS FOR add_together DEMO (macros expand required Arcium accounts)
// ========================================================================

#[queue_computation_accounts("add_together", payer)]
#[derive(Accounts)]
#[instruction(computation_offset: u64)]
pub struct AddTogether<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
}

#[callback_accounts("add_together", payer)]
#[derive(Accounts)]
pub struct AddTogetherCallback<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
}

#[init_computation_definition_accounts("add_together", payer)]
#[derive(Accounts)]
pub struct InitAddTogetherCompDef<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
}

// ========================================================================
// CONTEXT STRUCTURES - PUBLIC
// ========================================================================

#[derive(Accounts)]
pub struct InitializeOracle<'info> {
    #[account(
        init,
        payer = authority,
        space = 8 + 32 + 32 + 1,
        seeds = [b"oracle_config"],
        bump
    )]
    pub oracle_config: Account<'info, OracleConfig>,

    #[account(mut)]
    pub authority: Signer<'info>,

    /// CHECK: Oracle's public key
    pub oracle_pubkey: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct UpdateOracle<'info> {
    #[account(
        mut,
        seeds = [b"oracle_config"],
        bump = oracle_config.bump,
        has_one = authority @ ErrorCode::Unauthorized
    )]
    pub oracle_config: Account<'info, OracleConfig>,

    pub authority: Signer<'info>,
}

#[derive(Accounts)]
pub struct InitializeUserDeposit<'info> {
    #[account(
        init,
        payer = user,
        space = 8 + 32 + 8 + 1,
        seeds = [b"user_deposit", user.key().as_ref()],
        bump
    )]
    pub user_deposit: Account<'info, UserDeposit>,

    #[account(mut)]
    pub user: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct DepositToUserPda<'info> {
    #[account(
        mut,
        seeds = [b"user_deposit", user.key().as_ref()],
        bump = user_deposit.bump,
        has_one = owner @ ErrorCode::Unauthorized
    )]
    pub user_deposit: Account<'info, UserDeposit>,

    #[account(
        mut,
        seeds = [b"user_vault", user.key().as_ref()],
        bump
    )]
    pub user_vault: Account<'info, TokenAccount>,

    #[account(mut)]
    pub user_token_account: Account<'info, TokenAccount>,

    #[account(mut)]
    pub user: Signer<'info>,

    /// CHECK: Owner check in account constraint
    pub owner: UncheckedAccount<'info>,

    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct WithdrawFromUserPda<'info> {
    #[account(
        mut,
        seeds = [b"user_deposit", user.key().as_ref()],
        bump = user_deposit.bump,
        has_one = owner @ ErrorCode::Unauthorized
    )]
    pub user_deposit: Account<'info, UserDeposit>,

    #[account(
        mut,
        seeds = [b"user_vault", user.key().as_ref()],
        bump
    )]
    pub user_vault: Account<'info, TokenAccount>,

    #[account(mut)]
    pub user_token_account: Account<'info, TokenAccount>,

    #[account(mut)]
    pub user: Signer<'info>,

    /// CHECK: Owner check in account constraint
    pub owner: UncheckedAccount<'info>,

    #[account(
        seeds = [b"oracle_config"],
        bump = oracle_config.bump
    )]
    pub oracle_config: Account<'info, OracleConfig>,

    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
#[instruction(group_id: String)]
pub struct CreateGroupPool<'info> {
    #[account(
        init,
        payer = admin,
        space = 8 + 32 + 68 + 68 + 8 + 1 + 1,
        seeds = [b"group_pool", group_id.as_bytes()],
        bump
    )]
    pub group_pool: Account<'info, GroupPool>,

    #[account(mut)]
    pub admin: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ReleaseFundsToGroup<'info> {
    #[account(
        mut,
        seeds = [b"user_deposit", user.key().as_ref()],
        bump = user_deposit.bump
    )]
    pub user_deposit: Account<'info, UserDeposit>,

    #[account(
        mut,
        seeds = [b"user_vault", user.key().as_ref()],
        bump
    )]
    pub user_vault: Account<'info, TokenAccount>,

    #[account(
        mut,
        seeds = [b"group_pool", group_pool.group_id.as_bytes()],
        bump = group_pool.bump
    )]
    pub group_pool: Account<'info, GroupPool>,

    #[account(
        mut,
        seeds = [b"group_vault", group_pool.group_id.as_bytes()],
        bump
    )]
    pub group_vault: Account<'info, TokenAccount>,

    /// CHECK: User whose funds are being moved
    pub user: UncheckedAccount<'info>,

    #[account(
        seeds = [b"oracle_config"],
        bump = oracle_config.bump
    )]
    pub oracle_config: Account<'info, OracleConfig>,

    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct ReleaseFundsFromGroup<'info> {
    #[account(
        mut,
        seeds = [b"user_deposit", user.key().as_ref()],
        bump = user_deposit.bump
    )]
    pub user_deposit: Account<'info, UserDeposit>,

    #[account(
        mut,
        seeds = [b"user_vault", user.key().as_ref()],
        bump
    )]
    pub user_vault: Account<'info, TokenAccount>,

    #[account(
        mut,
        seeds = [b"group_pool", group_pool.group_id.as_bytes()],
        bump = group_pool.bump
    )]
    pub group_pool: Account<'info, GroupPool>,

    #[account(
        mut,
        seeds = [b"group_vault", group_pool.group_id.as_bytes()],
        bump
    )]
    pub group_vault: Account<'info, TokenAccount>,

    /// CHECK: User receiving funds
    pub user: UncheckedAccount<'info>,

    #[account(
        seeds = [b"oracle_config"],
        bump = oracle_config.bump
    )]
    pub oracle_config: Account<'info, OracleConfig>,

    pub token_program: Program<'info, Token>,
}

// ========================================================================
// CONTEXT STRUCTURES - CONFIDENTIAL
// ========================================================================

#[derive(Accounts)]
pub struct InitializeConfidentialDeposit<'info> {
    #[account(
        init,
        payer = user,
        space = 8 + 32 + 32 + 8 + 1 + 1,
        seeds = [b"confidential_deposit", user.key().as_ref()],
        bump
    )]
    pub confidential_deposit: Account<'info, ConfidentialUserDeposit>,

    #[account(mut)]
    pub user: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ConfidentialDeposit<'info> {
    #[account(
        mut,
        seeds = [b"confidential_deposit", user.key().as_ref()],
        bump = confidential_deposit.bump
    )]
    pub confidential_deposit: Account<'info, ConfidentialUserDeposit>,

    #[account(
        mut,
        seeds = [b"confidential_vault", user.key().as_ref()],
        bump
    )]
    pub user_vault: Account<'info, TokenAccount>,

    #[account(mut)]
    pub user_token_account: Account<'info, TokenAccount>,

    #[account(mut)]
    pub user: Signer<'info>,

    #[account(
        init,
        payer = user,
        space = 8 + 32 + 32 + 1 + 8 + 1,
        seeds = [b"mpc_request", user.key().as_ref(), &Clock::get()?.slot.to_le_bytes()],
        bump
    )]
    pub mpc_request: Account<'info, MpcRequest>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ConfidentialDepositCallback<'info> {
    #[account(
        mut,
        seeds = [b"confidential_deposit", confidential_deposit.owner.as_ref()],
        bump = confidential_deposit.bump
    )]
    pub confidential_deposit: Account<'info, ConfidentialUserDeposit>,

    /// CHECK: Must be Arcium MPC authority
    pub mpc_signer: Signer<'info>,

    #[account(mut)]
    pub mpc_request: Account<'info, MpcRequest>,
}

#[derive(Accounts)]
pub struct ConfidentialWithdraw<'info> {
    #[account(
        mut,
        seeds = [b"confidential_deposit", user.key().as_ref()],
        bump = confidential_deposit.bump
    )]
    pub confidential_deposit: Account<'info, ConfidentialUserDeposit>,

    #[account(
        mut,
        seeds = [b"confidential_vault", user.key().as_ref()],
        bump
    )]
    pub user_vault: Account<'info, TokenAccount>,

    #[account(mut)]
    pub user_token_account: Account<'info, TokenAccount>,

    #[account(mut)]
    pub user: Signer<'info>,

    #[account(
        seeds = [b"oracle_config"],
        bump = oracle_config.bump
    )]
    pub oracle_config: Account<'info, OracleConfig>,

    #[account(
        init,
        payer = user,
        space = 8 + 32 + 32 + 1 + 8 + 1,
        seeds = [b"mpc_request", user.key().as_ref(), &Clock::get()?.slot.to_le_bytes()],
        bump
    )]
    pub mpc_request: Account<'info, MpcRequest>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ConfidentialWithdrawCallback<'info> {
    #[account(
        mut,
        seeds = [b"confidential_deposit", user.key().as_ref()],
        bump = confidential_deposit.bump
    )]
    pub confidential_deposit: Account<'info, ConfidentialUserDeposit>,

    #[account(
        mut,
        seeds = [b"confidential_vault", user.key().as_ref()],
        bump
    )]
    pub user_vault: Account<'info, TokenAccount>,

    #[account(mut)]
    pub user_token_account: Account<'info, TokenAccount>,

    /// CHECK: User receiving withdrawal
    pub user: UncheckedAccount<'info>,

    /// CHECK: Must be Arcium MPC authority
    pub mpc_signer: Signer<'info>,

    #[account(mut)]
    pub mpc_request: Account<'info, MpcRequest>,

    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
#[instruction(group_id: String)]
pub struct CreateConfidentialGroupPool<'info> {
    #[account(
        init,
        payer = admin,
        space = 8 + 32 + 68 + 68 + 32 + 4 + 1 + 1 + 1,
        seeds = [b"confidential_pool", group_id.as_bytes()],
        bump
    )]
    pub confidential_pool: Account<'info, ConfidentialGroupPool>,

    #[account(mut)]
    pub admin: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ConfidentialReleaseToGroup<'info> {
    #[account(
        mut,
        seeds = [b"confidential_deposit", user.key().as_ref()],
        bump = confidential_deposit.bump
    )]
    pub confidential_deposit: Account<'info, ConfidentialUserDeposit>,

    #[account(
        mut,
        seeds = [b"confidential_vault", user.key().as_ref()],
        bump
    )]
    pub user_vault: Account<'info, TokenAccount>,

    #[account(
        mut,
        seeds = [b"confidential_pool", confidential_pool.group_id.as_bytes()],
        bump = confidential_pool.bump
    )]
    pub confidential_pool: Account<'info, ConfidentialGroupPool>,

    #[account(
        mut,
        seeds = [b"confidential_group_vault", confidential_pool.group_id.as_bytes()],
        bump
    )]
    pub group_vault: Account<'info, TokenAccount>,

    /// CHECK: User whose funds are being moved
    pub user: UncheckedAccount<'info>,

    #[account(
        seeds = [b"oracle_config"],
        bump = oracle_config.bump
    )]
    pub oracle_config: Account<'info, OracleConfig>,

    #[account(
        init,
        payer = user,
        space = 8 + 32 + 32 + 1 + 8 + 1,
        seeds = [b"mpc_request", user.key().as_ref(), &Clock::get()?.slot.to_le_bytes()],
        bump
    )]
    pub mpc_request: Account<'info, MpcRequest>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ConfidentialTransferCallback<'info> {
    #[account(
        mut,
        seeds = [b"confidential_deposit", confidential_deposit.owner.as_ref()],
        bump = confidential_deposit.bump
    )]
    pub confidential_deposit: Account<'info, ConfidentialUserDeposit>,

    #[account(
        mut,
        seeds = [b"confidential_vault", confidential_deposit.owner.as_ref()],
        bump
    )]
    pub user_vault: Account<'info, TokenAccount>,

    #[account(
        mut,
        seeds = [b"confidential_pool", confidential_pool.group_id.as_bytes()],
        bump = confidential_pool.bump
    )]
    pub confidential_pool: Account<'info, ConfidentialGroupPool>,

    #[account(
        mut,
        seeds = [b"confidential_group_vault", confidential_pool.group_id.as_bytes()],
        bump
    )]
    pub group_vault: Account<'info, TokenAccount>,

    /// CHECK: User whose funds were moved
    pub user: UncheckedAccount<'info>,

    /// CHECK: Must be Arcium MPC authority
    pub mpc_signer: Signer<'info>,

    #[account(mut)]
    pub mpc_request: Account<'info, MpcRequest>,

    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct ConfidentialReleaseFromGroup<'info> {
    #[account(
        mut,
        seeds = [b"confidential_deposit", user.key().as_ref()],
        bump = confidential_deposit.bump
    )]
    pub confidential_deposit: Account<'info, ConfidentialUserDeposit>,

    #[account(
        mut,
        seeds = [b"confidential_vault", user.key().as_ref()],
        bump
    )]
    pub user_vault: Account<'info, TokenAccount>,

    #[account(
        mut,
        seeds = [b"confidential_pool", confidential_pool.group_id.as_bytes()],
        bump = confidential_pool.bump
    )]
    pub confidential_pool: Account<'info, ConfidentialGroupPool>,

    #[account(
        mut,
        seeds = [b"confidential_group_vault", confidential_pool.group_id.as_bytes()],
        bump
    )]
    pub group_vault: Account<'info, TokenAccount>,

    /// CHECK: User receiving funds
    pub user: UncheckedAccount<'info>,

    #[account(
        seeds = [b"oracle_config"],
        bump = oracle_config.bump
    )]
    pub oracle_config: Account<'info, OracleConfig>,

    #[account(
        init,
        payer = user,
        space = 8 + 32 + 32 + 1 + 8 + 1,
        seeds = [b"mpc_request", user.key().as_ref(), &Clock::get()?.slot.to_le_bytes()],
        bump
    )]
    pub mpc_request: Account<'info, MpcRequest>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ConfidentialTransferFromPoolCallback<'info> {
    #[account(
        mut,
        seeds = [b"confidential_deposit", confidential_deposit.owner.as_ref()],
        bump = confidential_deposit.bump
    )]
    pub confidential_deposit: Account<'info, ConfidentialUserDeposit>,

    #[account(
        mut,
        seeds = [b"confidential_vault", confidential_deposit.owner.as_ref()],
        bump
    )]
    pub user_vault: Account<'info, TokenAccount>,

    #[account(
        mut,
        seeds = [b"confidential_pool", confidential_pool.group_id.as_bytes()],
        bump = confidential_pool.bump
    )]
    pub confidential_pool: Account<'info, ConfidentialGroupPool>,

    #[account(
        mut,
        seeds = [b"confidential_group_vault", confidential_pool.group_id.as_bytes()],
        bump
    )]
    pub group_vault: Account<'info, TokenAccount>,

    /// CHECK: User receiving funds
    pub user: UncheckedAccount<'info>,

    /// CHECK: Must be Arcium MPC authority
    pub mpc_signer: Signer<'info>,

    #[account(mut)]
    pub mpc_request: Account<'info, MpcRequest>,

    pub token_program: Program<'info, Token>,
}

// ========================================================================
// ERROR CODES
// ========================================================================

#[error_code]
pub enum ErrorCode {
    #[msg("Invalid amount. Must be greater than 0.")]
    InvalidAmount,

    #[msg("Insufficient balance.")]
    InsufficientBalance,

    #[msg("Unauthorized action.")]
    Unauthorized,

    #[msg("Pool is not active.")]
    PoolNotActive,

    #[msg("Invalid oracle signature.")]
    InvalidOracleSignature,

    #[msg("Invalid MPC signer. Must be Arcium MPC authority.")]
    InvalidMpcSigner,

    #[msg("Invalid encrypted result format.")]
    InvalidEncryptedResult,

    #[msg("MPC computation failed.")]
    MpcComputationFailed,

    #[msg("Transfer failed.")]
    TransferFailed,
}

// ========================================================================
// EVENTS
// ========================================================================

#[event]
pub struct SumEvent {
    pub sum: [u8; 32],
    pub nonce: [u8; 16],
}
