# Join Groups via Webpage Guide

## Overview

This feature allows users to discover and join Telegram groups through your web interface. The flow respects Telegram's security model by using invite links and join requests.

## How It Works

1. **Discovery**: Users browse registered groups on your website (`/groups` page)
2. **Join Request**: Click "Join" button → backend creates an invite link
3. **Telegram Flow**: User is redirected to `t.me/+xxxxx` to complete join in Telegram app
4. **Auto-Approval**: Bot automatically approves join requests for registered groups

## Architecture

```
┌─────────────┐
│   Browser   │
│  (Groups    │
│   Page)     │
└──────┬──────┘
       │ 1. Click Join
       ▼
┌─────────────────────────────────────────────────┐
│ Backend API: POST /api/groups/:tgid/invite      │
│                                                  │
│ • Validates group is registered                 │
│ • Calls Telegram Bot API                        │
│   createChatInviteLink(creates_join_request=true)│
│ • Returns invite link                           │
└──────────────┬──────────────────────────────────┘
               │ 2. Returns invite_link
               ▼
┌─────────────────────┐
│ Browser redirects   │
│ to t.me/+xxxxx      │
└──────────┬──────────┘
           │ 3. Opens Telegram
           ▼
┌──────────────────────────────────────────────────┐
│ Telegram App                                     │
│ • User sees join request prompt                  │
│ • User confirms join                             │
│ • Sends chat_join_request to bot webhook         │
└──────────────┬───────────────────────────────────┘
               │ 4. Join request update
               ▼
┌──────────────────────────────────────────────────┐
│ Bot Webhook Handler (bot.js)                     │
│                                                   │
│ • Receives chat_join_request update              │
│ • Checks if group is registered in DB            │
│ • Calls approveChatJoinRequest()                 │
│ • User is added to group                         │
└───────────────────────────────────────────────────┘
```

## Configuration

### Backend Environment Variables

```bash
# .env file
BOT_TOKEN=your_bot_token_from_botfather
PORT=3000

# For webhook (bot.js)
WEBHOOK_URL_BASE=https://your-public-domain.com
WEBHOOK_SECRET=your_secret_token
```

### Bot Permissions Required

Your bot **MUST** be an administrator in each group with these rights:

- ✅ **can_invite_users** - Required to create invite links
- ✅ **can_manage_chat** - Recommended for full admin capabilities

To add the bot as admin:
1. Open your Telegram group
2. Go to Group Info → Administrators
3. Add your bot
4. Grant "Invite Users via Link" permission (minimum)

### Telegram Group Settings

For join-request flow to work:
1. Open Group Settings → Group Type
2. Enable "**Approve New Members**" 
   (This makes `join_by_request=true` in group settings)

## API Endpoints

### POST `/api/groups/:tgid/invite`

Creates an invite link for a registered group.

**Request Body** (optional):
```json
{
  "name": "Web Join Link",
  "expire_date": 1735689600,
  "member_limit": 100,
  "joinRequest": true
}
```

**Response**:
```json
{
  "success": true,
  "invite_link": "https://t.me/+AbCdEf1234567",
  "join_request": true
}
```

**Errors**:
- `404` - Group not found
- `400` - Failed to create invite link (bot not admin, missing permissions)
- `500` - Server error

## Frontend Integration

### Groups List Page

```tsx
const handleJoin = async (tgid: string) => {
  const response = await fetch(
    `http://localhost:3000/api/groups/${tgid}/invite`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ joinRequest: true }),
    }
  );
  
  const data = await response.json();
  if (data.success) {
    window.location.href = data.invite_link; // Redirect to Telegram
  }
};
```

## Testing

### 1. Start Backend Server

```bash
cd backend
npm install
node server.js
# Should see: 🚀 Server running on port 3000
```

### 2. Start Bot Webhook

```bash
cd backend
node bot.js
# Should see: 🤖 Webhook set: https://your-domain.com/tg-webhook/secret
```

**Note**: For local testing, use a tunnel service:
```bash
# Using cloudflared
cloudflared tunnel --url http://localhost:3000

# Update WEBHOOK_URL_BASE with the tunnel URL
WEBHOOK_URL_BASE=https://abc-123.trycloudflare.com
```

### 3. Start Frontend

```bash
cd frontend
pnpm install
pnpm dev
# Open http://localhost:3001
```

### 4. Test Flow

1. Register a group using `/register` in Telegram
2. Make bot admin with invite permissions
3. Open website `/groups` page
4. Click "Join" button
5. Should redirect to Telegram
6. Approve join in Telegram
7. Bot should auto-approve and add you

## Troubleshooting

### "Route not found" Error

**Problem**: Frontend calling wrong port (8000 instead of 3000)

**Solution**: ✅ Fixed - all frontend calls now use `localhost:3000`

### "Failed to create invite link"

**Causes**:
- Bot is not admin in the group
- Bot doesn't have `can_invite_users` permission
- Group doesn't exist or bot was removed

**Fix**: 
1. Check bot is admin: `/getChatMember` in group
2. Re-add bot with proper permissions

### Join requests not auto-approved

**Causes**:
- Bot webhook not receiving updates
- `chat_join_request` not enabled in bot config
- Group not in database

**Fix**:
1. Verify webhook is public and reachable
2. Check bot.js logs for incoming updates
3. Verify group exists in DB: `SELECT * FROM groups WHERE tgid = 'xxx'`

### Users can't see invite link

**Causes**:
- CORS blocking frontend → backend requests
- Backend not running
- Wrong API port in frontend

**Fix**:
1. Check CORS is enabled in server.js: `app.use(cors())`
2. Verify backend is running on port 3000
3. Check browser console for errors

## Security Considerations

1. **No direct user addition**: Telegram prohibits server-side adding of users. Users MUST approve joins through Telegram app.

2. **Invite link expiration**: Set `expire_date` in invite creation to prevent link abuse:
   ```javascript
   {
     expire_date: Math.floor(Date.now() / 1000) + 3600, // 1 hour
     member_limit: 50 // Max 50 joins per link
   }
   ```

3. **Rate limiting**: Telegram limits invite link creation. Cache links when possible.

4. **Approval logic**: Current implementation auto-approves all registered groups. Consider adding:
   - User verification (require web login)
   - Allowlist/blocklist
   - Approval rules per group

## Advanced Customization

### Custom Approval Logic

Edit `backend/bot.js`:

```javascript
bot.on('chat_join_request', async (ctx) => {
  const chatId = ctx.update.chat_join_request.chat.id;
  const requester = ctx.update.chat_join_request.from;
  
  // Check if group is registered
  const resp = await axios.get(`${BACKEND_BASE_EXPRESS}/api/groups/${chatId}`);
  
  if (!resp.data?.success) return; // Not registered, ignore
  
  // ADD CUSTOM LOGIC HERE
  // e.g., check if user has web account
  const userResp = await axios.get(`${BACKEND_BASE_EXPRESS}/api/users/${requester.id}`);
  if (!userResp.data?.success) {
    console.log(`User ${requester.id} not registered, rejecting`);
    return; // Don't approve
  }
  
  // Approve
  await ctx.telegram.approveChatJoinRequest(chatId, requester.id);
});
```

### Per-Group Approval Settings

Add a `auto_approve_joins` column to groups table:

```sql
ALTER TABLE groups ADD COLUMN auto_approve_joins BOOLEAN DEFAULT true;
```

Then check this setting in bot.js before approving.

## Files Modified

- `backend/utils/telegram.js` - Added invite link helpers
- `backend/routes/groups.js` - Added POST /:tgid/invite endpoint
- `backend/bot.js` - Added chat_join_request handler
- `frontend/app/groups/page.tsx` - Added Join button
- `frontend/app/groups/[tgid]/page.tsx` - Added Join Group button

## Next Steps

- [ ] Add Telegram Login Widget for account linking
- [ ] Implement per-user invite link tracking
- [ ] Add group discovery search/filter
- [ ] Cache invite links to avoid rate limits
- [ ] Add analytics for join conversions
