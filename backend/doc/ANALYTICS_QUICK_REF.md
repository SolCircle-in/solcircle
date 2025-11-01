# 📊 Analytics Quick Reference

## 🚀 Quick Commands

```bash
# Portfolio performance chart (30 days)
curl "http://localhost:8000/api/zerion/analytics/portfolio-performance/username?period=30d"

# Portfolio changes (24h/7d/30d)
curl "http://localhost:8000/api/zerion/analytics/portfolio-changes/username"

# Token price changes
curl "http://localhost:8000/api/zerion/analytics/token-prices/username"

# Best/worst performers
curl "http://localhost:8000/api/zerion/analytics/performance-ranking/username?limit=5"
```

---

## 📡 Endpoints Summary

| Endpoint | Purpose | Response Time |
|----------|---------|---------------|
| `/analytics/portfolio-performance/:id` | Historical chart data | ~2-3s |
| `/analytics/portfolio-changes/:id` | Multi-period changes | ~3-4s |
| `/analytics/token-prices/:id` | Token price movements | ~1s |
| `/analytics/performance-ranking/:id` | Top gainers/losers | ~1s |

---

## 💡 Key Features

### 1. Portfolio Performance
```json
{
  "current_value_usd": "15420.50",
  "percent_change": "8.60%",
  "highest_value_usd": "15850.00",
  "chart": [/* 720 data points */]
}
```

**Periods:** `24h`, `7d`, `30d`, `90d`, `1y`, `all`

### 2. Portfolio Changes
```json
{
  "24h": { "percent_change": "1.45%", "is_positive": true },
  "7d": { "percent_change": "4.19%", "is_positive": true },
  "30d": { "percent_change": "8.60%", "is_positive": true }
}
```

**Trending:** `up`, `down`, `neutral`

### 3. Token Prices
```json
{
  "tokens": [
    {
      "symbol": "ETH",
      "current_price_usd": "1881.5000",
      "price_change_24h": "2.50%",
      "value_change_24h_usd": "240.50"
    }
  ]
}
```

**Sorted by:** Biggest price movers

### 4. Performance Ranking
```json
{
  "summary": {
    "gainers": 7,
    "losers": 4,
    "net_change_24h_usd": "325.50"
  },
  "best_performers": [/* top 5 */],
  "worst_performers": [/* bottom 5 */]
}
```

---

## 🎨 Frontend Examples

### Chart Component
```javascript
const { data } = await fetch('/api/zerion/analytics/portfolio-performance/user?period=30d');

<LineChart data={data.chart.map(p => ({
  x: new Date(p.date),
  y: parseFloat(p.value)
}))} />

// Metrics
Current: ${data.performance.current_value_usd}
Change: {data.performance.percent_change}
High: ${data.performance.highest_value_usd}
Low: ${data.performance.lowest_value_usd}
```

### Change Cards
```javascript
const { data } = await fetch('/api/zerion/analytics/portfolio-changes/user');

<div className="changes">
  <Card title="24h" 
        change={data.changes['24h'].percent_change}
        positive={data.changes['24h'].is_positive} />
  <Card title="7d" 
        change={data.changes['7d'].percent_change} />
  <Card title="30d" 
        change={data.changes['30d'].percent_change} />
</div>
```

### Token Price Table
```javascript
const { data } = await fetch('/api/zerion/analytics/token-prices/user');

<table>
  {data.tokens.map(token => (
    <tr>
      <td><img src={token.logo} /> {token.symbol}</td>
      <td>${token.current_price_usd}</td>
      <td className={token.is_price_up ? 'green' : 'red'}>
        {token.price_change_24h}
      </td>
      <td>${token.value_usd}</td>
    </tr>
  ))}
</table>
```

### Performance Leaderboard
```javascript
const { data } = await fetch('/api/zerion/analytics/performance-ranking/user?limit=5');

// Top Gainers
<div>
  <h3>🏆 Top Gainers</h3>
  {data.best_performers.map(asset => (
    <div>
      <strong>{asset.symbol}</strong>
      <span className="green">{asset.change_24h}</span>
      <span>+${asset.gain_24h_usd}</span>
    </div>
  ))}
</div>

// Top Losers
<div>
  <h3>📉 Top Losers</h3>
  {data.worst_performers.map(asset => (
    <div>
      <strong>{asset.symbol}</strong>
      <span className="red">{asset.change_24h}</span>
      <span>${asset.loss_24h_usd}</span>
    </div>
  ))}
</div>

// Summary
Net: ${data.summary.net_change_24h_usd}
Gainers: {data.summary.gainers} | Losers: {data.summary.losers}
```

---

## 🤖 Telegram Bot Commands

### /performance
```javascript
bot.command('performance', async (ctx) => {
  const period = ctx.message.text.split(' ')[1] || '30d';
  const res = await axios.get(`/analytics/portfolio-performance/${username}?period=${period}`);
  
  ctx.reply(`
📊 Performance (${period})
💰 Value: $${res.data.data.performance.current_value_usd}
📈 Change: ${res.data.data.performance.percent_change}
  `);
});
```

### /changes
```javascript
bot.command('changes', async (ctx) => {
  const res = await axios.get(`/analytics/portfolio-changes/${username}`);
  const { changes } = res.data.data;
  
  ctx.reply(`
📊 Portfolio Changes
⏰ 24h: ${changes['24h'].percent_change}
📅 7d: ${changes['7d'].percent_change}
📆 30d: ${changes['30d'].percent_change}
  `);
});
```

### /movers
```javascript
bot.command('movers', async (ctx) => {
  const res = await axios.get(`/analytics/performance-ranking/${username}?limit=3`);
  const { best_performers, worst_performers } = res.data.data;
  
  let msg = '🏆 TOP GAINERS:\n';
  best_performers.forEach((a, i) => {
    msg += `${i+1}. ${a.symbol}: ${a.change_24h}\n`;
  });
  
  msg += '\n📉 TOP LOSERS:\n';
  worst_performers.forEach((a, i) => {
    msg += `${i+1}. ${a.symbol}: ${a.change_24h}\n`;
  });
  
  ctx.reply(msg);
});
```

---

## 🎯 Use Cases

### Dashboard
- Portfolio value chart (line/area chart)
- Change cards (24h/7d/30d with color coding)
- Performance summary
- Trending indicator

### Watchlist
- Token price list with 24h changes
- Sort by biggest movers
- Filter by positive/negative
- Price alerts

### Analytics Page
- Historical performance chart
- Multi-period comparison
- Best/worst performers leaderboard
- Gains/losses breakdown

### Notifications
- Daily portfolio summary
- Significant change alerts (>5%)
- Top performer notifications
- Loss warnings

---

## ⚡ Performance Tips

### Caching Strategy
```javascript
// Cache chart data (5 min TTL)
redis.setex(`performance_${user}_${period}`, 300, data);

// Cache changes (1 min TTL)
redis.setex(`changes_${user}`, 60, data);

// Cache token prices (30 sec TTL)
redis.setex(`prices_${user}`, 30, data);
```

### Background Jobs
```javascript
// Update analytics every 15 minutes
cron.schedule('*/15 * * * *', async () => {
  await updateAnalyticsCache();
});
```

### Lazy Loading
```javascript
// Load chart data only when tab is active
<Tab onActive={() => fetchChartData()} />
```

---

## 🔧 Query Parameters

| Parameter | Endpoint | Values | Default |
|-----------|----------|--------|---------|
| `period` | portfolio-performance | 24h, 7d, 30d, 90d, 1y, all | 30d |
| `limit` | performance-ranking | 1-50 | 5 |

---

## 📊 Response Structures

### Portfolio Performance
```
performance {
  current_value_usd
  start_value_usd
  absolute_change_usd
  percent_change
  highest_value_usd
  lowest_value_usd
}
chart[] {
  timestamp, value, date
}
```

### Portfolio Changes
```
changes {
  24h { start, end, change, percent, is_positive }
  7d { ... }
  30d { ... }
}
summary { trending }
```

### Token Prices
```
tokens[] {
  symbol, name, chain
  quantity, current_price_usd
  price_change_24h
  value_usd, value_change_24h_usd
  is_price_up, logo
}
```

### Performance Ranking
```
summary {
  total_assets, gainers, losers
  total_gains_24h_usd
  total_losses_24h_usd
  net_change_24h_usd
}
best_performers[]
worst_performers[]
```

---

## 🎨 UI Components Needed

- [ ] Line/Area Chart component
- [ ] Change Card component (with color coding)
- [ ] Token Price Row component
- [ ] Performance Badge component
- [ ] Leaderboard component
- [ ] Period Selector component
- [ ] Trending Indicator component

---

## 🚨 Error Handling

### Empty Portfolio
```json
{ "total_tokens": 0, "tokens": [] }
```

### Insufficient Data
```json
{ "changes": { "30d": { "error": "Data unavailable" } } }
```

### Rate Limited
```json
{ "success": false, "error": "Rate limit exceeded" }
```

---

## 📚 Documentation

- **Full Guide:** `ANALYTICS_GUIDE.md`
- **Zerion API:** `ZERION_API_GUIDE.md`
- **Positions:** `POSITIONS_DASHBOARD_GUIDE.md`

---

## ✅ Implementation Status

### Analytics Features (4/4 Complete)
✅ Historical portfolio performance (charts)  
✅ 24h/7d/30d portfolio changes (%)  
✅ Token price changes  
✅ Best/worst performing assets  

### Integration Status
✅ Backend API endpoints  
✅ Documentation created  
⏳ Frontend dashboard (pending)  
⏳ Telegram bot commands (pending)  

---

**Quick Test:**
```bash
# Test all endpoints
curl "http://localhost:8000/api/zerion/analytics/portfolio-performance/username?period=7d" | jq .data.performance
curl "http://localhost:8000/api/zerion/analytics/portfolio-changes/username" | jq .data.changes
curl "http://localhost:8000/api/zerion/analytics/token-prices/username" | jq .data.total_tokens
curl "http://localhost:8000/api/zerion/analytics/performance-ranking/username" | jq .data.summary
```

**Version:** 1.0.0  
**Last Updated:** 2025-10-31  
**Status:** 🟢 Ready for frontend integration
