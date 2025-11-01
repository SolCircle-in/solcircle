# Unified Positions Dashboard Guide

## Overview

The Unified Positions Dashboard combines your SolCircle platform data (devnet) with Zerion mainnet data to give you a complete view of all your cryptocurrency positions in one place.

## Features

### 1. Complete Portfolio View
- **Platform Balance**: Your custodial and main wallets on Solana devnet
- **Group Pool Positions**: All SolCircle group pools you're participating in
- **Mainnet Tokens**: Your tokens across 40+ blockchains (via Zerion)
- **DeFi Positions**: Your staking, liquidity pools, lending positions on mainnet

### 2. Smart Insights
- Platform balance status
- Pool participation recommendations
- Bridging suggestions between devnet and mainnet
- DeFi yield optimization tips

### 3. Side-by-Side Comparison
- Platform vs Mainnet breakdown
- Actionable recommendations
- Use case explanations

---

## API Endpoints

### 1. Unified Positions Dashboard
**Endpoint:** `GET /api/positions/:identifier`

**Description:** Get a complete view of all positions (platform + mainnet)

**Example:**
```bash
curl http://localhost:8000/api/positions/Anikdev2003
```

**Response:**
```json
{
  "success": true,
  "data": {
    "user": {
      "utgid": "6500823858",
      "username": "Anikdev2003"
    },
    "platform": {
      "network": "devnet",
      "custodial_wallet": {
        "address": "8iTq9RQbFkHBfh1xYAXrGz3HxW8iVUkRTpjFWJRGx7Aa",
        "balance_sol": "1.0000",
        "balance_lamports": 1000000000
      },
      "main_wallet": {
        "address": "EAbgG2WkZtPayBR3kPvmy1EPQCLmPUaWTPzZ74fYu9FK",
        "balance_sol": "5.0000",
        "balance_lamports": 5000000000
      },
      "total_platform_sol": "6.0000"
    },
    "pools": {
      "total_pool_balance_sol": "0.0000",
      "positions_count": 0,
      "positions": []
    },
    "mainnet_tokens": {
      "available": true,
      "total_value_usd": "0.00",
      "tokens": [],
      "error": null
    },
    "mainnet_defi": {
      "available": true,
      "positions": {
        "summary": {
          "total_value_locked_usd": "0.00",
          "estimated_annual_yield_usd": "0.00",
          "estimated_daily_yield_usd": "0.0000",
          "avg_apy": "0%",
          "total_positions": 0
        }
      }
    },
    "insights": {
      "platform_has_balance": true,
      "has_pool_positions": false,
      "has_mainnet_tokens": false,
      "has_defi_positions": false,
      "total_groups": 0,
      "suggestions": [
        {
          "type": "opportunity",
          "priority": "medium",
          "message": "Join a group pool to start collaborative trading"
        }
      ]
    },
    "summary": {
      "platform_sol": "6.0000",
      "pool_positions_sol": "0.0000",
      "mainnet_tokens_usd": "0.00",
      "mainnet_defi_usd": "0.00",
      "total_mainnet_usd": "0.00"
    }
  }
}
```

**Use Cases:**
- Dashboard homepage showing all assets
- Portfolio tracking
- Net worth calculation
- Investment overview

---

### 2. Pool Positions Only
**Endpoint:** `GET /api/positions/:identifier/pools`

**Description:** Get only SolCircle group pool positions

**Example:**
```bash
curl http://localhost:8000/api/positions/Anikdev2003/pools
```

**Response:**
```json
{
  "success": true,
  "data": {
    "user": {
      "utgid": "6500823858",
      "username": "Anikdev2003"
    },
    "summary": {
      "total_pool_balance_sol": "0.0000",
      "total_pools": 0
    },
    "positions": []
  }
}
```

**With Pool Positions:**
```json
{
  "positions": [
    {
      "group_id": "-1001234567890",
      "group_wallet": "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU",
      "role": "owner",
      "pool_balance_sol": "5.2500",
      "member_count": 8,
      "joined_at": "2025-01-15T10:30:00.000Z"
    }
  ]
}
```

**Use Cases:**
- Group pool management
- Contribution tracking
- Member coordination

---

### 3. Platform vs Mainnet Comparison
**Endpoint:** `GET /api/positions/:identifier/comparison`

**Description:** Compare platform and mainnet positions side-by-side

**Example:**
```bash
curl http://localhost:8000/api/positions/Anikdev2003/comparison
```

**Response:**
```json
{
  "success": true,
  "data": {
    "platform_devnet": {
      "type": "Testing & Trading Platform",
      "balance_sol": "6.0000",
      "pool_positions": 0,
      "network": "Solana Devnet",
      "use_case": "Group pooling, collaborative trading, bot trading"
    },
    "mainnet": {
      "type": "Personal Portfolio",
      "tokens_usd": "0.00",
      "defi_positions_usd": "0.00",
      "total_usd": "0.00",
      "network": "Multi-chain (40+ networks)",
      "use_case": "Long-term holdings, DeFi yield, NFTs"
    },
    "recommendations": [
      {
        "action": "Join a group pool",
        "reason": "You have platform balance but no pool positions",
        "benefit": "Collaborate with others and share trading strategies"
      },
      {
        "action": "Consider mainnet for long-term holdings",
        "reason": "You're only on devnet (testing)",
        "benefit": "Earn real yields with DeFi protocols"
      }
    ]
  }
}
```

**Use Cases:**
- Investment strategy planning
- Asset allocation decisions
- Understanding platform vs mainnet

---

## Database Schema

The positions dashboard uses the following tables:

### users
```sql
utgid VARCHAR(255)         -- Telegram User ID
username VARCHAR(255)      -- Telegram username
custodial_pkey TEXT        -- Custodial wallet address
main_pkey TEXT            -- Main wallet address
status VARCHAR(50)        -- active/suspended/banned
created_at TIMESTAMP
```

### participants
```sql
id SERIAL PRIMARY KEY
utgid VARCHAR(255)        -- Foreign key to users
tgid VARCHAR(255)         -- Foreign key to groups
role VARCHAR(50)          -- owner/admin/member
joined_at TIMESTAMP
left_at TIMESTAMP         -- NULL if still member
```

### groups
```sql
tgid VARCHAR(255) PRIMARY KEY  -- Telegram Group ID
relay_account TEXT             -- Group wallet address
encrypted_key TEXT            -- Encrypted private key
pool_pda TEXT                 -- Solana pool PDA
owner VARCHAR(255)            -- Owner's utgid
admin TEXT[]                  -- Array of admin utgids
cooldown_period INTEGER
min_stake NUMERIC
status VARCHAR(50)
created_at TIMESTAMP
```

---

## Smart Insights Logic

### Suggestions Generated:

1. **Low Platform Balance** (Priority: High)
   - Triggered when: `platform_sol < 0.1`
   - Message: Deposit SOL to participate in pools

2. **Mainnet DeFi with No Pools** (Priority: Medium)
   - Triggered when: `mainnet_defi_usd > 1000` AND `pool_positions = 0`
   - Message: Try collaborative trading on SolCircle

3. **Mainnet Tokens, Low Platform Balance** (Priority: Medium)
   - Triggered when: `mainnet_tokens_usd > 100` AND `platform_sol < 1`
   - Message: Consider transferring some to platform

4. **No Pool Positions with Balance** (Priority: Medium)
   - Triggered when: `pool_positions = 0` AND `platform_sol > 1`
   - Message: Join a group pool

5. **Only Devnet, No Mainnet** (Priority: Low)
   - Triggered when: `mainnet_total_usd = 0` AND `platform_sol > 0`
   - Message: Consider mainnet for real yields

6. **DeFi with High APY** (Priority: Low)
   - Triggered when: DeFi positions exist
   - Message: Shows average APY of current positions

---

## Integration with Telegram Bot

### Suggested Bot Commands:

#### `/myportfolio` or `/positions`
Shows unified positions dashboard
```
📊 Your Complete Portfolio

💰 Platform (Devnet):
└─ Balance: 6.0000 SOL
└─ Pool Positions: 0

🌐 Mainnet Portfolio:
└─ Tokens: $0.00
└─ DeFi Positions: $0.00

💡 Suggestions:
• Join a group pool to start trading
• Consider mainnet for long-term holdings
```

#### `/pools`
Shows only group pool positions
```
🏊 Your Pool Positions

Total: 0 pools
Total Balance: 0.0000 SOL

Use /joinpool to participate!
```

#### `/compare`
Shows platform vs mainnet comparison
```
⚖️ Platform vs Mainnet

📍 Platform (Devnet):
• Balance: 6.0000 SOL
• Use: Trading & collaboration

🌍 Mainnet:
• Value: $0.00
• Use: Long-term holdings

💡 Recommendation: Join a pool!
```

---

## Frontend Implementation

### Dashboard Component Structure:

```javascript
// Fetch unified positions
const response = await fetch(`/api/positions/${username}`);
const data = response.data;

// Display Summary Card
<SummaryCard 
  platformSol={data.summary.platform_sol}
  poolsSol={data.summary.pool_positions_sol}
  mainnetUsd={data.summary.total_mainnet_usd}
/>

// Display Platform Section
<PlatformSection
  custodialWallet={data.platform.custodial_wallet}
  mainWallet={data.platform.main_wallet}
  total={data.platform.total_platform_sol}
/>

// Display Pool Positions
<PoolPositions
  pools={data.pools.positions}
  total={data.pools.total_pool_balance_sol}
/>

// Display Mainnet Tokens
<MainnetTokens
  tokens={data.mainnet_tokens.tokens}
  totalUsd={data.mainnet_tokens.total_value_usd}
/>

// Display DeFi Positions
<DeFiPositions
  positions={data.mainnet_defi.positions}
  summary={data.mainnet_defi.positions.summary}
/>

// Display Insights
<InsightsCard
  suggestions={data.insights.suggestions}
  stats={data.insights}
/>
```

---

## Error Handling

### User Not Found
```json
{
  "success": false,
  "error": "User not found"
}
```

### Zerion API Unavailable
- Platform data still works
- Mainnet data shows `available: false` with error message
- Graceful degradation ensures core functionality

### Database Connection Issues
```json
{
  "success": false,
  "error": "Database query error: [error message]"
}
```

---

## Performance Considerations

1. **Parallel API Calls**: Zerion tokens and DeFi positions fetched in parallel
2. **Timeout Handling**: 5 second timeout on Zerion requests
3. **Caching**: Consider implementing Redis cache for Zerion responses
4. **Rate Limiting**: Zerion API has rate limits, cache responses when possible

---

## Next Steps

### Phase 1: Testing ✅
- [x] Fix database schema issues
- [x] Test unified positions endpoint
- [x] Test pools-only endpoint
- [x] Test comparison endpoint

### Phase 2: Frontend Integration
- [ ] Create dashboard UI components
- [ ] Add loading states
- [ ] Add error boundaries
- [ ] Implement responsive design

### Phase 3: Telegram Bot Commands
- [ ] Add `/positions` command
- [ ] Add `/pools` command
- [ ] Add `/compare` command
- [ ] Add inline keyboards for actions

### Phase 4: Advanced Features
- [ ] Add position history tracking
- [ ] Add portfolio performance charts
- [ ] Add alerts for significant changes
- [ ] Add export to CSV/PDF

---

## Troubleshooting

### "relation 'group_participants' does not exist"
**Solution:** Your database uses `participants` table, not `group_participants`. This has been fixed in the code.

### "Zerion data unavailable"
**Check:**
1. ZERION_API_KEY is set in .env
2. API key is valid and active
3. Network connection is working
4. Check console logs for specific error

### "Pool balance showing 0.0000"
**Check:**
1. User has joined groups (check participants table)
2. Groups have been funded with SOL
3. Solana RPC is accessible (devnet.solana.com)

---

## Security Notes

- ✅ Platform uses custodial wallets (encrypted private keys)
- ✅ Mainnet data is read-only via Zerion API
- ✅ No private keys exposed in API responses
- ✅ User data filtered by utgid/username authentication
- ⚠️ Implement proper authentication before production
- ⚠️ Add rate limiting to prevent abuse

---

## Credits

- **Zerion API**: Multi-chain portfolio data
- **Solana Web3.js**: Devnet balance queries
- **PostgreSQL**: User and group data storage
- **SolCircle Team**: Platform development
