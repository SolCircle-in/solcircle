# Arcium in SolCircle: Implementation Guide

This document explains what Arcium is, how it’s integrated in this repo, what parts of the system are responsible for what, and how to build, test, and deploy. It consolidates the official docs and maps them to our code.

References:
- Docs home: https://docs.arcium.com/
- Developers: https://docs.arcium.com/developers
- Deployment: https://docs.arcium.com/developers/deployment
- TypeScript SDK: https://ts.arcium.com/api


## What Arcium is and why we use it

Arcium is a decentralized private computation network. It lets us perform computations over encrypted data using MPC (Multi‑Party Computation) and return verifiable results—without ever decrypting user data. For Solana/Anchor developers, Arcium extends familiar tooling so you can mark instructions as confidential and route sensitive logic through the Arcium network.

Key benefits for our app:
- Full privacy for sensitive values (e.g., deposit/withdraw/transfer amounts)
- No front‑running/MEV on private amounts
- On‑chain coordination with off‑chain encrypted compute


## How it works (high level)

1) Client encrypts inputs with Arcium SDK and calls our Solana program.
2) Our program queues a computation to Arcium’s MPC cluster.
3) MPC nodes compute on encrypted values and call back our program.
4) Our program updates state using the encrypted result (and may transfer tokens accordingly). No plaintext amounts are revealed.

All queuing, callback routing, and account wiring is handled by Arcium’s Anchor macros and client libraries.


## Where Arcium lives in this repo

- Circuits (encrypted compute logic):
  - `contract/encrypted-ixs/src/lib.rs`
    - Module `circuits` (annotated with `#[encrypted]`) defines the encrypted instructions and their input/output types, e.g.:
      - `add_to_balance`, `subtract_from_balance`, `confidential_transfer_to_pool`, `confidential_transfer_from_pool`, etc.
    - Uses `arcis_imports` crate. These functions run on the MPC network and operate on encrypted values.

- On‑chain Solana program (MXE):
  - `contract/programs/solcircle_arcium/src/lib.rs`
    - Annotated with `#[arcium_program]` and uses `#[arcium_instruction(...)]` to attach the above circuits to on‑chain instructions that queue MPC jobs and handle callbacks.
    - Public (non‑private) PDA flows remain normal Anchor code (deposits, group pools, SPL token transfers).
    - Confidential flows delegate balance arithmetic to MPC and apply results in callbacks.

- Localnet configuration:
  - `contract/Arcium.toml` (e.g., nodes/backends) used by `arcium test`/`arcium localnet`.

- Anchor project config:
  - `contract/Anchor.toml` (localnet cluster, wallet, test runner)
  - `contract/Cargo.toml` (workspace includes `programs/*` and `encrypted-ixs`)
  - `contract/programs/solcircle_arcium/Cargo.toml` (depends on `arcium-*` crates and `encrypted-ixs`)


## Responsibilities and data flow

- `encrypted-ixs` crate
  - Defines the types for encrypted inputs/outputs and the MPC computations themselves.
  - Example responsibilities:
    - `DepositInput` -> `DepositResult`
    - `WithdrawInput` -> `WithdrawResult`
    - `TransferInput` -> `TransferResult`
  - Guarantees: arithmetic and checks happen on encrypted data.

- `solcircle_arcium` program
  - Public operations (visible amounts): normal Anchor instructions and SPL token transfers.
  - Confidential operations:
    - Queue MPC with `#[arcium_instruction(circuits::...)]` instructions (e.g., `confidential_deposit`, `confidential_withdraw`, `confidential_release_to_group`, etc.)
    - Receive results in callback handlers (e.g., `confidential_deposit_callback`) and update encrypted balances and perform authorized SPL transfers.
  - Stores encrypted balances in accounts like `ConfidentialUserDeposit` and `ConfidentialGroupPool`.
  - Verifies Arcium MPC signer on callbacks before applying state changes.


## Important files and symbols

- Circuits (encrypted compute): `contract/encrypted-ixs/src/lib.rs`
  - `#[encrypted] pub mod circuits { ... }`
  - Instructions:
    - `add_to_balance(Enc<Shared, DepositInput>) -> Enc<Shared, DepositResult>`
    - `subtract_from_balance(Enc<Shared, WithdrawInput>) -> Enc<Shared, WithdrawResult>`
    - `confidential_transfer_to_pool(Enc<Shared, TransferInput>) -> Enc<Shared, TransferResult>`
    - `confidential_transfer_from_pool(Enc<Shared, TransferInput>) -> Enc<Shared, TransferResult>`
    - plus helpers like `verify_minimum_balance`, `compute_user_share`.

- Program (on‑chain): `contract/programs/solcircle_arcium/src/lib.rs`
  - Macro: `#[arcium_program]` on the module.
  - Confidential instruction wrappers:
    - `#[arcium_instruction(circuits::add_to_balance)] pub fn confidential_deposit(...)`
    - `#[arcium_instruction(circuits::subtract_from_balance)] pub fn confidential_withdraw(...)`
    - `#[arcium_instruction(circuits::confidential_transfer_to_pool)] pub fn confidential_release_to_group(...)`
    - `#[arcium_instruction(circuits::confidential_transfer_from_pool)] pub fn confidential_release_from_group(...)`
  - Callback handlers:
    - `confidential_deposit_callback`, `confidential_withdraw_callback`,
      `confidential_transfer_to_pool_callback`, `confidential_transfer_from_pool_callback`
    - Each validates MPC signer, checks result flags, updates encrypted balances, and performs token transfers with PDAs where needed.


## Build and test locally

Arcium provides a CLI that wraps Anchor. Typical lifecycle:
- `arcium build` — builds circuits and the Solana program
- `arcium test` — runs localnet with an MPC cluster, then executes tests
- `arcium deploy` — deploys to devnet/testnet with cluster selection

Project scripts and configs expect:
- Rust toolchain (see `contract/Cargo.toml` and `rust-toolchain`)
- Anchor CLI
- Arcium CLI (`arcium`)
- Solana toolchain (for localnet and program deploy)
- Node/Yarn (for TypeScript tests)

Quickstart (from docs; adapt as needed):
1) Install Arcium and dependencies (Rust, Solana, Anchor)
2) In `contract/`, run `arcium build`
3) Start local tests with `arcium test`

Note: Our current TypeScript test `contract/tests/solcircle_arcium.ts` is the “add_together” hello‑world example from the docs, not the confidential pool flows implemented in our program. See “Test alignment” below.


## Deploy (devnet)

From the docs:
- Use a reliable RPC and choose a cluster offset (e.g., `1078779259`).
- Basic:
  - `arcium deploy --cluster-offset <offset> --keypair-path ~/.config/solana/id.json --rpc-url <your-rpc>`
- After deploy:
  - Initialize computation definitions (either upload raw circuits, or use off‑chain circuit URLs via `CircuitSource::OffChain`) and update your client/test code to use the real cluster account (via `getClusterAccAddress(offset)`).
- For large circuits, prefer off‑chain storage as described in the deployment docs.


## Test alignment (current status and what to fix)

- Current tests (`contract/tests/solcircle_arcium.ts`) call:
  - `initAddTogetherCompDef()` and `addTogether(...)`
  - Expect an event `sumEvent` (from the hello‑world example)
- Current program (`solcircle_arcium/src/lib.rs`) implements confidential deposit/withdraw/transfer flows and does not expose the `add_together` example or event.

Action options:
1) Update tests to use our real confidential flows:
   - Initialize accounts: `initialize_confidential_deposit`, create user/group vaults and pools.
   - Use `@arcium-hq/client` to encrypt inputs and queue `confidential_deposit`, `confidential_withdraw`, etc.
   - Await computation finalization and assert updated encrypted balances (or emitted events if we add them).
2) Or, add the doc example interfaces back to the program:
   - Implement `init_add_together_comp_def` and `add_together` wrappers and its callback as shown in `contract/README.md`, so `tests/solcircle_arcium.ts` can run unchanged.

Recommendation: Option 1 (tests match the actual product logic). We can scaffold a new test once the toolchain is available.


## How to verify “it works” (end‑to‑end)

Prereqs:
- Install Rust (cargo), Solana, Anchor, and Arcium CLI.
- Have a funded local wallet for localnet and 2–5 SOL for devnet deploys if needed.

Local check:
- Run `arcium build` in `contract/` — should succeed.
- Run `arcium test` — ensure local MPC cluster boots (per `Arcium.toml`) and tests pass.
- Add a smoke test to queue a small confidential deposit and confirm the callback updates the encrypted balance.

Devnet check:
- `arcium deploy` with reliable RPC and chosen cluster offset.
- Initialize computation definitions.
- Point client tests to the chosen devnet cluster and re‑run tests using `arcium test` (configured for devnet per docs).


## Known gaps and TODOs

- MPC signer pubkey: `ARCIUM_MPC_AUTHORITY` in `lib.rs` is a placeholder and should be set to the real MPC authority pubkey for the target cluster per docs.
- Oracle signature verification: currently a stub; implement real ed25519 verification.
- Token transfer amounts in callbacks: some placeholders (e.g., `transfer_amount = 100`) — in production, amounts should come from MPC results.
- Tests: align to confidential flows or implement the example functions expected by the current hello‑world test.


## Minimal troubleshooting

- Dropped transactions in deploy: switch to a dedicated RPC (Helius/QuickNode). See deployment docs.
- Large circuit init costs: use off‑chain circuit sources and re‑build the program to reference them.
- Cluster pubkey mismatch: after deployment, replace local testing cluster account with `getClusterAccAddress(<offset>)` in your client.


## Quick reference: file map

- Circuits: `contract/encrypted-ixs/src/lib.rs`
- Program: `contract/programs/solcircle_arcium/src/lib.rs`
- Local MPC config: `contract/Arcium.toml`
- Anchor config: `contract/Anchor.toml`
- Tests (example, needs alignment): `contract/tests/solcircle_arcium.ts`
