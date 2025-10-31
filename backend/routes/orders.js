const express = require("express");
const router = express.Router();
const { query, transaction } = require("../db/queries");

// Get all orders
router.get("/", async (req, res) => {
  try {
    const { proposal_id, status } = req.query;
    let queryText = "SELECT * FROM orders WHERE 1=1";
    const params = [];

    if (proposal_id) {
      params.push(proposal_id);
      queryText += ` AND proposal_id = $${params.length}`;
    }

    if (status) {
      params.push(status);
      queryText += ` AND status = $${params.length}`;
    }

    queryText += " ORDER BY created_at DESC";

    const result = await query(queryText, params);
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

// Get order by ID
router.get("/:order_id", async (req, res) => {
  try {
    const { order_id } = req.params;
    const result = await query(
      `SELECT o.*, p.tgid, p.session_id, p.created_by, p.proposal_text
       FROM orders o
      LEFT JOIN proposals p ON o.proposal_id = p.proposal_id
       WHERE o.order_id = $1`,
     [order_id]
   );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: "Order not found",
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

// Create new order
router.post("/", async (req, res) => {
  try {
    const {
      order_id,
      proposal_id,
      transaction_hash,
      token_symbol,
      total_amount_spent,
      token_amount,
      fees,
      executed_by,
    } = req.body;

    if (!order_id || !proposal_id) {
      return res.status(400).json({
        success: false,
        error: "order_id and proposal_id are required",
      });
    }

    const result = await query(
      `INSERT INTO orders (
        order_id, proposal_id, transaction_hash, token_symbol,
        total_amount_spent, token_amount, fees, executed_by
      )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        order_id,
        proposal_id,
        transaction_hash,
        token_symbol,
        total_amount_spent || 0,
        token_amount || 0,
        fees || 0,
        executed_by,
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

// Update order
router.put("/:order_id", async (req, res) => {
  try {
    const { order_id } = req.params;
    const { status, closed_at, transaction_hash } = req.body;

    const result = await query(
      `UPDATE orders 
       SET status = COALESCE($1, status),
           closed_at = COALESCE($2, closed_at),
           transaction_hash = COALESCE($3, transaction_hash)
       WHERE order_id = $4
       RETURNING *`,
      [status, closed_at, transaction_hash, order_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: "Order not found",
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


// ...existing code...

// Get user's specific order details
router.get("/:order_id/user/:userId", async (req, res) => {
  try {
    const { order_id, userId } = req.params;

    // Get user's utgid
    const userResult = await query(
      "SELECT utgid FROM users WHERE telegram->>'userId' = $1",
      [userId]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: "User not found",
      });
    }

    const utgid = userResult.rows[0].utgid;

    // Get user's order details
    const result = await query(
      `SELECT * FROM user_orders 
       WHERE order_id = $1 AND utgid = $2`,
      [order_id, utgid]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: "User order not found",
      });
    }

    res.json({
      success: true,
      data: result.rows[0],
    });
  } catch (error) {
    console.error("Get user order error:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// ...existing code...


// Get order participants (user_orders)
router.get("/:order_id/participants", async (req, res) => {
  try {
    const { order_id } = req.params;
    const result = await query(
      `SELECT uo.*, u.custodial_pkey, u.main_pkey
       FROM user_orders uo
       JOIN users u ON uo.utgid = u.utgid
       WHERE uo.order_id = $1
       ORDER BY uo.created_at DESC`,
      [order_id]
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

// Add user to order (user_orders)
router.post("/:order_id/participants", async (req, res) => {
  try {
    const { order_id } = req.params;
    const { utgid, amount, fees, tokens_allocated } = req.body;

    if (!utgid) {
      return res.status(400).json({
        success: false,
        error: "utgid is required",
      });
    }

    const result = await query(
      `INSERT INTO user_orders (order_id, utgid, amount, fees, tokens_allocated)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [order_id, utgid, amount || 0, fees || 0, tokens_allocated || 0]
    );

    res.status(201).json({
      success: true,
      data: result.rows[0],
    });
  } catch (error) {
    if (error.constraint === "user_orders_order_id_utgid_key") {
      return res.status(400).json({
        success: false,
        error: "User already added to this order",
      });
    }
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

module.exports = router;
