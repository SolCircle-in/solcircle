const express = require("express");
const router = express.Router();
const { query } = require("../db/queries");

// Get all locks
router.get("/", async (req, res) => {
  try {
    const { utgid, session_id, lock_type } = req.query;
    let queryText = "SELECT * FROM locks WHERE 1=1";
    const params = [];

    if (utgid) {
      params.push(utgid);
      queryText += ` AND utgid = $${params.length}`;
    }

    if (session_id) {
      params.push(session_id);
      queryText += ` AND session_id = $${params.length}`;
    }

    if (lock_type) {
      params.push(lock_type);
      queryText += ` AND lock_type = $${params.length}`;
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

// Get active locks for a user
router.get("/active/:utgid", async (req, res) => {
  try {
    const { utgid } = req.params;
    const result = await query(
      "SELECT * FROM locks WHERE utgid = $1 AND released_at IS NULL ORDER BY created_at DESC",
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

// Create new lock
router.post("/", async (req, res) => {
  try {
    const { utgid, session_id, locked_amount, lock_type } = req.body;

    if (!utgid || !session_id || !locked_amount || !lock_type) {
      return res.status(400).json({
        success: false,
        error: "utgid, session_id, locked_amount, and lock_type are required",
      });
    }

    if (!["session", "proposal"].includes(lock_type)) {
      return res.status(400).json({
        success: false,
        error: 'lock_type must be either "session" or "proposal"',
      });
    }

    const result = await query(
      `INSERT INTO locks (utgid, session_id, locked_amount, lock_type)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [utgid, session_id, locked_amount, lock_type]
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

// Release lock
router.put("/:lock_id/release", async (req, res) => {
  try {
    const { lock_id } = req.params;

    const result = await query(
      `UPDATE locks 
       SET released_at = NOW()
       WHERE lock_id = $1 AND released_at IS NULL
       RETURNING *`,
      [lock_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: "Lock not found or already released",
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

// Release all locks for a session
router.put("/session/:session_id/release", async (req, res) => {
  try {
    const { session_id } = req.params;

    const result = await query(
      `UPDATE locks 
       SET released_at = NOW()
       WHERE session_id = $1 AND released_at IS NULL
       RETURNING *`,
      [session_id]
    );

    res.json({
      success: true,
      count: result.rowCount,
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
