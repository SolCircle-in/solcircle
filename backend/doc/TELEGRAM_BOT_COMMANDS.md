# 🤖 SolCircle Telegram Bot - Complete Command List

## 📋 Table of Contents
1. [Basic Commands](#basic-commands)
2. [Registration & Setup](#registration--setup)
3. [Session Management](#session-management)
4. [Voting & Proposals](#voting--proposals)
5. [Status & Monitoring](#status--monitoring)
6. [Analytics Commands](#analytics-commands)
7. [Wallet Labels & Tags](#wallet-labels--tags)
8. [Quick Reference](#quick-reference)

---

## 🎯 Basic Commands

### `/status`
**Check backend connectivity**
- **Usage:** `/status`
- **Where:** Any chat
- **Description:** Tests connection to backend server
- **Example Output:** `✅ Backend online!`

### `/echo [message]`
**Echo a message**
- **Usage:** `/echo <your message>`
- **Where:** Any chat
- **Description:** Bot repeats your message
- **Example:** `/echo Hello World`

### `/buy [address]`
**Test SOL transaction**
- **Usage:** `/buy <solana_address>`
- **Where:** Any chat
- **Description:** Sends 0.01 SOL test transaction on devnet
- **Example:** `/buy EAbgG2WkZtPayBR3kPvmy1EPQCLmPUaWTPzZ74fYu9FK`
- **Response:** Transaction link to Solana Explorer

---

## 🔐 Registration & Setup

### `/start`
**Register personal account**
- **Usage:** `/start`
- **Where:** **Private DM only**
- **Description:** Creates your personal SolCircle account with custodial and main wallets
- **What it creates:**
  - Personal account record
  - Custodial wallet (platform-managed)
  - Main wallet (your control)
- **Response:** Welcome message with wallet addresses

### `/register`
**Register a group**
- **Usage:** `/register`
- **Where:** **Group chat only**
- **Description:** Registers the Telegram group for collaborative trading
- **Who can use:** Group members
- **What it creates:**
  - Group record with TGID
  - Group relay account for pooled funds
  - Admin permissions setup
- **Response:** Group ID and relay account address

---

## 🎮 Session Management

### `/create_session "[message]" [time]`
**Create a new trading session**
- **Usage:** `/create_session "proposal text" <voting_time_minutes>`
- **Where:** **Registered group only**
- **Who can use:** **Group admins only**
- **Requirements:** 
  - Must be group admin
  - Must have personal account (/start in DM first)
  - No other active session in group
- **Parameters:**
  - `message`: Session description (in quotes)
  - `time`: Optional voting time in minutes (default: 1)
- **Examples:**
  ```
  /create_session "Buy BONK token" 5
  /create_session "Invest in SOL" 10
  /create_session "DeFi trading opportunity"
  ```
- **Response:** 
  - Session created message
  - Join/Skip buttons (15 seconds to respond)
  - Participant list after 15 seconds

### `/close_session`
**Close active session**
- **Usage:** `/close_session`
- **Where:** **Group only**
- **Who can use:** **Group admins only**
- **Description:** Closes the currently active session and all open proposals
- **Response:** Session summary with participant and proposal counts

---

## 🗳️ Voting & Proposals

### `/propose "[text]" [time]`
**Create a proposal for voting**
- **Usage:** `/propose "proposal text" <voting_time_minutes>`
- **Where:** **Active session in group**
- **Who can use:** **Session participants only**
- **Requirements:**
  - Must have joined the active session
  - Session must be open
- **Parameters:**
  - `text`: Proposal description (in quotes)
  - `time`: Voting time in minutes (5-10 min max)
- **Examples:**
  ```
  /propose "Buy 100 BONK tokens" 5
  /propose "Swap 0.5 SOL to USDC" 7
  /propose "Stake in Marinade Finance" 10
  ```
- **Response:**
  - Proposal created message
  - Voting buttons (Yes/No)
  - Timer notification
  - Results after voting period

### `/vote [yes/no] [amount]`
**Vote on active proposal**
- **Usage:** `/vote <yes|no> <amount_sol>`
- **Where:** **Active proposal in group**
- **Who can use:** **Session participants only**
- **Parameters:**
  - `yes|no`: Your vote
  - `amount`: SOL amount to contribute (YES votes only, default: 0.01)
- **Examples:**
  ```
  /vote yes 0.05
  /vote yes 0.1
  /vote no
  ```
- **Voting Rules:**
  - YES votes require SOL amount
  - NO votes don't need amount
  - Can change vote before proposal closes
  - Last vote counts
- **Response:** Vote confirmation with current vote counts

---

## 📊 Status & Monitoring

### `/groupstatus`
**View group trading status**
- **Usage:** `/groupstatus`
- **Where:** **Registered group only**
- **Description:** Shows group's trading activity and order history
- **Information shown:**
  - Group ID
  - Recent orders (up to 5)
  - Order details (token, amount, status, participants)
  - Transaction links
  - Summary statistics
  - Total SOL spent
  - Completed orders count
- **Response:** Formatted HTML message with trading overview

### `/mestatus`
**View personal trading status**
- **Usage:** `/mestatus`
- **Where:** **Private DM only**
- **Description:** Shows your personal trading activity and portfolio
- **Information shown:**
  - Username and User ID
  - SolCircle balance (custodial wallet)
  - Your orders (up to 5 recent)
  - Tokens allocated per order
  - Profit/Loss per order
  - Transaction links
  - Summary statistics:
    - Total orders
    - Active positions
    - Total invested
    - Total tokens
    - Total P/L
- **Response:** Detailed HTML formatted portfolio

### `/view_order [order_id]`
**View detailed order information**
- **Usage:** `/view_order <order_id>`
- **Where:** Any chat (DM or group)
- **Parameters:**
  - `order_id`: Order identifier from /mestatus or /groupstatus
- **Example:** `/view_order order_1761379627522`
- **Information shown:**
  - Order ID and status
  - Token symbol and amount
  - Total SOL spent
  - Participant count
  - Transaction hash
  - Current price and value
  - Profit/Loss calculations
  - ROI percentage
- **Response:** Comprehensive order details with P&L
- **Tip:** Get order IDs from /mestatus or /groupstatus

---

## 📈 Analytics Commands

### `/performance [period]`
**View portfolio performance**
- **Usage:** `/performance <period>`
- **Where:** Any chat
- **Parameters:**
  - `period`: Time period (24h, 7d, 30d, 90d, 1y, all)
  - Default: 30d
- **Examples:**
  ```
  /performance 7d
  /performance 30d
  /performance 1y
  ```
- **Information shown:**
  - Current portfolio value
  - Start value for period
  - Absolute change (USD)
  - Percentage change
  - Highest value in period
  - Lowest value in period
  - Number of data points
- **Requirements:** Must have mainnet wallet configured
- **Response:** Formatted performance metrics with emoji indicators

### `/changes`
**View 24h/7d/30d portfolio changes**
- **Usage:** `/changes`
- **Where:** Any chat
- **Description:** Shows portfolio changes across multiple timeframes
- **Information shown:**
  - Current portfolio value (USD)
  - 24-hour change (% and $)
  - 7-day change (% and $)
  - 30-day change (% and $)
  - Overall trend (Bullish/Bearish/Neutral)
- **Requirements:** Mainnet wallet with assets
- **Response:** Multi-period change overview with trend analysis

### `/movers [limit]`
**View top gainers and losers**
- **Usage:** `/movers <limit>`
- **Where:** Any chat
- **Parameters:**
  - `limit`: Number of assets to show (1-10)
  - Default: 3
- **Examples:**
  ```
  /movers 5
  /movers 10
  /movers
  ```
- **Information shown:**
  - Total assets count
  - Gainers and losers count
  - Net 24h change
  - Top gainers list with:
    - Token symbol
    - 24h change percentage
    - Current value (USD)
    - Absolute gain (USD)
  - Top losers list with same metrics
- **Response:** Ranked list of best and worst performers

### `/prices`
**View all token prices**
- **Usage:** `/prices`
- **Where:** Any chat
- **Description:** Shows current prices and 24h changes for all tokens in portfolio
- **Information shown:**
  - Total tokens count
  - For each token (up to 15):
    - Symbol and blockchain
    - Current price (USD)
    - 24h price change (% and $)
    - Total value (USD)
    - Quantity held
- **Limits:** Displays first 15 tokens, notes if more exist
- **Response:** Comprehensive price list with change indicators

---

## 🏷️ Wallet Labels & Tags

### `/label [address] [label]`
**Add custom label to wallet**
- **Usage:** `/label <wallet_address> <label_text>`
- **Where:** Any chat
- **Parameters:**
  - `address`: Solana wallet address (32-44 chars)
  - `label`: Custom name for wallet
- **Examples:**
  ```
  /label EAbgG2Wk... 💼 Trading Wallet
  /label 8iTq9RQb... 💰 Savings Account
  /label FxZgTTTv... 🎮 NFT Collection
  ```
- **Tips:**
  - Use emojis for visual identification
  - Keep labels descriptive
  - Can update existing labels
- **Response:** Confirmation with shortened address

### `/tag [address] [tags]`
**Add tags to wallet**
- **Usage:** `/tag <wallet_address> <tag1,tag2,tag3>`
- **Where:** Any chat
- **Parameters:**
  - `address`: Solana wallet address
  - `tags`: Comma-separated tags (no spaces)
- **Examples:**
  ```
  /tag EAbgG2Wk... trading,active,primary
  /tag 8iTq9RQb... savings,longterm,hodl
  /tag FxZgTTTv... nft,gaming,collection
  ```
- **Common Tags:**
  - #trading, #savings, #defi, #nft
  - #active, #inactive, #testing
  - #group, #custodial, #personal
- **Response:** Confirmation with applied tags

### `/labels`
**Show all labeled wallets**
- **Usage:** `/labels`
- **Where:** Any chat
- **Description:** Lists all wallets with custom labels
- **Information shown:**
  - Total labeled wallets
  - For each wallet:
    - Label name
    - Shortened address
    - Tags (if any)
    - Note (if any)
- **Response:** Formatted list of all labels
- **Tip:** Use /wallets to see labels with live balances

### `/wallets`
**Show wallets with balances**
- **Usage:** `/wallets`
- **Where:** Any chat
- **Description:** Complete wallet overview with labels, tags, and balances
- **Information shown:**
  - Total balance across all wallets (SOL)
  - Total wallet count
  - For each wallet:
    - Label (custom or default)
    - Address (shortened)
    - Balance (SOL)
    - Network (devnet)
    - Tags
    - Notes (if custom label)
    - Type (custodial/main/group)
    - Role (for group wallets)
    - Custom label indicator (✏️)
- **Wallet Types:**
  - **Custodial:** Platform-managed wallet
  - **Main:** Your personal connected wallet
  - **Group:** Collaborative pool wallets
- **Response:** Comprehensive wallet overview with all metadata
- **Limits:** Auto-splits into multiple messages if too long

### `/unlabel [address]`
**Remove label from wallet**
- **Usage:** `/unlabel <wallet_address>`
- **Where:** Any chat
- **Parameters:**
  - `address`: Wallet address to unlabel
- **Example:** `/unlabel EAbgG2Wk...`
- **Description:** Removes custom label from specified wallet
- **Response:** Confirmation of label removal
- **Tip:** Use /labels to see which wallets are labeled

---

## 🎯 Quick Reference

### Command Categories

| Category | Commands | Count |
|----------|----------|-------|
| **Basic** | status, echo, buy | 3 |
| **Registration** | start, register | 2 |
| **Session** | create_session, close_session | 2 |
| **Voting** | propose, vote | 2 |
| **Status** | groupstatus, mestatus, view_order | 3 |
| **Analytics** | performance, changes, movers, prices | 4 |
| **Labels** | label, tag, labels, wallets, unlabel | 5 |
| **TOTAL** | | **21 commands** |

---

### Command Access Matrix

| Command | DM | Group | Admin Only | Participant Only |
|---------|----|----|------------|------------------|
| `/status` | ✅ | ✅ | ❌ | ❌ |
| `/echo` | ✅ | ✅ | ❌ | ❌ |
| `/buy` | ✅ | ✅ | ❌ | ❌ |
| `/start` | ✅ | ❌ | ❌ | ❌ |
| `/register` | ❌ | ✅ | ❌ | ❌ |
| `/create_session` | ❌ | ✅ | ✅ | ❌ |
| `/close_session` | ❌ | ✅ | ✅ | ❌ |
| `/propose` | ❌ | ✅ | ❌ | ✅ |
| `/vote` | ❌ | ✅ | ❌ | ✅ |
| `/groupstatus` | ❌ | ✅ | ❌ | ❌ |
| `/mestatus` | ✅ | ❌ | ❌ | ❌ |
| `/view_order` | ✅ | ✅ | ❌ | ❌ |
| `/performance` | ✅ | ✅ | ❌ | ❌ |
| `/changes` | ✅ | ✅ | ❌ | ❌ |
| `/movers` | ✅ | ✅ | ❌ | ❌ |
| `/prices` | ✅ | ✅ | ❌ | ❌ |
| `/label` | ✅ | ✅ | ❌ | ❌ |
| `/tag` | ✅ | ✅ | ❌ | ❌ |
| `/labels` | ✅ | ✅ | ❌ | ❌ |
| `/wallets` | ✅ | ✅ | ❌ | ❌ |
| `/unlabel` | ✅ | ✅ | ❌ | ❌ |

---

### Complete Workflow Examples

#### 🎯 **New User Setup**
```
1. In DM:
   /start                    → Create personal account

2. In Group:
   /register                 → Register the group

3. Check Setup:
   /mestatus                 → Verify your account
   /groupstatus             → Verify group registration
```

#### 💼 **Create Trading Session**
```
1. Create Session (Admin):
   /create_session "Buy BONK" 5

2. Join Session:
   Click "✅ Join" button (15s window)

3. Create Proposal (Participant):
   /propose "Buy 100 BONK tokens" 5

4. Vote (Participants):
   /vote yes 0.05
   /vote no

5. Check Results:
   /groupstatus             → Group summary
   /mestatus                → Your positions
```

#### 📊 **Monitor Portfolio**
```
1. Check Performance:
   /performance 7d          → Weekly performance
   /changes                 → Multi-period changes

2. Analyze Holdings:
   /movers 5                → Top gainers/losers
   /prices                  → All token prices

3. View Positions:
   /mestatus                → Your portfolio
   /view_order order_12345  → Specific order details
```

#### 🏷️ **Organize Wallets**
```
1. Label Wallets:
   /label EAbgG2Wk... 💼 Trading Wallet
   /label 8iTq9RQb... 💰 Savings Account

2. Add Tags:
   /tag EAbgG2Wk... trading,active,primary
   /tag 8iTq9RQb... savings,longterm,hodl

3. View Organization:
   /labels                  → All labels
   /wallets                 → Labels with balances

4. Remove Label:
   /unlabel EAbgG2Wk...
```

---

## 🚨 Common Errors & Solutions

### "⚠️ This command only works in groups"
- **Cause:** Using group-only command in DM
- **Solution:** Use command in registered group chat
- **Commands:** register, create_session, close_session, propose, vote, groupstatus

### "⚠️ This command only works in DM"
- **Cause:** Using DM-only command in group
- **Solution:** Send command to bot in private message
- **Commands:** start, mestatus

### "❌ Only group admins can create sessions"
- **Cause:** Non-admin trying to create/close session
- **Solution:** Ask group admin to run command

### "❌ You need to register first!"
- **Cause:** User account not created
- **Solution:** Send `/start` to bot in DM first

### "❌ Group not registered"
- **Cause:** Group not registered with bot
- **Solution:** Run `/register` in group

### "⚠️ A session is already running"
- **Cause:** Trying to create session while one exists
- **Solution:** Wait for current session to close or admin closes it

### "❌ No active session"
- **Cause:** Trying to propose/vote without session
- **Solution:** Admin creates session with `/create_session`

### "❌ Only participants can propose/vote"
- **Cause:** User didn't join session
- **Solution:** Click "✅ Join" button when session created

### "❌ User not found" (Analytics)
- **Cause:** No mainnet wallet configured
- **Solution:** Configure mainnet wallet in user settings

---

## 💡 Pro Tips

1. **Use Emojis in Labels:** Makes wallets visually identifiable
   - 💼 for trading, 💰 for savings, 🎮 for NFTs, 👥 for groups

2. **Tag Consistently:** Use standard tags across all wallets
   - #trading, #savings, #active, #inactive, #defi, #nft

3. **Check Status Regularly:** Monitor your positions
   - `/mestatus` for personal overview
   - `/groupstatus` for group activity

4. **Use Analytics:** Track performance across timeframes
   - `/changes` for quick overview
   - `/performance 7d` for detailed metrics
   - `/movers 10` to spot opportunities

5. **Vote Strategically:** Consider amounts carefully
   - Start small: `/vote yes 0.01`
   - Increase for conviction: `/vote yes 0.1`

6. **Label All Wallets:** Organize from the start
   - Label custodial, main, and group wallets
   - Add descriptive notes

7. **Monitor Orders:** Track individual positions
   - Get order ID from `/mestatus`
   - View details: `/view_order order_12345`

---

## 📞 Support

For issues, questions, or feature requests:
- Check command usage: Each command has help text
- Review this guide for detailed explanations
- Contact development team
- Report bugs on GitHub

---

## 🔄 Updates

**Current Version:** v1.0.0  
**Last Updated:** October 31, 2025  
**Total Commands:** 21  
**Features:** Trading, Analytics, Wallet Management

**Recent Additions:**
- ✅ Analytics commands (4)
- ✅ Wallet labels & tags (5)
- ✅ Enhanced status displays
- ✅ P&L tracking

---

## 📝 Notes

- **Networks:** Devnet for testing, Mainnet tracking via Zerion
- **Voting Time:** 5-10 minutes max for proposals
- **Session Limit:** One active session per group
- **Message Limits:** Some commands auto-split long responses
- **Address Format:** Solana addresses (32-44 characters)
- **Tags:** Lowercase, comma-separated, no spaces

---

**🎉 Happy Trading with SolCircle!**
