const express = require("express");
const router = express.Router();
const { query } = require("../db/queries");
const { createCustodialWallet, encryptPrivateKey } = require("../utils/wallet");
const { Connection, PublicKey } = require("@solana/web3.js");
const axios = require("axios");
const crypto = require("crypto"); 
/**
 * Register a new user
 * POST /api/users
 * Body: { utgid: "username", main_pkey: "user_wallet_address" }
 */


router.post("/", async (req, res) => {
  try {
    const { id, username, first_name, last_name, auth_date, hash, main_pkey } =
      req.body;

    console.log("Registering user via Telegram Widget:", {
      id,
      username,
      first_name,
    });

    if (!id || !hash || !main_pkey) {
      return res.status(400).json({
        success: false,
        error: "Telegram auth data (id, hash) and main_pkey are required",
      });
    }

    // Verify Telegram authentication
    const botToken = process.env.BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN;
    if (!botToken) {
      return res.status(500).json({
        success: false,
        error: "Telegram bot token not configured",
      });
    }

    // Verify hash (Telegram authentication)
    const secret = crypto.createHash("sha256").update(botToken).digest();

    const dataCheckString = Object.keys(req.body)
      .filter((key) => key !== "hash" && key !== "main_pkey")
      .sort()
      .map((key) => `${key}=${req.body[key]}`)
      .join("\n");

    const hmac = crypto
      .createHmac("sha256", secret)
      .update(dataCheckString)
      .digest("hex");

    // if (hmac !== hash) {
    //   return res.status(403).json({
    //     success: false,
    //     error: "Invalid Telegram authentication",
    //   });
    // }

    // Check auth_date (not older than 1 day)
    const currentTime = Math.floor(Date.now() / 1000);
    if (currentTime - auth_date > 86400) {
      return res.status(403).json({
        success: false,
        error: "Authentication data is too old",
      });
    }

    const telegramUserId = id.toString();
    const telegramUsername = username || `user_${id}`;

    // Check if user already exists
    const existingUser = await query("SELECT * FROM users WHERE utgid = $1", [
      telegramUserId,
    ]);

    if (existingUser.rows.length > 0) {
      return res.status(400).json({
        success: false,
        error: "User already registered",
        user: {
          utgid: existingUser.rows[0].utgid,
          username: existingUser.rows[0].username,
          custodial_wallet: existingUser.rows[0].custodial_pkey,
          main_wallet: existingUser.rows[0].main_pkey,
        },
      });
    }

    // Validate the main wallet address
    try {
      new PublicKey(main_pkey);
    } catch (error) {
      return res.status(400).json({
        success: false,
        error: "Invalid Solana wallet address",
      });
    }

    // Create custodial wallet
    const custodialWallet = createCustodialWallet();
    const masterPassword = process.env.ENCRYPTION_MASTER_PASSWORD;

    if (!masterPassword) {
      return res.status(500).json({
        success: false,
        error: "Encryption master password not configured",
      });
    }

    const encryptedKey = encryptPrivateKey(
      custodialWallet.privateKey,
      masterPassword
    );

    // Create user in database
    const result = await query(
      `INSERT INTO users (utgid, username, custodial_pkey, main_pkey, keys, status)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING utgid, username, custodial_pkey, main_pkey, status, created_at`,
      [
        telegramUserId,
        telegramUsername,
        custodialWallet.publicKey,
        main_pkey,
        encryptedKey,
        "active",
      ]
    );

    const user = result.rows[0];

    // Get balances
    const connection = new Connection("https://api.devnet.solana.com/");
    let custodialBalance = 0;
    let mainBalance = 0;

    try {
      const custodialBalanceLamports = await connection.getBalance(
        new PublicKey(custodialWallet.publicKey)
      );
      custodialBalance = custodialBalanceLamports / 1e9;

      const mainBalanceLamports = await connection.getBalance(
        new PublicKey(main_pkey)
      );
      mainBalance = mainBalanceLamports / 1e9;
    } catch (error) {
      console.error("Error fetching balances:", error.message);
    }

    res.status(201).json({
      success: true,
      message: "✅ User registered successfully",
      data: {
        telegram: {
          userId: user.utgid,
          username: user.username,
          firstName: first_name,
          lastName: last_name,
        },
        wallets: {
          custodial: {
            publicKey: user.custodial_pkey,
            balance: custodialBalance,
            balanceSOL: `${custodialBalance} SOL`,
          },
          main: {
            publicKey: user.main_pkey,
            balance: mainBalance,
            balanceSOL: `${mainBalance} SOL`,
          },
        },
        status: user.status,
        createdAt: user.created_at,
        note: "Custodial wallet created. Keep your main wallet private key safe!",
      },
    });
  } catch (error) {
    console.error("User registration error:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Add this route after the register route

/**
 * Login user via Telegram Widget
 * POST /api/users/login
 * Body: { id, username, first_name, last_name, auth_date, hash }
 */
router.post("/login", async (req, res) => {
  try {
    const { id, username, first_name, last_name, auth_date, hash } = req.body;

    console.log("User login attempt via Telegram Widget:", {
      id,
      username,
      first_name,
    });

    if (!id || !hash) {
      return res.status(400).json({
        success: false,
        error: "Telegram auth data (id, hash) is required",
      });
    }

    // Verify Telegram authentication
    const botToken = process.env.BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN;
    if (!botToken) {
      return res.status(500).json({
        success: false,
        error: "Telegram bot token not configured",
      });
    }

    // Verify hash (Telegram authentication)
    const secret = crypto.createHash("sha256").update(botToken).digest();

    const dataCheckString = Object.keys(req.body)
      .filter((key) => key !== "hash")
      .sort()
      .map((key) => `${key}=${req.body[key]}`)
      .join("\n");

    const hmac = crypto
      .createHmac("sha256", secret)
      .update(dataCheckString)
      .digest("hex");

    // if (hmac !== hash) {
    //   return res.status(403).json({
    //     success: false,
    //     error: "Invalid Telegram authentication",
    //   });
    // }

    // Check auth_date (not older than 1 day)
    const currentTime = Math.floor(Date.now() / 1000);
    if (currentTime - auth_date > 86400) {
      return res.status(403).json({
        success: false,
        error: "Authentication data is too old",
      });
    }

    const telegramUserId = id.toString();

    // Check if user exists
    const existingUser = await query(
      "SELECT utgid, username, custodial_pkey, main_pkey, status, created_at FROM users WHERE utgid = $1",
      [telegramUserId]
    );

    if (existingUser.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: "User not found. Please register first.",
        needsRegistration: true,
      });
    }

    const user = existingUser.rows[0];

    // Check if user is active
    if (user.status !== "active") {
      return res.status(403).json({
        success: false,
        error: `Account is ${user.status}. Please contact support.`,
      });
    }

    // Get balances
    const connection = new Connection("https://api.devnet.solana.com/");
    let custodialBalance = 0;
    let mainBalance = 0;

    try {
      const custodialBalanceLamports = await connection.getBalance(
        new PublicKey(user.custodial_pkey)
      );
      custodialBalance = custodialBalanceLamports / 1e9;

      const mainBalanceLamports = await connection.getBalance(
        new PublicKey(user.main_pkey)
      );
      mainBalance = mainBalanceLamports / 1e9;
    } catch (error) {
      console.error("Error fetching balances:", error.message);
    }

    // Get user's groups
    const groupsResult = await query(
      `SELECT g.tgid, g.encrypted_key as group_wallet, p.role, p.joined_at
       FROM participants p
       JOIN groups g ON p.tgid = g.tgid
       WHERE p.utgid = $1 AND p.left_at IS NULL
       ORDER BY p.joined_at DESC`,
      [telegramUserId]
    );

    res.status(200).json({
      success: true,
      message: "✅ Login successful",
      data: {
        telegram: {
          userId: user.utgid,
          username: user.username,
          firstName: first_name,
          lastName: last_name,
        },
        wallets: {
          custodial: {
            publicKey: user.custodial_pkey,
            balance: custodialBalance,
            balanceSOL: `${custodialBalance} SOL`,
          },
          main: {
            publicKey: user.main_pkey,
          },
        },
        groups: {
          count: groupsResult.rows.length,
          list: groupsResult.rows,
        },
        status: user.status,
        memberSince: user.created_at,
      },
    });
  } catch (error) {
    console.error("User login error:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// New endpoint to verify OTP and complete registration
router.post("/verify-otp", async (req, res) => {
  try {
    const { username, otp, telegram_user_id } = req.body;

    if (!username || !otp || !telegram_user_id) {
      return res.status(400).json({
        success: false,
        error: "username, otp, and telegram_user_id are required",
      });
    }

    // Check if OTP exists and matches
    const pending = global.pendingRegistrations?.[username];
    if (!pending) {
      return res.status(400).json({
        success: false,
        error: "No pending registration found. Please restart registration.",
      });
    }

    if (pending.otp !== otp) {
      return res.status(400).json({
        success: false,
        error: "Invalid OTP",
      });
    }

    // Check OTP expiry (5 minutes)
    if (Date.now() - pending.timestamp > 5 * 60 * 1000) {
      delete global.pendingRegistrations[username];
      return res.status(400).json({
        success: false,
        error: "OTP expired. Please restart registration.",
      });
    }

    const main_pkey = pending.main_pkey;

    // Check if user already exists
    const existingUser = await query("SELECT * FROM users WHERE utgid = $1", [
      telegram_user_id,
    ]);

    if (existingUser.rows.length > 0) {
      delete global.pendingRegistrations[username];
      return res.status(400).json({
        success: false,
        error: "User already registered",
        user: {
          utgid: existingUser.rows[0].utgid,
          username: existingUser.rows[0].username,
          custodial_wallet: existingUser.rows[0].custodial_pkey,
          main_wallet: existingUser.rows[0].main_pkey,
        },
      });
    }

    // Validate the main wallet address
    try {
      new PublicKey(main_pkey);
    } catch (error) {
      return res.status(400).json({
        success: false,
        error: "Invalid Solana wallet address",
      });
    }

    // Create custodial wallet
    const custodialWallet = createCustodialWallet();
    const masterPassword = process.env.ENCRYPTION_MASTER_PASSWORD;

    if (!masterPassword) {
      return res.status(500).json({
        success: false,
        error: "Encryption master password not configured",
      });
    }

    const encryptedKey = encryptPrivateKey(
      custodialWallet.privateKey,
      masterPassword
    );

    // Create user in database
    const result = await query(
      `INSERT INTO users (utgid, username, custodial_pkey, main_pkey, keys, status)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING utgid, username, custodial_pkey, main_pkey, status, created_at`,
      [
        telegram_user_id,
        username,
        custodialWallet.publicKey,
        main_pkey,
        encryptedKey,
        "active",
      ]
    );

    const user = result.rows[0];

    // Get balances
    const connection = new Connection("https://api.devnet.solana.com/");
    let custodialBalance = 0;
    let mainBalance = 0;

    try {
      const custodialBalanceLamports = await connection.getBalance(
        new PublicKey(custodialWallet.publicKey)
      );
      custodialBalance = custodialBalanceLamports / 1e9;

      const mainBalanceLamports = await connection.getBalance(
        new PublicKey(main_pkey)
      );
      mainBalance = mainBalanceLamports / 1e9;
    } catch (error) {
      console.error("Error fetching balances:", error.message);
    }

    // Clean up pending registration
    delete global.pendingRegistrations[username];

    res.status(201).json({
      success: true,
      message: "✅ User registered successfully",
      data: {
        telegram: {
          userId: user.utgid,
          username: user.username,
        },
        wallets: {
          custodial: {
            publicKey: user.custodial_pkey,
            balance: custodialBalance,
            balanceSOL: `${custodialBalance} SOL`,
          },
          main: {
            publicKey: user.main_pkey,
            balance: mainBalance,
            balanceSOL: `${mainBalance} SOL`,
          },
        },
        status: user.status,
        createdAt: user.created_at,
        note: "Custodial wallet created. Keep your main wallet private key safe!",
      },
    });
  } catch (error) {
    console.error("OTP verification error:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Get all users
router.get("/", async (req, res) => {
  try {
    const result = await query(
      "SELECT utgid, username, custodial_pkey, main_pkey, status, created_at FROM users ORDER BY created_at DESC"
    );
    res.json({
      success: true,
      count: result.rows.length,
      data: result.rows,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Get user by ID or username
router.get("/:identifier", async (req, res) => {
  try {
    const { identifier } = req.params;

    // Try both utgid and username
    const result = await query(
      "SELECT utgid, username, custodial_pkey, main_pkey, status, created_at FROM users WHERE utgid = $1 OR username = $1",
      [identifier]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: "User not found",
      });
    }

    const user = result.rows[0];

    // Get balances
    const connection = new Connection("https://api.devnet.solana.com/");
    let custodialBalance = 0;
    let mainBalance = 0;

    try {
      const custodialBalanceLamports = await connection.getBalance(
        new PublicKey(user.custodial_pkey)
      );
      custodialBalance = custodialBalanceLamports / 1e9;

      const mainBalanceLamports = await connection.getBalance(
        new PublicKey(user.main_pkey)
      );
      mainBalance = mainBalanceLamports / 1e9;
    } catch (error) {
      console.error("Error fetching balances:", error.message);
    }

    res.json({
      success: true,
      data: {
        telegram: {
          userId: user.utgid,
          username: user.username,
        },
        wallets: {
          custodial: {
            publicKey: user.custodial_pkey,
            balance: custodialBalance,
            balanceSOL: `${custodialBalance} SOL`,
          },
          main: {
            publicKey: user.main_pkey,
            balance: mainBalance,
            balanceSOL: `${mainBalance} SOL`,
          },
        },
        status: user.status,
        createdAt: user.created_at,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Update user
router.put("/:utgid", async (req, res) => {
  try {
    const { utgid } = req.params;
    const { main_pkey, status, username } = req.body;

    const result = await query(
      `UPDATE users 
       SET main_pkey = COALESCE($1, main_pkey),
           status = COALESCE($2, status),
           username = COALESCE($3, username)
       WHERE utgid = $4
       RETURNING utgid, username, custodial_pkey, main_pkey, status, created_at`,
      [main_pkey, status, username, utgid]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: "User not found",
      });
    }

    res.json({
      success: true,
      data: result.rows[0],
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Get user's groups
router.get("/:utgid/groups", async (req, res) => {
  try {
    const { utgid } = req.params;
    const result = await query(
      `SELECT g.*, p.role, p.joined_at
       FROM participants p
       JOIN groups g ON p.tgid = g.tgid
       WHERE p.utgid = $1 AND p.left_at IS NULL
       ORDER BY p.joined_at DESC`,
      [utgid]
    );

    res.json({
      success: true,
      count: result.rows.length,
      data: result.rows,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Get user's orders
// router.get("/:utgid/orders", async (req, res) => {
//   try {
//     const { utgid } = req.params;
//     const result = await query(
//       `SELECT uo.*, o.token_symbol, o.transaction_hash, o.status as order_status, o.created_at as order_created_at
//        FROM user_orders uo
//        JOIN orders o ON uo.order_id = o.order_id
//        WHERE uo.utgid = $1
//        ORDER BY uo.created_at DESC`,
//       [utgid]
//     );

//     res.json({
//       success: true,
//       count: result.rows.length,
//       data: result.rows,
//     });
//   } catch (error) {
//     res.status(500).json({
//       success: false,
//       error: error.message,
//     });
//   }
// });

// Get user wallet balance
router.get("/:utgid/balance", async (req, res) => {
  try {
    const { utgid } = req.params;
    const result = await query(
      "SELECT custodial_pkey, main_pkey FROM users WHERE utgid = $1 OR username = $1",
      [utgid]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: "User not found",
      });
    }

    const user = result.rows[0];
    const connection = new Connection("https://api.devnet.solana.com/");

    const custodialBalanceLamports = await connection.getBalance(
      new PublicKey(user.custodial_pkey)
    );
    const mainBalanceLamports = await connection.getBalance(
      new PublicKey(user.main_pkey)
    );

    const custodialBalance = custodialBalanceLamports / 1e9;
    const mainBalance = mainBalanceLamports / 1e9;

    res.json({
      success: true,
      data: {
        custodial: {
          publicKey: user.custodial_pkey,
          balance: custodialBalance,
          balanceLamports: custodialBalanceLamports,
        },
        main: {
          publicKey: user.main_pkey,
          balance: mainBalance,
          balanceLamports: mainBalanceLamports,
        },
        total: custodialBalance + mainBalance,
        cluster: "devnet",
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// ...existing code...

// Get user's orders and trading history
router.get("/:userId/orders", async (req, res) => {
  try {
    const { userId } = req.params;

    // Check if user exists
    const userCheck = await query(
      "SELECT utgid FROM users WHERE username = $1 OR utgid = $1",
      [userId]
    );

    if (userCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: "User not found",
      });
    }

    const utgid = userCheck.rows[0].utgid;

    // Get all user_orders with order details
    const result = await query(
      `SELECT 
        uo.*,
        o.token_symbol,
        o.transaction_hash,
        o.status as order_status,
        o.created_at as order_date
       FROM user_orders uo
       JOIN orders o ON uo.order_id = o.order_id
       WHERE uo.utgid = $1
       ORDER BY uo.created_at DESC`,
      [utgid]
    );

    const orders = result.rows;

    // Calculate summary statistics
    const summary = {
      totalOrders: orders.length,
      activeOrders: orders.filter(o => o.status === 'active').length,
      totalInvested: orders.reduce((sum, o) => sum + parseFloat(o.amount || 0), 0),
      totalTokens: orders.reduce((sum, o) => sum + parseFloat(o.tokens_allocated || 0), 0),
      totalProfitLoss: orders.reduce((sum, o) => sum + parseFloat(o.profit_loss || 0), 0),
    };

    res.json({
      success: true,
      data: {
        orders,
        summary,
      },
    });
  } catch (error) {
    console.error("Get user orders error:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// ...existing code...


module.exports = router;
