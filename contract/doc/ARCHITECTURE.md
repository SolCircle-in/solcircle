# SOL Circle Dark Pool - Architecture

## System Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                           CLIENT LAYER                               │
│  ┌──────────────┐  ┌──────────────┐  ┌─────────────┐               │
│  │    User 1    │  │    User 2    │  │   Oracle    │               │
│  │  Wallet/SDK  │  │  Wallet/SDK  │  │  (Off-chain)│               │
│  └──────┬───────┘  └──────┬───────┘  └──────┬──────┘               │
│         │                  │                  │                       │
│         │ Encrypt amounts  │                  │ Sign releases        │
│         │ using Arcium SDK │                  │                      │
└─────────┼──────────────────┼──────────────────┼──────────────────────┘
          │                  │                  │
          ▼                  ▼                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    SOLANA BLOCKCHAIN LAYER                           │
│                                                                       │
│  ┌────────────────────────────────────────────────────────────┐    │
│  │              SOL CIRCLE PROGRAM (On-Chain)                  │    │
│  │                                                              │    │
│  │  ┌─────────────────┐         ┌─────────────────┐           │    │
│  │  │  PUBLIC POOLS   │         │ CONFIDENTIAL    │           │    │
│  │  │  (Original)     │         │ POOLS (Dark)    │           │    │
│  │  │                 │         │                 │           │    │
│  │  │ • UserDeposit   │         │ • Confidential  │           │    │
│  │  │   (visible)     │         │   UserDeposit   │           │    │
│  │  │                 │         │   (encrypted)   │           │    │
│  │  │ • GroupPool     │         │                 │           │    │
│  │  │   (visible)     │         │ • Confidential  │           │    │
│  │  │                 │         │   GroupPool     │           │    │
│  │  │ • Token vaults  │         │   (encrypted)   │           │    │
│  │  │                 │         │                 │           │    │
│  │  │ • Oracle-signed │         │ • Token vaults  │           │    │
│  │  │   transfers     │         │                 │           │    │
│  │  │                 │         │ • Oracle-signed │           │    │
│  │  └─────────────────┘         │   transfers     │           │    │
│  │                               │   (hidden)      │           │    │
│  │                               │                 │           │    │
│  │                               │ • MPC requests  │           │    │
│  │                               └────────┬────────┘           │    │
│  │                                        │                    │    │
│  └────────────────────────────────────────┼────────────────────┘    │
│                                           │                          │
│                                           │ Queue MPC                │
│                                           │ computation              │
└───────────────────────────────────────────┼──────────────────────────┘
                                            │
                                            ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    ARCIUM MPC NETWORK (Off-Chain)                    │
│                                                                       │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                │
│  │   Node 1    │  │   Node 2    │  │   Node N    │                │
│  │ (Cerberus)  │  │ (Cerberus)  │  │ (Manticore) │                │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘                │
│         │                 │                 │                        │
│         └─────────────────┼─────────────────┘                       │
│                           │                                          │
│            ┌──────────────▼──────────────┐                          │
│            │  ENCRYPTED CIRCUITS          │                          │
│            │  (MPC Computations)          │                          │
│            │                              │                          │
│            │  • add_to_balance           │                          │
│            │  • subtract_from_balance     │                          │
│            │  • transfer_to_pool          │                          │
│            │  • transfer_from_pool        │                          │
│            │  • aggregate_stats           │                          │
│            │  • verify_minimum            │                          │
│            │  • compute_share             │                          │
│            │                              │                          │
│            │  ALL OPERATIONS ON           │                          │
│            │  ENCRYPTED DATA!             │                          │
│            └──────────────┬───────────────┘                          │
│                           │                                          │
│                           │ Return encrypted result                  │
└───────────────────────────┼──────────────────────────────────────────┘
                            │
                            ▼
                  ┌─────────────────────┐
                  │   MPC Callback      │
                  │   (On-chain)        │
                  │                     │
                  │ Update encrypted    │
                  │ balances            │
                  └─────────────────────┘
```

## Data Flow: Confidential Deposit

### Step-by-Step Process

```
1. USER ENCRYPTS AMOUNT
   ┌─────────────┐
   │   Client    │ Amount: 1000 tokens
   │   (Arcium   │ ──────────────────► Encrypt(1000) = [0x2a, 0x3f, ...]
   │    SDK)     │
   └─────────────┘

2. SUBMIT TRANSACTION TO SOLANA
   ┌─────────────┐
   │  Solana     │ confidential_deposit(1000)
   │  Program    │ • Transfer actual tokens (public)
   │             │ • Store encrypted balance [0x2a, 0x3f, ...]
   │             │ • Create MPC request
   └─────────────┘
        │
        │ Queue MPC computation
        ▼
   ┌─────────────┐
   │ MPC Request │ { circuit: "add_to_balance",
   │   (PDA)     │   input: Enc<DepositInput>,
   │             │   status: Pending }
   └─────────────┘

3. MPC NETWORK PROCESSES
   ┌─────────────┐
   │ MPC Network │ Input: { current_balance: Enc(0),
   │  (Arcium)   │         deposit_amount: Enc(1000) }
   │             │
   │             │ Compute on encrypted data:
   │             │ new_balance = Enc(0) + Enc(1000)
   │             │            = Enc(1000)
   │             │
   │             │ Output: { new_balance: Enc(1000),
   │             │          success: true }
   └─────────────┘
        │
        │ Call callback instruction
        ▼
   ┌─────────────┐
   │  Solana     │ confidential_deposit_callback(result)
   │  Program    │ • Verify MPC signer
   │             │ • Update encrypted_balance = Enc(1000)
   │             │ • Mark request as Completed
   └─────────────┘

4. USER QUERIES BALANCE
   ┌─────────────┐
   │   Client    │ Fetch account: encrypted_balance = [0x2a, 0x3f, ...]
   │   (Arcium   │ Decrypt([0x2a, ...]) = 1000
   │    SDK)     │ ──────────────────► Display: "Balance: 1000"
   └─────────────┘

   Note: Only the user with the decryption key can see 1000!
```

## Data Flow: Oracle-Triggered Release to Dark Pool

```
1. OFF-CHAIN CONDITION MET
   ┌─────────────┐
   │   Database  │ Voting result: User approved for release
   │  (Off-chain)│ Amount: 500 tokens
   └──────┬──────┘
          │
          ▼
   ┌─────────────┐
   │   Oracle    │ Sign message:
   │   Server    │ "confidential_release:user:group:timestamp"
   │             │ Signature: [0xaa, 0xbb, ...]
   └─────────────┘

2. ORACLE SUBMITS TRANSACTION
   ┌─────────────┐
   │  Solana     │ confidential_release_to_group(500, signature)
   │  Program    │ • Verify oracle signature ✓
   │             │ • Queue MPC computation
   │             │ • Create MPC request
   └─────────────┘
        │
        ▼
   ┌─────────────┐
   │ MPC Network │ Input: { user_balance: Enc(1000),
   │  (Arcium)   │         pool_balance: Enc(0),
   │             │         transfer_amount: Enc(500) }
   │             │
   │             │ Compute:
   │             │ new_user_balance = Enc(1000) - Enc(500) = Enc(500)
   │             │ new_pool_balance = Enc(0) + Enc(500) = Enc(500)
   │             │
   │             │ Output: { new_user_balance: Enc(500),
   │             │          new_pool_balance: Enc(500),
   │             │          success: true }
   └─────────────┘
        │
        ▼
   ┌─────────────┐
   │  Solana     │ confidential_transfer_to_pool_callback(result)
   │  Program    │ • Update user encrypted_balance = Enc(500)
   │             │ • Update pool encrypted_total = Enc(500)
   │             │ • Transfer 500 actual tokens from user vault to pool vault
   │             │ • Increment participant_count (public)
   └─────────────┘

3. PUBLIC VIEW (WHAT OTHERS SEE)
   ┌─────────────┐
   │   Anyone    │ Query ConfidentialGroupPool:
   │   Queries   │ • group_id: "savings_pool" ✓
   │   On-chain  │ • encrypted_total: [0x7f, 0x2c, ...] ❌ (can't decrypt)
   │             │ • participant_count: 1 ✓
   │             │ • is_active: true ✓
   │             │
   │             │ ❌ Cannot see: individual balances, total amount
   │             │ ✅ Can see: participant count, pool health
   └─────────────┘
```

## Account Structure Comparison

### Public User Deposit (Original)
```
UserDeposit {
  owner: 7xKXtg...,
  deposited_amount: 1000,        ← VISIBLE TO ALL
  bump: 254
}

Anyone can see this user has 1000 tokens!
```

### Confidential User Deposit (Dark Pool)
```
ConfidentialUserDeposit {
  owner: 7xKXtg...,
  encrypted_balance: [0x2a, 0x3f, 0x7b, ...],  ← ENCRYPTED
  last_update_slot: 123456789,
  is_active: true,
  bump: 253
}

Only the owner with their private key can decrypt the balance!
No one else knows how many tokens they have!
```

## Privacy Layers

```
┌────────────────────────────────────────────────────────────────┐
│ LAYER 1: PUBLIC BLOCKCHAIN                                      │
│ • Token transfers (public)                                      │
│ • Account creation (public)                                     │
│ • Participant counts (public)                                   │
│ • Pool health status (public)                                   │
└────────────────────────────────────────────────────────────────┘
                         │
                         │ Encrypted values stored
                         ▼
┌────────────────────────────────────────────────────────────────┐
│ LAYER 2: ENCRYPTED STORAGE                                      │
│ • User balances (encrypted ciphertext)                          │
│ • Pool totals (encrypted ciphertext)                            │
│ • Transfer amounts (never stored, computed on-the-fly)          │
└────────────────────────────────────────────────────────────────┘
                         │
                         │ MPC processes
                         ▼
┌────────────────────────────────────────────────────────────────┐
│ LAYER 3: MPC COMPUTATION (OFF-CHAIN)                            │
│ • Computes on encrypted data                                    │
│ • Never decrypts values                                         │
│ • Returns encrypted results                                     │
│ • Distributed across multiple nodes                             │
└────────────────────────────────────────────────────────────────┘
                         │
                         │ User decrypts (client-side)
                         ▼
┌────────────────────────────────────────────────────────────────┐
│ LAYER 4: USER PRIVATE VIEW                                      │
│ • Only user can decrypt their own balance                       │
│ • Uses their private key (off-chain)                            │
│ • Never revealed on-chain                                       │
└────────────────────────────────────────────────────────────────┘
```

## Security Model

### Threat Model & Mitigations

| Threat | Without Dark Pool | With Dark Pool |
|--------|-------------------|----------------|
| **Front-running** | ❌ Attacker sees pending deposit of 10,000 tokens and front-runs | ✅ Amount encrypted, attacker doesn't know value |
| **MEV extraction** | ❌ Validator reorders txs based on visible amounts | ✅ Amounts hidden, can't optimize reordering |
| **Information leakage** | ❌ Competitors see your balance and strategy | ✅ Balance encrypted, only you can see |
| **Oracle manipulation** | ⚠️ Oracle has too much power | ⚠️ Same (oracle still controls releases) |
| **MPC compromise** | N/A | ⚠️ If >50% MPC nodes compromised, privacy lost |
| **User key loss** | ⚠️ Loses access to funds | ⚠️ Loses ability to decrypt balance (but can still withdraw via oracle) |

### Trust Assumptions

✅ **Solana validators are honest** (for liveness, not privacy)
✅ **Arcium MPC network has <50% Byzantine nodes**
✅ **Oracle is trusted** (same as original design)
✅ **Arcium encryption is secure**
❌ **No need to trust any single party for privacy**

## Performance Characteristics

| Operation | Public Pool | Dark Pool |
|-----------|-------------|-----------|
| Deposit | ~0.01 SOL fee | ~0.02 SOL fee + MPC time |
| Withdrawal | ~0.01 SOL fee | ~0.02 SOL fee + MPC time |
| Balance query | Instant | Instant (decrypt client-side) |
| MPC computation | N/A | ~2-5 seconds |
| Storage per user | 41 bytes | 73 bytes (+ encrypted data) |

## Scalability

### Current Limits
- **MPC throughput**: ~100 TPS per computation type
- **Solana throughput**: ~50,000 TPS (not bottleneck)
- **Storage**: O(n) where n = number of users

### Optimization Opportunities
1. **Batch MPC requests** - Process multiple users in one circuit
2. **Lazy evaluation** - Only compute when needed
3. **State compression** - Use compressed accounts for storage
4. **Circuit caching** - Reuse compiled circuits

---

## Key Takeaways

🔑 **Dual-mode design** - Public and confidential pools coexist
🔑 **End-to-end encryption** - Amounts never decrypted on-chain
🔑 **MPC guarantees privacy** - Even if Solana validators are compromised
🔑 **Oracle still controls flow** - Confidentiality ≠ Trustlessness
🔑 **Trade-off: privacy for latency** - MPC adds ~2-5 seconds

