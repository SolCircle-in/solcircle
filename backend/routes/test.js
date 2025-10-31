const express = require("express");
const router = express.Router();
const { query } = require("../db/queries");
const {
  decryptPrivateKey,
  getKeypairFromEncrypted,
} = require("../utils/wallet");
const { Connection, PublicKey, Keypair } = require("@solana/web3.js");
const {
  Raydium,
  TxVersion,
  TokenAmount,
  Token,
  DEVNET_PROGRAM_ID,
} = require("@raydium-io/raydium-sdk-v2");
const { NATIVE_MINT } = require("@solana/spl-token");

/**
 * Test trade endpoint - performs a small swap on Raydium devnet
 * POST /api/test/trade
 * Body: { tgid: "telegram_group_id" }
 */
router.post("/trade", async (req, res) => {
  try {
    const { tgid, amount, proposal_id, yes_voters } = req.body;

    if (!tgid) {
      return res.status(400).json({
        success: false,
        error: "tgid (Telegram group ID) is required",
      });
    }

    // Default to 0.01 SOL if not specified
    const tradeAmountSOL = amount || 0.01;
    const inputAmount = Math.floor(tradeAmountSOL * 1e9).toString(); // Convert to lamports

    // Get group data
    const groupResult = await query("SELECT * FROM groups WHERE tgid = $1", [
      tgid,
    ]);

    if (groupResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: "Group not found. Please register first.",
      });
    }

    const group = groupResult.rows[0];

    // Decrypt the private key
    const masterPassword = process.env.ENCRYPTION_MASTER_PASSWORD;
    if (!masterPassword) {
      return res.status(500).json({
        success: false,
        error: "Encryption master password not configured",
      });
    }

    console.log("Decrypting private key...");
    const keypair = getKeypairFromEncrypted(
      group.encrypted_key,
      masterPassword
    );

    console.log("Group wallet public key:", keypair.publicKey.toBase58());

    // Initialize Raydium SDK
    const connection = new Connection("https://api.devnet.solana.com/");
    console.log("Initializing Raydium SDK...");

    const raydium = await Raydium.load({
      owner: keypair,
      connection,
      cluster: "devnet",
      disableFeatureCheck: true,
      disableLoadToken: false,
      blockhashCommitment: "finalized",
      urlConfigs: {
        BASE_HOST: "https://api-v3-devnet.raydium.io",
        OWNER_BASE_HOST: "https://owner-v1-devnet.raydium.io",
        SWAP_HOST: "https://transaction-v1-devnet.raydium.io",
      },
    });

    // ⏳ Wait for balance to be available (funds just transferred from pool)
    console.log("⏳ Waiting for funds to arrive in relay account...");
    let balance = 0;
    let attempts = 0;
    const maxAttempts = 8; // Increased attempts

    // Estimate fees based on compute budget config (will be refined later)
    // Base fee: 0.000005 SOL per transaction
    // Compute fee: (microLamports / 1e6) * units / 1e9
    const estimatedFeesPerTx = 0.000005 + ((465915 / 1e6) * 600000 / 1e9);
    const estimatedTotalFees = estimatedFeesPerTx * 2; // Assume 2 transactions max
    const minRequiredBalance = 0.001; // Absolute minimum to execute any trade

    console.log(`📊 Estimated fees: ~${estimatedTotalFees.toFixed(6)} SOL (will be calculated precisely later)`);

    while (attempts < maxAttempts) {
      balance = await connection.getBalance(keypair.publicKey);
      const balanceSOL = balance / 1e9;

      console.log(`Attempt ${attempts + 1}/${maxAttempts}: Balance = ${balanceSOL.toFixed(6)} SOL`);

      // If we have at least the minimum balance, we can proceed
      if (balanceSOL >= minRequiredBalance) {
        console.log(`✅ Balance detected: ${balanceSOL.toFixed(6)} SOL`);

        // Warn if balance might be tight after fees
        if (balanceSOL < tradeAmountSOL + estimatedTotalFees) {
          console.log(`⚠️  Balance may not cover full trade amount + fees`);
          console.log(`   Requested: ${tradeAmountSOL} SOL + ~${estimatedTotalFees.toFixed(6)} fees`);
          console.log(`   Available: ${balanceSOL} SOL`);
          console.log(`   Will adjust trade amount if needed after calculating exact fees...`);
        }
        break;
      }

      if (attempts < maxAttempts - 1) {
        await new Promise(resolve => setTimeout(resolve, 1500)); // 1.5s between checks
      }
      attempts++;
    }

    // Check wallet balance
    const balanceSOL = balance / 1e9;
    console.log(`📍 Final wallet balance: ${balanceSOL} SOL`);

    // Check if we have at least minimum balance to proceed
    if (balanceSOL < minRequiredBalance) {
      return res.status(400).json({
        success: false,
        error: `Insufficient balance after waiting ${maxAttempts * 1.5}s. Current: ${balanceSOL.toFixed(6)} SOL, Required: ${minRequiredBalance.toFixed(6)} SOL minimum. Funds may still be pending.`,
        wallet: keypair.publicKey.toBase58(),
      });
    }

    // Note: Actual fees will be calculated after building the transaction
    // Fee adjustment logic at line ~247 will handle cases where balance < trade + fees

    // Test swap: SOL -> MALONEY token
    const SOL = NATIVE_MINT;
    const MALONEY = new PublicKey(
      "H2FqRtjfzCHTdSHZF3fSfNEJh5xvTP3dnM9415N7g9GX"
    );

    console.log(`Trading ${tradeAmountSOL} SOL for MALONEY...`);

    console.log("Fetching pool data...");
    const poolData = await raydium.tradeV2.fetchRoutePoolBasicInfo({
      amm: DEVNET_PROGRAM_ID.AMM_V4,
      clmm: DEVNET_PROGRAM_ID.CLMM_PROGRAM_ID,
      cpmm: DEVNET_PROGRAM_ID.CREATE_CPMM_POOL_PROGRAM,
    });

    console.log("Computing swap routes...");
    const routes = raydium.tradeV2.getAllRoute({
      inputMint: SOL,
      outputMint: MALONEY,
      ...poolData,
    });

    const {
      routePathDict,
      mintInfos,
      ammSimulateCache,
      computeClmmPoolInfo,
      computePoolTickData,
      computeCpmmData,
    } = await raydium.tradeV2.fetchSwapRoutesData({
      routes,
      inputMint: SOL,
      outputMint: MALONEY,
    });

    const inputMintStr = SOL.toBase58();
    const outputMintStr = MALONEY.toBase58();

    console.log("Calculating best route...");
    const swapRoutes = raydium.tradeV2.getAllRouteComputeAmountOut({
      inputTokenAmount: new TokenAmount(
        new Token({
          mint: inputMintStr,
          decimals: mintInfos[inputMintStr].decimals,
        }),
        inputAmount
      ),
      directPath: routes.directPath.map(
        (p) =>
          ammSimulateCache[p.id.toBase58()] ||
          computeClmmPoolInfo[p.id.toBase58()] ||
          computeCpmmData[p.id.toBase58()]
      ),
      routePathDict,
      simulateCache: ammSimulateCache,
      tickCache: computePoolTickData,
      mintInfos: mintInfos,
      outputToken: {
        ...mintInfos[outputMintStr],
        address: outputMintStr,
      },
      chainTime: Math.floor(Date.now() / 1000),
      slippage: 0.01, // 1% slippage
      epochInfo: await connection.getEpochInfo(),
    });

    const targetRoute = swapRoutes[0];
    if (!targetRoute) {
      return res.status(400).json({
        success: false,
        error: "No swap routes found",
      });
    }

    console.log("Best route found:", {
      input: targetRoute.amountIn.amount.toExact(),
      output: targetRoute.amountOut.amount.toExact(),
      minimumOut: targetRoute.minAmountOut.amount.toExact(),
    });

    // Fetch pool keys
    const poolKeys = await raydium.tradeV2.computePoolToPoolKeys({
      pools: targetRoute.poolInfoList,
    });

    console.log("Building swap transaction...");
    const { execute, transactions } = await raydium.tradeV2.swap({
      routeProgram: new PublicKey(
        "BVChZ3XFEwTMUk1o9i3HAf91H6mFxSwa5X2wFAWhYPhU"
      ),
      txVersion: TxVersion.V0,
      swapInfo: targetRoute,
      swapPoolKeys: poolKeys,
      ownerInfo: {
        associatedOnly: true,
        checkCreateATAOwner: true,
      },
      computeBudgetConfig: {
        units: 600000,
        microLamports: 465915,
      },
    });

    // Calculate actual fees from transaction
    let totalFees = 0;
    for (const tx of transactions) {
      // Each transaction costs 5000 lamports base fee
      const baseFee = 0.000005; // 5000 lamports = 0.000005 SOL
      // Compute budget: microLamports * units / 1,000,000 = lamports, then / 1e9 for SOL
      const computeFee = (465915 / 1e6) * 600000 / 1e9; // = 0.000279549 SOL
      totalFees += baseFee + computeFee;
    }

    console.log(`💰 Estimated transaction fees: ${totalFees.toFixed(9)} SOL`);

    // Check if we have enough balance including fees
    const totalRequired = tradeAmountSOL + totalFees;
    let adjustedTradeAmount = tradeAmountSOL;
    let feesDeductedFromTrade = false;
    
    if (balanceSOL < totalRequired) {
      // Not enough for trade + fees, so deduct fees from trade amount
      if (balanceSOL >= totalFees + 0.001) { // Must have at least fees + 0.001 SOL to trade
        adjustedTradeAmount = balanceSOL - totalFees;
        feesDeductedFromTrade = true;
        console.log(`⚠️ Insufficient balance for ${tradeAmountSOL} + fees. Adjusting trade to ${adjustedTradeAmount.toFixed(6)} SOL (fees deducted from trade amount)`);
        
        // Recalculate with adjusted amount - need to rebuild the swap
        const adjustedInputAmount = Math.floor(adjustedTradeAmount * 1e9).toString();
        
        // Recalculate routes with adjusted amount
        const adjustedSwapRoutes = raydium.tradeV2.getAllRouteComputeAmountOut({
          inputTokenAmount: new TokenAmount(
            new Token({
              mint: inputMintStr,
              decimals: mintInfos[inputMintStr].decimals,
            }),
            adjustedInputAmount
          ),
          directPath: routes.directPath.map(
            (p) =>
              ammSimulateCache[p.id.toBase58()] ||
              computeClmmPoolInfo[p.id.toBase58()] ||
              computeCpmmData[p.id.toBase58()]
          ),
          routePathDict,
          simulateCache: ammSimulateCache,
          tickCache: computePoolTickData,
          mintInfos: mintInfos,
          outputToken: {
            ...mintInfos[outputMintStr],
            address: outputMintStr,
          },
          chainTime: Math.floor(Date.now() / 1000),
          slippage: 0.01,
          epochInfo: await connection.getEpochInfo(),
        });

        const adjustedTargetRoute = adjustedSwapRoutes[0];
        if (!adjustedTargetRoute) {
          return res.status(400).json({
            success: false,
            error: "No swap routes found for adjusted amount",
          });
        }

        // Update variables to use adjusted route
        Object.assign(targetRoute, adjustedTargetRoute);
        
        // Rebuild pool keys for adjusted route
        const adjustedPoolKeys = await raydium.tradeV2.computePoolToPoolKeys({
          pools: adjustedTargetRoute.poolInfoList,
        });
        Object.assign(poolKeys, adjustedPoolKeys);
        
        // Rebuild transaction with adjusted amount
        const adjustedSwap = await raydium.tradeV2.swap({
          routeProgram: new PublicKey(
            "BVChZ3XFEwTMUk1o9i3HAf91H6mFxSwa5X2wFAWhYPhU"
          ),
          txVersion: TxVersion.V0,
          swapInfo: adjustedTargetRoute,
          swapPoolKeys: adjustedPoolKeys,
          ownerInfo: {
            associatedOnly: true,
            checkCreateATAOwner: true,
          },
          computeBudgetConfig: {
            units: 600000,
            microLamports: 465915,
          },
        });
        
        // Update execute function
        Object.assign({ execute }, adjustedSwap);
      } else {
        return res.status(400).json({
          success: false,
          error: `Insufficient balance for any trade. Required: ${totalRequired.toFixed(6)} SOL (${tradeAmountSOL} trade + ${totalFees.toFixed(6)} fees), Available: ${balanceSOL.toFixed(6)} SOL`,
          wallet: keypair.publicKey.toBase58(),
        });
      }
    }

    console.log("Executing swap...");
    const { txIds } = await execute({ sequentially: true });

    console.log("Trade successful! TX IDs:", txIds);

    // 🔥 CREATE ORDER RECORD
    const orderId = `order_${Date.now()}`;
    const tokenAmount = parseFloat(targetRoute.amountOut.amount.toExact());
    const actualTradeAmount = adjustedTradeAmount; // Use adjusted amount if fees were deducted
    const boughtAtPrice = tokenAmount > 0 ? actualTradeAmount / tokenAmount : 0; // SOL per token (excluding fees)

    await query(
      `INSERT INTO orders (
        order_id, proposal_id, transaction_hash, token_symbol,
        total_amount_spent, token_amount, fees, executed_by, status, bought_at_price
      )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [
        orderId,
        proposal_id || null,
        txIds[0], // primary tx hash
        "MALONEY",
        actualTradeAmount, // Actual trade amount (may be adjusted)
        tokenAmount,
        totalFees, // actual calculated fees
        group.owner,
        "completed",
        boughtAtPrice // price per token at purchase
      ]
    );

    console.log(`✅ Order ${orderId} recorded in database`);

    // 🔥 POPULATE user_orders table if yes_voters provided
    const userOrdersCreated = [];
    if (yes_voters && Array.isArray(yes_voters) && yes_voters.length > 0) {
      console.log(`📝 Creating user_orders for ${yes_voters.length} voters...`);
      
      for (const voter of yes_voters) {
        try {
          // Get user by username
          const userResult = await query(
            `SELECT utgid FROM users WHERE  username = $1`,
            [voter.username.replace("@", "")]
          );

          if (userResult.rows.length === 0) {
            console.warn(`⚠️ User not found: ${voter.username}`);
            continue;
          }

          const user = userResult.rows[0];
          const userShare = voter.amount / tradeAmountSOL; // Based on original voted amount
          const tokensAllocated = tokenAmount * userShare;
          const userFees = totalFees * userShare; // Proportional fee allocation

          // Insert user_order
          await query(
            `INSERT INTO user_orders (order_id, utgid, amount, fees, tokens_allocated, status)
             VALUES ($1, $2, $3, $4, $5, $6)
             ON CONFLICT (order_id, utgid) 
             DO UPDATE SET 
               amount = EXCLUDED.amount,
               fees = EXCLUDED.fees,
               tokens_allocated = EXCLUDED.tokens_allocated
             RETURNING *`,
            [
              orderId,
              user.utgid,
              voter.amount,
              userFees, // actual proportional fee
              tokensAllocated,
              "active"
            ]
          );

          userOrdersCreated.push({
            username: voter.username,
            utgid: user.utgid,
            contributed: voter.amount,
            tokens_allocated: tokensAllocated,
            share_percent: (userShare * 100).toFixed(2),
            fees: userFees,
          });

          console.log(`✅ Allocated ${tokensAllocated.toFixed(4)} tokens to ${voter.username} (fees: ${userFees.toFixed(6)} SOL)`);
        } catch (userOrderErr) {
          console.error(`❌ Failed to create user_order for ${voter.username}:`, userOrderErr.message);
        }
      }
    }

    res.json({
      success: true,
      message: feesDeductedFromTrade 
        ? "Trade executed (fees deducted from trade amount)" 
        : "Test trade executed successfully",
      data: {
        orderId,
        wallet: keypair.publicKey.toBase58(),
        balanceBefore: balanceSOL,
        trade: {
          inputToken: "SOL",
          outputToken: "MALONEY",
          requestedAmount: tradeAmountSOL.toString(),
          actualTradeAmount: actualTradeAmount.toString(),
          inputAmount: actualTradeAmount.toString(), // Actual amount traded
          outputAmount: targetRoute.amountOut.amount.toExact(),
          minimumOut: targetRoute.minAmountOut.amount.toExact(),
          totalFees: totalFees.toFixed(9),
          actualSpent: (actualTradeAmount + totalFees).toFixed(6),
          feesDeductedFromTrade,
        },
        transactions: txIds.map((txId) => ({
          txId,
          explorer: `https://explorer.solana.com/tx/${txId}?cluster=devnet`,
        })),
        userOrders: userOrdersCreated, // include allocation details
      },
    });
  } catch (error) {
    console.error("Test trade error:", error);
    res.status(500).json({
      success: false,
      error: error.message,
      stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
    });
  }
});

/**
 * Check wallet balance
 * GET /api/test/balance/:tgid
 */
router.get("/balance/:tgid", async (req, res) => {
  try {
    const { tgid } = req.params;

    const groupResult = await query("SELECT * FROM groups WHERE tgid = $1", [
      tgid,
    ]);

    if (groupResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: "Group not found",
      });
    }

    const group = groupResult.rows[0];
    const masterPassword = process.env.ENCRYPTION_MASTER_PASSWORD;

    if (!masterPassword) {
      return res.status(500).json({
        success: false,
        error: "Encryption master password not configured",
      });
    }

    const keypair = getKeypairFromEncrypted(
      group.encrypted_key,
      masterPassword
    );

    const connection = new Connection("https://api.devnet.solana.com/");
    const balance = await connection.getBalance(keypair.publicKey);
    const balanceSOL = balance / 1e9;

    res.json({
      success: true,
      data: {
        wallet: keypair.publicKey.toBase58(),
        balance: balanceSOL,
        balanceLamports: balance,
        cluster: "devnet",
        canTrade: balanceSOL >= 0.02,
      },
    });
  } catch (error) {
    console.error("Balance check error:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

module.exports = router;
