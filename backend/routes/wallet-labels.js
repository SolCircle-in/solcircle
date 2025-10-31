const express = require("express");
const router = express.Router();
const { query } = require("../db/queries");
const { Connection, PublicKey } = require("@solana/web3.js");

/**
 * Get wallet overview with balances
 * GET /api/wallet-labels/:identifier/overview
 * Must come before /:identifier/:wallet_address
 */
router.get("/:identifier/overview", async (req, res) => {
  try {
    const { identifier } = req.params;
    
    // Get user
    const userResult = await query(
      "SELECT * FROM users WHERE utgid = $1 OR username = $1",
      [identifier]
    );
    
    if (userResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: "User not found",
      });
    }
    
    const user = userResult.rows[0];
    
    // Get labels
    const labelsResult = await query(
      "SELECT * FROM wallet_labels WHERE utgid = $1",
      [user.utgid]
    );
    
    const labels = {};
    labelsResult.rows.forEach((label) => {
      labels[label.wallet_address] = {
        label: label.label,
        tags: label.tags,
        note: label.note,
        color: label.color,
      };
    });
    
    // Get balances
    const connection = new Connection(
      process.env.SOLANA_RPC_URL || "https://api.devnet.solana.com"
    );
    
    let custodialBalance = 0;
    let mainBalance = 0;
    
    try {
      const custodialBalanceLamports = await connection.getBalance(
        new PublicKey(user.custodial_pkey)
      );
      custodialBalance = custodialBalanceLamports / 1e9;
    } catch (err) {
      console.error("Error fetching custodial balance:", err.message);
    }
    
    try {
      const mainBalanceLamports = await connection.getBalance(
        new PublicKey(user.main_pkey)
      );
      mainBalance = mainBalanceLamports / 1e9;
    } catch (err) {
      console.error("Error fetching main balance:", err.message);
    }
    
    // Build wallet overview
    const wallets = [
      {
        address: user.custodial_pkey,
        type: "custodial",
        balance_sol: custodialBalance.toFixed(4),
        balance_lamports: custodialBalance * 1e9,
        network: "devnet",
        label: labels[user.custodial_pkey]?.label || "🤖 Platform Wallet",
        tags: labels[user.custodial_pkey]?.tags || ["custodial", "platform"],
        note: labels[user.custodial_pkey]?.note || "Auto-managed by SolCircle",
        color: labels[user.custodial_pkey]?.color || "#6366f1",
        has_custom_label: !!labels[user.custodial_pkey],
      },
      {
        address: user.main_pkey,
        type: "main",
        balance_sol: mainBalance.toFixed(4),
        balance_lamports: mainBalance * 1e9,
        network: "devnet",
        label: labels[user.main_pkey]?.label || "💼 Personal Wallet",
        tags: labels[user.main_pkey]?.tags || ["personal", "main"],
        note: labels[user.main_pkey]?.note || "Your connected wallet",
        color: labels[user.main_pkey]?.color || "#10b981",
        has_custom_label: !!labels[user.main_pkey],
      },
    ];
    
    // Get group pool wallets
    const groupsResult = await query(
      `SELECT g.tgid, g.relay_account, p.role, p.joined_at
       FROM participants p
       JOIN groups g ON p.tgid = g.tgid
       WHERE p.utgid = $1 AND p.left_at IS NULL`,
      [user.utgid]
    );
    
    for (const group of groupsResult.rows) {
      let groupBalance = 0;
      try {
        const groupBalanceLamports = await connection.getBalance(
          new PublicKey(group.relay_account)
        );
        groupBalance = groupBalanceLamports / 1e9;
      } catch (err) {
        console.error(`Error fetching group balance for ${group.tgid}:`, err.message);
      }
      
      wallets.push({
        address: group.relay_account,
        type: "group",
        balance_sol: groupBalance.toFixed(4),
        balance_lamports: groupBalance * 1e9,
        network: "devnet",
        group_id: group.tgid,
        role: group.role,
        label: labels[group.relay_account]?.label || `👥 Group Pool ${group.tgid.slice(-4)}`,
        tags: labels[group.relay_account]?.tags || ["group", "collaborative"],
        note: labels[group.relay_account]?.note || `Role: ${group.role}`,
        color: labels[group.relay_account]?.color || "#f59e0b",
        has_custom_label: !!labels[group.relay_account],
      });
    }
    
    res.json({
      success: true,
      data: {
        user: {
          utgid: user.utgid,
          username: user.username,
        },
        total_wallets: wallets.length,
        total_balance_sol: wallets.reduce((sum, w) => sum + parseFloat(w.balance_sol), 0).toFixed(4),
        wallets: wallets,
      },
    });
  } catch (error) {
    console.error("Wallets overview error:", error.message);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * Search labels by tag
 * GET /api/wallet-labels/:identifier/tags/:tag
 * Must come before /:identifier/:wallet_address
 */
router.get("/:identifier/tags/:tag", async (req, res) => {
  try {
    const { identifier, tag } = req.params;
    
    const userResult = await query(
      "SELECT utgid FROM users WHERE utgid = $1 OR username = $1",
      [identifier]
    );
    
    if (userResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: "User not found",
      });
    }
    
    const utgid = userResult.rows[0].utgid;
    
    const labelsResult = await query(
      "SELECT * FROM wallet_labels WHERE utgid = $1 AND $2 = ANY(tags) ORDER BY created_at DESC",
      [utgid, tag]
    );
    
    res.json({
      success: true,
      data: {
        tag: tag,
        total: labelsResult.rows.length,
        labels: labelsResult.rows,
      },
    });
  } catch (error) {
    console.error("Search labels by tag error:", error.message);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * Get all labeled wallets for user
 * GET /api/wallet-labels/:identifier
 */
router.get("/:identifier", async (req, res) => {
  try {
    const { identifier } = req.params;
    
    // Get user
    const userResult = await query(
      "SELECT utgid, username FROM users WHERE utgid = $1 OR username = $1",
      [identifier]
    );
    
    if (userResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: "User not found",
      });
    }
    
    const user = userResult.rows[0];
    
    // Get all labels
    const labelsResult = await query(
      "SELECT * FROM wallet_labels WHERE utgid = $1 ORDER BY created_at DESC",
      [user.utgid]
    );
    
    res.json({
      success: true,
      data: {
        user: {
          utgid: user.utgid,
          username: user.username,
        },
        total: labelsResult.rows.length,
        labels: labelsResult.rows,
      },
    });
  } catch (error) {
    console.error("Get wallet labels error:", error.message);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * Get label for specific wallet
 * GET /api/wallet-labels/:identifier/:wallet_address
 */
router.get("/:identifier/:wallet_address", async (req, res) => {
  try {
    const { identifier, wallet_address } = req.params;
    
    const userResult = await query(
      "SELECT utgid FROM users WHERE utgid = $1 OR username = $1",
      [identifier]
    );
    
    if (userResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: "User not found",
      });
    }
    
    const utgid = userResult.rows[0].utgid;
    
    const labelResult = await query(
      "SELECT * FROM wallet_labels WHERE utgid = $1 AND wallet_address = $2",
      [utgid, wallet_address]
    );
    
    if (labelResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: "Label not found",
      });
    }
    
    res.json({
      success: true,
      data: labelResult.rows[0],
    });
  } catch (error) {
    console.error("Get wallet label error:", error.message);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * Add or update wallet label
 * POST /api/wallet-labels
 */
router.post("/", async (req, res) => {
  try {
    const { identifier, wallet_address, label, tags, note, color } = req.body;
    
    if (!identifier || !wallet_address) {
      return res.status(400).json({
        success: false,
        error: "identifier and wallet_address are required",
      });
    }
    
    // Validate wallet address format (basic check)
    if (wallet_address.length < 32 || wallet_address.length > 44) {
      return res.status(400).json({
        success: false,
        error: "Invalid wallet address format",
      });
    }
    
    // Get user
    const userResult = await query(
      "SELECT utgid FROM users WHERE utgid = $1 OR username = $1",
      [identifier]
    );
    
    if (userResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: "User not found",
      });
    }
    
    const utgid = userResult.rows[0].utgid;
    
    // Upsert label (insert or update if exists)
    const result = await query(
      `INSERT INTO wallet_labels (utgid, wallet_address, label, tags, note, color)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (utgid, wallet_address)
       DO UPDATE SET
         label = COALESCE(EXCLUDED.label, wallet_labels.label),
         tags = COALESCE(EXCLUDED.tags, wallet_labels.tags),
         note = COALESCE(EXCLUDED.note, wallet_labels.note),
         color = COALESCE(EXCLUDED.color, wallet_labels.color),
         updated_at = NOW()
       RETURNING *`,
      [
        utgid,
        wallet_address,
        label || null,
        tags || [],
        note || null,
        color || "#6366f1"
      ]
    );
    
    res.json({
      success: true,
      message: "Label saved successfully",
      data: result.rows[0],
    });
  } catch (error) {
    console.error("Add wallet label error:", error.message);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * Update wallet label
 * PUT /api/wallet-labels/:identifier/:wallet_address
 */
router.put("/:identifier/:wallet_address", async (req, res) => {
  try {
    const { identifier, wallet_address } = req.params;
    const { label, tags, note, color } = req.body;
    
    const userResult = await query(
      "SELECT utgid FROM users WHERE utgid = $1 OR username = $1",
      [identifier]
    );
    
    if (userResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: "User not found",
      });
    }
    
    const utgid = userResult.rows[0].utgid;
    
    const result = await query(
      `UPDATE wallet_labels
       SET label = COALESCE($3, label),
           tags = COALESCE($4, tags),
           note = COALESCE($5, note),
           color = COALESCE($6, color),
           updated_at = NOW()
       WHERE utgid = $1 AND wallet_address = $2
       RETURNING *`,
      [utgid, wallet_address, label, tags, note, color]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: "Label not found",
      });
    }
    
    res.json({
      success: true,
      message: "Label updated successfully",
      data: result.rows[0],
    });
  } catch (error) {
    console.error("Update wallet label error:", error.message);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * Delete wallet label
 * DELETE /api/wallet-labels/:identifier/:wallet_address
 */
router.delete("/:identifier/:wallet_address", async (req, res) => {
  try {
    const { identifier, wallet_address } = req.params;
    
    const userResult = await query(
      "SELECT utgid FROM users WHERE utgid = $1 OR username = $1",
      [identifier]
    );
    
    if (userResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: "User not found",
      });
    }
    
    const utgid = userResult.rows[0].utgid;
    
    const result = await query(
      "DELETE FROM wallet_labels WHERE utgid = $1 AND wallet_address = $2 RETURNING *",
      [utgid, wallet_address]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: "Label not found",
      });
    }
    
    res.json({
      success: true,
      message: "Label deleted successfully",
      data: result.rows[0],
    });
  } catch (error) {
    console.error("Delete wallet label error:", error.message);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

module.exports = router;
