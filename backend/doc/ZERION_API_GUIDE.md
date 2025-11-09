# 🌐 Zerion Portfolio & Assets Integration Guide

## ✅ **What's Been Added**

All 6 Portfolio & Assets features from Zerion have been successfully integrated:

1. ✅ **Multi-chain token balances** (Ethereum, Polygon, BSC, Arbitrum, Optimism, Avalanche, etc.)
2. ✅ **Real-time USD valuations** for all tokens
3. ✅ **NFT collections** across all chains
4. ✅ **Total portfolio value** in USD
5. ✅ **Token metadata** (logos, names, symbols)
6. ✅ **Asset allocation breakdown** (% of portfolio per token)

---

## 🚀 **Setup Instructions**

### Step 1: Get Zerion API Key

1. Visit: https://developers.zerion.io
2. Sign up for a developer account
3. Request API access (fill out the form)
4. You'll receive an API key via email (usually within 24-48 hours)

### Step 2: Configure Your Environment

Add your Zerion API key to `.env`:

```env
ZERION_API_KEY=zk_dev_your_actual_key_here
```

> Note on examples: Replace identifiers like `alice123` with a real `utgid` or `username` from your `users` table. You can quickly verify with a query such as `SELECT utgid, username, main_pkey FROM users LIMIT 5;`. Also ensure you’re calling the correct server port (`PORT`, default 3000) and that `ZERION_API_KEY` is set.

### Step 3: Test the Connection

```bash
# Test if Zerion is configured properly
curl http://localhost:8000/api/zerion/health
```

Expected response:
```json
{
  "success": true,
  "configured": true,
  "message": "Zerion integration is healthy"
}
```

---

## 📡 **API Endpoints**

### 1. **Multi-Chain Token Balances**
Get all token holdings with real-time USD values

**Endpoint:** `GET /api/zerion/tokens/:identifier`

**Parameters:**
- `identifier` - User's `utgid` or `username`
- `chain` (optional) - Filter by chain: `ethereum`, `polygon`, `solana`, `bsc`, etc.
- `minValue` (optional) - Minimum USD value (default: 0.01)

**Example:**
```bash
# Get all tokens
curl http://localhost:8000/api/zerion/tokens/alice123

# Get only Ethereum tokens
curl http://localhost:8000/api/zerion/tokens/alice123?chain=ethereum

# Get tokens worth more than $10
curl http://localhost:8000/api/zerion/tokens/alice123?minValue=10
```

**Response:**
```json
{
  "success": true,
  "data": {
    "user": {
      "username": "alice123",
      "wallet": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb"
    },
    "chain_filter": "all",
    "total_value_usd": "15420.50",
    "token_count": 12,
    "tokens": [
      {
        "symbol": "ETH",
        "name": "Ethereum",
        "quantity": 5.234,
        "value_usd": "9850.20",
        "price_usd": "1881.500000",
        "chain": "ethereum",
        "logo": "https://cdn.zerion.io/eth.png",
        "address": "0x0000000000000000000000000000000000000000",
        "decimals": 18,
        "change_24h": 2.5
      }
    ]
  }
}
```

---

### 2. **Complete Portfolio Overview**
Get total portfolio value and top assets

**Endpoint:** `GET /api/zerion/portfolio/:identifier`

**Example:**
```bash
curl http://localhost:8000/api/zerion/portfolio/alice123
```

**Response:**
```json
{
  "success": true,
  "data": {
    "user": {
      "username": "alice123",
      "wallet": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb"
    },
    "total_value_usd": "25340.75",
    "total_positions": 28,
    "chains": [
      {
        "name": "ethereum",
        "count": 15,
        "value": "18240.50",
        "percentage": "71.98"
      },
      {
        "name": "polygon",
        "count": 8,
        "value": "5100.25",
        "percentage": "20.12"
      }
    ],
    "top_assets": [
      {
        "symbol": "ETH",
        "name": "Ethereum",
        "value": "9850.20",
        "percentage": "38.87",
        "logo": "https://cdn.zerion.io/eth.png"
      }
    ]
  }
}
```

---

### 3. **NFT Collections**
Get all NFTs across all chains

**Endpoint:** `GET /api/zerion/nfts/:identifier`

**Parameters:**
- `chain` (optional) - Filter by chain
- `limit` (optional) - Max NFTs to return (default: 50)

**Example:**
```bash
# Get all NFTs
curl http://localhost:8000/api/zerion/nfts/alice123

# Get only Ethereum NFTs
curl http://localhost:8000/api/zerion/nfts/alice123?chain=ethereum&limit=20
```

**Response:**
```json
{
  "success": true,
  "data": {
    "user": {
      "username": "alice123",
      "wallet": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb"
    },
    "total_nfts": 45,
    "total_collections": 12,
    "total_floor_value_usd": "8950.00",
    "collections": [
      {
        "name": "Bored Ape Yacht Club",
        "count": 2,
        "floor_value": "120000.00",
        "chain": "ethereum"
      }
    ],
    "nfts": [
      {
        "name": "Bored Ape #1234",
        "collection": "Bored Ape Yacht Club",
        "description": "A bored ape",
        "image": "https://ipfs.io/ipfs/...",
        "floor_price_usd": "60000.00",
        "chain": "ethereum",
        "token_id": "1234",
        "contract_address": "0xBC4CA0EdA7647A8aB7C2061c2E118A18a936f13D"
      }
    ]
  }
}
```

---

### 4. **Asset Allocation Breakdown**
Get portfolio allocation by asset and chain

**Endpoint:** `GET /api/zerion/allocation/:identifier`

**Example:**
```bash
curl http://localhost:8000/api/zerion/allocation/alice123
```

**Response:**
```json
{
  "success": true,
  "data": {
    "user": {
      "username": "alice123",
      "wallet": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb"
    },
    "total_value_usd": "25340.75",
    "allocation_by_asset": [
      {
        "symbol": "ETH",
        "name": "Ethereum",
        "value": "9850.20",
        "percentage": "38.87",
        "chain": "ethereum",
        "logo": "https://cdn.zerion.io/eth.png"
      },
      {
        "symbol": "USDC",
        "name": "USD Coin",
        "value": "5000.00",
        "percentage": "19.73",
        "chain": "ethereum",
        "logo": "https://cdn.zerion.io/usdc.png"
      }
    ],
    "allocation_by_chain": [
      {
        "chain": "ethereum",
        "value": "18240.50",
        "percentage": "71.98"
      },
      {
        "chain": "polygon",
        "value": "5100.25",
        "percentage": "20.12"
      }
    ]
  }
}
```

---

### 5. **Token Metadata**
Get detailed info about a specific token

**Endpoint:** `GET /api/zerion/token-info/:tokenAddress`

**Parameters:**
- `chain` (optional) - Chain ID (default: ethereum)

**Example:**
```bash
# Get USDC info on Ethereum
curl http://localhost:8000/api/zerion/token-info/0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48?chain=ethereum
```

**Response:**
```json
{
  "success": true,
  "data": {
    "address": "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    "chain": "ethereum",
    "symbol": "USDC",
    "name": "USD Coin",
    "decimals": 6,
    "logo": "https://cdn.zerion.io/usdc.png",
    "description": "Fully reserved stablecoin",
    "market_cap_usd": "28500000000",
    "price_usd": "1.00",
    "change_24h": -0.01
  }
}
```

---

### 6. **Supported Chains**
Get list of all supported blockchain networks

**Endpoint:** `GET /api/zerion/chains`

**Example:**
```bash
curl http://localhost:8000/api/zerion/chains
```

**Response:**
```json
{
  "success": true,
  "data": {
    "total_chains": 42,
    "chains": [
      {
        "id": "ethereum",
        "name": "Ethereum",
        "is_testnet": false,
        "icon": "https://cdn.zerion.io/ethereum.png",
        "explorer_url": "https://etherscan.io"
      },
      {
        "id": "polygon",
        "name": "Polygon",
        "is_testnet": false,
        "icon": "https://cdn.zerion.io/polygon.png",
        "explorer_url": "https://polygonscan.com"
      }
    ]
  }
}
```

---

## 🧪 **Testing with Your Data**

### Prerequisites
1. User must have a `main_pkey` (wallet address) in your database
2. That wallet must be a **mainnet** address (Zerion doesn't support devnet)
3. Wallet should have some tokens/NFTs for meaningful results

### Test Flow

```bash
# 1. Check if Zerion is configured
curl http://localhost:8000/api/zerion/health

# 2. Get supported chains
curl http://localhost:8000/api/zerion/chains

# 3. Test with a known mainnet address
# Replace 'alice123' with actual username from your database
curl http://localhost:8000/api/zerion/portfolio/alice123

# 4. Get detailed token balances
curl http://localhost:8000/api/zerion/tokens/alice123

# 5. Check NFT collection
curl http://localhost:8000/api/zerion/nfts/alice123

# 6. View asset allocation
curl http://localhost:8000/api/zerion/allocation/alice123
```

---

## ⚠️ **Important Notes**

### Rate Limits
- **Dev tier**: 120 requests/minute, 5,000 requests/day
- Monitor your usage to avoid hitting limits
- Consider implementing caching for production

### Supported Networks
- ✅ **Mainnet only** (Ethereum, Polygon, Solana mainnet, etc.)
- ❌ **No devnet/testnet** support
- Your existing devnet infrastructure remains unchanged

### Error Handling
All endpoints return consistent error responses:
```json
{
  "success": false,
  "error": "Error message here"
}
```

Common errors:
- `Zerion API key not configured` - Add ZERION_API_KEY to .env
- `User not found` - Invalid username/utgid
- `Zerion API Error: 401` - Invalid API key
- `Zerion API Error: 429` - Rate limit exceeded

---

## 🔄 **Integration with Existing Code**

Your devnet functionality **continues to work unchanged**:
- `/api/users/*` - Still works with devnet
- Bot commands - Still use devnet
- Custodial wallets - Still on devnet

Zerion is **optional and additive**:
- Only works when ZERION_API_KEY is set
- Only shows mainnet portfolio data
- Doesn't interfere with devnet operations

---

## 📊 **Use Cases**

1. **Portfolio Dashboard** - Show users their complete crypto portfolio
2. **Multi-Chain Tracking** - Track assets across 40+ blockchains
3. **NFT Gallery** - Display user's NFT collections
4. **Asset Analytics** - Show allocation and performance
5. **Token Discovery** - Help users find and track new tokens

---

## 🚀 **Next Steps**

1. ✅ Add your Zerion API key to `.env`
2. ✅ Test the `/health` endpoint
3. ✅ Try with a real mainnet wallet address
4. ⏳ Build frontend UI to display the data
5. ⏳ Add Telegram bot commands for portfolio viewing
6. ⏳ Implement caching (Redis) for better performance

---

## 💡 **Tips**

- Start with the `/portfolio` endpoint for a quick overview
- Use `/tokens` with chain filter for specific blockchain data
- Cache responses for 2-5 minutes to reduce API calls
- Show logos from `logo` field for better UX
- Display percentages for easy allocation understanding

---

## 📞 **Support**

If you encounter issues:
1. Check `.env` has correct `ZERION_API_KEY`
2. Verify user has `main_pkey` in database
3. Ensure wallet is a mainnet address
4. Check API key is activated (Zerion sends email confirmation)
5. Review server logs for detailed error messages

---

**🎉 All Portfolio & Assets features are now live!**
