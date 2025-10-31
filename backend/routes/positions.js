const express = require("express");
const router = express.Router();
const { Connection, PublicKey } = require("@solana/web3.js");
const { query } = require("../db/queries");
const axios = require("axios");

const connection = new Connection(process.env.SOLANA_RPC_URL || "https://api.devnet.solana.com");

/**
 * UNIFIED POSITIONS DASHBOARD
 * GET /api/positions/:identifier
 * 
 * Combines:
 * - SolCircle custodial wallet balance (devnet)
 * - SolCircle group pool positions (devnet)  
 * - Zerion mainnet DeFi positions (optional)
 * - Zerion mainnet token balances (optional)
 */
router.get("/:identifier", async (req, res) => {
  try {
    const { identifier } = req.params;
    
    // Get user from database
    const result = await query(
      "SELECT * FROM users WHERE utgid = $1 OR username = $1",
      [identifier]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: "User not found",
      });
    }
    
    const user = result.rows[0];
    
    // ========================================
    // 1. SOLCIRCLE PLATFORM BALANCES (Devnet)
    // ========================================
    const [custodialBalance, mainDevnetBalance] = await Promise.all([
      connection.getBalance(new PublicKey(user.custodial_pkey)),
      connection.getBalance(new PublicKey(user.main_pkey)),
    ]);
    
    const platformData = {
      network: "devnet",
      custodial_wallet: {
        address: user.custodial_pkey,
        balance_sol: (custodialBalance / 1e9).toFixed(4),
        balance_lamports: custodialBalance,
      },
      main_wallet: {
        address: user.main_pkey,
        balance_sol: (mainDevnetBalance / 1e9).toFixed(4),
        balance_lamports: mainDevnetBalance,
      },
      total_platform_sol: ((custodialBalance + mainDevnetBalance) / 1e9).toFixed(4),
    };
    
    // ========================================
    // 2. SOLCIRCLE GROUP POOL POSITIONS
    // ========================================
    const poolPositions = await query(
      `SELECT 
        p.id,
        p.tgid,
        g.relay_account as group_wallet,
        p.role,
        p.joined_at
      FROM participants p
      JOIN groups g ON p.tgid = g.tgid
      WHERE p.utgid = $1 AND p.left_at IS NULL`,
      [user.utgid]
    );
    
    // Get actual pool balance for each group
    const poolData = await Promise.all(poolPositions.rows.map(async (pool) => {
      // Get group's wallet balance
      const groupPubkey = new PublicKey(pool.group_wallet);
      let poolBalance = 0;
      
      try {
        const balanceLamports = await connection.getBalance(groupPubkey);
        poolBalance = balanceLamports / 1e9;
      } catch (err) {
        console.error(`Error fetching balance for group ${pool.tgid}:`, err.message);
      }
      
      return {
        group_id: pool.tgid,
        group_wallet: pool.group_wallet,
        role: pool.role,
        pool_balance_sol: poolBalance.toFixed(4),
        joined_at: pool.joined_at,
      };
    }));
    
    // ========================================
    // 3. MAINNET DEFI POSITIONS (via Zerion)
    // ========================================
    let mainnetDeFi = {
      available: false,
      positions: null,
      error: null,
    };
    
    if (process.env.ZERION_API_KEY) {
      try {
        const defiResponse = await axios.get(
          `http://localhost:${process.env.PORT || 8000}/api/zerion/defi-positions/${identifier}`,
          { timeout: 5000 }
        );
        
        if (defiResponse.data.success) {
          mainnetDeFi = {
            available: true,
            positions: defiResponse.data.data,
            error: null,
          };
        }
      } catch (error) {
        console.log("Mainnet DeFi data unavailable:", error.message);
        mainnetDeFi.error = "DeFi data unavailable";
      }
    }
    
    // ========================================
    // 4. MAINNET TOKEN BALANCES (via Zerion)
    // ========================================
    let mainnetTokens = {
      available: false,
      total_value_usd: 0,
      tokens: [],
      error: null,
    };
    
    if (process.env.ZERION_API_KEY) {
      try {
        const tokensResponse = await axios.get(
          `http://localhost:${process.env.PORT || 8000}/api/zerion/tokens/${identifier}`,
          { timeout: 5000 }
        );
        
        if (tokensResponse.data.success) {
          mainnetTokens = {
            available: true,
            total_value_usd: tokensResponse.data.data.total_value_usd,
            tokens: tokensResponse.data.data.tokens,
            error: null,
          };
        }
      } catch (error) {
        console.log("Mainnet tokens data unavailable:", error.message);
        mainnetTokens.error = "Token data unavailable";
      }
    }
    
    // ========================================
    // 5. CALCULATE TOTALS & INSIGHTS
    // ========================================
    const platformTotalSol = parseFloat(platformData.total_platform_sol);
    const poolTotalSol = poolData.reduce((sum, pool) => sum + parseFloat(pool.pool_balance_sol), 0);
    const mainnetTokensUsd = parseFloat(mainnetTokens.total_value_usd);
    const mainnetDeFiUsd = mainnetDeFi.available ? 
      parseFloat(mainnetDeFi.positions.summary.total_value_locked_usd) : 0;
    
    const insights = {
      platform_has_balance: platformTotalSol > 0,
      has_pool_positions: poolData.length > 0,
      has_mainnet_tokens: mainnetTokensUsd > 0,
      has_defi_positions: mainnetDeFiUsd > 0,
      total_groups: poolData.length,
      
      suggestions: [],
    };
    
    // Generate smart suggestions
    if (platformTotalSol < 0.1) {
      insights.suggestions.push({
        type: "deposit",
        priority: "high",
        message: "Your platform balance is low. Deposit SOL to participate in group pools.",
      });
    }
    
    if (mainnetDeFiUsd > 1000 && poolData.length === 0) {
      insights.suggestions.push({
        type: "opportunity",
        priority: "medium",
        message: `You have $${mainnetDeFiUsd.toFixed(2)} in DeFi but no SolCircle pools. Try our collaborative trading!`,
      });
    }
    
    if (mainnetTokensUsd > 100 && platformTotalSol < 1) {
      insights.suggestions.push({
        type: "bridge",
        priority: "medium",
        message: `You have $${mainnetTokensUsd.toFixed(2)} on mainnet. Consider transferring some to the platform.`,
      });
    }
    
    if (mainnetDeFi.available && mainnetDeFi.positions.summary.avg_apy) {
      const avgApy = mainnetDeFi.positions.summary.avg_apy;
      insights.suggestions.push({
        type: "info",
        priority: "low",
        message: `Your DeFi positions are earning ${avgApy} average APY!`,
      });
    }
    
    // ========================================
    // 6. BUILD RESPONSE
    // ========================================
    res.json({
      success: true,
      data: {
        user: {
          utgid: user.utgid,
          username: user.username,
        },
        
        // Platform balances (Devnet)
        platform: platformData,
        
        // SolCircle group pools
        pools: {
          total_pool_balance_sol: poolTotalSol.toFixed(4),
          positions_count: poolData.length,
          positions: poolData,
        },
        
        // Mainnet token balances (Zerion)
        mainnet_tokens: mainnetTokens,
        
        // Mainnet DeFi positions (Zerion)
        mainnet_defi: mainnetDeFi,
        
        // Insights and suggestions
        insights: insights,
        
        // Grand totals
        summary: {
          platform_sol: platformTotalSol.toFixed(4),
          pool_positions_sol: poolTotalSol.toFixed(4),
          mainnet_tokens_usd: mainnetTokensUsd.toFixed(2),
          mainnet_defi_usd: mainnetDeFiUsd.toFixed(2),
          total_mainnet_usd: (mainnetTokensUsd + mainnetDeFiUsd).toFixed(2),
        },
      },
    });
  } catch (error) {
    console.error("Unified positions error:", error.message);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * SOLCIRCLE POOL POSITIONS ONLY
 * GET /api/positions/:identifier/pools
 */
router.get("/:identifier/pools", async (req, res) => {
  try {
    const { identifier } = req.params;
    
    const result = await query(
      "SELECT utgid, username FROM users WHERE utgid = $1 OR username = $1",
      [identifier]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: "User not found",
      });
    }
    
    const user = result.rows[0];
    
    // Get all pool positions with group details
    const poolPositions = await query(
      `SELECT 
        p.id,
        p.tgid,
        g.relay_account as group_wallet,
        p.role,
        p.joined_at,
        (SELECT COUNT(*) FROM participants WHERE tgid = p.tgid AND left_at IS NULL) as member_count
      FROM participants p
      JOIN groups g ON p.tgid = g.tgid
      WHERE p.utgid = $1 AND p.left_at IS NULL
      ORDER BY p.joined_at DESC`,
      [user.utgid]
    );
    
    const positions = await Promise.all(poolPositions.rows.map(async (pool) => {
      // Get actual group wallet balance
      const groupPubkey = new PublicKey(pool.group_wallet);
      let poolBalance = 0;
      
      try {
        const balanceLamports = await connection.getBalance(groupPubkey);
        poolBalance = balanceLamports / 1e9;
      } catch (err) {
        console.error(`Error fetching balance for group ${pool.tgid}:`, err.message);
      }
      
      return {
        group_id: pool.tgid,
        group_wallet: pool.group_wallet,
        role: pool.role,
        pool_balance_sol: poolBalance.toFixed(4),
        member_count: parseInt(pool.member_count),
        joined_at: pool.joined_at,
      };
    }));
    
    const totalPoolBalance = positions.reduce(
      (sum, pos) => sum + parseFloat(pos.pool_balance_sol), 0
    );
    
    res.json({
      success: true,
      data: {
        user: {
          utgid: user.utgid,
          username: user.username,
        },
        summary: {
          total_pool_balance_sol: totalPoolBalance.toFixed(4),
          total_pools: positions.length,
        },
        positions: positions,
      },
    });
  } catch (error) {
    console.error("Pool positions error:", error.message);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * COMPARE PLATFORM vs MAINNET
 * GET /api/positions/:identifier/comparison
 */
router.get("/:identifier/comparison", async (req, res) => {
  try {
    const { identifier } = req.params;
    
    // Get unified positions
    const positionsResponse = await axios.get(
      `http://localhost:${process.env.PORT || 8000}/api/positions/${identifier}`
    );
    
    if (!positionsResponse.data.success) {
      return res.status(404).json({
        success: false,
        error: "Could not fetch positions",
      });
    }
    
    const data = positionsResponse.data.data;
    
    const comparison = {
      platform_devnet: {
        type: "Testing & Trading Platform",
        balance_sol: data.platform.total_platform_sol,
        pool_positions: data.pools.positions_count,
        network: "Solana Devnet",
        use_case: "Group pooling, collaborative trading, bot trading",
      },
      mainnet: {
        type: "Personal Portfolio",
        tokens_usd: data.mainnet_tokens.total_value_usd,
        defi_positions_usd: data.mainnet_defi.available ? 
          data.mainnet_defi.positions.summary.total_value_locked_usd : "0.00",
        total_usd: data.summary.total_mainnet_usd,
        network: "Multi-chain (40+ networks)",
        use_case: "Long-term holdings, DeFi yield, NFTs",
      },
      recommendations: [],
    };
    
    // Generate recommendations
    const platformSol = parseFloat(data.platform.total_platform_sol);
    const mainnetUsd = parseFloat(data.summary.total_mainnet_usd);
    
    if (platformSol < 0.5 && mainnetUsd > 100) {
      comparison.recommendations.push({
        action: "Transfer SOL to platform",
        reason: "You have assets on mainnet but low platform balance",
        benefit: "Enable trading and pool participation",
      });
    }
    
    if (data.pools.positions_count === 0 && platformSol > 1) {
      comparison.recommendations.push({
        action: "Join a group pool",
        reason: "You have platform balance but no pool positions",
        benefit: "Collaborate with others and share trading strategies",
      });
    }
    
    if (mainnetUsd === 0 && platformSol > 0) {
      comparison.recommendations.push({
        action: "Consider mainnet for long-term holdings",
        reason: "You're only on devnet (testing)",
        benefit: "Earn real yields with DeFi protocols",
      });
    }
    
    res.json({
      success: true,
      data: comparison,
    });
  } catch (error) {
    console.error("Comparison error:", error.message);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

module.exports = router;
