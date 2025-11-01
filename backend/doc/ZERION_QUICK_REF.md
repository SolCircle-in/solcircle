# 🚀 Zerion API Quick Reference

## 📡 Available Endpoints

### 1. Health Check
```
GET /api/zerion/health
```
Check if Zerion integration is working

---

### 2. Multi-Chain Token Balances
```
GET /api/zerion/tokens/:identifier?chain=ethereum&minValue=1
```
**Returns:** All tokens with USD values, logos, prices

**Use case:** Display user's token portfolio

---

### 3. Portfolio Overview
```
GET /api/zerion/portfolio/:identifier
```
**Returns:** Total value, top assets, chain breakdown

**Use case:** Dashboard summary

---

### 4. NFT Collection
```
GET /api/zerion/nfts/:identifier?chain=ethereum&limit=50
```
**Returns:** All NFTs with images, floor prices, collections

**Use case:** NFT gallery

---

### 5. Asset Allocation
```
GET /api/zerion/allocation/:identifier
```
**Returns:** Breakdown by asset & chain with percentages

**Use case:** Portfolio analytics

---

### 6. Token Metadata
```
GET /api/zerion/token-info/:tokenAddress?chain=ethereum
```
**Returns:** Symbol, name, logo, price, market cap

**Use case:** Token details page

---

### 7. Supported Chains
```
GET /api/zerion/chains
```
**Returns:** List of 40+ supported blockchains

**Use case:** Chain selector dropdown

---

### 8. Transaction History (NEW!)
```
GET /api/zerion/transactions/:identifier?chain=ethereum&limit=20
```
**Returns:** Cross-chain transactions with USD values, gas fees, categorization

**Use case:** Transaction history page

---

### 9. Transaction Details (NEW!)
```
GET /api/zerion/transaction/:identifier/:hash
```
**Returns:** Detailed info about specific transaction

**Use case:** Transaction detail modal

---

### 10. Transaction Statistics (NEW!)
```
GET /api/zerion/transaction-stats/:identifier
```
**Returns:** Analytics (volume, fees, category breakdown)

**Use case:** Analytics dashboard

---

## 🎯 Quick Start

```bash
# 1. Add API key to .env
echo "ZERION_API_KEY=zk_dev_your_key_here" >> .env

# 2. Restart server
npm restart

# 3. Test
curl http://localhost:8000/api/zerion/health
```

---

## 🔥 Common Use Cases

### Show Portfolio Value
```javascript
// Frontend: Display total portfolio
const response = await fetch('/api/zerion/portfolio/alice123');
const data = await response.json();
console.log(`Total: $${data.data.total_value_usd}`);
```

### Display Token List
```javascript
// Frontend: Show tokens with logos
const response = await fetch('/api/zerion/tokens/alice123');
const tokens = response.data.tokens;

tokens.forEach(token => {
  console.log(`${token.symbol}: $${token.value_usd}`);
  // Show token.logo as image
});
```

### NFT Gallery
```javascript
// Frontend: Display NFTs
const response = await fetch('/api/zerion/nfts/alice123');
const nfts = response.data.nfts;

nfts.forEach(nft => {
  // Show nft.image in gallery
  console.log(`${nft.name} - ${nft.collection}`);
});
```

---

## ⚡ Features Included

### Portfolio & Assets
✅ Multi-chain token balances (40+ chains)  
✅ Real-time USD valuations  
✅ NFT collections with images  
✅ Total portfolio value  
✅ Token logos and metadata  
✅ Asset allocation percentages  
✅ Chain-by-chain breakdown  
✅ 24h price changes  
✅ Floor prices for NFTs  
✅ Collection grouping

### Transaction History (NEW!)
✅ Cross-chain transaction history  
✅ Transaction categorization (swaps, transfers, approvals)  
✅ USD amounts at time of transaction  
✅ Gas fees for each transaction  
✅ Transaction timestamps & block numbers  
✅ Pagination support  
✅ Chain filtering  
✅ Transaction statistics

---

## 📝 Notes

- **Mainnet only** - No devnet support
- **Rate limits** - 120 req/min (dev tier)
- **Caching recommended** - Store responses for 2-5 minutes
- **Devnet unaffected** - Your existing code still works

---

## 🆘 Troubleshooting

**Error: "Zerion API key not configured"**
- Add `ZERION_API_KEY` to `.env` file

**Error: "User not found"**
- Ensure user has `main_pkey` in database

**Error: "401 Unauthorized"**
- Check API key is correct and activated

**No data returned**
- Wallet might be empty on mainnet
- Try with a known active wallet

---

## 📞 Support

See full documentation: `ZERION_API_GUIDE.md`
