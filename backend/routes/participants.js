const express = require("express");
const router = express.Router();
const { query } = require("../db/queries");

// Get all participants
router.get("/", async (req, res) => {
  try {
    const { tgid, utgid } = req.query;
    let queryText = "SELECT * FROM participants WHERE 1=1";
    const params = [];

    if (tgid) {
      params.push(tgid);
      queryText += ` AND tgid = $${params.length}`;
    }

    if (utgid) {
      params.push(utgid);
      queryText += ` AND utgid = $${params.length}`;
    }

    queryText += " ORDER BY joined_at DESC";

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

// Add participant to group
router.post("/", async (req, res) => {
  try {
    const { utgid, tgid, role } = req.body;

    if (!utgid || !tgid) {
      return res.status(400).json({
        success: false,
        error: "utgid and tgid are required",
      });
    }

    const result = await query(
      `INSERT INTO participants (utgid, tgid, role)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [utgid, tgid, role || "member"]
    );

    res.status(201).json({
      success: true,
      data: result.rows[0],
    });
  } catch (error) {
    if (error.constraint === "participants_utgid_tgid_key") {
      return res.status(400).json({
        success: false,
        error: "User is already a participant in this group",
      });
    }
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Update participant
router.put("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { role, left_at } = req.body;

    const result = await query(
      `UPDATE participants 
       SET role = COALESCE($1, role),
           left_at = COALESCE($2, left_at)
       WHERE id = $3
       RETURNING *`,
      [role, left_at, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: "Participant not found",
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

// Remove participant from group (soft delete)
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const result = await query(
      `UPDATE participants 
       SET left_at = NOW()
       WHERE id = $1 AND left_at IS NULL
       RETURNING *`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: "Participant not found or already removed",
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

module.exports = router;
