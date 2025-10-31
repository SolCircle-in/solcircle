# Redis Session Migration

This document describes the migration from in-memory session storage to Redis-backed session management for the Telegram bot.

## Overview

Previously, the bot stored session data in a simple JavaScript object (`const sessions = {}`), which had limitations:
- **No persistence**: Sessions were lost when the bot restarted
- **Single instance only**: Couldn't scale horizontally with multiple bot instances
- **Memory limits**: All session data had to fit in Node.js memory

Now, sessions are stored in Redis, providing:
- ✅ **Persistence**: Sessions survive bot restarts
- ✅ **Scalability**: Multiple bot instances can share session state
- ✅ **Auto-expiration**: Sessions automatically expire after 24 hours (configurable)
- ✅ **Better performance**: Redis is optimized for key-value operations

## Changes Made

### 1. New Redis Utility Module ([utils/redis-session.js](utils/redis-session.js))

Created a comprehensive Redis session management module with the following functions:

#### Connection Management
- `initRedis()` - Initialize Redis client connection
- `getRedisClient()` - Get the Redis client instance
- `closeRedis()` - Close Redis connection

#### Session Operations
- `saveSession(sessionId, sessionData, ttl)` - Save or update a session
- `getSession(sessionId)` - Retrieve a session by ID
- `getSessionByChatId(chatId)` - Find session by Telegram chat ID
- `getAllSessionsForChat(chatId)` - Get all sessions for a chat
- `updateSession(sessionId, updates)` - Update session fields
- `deleteSession(sessionId)` - Remove a session
- `findActiveSession(chatId)` - Find the active session in a chat

#### Participant Operations
- `addParticipant(sessionId, username)` - Add user to session

#### Proposal Operations
- `addProposal(sessionId, proposal)` - Add proposal to session
- `updateProposal(sessionId, proposalId, updates)` - Update proposal
- `getProposal(sessionId, proposalId)` - Get specific proposal
- `findActiveProposal(sessionId)` - Find active proposal in session
- `addVote(sessionId, proposalId, username, voteData)` - Record a vote

### 2. Updated Bot Commands

#### `/create_session`
- Now saves session to Redis instead of in-memory object
- Uses `saveSession()` and `updateSession()` for persistence
- Uses `findActiveSession()` to check for existing sessions

#### `/close_session`
- Uses `findActiveSession()` to find sessions
- Uses `updateSession()` to close sessions and proposals

#### `/propose`
- Uses `findActiveSession()` to find the session
- Uses `findActiveProposal()` to check for active proposals
- Uses `addProposal()` to store new proposals
- Updated `setTimeout` callbacks to pass IDs instead of objects

#### `/vote`
- Uses `findActiveSession()` and `findActiveProposal()`
- Uses `addVote()` to record votes
- Uses `getProposal()` to fetch updated vote counts

#### Callback Query Handler
- Uses `getSession()` to verify session exists
- Uses `addParticipant()` to add users to sessions

### 3. Updated Proposal End Handlers

#### `handleBuyProposalEnd(proposalId, sessionId, tgid)`
- Changed signature to accept IDs instead of objects
- Fetches latest data from Redis using `getProposal()` and `getSession()`
- Uses `updateProposal()` to close proposals

#### `handleSellProposalEnd(proposalId, sessionId, order)`
- Changed signature to accept IDs instead of objects
- Fetches latest data from Redis using `getProposal()` and `getSession()`
- Uses `updateProposal()` to close proposals

### 4. Redis Initialization

Updated [bot.js](bot.js#L1666-1673) to initialize Redis on startup:

```javascript
app.listen(PORT, async () => {
  // Initialize Redis
  try {
    await initRedis();
    console.log("✅ Redis initialized successfully");
  } catch (err) {
    console.error("❌ Failed to initialize Redis:", err);
    process.exit(1);
  }
  // ... rest of startup
});
```

## Configuration

Add to your `.env` file:

```bash
# Redis Configuration
REDIS_URL=redis://localhost:6379
```

For production, you can use Redis Cloud, AWS ElastiCache, or other hosted Redis services:

```bash
# Example: Redis Cloud
REDIS_URL=redis://default:password@redis-12345.c123.us-east-1.elb.amazonaws.com:6379

# Example: Redis with auth
REDIS_URL=redis://:mypassword@localhost:6379
```

## Data Structure

### Session Key Pattern
```
session:<session_id>
```

### Session Data Structure
```json
{
  "message": "Buy BONK token",
  "participants": ["@user1", "@user2"],
  "votes": {},
  "chatId": -1001234567890,
  "msgId": 12345,
  "open": true,
  "createdBy": 123456789,
  "createdByUsername": "user1",
  "proposals": [
    {
      "id": "1234567890123",
      "text": "BUY token=MALONEY amount=0.05 price=market",
      "type": "buy",
      "votes": {
        "@user1": { "vote": "yes", "amount": 0.05 },
        "@user2": { "vote": "no", "amount": 0 }
      },
      "open": true,
      "createdBy": 123456789,
      "createdByUsername": "user1",
      "duration": 5,
      "startTime": 1234567890000,
      "endTime": 1234567890000
    }
  ]
}
```

### Chat-to-Session Mapping
```
session:chat:<chat_id> -> <session_id>
```

## TTL (Time-to-Live)

- **Default TTL**: 24 hours (86400 seconds)
- Sessions automatically expire and are removed by Redis
- Can be customized per session in `saveSession(sessionId, data, customTTL)`

## Migration Steps

1. ✅ Install Redis client: `npm install redis`
2. ✅ Create Redis utility module
3. ✅ Update all bot commands to use Redis
4. ✅ Update proposal handlers
5. ✅ Initialize Redis on bot startup
6. ✅ Add Redis URL to environment configuration

## Testing

To test the Redis integration:

1. **Start Redis**: Ensure Redis is running
   ```bash
   redis-server
   ```

2. **Check Redis connection**:
   ```bash
   redis-cli ping  # Should return PONG
   ```

3. **Start the bot**:
   ```bash
   node bot.js
   ```

   You should see:
   ```
   ✅ Redis connected
   ✅ Redis initialized successfully
   🚀 Bot running on port 8000
   ```

4. **Test session creation**:
   - Create a session: `/create_session "test" 5`
   - Join the session
   - Verify in Redis:
     ```bash
     redis-cli KEYS "session:*"
     redis-cli GET "session:1234567890"
     ```

5. **Test bot restart**:
   - Create a session with participants
   - Restart the bot (Ctrl+C, then `node bot.js`)
   - Session should still exist in Redis
   - Create a proposal - it should work with the existing session

## Monitoring Redis

### View all session keys
```bash
redis-cli KEYS "session:*"
```

### View a specific session
```bash
redis-cli GET "session:1234567890123"
```

### View session count
```bash
redis-cli DBSIZE
```

### Clear all sessions (use carefully!)
```bash
redis-cli FLUSHDB
```

### Monitor Redis operations in real-time
```bash
redis-cli MONITOR
```

## Rollback Plan

If you need to rollback to in-memory sessions:

1. Restore the old `const sessions = {}` line
2. Revert all function calls to use `sessions[sessionId]` directly
3. Remove Redis initialization from `app.listen()`
4. Uninstall Redis package: `npm uninstall redis`

## Performance Considerations

- **Redis latency**: All operations are async with network overhead (~1-5ms local, ~10-50ms cloud)
- **Memory usage**: Sessions are in Redis, not Node.js heap
- **Horizontal scaling**: Multiple bot instances can now run simultaneously
- **Persistence**: Enable Redis persistence (RDB or AOF) for production

## Security

- Use Redis AUTH for production: `REDIS_URL=redis://:password@host:6379`
- Use TLS for cloud Redis: `rediss://` (note the extra 's')
- Restrict Redis network access to bot servers only
- Consider using Redis ACLs for fine-grained permissions

## Future Improvements

- [ ] Add Redis connection pooling
- [ ] Implement Redis pub/sub for multi-instance coordination
- [ ] Add Redis Cluster support for high availability
- [ ] Implement session archival to PostgreSQL after expiry
- [ ] Add Redis health checks and monitoring
- [ ] Implement graceful degradation if Redis is unavailable

## Dependencies

- `redis`: ^4.x - Official Redis client for Node.js

## Documentation

- Redis client docs: https://github.com/redis/node-redis
- Redis commands: https://redis.io/commands
- Redis data types: https://redis.io/docs/data-types/
