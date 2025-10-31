# SolCircle Contract

Confidential and public liquidity pools on Solana using Arcium MPC for encrypted balances. Public flows behave like standard Anchor/SPL programs; confidential flows keep amounts private by computing over encrypted data off-chain and committing results on-chain via verified callbacks.

• On-chain program: `programs/solcircle_arcium`
• Encrypted circuits (MPC): `encrypted-ixs`

For a deep dive into the architecture and the Arcium integration details, see:

- Detailed Architecture and Arcium Implementation: [`doc/ARCHITECTURE_AND_ARCIUM.md`](./doc/ARCHITECTURE_AND_ARCIUM.md)

## Features

- Dual-mode pools: public and confidential coexist
- Encrypted user balances and pool totals (private amounts)
- Oracle-triggered releases with MPC-verified updates
- Anchor-first developer experience with Arcium macros

## Directory layout

- `programs/solcircle_arcium` — Anchor program integrating Arcium callbacks
- `encrypted-ixs` — Rust crate defining encrypted circuits and types
- `idl/` — generated IDL artifacts
- `migrations/` — deployment/migration scripts
- `tests/` — example tests (see Test notes)
- `doc/` — documentation, including the unified architecture + Arcium doc

## Prerequisites

- Rust toolchain (see `rust-toolchain`)
- Solana + Anchor CLI
- Arcium CLI (`arcium`)
- Node.js (for TypeScript tests)

## Quick start

From the `contract/` directory:

1. Build: `arcium build`
2. Test (localnet + MPC): `arcium test`
3. Deploy (devnet/testnet): `arcium deploy --cluster-offset <offset> --keypair-path <path> --rpc-url <url>`

After deploy, initialize computation definitions and point clients/tests to the chosen Arcium cluster account. See the detailed doc linked above for exact steps and options.

## Contract snippet: how Arcium fits

Below is a minimal, illustrative example showing how an encrypted circuit (off‑chain MPC) pairs with an on‑chain instruction and callback. This mirrors the pattern used by the confidential flows in this repo.

Encrypted circuit (runs on Arcium MPC):

```rust
// contract/encrypted-ixs/src/lib.rs
use arcis_imports::*;

#[encrypted]
pub mod circuits {
	use arcis_imports::*;

	// Example: add deposit amount to current balance, all encrypted
	pub struct DepositInput {
		current: u64,
		amount: u64,
	}

	#[instruction]
	pub fn add_to_balance(input: Enc<Shared, DepositInput>) -> Enc<Shared, u64> {
		let data = input.to_arcis();
		let new_total = data.current + data.amount; // computed privately
		input.owner.from_arcis(new_total)
	}
}
```

On‑chain program wrapper (queues MPC and handles callback):

```rust
// contract/programs/solcircle_arcium/src/lib.rs
use anchor_lang::prelude::*;
use arcium_anchor::prelude::*;

declare_id!("<program id>");

#[arcium_program]
pub mod solcircle_arcium {
	use super::*;

	// Queue encrypted computation; amounts stay private
	#[arcium_instruction(circuits::add_to_balance)]
	pub fn confidential_deposit(
		ctx: Context<ConfidentialDeposit>,
		computation_offset: u64,
		ciphertext_input: [u8; 32],
		user_pubkey: [u8; 32],
		nonce: u128,
	) -> Result<()> {
		let args = vec![
			Argument::ArcisPubkey(user_pubkey),
			Argument::PlaintextU128(nonce),
			Argument::Encrypted(ciphertext_input), // Enc<DepositInput>
		];

		// Route the MPC result back into our callback below
		queue_computation(
			ctx.accounts,
			computation_offset,
			args,
			None,
			vec![ConfidentialDepositCallback::callback_ix(&[])],
		)?;
		Ok(())
	}

	// Callback applies the encrypted result on-chain
	#[arcium_callback(encrypted_ix = "add_to_balance")]
	pub fn confidential_deposit_callback(
		_ctx: Context<ConfidentialDepositCallback>,
		output: ComputationOutputs<AddToBalanceOutput>,
	) -> Result<()> {
		let result_ctxt = match output {
			ComputationOutputs::Success(AddToBalanceOutput { field_0 }) => field_0,
			_ => return Err(error!(ErrorCode::AbortedComputation)),
		};

		// result_ctxt is Enc<u64>. Store it as the new encrypted balance
		// and perform any SPL transfers authorized by PDAs as needed.
		// (Exact account logic elided here for brevity.)
		Ok(())
	}
}

// Accounts structs (simplified)
#[derive(Accounts)]
pub struct ConfidentialDeposit<'info> {
	#[account(mut)]
	pub payer: Signer<'info>,
	// ... program PDAs, MPC/sign PDAs, token vaults, system/sysvars
}

#[derive(Accounts)]
pub struct ConfidentialDepositCallback<'info> {
	#[account(mut)]
	pub payer: Signer<'info>,
	// ... same accounts plus any extra required to persist results
}
```

For the complete architecture and implementation details, see the unified doc:

- [`doc/ARCHITECTURE_AND_ARCIUM.md`](./doc/ARCHITECTURE.md)
- [`doc/ARCHITECTURE_AND_ARCIUM.md`](./doc/ARCIUM_IMPLEMENTATION.md)

## Test notes

The sample test `tests/solcircle_arcium.ts` targets a hello‑world flow. Either adapt tests to the confidential pool instructions (recommended) or re‑introduce the example wrappers if you want to run the hello‑world unchanged. See the detailed doc for guidance.

## License

This repository is provided under the license specified at the root of the monorepo (if any). If none exists, please clarify licensing before production use.
