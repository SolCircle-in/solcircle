// Encrypted MPC Circuits for Confidential Fund Pools
// This module contains the encrypted computation logic that runs on Arcium's MPC network

use arcis_imports::*;

#[encrypted]
pub mod circuits {
    use arcis_imports::*;

    // ========================================================================
    // EXAMPLE: Add Together (Keep for reference)
    // ========================================================================

    pub struct InputValues {
        v1: u8,
        v2: u8,
    }

    #[instruction]
    pub fn add_together(input_ctxt: Enc<Shared, InputValues>) -> Enc<Shared, u16> {
        let input = input_ctxt.to_arcis();
        let sum = input.v1 as u16 + input.v2 as u16;
        input_ctxt.owner.from_arcis(sum)
    }

    // ========================================================================
    // CONFIDENTIAL FUND POOL CIRCUITS
    // ========================================================================

    pub struct DepositInput {
        pub current_balance: u64,
        pub deposit_amount: u64,
    }

    pub struct DepositResult {
        pub new_balance: u64,
        pub success: bool,
    }

    pub struct WithdrawInput {
        pub current_balance: u64,
        pub withdraw_amount: u64,
    }

    pub struct WithdrawResult {
        pub new_balance: u64,
        pub success: bool,
        pub error_code: u8,
    }

    pub struct TransferInput {
        pub user_balance: u64,
        pub pool_balance: u64,
        pub transfer_amount: u64,
    }

    pub struct TransferResult {
        pub new_user_balance: u64,
        pub new_pool_balance: u64,
        pub transfer_success: bool,
    }

    pub struct ShareInput {
        pub user_contribution: u64,
        pub total_pool: u64,
        pub final_amount: u64,
    }

    pub struct ShareResult {
        pub user_share: u64,
        pub computed_successfully: bool,
    }

    // ========================================================================
    // ENCRYPTED INSTRUCTIONS (MPC COMPUTATIONS)
    // ========================================================================

    #[instruction]
    pub fn add_to_balance(
        input_ctxt: Enc<Shared, DepositInput>,
    ) -> Enc<Shared, DepositResult> {
        let input = input_ctxt.to_arcis();

        // Simple addition (MPC handles overflow checking)
        let new_balance = input.current_balance + input.deposit_amount;

        let result = DepositResult {
            new_balance,
            success: true,
        };

        input_ctxt.owner.from_arcis(result)
    }

    #[instruction]
    pub fn subtract_from_balance(
        input_ctxt: Enc<Shared, WithdrawInput>,
    ) -> Enc<Shared, WithdrawResult> {
        let input = input_ctxt.to_arcis();

        let has_sufficient = input.current_balance >= input.withdraw_amount;

        let result = if has_sufficient {
            WithdrawResult {
                new_balance: input.current_balance - input.withdraw_amount,
                success: true,
                error_code: 0,
            }
        } else {
            WithdrawResult {
                new_balance: input.current_balance,
                success: false,
                error_code: 1,
            }
        };

        input_ctxt.owner.from_arcis(result)
    }

    #[instruction]
    pub fn confidential_transfer_to_pool(
        input_ctxt: Enc<Shared, TransferInput>,
    ) -> Enc<Shared, TransferResult> {
        let input = input_ctxt.to_arcis();

        // Check balance without assert (not supported)
        let has_sufficient = input.user_balance >= input.transfer_amount;

        let result = if has_sufficient {
            TransferResult {
                new_user_balance: input.user_balance - input.transfer_amount,
                new_pool_balance: input.pool_balance + input.transfer_amount,
                transfer_success: true,
            }
        } else {
            TransferResult {
                new_user_balance: input.user_balance,
                new_pool_balance: input.pool_balance,
                transfer_success: false,
            }
        };

        input_ctxt.owner.from_arcis(result)
    }

    #[instruction]
    pub fn confidential_transfer_from_pool(
        input_ctxt: Enc<Shared, TransferInput>,
    ) -> Enc<Shared, TransferResult> {
        let input = input_ctxt.to_arcis();

        // Check balance without assert
        let has_sufficient = input.pool_balance >= input.transfer_amount;

        let result = if has_sufficient {
            TransferResult {
                new_user_balance: input.user_balance + input.transfer_amount,
                new_pool_balance: input.pool_balance - input.transfer_amount,
                transfer_success: true,
            }
        } else {
            TransferResult {
                new_user_balance: input.user_balance,
                new_pool_balance: input.pool_balance,
                transfer_success: false,
            }
        };

        input_ctxt.owner.from_arcis(result)
    }

    #[instruction]
    pub fn verify_minimum_balance(
        input_ctxt: Enc<Shared, u64>,
    ) -> Enc<Shared, bool> {
        let input = input_ctxt.to_arcis();
        let minimum_required: u64 = 1000;
        let meets_minimum = input >= minimum_required;
        input_ctxt.owner.from_arcis(meets_minimum)
    }

    #[instruction]
    pub fn compute_user_share(
        input_ctxt: Enc<Shared, ShareInput>,
    ) -> Enc<Shared, ShareResult> {
        let input = input_ctxt.to_arcis();

        let share = if input.total_pool > 0 {
            (input.user_contribution as u128 * input.final_amount as u128
                / input.total_pool as u128) as u64
        } else {
            0
        };

        let result = ShareResult {
            user_share: share,
            computed_successfully: true,
        };

        input_ctxt.owner.from_arcis(result)
    }
}
