# 🏷️ Wallet Labels & Tags - Complete Guide

## Overview
The wallet labels system allows you to organize and identify multiple Solana wallets with custom names, tags, notes, and colors. Perfect for managing custodial wallets, personal wallets, and group pool wallets.

## Features
- ✅ Custom wallet labels with emojis
- ✅ Multiple tags per wallet
- ✅ Notes/descriptions
- ✅ Custom color coding
- ✅ Real-time balance tracking
- ✅ Search by tags
- ✅ Telegram bot integration

---

## API Endpoints

### 1. Get All Labels
**GET** `/api/wallet-labels/:identifier`

Get all labeled wallets for a user.

```bash
curl http://localhost:8000/api/wallet-labels/Anikdev2003
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
    "total": 1,
    "labels": [
      {
        "id": 1,
        "utgid": "6500823858",
        "wallet_address": "8iTq9RQbFkHBfh1xYAXrGz3HxW8iVUkRTpjFWJRGx7Aa",
        "label": "💼 Trading Wallet",
        "tags": ["trading", "active", "platform"],
        "note": "Main trading wallet for group pools",
        "color": "#6366f1",
        "created_at": "2025-10-30T14:13:45.180Z",
        "updated_at": "2025-10-30T14:13:45.180Z"
      }
    ]
  }
}
```

---

### 2. Get Specific Label
**GET** `/api/wallet-labels/:identifier/:wallet_address`

Get label for a specific wallet address.

```bash
curl http://localhost:8000/api/wallet-labels/Anikdev2003/8iTq9RQbFkHBfh1xYAXrGz3HxW8iVUkRTpjFWJRGx7Aa
```

---

### 3. Add/Update Label
**POST** `/api/wallet-labels`

Add or update a wallet label (upsert operation).

```bash
curl -X POST http://localhost:8000/api/wallet-labels \
  -H "Content-Type: application/json" \
  -d '{
    "identifier": "Anikdev2003",
    "wallet_address": "8iTq9RQbFkHBfh1xYAXrGz3HxW8iVUkRTpjFWJRGx7Aa",
    "label": "💼 Trading Wallet",
    "tags": ["trading", "active", "platform"],
    "note": "Main trading wallet for group pools",
    "color": "#6366f1"
  }'
```

**Response:**
```json
{
  "success": true,
  "message": "Label saved successfully",
  "data": {
    "id": 1,
    "utgid": "6500823858",
    "wallet_address": "8iTq9RQbFkHBfh1xYAXrGz3HxW8iVUkRTpjFWJRGx7Aa",
    "label": "💼 Trading Wallet",
    "tags": ["trading", "active", "platform"],
    "note": "Main trading wallet for group pools",
    "color": "#6366f1",
    "created_at": "2025-10-30T14:13:45.180Z",
    "updated_at": "2025-10-30T14:13:45.180Z"
  }
}
```

---

### 4. Update Label
**PUT** `/api/wallet-labels/:identifier/:wallet_address`

Update an existing label (all fields optional).

```bash
curl -X PUT http://localhost:8000/api/wallet-labels/Anikdev2003/8iTq9RQbFkHBfh1xYAXrGz3HxW8iVUkRTpjFWJRGx7Aa \
  -H "Content-Type: application/json" \
  -d '{
    "label": "🎯 Main Trading Wallet",
    "tags": ["trading", "active", "primary"]
  }'
```

---

### 5. Delete Label
**DELETE** `/api/wallet-labels/:identifier/:wallet_address`

Remove a wallet label.

```bash
curl -X DELETE http://localhost:8000/api/wallet-labels/Anikdev2003/8iTq9RQbFkHBfh1xYAXrGz3HxW8iVUkRTpjFWJRGx7Aa
```

---

### 6. Search by Tag
**GET** `/api/wallet-labels/:identifier/tags/:tag`

Find all wallets with a specific tag.

```bash
curl http://localhost:8000/api/wallet-labels/Anikdev2003/tags/trading
```

**Response:**
```json
{
  "success": true,
  "data": {
    "tag": "trading",
    "total": 2,
    "labels": [...]
  }
}
```

---

### 7. Wallet Overview
**GET** `/api/wallet-labels/:identifier/overview`

Get all wallets with labels, balances, and metadata.

```bash
curl http://localhost:8000/api/wallet-labels/Anikdev2003/overview
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
    "total_wallets": 2,
    "total_balance_sol": "6.0000",
    "wallets": [
      {
        "address": "8iTq9RQbFkHBfh1xYAXrGz3HxW8iVUkRTpjFWJRGx7Aa",
        "type": "custodial",
        "balance_sol": "1.0000",
        "balance_lamports": 1000000000,
        "network": "devnet",
        "label": "💼 Trading Wallet",
        "tags": ["trading", "active", "platform"],
        "note": "Main trading wallet for group pools",
        "color": "#6366f1",
        "has_custom_label": true
      },
      {
        "address": "EAbgG2WkZtPayBR3kPvmy1EPQCLmPUaWTPzZ74fYu9FK",
        "type": "main",
        "balance_sol": "5.0000",
        "balance_lamports": 5000000000,
        "network": "devnet",
        "label": "💼 Personal Wallet",
        "tags": ["personal", "main"],
        "note": "Your connected wallet",
        "color": "#10b981",
        "has_custom_label": false
      }
    ]
  }
}
```

---

## Telegram Bot Commands

### `/label [address] [label]`
Add a custom label to a wallet.

```
/label 8iTq9RQbFkHBfh1xYAXrGz3HxW8iVUkRTpjFWJRGx7Aa 💼 Trading Wallet
```

**Response:**
```
✅ Label saved for wallet!

💼 Trading Wallet
📍 8iTq9...x7Aa
```

---

### `/tag [address] [tags]`
Add tags to a wallet (comma-separated).

```
/tag 8iTq9RQbFkHBfh1xYAXrGz3HxW8iVUkRTpjFWJRGx7Aa trading,active,defi
```

**Response:**
```
✅ Tags added to wallet!

📍 8iTq9...x7Aa
🏷️ Tags: #trading #active #defi
```

---

### `/labels`
Show all your labeled wallets.

```
/labels
```

**Response:**
```
🏷️ Your Labeled Wallets (1)

1. 💼 Trading Wallet
   📍 8iTq9...x7Aa
   🏷️ #trading #active #platform
   📝 Main trading wallet for group pools
```

---

### `/wallets`
Show all wallets with labels, balances, and tags.

```
/wallets
```

**Response:**
```
💼 Your Wallets Overview

Total Balance: 6.0000 SOL
Wallets: 2

💼 Trading Wallet ⭐
📍 8iTq9...x7Aa
💰 Balance: 1.0000 SOL
🏷️ #trading #active #platform
📝 Main trading wallet for group pools
🔗 Type: custodial

💼 Personal Wallet
📍 EAbgG...u9FK
💰 Balance: 5.0000 SOL
🏷️ #personal #main
📝 Your connected wallet
🔗 Type: main
```

---

### `/unlabel [address]`
Remove a label from a wallet.

```
/unlabel 8iTq9RQbFkHBfh1xYAXrGz3HxW8iVUkRTpjFWJRGx7Aa
```

**Response:**
```
✅ Label removed from wallet

📍 8iTq9...x7Aa
```

---

## Database Schema

### `wallet_labels` Table

```sql
CREATE TABLE wallet_labels (
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
);

-- Indexes
CREATE INDEX idx_wallet_labels_user ON wallet_labels(utgid);
CREATE INDEX idx_wallet_labels_tags ON wallet_labels USING GIN(tags);
CREATE INDEX idx_wallet_labels_address ON wallet_labels(wallet_address);
```

---

## Use Cases

### 1. Organize Multiple Trading Wallets
```
Wallet 1: 💼 Trading Wallet #trading #active
Wallet 2: 💰 Savings Wallet #savings #hodl
Wallet 3: 🎮 NFT Wallet #nft #collection
```

### 2. Track Group Pools
```
Pool 1: 👥 Main Pool #group #collaborative
Pool 2: 👥 Test Pool #group #testing
```

### 3. Identify Wallet Types
```
Platform: 🤖 Platform Wallet #custodial #platform
Personal: 💼 Personal Wallet #personal #main
DeFi: 🔄 DeFi Wallet #defi #staking
```

### 4. Color Coding
```
Blue (#6366f1): Trading wallets
Green (#10b981): Personal wallets
Orange (#f59e0b): Group pools
Purple (#a855f7): NFT wallets
```

---

## Best Practices

1. **Use Descriptive Labels**: Include emojis and clear names
2. **Consistent Tagging**: Use standard tags like #trading, #defi, #active
3. **Add Notes**: Document the purpose of each wallet
4. **Color Code**: Assign colors by wallet type or purpose
5. **Regular Updates**: Keep labels current as wallet usage changes

---

## Example Workflows

### Workflow 1: Set up new trading wallet
```bash
# 1. Add label
/label 8iTq9RQbFkHBfh1xYAXrGz3HxW8iVUkRTpjFWJRGx7Aa 💼 Main Trading Wallet

# 2. Add tags
/tag 8iTq9RQbFkHBfh1xYAXrGz3HxW8iVUkRTpjFWJRGx7Aa trading,active,primary

# 3. View all wallets
/wallets
```

### Workflow 2: Search and organize
```bash
# Find all trading wallets
GET /api/wallet-labels/Anikdev2003/tags/trading

# Find all active wallets
GET /api/wallet-labels/Anikdev2003/tags/active

# Get overview
/wallets
```

---

## Error Handling

### Invalid Address
```json
{
  "success": false,
  "error": "Invalid wallet address format"
}
```

### User Not Found
```json
{
  "success": false,
  "error": "User not found"
}
```

### Label Not Found
```json
{
  "success": false,
  "error": "Label not found"
}
```

---

## Integration Examples

### React Component
```jsx
const WalletCard = ({ wallet }) => (
  <div style={{ borderColor: wallet.color }}>
    <h3>{wallet.label}</h3>
    <p>{wallet.address}</p>
    <p>Balance: {wallet.balance_sol} SOL</p>
    <div>
      {wallet.tags.map(tag => (
        <span key={tag}>#{tag}</span>
      ))}
    </div>
    {wallet.note && <p>{wallet.note}</p>}
  </div>
);
```

### Python Script
```python
import requests

# Get all wallets
response = requests.get(
    "http://localhost:8000/api/wallet-labels/Anikdev2003/overview"
)
data = response.json()

for wallet in data["data"]["wallets"]:
    print(f"{wallet['label']}: {wallet['balance_sol']} SOL")
```

---

## Maintenance

### Clear All Labels for User
```sql
DELETE FROM wallet_labels WHERE utgid = '6500823858';
```

### Find Unused Labels
```sql
SELECT w.* FROM wallet_labels w
LEFT JOIN users u ON w.utgid = u.utgid
WHERE u.utgid IS NULL;
```

### Most Popular Tags
```sql
SELECT unnest(tags) as tag, COUNT(*) as count
FROM wallet_labels
GROUP BY tag
ORDER BY count DESC;
```

---

## Support
For issues or questions, contact the development team or open an issue on GitHub.
