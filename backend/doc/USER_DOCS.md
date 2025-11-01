Telegram Group Trading Bot — User & Setup Guide
===============================================

Overview
--------
This repository runs a Telegram bot that can:
- Manage short "sessions" where participants can join and vote.
- Start multiple proposals per session (each proposal has its own voting window).
- Send small SOL transfers on Solana devnet (via `/buy`).
- Proxy a couple of backend endpoints (`/status`, `/echo`).

This document explains how to set up the environment, run the bot (polling or webhook), and how to use the main commands.

Prerequisites
-------------
- Node.js 16+ (v22 tested in development notes)
- npm
- A Telegram Bot token (from @BotFather)
- If you want webhooks: a public HTTPS URL (Cloudflare Tunnel, ngrok, or a hosted server)
- (Optional) Solana CLI and a funded devnet wallet if you plan to use `/buy`

Files of interest
-----------------
- `bot.js` — main bot program
- `.env.template` — environment variable template (copy to `.env`)
- `testnet-keypair.json` — Solana keypair used by the bot (keep private)
- `package.json` / `package-lock.json` — project dependencies
- `USER_DOCS.md` — this file

Environment (.env)
-------------------
Copy `.env.template` to `.env` and fill values:

- BOT_TOKEN — token string from @BotFather (required)
- WEBHOOK_URL_BASE — public https base URL for webhooks (no trailing slash). Example: `https://abcd-1234.trycloudflare.com`.
- WEBHOOK_SECRET — secret token appended to webhook path (default `secret`)
- BACKEND_BASE — base URL for backend endpoints used by /status and /echo. Default: `http://localhost:5000`
- PORT — port the Express server listens on (default `3000`)
- NODE_ENV — `development` or `production`

Important: If WEBHOOK_URL_BASE is left as the placeholder (e.g. `https://your-ngrok-or-server-url`) the bot will run in polling mode automatically.

Run the bot
-----------
1. Install dependencies:

```bash
npm install
```

2. Start the bot:

```bash
node bot.js
```

- If `WEBHOOK_URL_BASE` is a valid public https URL the bot will attempt to set a webhook.
- If webhook setup fails or `WEBHOOK_URL_BASE` is unset, the bot falls back to polling mode (`bot.launch()`), which keeps the process running and receives updates via long polling.

Expose local server (optional for webhooks)
------------------------------------------
- Cloudflare Tunnel (recommended for reliability):
  - Run `cloudflared tunnel --url http://localhost:3000` and use the generated `https://...trycloudflare.com` URL in `WEBHOOK_URL_BASE`.
- ngrok:
  - Run `ngrok http 3000` and copy the https URL to `WEBHOOK_URL_BASE`.

Core bot commands
-----------------
All commands are sent to the bot in Telegram (private chat or group where the bot is present). Commands shown with usage:

- /status
  - Calls the configured backend: `GET ${BACKEND_BASE}/bot/status?chat_id=...&user_id=...` and returns the backend response.

- /echo <message>
  - Sends `message` to backend `POST ${BACKEND_BASE}/bot/echo` and replies with the backend result or `message` if backend fails.

- /buy <solana_address>
  - Sends 0.01 SOL (devnet) from the keypair in `testnet-keypair.json` to the provided address.
  - Make sure the keypair is funded on devnet; the bot uses `@solana/web3.js` and the `devnet` cluster.
  - Note: This is for testing only — testnet/devnet SOL has no monetary value.

Session & proposal flow (multi-step)
-----------------------------------
This bot supports sessions that can contain multiple proposals. Flow:

1. Create a session (participants join)
   - `/create_session "message text" <voting_time_in_min>`
   - Example: `/create_session "Should we buy BTC?" 2`
   - The command creates a session and gives participants 15 seconds to join by pressing inline Yes/No buttons. The 15 seconds join window is fixed and cannot be changed per session.

2. Participants join
   - When session is created, users press the inline "Yes" button to join. Joined users are recorded by username (`@username`) or their first name.

3. Create proposals inside a session
   - Any user can start a proposal in the active session with:
     - `/propose "proposal text" <voting_time_in_min>`
     - Example: `/propose "Buy 1 BTC now" 1`
   - Each proposal has its own voting window (in minutes). Voting starts immediately for that proposal and ends after the specified time.

4. Vote on the latest open proposal
   - Participants vote with `/vote yes <amount>` or `/vote no <amount>` (amount is ignored for now).
   - Only `yes` or `no` are accepted — other values will be rejected.
   - Votes apply to the latest open proposal in the session in that chat.

5. Results
   - When a proposal's voting window ends the bot posts a results message listing votes per user.

Notes & limitations
-------------------
- All session and proposal state is stored in-memory (`sessions` object). Restarting the bot clears all sessions and proposals.
- Currently votes apply to the latest open proposal in a session. If you need voting per-proposal by ID, the bot can be extended to accept `/vote <proposalId> yes`.
- Only basic checks are implemented (e.g., participant membership before voting). You may want to add admin-only controls, persistence, or deduplication rules.

Troubleshooting
---------------
- Bot crashes when setting webhook: check `WEBHOOK_URL_BASE` and ensure it is a resolvable https URL. If you don't have one, the bot will fall back to polling mode.
- `TelegramError: bad webhook: Failed to resolve host` — means the URL in `WEBHOOK_URL_BASE` is not resolvable. Update `.env` with a valid URL from cloudflared/ngrok or run the bot in polling mode.
- `Transaction simulation failed` when using `/buy` — fund the bot's keypair on devnet via Solana faucet or make sure the code is pointed at the same cluster as your funded wallet.

Security
--------
- Keep `testnet-keypair.json` private.
- Do not commit `.env` with real tokens to public repositories.
- Consider using secrets managers for production deployments.

Next improvements
-----------------
- Persist sessions and proposals to a database (SQLite/Postgres) to survive restarts.
- Add admin permissions for creating sessions or proposals.
- Allow voting tied to proposal IDs and show active proposals list.

---
Generated on: 2025-10-19
