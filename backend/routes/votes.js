const express = require("express");
const router = express.Router();
const { query } = require("../db/queries");

// Get all votes
router.get("/", async (req, res) => {
  try {
    const { proposal_id, utgid } = req.query;
    let queryText = "SELECT * FROM votes WHERE 1=1";
    const params = [];

    if (proposal_id) {
      params.push(proposal_id);
      queryText += ` AND proposal_id = $${params.length}`;
    }

    if (utgid) {
      params.push(utgid);
      queryText += ` AND utgid = $${params.length}`;
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

// Create new vote
router.post("/", async (req, res) => {
  try {
    const { utgid, proposal_id, vote_type, amount, weight } = req.body;

    if (!utgid || !proposal_id || !vote_type) {
      return res.status(400).json({
        success: false,
        error: "utgid, proposal_id, and vote_type are required",
      });
    }

    if (!["yes", "no"].includes(vote_type)) {
      return res.status(400).json({
        success: false,
        error: 'vote_type must be either "yes" or "no"',
      });
    }

    // Check if user already voted
    const existing = await query(
      "SELECT * FROM votes WHERE utgid = $1 AND proposal_id = $2",
      [utgid, proposal_id]
    );

    if (existing.rows.length > 0) {
      return res.status(400).json({
        success: false,
        error: "User has already voted on this proposal",
      });
    }

    const result = await query(
      `INSERT INTO votes (utgid, proposal_id, vote_type, amount, weight)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [utgid, proposal_id, vote_type, amount || 0, weight || 0]
    );

    res.status(201).json({
      success: true,
      data: result.rows[0],
    });
  } catch (error) {
    if (error.constraint === "votes_utgid_proposal_id_key") {
      return res.status(400).json({
        success: false,
        error: "User has already voted on this proposal",
      });
    }
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Update vote (change vote)
router.put("/:vote_id", async (req, res) => {
  try {
    const { vote_id } = req.params;
    const { vote_type, amount, weight } = req.body;

    if (vote_type && !["yes", "no"].includes(vote_type)) {
      return res.status(400).json({
        success: false,
        error: 'vote_type must be either "yes" or "no"',
      });
    }

    const result = await query(
      `UPDATE votes 
       SET vote_type = COALESCE($1, vote_type),
           amount = COALESCE($2, amount),
           weight = COALESCE($3, weight)
       WHERE vote_id = $4
       RETURNING *`,
      [vote_type, amount, weight, vote_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: "Vote not found",
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
