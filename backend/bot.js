require("dotenv").config();
const { Telegraf, Markup } = require("telegraf");
const express = require("express");
const axios = require("axios");
const solanaWeb3 = require("@solana/web3.js");
const fs = require("fs");
const {
  initRedis,
  saveSession,
  getSession,
  getSessionByChatId,
  updateSession,
  deleteSession,
  findActiveSession,
  addParticipant,
  addProposal,
  updateProposal,
  getProposal,
  findActiveProposal,
  addVote,
} = require("./utils/redis-session");

// --- Environment Variables ---
const BOT_TOKEN = process.env.BOT_TOKEN;
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || "secret";
const WEBHOOK_PATH = `/tg-webhook/${WEBHOOK_SECRET}`;
const WEBHOOK_URL_BASE = process.env.WEBHOOK_URL_BASE;
const BACKEND_BASE = process.env.BACKEND_BASE;
const PORT = process.env.PORT || 3000;
const BACKEND_BASE_EXPRESS = process.env.BACKEND_BASE_EXPRESS || `http://localhost:3000`;
if (!BOT_TOKEN) throw new Error("❌ BOT_TOKEN missing in .env");

const bot = new Telegraf(BOT_TOKEN, { telegram: { webhookReply: true } });

// --- Load Solana Keypair ---
const secretKey = JSON.parse(fs.readFileSync("testnet-keypair.json"));
const senderKeypair = solanaWeb3.Keypair.fromSecretKey(
  new Uint8Array(secretKey)
);

async function sendSol(toAddress, amountSol = 0.01) {
  const connection = new solanaWeb3.Connection(
    solanaWeb3.clusterApiUrl("devnet"),
    "confirmed"
  );
  const toPubkey = new solanaWeb3.PublicKey(toAddress);
  const transaction = new solanaWeb3.Transaction().add(
    solanaWeb3.SystemProgram.transfer({
      fromPubkey: senderKeypair.publicKey,
      toPubkey,
      lamports: solanaWeb3.LAMPORTS_PER_SOL * amountSol,
    })
  );

  const signature = await solanaWeb3.sendAndConfirmTransaction(
    connection,
    transaction,
    [senderKeypair]
  );
  return signature;
}

// --- Utility: Parse structured DEX actions ---
function parseProposalAction(text) {
  if (!text) return null;
  const parts = text.trim().split(/\s+/);
  const verb = parts.shift()?.toUpperCase();
  if (!["BUY", "SELL"].includes(verb)) return null;

  const data = {};
  for (const p of parts) {
    const m = p.match(/^([^=]+)=(.+)$/);
    if (m) data[m[1].toLowerCase()] = m[2];
  }
  if (!data.token) return null;

  return {
    type: verb.toLowerCase(),
    token: data.token,
    amount: data.amount ? Number(data.amount) : null,
    quote: data.quote || null,
    dex: data.dex || "raydium",
    slippage: data.slippage ? Number(data.slippage) : 1,
  };
}

// Simple token symbol -> mint map. Extend as needed.
const TOKEN_SYMBOLS = {
  SOL: "So11111111111111111111111111111111111111112",
  BONK: "DezJX5YATbQH6Z9uVxM4Qe1fAm1xQ9z5Y4b5k4WbP6d", // example placeholder
  MALONEY: "H2FqRtjfzCHTdSHZF3fSfNEJh5xvTP3dnM9415N7g9GX",
  USDC: "Es9vMFrzaCERQKq6sD6U2fB8dZ5b1o4xC8y3zK1j6r4",
};

function resolveTokenToMint(tokenStr) {
  if (!tokenStr) return null;
  const t = tokenStr.trim();
  // If user supplied uppercase symbol, map it
  const upper = t.toUpperCase();
  if (TOKEN_SYMBOLS[upper]) return TOKEN_SYMBOLS[upper];
  // If it looks like a valid base58 (44 or 43 chars) pubkey, return as-is
  if (/^[A-Za-z0-9]{32,44}$/.test(t)) return t;
  return null;
}


// --- Middleware: Check if group is registered ---
async function checkGroupRegistered(ctx, next) {
  const chat = ctx.chat;
  
  // Skip check for private chats, /start, /register commands
  if (chat.type === "private") {
    return next();
  }
  const text = ctx.message?.text || ctx.callbackQuery?.data || "";
  const isCommand = text.startsWith("/");

  // If not a command, allow it (normal messages)
  if (!isCommand) {
    return next();
  }
  const command = ctx.message?.text?.split(' ')[0];
  if (['/start', '/register'].includes(command)) {
    return next();
  }

  try {
    const tgid = chat.id;
    const response = await axios.get(`${BACKEND_BASE_EXPRESS}/api/groups/${tgid}`);
    
    if (response.data.success) {
      // Group is registered, allow command
      return next();
    }
  } catch (error) {
    // Group not found or error
    if (error.response?.status === 404) {
      await ctx.reply(
        "⚠️ This group is not registered yet!\n\n" +
        "👉 Please register first using /register\n\n" +
        "Only group owners or admins can register the group."
      );
      return;
    }
    
    // Other errors, log and continue
    console.error("Registration check error:", error.message);
  }
  
  // If check fails, block the command
  await ctx.reply(
    "⚠️ Could not verify group registration.\n" +
    "Please ensure the backend is running and try /register"
  );
}

// Apply middleware to all commands except start and register
bot.use(checkGroupRegistered);

// --- Bot Event Handlers ---

// Handle when bot is added to a group or its status changes
bot.on('my_chat_member', async (ctx) => {
  const { chat, new_chat_member } = ctx.update.my_chat_member;
  
  // Only handle group/supergroup additions
  if (chat.type !== 'group' && chat.type !== 'supergroup') return;
  
  // Check if bot was added as admin or member
  if (new_chat_member.status === 'administrator' || new_chat_member.status === 'member') {
    const isAdmin = new_chat_member.status === 'administrator';
    const canInvite = new_chat_member.can_invite_users || false;
    
    let message = `🤖 Hello! I'm now in this group.\n\n`;
    
    if (isAdmin && canInvite) {
      message += `✅ I have all required permissions!\n\n`;
      message += `To register this group:\n1. Run /register\n2. Your group will be available on the website for users to join`;
    } else if (isAdmin && !canInvite) {
      message += `⚠️ I'm an admin, but I need the "Invite Users via Link" permission.\n\n`;
      message += `Please:\n1. Go to Group Info → Administrators\n2. Edit my permissions\n3. Enable "Invite Users via Link"\n4. Then run /register`;
    } else {
      message += `⚠️ I need to be an administrator to work properly.\n\n`;
      message += `Please:\n1. Go to Group Info → Administrators\n2. Promote me to administrator\n3. Enable "Invite Users via Link" permission\n4. Then run /register`;
    }
    
    try {
      await ctx.telegram.sendMessage(chat.id, message);
    } catch (err) {
      console.error('Failed to send welcome message:', err.message);
    }
  }
});

// --- Bot Commands ---
bot.start((ctx) =>
  ctx.reply(
    `👋 Welcome ${
      ctx.from.first_name || "there"
    }!\n\nI'm GroupSOL Trade Bot.\n\nYou can:\n` +
      `• Register your group with /register\n` +
      `• Start proposals with /create_session\n` +
      `• Vote with /vote yes or /vote no\n` +
      `• Check backend with /status`
  )
);

// ✅ /status — check backend connection
bot.command("status", async (ctx) => {
  try {
    const chatId = ctx.chat.id;
    const resp = await axios.get(`${BACKEND_BASE}/bot/status`, {
      params: { chat_id: chatId, user_id: ctx.from.id },
    });
    await ctx.reply(JSON.stringify(resp.data) || "✅ Backend online!");
  } catch (err) {
    console.error("Status Error:", err.message);
    await ctx.reply("❌ Could not reach backend.");
  }
});

// ✅ /register — simplified registration flow
bot.command("register", async (ctx) => {
  const chat = ctx.chat;
  const tgid = chat.id;
  const userId = ctx.from.id;

  // 🛑 If user tries to register in DM
  if (chat.type === "private") {
    await ctx.reply(
      "⚠️ GroupSOL registration can only be done **inside a Telegram group**.\n\n👉 Please **add this bot to your group** and then run /register there."
    );
    return;
  }

  try {
    await ctx.reply("🕐 Initiating group registration...");

    const res = await axios.post(
      `${BACKEND_BASE_EXPRESS}/api/groups/register`,
      {
        tgid,
        userId,
      }
    );

    await ctx.reply(
      `✅ Group Registered Successfully!\n\n<b>TGID:</b> <code>${tgid}</code>\n<b>Admin UserID:</b> <code>${userId}</code>\n\n<b>Response:</b> <code>${JSON.stringify(
        res.data
      )}</code>`,
      { parse_mode: "HTML" }
    );
  } catch (err) {
    //console.error("Registration Error:", err);
    await ctx.reply(
      `❌ Registration failed.\n\n` +
        `Error: ${err.response?.data?.error || err.message}\n\n`
    );
  }
});



// ✅ /test — test trade with group wallet
bot.command("test", async (ctx) => {
  const chat = ctx.chat;
  const tgid = chat.id;
  const userId = ctx.from.id;

  if (chat.type === "private") {
    await ctx.reply("⚠️ This command can only be used in registered groups.");
    return;
  }

  try {
    // Check if user is admin
    const groupResp = await axios.get(
      `${BACKEND_BASE_EXPRESS}/api/groups/${tgid}`
    );

    if (!groupResp.data.success) {
      await ctx.reply("❌ Group not registered. Use /register first.");
      return;
    }

    const group = groupResp.data.data;
    const isAdmin =
      group.owner === userId.toString() || group.admin.includes(userId.toString());

    if (!isAdmin) {
      await ctx.reply("❌ Only group admins can run test trades.");
      return;
    }

    await ctx.reply("🔄 Checking wallet balance...");

    // Check balance
    const balanceResp = await axios.get(
      `${BACKEND_BASE_EXPRESS}/api/test/balance/${tgid}`
    );

    if (!balanceResp.data.success) {
      await ctx.reply(`❌ ${balanceResp.data.error}`);
      return;
    }

    const balance = balanceResp.data.data;

    await ctx.reply(
      `💰 Wallet Balance:\n\n` +
        `<b>Address:</b> <code>${balance.wallet}</code>\n` +
        `<b>Balance:</b> ${balance.balance} SOL\n` +
        `<b>Network:</b> ${balance.cluster}\n\n` +
        `${balance.canTrade ? "✅ Ready to trade" : "❌ Insufficient balance (need at least 0.02 SOL)"}`,
      { parse_mode: "HTML" }
    );

    if (!balance.canTrade) {
      return;
    }

    await ctx.reply("🔄 Executing test trade (0.01 SOL -> MALONEY token)...");

    // Execute trade
    const tradeResp = await axios.post(
      `${BACKEND_BASE_EXPRESS}/api/test/trade`,
      {
        tgid,
      }
    );

    if (!tradeResp.data.success) {
      await ctx.reply(`❌ Trade failed: ${tradeResp.data.error}`);
      return;
    }

    const trade = tradeResp.data.data;

    await ctx.reply(
      `✅ Test Trade Successful!\n\n` +
        `<b>From:</b> ${trade.trade.inputAmount} ${trade.trade.inputToken}\n` +
        `<b>To:</b> ${trade.trade.outputAmount} ${trade.trade.outputToken}\n` +
        `<b>Min Output:</b> ${trade.trade.minimumOut}\n\n` +
        `<b>Transactions:</b>\n` +
        trade.transactions
          .map(
            (tx, i) =>
              `${i + 1}. <a href="${tx.explorer}">View on Explorer</a>`
          )
          .join("\n"),
      { parse_mode: "HTML", disable_web_page_preview: true }
    );
  } catch (err) {
    console.error("Test trade error:", err.response?.data || err.message);
    await ctx.reply(
      `❌ Test trade failed:\n${err.response?.data?.error || err.message}`
    );
  }
});



// ✅ /echo — test backend roundtrip
bot.command("echo", async (ctx) => {
  const text = ctx.message.text.split(" ").slice(1).join(" ");
  if (!text) return ctx.reply("Usage: /echo <message>");
  try {
    const resp = await axios.post(`${BACKEND_BASE}/bot/echo`, {
      text,
      user: ctx.from.username,
    });
    await ctx.reply(resp.data?.result || text);
  } catch (e) {
    console.error(e.message);
    await ctx.reply("Backend error while echoing.");
  }
});

// ✅ Auto-approve join requests for registered groups (when using join-request invite links)
bot.on('chat_join_request', async (ctx) => {
  try {
    const chatId = ctx.update.chat_join_request.chat.id;
    const requester = ctx.update.chat_join_request.from;

    // Check if the group is registered in our backend
    const resp = await axios.get(`${BACKEND_BASE_EXPRESS}/api/groups/${chatId}`);
    const isRegistered = !!resp.data?.success;

    if (!isRegistered) {
      console.log(`Join request for unregistered chat ${chatId}, ignoring`);
      return;
    }

    // Approve the join request
    await ctx.telegram.approveChatJoinRequest(chatId, requester.id);
    console.log(`Approved join request for user ${requester.id} in chat ${chatId}`);
  } catch (err) {
    console.error('Failed to approve chat join request:', err.response?.data || err.message);
  }
});

// ✅ /buy — send SOL test transaction
bot.command("buy", async (ctx) => {
  const address = ctx.message.text.split(" ")[1];
  if (!address) return ctx.reply("Usage: /buy <solana_address>");
  try {
    const sig = await sendSol(address, 0.01);
    ctx.reply(
      `✅ Sent 0.01 SOL!\nTx: https://explorer.solana.com/tx/${sig}?cluster=devnet`
    );
  } catch (e) {
    ctx.reply("❌ Transaction failed: " + e.message);
  }
});

// ✅ Governance / Voting System
// ✅ /create_session — Admin only, requires user account, ONE SESSION PER GROUP
bot.command("create_session", async (ctx) => {
  const chat = ctx.chat;
  const tgid = chat.id;
  const userId = ctx.from.id;
  const username = ctx.from.username;
console.log("Create session command by user:", userId, "in chat:", tgid);
  // 🛑 Only works in groups
  if (chat.type === "private") {
    return ctx.reply("⚠️ Sessions can only be created in registered groups.");
  }

  try {
    // 1️⃣ Check if group is registered
    const groupResp = await axios.get(`${BACKEND_BASE_EXPRESS}/api/groups/${tgid}`);

    if (!groupResp.data.success) {
      return ctx.reply("❌ Group not registered. Use /register first.");
    }

    const group = groupResp.data.data;

    // 2️⃣ Check if user is admin/owner
    const isAdmin = group.owner === userId.toString() ||
                    (group.admin && group.admin.includes(userId.toString()));

    if (!isAdmin) {
      return ctx.reply("❌ Only group admins can create sessions.");
    }

    // 3️⃣ Check if user has a registered account
    const userResp = await axios.get(
      `${BACKEND_BASE_EXPRESS}/api/users/${userId}`
    );

    if (!userResp.data.success) {
      return ctx.reply(
        "❌ You need to register first!\n\n" +
        "👉 Send /start in DM to this bot to create your account."
      );
    }
    console.log("User is registered:", userResp.data.data);
    // 🔒 4️⃣ Check if there's already an active session in this group
    const activeSessionInGroup = await findActiveSession(tgid);
    console.log("Active session in group check:", activeSessionInGroup);
    if (activeSessionInGroup) {
      return ctx.reply(
        "⚠️ A session is already running in this group!\n\n" +
        "Please wait for it to complete before creating a new one."
      );
    }

    // 5️⃣ Parse session parameters
    const args = ctx.message.text.match(/"([^"]+)"\s*(\d+)?/);
    if (!args) {
      return ctx.reply(
        'Usage: /create_session "message text" <voting time in min>\n\n' +
        'Example: /create_session "Buy BONK token" 5'
      );
    }

    const sessionMsg = args[1];
    const votingTimeMin = args[2] ? parseInt(args[2]) : 1;
    const sessionId = Date.now().toString();
    console.log("Creating session ID:", sessionId);
    // 6️⃣ Create session in backend
    await axios.post(`${BACKEND_BASE_EXPRESS}/api/sessions`, {
      session_id: sessionId,
      tgid,
      created_by: userId.toString(),
      type: "buy",
      participants: []
    });

    // 7️⃣ Store session in Redis
    const sessionData = {
      message: sessionMsg,
      participants: [],
      votes: {},
      chatId: tgid,
      msgId: null,
      open: true,
      createdBy: userId,
      createdByUsername: username,
      proposals: []
    };
    console.log("Creating session:", sessionId, sessionData);
    await saveSession(sessionId, sessionData);

    const sentMsg = await ctx.reply(
      `📋 Session Created by @${username || ctx.from.first_name}\n\n` +
      `"${sessionMsg}"\n\n` +
      `Who wants to participate? (15s to respond)`,
      Markup.inlineKeyboard([
        [
          Markup.button.callback("✅ Join", `join_${sessionId}`),
          Markup.button.callback("❌ Skip", `no_${sessionId}`),
        ],
      ])
    );

    await updateSession(sessionId, { msgId: sentMsg.message_id });

    setTimeout(async () => {
      const session = await getSession(sessionId);
      if (!session) return;

      await bot.telegram.editMessageReplyMarkup(
        session.chatId,
        session.msgId,
        undefined,
        null
      );

      const participantsList = session.participants.length > 0
        ? session.participants.join(", ")
        : "None";

      await bot.telegram.sendMessage(
        session.chatId,
        `✅ Session Started!\n\n` +
        `Participants: ${participantsList}\n\n` +
        `Use /propose "text" <voting_time_min> to create a proposal.`
      );
    }, 15000);

  } catch (err) {
    console.error("Create session error:", err.response?.data || err.message);
    await ctx.reply(
      `❌ Failed to create session:\n${err.response?.data?.error || err.message}`
    );
  }
});

// ✅ /close_session — Admin only, closes active session
bot.command("close_session", async (ctx) => {
  const chat = ctx.chat;
  const tgid = chat.id;
  const userId = ctx.from.id;

  if (chat.type === "private") {
    return ctx.reply("⚠️ This command only works in groups.");
  }

  try {
    // Check if user is admin
    const groupResp = await axios.get(`${BACKEND_BASE_EXPRESS}/api/groups/${tgid}`);
    
    if (!groupResp.data.success) {
      return ctx.reply("❌ Group not registered.");
    }

    const group = groupResp.data.data;
    const isAdmin = group.owner === userId.toString() || 
                    (group.admin && group.admin.includes(userId.toString()));

    if (!isAdmin) {
      return ctx.reply("❌ Only group admins can close sessions.");
    }

    // Find active session in this group
    const activeSession = await findActiveSession(tgid);

    if (!activeSession) {
      return ctx.reply("⚠️ No active session to close.");
    }

    const sessionId = activeSession.sessionId;

    // Close all open proposals
    if (activeSession.proposals) {
      const updatedProposals = activeSession.proposals.map(p => ({ ...p, open: false }));
      await updateSession(sessionId, { open: false, proposals: updatedProposals });
    } else {
      await updateSession(sessionId, { open: false });
    }

    await ctx.reply(
      `🔒 Session closed by admin.\n\n` +
      `Participants: ${activeSession.participants.length}\n` +
      `Proposals: ${activeSession.proposals?.length || 0}`
    );

  } catch (err) {
    console.error("Close session error:", err);
    await ctx.reply("❌ Failed to close session.");
  }
});

// ...existing code...

// ✅ /propose — Participants only, 5-10 min max duration, can't be closed early
bot.command("propose", async (ctx) => {
  const chat = ctx.chat;
  const tgid = chat.id;
  const userId = ctx.from.id;
  const username = ctx.from.username ? `@${ctx.from.username}` : ctx.from.first_name;

  // 🛑 Only works in groups
  if (chat.type === "private") {
    return ctx.reply("⚠️ Proposals can only be created in groups.");
  }

  try {
    // 1️⃣ Parse proposal parameters — enforce structured ACTION syntax
    const args = ctx.message.text.match(/"([^"]+)"\s*(\d+)?/);
    if (!args) {
      return ctx.reply(
        'Usage: /propose "ACTION" <voting time in min>\n\n' +
          'ACTION syntax:\n' +
          '  BUY: BUY token=<mint_or_symbol> amount=<total_sol> price=market\n' +
          '  SELL: SELL order=<order_id>\n\n' +
          'Examples:\n' +
          '  /propose "BUY token=MALONEY amount=0.05 price=market" 5\n' +
          '  /propose "SELL order=order_1761379627522" 5\n\n' +
          '⏱ Voting time must be between 1-10 minutes'
      );
    }

    const proposalRaw = args[1].trim();
    const votingTimeMin = args[2] ? parseInt(args[2]) : 5; // Default 5 min

    // 2️⃣ Validate voting time (1-10 min)
    if (votingTimeMin < 1 || votingTimeMin > 10) {
      return ctx.reply("⚠️ Voting time must be between 1 and 10 minutes!");
    }

    // 3️⃣ Find active session in this group
    const sessionData = await findActiveSession(tgid);

    if (!sessionData) {
      return ctx.reply("❌ No active session to propose in.\n\nUse /create_session first.");
    }

    const sessionId = sessionData.sessionId;
    const session = sessionData;

    // 4️⃣ Check if user is a participant
    if (!session.participants.includes(username)) {
      return ctx.reply(
        "❌ Only session participants can create proposals!\n\n" +
        `Current participants: ${session.participants.join(", ") || "None"}`
      );
    }

    // 5️⃣ Check if there's already an active proposal
    const activeProposal = await findActiveProposal(sessionId);
    if (activeProposal) {
      return ctx.reply(
        "⚠️ Wait for the current proposal to finish before adding a new one."
      );
    }

    // 6️⃣ Parse action type (BUY or SELL)
    const actionType = proposalRaw.split(/\s+/)[0]?.toUpperCase();
    
    if (actionType === "SELL") {
      // Handle SELL proposal
      const orderIdMatch = proposalRaw.match(/order[=:]?\s*([^\s]+)/i);
      if (!orderIdMatch) {
        return ctx.reply(
          'Invalid SELL syntax.\n\n' +
          'Expected: SELL order=<order_id>\n' +
          'Example: "SELL order=order_1761379627522"'
        );
      }

      const orderId = orderIdMatch[1].trim();

      // Verify order exists and belongs to this group
      const orderResp = await axios.get(
        `${BACKEND_BASE_EXPRESS}/api/orders/${orderId}`
      );

      if (!orderResp.data.success) {
        return ctx.reply(`❌ Order not found: ${orderId}`);
      }

      const order = orderResp.data.data;

      if (order.tgid !== tgid.toString()) {
        return ctx.reply("❌ This order doesn't belong to this group.");
      }

      if (order.status !== "completed") {
        return ctx.reply("❌ Can only sell completed orders.");
      }

      // Get order participants
      const participantsResp = await axios.get(
        `${BACKEND_BASE_EXPRESS}/api/orders/${orderId}/participants`
      );

      if (!participantsResp.data.success) {
        return ctx.reply("❌ Failed to fetch order participants.");
      }

      const orderParticipants = participantsResp.data.data;

      // Check if current user is a participant in this order
      const userResp = await axios.get(
        `${BACKEND_BASE_EXPRESS}/api/users/${userId}`
      );

      if (!userResp.data.success) {
        return ctx.reply("❌ User not found.");
      }

      const userUtgid = userResp.data.data.telegram.userId;
      const isOrderParticipant = orderParticipants.some(
        p => p.utgid === userUtgid
      );

      if (!isOrderParticipant) {
        return ctx.reply(
          "❌ Only participants of this order can propose to sell it.\n\n" +
          `Order participants: ${orderParticipants.length}`
        );
      }

      // Create SELL proposal
      const proposalId = Date.now().toString();
      const proposal = {
        id: proposalId,
        text: proposalRaw,
        type: "sell",
        orderId: orderId,
        orderParticipants: orderParticipants.map(p => p.utgid),
        votes: {},
        open: true,
        createdBy: userId,
        createdByUsername: username,
        duration: votingTimeMin,
        startTime: Date.now(),
        endTime: Date.now() + (votingTimeMin * 60 * 1000),
      };

      // Add proposal to Redis session
      await addProposal(sessionId, proposal);

      // Save proposal to backend
      await axios.post(`${BACKEND_BASE_EXPRESS}/api/proposals`, {
        proposal_id: proposalId,
        session_id: sessionId,
        tgid,
        created_by: userId.toString(),
        proposal_text: proposalRaw,
        type: "sell",
        duration: votingTimeMin,
        target_token: order.token_symbol,
        target_price: null,
        price_type: "market",
        amount_requested: null,
        participants: orderParticipants.map(p => p.utgid),
      });

      // Send proposal message
      await ctx.reply(
        `🗳 SELL Proposal Created by ${username}\n\n` +
        `"${proposalRaw}"\n\n` +
        `📦 Order Details:\n` +
        `• Token: ${order.token_symbol}\n` +
        `• Total Tokens: ${parseFloat(order.token_amount).toFixed(2)}\n` +
        `• Participants: ${orderParticipants.length}\n` +
        `• Status: ${order.status}\n\n` +
        `⏱ Voting open for ${votingTimeMin} minutes\n\n` +
        `⚠️ Only order participants can vote!\n` +
        `Vote using: /vote yes or /vote no\n\n` +
        `⚠️ This proposal cannot be closed early!`
      );

      // Auto-close after voting time
      setTimeout(async () => {
        await handleSellProposalEnd(proposalId, sessionId, order);
      }, votingTimeMin * 60 * 1000);

    } else {
      // Handle BUY proposal (existing logic)
      const action = parseProposalAction(proposalRaw);
      if (!action || !action.type || !action.token) {
        return ctx.reply(
          'Invalid action syntax.\n\n' +
            'Expected: BUY token=<mint> amount=<sol> price=market|target:<price>\n' +
            'Example: "BUY token=So11111111111111111111111111111111111111112 amount=0.05 price=market"'
        );
      }

      const proposalText = proposalRaw;

      // Create BUY proposal
      const proposalId = Date.now().toString();
      const proposal = {
        id: proposalId,
        text: proposalText,
        type: "buy",
        votes: {},
        open: true,
        createdBy: userId,
        createdByUsername: username,
        duration: votingTimeMin,
        startTime: Date.now(),
        endTime: Date.now() + (votingTimeMin * 60 * 1000),
      };

      // Add proposal to Redis session
      await addProposal(sessionId, proposal);

      function normalizeActionPrice(priceVal) {
        if (!priceVal) return null;
        if (typeof priceVal === 'string') {
          const p = priceVal.toLowerCase();
          if (p === 'market') return null;
          const m = p.match(/^target:(\d+(?:\.\d+)?)$/);
          if (m) return Number(m[1]);
          const num = Number(priceVal);
          if (!Number.isNaN(num)) return num;
          return null;
        }
        if (typeof priceVal === 'number') return priceVal;
        return null;
      }

      const normalizedPrice = normalizeActionPrice(action.price);

      // Save proposal to backend
      await axios.post(`${BACKEND_BASE_EXPRESS}/api/proposals`, {
        proposal_id: proposalId,
        session_id: sessionId,
        tgid,
        created_by: userId.toString(),
        proposal_text: proposalText,
        type: action.type,
        duration: votingTimeMin,
        target_token: action.token,
        target_price: normalizedPrice,
        price_type: normalizedPrice === null ? 'market' : 'target',
        amount_requested: action.amount || null,
        participants: session.participants,
      });

      // Send proposal message
      await ctx.reply(
        `🗳 Proposal Created by ${username}\n\n` +
        `"${proposalText}"\n\n` +
        `⏱ Voting open for ${votingTimeMin} minutes\n` +
        `👥 Participants: ${session.participants.length}\n\n` +
        `Vote using: /vote yes <amount> or /vote no\n` +
        `Example: /vote yes 0.05\n\n` +
        `⚠️ This proposal cannot be closed early!`
      );

      // Auto-close after voting time (existing BUY logic)
      setTimeout(async () => {
        await handleBuyProposalEnd(proposalId, sessionId, tgid);
      }, votingTimeMin * 60 * 1000);
    }

  } catch (err) {
    console.error("Propose error:", err.response?.data || err.message);
    await ctx.reply(
      `❌ Failed to create proposal:\n${err.response?.data?.error || err.message}`
    );
  }
});

// Handle BUY proposal end (existing logic extracted into function)
async function handleBuyProposalEnd(proposalId, sessionId, tgid) {
  // Get latest proposal and session data from Redis
  const proposal = await getProposal(sessionId, proposalId);
  const session = await getSession(sessionId);

  if (!proposal || !session) {
    console.error("Proposal or session not found:", proposalId, sessionId);
    return;
  }

  // Close the proposal
  await updateProposal(sessionId, proposalId, { open: false });

  const votesArr = Object.values(proposal.votes || {});
  const yesVotes = votesArr.filter((v) => v.vote === "yes");
  const noVotes = votesArr.filter((v) => v.vote === "no");
  const yesCount = yesVotes.length;
  const noCount = noVotes.length;
  const total = yesCount + noCount;
  const abstained = session.participants.length - total;

  const totalYesAmount = yesVotes.reduce((sum, v) => sum + (v.amount || 0), 0);

  const voterList =
    Object.entries(proposal.votes || {})
      .map(([user, voteData]) => {
        if (typeof voteData === 'string') {
          return `${user}: ${voteData}`;
        }
        return `${user}: ${voteData.vote.toUpperCase()}(${voteData.amount || 0} SOL)`;
      })
      .join("\n") || "No votes cast.";

  let summary = 
    `⏰ Voting Ended for: "${proposal.text}"\n\n` +
    `📊 Results:\n` +
    `✅ Yes: ${yesCount} (${totalYesAmount.toFixed(3)} SOL)\n` +
    `❌ No: ${noCount}\n` +
    `⏭ Abstained: ${abstained}\n` +
    `📈 Total Votes: ${total}/${session.participants.length}\n\n` +
    `${voterList}`;

  const approved = total > 0 && yesCount > noCount;

  if (approved && yesCount > 0) {
    // Execute BUY (existing fund collection + trade logic)
    try {
      await bot.telegram.sendMessage(
        session.chatId,
        "💰 Proposal approved! Collecting funds from YES voters..."
      );

      const groupResp = await axios.get(
        `${BACKEND_BASE_EXPRESS}/api/groups/${tgid}`
      );

      if (!groupResp.data.success) {
        throw new Error("Failed to get group info");
      }

      const group = groupResp.data.data;
      const poolPda = group.pool_pda;
      const relayAccount = group.relay_account;

      const yesVotersData = Object.entries(proposal.votes)
        .filter(([user, voteData]) => {
          const vote = typeof voteData === 'string' ? voteData : voteData.vote;
          return vote === "yes";
        })
        .map(([user, voteData]) => ({
          username: user,
          amount: typeof voteData === 'object' ? voteData.amount : 0.01,
        }));

      if (yesVotersData.length === 0) {
        throw new Error("No YES votes to collect funds from");
      }

      const fundCollectionResp = await axios.post(
        `${BACKEND_BASE_EXPRESS}/api/proposals/${proposalId}/collect-funds`,
        {
          tgid,
          proposal_id: proposalId,
          yes_voters: yesVotersData,
          pool_pda: poolPda,
          relay_account: relayAccount,
        }
      );

      if (fundCollectionResp.data.success) {
        const result = fundCollectionResp.data.data;
        
        summary += 
          `\n\n✅ PROPOSAL APPROVED & FUNDED!\n\n` +
          `💰 Fund Collection:\n` +
          `• Total Collected: ${result.totalCollected.toFixed(4)} SOL\n` +
          `• Participants Paid: ${result.successfulTransfers}\n` +
          `• Failed: ${result.failedTransfers}\n` +
          `🏦 Pool PDA: ${poolPda.substring(0, 8)}...${poolPda.substring(poolPda.length - 8)}\n` +
          `📡 Relay Account: ${relayAccount.substring(0, 8)}...${relayAccount.substring(relayAccount.length - 8)}\n\n` +
          `🔗 Transaction: ${result.signature.substring(0, 16)}...`;

        (async () => {
          try {
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            const tradeResp = await axios.post(
              `${BACKEND_BASE_EXPRESS}/api/test/trade`,
              {
                tgid: tgid,
                amount: totalYesAmount,
                proposal_id: proposalId,
                yes_voters: yesVotersData,
              }
            );

            if (tradeResp.data?.success) {
              const trade = tradeResp.data.data;
              
              let message = `🔁 Trade Executed Successfully!\n\n📝 Order ID: ${trade.orderId}\n\n`;
              
              if (trade.trade.feesDeductedFromTrade) {
                message += `⚠️ Fees deducted from trade amount\n\n`;
              }
              
              message += `📊 Swap Details:\n` +
                `• Input: ${trade.trade.actualTradeAmount || trade.trade.inputAmount} ${trade.trade.inputToken}\n` +
                `• Output: ${trade.trade.outputAmount} ${trade.trade.outputToken}\n` +
                `• Min Output: ${trade.trade.minimumOut}\n\n` +
                `💰 Cost: ${trade.trade.actualSpent} SOL (${trade.trade.actualTradeAmount || trade.trade.inputAmount} trade + ${trade.trade.totalFees} fees)\n\n` +
                `🔗 Transactions:\n` +
                trade.transactions.map((tx, i) => `${i + 1}. ${tx.explorer}`).join("\n");

              await bot.telegram.sendMessage(session.chatId, message);
            }
          } catch (tradeErr) {
            console.error("Trade execution failed:", tradeErr.response?.data || tradeErr.message);
            await bot.telegram.sendMessage(
              session.chatId,
              `❌ Trade execution failed: ${tradeErr.response?.data?.error || tradeErr.message}`
            );
          }
        })();
      }
    } catch (fundError) {
      summary += 
        `\n\n⚠️ Proposal approved but fund collection failed:\n` +
        `${fundError.response?.data?.error || fundError.message}`;
    }
  } else if (approved) {
    summary += "\n\n✅ Proposal approved but no funds to collect (no YES votes with amounts).";
  } else {
    summary += "\n\n❌ Proposal NOT approved (more NO votes or tie).";
  }

  await axios.put(`${BACKEND_BASE_EXPRESS}/api/proposals/${proposalId}`, {
    status: approved ? "approved" : "rejected",
    ended_at: new Date().toISOString(),
  });

  await bot.telegram.sendMessage(session.chatId, summary);
}

// Handle SELL proposal end
async function handleSellProposalEnd(proposalId, sessionId, order) {
  // Get latest proposal and session data from Redis
  const proposal = await getProposal(sessionId, proposalId);
  const session = await getSession(sessionId);

  if (!proposal || !session) {
    console.error("Proposal or session not found:", proposalId, sessionId);
    return;
  }

  // Close the proposal
  await updateProposal(sessionId, proposalId, { open: false });

  const votesArr = Object.values(proposal.votes || {});
  const yesVotes = votesArr.filter((v) => v.vote === "yes");
  const noVotes = votesArr.filter((v) => v.vote === "no");
  const yesCount = yesVotes.length;
  const noCount = noVotes.length;
  const total = yesCount + noCount;
  const orderParticipantsCount = proposal.orderParticipants.length;
  const abstained = orderParticipantsCount - total;

  const voterList =
    Object.entries(proposal.votes || {})
      .map(([user, voteData]) => {
        const vote = typeof voteData === 'string' ? voteData : voteData.vote;
        return `${user}: ${vote.toUpperCase()}`;
      })
      .join("\n") || "No votes cast.";

  let summary = 
    `⏰ Voting Ended for: "${proposal.text}"\n\n` +
    `📊 Results:\n` +
    `✅ Yes: ${yesCount}\n` +
    `❌ No: ${noCount}\n` +
    `⏭ Abstained: ${abstained}\n` +
    `📈 Total Votes: ${total}/${orderParticipantsCount}\n\n` +
    `${voterList}`;

  const approved = total > 0 && yesCount > noCount;

  if (approved) {
    // Execute SELL
    try {
      await bot.telegram.sendMessage(
        session.chatId,
        `💰 SELL proposal approved! Executing sell order for ${order.token_symbol}...`
      );

      // Call backend to execute sell
      const sellResp = await axios.post(
        `${BACKEND_BASE_EXPRESS}/api/proposals/${proposal.id}/execute-sell`,
        {
          order_id: proposal.orderId,
          tgid: session.chatId,
        }
      );

      if (sellResp.data.success) {
        const sellData = sellResp.data.data;
        
        summary += 
          `\n\n✅ SELL EXECUTED!\n\n` +
          `💰 Sell Details:\n` +
          `• Token Sold: ${sellData.tokensSold} ${order.token_symbol}\n` +
          `• SOL Received: ${sellData.solReceived.toFixed(4)} SOL\n` +
          `• Fees: ${sellData.fees.toFixed(6)} SOL\n` +
          `• Net Proceeds: ${sellData.netProceeds.toFixed(4)} SOL\n\n` +
          `📤 Distributions: ${sellData.distributions.length}\n` +
          `🔗 Transaction: ${sellData.txSignature.substring(0, 16)}...`;
      }

    } catch (sellError) {
      console.error("Sell execution error:", sellError);
      summary += 
        `\n\n⚠️ Proposal approved but sell execution failed:\n` +
        `${sellError.response?.data?.error || sellError.message}`;
    }
  } else {
    summary += "\n\n❌ SELL NOT approved (more NO votes or tie). Tokens remain in custody.";
  }

  await axios.put(`${BACKEND_BASE_EXPRESS}/api/proposals/${proposal.id}`, {
    status: approved ? "approved" : "rejected",
    ended_at: new Date().toISOString(),
  });

  await bot.telegram.sendMessage(session.chatId, summary);
}

// ...existing code...

// ✅ /vote — Modified to handle SELL proposals
bot.command("vote", async (ctx) => {
  const chat = ctx.chat;
  const tgid = chat.id;
  const userId = ctx.from.id;
  const username = ctx.from.username ? `@${ctx.from.username}` : ctx.from.first_name;

  if (chat.type === "private") {
    return ctx.reply("⚠️ Voting only works in groups.");
  }

  try {
    // 1️⃣ Parse vote: /vote yes 0.05 or /vote no
    const args = ctx.message.text.split(" ");
    const vote = args[1]?.toLowerCase();
    const amount = args[2] ? parseFloat(args[2]) : 0.01;
    
    if (!["yes", "no"].includes(vote)) {
      return ctx.reply(
        "Usage: /vote yes <amount> or /vote no\n\n" +
        "Examples:\n" +
        "• /vote yes 0.05 (for BUY proposals)\n" +
        "• /vote yes (for SELL proposals)\n" +
        "• /vote no"
      );
    }

    // 2️⃣ Find active session
    const sessionData = await findActiveSession(tgid);

    if (!sessionData) {
      return ctx.reply("❌ No active session to vote in.");
    }

    const sessionId = sessionData.sessionId;
    const session = sessionData;

    // 4️⃣ Find active proposal
    const proposal = await findActiveProposal(sessionId);

    if (!proposal) {
      return ctx.reply("❌ No active proposal to vote on.");
    }

    // 5️⃣ Check if proposal is SELL type
    if (proposal.type === "sell") {
      // For SELL proposals, only order participants can vote
      const userResp = await axios.get(
        `${BACKEND_BASE_EXPRESS}/api/users/${userId}`
      );

      if (!userResp.data.success) {
        return ctx.reply("❌ User not found.");
      }

      const userUtgid = userResp.data.data.telegram.userId;
      
      if (!proposal.orderParticipants.includes(userUtgid)) {
        return ctx.reply(
          "❌ Only participants of this order can vote on this SELL proposal!"
        );
      }

      // Check if already voted
      if (proposal.votes[username]) {
        return ctx.reply(
          `⚠️ You already voted: ${proposal.votes[username].vote.toUpperCase()}\n\n` +
          "You cannot change your vote!"
        );
      }

      // Record vote (no amount for SELL)
      await addVote(sessionId, proposal.id, username, { vote, amount: 0 });

      await axios.post(`${BACKEND_BASE_EXPRESS}/api/votes`, {
        proposal_id: proposal.id,
        utgid: userUtgid,
        vote_type: vote,
        amount: 0,
        weight: 1,
      });

      // Get updated proposal to show current vote counts
      const updatedProposal = await getProposal(sessionId, proposal.id);
      const votesCount = Object.keys(updatedProposal.votes).length;
      const yesVotes = Object.values(updatedProposal.votes).filter(v => v.vote === "yes");
      const noVotes = Object.values(updatedProposal.votes).filter(v => v.vote === "no");

      await ctx.reply(
        `✅ Vote recorded: ${vote.toUpperCase()}\n\n` +
        `📊 Current Status:\n` +
        `✅ Yes: ${yesVotes.length}\n` +
        `❌ No: ${noVotes.length}\n` +
        `📈 Votes: ${votesCount}/${proposal.orderParticipants.length}\n\n` +
        `⏱ Time remaining: ${Math.ceil((proposal.endTime - Date.now()) / 60000)} minutes`
      );

    } else {
      // Handle BUY proposal voting (existing logic)
      
      // 3️⃣ Check if user is a participant
      if (!session.participants.includes(username)) {
        return ctx.reply(
          "❌ Only session participants can vote!\n\n" +
          `Current participants: ${session.participants.join(", ") || "None"}`
        );
      }

      if (vote === "yes" && (amount < 0.001 || amount > 1)) {
        return ctx.reply("⚠️ Vote amount must be between 0.001 and 1 SOL");
      }

      // 5️⃣ Check if already voted
      if (proposal.votes[username]) {
        const existingVote = proposal.votes[username];
        const voteDisplay = typeof existingVote === 'string' 
          ? existingVote 
          : `${existingVote.vote.toUpperCase()} (${existingVote.amount} SOL)`;
        
        return ctx.reply(
          `⚠️ You already voted: ${voteDisplay}\n\n` +
          "You cannot change your vote!"
        );
      }

      // 6️⃣ Check user's custodial wallet balance if voting YES
      if (vote === "yes") {
        try {
          const userResp = await axios.get(
            `${BACKEND_BASE_EXPRESS}/api/users/${userId}`
          );

          if (!userResp.data.success) {
            return ctx.reply(
              "❌ You need to register first!\n\n" +
              "👉 Send /start in DM to this bot to create your account."
            );
          }

          const user = userResp.data.data;
          const custodialBalance = user.wallets?.custodial?.balance || 0;
          const requiredAmount = amount + 0.001;

          if (custodialBalance < requiredAmount) {
            return ctx.reply(
              `⚠️ Insufficient balance in custodial wallet!\n\n` +
              `Required: ${requiredAmount.toFixed(4)} SOL (${amount} + 0.001 fee)\n` +
              `Available: ${custodialBalance.toFixed(4)} SOL\n\n` +
              `Please deposit more SOL to your custodial wallet.`
            );
          }
        } catch (balanceError) {
          console.error("Balance check error:", balanceError);
          return ctx.reply(
            "❌ Could not verify your wallet balance. Please try again."
          );
        }
      }

      // 7️⃣ Record vote
      await addVote(sessionId, proposal.id, username, { vote, amount: vote === "yes" ? amount : 0 });

      await axios.post(`${BACKEND_BASE_EXPRESS}/api/votes`, {
        proposal_id: proposal.id,
        utgid: userId.toString(),
        vote_type: vote,
        amount: vote === "yes" ? amount : 0,
        weight: 1,
      });

      // Get updated proposal to show current vote counts
      const updatedProposalBuy = await getProposal(sessionId, proposal.id);
      const votesCount = Object.keys(updatedProposalBuy.votes).length;
      const totalParticipants = session.participants.length;

      const yesVotes = Object.values(updatedProposalBuy.votes).filter(v => {
        const voteType = typeof v === 'string' ? v : v.vote;
        return voteType === "yes";
      });

      const noVotes = Object.values(updatedProposalBuy.votes).filter(v => {
        const voteType = typeof v === 'string' ? v : v.vote;
        return voteType === "no";
      });

      const yesCount = yesVotes.length;
      const noCount = noVotes.length;
      
      const totalYesAmount = yesVotes.reduce((sum, v) => {
        return sum + (typeof v === 'object' ? v.amount : 0);
      }, 0);

      await ctx.reply(
        `✅ Vote recorded: ${vote.toUpperCase()}${vote === "yes" ? ` (${amount} SOL)` : ""}\n\n` +
        `📊 Current Status:\n` +
        `✅ Yes: ${yesCount} (${totalYesAmount.toFixed(3)} SOL)\n` +
        `❌ No: ${noCount}\n` +
        `📈 Votes: ${votesCount}/${totalParticipants}\n\n` +
        `⏱ Time remaining: ${Math.ceil((proposal.endTime - Date.now()) / 60000)} minutes`
      );
    }

  } catch (err) {
    console.error("Vote error:", err.response?.data || err.message);
    await ctx.reply("❌ Failed to record vote.");
  }
});

// ...existing code...

// ✅ /groupstatus — show group's trading activity and orders
bot.command("groupstatus", async (ctx) => {
  const chat = ctx.chat;
  const tgid = chat.id;

  if (chat.type === "private") {
    return ctx.reply("⚠️ This command only works in groups.");
  }

  try {
    // Get group info
    const groupResp = await axios.get(
      `${BACKEND_BASE_EXPRESS}/api/groups/${tgid}`
    );

    if (!groupResp.data.success) {
      return ctx.reply("❌ Group not registered. Use /register first.");
    }

    const group = groupResp.data.data;

    // Get group's orders
    const ordersResp = await axios.get(
      `${BACKEND_BASE_EXPRESS}/api/groups/${tgid}/orders`
    );

    if (!ordersResp.data.success) {
      return ctx.reply("❌ Failed to fetch orders.");
    }

    const orders = ordersResp.data.data;

    // Build status message
    let message = `📊 <b>Group Trading Status</b>\n\n`;
    message += `<b>Group ID:</b> <code>${tgid}</code>\n\n`;

    if (orders.length === 0) {
      message += `<i>No trading activity yet.</i>\n\n`;
      message += `Use /create_session to start trading!`;
    } else {
      message += `<b>📦 Recent Orders (${orders.length})</b>\n\n`;

      orders.slice(0, 5).forEach((order, i) => {
        const date = new Date(order.created_at).toLocaleString();
        message += `${i + 1}. <b>${order.token_symbol}</b>\n`;
       message += `   • Order ID: <code>${order.order_id}</code>\n`;
        message += `   • Amount: ${order.total_amount_spent} SOL\n`;
        message += `   • Tokens: ${parseFloat(order.token_amount).toFixed(2)}\n`;
        message += `   • Status: ${order.status}\n`;
        message += `   • Participants: ${order.participant_count || 0}\n`;
        message += `   • Date: ${date}\n`;
        if (order.transaction_hash) {
          message += `   • TX: <code>${order.transaction_hash}</code>\n`;
          message += `   • <a href="https://explorer.solana.com/tx/${order.transaction_hash}?cluster=devnet">View on Explorer</a>\n`;
        }
        message += `\n`;
      });

      if (orders.length > 5) {
        message += `<i>...and ${orders.length - 5} more orders</i>\n\n`;
      }

      // Calculate totals
      const totalSpent = orders.reduce((sum, o) => sum + parseFloat(o.total_amount_spent), 0);
      const completedOrders = orders.filter(o => o.status === 'completed').length;

      message += `<b>📈 Summary</b>\n`;
      message += `• Total Orders: ${orders.length}\n`;
      message += `• Completed: ${completedOrders}\n`;
      message += `• Total SOL Spent: ${totalSpent.toFixed(4)} SOL\n`;
    }

    await ctx.reply(message, { 
      parse_mode: "HTML",
      disable_web_page_preview: true 
    });

  } catch (err) {
    console.error("Group status error:", err.response?.data || err.message);
    await ctx.reply(
      `❌ Failed to fetch group status:\n${err.response?.data?.error || err.message}`
    );
  }
});

// ✅ /mestatus — show user's personal trading status (DM only)
bot.command("mestatus", async (ctx) => {
  const chat = ctx.chat;
  const userId = ctx.from.id;
  const username = ctx.from.username;

  // 🛑 Only works in private chat (DM)
  if (chat.type !== "private") {
    return ctx.reply("⚠️ This command only works in DM with the bot.\n\nPlease send /mestatus in a private message.");
  }

  try {
    // Get user info
    const userResp = await axios.get(
      `${BACKEND_BASE_EXPRESS}/api/users/${userId}`
    );

    if (!userResp.data.success) {
      return ctx.reply(
        "❌ You need to register first!\n\n" +
        "👉 Send /start to create your account."
      );
    }

    const user = userResp.data.data;
    console.log("User data:", user);
    // Get user's orders
    const ordersResp = await axios.get(
      `${BACKEND_BASE_EXPRESS}/api/users/${userId}/orders`
    );

    if (!ordersResp.data.success) {
      return ctx.reply("❌ Failed to fetch your trading history.");
    }

    const { orders, summary } = ordersResp.data.data;

    // Build status message
    let message = `📊 <b>Your Trading Status</b>\n\n`;
    message += `<b>Username:</b> @${username || user.telegram?.username || 'N/A'}\n`;
    message += `<b>User ID:</b> <code>${userId}</code>\n\n`;

    // Show SolCircle balance (custodial wallet)
    // Parse balance (could be number or string "X.XXX SOL")
    const balanceRaw = user.wallets?.custodial?.balance || user.wallets?.custodial?.balanceSOL || 0;
    const solCircleBalance = typeof balanceRaw === 'string' 
      ? parseFloat(balanceRaw.replace(' SOL', '')) 
      : balanceRaw;
    message += `💰 <b>SolCircle Balance:</b> ${solCircleBalance.toFixed(4)} SOL\n\n`;

    if (orders.length === 0) {
      message += `<i>No trading activity yet.</i>\n\n`;
      message += `Join a group session and vote YES with an amount to start trading!`;
    } else {
      message += `<b>📦 Your Orders (${orders.length})</b>\n\n`;

      orders.slice(0, 5).forEach((order, i) => {
        const date = new Date(order.created_at).toLocaleString();
        message += `${i + 1}. <b>${order.token_symbol}</b>\n`;
       message += `   • Order ID: <code>${order.order_id}</code>\n`;
        message += `   • Contributed: ${order.amount} SOL\n`;
        message += `   • Tokens Received: ${parseFloat(order.tokens_allocated).toFixed(2)}\n`;
        message += `   • Status: ${order.status}\n`;
        message += `   • P/L: ${order.profit_loss ? parseFloat(order.profit_loss).toFixed(4) : '0.0000'} SOL\n`;
        message += `   • Date: ${date}\n`;
        if (order.transaction_hash) {
          message += `   • TX: <code>${order.transaction_hash}</code>\n`;
          message += `   • <a href="https://explorer.solana.com/tx/${order.transaction_hash}?cluster=devnet">View on Explorer</a>\n`;
        }
        message += `\n`;
      });

      if (orders.length > 5) {
        message += `<i>...and ${orders.length - 5} more orders</i>\n\n`;
      }

      // Show summary stats
      message += `<b>📈 Summary</b>\n`;
      message += `• Total Orders: ${summary.totalOrders}\n`;
      message += `• Active Positions: ${summary.activeOrders}\n`;
      message += `• Total Invested: ${summary.totalInvested.toFixed(4)} SOL\n`;
      message += `• Total Tokens: ${summary.totalTokens.toFixed(2)}\n`;
      message += `• Total P/L: ${summary.totalProfitLoss.toFixed(4)} SOL\n`;
    }

    await ctx.reply(message, { 
      parse_mode: "HTML",
      disable_web_page_preview: true 
    });

  } catch (err) {
    console.error("User status error:", err.response?.data || err.message);
    await ctx.reply(
      `❌ Failed to fetch your status:\n${err.response?.data?.error || err.message}`
    );
  }
});


// ...existing code...

// ✅ /view_order — view detailed order information with P&L
bot.command("view_order", async (ctx) => {
  const chat = ctx.chat;
  const userId = ctx.from.id;
  const args = ctx.message.text.split(" ");
  const orderId = args[1];

  if (!orderId) {
    return ctx.reply(
      "Usage: /view_order <order_id>\n\n" +
      "Example: /view_order order_1761379627522\n\n" +
      "💡 Tip: Get order IDs from /mestatus or /groupstatus"
    );
  }

  try {
    // Get order details
    const orderResp = await axios.get(
      `${BACKEND_BASE_EXPRESS}/api/orders/${orderId}`
    );

    if (!orderResp.data.success) {
      return ctx.reply("❌ Order not found or you don't have access to it.");
    }

    const order = orderResp.data.data;

    // Check if user has access to this order (either owns it or is in the group)
    let hasAccess = false;

    // If in DM, check if user participated in this order
    if (chat.type === "private") {
      const userOrderResp = await axios.get(
        `${BACKEND_BASE_EXPRESS}/api/users/${userId}/orders`
      );
      
      if (userOrderResp.data.success) {
        const userOrders = userOrderResp.data.data.orders;
        hasAccess = userOrders.some(o => o.order_id === orderId);
      }
    } else {
      // If in group, check if order belongs to this group
      const groupResp = await axios.get(
        `${BACKEND_BASE_EXPRESS}/api/groups/${chat.id}`
      );
      
      if (groupResp.data.success) {
        // Check if order's proposal belongs to this group
        hasAccess = order.tgid === chat.id.toString();

        console.log("Group access check:", order.tgid, chat.id, hasAccess);
      }
    }

    if (!hasAccess) {
      return ctx.reply("❌ You don't have access to view this order.");
    }

    // Calculate current price and P&L
    const boughtAtPrice = parseFloat(order.bought_at_price || 0);
    const totalSpent = parseFloat(order.total_amount_spent || 0);
    const tokenAmount = parseFloat(order.token_amount || 0);
    const fees = parseFloat(order.fees || 0);

    // Get current token price (you'll need to implement this based on your DEX)
    // For now, using placeholder - replace with actual price fetch
    let currentPrice = 0;
    let currentValue = 0;
    let pnl = 0;
    let pnlPercent = 0;

    try {
      // TODO: Fetch current price from Raydium/Jupiter
      // For now, using bought price as placeholder
      currentPrice = boughtAtPrice * 1.05; // Simulated 5% increase
      currentValue = tokenAmount * currentPrice;
      pnl = currentValue - totalSpent - fees;
      pnlPercent = totalSpent > 0 ? (pnl / totalSpent) * 100 : 0;
    } catch (priceErr) {
      console.error("Failed to fetch current price:", priceErr);
    }

    const date = new Date(order.created_at).toLocaleString();
    const pnlEmoji = pnl >= 0 ? "📈" : "📉";
    const pnlColor = pnl >= 0 ? "+" : "";

    let message = `📦 <b>Order Details</b>\n\n`;
    message += `<b>Order ID:</b> <code>${order.order_id}</code>\n`;
    message += `<b>Token:</b> ${order.token_symbol}\n`;
    message += `<b>Status:</b> ${order.status}\n`;
    message += `<b>Created:</b> ${date}\n\n`;

    message += `💰 <b>Trade Information</b>\n`;
    message += `• Amount Spent: ${totalSpent.toFixed(4)} SOL\n`;
    message += `• Tokens Received: ${tokenAmount.toFixed(2)} ${order.token_symbol}\n`;
    message += `• Transaction Fees: ${fees.toFixed(6)} SOL\n`;
    message += `• Total Cost: ${(totalSpent + fees).toFixed(6)} SOL\n\n`;

    message += `📊 <b>Price Analysis</b>\n`;
    message += `• Bought At: ${boughtAtPrice.toFixed(8)} SOL per token\n`;
    message += `• Current Price: ${currentPrice.toFixed(8)} SOL per token\n`;
    message += `• Price Change: ${pnlColor}${((currentPrice - boughtAtPrice) / boughtAtPrice * 100).toFixed(2)}%\n\n`;

    message += `${pnlEmoji} <b>Profit/Loss</b>\n`;
    message += `• Current Value: ${currentValue.toFixed(4)} SOL\n`;
    message += `• P&L: ${pnlColor}${pnl.toFixed(4)} SOL (${pnlColor}${pnlPercent.toFixed(2)}%)\n\n`;

    if (order.transaction_hash) {
      message += `🔗 <b>Transaction</b>\n`;
      message += `<code>${order.transaction_hash}</code>\n`;
      message += `<a href="https://explorer.solana.com/tx/${order.transaction_hash}?cluster=devnet">View on Explorer</a>\n\n`;
    }

    // If user is viewing their own order in DM, show their specific allocation
    if (chat.type === "private") {
      const userOrderResp = await axios.get(
        `${BACKEND_BASE_EXPRESS}/api/orders/${orderId}/user/${userId}`
      );

      if (userOrderResp.data.success) {
        const userOrder = userOrderResp.data.data;
        const userTokens = parseFloat(userOrder.tokens_allocated || 0);
        const userContribution = parseFloat(userOrder.amount || 0);
        const userPnl = (userTokens * currentPrice) - userContribution - parseFloat(userOrder.fees || 0);
        const userPnlPercent = userContribution > 0 ? (userPnl / userContribution) * 100 : 0;

        message += `👤 <b>Your Position</b>\n`;
        message += `• Contributed: ${userContribution.toFixed(4)} SOL\n`;
        message += `• Tokens Allocated: ${userTokens.toFixed(2)} ${order.token_symbol}\n`;
        message += `• Your P&L: ${pnlColor}${userPnl.toFixed(4)} SOL (${pnlColor}${userPnlPercent.toFixed(2)}%)\n`;
      }
    }

    await ctx.reply(message, {
      parse_mode: "HTML",
      disable_web_page_preview: true,
    });

  } catch (err) {
    console.error("View order error:", err.response?.data || err.message);
    await ctx.reply(
      `❌ Failed to fetch order details:\n${err.response?.data?.error || err.message}`
    );
  }
});

// ...existing code...

// --- Join buttons ---
bot.on("callback_query", async (ctx) => {
  const data = ctx.callbackQuery.data;
  if (data.startsWith("join_")) {
    const sessionId = data.split("_")[1];
    const username = ctx.from.username
      ? `@${ctx.from.username}`
      : ctx.from.first_name;

    const session = await getSession(sessionId);
    if (!session) {
      await ctx.answerCbQuery("❌ Session not found or expired.");
      return;
    }

    if (!session.participants.includes(username)) {
      await addParticipant(sessionId, username);
      await ctx.answerCbQuery("✅ You joined the session!");
    } else {
      await ctx.answerCbQuery("Already joined.");
    }
  } else {
    await ctx.answerCbQuery("Okay!");
  }
});

// --- Express Webhook ---
const app = express();
app.use(express.json());

app.post(WEBHOOK_PATH, (req, res) => {
  const token = req.get("x-telegram-bot-api-secret-token");
  if (token !== WEBHOOK_SECRET) return res.status(403).send("Forbidden");
  bot.handleUpdate(req.body);
  res.send("ok");
});

app.get("/", (req, res) => res.send("🤖 GroupSOL Bot is running ✅"));
app.get("/bot/status", (req, res) => res.send("Bot is alive ✅"));

app.listen(PORT, async () => {
  // Initialize Redis
  try {
    await initRedis();
    console.log("✅ Redis initialized successfully");
  } catch (err) {
    console.error("❌ Failed to initialize Redis:", err);
    process.exit(1);
  }

  const fullWebhookUrl = `${WEBHOOK_URL_BASE}${WEBHOOK_PATH}`;
  await bot.telegram.setWebhook(fullWebhookUrl, {
    secret_token: WEBHOOK_SECRET,
  });
  console.log(`🚀 Bot running on port ${PORT}`);
  console.log(`🤖 Webhook set: ${fullWebhookUrl}`);
});

// Add this handler before the webhook setup

bot.on("text", async (ctx) => {
  const text = ctx.message.text;
  const userId = ctx.from.id;
  const username = ctx.from.username;

  // Check if it's an OTP (6-digit number)
  if (/^\d{6}$/.test(text) && ctx.chat.type === "private") {
    try {
      const response = await axios.post(
        `${BACKEND_BASE_EXPRESS}/api/users/verify-otp`,
        {
          username,
          otp: text,
          telegram_user_id: userId.toString(),
        }
      );

      if (response.data.success) {
        await ctx.reply(
          `✅ Registration Complete!\n\n` +
          `<b>Username:</b> @${response.data.data.telegram.username}\n` +
          `<b>User ID:</b> <code>${response.data.data.telegram.userId}</code>\n\n` +
          `<b>Custodial Wallet:</b>\n<code>${response.data.data.wallets.custodial.publicKey}</code>\n` +
          `<b>Balance:</b> ${response.data.data.wallets.custodial.balanceSOL}\n\n` +
          `<b>Main Wallet:</b>\n<code>${response.data.data.wallets.main.publicKey}</code>\n` +
          `<b>Balance:</b> ${response.data.data.wallets.main.balanceSOL}`,
          { parse_mode: "HTML" }
        );
      }
    } catch (error) {
      await ctx.reply(
        `❌ ${error.response?.data?.error || "Invalid OTP. Please try again."}`
      );
    }
  }
});

// ==================== ANALYTICS COMMANDS ====================

/**
 * /performance [period] - Show portfolio performance
 * Periods: 24h, 7d, 30d, 90d, 1y, all (default: 30d)
 */
bot.command('performance', async (ctx) => {
  try {
    const username = ctx.from.username || ctx.from.first_name;
    const args = ctx.message.text.split(' ');
    const period = args[1] || '30d';
    
    // Validate period
    const validPeriods = ['24h', '7d', '30d', '90d', '1y', 'all'];
    if (!validPeriods.includes(period)) {
      return await ctx.reply(
        `❌ Invalid period. Use: ${validPeriods.join(', ')}\n\n` +
        `Example: /performance 7d`
      );
    }
    
    await ctx.reply('📊 Fetching portfolio performance...');
    
    const response = await axios.get(
      `${BACKEND_BASE_EXPRESS}/api/zerion/analytics/portfolio-performance/${username}`,
      { params: { period }, timeout: 15000 }
    );
    
    if (!response.data.success) {
      return await ctx.reply(`❌ ${response.data.error}`);
    }
    
    const data = response.data.data;
    const perf = data.performance;
    
    // Determine emoji based on change
    const isPositive = !perf.percent_change.includes('-');
    const trendEmoji = isPositive ? '📈' : '📉';
    const changeEmoji = isPositive ? '🟢' : '🔴';
    
    const message = `
${trendEmoji} <b>Portfolio Performance (${data.period})</b>

💰 <b>Current Value:</b> $${perf.current_value_usd}
📊 <b>Start Value:</b> $${perf.start_value_usd}

${changeEmoji} <b>Change:</b> ${perf.absolute_change_usd >= 0 ? '+' : ''}$${perf.absolute_change_usd} (${perf.percent_change})

📈 <b>Highest:</b> $${perf.highest_value_usd}
📉 <b>Lowest:</b> $${perf.lowest_value_usd}

📍 <b>Data Points:</b> ${perf.data_points}

${isPositive ? '🎉 Great performance!' : '💪 Stay strong!'}
    `.trim();
    
    await ctx.reply(message, { parse_mode: 'HTML' });
    
  } catch (error) {
    console.error('Performance command error:', error.message);
    
    if (error.response?.status === 404) {
      await ctx.reply(
        `❌ User not found. Please register first with /register`
      );
    } else if (error.code === 'ECONNABORTED') {
      await ctx.reply(
        `⏱️ Request timed out. The portfolio might be too large. Try again later.`
      );
    } else {
      await ctx.reply(
        `❌ Error fetching performance data:\n${error.response?.data?.error || error.message}\n\n` +
        `Make sure you have a mainnet wallet configured.`
      );
    }
  }
});

/**
 * /changes - Show 24h/7d/30d portfolio changes
 */
bot.command('changes', async (ctx) => {
  try {
    const username = ctx.from.username || ctx.from.first_name;
    
    await ctx.reply('📊 Fetching portfolio changes...');
    
    const response = await axios.get(
      `${BACKEND_BASE_EXPRESS}/api/zerion/analytics/portfolio-changes/${username}`,
      { timeout: 15000 }
    );
    
    if (!response.data.success) {
      return await ctx.reply(`❌ ${response.data.error}`);
    }
    
    const data = response.data.data;
    const changes = data.changes;
    
    // Format change display
    const formatChange = (change) => {
      if (change.error) return '❌ N/A';
      
      const emoji = change.is_positive ? '🟢' : '🔴';
      const sign = change.is_positive ? '+' : '';
      return `${emoji} ${sign}${change.percent_change} (${sign}$${change.absolute_change_usd})`;
    };
    
    // Determine overall trend
    let trendText = '➡️ Neutral';
    let trendEmoji = '➡️';
    if (data.summary.trending === 'up') {
      trendText = '📈 Bullish';
      trendEmoji = '🚀';
    } else if (data.summary.trending === 'down') {
      trendText = '📉 Bearish';
      trendEmoji = '⚠️';
    }
    
    const message = `
${trendEmoji} <b>Portfolio Changes</b>

💰 <b>Current Value:</b> $${data.current_portfolio_value_usd}

<b>Performance:</b>
⏰ <b>24 Hours:</b> ${formatChange(changes['24h'])}
📅 <b>7 Days:</b> ${formatChange(changes['7d'])}
📆 <b>30 Days:</b> ${formatChange(changes['30d'])}

📊 <b>Trend:</b> ${trendText}

<i>Use /performance for detailed charts</i>
    `.trim();
    
    await ctx.reply(message, { parse_mode: 'HTML' });
    
  } catch (error) {
    console.error('Changes command error:', error.message);
    
    if (error.response?.status === 404) {
      await ctx.reply(
        `❌ User not found. Please register first with /register`
      );
    } else {
      await ctx.reply(
        `❌ Error fetching changes:\n${error.response?.data?.error || error.message}`
      );
    }
  }
});

/**
 * /movers [limit] - Show top gainers and losers
 * Default limit: 3
 */
bot.command('movers', async (ctx) => {
  try {
    const username = ctx.from.username || ctx.from.first_name;
    const args = ctx.message.text.split(' ');
    const limit = parseInt(args[1]) || 3;
    
    if (limit < 1 || limit > 10) {
      return await ctx.reply(
        `❌ Limit must be between 1 and 10\n\nExample: /movers 5`
      );
    }
    
    await ctx.reply('📊 Fetching top movers...');
    
    const response = await axios.get(
      `${BACKEND_BASE_EXPRESS}/api/zerion/analytics/performance-ranking/${username}`,
      { params: { limit }, timeout: 15000 }
    );
    
    if (!response.data.success) {
      return await ctx.reply(`❌ ${response.data.error}`);
    }
    
    const data = response.data.data;
    const summary = data.summary;
    
    let message = `
📊 <b>Top Movers (24h)</b>

💰 <b>Portfolio:</b> ${summary.total_assets} assets
🟢 <b>Gainers:</b> ${summary.gainers} | 🔴 <b>Losers:</b> ${summary.losers}
📈 <b>Net Change:</b> ${summary.net_change_24h_usd >= 0 ? '+' : ''}$${summary.net_change_24h_usd}
    `.trim();
    
    // Best performers
    if (data.best_performers.length > 0) {
      message += '\n\n🏆 <b>TOP GAINERS:</b>\n';
      data.best_performers.forEach((asset, i) => {
        message += `${i + 1}. <b>${asset.symbol}</b> ${asset.change_24h}\n`;
        message += `   💰 $${asset.value_usd} (+$${asset.gain_24h_usd})\n`;
      });
    } else {
      message += '\n\n🏆 <b>TOP GAINERS:</b> None';
    }
    
    // Worst performers
    if (data.worst_performers.length > 0) {
      message += '\n\n📉 <b>TOP LOSERS:</b>\n';
      data.worst_performers.forEach((asset, i) => {
        message += `${i + 1}. <b>${asset.symbol}</b> ${asset.change_24h}\n`;
        message += `   💰 $${asset.value_usd} ($${asset.loss_24h_usd})\n`;
      });
    } else {
      message += '\n\n📉 <b>TOP LOSERS:</b> None';
    }
    
    message += '\n\n<i>Use /prices to see all token prices</i>';
    
    await ctx.reply(message, { parse_mode: 'HTML' });
    
  } catch (error) {
    console.error('Movers command error:', error.message);
    
    if (error.response?.status === 404) {
      await ctx.reply(
        `❌ User not found. Please register first with /register`
      );
    } else {
      await ctx.reply(
        `❌ Error fetching movers:\n${error.response?.data?.error || error.message}`
      );
    }
  }
});

/**
 * /prices - Show all token prices with 24h changes
 */
bot.command('prices', async (ctx) => {
  try {
    const username = ctx.from.username || ctx.from.first_name;
    
    await ctx.reply('💹 Fetching token prices...');
    
    const response = await axios.get(
      `${BACKEND_BASE_EXPRESS}/api/zerion/analytics/token-prices/${username}`,
      { timeout: 15000 }
    );
    
    if (!response.data.success) {
      return await ctx.reply(`❌ ${response.data.error}`);
    }
    
    const data = response.data.data;
    
    if (data.total_tokens === 0) {
      return await ctx.reply(
        `💰 <b>Token Prices</b>\n\n` +
        `No tokens found in your portfolio.\n\n` +
        `Make sure you have a mainnet wallet with tokens.`,
        { parse_mode: 'HTML' }
      );
    }
    
    let message = `💹 <b>Token Prices (24h Change)</b>\n\n`;
    message += `📊 <b>Total Tokens:</b> ${data.total_tokens}\n\n`;
    
    // Display first 15 tokens (Telegram message limit)
    const displayTokens = data.tokens.slice(0, 15);
    
    displayTokens.forEach((token, i) => {
      const changeEmoji = token.is_price_up ? '🟢' : '🔴';
      const sign = token.is_price_up ? '+' : '';
      
      message += `${i + 1}. <b>${token.symbol}</b> (${token.chain})\n`;
      message += `   💰 $${token.current_price_usd} ${changeEmoji} ${sign}${token.price_change_24h}\n`;
      message += `   📊 Value: $${token.value_usd} (${sign}$${token.value_change_24h_usd})\n`;
      message += `   🔢 Qty: ${token.quantity}\n\n`;
    });
    
    if (data.total_tokens > 15) {
      message += `<i>...and ${data.total_tokens - 15} more tokens</i>\n\n`;
    }
    
    message += `<i>Use /movers to see top gainers/losers</i>`;
    
    // Send in chunks if too long
    if (message.length > 4000) {
      const chunks = message.match(/[\s\S]{1,4000}/g) || [];
      for (const chunk of chunks) {
        await ctx.reply(chunk, { parse_mode: 'HTML' });
      }
    } else {
      await ctx.reply(message, { parse_mode: 'HTML' });
    }
    
  } catch (error) {
    console.error('Prices command error:', error.message);
    
    if (error.response?.status === 404) {
      await ctx.reply(
        `❌ User not found. Please register first with /register`
      );
    } else {
      await ctx.reply(
        `❌ Error fetching prices:\n${error.response?.data?.error || error.message}`
      );
    }
  }
});

// ==================== WALLET LABELS & TAGS COMMANDS ====================

/**
 * /label [address] [label] - Label a wallet
 */
bot.command('label', async (ctx) => {
  try {
    const args = ctx.message.text.split(' ');
    
    if (args.length < 3) {
      return await ctx.reply(
        `❌ Usage: /label [address] [label]\n\n` +
        `Examples:\n` +
        `• /label EAbgG2Wk... Trading Wallet\n` +
        `• /label 8iTq9RQb... Savings Wallet\n\n` +
        `Tip: Use /wallets to see all your wallet addresses`,
        { parse_mode: 'HTML' }
      );
    }
    
    const address = args[1];
    const label = args.slice(2).join(' ');
    const userId = ctx.from.id.toString();
    
    // Validate address length
    if (address.length < 32 || address.length > 44) {
      return await ctx.reply(
        `❌ Invalid wallet address. Please provide a valid Solana address.`
      );
    }
    
    await ctx.reply('🏷️ Adding label...');
    
    const response = await axios.post(
      `${BACKEND_BASE_EXPRESS}/api/wallet-labels`,
      {
        identifier: userId,
        wallet_address: address,
        label: label,
        tags: ['telegram', 'user-created']
      },
      { timeout: 10000 }
    );
    
    if (response.data.success) {
      const shortAddress = `${address.substring(0, 8)}...${address.slice(-4)}`;
      await ctx.reply(
        `✅ <b>Label Added!</b>\n\n` +
        `🏷️ <b>Label:</b> ${label}\n` +
        `📍 <b>Address:</b> <code>${shortAddress}</code>\n\n` +
        `Use /wallets to see all your labeled wallets`,
        { parse_mode: 'HTML' }
      );
    }
  } catch (error) {
    console.error('Label command error:', error.message);
    
    if (error.response?.status === 404) {
      await ctx.reply(
        `❌ User not found. Please register first with /register`
      );
    } else {
      await ctx.reply(
        `❌ Error adding label:\n${error.response?.data?.error || error.message}`
      );
    }
  }
});

/**
 * /tag [address] [tag1,tag2,...] - Add tags to wallet
 */
bot.command('tag', async (ctx) => {
  try {
    const args = ctx.message.text.split(' ');
    
    if (args.length < 3) {
      return await ctx.reply(
        `❌ Usage: /tag [address] [tag1,tag2]\n\n` +
        `Examples:\n` +
        `• /tag EAbgG2Wk... trading,active\n` +
        `• /tag 8iTq9RQb... savings,longterm,hodl\n\n` +
        `Tip: Separate tags with commas, no spaces`,
        { parse_mode: 'HTML' }
      );
    }
    
    const address = args[1];
    const tagsInput = args[2];
    const tags = tagsInput.split(',').map(t => t.trim().toLowerCase());
    const userId = ctx.from.id.toString();
    
    if (address.length < 32 || address.length > 44) {
      return await ctx.reply(
        `❌ Invalid wallet address. Please provide a valid Solana address.`
      );
    }
    
    await ctx.reply('🏷️ Adding tags...');
    
    const response = await axios.post(
      `${BACKEND_BASE_EXPRESS}/api/wallet-labels`,
      {
        identifier: userId,
        wallet_address: address,
        tags: tags
      },
      { timeout: 10000 }
    );
    
    if (response.data.success) {
      const shortAddress = `${address.substring(0, 8)}...${address.slice(-4)}`;
      await ctx.reply(
        `✅ <b>Tags Added!</b>\n\n` +
        `📍 <b>Address:</b> <code>${shortAddress}</code>\n` +
        `🏷️ <b>Tags:</b> ${tags.map(t => `#${t}`).join(' ')}\n\n` +
        `Use /wallets to see all your labeled wallets`,
        { parse_mode: 'HTML' }
      );
    }
  } catch (error) {
    console.error('Tag command error:', error.message);
    
    if (error.response?.status === 404) {
      await ctx.reply(
        `❌ User not found. Please register first with /register`
      );
    } else {
      await ctx.reply(
        `❌ Error adding tags:\n${error.response?.data?.error || error.message}`
      );
    }
  }
});

/**
 * /labels - Show all wallet labels
 */
bot.command('labels', async (ctx) => {
  try {
    const userId = ctx.from.id.toString();
    
    await ctx.reply('📋 Fetching labels...');
    
    const response = await axios.get(
      `${BACKEND_BASE_EXPRESS}/api/wallet-labels/${userId}`,
      { timeout: 10000 }
    );
    
    if (response.data.success) {
      const labels = response.data.data.labels;
      
      if (labels.length === 0) {
        return await ctx.reply(
          `📋 <b>No Labels Yet</b>\n\n` +
          `Add labels to your wallets:\n` +
          `• /label [address] [name]\n` +
          `• /tag [address] [tags]\n\n` +
          `Example:\n` +
          `/label EAbgG2Wk... Trading Wallet`,
          { parse_mode: 'HTML' }
        );
      }
      
      let message = `🏷️ <b>Your Wallet Labels (${labels.length})</b>\n\n`;
      
      labels.forEach((item, i) => {
        const shortAddr = `${item.wallet_address.substring(0, 8)}...${item.wallet_address.slice(-4)}`;
        message += `${i + 1}. <b>${item.label || 'Unlabeled'}</b>\n`;
        message += `   📍 <code>${shortAddr}</code>\n`;
        
        if (item.tags && item.tags.length > 0) {
          message += `   🏷️ ${item.tags.map(t => `#${t}`).join(' ')}\n`;
        }
        
        if (item.note) {
          message += `   📝 ${item.note}\n`;
        }
        
        message += '\n';
      });
      
      message += `<i>Use /wallets to see labels with balances</i>`;
      
      await ctx.reply(message, { parse_mode: 'HTML' });
    }
  } catch (error) {
    console.error('Labels command error:', error.message);
    
    if (error.response?.status === 404) {
      await ctx.reply(
        `❌ User not found. Please register first with /register`
      );
    } else {
      await ctx.reply(
        `❌ Error fetching labels:\n${error.response?.data?.error || error.message}`
      );
    }
  }
});

/**
 * /wallets - Show all wallets with labels and balances
 */
bot.command('wallets', async (ctx) => {
  try {
    const userId = ctx.from.id.toString();
    
    await ctx.reply('💼 Fetching wallets...');
    
    const response = await axios.get(
      `${BACKEND_BASE_EXPRESS}/api/wallet-labels/${userId}/overview`,
      { timeout: 15000 }
    );
    
    if (response.data.success) {
      const data = response.data.data;
      const wallets = data.wallets;
      
      let message = `💼 <b>Your Wallets</b>\n\n`;
      message += `💰 <b>Total Balance:</b> ${data.total_balance_sol} SOL\n`;
      message += `📊 <b>Total Wallets:</b> ${data.total_wallets}\n\n`;
      
      wallets.forEach((wallet, i) => {
        const shortAddr = `${wallet.address.substring(0, 8)}...${wallet.address.slice(-4)}`;
        const customIcon = wallet.has_custom_label ? '✏️' : '';
        
        message += `${i + 1}. <b>${wallet.label}</b> ${customIcon}\n`;
        message += `   📍 <code>${shortAddr}</code>\n`;
        message += `   💰 ${wallet.balance_sol} SOL (${wallet.network})\n`;
        message += `   🏷️ ${wallet.tags.map(t => `#${t}`).join(' ')}\n`;
        
        if (wallet.note && wallet.has_custom_label) {
          message += `   📝 ${wallet.note}\n`;
        }
        
        if (wallet.type === 'group') {
          message += `   👤 Role: ${wallet.role}\n`;
        }
        
        message += '\n';
      });
      
      message += `<i>Customize labels with /label and /tag commands</i>`;
      
      // Send in chunks if too long
      if (message.length > 4000) {
        const chunks = message.match(/[\s\S]{1,4000}/g) || [];
        for (const chunk of chunks) {
          await ctx.reply(chunk, { parse_mode: 'HTML' });
        }
      } else {
        await ctx.reply(message, { parse_mode: 'HTML' });
      }
    }
  } catch (error) {
    console.error('Wallets command error:', error.message);
    
    if (error.response?.status === 404) {
      await ctx.reply(
        `❌ User not found. Please register first with /register`
      );
    } else {
      await ctx.reply(
        `❌ Error fetching wallets:\n${error.response?.data?.error || error.message}`
      );
    }
  }
});

/**
 * /unlabel [address] - Remove label from wallet
 */
bot.command('unlabel', async (ctx) => {
  try {
    const args = ctx.message.text.split(' ');
    
    if (args.length < 2) {
      return await ctx.reply(
        `❌ Usage: /unlabel [address]\n\n` +
        `Example:\n` +
        `/unlabel EAbgG2Wk...\n\n` +
        `Tip: Use /labels to see all your labeled wallets`,
        { parse_mode: 'HTML' }
      );
    }
    
    const address = args[1];
    const userId = ctx.from.id.toString();
    
    if (address.length < 32 || address.length > 44) {
      return await ctx.reply(
        `❌ Invalid wallet address.`
      );
    }
    
    await ctx.reply('🗑️ Removing label...');
    
    const response = await axios.delete(
      `${BACKEND_BASE_EXPRESS}/api/wallet-labels/${userId}/${address}`,
      { timeout: 10000 }
    );
    
    if (response.data.success) {
      const shortAddress = `${address.substring(0, 8)}...${address.slice(-4)}`;
      await ctx.reply(
        `✅ <b>Label Removed!</b>\n\n` +
        `📍 <b>Address:</b> <code>${shortAddress}</code>\n\n` +
        `Use /labels to see remaining labels`,
        { parse_mode: 'HTML' }
      );
    }
  } catch (error) {
    console.error('Unlabel command error:', error.message);
    
    if (error.response?.status === 404) {
      await ctx.reply(
        `❌ Label not found for this address.`
      );
    } else {
      await ctx.reply(
        `❌ Error removing label:\n${error.response?.data?.error || error.message}`
      );
    }
  }
});
