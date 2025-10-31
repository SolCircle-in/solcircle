# SOL Circle

> Decentralized social trading platform built on Solana with privacy-preserving dark pools

[![Solana](https://img.shields.io/badge/Solana-14F195?style=flat&logo=solana&logoColor=white)](https://solana.com)
[![Anchor](https://img.shields.io/badge/Anchor-v0.31.1-blue)](https://anchor-lang.com)
[![Arcium](https://img.shields.io/badge/Arcium-MPC-purple)](https://arcium.io)
[![Next.js](https://img.shields.io/badge/Next.js-15-black?logo=next.js)](https://nextjs.org)
[![License](https://img.shields.io/badge/license-MIT-green)](LICENSE)

SOL Circle enables collaborative trading through Telegram groups with multi-party computation (MPC) powered confidential transactions. Coordinate with your community, vote on proposals, and execute trades while preserving financial privacy .
## Demo Video

Watch the SOL Circle demo:

[![SOL Circle Demo](https://img.youtube.com/vi/QcQZ7FY7YNM/0.jpg)](https://www.youtube.com/watch?v=QcQZ7FY7YNM)

<iframe  src="https://www.youtube.com/embed/QcQZ7FY7YNM" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>
---

## Features

### Privacy-Preserving Dark Pools
- **Confidential Deposits:** Encrypt balances using Arcium MPC network
- **Hidden Amounts:** Transfer values never revealed on-chain
- **Dual-Mode Trading:** Choose between public or confidential pools
- **Zero-Knowledge Operations:** Only you can decrypt your balance

### Social Trading Coordination
- **Telegram Integration:** Native bot interface for group trading
- **Democratic Voting:** Propose and vote on trades with weighted contributions
- **Time-Limited Sessions:** Structured trading windows with admin controls
- **Role-Based Access:** Participant and admin command separation

### DeFi Integration
- **Multi-DEX Support:** Raydium and Jupiter aggregator integration
- **Best Price Routing:** Automatic price optimization across DEXs
- **Token Swaps:** Buy/sell operations via group proposals
- **Portfolio Analytics:** Track P&L, top movers, and performance metrics

### Advanced Wallet Management
- **Custom Labels:** Organize wallets with emojis and tags
- **Multi-Wallet Dashboard:** Unified view across all accounts
- **Hybrid Model:** Custodial and non-custodial wallet support
- **Real-Time Balances:** Live SOL and token balance tracking

---

## Architecture

```
┌─────────────────┐
│  Telegram Bot   │ ◄──── User interactions via group chat
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Backend API    │ ◄──── Express server + PostgreSQL + Redis
│  (Node.js)      │
└────────┬────────┘
         │
         ├──────────────┬─────────────────┐
         ▼              ▼                 ▼
┌─────────────┐  ┌──────────────┐  ┌─────────────┐
│   Solana    │  │   Arcium     │  │  Frontend   │
│  On-Chain   │  │  MPC Network │  │  Dashboard  │
│  Program    │  │  (Private)   │  │  (Next.js)  │
└─────────────┘  └──────────────┘  └─────────────┘
```

### Technology Stack

| Layer | Technologies |
|-------|-------------|
| **Smart Contracts** | Anchor Framework, Arcium MPC, Rust |
| **Backend** | Node.js, Express, Telegraf, PostgreSQL, Redis |
| **Frontend** | Next.js 15, React 19, TypeScript, Tailwind CSS |
| **Blockchain** | Solana Web3.js, Raydium SDK, Jupiter Aggregator |
| **Infrastructure** | Docker-ready, RESTful API, WebSocket support |

---

## Getting Started

### Prerequisites

```bash
# Install Solana CLI
curl -sSfL https://release.solana.com/stable/install | sh

# Install Anchor CLI (v0.31.1)
cargo install --git https://github.com/coral-xyz/anchor --tag v0.31.1 anchor-cli

# Install Node.js 18+
nvm install 18

# Install PostgreSQL
brew install postgresql  # macOS
sudo apt-get install postgresql  # Ubuntu

# Install Redis
brew install redis  # macOS
sudo apt-get install redis-server  # Ubuntu
```

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/solcircle.git
   cd solcircle
   ```

2. **Setup Smart Contracts**
   ```bash
   cd contract
   anchor build
   arcium build
   anchor deploy --provider.cluster devnet
   ```

3. **Setup Backend**
   ```bash
   cd backend
   npm install

   # Configure environment variables
   cp .env.template .env
   # Edit .env with your credentials

   # Start services
   npm run server  # API server
   npm run bot     # Telegram bot
   ```

4. **Setup Frontend**
   ```bash
   cd frontend
   npm install

   # Configure environment
   echo "NEXT_PUBLIC_REGISTRATION_API_URL=http://localhost:3001/api" > .env.local

   # Start development server
   npm run dev
   ```

### Configuration

#### Backend Environment Variables

Create `backend/.env` from the template:

```bash
# Telegram
BOT_TOKEN=your_telegram_bot_token
WEBHOOK_URL_BASE=https://your-domain.com

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/solcircle

# Security
ENCRYPTION_MASTER_PASSWORD=your_secure_master_password

# API Keys
SANCTUM_API_KEY=your_sanctum_key

# Endpoints
BACKEND_BASE=http://localhost:3001
```

#### Frontend Environment Variables

Create `frontend/.env.local`:

```bash
NEXT_PUBLIC_REGISTRATION_API_URL=http://localhost:3001/api
```

---

## Usage

### Telegram Bot Commands

#### Admin Commands
```
/start - Initialize the bot
/register_group - Register group for trading
/create_session <description> <duration_min> - Start trading session
/end_session - End current session
/close_proposal - Close active proposal
/set_slippage <percentage> - Set slippage tolerance
```

#### Participant Commands
```
/join_session - Join active trading session
/skip_session - Skip current session
/propose <description> <duration_min> - Create trading proposal
/vote yes <amount_sol> - Vote yes with contribution
/vote no - Vote against proposal
/check_balance - View custodial wallet balance
/view_order_history - See past orders
/view_proposal_history - See past proposals
```

#### Wallet Management
```
/add_wallet_label <address> <label> <tags> - Label a wallet
/list_wallet_labels - View all wallet labels
/update_wallet_label <address> <new_label> - Update label
/remove_wallet_label <address> - Remove label
```

### Example Trading Flow

1. **Admin creates session**
   ```
   /create_session "Trade BONK token" 10
   ```

2. **Members join** (15s window)
   ```
   Click [Join] button or /join_session
   ```

3. **Participant creates proposal**
   ```
   /propose "Buy 1000 BONK at current price" 5
   ```

4. **Members vote**
   ```
   /vote yes 0.1  # Contribute 0.1 SOL
   /vote no       # Vote against
   ```

5. **Automatic execution** (if approved)
   - Votes tallied after duration expires
   - If majority approves, trade executes on Raydium/Jupiter
   - Tokens distributed to participants proportionally

### Web Dashboard

Access the dashboard at `http://localhost:3000`:

- **Portfolio View:** Real-time balance tracking across timeframes
- **Order History:** View executed trades and positions
- **Proposal History:** Track all voting activity
- **Wallet Management:** Add/withdraw funds, manage custodial wallets

---

## Project Structure

```
solcircle/
├── contract/               # Solana smart contracts
│   ├── programs/
│   │   └── solcircle_arcium/   # Main Anchor program (1,380 lines)
│   ├── encrypted-ixs/          # Arcium MPC circuits
│   ├── tests/                  # Contract tests
│   └── Anchor.toml             # Anchor configuration
│
├── backend/                # Node.js backend
│   ├── bot.js              # Telegram bot (2,354 lines)
│   ├── server.js           # Express API server
│   ├── routes/             # API endpoints (14 files)
│   ├── db/                 # Database layer
│   ├── utils/              # Helpers (Redis, encryption)
│   └── doc/                # Documentation (10+ guides)
│
├── frontend/               # Next.js web app
│   ├── app/                # Pages and layouts
│   │   ├── dashboard/      # User dashboard
│   │   ├── register/       # Registration flow
│   │   └── login/          # Authentication
│   ├── components/         # React components
│   │   └── ui/             # Shadcn UI components
│   └── lib/                # Utilities and helpers
│
└── README.md               # This file
```

---

## API Documentation

### REST Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/groups` | GET/POST | Manage trading groups |
| `/api/users` | GET/POST | User account management |
| `/api/sessions` | GET/POST | Trading session CRUD |
| `/api/proposals` | GET/POST | Proposal management |
| `/api/votes` | GET/POST | Vote tracking |
| `/api/orders` | GET/POST | Order history |
| `/api/positions` | GET | Portfolio positions |
| `/api/wallet-labels` | GET/POST/PUT/DELETE | Wallet organization |
| `/api/sanctum` | GET | Sanctum Gateway integration |
| `/api/zerion` | GET | Zerion portfolio data |

See [backend/doc/](backend/doc/) for detailed API documentation.

---

## Security

### Smart Contract Security
- **Oracle-Controlled Releases:** Trusted oracle signatures required for fund movements
- **PDA Isolation:** Program-Derived Addresses prevent unauthorized vault access
- **Access Control:** Role-based permissions enforced on-chain

### MPC Privacy
- **Arcium Network:** Assumes <50% Byzantine nodes for security
- **Client-Side Encryption:** User encrypts amounts before submission
- **Zero-Knowledge State:** Encrypted balances never revealed on-chain

### Backend Security
- **Wallet Encryption:** Master password-based encryption for custodial keys
- **Session Management:** Redis-backed secure sessions
- **Input Validation:** All user inputs sanitized

### Audit Status
**Not audited** - This is experimental software. Use at your own risk.

---

## Development

### Run Tests

```bash
# Smart contract tests
cd contract
anchor test

# Backend tests
cd backend
npm test

# Frontend tests
cd frontend
npm test
```

### Build for Production

```bash
# Smart contracts
cd contract
anchor build --verifiable

# Backend
cd backend
npm run build

# Frontend
cd frontend
npm run build
```

### Database Setup

```bash
cd backend
createdb solcircle
psql solcircle < schema.sql
```

---

## Contributing

Contributions are welcome! Please follow these guidelines:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Code Style
- **Rust:** Follow [Rust API Guidelines](https://rust-lang.github.io/api-guidelines/)
- **JavaScript:** ESLint with Airbnb config
- **TypeScript:** Strict mode enabled

---

## Roadmap

- [ ] Multi-signature wallet support
- [ ] Advanced order types (limit, stop-loss)
- [ ] Perpetual futures integration
- [ ] Mobile app (React Native)
- [ ] Governance token ($CIRCLE)
- [ ] DAO treasury management
- [ ] Cross-chain bridges
- [ ] Advanced charting and analytics

---

## Documentation

Comprehensive guides available in [backend/doc/](backend/doc/):

- **Getting Started:** Setup and deployment guides
- **Telegram Bot Usage:** Complete command reference
- **API Reference:** Endpoint specifications
- **Smart Contract Docs:** On-chain program architecture
- **MPC Integration:** Arcium confidential computing guide
- **Wallet Management:** Custodial and non-custodial flows

---

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## Acknowledgments

- [Solana Foundation](https://solana.org) - Blockchain infrastructure
- [Arcium](https://arcium.io) - MPC confidential computing
- [Anchor](https://anchor-lang.com) - Smart contract framework
- [Raydium](https://raydium.io) - DEX liquidity
- [Jupiter](https://jup.ag) - Aggregator routing
- [Telegraf](https://telegraf.js.org) - Telegram bot framework

---

## Contact

- **Website:** [https://solcircle.io](https://www.solcircle.tech/)
- **Twitter:** [@solcircle](https://x.com/SolCircle_IN)
- **Telegram:** [Join our community](https://t.me/+gnnB7kVEDoVlYTZl)
- **Email:** eshandas2002@gmail.com

---

## Disclaimer

This software is experimental and provided "as is" without warranty. Trading cryptocurrencies involves risk. The confidential pool feature relies on Arcium's MPC network security assumptions. Always do your own research and trade responsibly.

**Not financial advice.** This tool is for educational and experimental purposes only.
