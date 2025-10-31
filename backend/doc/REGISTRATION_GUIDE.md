# Group Registration Guide

## Overview

The group registration system allows Telegram group owners/admins to register their groups with the trading bot. The system includes:

- ✅ Telegram ownership verification
- 🔐 Automatic custodial wallet creation
- 🔒 Encrypted private key storage
- ⏱️ Time-limited verification codes

## Architecture

### Files Created

```
telegram-bot/
├── utils/
│   ├── crypto.js          # AES-256-GCM encryption/decryption
│   ├── wallet.js          # Solana wallet creation and management
│   └── telegram.js        # Telegram API verification
├── db/
│   ├── config.js          # PostgreSQL connection pool
│   └── queries.js         # Database query helpers
└── routes/
    └── groups.js          # Updated with registration endpoints
```

## Registration Flow

### Step 1: Initiate Registration

**Endpoint:** `POST /api/groups/register/initiate`

**Request Body:**
```json
{
  "tgid": "-1001234567890",
  "userId": "123456789"
}
```

**What Happens:**
1. Verifies the user is owner/admin of the Telegram group
2. Checks if group is already registered
3. Generates a verification code
4. Sends verification code to the Telegram group
5. Stores pending verification (expires in 10 minutes)

**Response:**
```json
{
  "success": true,
  "message": "Verification code sent to your Telegram group",
  "data": {
    "tgid": "-1001234567890",
    "groupTitle": "My Trading Group",
    "expiresIn": "10 minutes",
    "isOwner": true,
    "isAdmin": true
  }
}
```

### Step 2: Complete Registration

**Endpoint:** `POST /api/groups/register/complete`

**Request Body:**
```json
{
  "tgid": "-1001234567890",
  "userId": "123456789",
  "verificationCode": "ABC12345",
  "min_stake": 0.1,
  "cooldown_period": 300
}
```

**What Happens:**
1. Validates verification code
2. Creates/retrieves user account
3. Creates custodial wallet for user (if new)
4. Creates custodial wallet for group
5. Encrypts all private keys with master password
6. Stores group in database
7. Adds owner as participant

**Response:**
```json
{
  "success": true,
  "message": "Group registered successfully",
  "data": {
    "group": {
      "tgid": "-1001234567890",
      "status": "active",
      "owner": "123456789",
      "min_stake": "0.1",
      "cooldown_period": 300,
      "created_at": "2025-10-22T10:30:00.000Z"
    },
    "wallets": {
      "groupWallet": "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU",
      "userWallet": "5vMKfd1xQJHHoR8XxrMjGV8wicye53QyQfB6ww1tQhni"
    },
    "groupInfo": {
      "title": "My Trading Group",
      "type": "supergroup",
      "memberCount": 42
    }
  }
}
```

## Security Features

### 1. Encryption (AES-256-GCM)
- All private keys encrypted with master password
- Uses PBKDF2 for key derivation (100,000 iterations)
- Authenticated encryption with GCM mode
- Random salt and IV for each encryption

### 2. Telegram Verification
- Verifies user is owner/creator or administrator
- Checks group membership status via Telegram API
- Sends verification code directly to group

### 3. Time-Limited Codes
- Verification codes expire in 10 minutes
- Auto-cleanup of expired verifications

### 4. Transaction Safety
- Database operations wrapped in transactions
- Atomic creation of user + group + wallet

## Environment Variables Required

Add to your `.env` file:

```bash
# Telegram Bot Token
TELEGRAM_BOT_TOKEN=your_bot_token_here

# Database Connection
DATABASE_URL=postgresql://user:pass@localhost:5432/dbname

# Encryption Master Password (NEVER COMMIT THIS!)
# Generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
ENCRYPTION_MASTER_PASSWORD=your_secure_password_here

# API Port
API_PORT=3000
```

## How to Get Telegram IDs

### Group ID (tgid)
1. Add bot to your group
2. Send a message in the group
3. Visit: `https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getUpdates`
4. Look for `"chat":{"id":-1001234567890}` in the response

### User ID (userId)
1. Message the bot privately or in a group
2. Visit: `https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getUpdates`
3. Look for `"from":{"id":123456789}` in the response

## Testing the Registration Flow

### Using cURL:

**Step 1: Initiate**
```bash
curl -X POST http://localhost:3000/api/groups/register/initiate \
  -H "Content-Type: application/json" \
  -d '{
    "tgid": "-1001234567890",
    "userId": "123456789"
  }'
```

**Step 2: Check Telegram group for verification code**

**Step 3: Complete**
```bash
curl -X POST http://localhost:3000/api/groups/register/complete \
  -H "Content-Type: application/json" \
  -d '{
    "tgid": "-1001234567890",
    "userId": "123456789",
    "verificationCode": "ABC12345",
    "min_stake": 0.1,
    "cooldown_period": 300
  }'
```

### Using Postman:

1. Import the API endpoints
2. Set base URL to `http://localhost:3000`
3. Create requests for both registration endpoints
4. Test the flow

## Error Handling

### Common Errors:

**"Only group owners or administrators can register the group"**
- User is not owner/admin
- Check user permissions in Telegram

**"Group is already registered"**
- Group exists in database
- Use update endpoints instead

**"Verification code expired"**
- More than 10 minutes passed
- Restart registration flow

**"Invalid verification code"**
- Wrong code entered
- Check Telegram group for correct code

**"Encryption master password not configured"**
- ENCRYPTION_MASTER_PASSWORD not set in .env
- Generate and add to .env file

## Database Schema Changes

The registration creates/updates:

1. **users table**: User with custodial wallet
2. **groups table**: Group with encrypted relay account
3. **participants table**: Owner as participant with role='owner'

## Next Steps

After registration:
1. Fund the group wallet with SOL
2. Configure trading parameters
3. Add participants
4. Create trading sessions
5. Start trading!

## Production Considerations

1. **Replace in-memory verification store** with Redis
2. **Add rate limiting** to prevent abuse
3. **Implement webhook** instead of polling for Telegram updates
4. **Add logging** and monitoring
5. **Implement key rotation** for master password
6. **Add backup/recovery** mechanism for wallets
7. **Enable 2FA** for sensitive operations

## Support

For issues or questions:
- Check logs for detailed error messages
- Verify environment variables are set
- Ensure database is running and accessible
- Test Telegram bot token is valid
