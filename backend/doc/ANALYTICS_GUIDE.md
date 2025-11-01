# 📊 Portfolio Analytics Guide

## Overview

The Analytics module provides comprehensive portfolio performance tracking, including historical charts, percentage changes over multiple time periods, token price movements, and asset performance rankings.

---

## Features Implemented

### ✅ 1. Historical Portfolio Performance (Charts)
Track your portfolio value over time with interactive chart data

### ✅ 2. Multi-Period Portfolio Changes (24h/7d/30d)
See how your portfolio has changed across different time frames

### ✅ 3. Token Price Changes
Monitor price movements of all tokens in your portfolio

### ✅ 4. Best/Worst Performing Assets
Identify your top gainers and losers

---

## API Endpoints

### 1. Portfolio Performance Over Time

**Endpoint:** `GET /api/zerion/analytics/portfolio-performance/:identifier`

**Description:** Returns historical portfolio values with chart data for visualization

**Query Parameters:**
- `period` - Time period: `24h`, `7d`, `30d`, `90d`, `1y`, `all` (default: `30d`)

**Example:**
```bash
# Get 30-day portfolio performance
curl "http://localhost:8000/api/zerion/analytics/portfolio-performance/alice123?period=30d"

# Get 1-year performance
curl "http://localhost:8000/api/zerion/analytics/portfolio-performance/alice123?period=1y"
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
    "period": "30d",
    "performance": {
      "current_value_usd": "15420.50",
      "start_value_usd": "14200.00",
      "absolute_change_usd": "1220.50",
      "percent_change": "8.60%",
      "highest_value_usd": "15850.00",
      "lowest_value_usd": "13900.00",
      "data_points": 720
    },
    "chart": [
      {
        "timestamp": 1698710400,
        "value": "14200.00",
        "date": "2023-10-31T00:00:00.000Z"
      },
      {
        "timestamp": 1698714000,
        "value": "14205.25",
        "date": "2023-10-31T01:00:00.000Z"
      }
      // ... more data points
    ]
  }
}
```

**Use Cases:**
- Display portfolio performance charts
- Calculate ROI over different periods
- Identify best/worst performing time periods
- Track portfolio growth trends

---

### 2. Portfolio Changes (24h/7d/30d)

**Endpoint:** `GET /api/zerion/analytics/portfolio-changes/:identifier`

**Description:** Returns portfolio value changes across multiple time periods for quick overview

**Example:**
```bash
curl "http://localhost:8000/api/zerion/analytics/portfolio-changes/alice123"
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
    "current_portfolio_value_usd": "15420.50",
    "changes": {
      "24h": {
        "start_value_usd": "15200.00",
        "end_value_usd": "15420.50",
        "absolute_change_usd": "220.50",
        "percent_change": "1.45%",
        "is_positive": true
      },
      "7d": {
        "start_value_usd": "14800.00",
        "end_value_usd": "15420.50",
        "absolute_change_usd": "620.50",
        "percent_change": "4.19%",
        "is_positive": true
      },
      "30d": {
        "start_value_usd": "14200.00",
        "end_value_usd": "15420.50",
        "absolute_change_usd": "1220.50",
        "percent_change": "8.60%",
        "is_positive": true
      }
    },
    "summary": {
      "trending": "up"
    }
  }
}
```

**Trending Values:**
- `up` - Portfolio gained value in last 24h
- `down` - Portfolio lost value in last 24h
- `neutral` - No significant change

**Use Cases:**
- Dashboard summary cards
- Quick portfolio health check
- Performance badges (🟢 up, 🔴 down)
- Alert notifications for significant changes

---

### 3. Token Price Changes

**Endpoint:** `GET /api/zerion/analytics/token-prices/:identifier`

**Description:** Returns 24h price changes for all tokens in portfolio

**Example:**
```bash
curl "http://localhost:8000/api/zerion/analytics/token-prices/alice123"
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
    "total_tokens": 12,
    "tokens": [
      {
        "symbol": "ETH",
        "name": "Ethereum",
        "chain": "ethereum",
        "quantity": "5.2340",
        "current_price_usd": "1881.5000",
        "price_change_24h": "2.50%",
        "value_usd": "9850.20",
        "value_change_24h_usd": "240.50",
        "is_price_up": true,
        "logo": "https://cdn.zerion.io/eth.png"
      },
      {
        "symbol": "MATIC",
        "name": "Polygon",
        "chain": "polygon",
        "quantity": "5000.0000",
        "current_price_usd": "0.8500",
        "price_change_24h": "-1.20%",
        "value_usd": "4250.00",
        "value_change_24h_usd": "-51.60",
        "is_price_up": false,
        "logo": "https://cdn.zerion.io/matic.png"
      }
      // ... more tokens
    ]
  }
}
```

**Tokens are sorted by:** Absolute price change (biggest movers first)

**Use Cases:**
- Token watchlist with live prices
- Price alert triggers
- Token comparison table
- Portfolio rebalancing decisions

---

### 4. Best & Worst Performing Assets

**Endpoint:** `GET /api/zerion/analytics/performance-ranking/:identifier`

**Description:** Returns top gainers and losers in portfolio by 24h performance

**Query Parameters:**
- `limit` - Number of assets to return for each category (default: `5`)

**Example:**
```bash
# Get top 5 best and worst performers
curl "http://localhost:8000/api/zerion/analytics/performance-ranking/alice123"

# Get top 10
curl "http://localhost:8000/api/zerion/analytics/performance-ranking/alice123?limit=10"
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
    "summary": {
      "total_assets": 12,
      "gainers": 7,
      "losers": 4,
      "neutral": 1,
      "total_gains_24h_usd": "450.80",
      "total_losses_24h_usd": "-125.30",
      "net_change_24h_usd": "325.50"
    },
    "best_performers": [
      {
        "symbol": "LINK",
        "name": "Chainlink",
        "chain": "ethereum",
        "value_usd": "1200.00",
        "change_24h": "15.50%",
        "gain_24h_usd": "162.00",
        "logo": "https://cdn.zerion.io/link.png"
      },
      {
        "symbol": "AVAX",
        "name": "Avalanche",
        "chain": "avalanche",
        "value_usd": "800.00",
        "change_24h": "12.30%",
        "gain_24h_usd": "88.00",
        "logo": "https://cdn.zerion.io/avax.png"
      }
      // ... up to 'limit' tokens
    ],
    "worst_performers": [
      {
        "symbol": "UNI",
        "name": "Uniswap",
        "chain": "ethereum",
        "value_usd": "600.00",
        "change_24h": "-8.50%",
        "loss_24h_usd": "-55.80",
        "logo": "https://cdn.zerion.io/uni.png"
      }
      // ... up to 'limit' tokens
    ]
  }
}
```

**Use Cases:**
- Performance leaderboard
- Highlight top movers in UI
- Profit/loss summary
- Portfolio optimization insights

---

## Frontend Integration Examples

### 1. Portfolio Performance Chart

```javascript
// Fetch performance data
const response = await fetch(
  '/api/zerion/analytics/portfolio-performance/username?period=30d'
);
const { data } = await response.json();

// Use with Chart.js or similar
const chartData = {
  labels: data.chart.map(point => new Date(point.date).toLocaleDateString()),
  datasets: [{
    label: 'Portfolio Value (USD)',
    data: data.chart.map(point => parseFloat(point.value)),
    borderColor: 'rgb(75, 192, 192)',
    tension: 0.1
  }]
};

// Display performance metrics
<div className="performance-summary">
  <h3>30-Day Performance</h3>
  <p>Current Value: ${data.performance.current_value_usd}</p>
  <p>Change: ${data.performance.absolute_change_usd} ({data.performance.percent_change})</p>
  <p>High: ${data.performance.highest_value_usd}</p>
  <p>Low: ${data.performance.lowest_value_usd}</p>
</div>
```

### 2. Multi-Period Changes Dashboard

```javascript
const response = await fetch('/api/zerion/analytics/portfolio-changes/username');
const { data } = await response.json();

// Display change cards
<div className="changes-grid">
  <ChangeCard 
    period="24h"
    change={data.changes['24h'].percent_change}
    value={data.changes['24h'].absolute_change_usd}
    isPositive={data.changes['24h'].is_positive}
  />
  <ChangeCard 
    period="7d"
    change={data.changes['7d'].percent_change}
    value={data.changes['7d'].absolute_change_usd}
    isPositive={data.changes['7d'].is_positive}
  />
  <ChangeCard 
    period="30d"
    change={data.changes['30d'].percent_change}
    value={data.changes['30d'].absolute_change_usd}
    isPositive={data.changes['30d'].is_positive}
  />
</div>

// Trending indicator
<TrendingBadge trend={data.summary.trending} />
```

### 3. Token Prices Table

```javascript
const response = await fetch('/api/zerion/analytics/token-prices/username');
const { data } = await response.json();

// Render token table
<table>
  <thead>
    <tr>
      <th>Token</th>
      <th>Price</th>
      <th>24h Change</th>
      <th>Value</th>
    </tr>
  </thead>
  <tbody>
    {data.tokens.map(token => (
      <tr key={token.symbol}>
        <td>
          <img src={token.logo} alt={token.symbol} />
          {token.symbol}
        </td>
        <td>${token.current_price_usd}</td>
        <td className={token.is_price_up ? 'positive' : 'negative'}>
          {token.price_change_24h}
        </td>
        <td>${token.value_usd}</td>
      </tr>
    ))}
  </tbody>
</table>
```

### 4. Performance Leaderboard

```javascript
const response = await fetch('/api/zerion/analytics/performance-ranking/username?limit=5');
const { data } = await response.json();

// Display best performers
<div className="best-performers">
  <h3>🏆 Top Gainers (24h)</h3>
  {data.best_performers.map(asset => (
    <div key={asset.symbol} className="performer-card">
      <img src={asset.logo} alt={asset.symbol} />
      <div>
        <strong>{asset.symbol}</strong>
        <span className="positive">{asset.change_24h}</span>
        <span>+${asset.gain_24h_usd}</span>
      </div>
    </div>
  ))}
</div>

// Display worst performers
<div className="worst-performers">
  <h3>📉 Top Losers (24h)</h3>
  {data.worst_performers.map(asset => (
    <div key={asset.symbol} className="performer-card">
      <img src={asset.logo} alt={asset.symbol} />
      <div>
        <strong>{asset.symbol}</strong>
        <span className="negative">{asset.change_24h}</span>
        <span>${asset.loss_24h_usd}</span>
      </div>
    </div>
  ))}
</div>

// Summary
<div className="summary">
  <p>Net Change: ${data.summary.net_change_24h_usd}</p>
  <p>Gainers: {data.summary.gainers} | Losers: {data.summary.losers}</p>
</div>
```

---

## Telegram Bot Integration

### Portfolio Performance Command

```javascript
bot.command('performance', async (ctx) => {
  const username = ctx.from.username;
  const period = ctx.message.text.split(' ')[1] || '30d';
  
  try {
    const res = await axios.get(
      `http://localhost:8000/api/zerion/analytics/portfolio-performance/${username}?period=${period}`
    );
    const data = res.data.data;
    
    const message = `
📊 Portfolio Performance (${data.period})

💰 Current Value: $${data.performance.current_value_usd}
📈 Change: ${data.performance.absolute_change_usd} (${data.performance.percent_change})
🔝 High: $${data.performance.highest_value_usd}
🔻 Low: $${data.performance.lowest_value_usd}

${data.performance.percent_change.includes('-') ? '🔴' : '🟢'} ${Math.abs(parseFloat(data.performance.percent_change))}% ${data.performance.percent_change.includes('-') ? 'loss' : 'gain'}
    `;
    
    await ctx.reply(message);
  } catch (error) {
    await ctx.reply(`❌ Error: ${error.message}`);
  }
});
```

### Portfolio Changes Command

```javascript
bot.command('changes', async (ctx) => {
  const username = ctx.from.username;
  
  try {
    const res = await axios.get(
      `http://localhost:8000/api/zerion/analytics/portfolio-changes/${username}`
    );
    const data = res.data.data;
    
    const format = (change) => {
      if (change.error) return '❌ N/A';
      const icon = change.is_positive ? '🟢' : '🔴';
      return `${icon} ${change.percent_change} ($${change.absolute_change_usd})`;
    };
    
    const message = `
📊 Portfolio Changes

💰 Current: $${data.current_portfolio_value_usd}

⏰ 24 Hours: ${format(data.changes['24h'])}
📅 7 Days: ${format(data.changes['7d'])}
📆 30 Days: ${format(data.changes['30d'])}

Trend: ${data.summary.trending === 'up' ? '📈 Bullish' : data.summary.trending === 'down' ? '📉 Bearish' : '➡️ Neutral'}
    `;
    
    await ctx.reply(message);
  } catch (error) {
    await ctx.reply(`❌ Error: ${error.message}`);
  }
});
```

### Best/Worst Performers Command

```javascript
bot.command('movers', async (ctx) => {
  const username = ctx.from.username;
  
  try {
    const res = await axios.get(
      `http://localhost:8000/api/zerion/analytics/performance-ranking/${username}?limit=3`
    );
    const data = res.data.data;
    
    let message = `
📊 Top Movers (24h)

Net Change: $${data.summary.net_change_24h_usd}

🏆 TOP GAINERS:
`;
    
    data.best_performers.forEach((asset, i) => {
      message += `${i + 1}. ${asset.symbol}: ${asset.change_24h} (+$${asset.gain_24h_usd})\n`;
    });
    
    message += `\n📉 TOP LOSERS:\n`;
    
    data.worst_performers.forEach((asset, i) => {
      message += `${i + 1}. ${asset.symbol}: ${asset.change_24h} ($${asset.loss_24h_usd})\n`;
    });
    
    await ctx.reply(message);
  } catch (error) {
    await ctx.reply(`❌ Error: ${error.message}`);
  }
});
```

---

## Dashboard Layout Suggestions

### Analytics Page Layout

```
┌─────────────────────────────────────────────────────┐
│  📊 Portfolio Analytics                              │
├─────────────────────────────────────────────────────┤
│                                                      │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐   │
│  │ 24h Change │  │  7d Change │  │ 30d Change │   │
│  │   +2.5%    │  │   +5.8%    │  │  +12.3%    │   │
│  │  $250.50   │  │  $580.20   │  │ $1,200.00  │   │
│  └────────────┘  └────────────┘  └────────────┘   │
│                                                      │
│  ┌──────────────────────────────────────────────┐  │
│  │     Portfolio Value Over Time (30 Days)      │  │
│  │                                               │  │
│  │         [Line Chart Here]                     │  │
│  │                                               │  │
│  └──────────────────────────────────────────────┘  │
│                                                      │
│  ┌─────────────────────┐  ┌─────────────────────┐ │
│  │  🏆 Top Gainers     │  │  📉 Top Losers      │ │
│  │  1. LINK +15.5%     │  │  1. UNI -8.5%       │ │
│  │  2. AVAX +12.3%     │  │  2. COMP -6.2%      │ │
│  │  3. SOL  +10.8%     │  │  3. AAVE -5.1%      │ │
│  └─────────────────────┘  └─────────────────────┘ │
│                                                      │
│  ┌──────────────────────────────────────────────┐  │
│  │     All Token Prices & Changes               │  │
│  │  [Sortable Table]                            │  │
│  └──────────────────────────────────────────────┘  │
│                                                      │
└─────────────────────────────────────────────────────┘
```

---

## Performance Considerations

### Response Times
- Portfolio performance: ~2-3 seconds (chart data intensive)
- Portfolio changes: ~3-4 seconds (3 API calls in parallel)
- Token prices: ~1 second (single API call)
- Performance ranking: ~1 second (single API call)

### Optimization Tips

1. **Cache Chart Data**: Cache portfolio performance data for 5-15 minutes
```javascript
// Example with Redis
const cacheKey = `portfolio_performance_${username}_${period}`;
const cached = await redis.get(cacheKey);
if (cached) return JSON.parse(cached);

// Fetch and cache
const data = await fetchPerformance();
await redis.setex(cacheKey, 300, JSON.stringify(data)); // 5 min cache
```

2. **Lazy Load Charts**: Load chart data only when analytics page is opened

3. **Background Updates**: Update analytics data in background every 15 minutes

4. **Pagination**: For large portfolios, paginate token price lists

---

## Error Handling

### Empty Portfolio
```json
{
  "success": true,
  "data": {
    "total_tokens": 0,
    "tokens": [],
    "message": "No tokens found in portfolio"
  }
}
```

### Insufficient Historical Data
```json
{
  "changes": {
    "30d": {
      "error": "Data unavailable"
    }
  }
}
```

### API Rate Limiting
```json
{
  "success": false,
  "error": "Rate limit exceeded. Please try again later."
}
```

---

## Security & Privacy

- ✅ User data filtered by utgid/username
- ✅ Read-only Zerion API access
- ✅ No portfolio modification capabilities
- ✅ Wallet addresses not exposed to other users
- ⚠️ Implement authentication before production
- ⚠️ Add rate limiting per user

---

## Testing

### Test with Sample User
```bash
# Set up test user with mainnet wallet
curl -X POST http://localhost:8000/api/users \
  -H "Content-Type: application/json" \
  -d '{
    "utgid": "test123",
    "username": "testuser",
    "main_pkey": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb"
  }'

# Test all analytics endpoints
curl "http://localhost:8000/api/zerion/analytics/portfolio-performance/testuser?period=7d"
curl "http://localhost:8000/api/zerion/analytics/portfolio-changes/testuser"
curl "http://localhost:8000/api/zerion/analytics/token-prices/testuser"
curl "http://localhost:8000/api/zerion/analytics/performance-ranking/testuser?limit=5"
```

---

## Related Documentation

- `ZERION_API_GUIDE.md` - Portfolio & Assets features
- `ZERION_TRANSACTIONS_GUIDE.md` - Transaction history
- `POSITIONS_DASHBOARD_GUIDE.md` - Unified positions dashboard
- `ZERION_QUICK_REF.md` - Quick reference

---

## Next Steps

### Phase 1: Testing ✅
- [x] Implement all 4 analytics endpoints
- [x] Test with empty portfolio
- [x] Validate response structures

### Phase 2: Frontend (Pending)
- [ ] Create analytics dashboard page
- [ ] Implement chart visualization (Chart.js/Recharts)
- [ ] Add period selector (24h/7d/30d/90d/1y)
- [ ] Create performance cards component
- [ ] Build top movers leaderboard

### Phase 3: Telegram Bot (Pending)
- [ ] Add `/performance` command
- [ ] Add `/changes` command
- [ ] Add `/movers` command
- [ ] Add `/tokens` command for price list
- [ ] Implement inline keyboards for period selection

### Phase 4: Advanced Features
- [ ] Portfolio performance alerts
- [ ] Custom date range selection
- [ ] Export analytics to PDF
- [ ] Compare with market indices
- [ ] Historical transaction impact analysis

---

**Version:** 1.0.0  
**Last Updated:** 2025-10-31  
**Status:** ✅ All 4 analytics features implemented and tested
