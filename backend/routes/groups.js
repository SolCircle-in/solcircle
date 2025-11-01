const express = require("express");
const router = express.Router();
const { query, transaction } = require("../db/queries");
const { createCustodialWallet, encryptPrivateKey } = require("../utils/wallet");
const {
  verifyGroupOwnership,
  getChatInfo,
  sendVerificationMessage,
} = require("../utils/telegram");
const { generateVerificationToken, hash } = require("../utils/crypto");
const anchor = require("@coral-xyz/anchor");
const { AnchorProvider, Wallet, BN } = anchor;
const {
  Connection,
  PublicKey,
  Keypair,
  SystemProgram,
  TransactionInstruction,
  Transaction,
} = require("@solana/web3.js");
const { promises: fs } = require("fs");
const path = require("path");

// Load program ID and admin keypair
let programId, adminKeypair;

// Load Solana configuration
(async function loadSolanaConfig() {
  try {
    // Try multiple paths for IDL file (development vs production)
    const possibleIdlPaths = [
      path.join(process.cwd(), 'target/idl/sol_pool.json'),
      path.join(process.cwd(), 'idl/sol_pool.json'),
      path.join(__dirname, '../target/idl/sol_pool.json'),
      path.join(__dirname, '../idl/sol_pool.json'),
    ];

    let idlFile;
    let loadedFrom;
    
    for (const idlPath of possibleIdlPaths) {
      try {
        idlFile = await fs.readFile(idlPath, 'utf8');
        loadedFrom = idlPath;
        break;
      } catch (err) {
        // Try next path
        continue;
      }
    }

    if (!idlFile) {
      throw new Error('IDL file not found in any expected location');
    }

    const programIdl = JSON.parse(idlFile);
    programId = new PublicKey(programIdl.address || programIdl.metadata?.address);

    console.log(`✅ Loaded IDL from: ${loadedFrom}`);

    // Try multiple paths for admin keypair
    const possibleKeyPaths = [
      path.join(process.cwd(), 'admin-keypair.json'),
      path.join(__dirname, '../admin-keypair.json'),
    ];

    let adminKeyFile;
    let keyLoadedFrom;

    for (const keyPath of possibleKeyPaths) {
      try {
        adminKeyFile = await fs.readFile(keyPath, 'utf8');
        keyLoadedFrom = keyPath;
        break;
      } catch (err) {
        continue;
      }
    }

    if (!adminKeyFile) {
      // Try environment variable as fallback
      if (process.env.ADMIN_KEYPAIR) {
        adminKeypair = Keypair.fromSecretKey(
          new Uint8Array(JSON.parse(process.env.ADMIN_KEYPAIR))
        );
        console.log("✅ Loaded admin keypair from environment variable");
      } else {
        throw new Error('Admin keypair not found in any expected location or environment');
      }
    } else {
      adminKeypair = Keypair.fromSecretKey(
        new Uint8Array(JSON.parse(adminKeyFile))
      );
      console.log(`✅ Loaded admin keypair from: ${keyLoadedFrom}`);
    }

    console.log("✅ Loaded Solana program:", programId.toString());
    console.log("✅ Admin keypair:", adminKeypair.publicKey.toString());
  } catch (error) {
    console.error(
      "❌ ERROR: Could not load Solana program config:",
      error.message
    );
    console.error("Stack trace:", error.stack);
    // Don't throw - let the routes handle missing config gracefully
  }
})();

// Helper function to create initialize instruction manually
function createInitializeInstruction(poolPda, admin, tgId, programId) {
  // Instruction discriminator for "initialize" (first 8 bytes of sha256("global:initialize"))
  const discriminator = Buffer.from([175, 175, 109, 31, 13, 152, 155, 237]);

  // Encode tg_id as string (length prefix + bytes)
  const tgIdBuffer = Buffer.from(tgId, "utf8");
  const tgIdLength = Buffer.alloc(4);
  tgIdLength.writeUInt32LE(tgIdBuffer.length, 0);

  const data = Buffer.concat([discriminator, tgIdLength, tgIdBuffer]);

  return new TransactionInstruction({
    keys: [
      { pubkey: poolPda, isSigner: false, isWritable: true },
      { pubkey: admin, isSigner: true, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    programId: programId,
    data: data,
  });
}

// ==================== GROUP REGISTRATION ROUTES ====================

router.post("/register", async (req, res) => {
  try {
    // Check if Solana config is loaded
    if (!programId || !adminKeypair) {
      return res.status(503).json({
        success: false,
        error: "Solana configuration not loaded. Please check server logs.",
      });
    }

    console.log("Registering group with data:", req.body);
    const { tgid, userId, min_stake, cooldown_period } = req.body;

    if (!tgid || !userId) {
      return res.status(400).json({
        success: false,
        error:
          "tgid (Telegram group ID) and userId (Telegram user ID) are required",
      });
    }

    const botToken = process.env.BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN;
    if (!botToken) {
      return res.status(500).json({
        success: false,
        error: "Telegram bot token not configured",
      });
    }

    // Step 1: Verify user is owner/admin of the group
    const verification = await verifyGroupOwnership(botToken, tgid, userId);
    console.log("Ownership verification result:", verification);

    if (!verification.success) {
      return res.status(400).json({
        success: false,
        error: `Failed to verify group ownership: ${verification.error}`,
      });
    }

    if (!verification.isOwner && !verification.isAdmin) {
      return res.status(403).json({
        success: false,
        error: "Only group owners or administrators can register the group",
        userStatus: verification.status,
      });
    }

    // Step 2: Check if group is already registered
    const existingGroup = await query("SELECT * FROM groups WHERE tgid = $1", [
      tgid,
    ]);

    if (existingGroup.rows.length > 0) {
      return res.status(400).json({
        success: false,
        error: "Group is already registered",
        group: existingGroup.rows[0],
      });
    }

    // Step 3: Get group information
    const chatInfo = await getChatInfo(botToken, tgid);

    if (!chatInfo.success) {
      return res.status(400).json({
        success: false,
        error: `Failed to get group info: ${chatInfo.error}`,
      });
    }

    // Step 4: Create group with custodial wallet AND initialize Solana pool
    const result = await transaction(async (client) => {
      // Create custodial wallet for group
      const groupWallet = createCustodialWallet();
      const masterPassword = process.env.ENCRYPTION_MASTER_PASSWORD;

      if (!masterPassword) {
        throw new Error("Encryption master password not configured");
      }

      // Encrypt the private key
      const encryptedPrivateKey = encryptPrivateKey(
        groupWallet.privateKey,
        masterPassword
      );

      console.log(`🔄 Initializing Solana pool for group ${tgid}...`);

      // Initialize Solana connection
      const connection = new Connection(
        process.env.SOLANA_RPC_URL || "https://api.devnet.solana.com",
        "confirmed"
      );

      // ✅ CORRECT: Use admin pubkey as seed (same as your test!)
      const [poolPdaKey, poolBump] = PublicKey.findProgramAddressSync(
        [Buffer.from("pool"), Buffer.from(tgid.toString())],
        programId
      );

      const poolPda = poolPdaKey.toString();
      console.log(`Pool PDA: ${poolPda}`);
      console.log(`Admin pubkey (seed): ${adminKeypair.publicKey.toString()}`);

      // Check if pool already exists
      const poolAccountInfo = await connection.getAccountInfo(poolPdaKey);

      // If pool exists, reuse it for this group
      if (poolAccountInfo) {
        console.log(`♻️  Reusing existing pool: ${poolPda}`);
      } else {
        // Create initialize instruction
        const initializeIx = createInitializeInstruction(
          poolPdaKey,
          adminKeypair.publicKey,
          tgid.toString(),
          programId
        );

        // Create and send transaction
        const tx = new Transaction().add(initializeIx);

        try {
          const signature = await connection.sendTransaction(
            tx,
            [adminKeypair],
            {
              skipPreflight: false,
              preflightCommitment: "confirmed",
            }
          );

          await connection.confirmTransaction(signature, "confirmed");

          console.log(`✅ Solana pool initialized`);
          console.log(`Transaction: ${signature}`);
          console.log(
            `Explorer: https://explorer.solana.com/tx/${signature}?cluster=devnet`
          );
        } catch (txError) {
          console.error("Pool initialization transaction error:", txError);

          // Get detailed error logs
          if (txError.logs) {
            console.error("Transaction logs:", txError.logs);
          }

          throw new Error(`Failed to initialize pool: ${txError.message}`);
        }
      }

      // Create group in database
      const groupResult = await client.query(
        `INSERT INTO groups (
          tgid, 
          relay_account, 
          encrypted_key,
          pool_pda,
          owner, 
          admin, 
          cooldown_period, 
          min_stake, 
          status
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING *`,
        [
          tgid,
          groupWallet.publicKey,
          encryptedPrivateKey,
          poolPda,
          userId,
          [userId],
          cooldown_period || 0,
          min_stake || 0,
          "active",
        ]
      );

      const group = groupResult.rows[0];
      console.log(`✅ Created group: ${tgid}`);
      console.log(`✅ Group wallet: ${groupWallet.publicKey}`);
      console.log(`✅ Pool PDA: ${poolPda}`);

      return {
        group,
        groupWallet: {
          publicKey: groupWallet.publicKey,
        },
        poolPda,
      };
    });

    res.status(201).json({
      success: true,
      message: "Group registered successfully with Solana pool",
      data: {
        group: {
          tgid: result.group.tgid,
          status: result.group.status,
          owner: result.group.owner,
          admin: result.group.admin,
          min_stake: result.group.min_stake,
          cooldown_period: result.group.cooldown_period,
          created_at: result.group.created_at,
        },
        wallet: {
          publicKey: result.groupWallet.publicKey,
        },
        pool: {
          pda: result.poolPda,
        },
        groupInfo: {
          title: chatInfo.title,
          type: chatInfo.type,
          memberCount: chatInfo.memberCount,
        },
        verification: {
          isOwner: verification.isOwner,
          isAdmin: verification.isAdmin,
        },
      },
    });
  } catch (error) {
    console.error("Registration error:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});
router.get("/", async (req, res) => {
  try {
    const result = await query("SELECT * FROM groups ORDER BY created_at DESC");
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

// Get group by ID
router.get("/:tgid", async (req, res) => {
  try {
    const { tgid } = req.params;
    const result = await query("SELECT * FROM groups WHERE tgid = $1", [tgid]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: "Group not found",
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

// Create new group
router.post("/", async (req, res) => {
  try {
    const { tgid, relay_account, owner, admin, cooldown_period, min_stake } =
      req.body;

    if (!tgid || !owner) {
      return res.status(400).json({
        success: false,
        error: "tgid and owner are required",
      });
    }

    const result = await query(
      `INSERT INTO groups (tgid, relay_account, owner, admin, cooldown_period, min_stake)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        tgid,
        relay_account,
        owner,
        admin || [],
        cooldown_period || 0,
        min_stake || 0,
      ]
    );

    res.status(201).json({
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

// Update group
router.put("/:tgid", async (req, res) => {
  try {
    const { tgid } = req.params;
    const { relay_account, admin, cooldown_period, status, min_stake } =
      req.body;

    const result = await query(
      `UPDATE groups 
       SET relay_account = COALESCE($1, relay_account),
           admin = COALESCE($2, admin),
           cooldown_period = COALESCE($3, cooldown_period),
           status = COALESCE($4, status),
           min_stake = COALESCE($5, min_stake)
       WHERE tgid = $6
       RETURNING *`,
      [relay_account, admin, cooldown_period, status, min_stake, tgid]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: "Group not found",
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

// Get group participants
router.get("/:tgid/participants", async (req, res) => {
  try {
    const { tgid } = req.params;
    
    // Check if group exists
    const groupCheck = await query(
      "SELECT tgid FROM groups WHERE tgid = $1",
      [tgid]
    );

    if (groupCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: "Group not found",
      });
    }
    
    // Get participants from user_orders (actual participants who traded)
    // This shows real participation based on trading activity
    const result = await query(
      `SELECT DISTINCT
        u.utgid,
        u.username,
        u.custodial_pkey,
        u.main_pkey,
        u.status as user_status,
        MIN(uo.created_at) as first_participated,
        MAX(uo.created_at) as last_participated,
        COUNT(DISTINCT uo.order_id) as order_count,
        SUM(uo.amount) as total_contributed
       FROM user_orders uo
       JOIN orders o ON uo.order_id = o.order_id
       JOIN proposals p ON o.proposal_id = p.proposal_id
       JOIN users u ON uo.utgid = u.utgid
       WHERE p.tgid = $1
       GROUP BY u.utgid, u.username, u.custodial_pkey, u.main_pkey, u.status
       ORDER BY first_participated DESC`,
      [tgid]
    );

    res.json({
      success: true,
      count: result.rows.length,
      data: result.rows,
    });
  } catch (error) {
    console.error("Get group participants error:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});


// ...existing code...

// Get group's orders
router.get("/:tgid/orders", async (req, res) => {
  try {
    const { tgid } = req.params;

    // Check if group exists
    const groupCheck = await query(
      "SELECT tgid FROM groups WHERE tgid = $1",
      [tgid]
    );

    if (groupCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: "Group not found",
      });
    }

    // Get all orders for this group (via proposals)
    const result = await query(
      `SELECT 
        o.*,
        p.tgid,
        COUNT(DISTINCT uo.utgid) as participant_count
       FROM orders o
       LEFT JOIN proposals p ON o.proposal_id = p.proposal_id
       LEFT JOIN user_orders uo ON o.order_id = uo.order_id
       WHERE p.tgid = $1
       GROUP BY o.order_id, o.proposal_id, o.transaction_hash, 
                o.token_symbol, o.total_amount_spent, o.token_amount, 
                o.fees, o.executed_by, o.status, o.created_at, p.tgid
       ORDER BY o.created_at DESC`,
      [tgid]
    );

    res.json({
      success: true,
      data: result.rows,
      count: result.rows.length,
    });
  } catch (error) {
    console.error("Get group orders error:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Get group's total holdings
router.get("/:tgid/holdings", async (req, res) => {
  try {
    const { tgid } = req.params;

    // Check if group exists
    const groupCheck = await query(
      "SELECT * FROM groups WHERE tgid = $1",
      [tgid]
    );

    if (groupCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: "Group not found",
      });
    }

    const group = groupCheck.rows[0];

    // Get group's wallet balance
    const connection = new Connection(
      process.env.SOLANA_RPC_URL || "https://api.devnet.solana.com"
    );

    let groupWalletBalance = 0;
    try {
      const balanceLamports = await connection.getBalance(
        new PublicKey(group.relay_account)
      );
      groupWalletBalance = balanceLamports / 1e9;
    } catch (err) {
      console.error("Error fetching group wallet balance:", err.message);
    }

    // Get all active orders (not sold) with token holdings
    const activeOrdersResult = await query(
      `SELECT 
        o.order_id,
        o.token_symbol,
        o.token_amount,
        o.total_amount_spent,
        o.bought_at_price,
        o.status,
        o.created_at,
        COUNT(DISTINCT uo.utgid) as participant_count,
        SUM(uo.tokens_allocated) as total_tokens_held
       FROM orders o
       LEFT JOIN proposals p ON o.proposal_id = p.proposal_id
       LEFT JOIN user_orders uo ON o.order_id = uo.order_id
       WHERE p.tgid = $1 AND o.status = 'completed'
       GROUP BY o.order_id, o.token_symbol, o.token_amount, 
                o.total_amount_spent, o.bought_at_price, o.status, o.created_at
       ORDER BY o.created_at DESC`,
      [tgid]
    );

    // Aggregate holdings by token
    const tokenHoldings = {};
    activeOrdersResult.rows.forEach(order => {
      const symbol = order.token_symbol;
      if (!tokenHoldings[symbol]) {
        tokenHoldings[symbol] = {
          token_symbol: symbol,
          total_tokens: 0,
          total_invested: 0,
          order_count: 0,
          orders: []
        };
      }
      
      tokenHoldings[symbol].total_tokens += parseFloat(order.total_tokens_held || order.token_amount);
      tokenHoldings[symbol].total_invested += parseFloat(order.total_amount_spent);
      tokenHoldings[symbol].order_count += 1;
      tokenHoldings[symbol].orders.push({
        order_id: order.order_id,
        tokens: parseFloat(order.total_tokens_held || order.token_amount),
        invested: parseFloat(order.total_amount_spent),
        bought_at_price: parseFloat(order.bought_at_price),
        participants: parseInt(order.participant_count),
        date: order.created_at
      });
    });

    // Get sold orders for statistics
    const soldOrdersResult = await query(
      `SELECT 
        COUNT(*) as sold_count,
        SUM(o.total_amount_spent) as total_sold_value
       FROM orders o
       LEFT JOIN proposals p ON o.proposal_id = p.proposal_id
       WHERE p.tgid = $1 AND o.status = 'sold'`,
      [tgid]
    );

    // Calculate total statistics
    const totalParticipantsResult = await query(
      `SELECT COUNT(DISTINCT uo.utgid) as total_participants
       FROM user_orders uo
       JOIN orders o ON uo.order_id = o.order_id
       JOIN proposals p ON o.proposal_id = p.proposal_id
       WHERE p.tgid = $1`,
      [tgid]
    );

    const totalStats = {
      total_sol_invested: activeOrdersResult.rows.reduce(
        (sum, order) => sum + parseFloat(order.total_amount_spent), 
        0
      ),
      total_active_orders: activeOrdersResult.rows.length,
      total_sold_orders: parseInt(soldOrdersResult.rows[0]?.sold_count || 0),
      total_participants: parseInt(totalParticipantsResult.rows[0]?.total_participants || 0),
      unique_tokens: Object.keys(tokenHoldings).length
    };

    res.json({
      success: true,
      data: {
        group: {
          tgid: group.tgid,
          relay_account: group.relay_account,
          pool_pda: group.pool_pda,
          wallet_balance_sol: groupWalletBalance.toFixed(4),
          wallet_balance_lamports: groupWalletBalance * 1e9,
          status: group.status
        },
        statistics: totalStats,
        token_holdings: Object.values(tokenHoldings),
        network: "devnet"
      }
    });
  } catch (error) {
    console.error("Get group holdings error:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// ...existing code...
module.exports = router;
