# Zerion Integration Deep Dive

This document explains exactly how the Zerion integration is implemented in this repository, how it interacts with our stack, and why it’s important for SolCircle. It complements the endpoint-focused guides in `doc/ZERION_API_GUIDE.md`, `doc/ZERION_QUICK_REF.md`, and `doc/ZERION_TRANSACTIONS_GUIDE.md` by covering architecture, data flow, contracts, and operational concerns.

## Why Zerion matters for SolCircle

- Unified, multi-chain portfolio: One API gives us holdings, NFTs, DeFi positions, and transactions across 40+ chains without maintaining our own indexers.
- Real-time valuations: Consistent USD pricing and historical charts power portfolio, PnL, and analytics features.
- Faster feature velocity: We can ship portfolio dashboards, analytics, and bot commands without building a custom on-chain data pipeline.
- Consistent data model: Zerion’s schema is stable and well-documented, reducing edge-case handling per chain.

## High-level architecture

- Route mount: The Zerion router is mounted at `/api/zerion` in `server.js`.
  - See: `server.js` → `app.use("/api/zerion", zerionRouter);`
- Implementation file: `routes/zerion.js`
- Core helper: `zerionRequest(endpoint, params)` wraps Axios GET with:
  - Basic auth header built from `ZERION_API_KEY`
  - `Content-Type: application/json`
  - 10s timeout
  - Consistent error normalization
- User resolution: For all user-centric endpoints, we resolve an identifier to a wallet via our DB:
  - `SELECT main_pkey, username FROM users WHERE utgid = $1 OR username = $1`
  - `main_pkey` is the main wallet address used with Zerion
- Response mapping: We translate Zerion responses to a stable, frontend-friendly schema (symbols, names, logos, USD values, percentages, chain IDs), adding computed fields where helpful (totals, percentages, rankings, pagination cursors).

### Request flow (conceptual)

1) Client calls `/api/zerion/...`
2) Router looks up user wallet from DB by `utgid` or `username`
3) Router builds Zerion params (currency, filters, pagination)
4) `zerionRequest()` calls Zerion REST
5) Response is normalized and enriched (sorting, totals, percentages)
6) API returns a consistent JSON payload (with `success: true/false`)

## Environment & configuration

- `.env` variable required: `ZERION_API_KEY`
- If missing, the health endpoint returns `configured: false`, and all Zerion calls will error with a clear message.
- No devnet/testnet data: Zerion indexes mainnets and selected L2s. Your devnet flows remain separate and unaffected.

## Authentication to Zerion

- We use HTTP Basic Auth: `Authorization: Basic base64(ZERION_API_KEY + ":")`
- Axios is used for all HTTP calls (`axios.get`)
- Timeout is set to 10 seconds to fail fast and keep API latency bounded

## Error handling model

- Input validation errors (e.g., user not found) return 404
- External dependency failures (Zerion outage, invalid key) surface as 500 (or 503 for health) with normalized messages:
  - `Zerion API Error: <status> - <title>` when Zerion returns an error
  - `Zerion Request Error: <message>` for network/timeouts
- Health endpoint uses 503 for misconfiguration or connectivity issues

## Endpoint catalog (what’s included)

Core portfolio & assets
- GET `/api/zerion/health` — configuration + connectivity check
- GET `/api/zerion/chains` — supported chain list (id, name, icon, explorer)
- GET `/api/zerion/tokens/:identifier` — simple positions (with `chain`, `minValue` filters) with USD pricing
- GET `/api/zerion/portfolio/:identifier` — totals, chain grouping, top assets
- GET `/api/zerion/nfts/:identifier` — NFTs, collections, floor pricing, images
- GET `/api/zerion/allocation/:identifier` — allocation by asset and by chain
- GET `/api/zerion/token-info/:tokenAddress` — token metadata (symbol, logo, decimals, price, market cap)

DeFi
- GET `/api/zerion/staking/:identifier` — staked positions with APY and reward estimates
- GET `/api/zerion/liquidity-pools/:identifier` — pool positions (LP tokens, protocols, estimated APY)
- GET `/api/zerion/defi-positions/:identifier` — combined DeFi view (staking, LP, lending, borrowing, other)

Transactions & analytics
- GET `/api/zerion/transactions/:identifier` — cross-chain tx history, categorized, paginated
- GET `/api/zerion/transaction/:identifier/:hash` — single transaction detail
- GET `/api/zerion/transaction-stats/:identifier` — volume, fees, category/chain breakdown
- GET `/api/zerion/analytics/portfolio-performance/:identifier?period=30d` — historical chart + performance stats
- GET `/api/zerion/analytics/portfolio-changes/:identifier` — 24h/7d/30d change snapshots
- GET `/api/zerion/analytics/token-prices/:identifier` — price and value changes for current holdings
- GET `/api/zerion/analytics/performance-ranking/:identifier?limit=5` — best/worst performers

See endpoint-focused examples in:
- `doc/ZERION_API_GUIDE.md` (portfolio & assets)
- `doc/ZERION_TRANSACTIONS_GUIDE.md` (transactions)
- `doc/ZERION_QUICK_REF.md` (quick reference)

## Data contracts (inputs/outputs)

Identifiers
- `:identifier` resolves to a user via `utgid` or `username`
- On success, responses include `data.user = { username, wallet }`

Common query params
- `chain` — filter by Zerion chain id (e.g., `ethereum`, `polygon`, `solana`)
- Pagination — when supported, uses Zerion’s `page[size]`, `page[after]` translated to `limit` and `page` query params

Token lists (`/tokens`)
- Each item: `{ symbol, name, quantity, value_usd, price_usd, chain, logo, address, decimals, change_24h }`
- Sorted by `value_usd` descending; `minValue` filters small positions

Portfolio (`/portfolio`)
- Totals: `total_value_usd`, `total_positions`
- Chain groups: `{ name, count, value, percentage }`
- Top assets: `{ symbol, name, value, logo, percentage }`

NFTs (`/nfts`)
- Items: `{ name, collection, description, image, floor_price_usd, chain, token_id, contract_address }`
- Collections aggregated: `{ name, count, floor_value, chain }`

Allocation (`/allocation`)
- Asset allocation: `{ symbol, name, value, percentage, logo, chain }`
- Chain allocation: `{ chain, value, percentage }`

DeFi (`/staking`, `/liquidity-pools`, `/defi-positions`)
- Items: `{ protocol, chain, asset{...}, apy, value_usd, annual_rewards/yield }`
- Categories (combined): staking, liquidity_pools, lending, borrowing, other

Transactions (`/transactions`, `/transaction`, `/transaction-stats`)
- History items: `{ hash, category, operation_type, status, timestamp, block_number, chain, total_value_usd, transfers[], fee{}, from, to }`
- Transfers include fungible or NFT detail and direction, with USD values at time of tx
- Stats include category counts, per-chain counts, total fees and volume, and date range

Analytics (`/analytics/*`)
- Portfolio performance includes `points` mapped to `{ timestamp, value, date }` with change metrics
- Changes provide snapshots and trend (up/down/neutral)
- Token prices list 24h price/value changes and sort by impact

## Mapping Zerion endpoints we use

- `/chains/`
- `/wallets/{address}/positions/`
- `/wallets/{address}/nft-positions/`
- `/wallets/{address}/transactions/` and `/wallets/{address}/transactions/{hash}`
- `/wallets/{address}/portfolio`
- `/wallets/{address}/charts/portfolio?period=<24h|7d|30d|...>`
- `/fungibles/{tokenAddress}?filter[chain_ids]=<chain>`

## Performance, pagination, and rate limits

- Pagination: Transaction history exposes Zerion’s `next` cursor via `data.pagination.next_page`
- Timeouts: 10s per Zerion request to prevent API hangs
- Rate limits (dev tier): ~120 req/min, ~5k req/day (subject to Zerion plan)
- Recommendations:
  - Add short-lived caching (e.g., 1–5 min) for portfolio/positions endpoints
  - Avoid N+1 patterns from the client; aggregate views on the server
  - Debounce or batch requests in the UI

## Security & compliance

- Secrets: `ZERION_API_KEY` lives in `.env`; do not log it
- The request logger in `server.js` logs only method/path, not headers
- Prefer read-only access for Zerion keys; rotate credentials periodically
- Consider adding IP allowlisting or proxying for additional control in production

## Edge cases & resilience

- Empty wallets: Endpoints return `token_count: 0`, `total_value_usd: "0.00"`, or empty arrays — callers should handle empty states gracefully
- Missing metadata: We provide fallbacks like `symbol: "UNKNOWN"`, `name: "Unknown Token"`
- Unsupported chains: Use `/api/zerion/chains` to power chain selectors and avoid invalid filters
- Outages/timeouts: Errors are normalized; clients should show a non-blocking error state and allow retry
- Data staleness: Prices are near real-time but not guaranteed exact at every ms; do not use for settlement

## Testability checklist

- Verify `GET /api/zerion/health` returns `success: true`
- Test a known user with a populated `main_pkey`
- Exercise key features: tokens, portfolio, NFTs, allocation, transactions, analytics
- Confirm pagination works on transactions (check `pagination.next_page`)

## Implementation notes (per endpoint family)

- Positions and portfolio
  - We request `currency=usd`, `filter[positions]=only_simple`, `filter[trash]=only_non_trash` for clean holdings
  - We compute totals and percentages server-side for stable UI contracts

- NFTs
  - We request preview/detail image URLs when available and compute collection-level floor sums

- DeFi
  - We categorize positions by Zerion’s `position_type` and known protocol heuristics (e.g., LP detection by name/symbol)
  - Reward/APY figures are best-effort estimates based on available fields

- Transactions
  - We categorize transactions by `operation_type` heuristics (swap, approval, deposit, withdrawal, mint, burn, transfer)
  - We unify token/NFT transfer representations and include USD fee/value fields for consistency

- Analytics
  - Performance endpoints aggregate chart points and compute absolute and percent changes
  - Ranking uses 24h relative price changes multiplied by position value for impact

## Operational tips

- Add caching (Redis) for: positions, portfolio, allocation, analytics charts
- Add circuit breakers or retries for transient upstream errors
- Set up metrics: call counts, error rates, latency per endpoint
- UI: handle empty states and partial data; display last-updated timestamps

## Related documents

- `doc/ZERION_API_GUIDE.md` — Full endpoint examples for portfolio & assets
- `doc/ZERION_TRANSACTIONS_GUIDE.md` — Transaction history, details, stats
- `doc/ZERION_QUICK_REF.md` — Cheat sheet of endpoints and patterns

## Next steps (recommended)

- Introduce Redis caching with short TTLs to reduce API cost and latency
- Add rate limiting/throttling per user to protect Zerion quota
- Implement retries with exponential backoff for `429` and transient `5xx`
- Expand LP protocol detection heuristics (Curve/Uniswap/Raydium/Orca/etc.)
- Add unit tests for transformation logic (categorization, allocation, rankings)
