const express = require("express");
const router = express.Router();
const { query, transaction } = require("../db/queries");

// Get all sessions
router.get("/", async (req, res) => {
  try {
    const { tgid, status } = req.query;
    let queryText = "SELECT * FROM sessions WHERE 1=1";
    const params = [];

    if (tgid) {
      params.push(tgid);
      queryText += ` AND tgid = $${params.length}`;
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

// Get session by ID
router.get("/:session_id", async (req, res) => {
  try {
    const { session_id } = req.params;
    const result = await query("SELECT * FROM sessions WHERE session_id = $1", [
      session_id,
    ]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: "Session not found",
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

// Create new session
router.post("/", async (req, res) => {
  try {
    const { session_id, tgid, created_by, type, participants } = req.body;

    if (!session_id || !tgid || !created_by || !type) {
      return res.status(400).json({
        success: false,
        error: "session_id, tgid, created_by, and type are required",
      });
    }

    if (!["buy", "sell"].includes(type)) {
      return res.status(400).json({
        success: false,
        error: 'type must be either "buy" or "sell"',
      });
    }

    const result = await query(
      `INSERT INTO sessions (session_id, tgid, created_by, type, participants)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [session_id, tgid, created_by, type, participants || []]
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

// Update session
router.put("/:session_id", async (req, res) => {
  try {
    const { session_id } = req.params;
    const { status, participants, current_proposal_id, closed_at } = req.body;

    const result = await query(
      `UPDATE sessions 
       SET status = COALESCE($1, status),
           participants = COALESCE($2, participants),
           current_proposal_id = COALESCE($3, current_proposal_id),
           closed_at = COALESCE($4, closed_at)
       WHERE session_id = $5
       RETURNING *`,
      [status, participants, current_proposal_id, closed_at, session_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: "Session not found",
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

// Add participant to session
router.post("/:session_id/participants", async (req, res) => {
  try {
    const { session_id } = req.params;
    const { utgid } = req.body;

    if (!utgid) {
      return res.status(400).json({
        success: false,
        error: "utgid is required",
      });
    }

    const result = await query(
      `UPDATE sessions 
       SET participants = array_append(participants, $1)
       WHERE session_id = $2 AND NOT ($1 = ANY(participants))
       RETURNING *`,
      [utgid, session_id]
    );

    if (result.rows.length === 0) {
      return res.status(400).json({
        success: false,
        error: "Session not found or participant already added",
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

// Get session proposals
router.get("/:session_id/proposals", async (req, res) => {
  try {
    const { session_id } = req.params;
    const result = await query(
      "SELECT * FROM proposals WHERE session_id = $1 ORDER BY created_at DESC",
      [session_id]
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

module.exports = router;
