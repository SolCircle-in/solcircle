# 🏷️ Wallet Labels - Quick Reference

## Bot Commands

| Command | Usage | Description |
|---------|-------|-------------|
| `/label` | `/label [address] [label]` | Add custom label to wallet |
| `/tag` | `/tag [address] [tags]` | Add tags (comma-separated) |
| `/labels` | `/labels` | Show all labeled wallets |
| `/wallets` | `/wallets` | Show wallets with balances |
| `/unlabel` | `/unlabel [address]` | Remove label from wallet |

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/wallet-labels/:identifier` | Get all labels |
| GET | `/api/wallet-labels/:identifier/:wallet_address` | Get specific label |
| POST | `/api/wallet-labels` | Add/update label |
| PUT | `/api/wallet-labels/:identifier/:wallet_address` | Update label |
| DELETE | `/api/wallet-labels/:identifier/:wallet_address` | Delete label |
| GET | `/api/wallet-labels/:identifier/tags/:tag` | Search by tag |
| GET | `/api/wallet-labels/:identifier/overview` | Wallet overview with balances |

## Quick Examples

### Add Label via Bot
```
/label 8iTq9RQbFkHBfh1xYAXrGz3HxW8iVUkRTpjFWJRGx7Aa 💼 Trading Wallet
```

### Add Tags via Bot
```
/tag 8iTq9RQbFkHBfh1xYAXrGz3HxW8iVUkRTpjFWJRGx7Aa trading,active,defi
```

### Add Label via API
```bash
curl -X POST http://localhost:8000/api/wallet-labels \
  -H "Content-Type: application/json" \
  -d '{
    "identifier": "Anikdev2003",
    "wallet_address": "8iTq9RQbFkHBfh1xYAXrGz3HxW8iVUkRTpjFWJRGx7Aa",
    "label": "💼 Trading Wallet",
    "tags": ["trading", "active"],
    "note": "Main trading wallet",
    "color": "#6366f1"
  }'
```

### Get Overview via API
```bash
curl http://localhost:8000/api/wallet-labels/Anikdev2003/overview
```

### Search by Tag via API
```bash
curl http://localhost:8000/api/wallet-labels/Anikdev2003/tags/trading
```

## Common Tags

| Tag | Purpose |
|-----|---------|
| `#trading` | Active trading wallets |
| `#savings` | Long-term holdings |
| `#defi` | DeFi protocol interactions |
| `#nft` | NFT collections |
| `#group` | Group pool wallets |
| `#custodial` | Platform-managed wallets |
| `#personal` | Personal wallets |
| `#active` | Frequently used |
| `#inactive` | Rarely used |
| `#testing` | Test/dev wallets |

## Emoji Guide

| Emoji | Purpose |
|-------|---------|
| 💼 | Trading/Business |
| 💰 | Savings |
| 🤖 | Platform/Custodial |
| 👥 | Group Pools |
| 🎮 | NFT/Gaming |
| 🔄 | DeFi/Swaps |
| 🎯 | Primary/Main |
| 🧪 | Testing |
| 🔒 | Locked/Staked |
| ⚡ | Fast/Active |

## Color Codes

| Color | Hex | Use Case |
|-------|-----|----------|
| Blue | `#6366f1` | Trading wallets |
| Green | `#10b981` | Personal wallets |
| Orange | `#f59e0b` | Group pools |
| Purple | `#a855f7` | NFT wallets |
| Red | `#ef4444` | High-risk |
| Yellow | `#eab308` | Caution |
| Cyan | `#06b6d4` | DeFi protocols |
| Pink | `#ec4899` | Special purpose |

## Response Structure

### Label Object
```json
{
  "id": 1,
  "utgid": "6500823858",
  "wallet_address": "8iTq9RQbFkHBfh1xYAXrGz3HxW8iVUkRTpjFWJRGx7Aa",
  "label": "💼 Trading Wallet",
  "tags": ["trading", "active"],
  "note": "Main trading wallet",
  "color": "#6366f1",
  "created_at": "2025-10-30T14:13:45.180Z",
  "updated_at": "2025-10-30T14:13:45.180Z"
}
```

### Wallet Overview Object
```json
{
  "address": "8iTq9RQbFkHBfh1xYAXrGz3HxW8iVUkRTpjFWJRGx7Aa",
  "type": "custodial",
  "balance_sol": "1.0000",
  "balance_lamports": 1000000000,
  "network": "devnet",
  "label": "💼 Trading Wallet",
  "tags": ["trading", "active"],
  "note": "Main trading wallet",
  "color": "#6366f1",
  "has_custom_label": true
}
```

## Database Schema

```sql
wallet_labels (
  id SERIAL PRIMARY KEY,
  utgid VARCHAR(50) NOT NULL,
  wallet_address VARCHAR(255) NOT NULL,
  label VARCHAR(100),
  tags TEXT[],
  note TEXT,
  color VARCHAR(10),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(utgid, wallet_address)
)
```

## Tips

1. **Use emojis** for visual identification
2. **Tag consistently** across wallets
3. **Add notes** for important details
4. **Color code** by purpose/type
5. **Update regularly** as usage changes
6. **Search by tags** to find related wallets
7. **Use `/wallets`** for quick overview

## Error Codes

| Code | Message | Solution |
|------|---------|----------|
| 400 | Invalid wallet address format | Check address length (32-44 chars) |
| 404 | User not found | Verify username/utgid |
| 404 | Label not found | Check if label exists |
| 500 | Internal server error | Contact support |
