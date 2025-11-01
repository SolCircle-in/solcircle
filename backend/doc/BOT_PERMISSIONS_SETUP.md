# Bot Permission Setup Guide

## ⚠️ Important: Bot Cannot Auto-Promote Itself

Due to Telegram's security model, **bots cannot automatically become administrators**. This is a fundamental Telegram restriction that prevents malicious bots from taking over groups.

**Only human users can promote bots to administrator.**

## Quick Setup (2 Minutes)

### Step 1: Add Bot to Your Group

1. Open your Telegram group
2. Click the group name at the top
3. Click "Add Members"
4. Search for your bot username (e.g., `@YourBotName`)
5. Add the bot

### Step 2: Promote Bot to Administrator

1. In the group, click the group name again
2. Click "**Administrators**"
3. Click "**Add Administrator**"
4. Select your bot from the list
5. **Enable these permissions:**
   - ✅ **Invite Users via Link** (required for web join feature)
   - ✅ **Manage Chat** (recommended)
   - ✅ **Delete Messages** (optional, for moderation)
   - ✅ **Ban Users** (optional, for security)

### Step 3: Register Your Group

1. In the group chat, send: `/register`
2. The bot will verify permissions and register your group
3. If you see warnings, check that permissions from Step 2 are enabled

## Automatic Permission Check

The bot now **automatically checks** its permissions and provides helpful instructions:

### During Registration

When you run `/register`, the bot checks if it has the required permissions:

```
✅ All permissions OK → Group registered successfully
⚠️ Missing permissions → Shows setup instructions
```

### When Bot is Added to Group

When you add the bot to a new group, it automatically sends a message:

- ✅ If bot is admin with correct permissions: "Ready to register!"
- ⚠️ If bot is admin but missing permissions: Shows which permission to enable
- ❌ If bot is not admin: Shows how to promote it

## Checking Permissions Anytime

You can check the bot's permissions for any registered group:

**API Endpoint:**
```bash
GET /api/groups/:tgid/bot-permissions
```

**Example:**
```bash
curl http://localhost:8000/api/groups/-1234567890/bot-permissions
```

**Response (with permissions):**
```json
{
  "success": true,
  "tgid": "-1234567890",
  "permissions": {
    "isAdmin": true,
    "canInviteUsers": true,
    "canManageChat": true,
    "canCreateInviteLinks": true,
    "status": "administrator"
  }
}
```

**Response (needs setup):**
```json
{
  "success": true,
  "tgid": "-1234567890",
  "permissions": {
    "isAdmin": false,
    "canInviteUsers": false,
    "canManageChat": false,
    "canCreateInviteLinks": false,
    "status": "member"
  },
  "warnings": [
    "Bot must be an administrator"
  ],
  "setupInstructions": {
    "message": "Bot needs additional permissions",
    "steps": [
      "1. Open your Telegram group",
      "2. Go to Group Info → Administrators",
      "3. Add/edit the bot as administrator",
      "4. Enable these permissions:",
      "   • Invite Users via Link (required)",
      "   • Manage Chat (recommended)"
    ]
  }
}
```

## Features That Require Admin Permissions

| Feature | Requires Admin? | Required Permission |
|---------|----------------|---------------------|
| Group Registration | ✅ Yes | Any admin status |
| Create Invite Links | ✅ Yes | "Invite Users via Link" |
| Auto-approve Join Requests | ✅ Yes | "Invite Users via Link" |
| Send Messages | ❌ No | Default member permission |
| Read Messages | ❌ No | Default member permission |

## Troubleshooting

### "Route not found" Error

**Problem:** Frontend shows "Route not found" when clicking Join button

**Solution:** 
1. Restart backend server to load the new route
2. Run: `pkill -f "node server.js" && node server.js`

### "Not enough rights to manage chat invite link"

**Problem:** Bot cannot create invite links

**Solution:**
1. Go to Group Info → Administrators
2. Find your bot in the admin list
3. Edit bot permissions
4. Enable "Invite Users via Link"

### "Bot is not an administrator"

**Problem:** Bot cannot perform admin actions

**Solution:**
1. Go to Group Info → Administrators
2. Click "Add Administrator"
3. Select your bot
4. Enable required permissions

### Bot Doesn't Respond to Commands

**Problem:** Bot doesn't reply to /register or other commands

**Possible causes:**
- Bot is not in the group
- Bot's webhook is not configured
- Backend server is not running

**Solution:**
1. Check if backend is running: `curl http://localhost:8000/health`
2. Check bot webhook: Look for "Webhook set" message in bot.js logs
3. Re-add bot to the group if needed

## Best Practices

### Security

- **Only promote trusted bots** to administrator
- **Review permissions** regularly
- **Use "Invite Users via Link" only** - don't enable unnecessary admin rights
- **Monitor join requests** if you want manual approval instead of auto-approval

### User Experience

- **Enable "Approve New Members"** in group settings to use join request flow
- **Set invite link expiration** for time-limited access
- **Use member limits** to prevent spam
- **Test the flow** before sharing your group publicly

### Development

- **Use environment variables** for bot token and webhook URL
- **Test in a private group first** before production
- **Monitor bot logs** for permission errors
- **Keep bot token secret** - never commit to git

## Advanced: Conditional Auto-Approval

By default, the bot auto-approves all join requests for registered groups. You can customize this:

**Edit `backend/bot.js`:**

```javascript
bot.on('chat_join_request', async (ctx) => {
  const chatId = ctx.update.chat_join_request.chat.id;
  const requester = ctx.update.chat_join_request.from;
  
  // Check if group is registered
  const resp = await axios.get(`${BACKEND_BASE_EXPRESS}/api/groups/${chatId}`);
  if (!resp.data?.success) return; // Not registered
  
  // ADD YOUR CUSTOM LOGIC HERE
  // Example: Check if user has web account
  const userResp = await axios.get(`${BACKEND_BASE_EXPRESS}/api/users/${requester.id}`);
  if (!userResp.data?.success) {
    console.log(`User ${requester.id} not registered, rejecting`);
    return; // Don't approve
  }
  
  // Approve
  await ctx.telegram.approveChatJoinRequest(chatId, requester.id);
});
```

## Environment Variables

Add to your `.env` file:

```bash
# Required
BOT_TOKEN=your_bot_token_from_botfather
PORT=8000
WEBHOOK_URL_BASE=https://your-public-domain.com

# Optional (for better UX)
BOT_USERNAME=your_bot_username
```

## Summary

✅ **Bot checks permissions automatically** during registration  
✅ **Shows helpful instructions** when permissions are missing  
✅ **Sends welcome message** when added to groups  
✅ **API endpoint** to check permissions anytime  
❌ **Cannot auto-promote** itself (Telegram limitation)  

**Next steps:** Restart your backend server and test the new permission checks!
