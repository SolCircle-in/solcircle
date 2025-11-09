const express = require("express");
const router = express.Router();
const { query, transaction } = require("../db/queries");

// Get all proposals
router.get("/", async (req, res) => {
  try {
    const { session_id, tgid, status } = req.query;
    let queryText = "SELECT * FROM proposals WHERE 1=1";
    const params = [];

    if (session_id) {
      params.push(session_id);
      queryText += ` AND session_id = $${params.length}`;
    }

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

// Get proposal by ID
router.get("/:proposal_id", async (req, res) => {
  try {
    const { proposal_id } = req.params;
    const result = await query(
      "SELECT * FROM proposals WHERE proposal_id = $1",
      [proposal_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: "Proposal not found",
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

// Create new proposal
router.post("/", async (req, res) => {
  try {
    const {
      proposal_id,
      session_id,
      tgid,
      created_by,
      proposal_text,
      type,
      duration,
      target_token,
      target_price,
      amount_requested,
      participants,
    } = req.body;

    if (!proposal_id || !session_id || !tgid || !created_by || !type) {
      return res.status(400).json({
        success: false,
        error:
          "proposal_id, session_id, tgid, created_by, and type are required",
      });
    }

    if (!["buy", "sell"].includes(type)) {
      return res.status(400).json({
        success: false,
        error: 'type must be either "buy" or "sell"',
      });
    }

    const result = await query(
      `INSERT INTO proposals (
        proposal_id, session_id, tgid, created_by, proposal_text, type, 
        duration, target_token, target_price, amount_requested, participants
      )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING *`,
      [
        proposal_id,
        session_id,
        tgid,
        created_by,
        proposal_text,
        type,
        duration,
        target_token,
        target_price,
        amount_requested,
        participants || [],
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


router.post("/:proposal_id/collect-funds", async (req, res) => {
  try {
    const { proposal_id } = req.params;
    const { tgid, yes_voters, pool_pda, relay_account } = req.body;

    console.log("📥 Received fund collection request:", {
      proposal_id,
      tgid,
      yes_voters,
      pool_pda,
      relay_account,
    });

    // ✅ Validate - yes_voters is an array of {username, amount}
    if (!tgid) {
      return res.status(400).json({
        success: false,
        error: "Missing required field: tgid",
      });
    }

    if (!yes_voters || !Array.isArray(yes_voters)) {
      return res.status(400).json({
        success: false,
        error: "Missing or invalid field: yes_voters (must be an array)",
      });
    }

    if (yes_voters.length === 0) {
      return res.status(400).json({
        success: false,
        error: "yes_voters array is empty",
      });
    }

    if (!pool_pda) {
      return res.status(400).json({
        success: false,
        error: "Missing required field: pool_pda",
      });
    }

    if (!relay_account) {
      return res.status(400).json({
        success: false,
        error: "Missing required field: relay_account",
      });
    }

    const {
      Connection,
      PublicKey,
      Keypair,
      Transaction,
      SystemProgram,
      LAMPORTS_PER_SOL,
      TransactionInstruction,
    } = require("@solana/web3.js");
    const { decryptPrivateKey } = require("../utils/wallet");
    const fs = require("fs");

    // Initialize Solana connection
    const connection = new Connection(
      process.env.SOLANA_RPC_URL || "https://api.devnet.solana.com",
      "confirmed"
    );

    let adminKeypair;
    if (process.env.ADMIN_KEYPAIR) {
      try {
        adminKeypair = Keypair.fromSecretKey(
          new Uint8Array(JSON.parse(process.env.ADMIN_KEYPAIR))
        );
      } catch (e) {
        console.error("Failed to parse ADMIN_KEYPAIR env var:", e.message);
        return res.status(500).json({
          success: false,
          error: "Invalid ADMIN_KEYPAIR environment variable",
        });
      }
    } else {
      try {
        const adminKeyFile = fs.readFileSync("./admin-keypair.json", "utf8");
        adminKeypair = Keypair.fromSecretKey(
          new Uint8Array(JSON.parse(adminKeyFile))
        );
      } catch (e) {
        console.error("Failed to load admin-keypair.json:", e.message);
        return res.status(500).json({
          success: false,
          error:
            "Admin keypair not configured (set ADMIN_KEYPAIR or provide admin-keypair.json)",
        });
      }
    }

    // Load program ID
    const idlFile = fs.readFileSync("./target/idl/sol_pool.json", "utf8");
    const programIdl = JSON.parse(idlFile);
    const programId = new PublicKey(programIdl.address);

    const poolPdaKey = new PublicKey(pool_pda);
    const relayAccountKey = new PublicKey(relay_account);

    let totalCollected = 0;
    let successfulTransfers = 0;
    let failedTransfers = 0;
    let totalFees = 0;
    const FEE_LAMPORTS = 0.001 * LAMPORTS_PER_SOL;

    console.log(`💰 Processing ${yes_voters.length} YES voters...`);

    // Collect from each YES voter
    for (const voterData of yes_voters) {
      const { username, amount } = voterData;

      try {
        console.log(`Processing ${username} with ${amount} SOL...`);

        // Get user from database
        
        // Get user from database
        const userResult = await query(
          'SELECT utgid, custodial_pkey, keys as encrypted_keys FROM users WHERE username = $1',
          [username.replace("@", "")]
        );

        if (userResult.rows.length === 0) {
          console.log(`❌ User not found: ${username}`);
          failedTransfers++;
          continue;
        }

        const user = userResult.rows[0];
        const custodialWallet = user.custodial_pkey;
        const encryptedKeysString = user.encrypted_keys; // raw DB value (various formats)

        console.log(`🔑 User found: ${username}, custodial wallet: ${custodialWallet}, encrypted: ${String(encryptedKeysString).slice(0,120)}`);

        // Try multiple parse/decrypt strategies, return Buffer(64) or throw
        const masterPassword = process.env.ENCRYPTION_MASTER_PASSWORD;

        const attemptDecrypt = async (candidate) => {
          try {
            const decrypted = await decryptPrivateKey(candidate, masterPassword);
            if (!decrypted) throw new Error("decrypt returned empty");
            // decrypted may be base64 or hex or raw/utf8; detect:
            // hex: 128 chars -> 64 bytes
            if (/^[0-9a-fA-F]+$/.test(decrypted) && decrypted.length === 128) {
              return Buffer.from(decrypted, "hex");
            }
            // base64 detection (contains +/ or = padding)
            if (/^[A-Za-z0-9+/]+={0,2}$/.test(decrypted)) {
              const buf = Buffer.from(decrypted, "base64");
              if (buf.length === 64) return buf;
              // sometimes decrypt returns a hex string but contains base64 chars too - fallthrough
            }
            // If decrypted already appears to be raw bytes (Buffer-like string), try base64 decode anyway
            const tryBase64 = Buffer.from(decrypted, "base64");
            if (tryBase64.length === 64) return tryBase64;
            // lastly try hex decode if length is even and reasonable
            if (decrypted.length === 128) return Buffer.from(decrypted, "hex");
            throw new Error("Unsupported decrypted key format/length");
          } catch (e) {
            throw e;
          }
        };

        let secretKeyBuffer = null;
        const candidates = [];

        // Candidate strategies:
        // 1) If value looks like JSON, parse and pull common fields
        try {
          if (typeof encryptedKeysString === "string" && encryptedKeysString.trim().startsWith("{")) {
            const parsed = JSON.parse(encryptedKeysString);
            // try common names
            if (parsed.custodial) candidates.push(parsed.custodial);
            if (parsed.custodial_key) candidates.push(parsed.custodial_key);
            if (parsed.main) candidates.push(parsed.main);
            if (parsed.private) candidates.push(parsed.private);
            if (parsed.key) candidates.push(parsed.key);
          }
        } catch (e) {
          // not JSON — ignore
        }

        // 2) If colon-separated string (existing format), push segments and combinations
        if (typeof encryptedKeysString === "string" && encryptedKeysString.includes(":")) {
          const parts = encryptedKeysString.split(":").filter(Boolean);
          // push each part (some records store custodial in first segment)
          for (const p of parts) candidates.push(p);
          // push first two/three joined (in case encrypt stored iv:cipher:text or similar)
          if (parts.length >= 2) candidates.push(parts.slice(0, 2).join(":"));
          if (parts.length >= 3) candidates.push(parts.slice(0, 3).join(":"));
          // also try the whole string
          candidates.push(encryptedKeysString);
        } else {
          // 3) otherwise try the raw field
          candidates.push(String(encryptedKeysString));
        }

        // 4) de-duplicate candidates
        const uniqCandidates = [...new Set(candidates.filter(Boolean))];

        // Try each candidate until one yields a valid 64-byte secret key
        for (const cand of uniqCandidates) {
          try {
            secretKeyBuffer = await attemptDecrypt(cand);
            if (secretKeyBuffer && secretKeyBuffer.length === 64) {
              console.log(`🔓 Successfully decrypted custodial key for ${username} (candidate length ${cand.length})`);
              break;
            }
          } catch (err) {
            // debug log at trace level, avoid spamming
            console.debug(`decrypt candidate failed for ${username}:`, err.message);
          }
        }

        if (!secretKeyBuffer) {
          console.error(`❌ Decryption failed for ${username}: no valid candidate produced a 64-byte secret key`);
          failedTransfers++;
          continue;
        }

        // Build keypair
        let voterKeypair;
        try {
          voterKeypair = Keypair.fromSecretKey(secretKeyBuffer);
        } catch (err) {
          console.error(`❌ Failed to create Keypair for ${username}:`, err.message);
          failedTransfers++;
          continue;
        }

        console.log(`✅ Keypair created for ${username}: ${voterKeypair.publicKey.toBase58()}`);

        // Verify public key matches stored custodial wallet
        if (voterKeypair.publicKey.toBase58() !== custodialWallet) {
          console.warn(`⚠️ Public key mismatch for ${username}! Expected ${custodialWallet} but derived ${voterKeypair.publicKey.toBase58()}`);
          failedTransfers++;
          continue;
        }

        // Calculate amounts
        const amountLamports = Math.floor(amount * LAMPORTS_PER_SOL);
        const totalRequired = amountLamports + FEE_LAMPORTS;

        // Check balance
        const balance = await connection.getBalance(voterKeypair.publicKey);
        if (balance < totalRequired) {
          console.log(
            `❌ Insufficient balance for ${username}: ${
              balance / LAMPORTS_PER_SOL
            } SOL (need ${totalRequired / LAMPORTS_PER_SOL})`
          );
          failedTransfers++;
          continue;
        }

        // Transfer to pool PDA
        const transferTx = new Transaction().add(
          SystemProgram.transfer({
            fromPubkey: voterKeypair.publicKey,
            toPubkey: poolPdaKey,
            lamports: amountLamports,
          })
        );

        const signature = await connection.sendTransaction(
          transferTx,
          [voterKeypair],
          { skipPreflight: false }
        );

        await connection.confirmTransaction(signature, "confirmed");

        // Record transaction
        // await query(
        //   `INSERT INTO transactions (utgid, type, amount, from_wallet, to_wallet, signature, status)
        //    VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        //   [
        //     user.utgid,
        //     "pool_deposit",
        //     amount,
        //     custodialWallet,
        //     pool_pda,
        //     signature,
        //     "confirmed",
        //   ]
        // );

        totalCollected += amount;
        totalFees += FEE_LAMPORTS / LAMPORTS_PER_SOL;
        successfulTransfers++;

        console.log(
          `✅ Collected ${amount} SOL from ${username} - Signature: ${signature}`
        );
      } catch (voterError) {
        console.error(
          `❌ Failed to collect from ${username}:`,
          voterError.message
        );
        console.error(voterError.stack);
        failedTransfers++;
      }
    }

    // Transfer from Pool PDA to Relay Account
    if (totalCollected > 0) {
      try {
        const relayAmountLamports = Math.floor(
          totalCollected * LAMPORTS_PER_SOL
        );

        console.log(
          `📤 Transferring ${totalCollected} SOL from pool to relay...`
        );

        // Create send_to_relayer instruction
        const discriminator = Buffer.from([
          153, 50, 129, 168, 107, 191, 80, 29,
        ]);
        const amountBuffer = Buffer.alloc(8);
        amountBuffer.writeBigUInt64LE(BigInt(relayAmountLamports));
        const relayerBuffer = relayAccountKey.toBuffer();
        const data = Buffer.concat([
          discriminator,
          amountBuffer,
          relayerBuffer,
        ]);

        const sendToRelayerIx = new TransactionInstruction({
          keys: [
            { pubkey: poolPdaKey, isSigner: false, isWritable: true },
            { pubkey: relayAccountKey, isSigner: false, isWritable: true },
            {
              pubkey: adminKeypair.publicKey,
              isSigner: true,
              isWritable: true,
            },
            {
              pubkey: SystemProgram.programId,
              isSigner: false,
              isWritable: false,
            },
          ],
          programId: programId,
          data: data,
        });

        const relayTx = new Transaction().add(sendToRelayerIx);
        const relaySignature = await connection.sendTransaction(
          relayTx,
          [adminKeypair],
          { skipPreflight: false }
        );

        await connection.confirmTransaction(relaySignature, "confirmed");

        console.log(
          `✅ Transferred to relay account - Signature: ${relaySignature}`
        );

        res.json({
          success: true,
          data: {
            totalCollected,
            successfulTransfers,
            failedTransfers,
            totalFees,
            poolPda: pool_pda,
            relayAccount: relay_account,
            signature: relaySignature,
          },
        });
      } catch (relayError) {
        console.error("❌ Relay transfer failed:", relayError);
        res.status(500).json({
          success: false,
          error: `Collected funds but transfer to relay failed: ${relayError.message}`,
          data: { totalCollected, successfulTransfers, failedTransfers },
        });
      }
    } else {
      res.status(400).json({
        success: false,
        error: "No funds were collected from voters",
        data: { successfulTransfers: 0, failedTransfers },
      });
    }
  } catch (error) {
    console.error("Collect funds error:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Execute trade for a proposal (non-blocking)
router.post('/:proposal_id/execute-trade', async (req, res) => {
  try {
    const { proposal_id } = req.params;
    const { pool_pda, relay_account, target_token, amount, price, price_type } = req.body;

    if (!proposal_id) {
      return res.status(400).json({ success: false, error: 'Missing proposal_id' });
    }

    if (!pool_pda || !relay_account || !target_token || !amount) {
      return res.status(400).json({ success: false, error: 'Missing required fields: pool_pda, relay_account, target_token, amount' });
    }

    // Basic validation for price: numeric or null
    if (price !== null && price !== undefined && typeof price !== 'number') {
      return res.status(400).json({ success: false, error: 'price must be numeric or null (market)' });
    }

    // Execute the trade now on devnet using Raydium SDK
    try {
      console.log(`Execute-trade starting for proposal ${proposal_id}:`, { pool_pda, relay_account, target_token, amount, price, price_type });

      const { performSwap } = require('../raydium/trade/performSwap');

      // Resolve token symbol -> mint if needed
      const SYMBOL_MAP = {
        SOL: 'So11111111111111111111111111111111111111112',
        MALONEY: 'H2FqRtjfzCHTdSHZF3fSfNEJh5xvTP3dnM9415N7g9GX',
        USDC: 'Es9vMFrzaCERQKq6sD6U2fB8dZ5b1o4xC8y3zK1j6r4',
        BONK: 'DezJX5YATbQH6Z9uVxM4Qe1fAm1xQ9z5Y4b5k4WbP6d',
      };

      const targetTokenStr = target_token && typeof target_token === 'string' ? target_token.trim() : null;
      const resolvedOutputMint = SYMBOL_MAP[targetTokenStr?.toUpperCase()] || targetTokenStr;

      const SOL_MINT = SYMBOL_MAP.SOL;

      // amount is in SOL (float). performSwap expects amountSol numeric
      const amountSol = Number(amount);
      if (Number.isNaN(amountSol) || amountSol <= 0) {
        return res.status(400).json({ success: false, error: 'Invalid amount' });
      }

      const result = await performSwap({ inputMint: SOL_MINT, outputMint: resolvedOutputMint, amountSol });

      // record last_trade_at and optionally txIds
      await query(`UPDATE proposals SET last_trade_at = NOW() WHERE proposal_id = $1`, [proposal_id]);

      return res.json({ success: true, data: { message: 'Trade executed', txIds: result.txIds } });
    } catch (execErr) {
      console.error('Execute-trade failure:', execErr);
      return res.status(500).json({ success: false, error: execErr.message });
    }
  } catch (error) {
    console.error('Execute trade route error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

router.post("/:proposal_id/execute-sell", async (req, res) => {
  try {
    const { proposal_id } = req.params;
    const { order_id, tgid } = req.body;

    console.log("📥 Received sell execution request:", {
      proposal_id,
      order_id,
      tgid,
    });

    if (!order_id || !tgid) {
      return res.status(400).json({
        success: false,
        error: "Missing required fields: order_id, tgid",
      });
    }

    const {
      Connection,
      PublicKey,
      Keypair,
      Transaction,
      SystemProgram,
      LAMPORTS_PER_SOL,
    } = require("@solana/web3.js");
    const {
      Raydium,
      TxVersion,
      DEVNET_PROGRAM_ID,
    } = require("@raydium-io/raydium-sdk-v2");
    const { Token, TokenAmount } = require("@raydium-io/raydium-sdk-v2");
    const { getKeypairFromEncrypted } = require("../utils/wallet");
    const fs = require("fs");

    // Get order details
    const orderResult = await query(
      "SELECT * FROM orders WHERE order_id = $1",
      [order_id]
    );

    if (orderResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: "Order not found",
      });
    }

    const order = orderResult.rows[0];

    // Get order participants
    const participantsResult = await query(
      `SELECT uo.*, u.username, u.custodial_pkey, u.keys as encrypted_keys
       FROM user_orders uo
       JOIN users u ON uo.utgid = u.utgid
       WHERE uo.order_id = $1 AND uo.status = 'active'`,
      [order_id]
    );

    if (participantsResult.rows.length === 0) {
      return res.status(400).json({
        success: false,
        error: "No active participants for this order",
      });
    }

    const participants = participantsResult.rows;

    // Get group relay account
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

    // Decrypt group wallet keypair
    const groupKeypair = getKeypairFromEncrypted(
      group.encrypted_key,
      masterPassword
    );

    // Initialize Solana connection and Raydium SDK
    const connection = new Connection("https://api.devnet.solana.com/");

    const raydium = await Raydium.load({
      owner: groupKeypair,
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

    // Setup tokens
    const SOL_MINT = "So11111111111111111111111111111111111111112";
    const TOKEN_MINT = new PublicKey(
      "H2FqRtjfzCHTdSHZF3fSfNEJh5xvTP3dnM9415N7g9GX" // MALONEY
    );

    console.log(
      `🔄 Selling ${order.token_amount} ${order.token_symbol} for SOL...`
    );

    // Get pool data
    const poolData = await raydium.tradeV2.fetchRoutePoolBasicInfo({
      amm: DEVNET_PROGRAM_ID.AMM_V4,
      clmm: DEVNET_PROGRAM_ID.CLMM_PROGRAM_ID,
      cpmm: DEVNET_PROGRAM_ID.CREATE_CPMM_POOL_PROGRAM,
    });

    // Compute routes for SELL (Token -> SOL)
    const routes = raydium.tradeV2.getAllRoute({
      inputMint: TOKEN_MINT,
      outputMint: new PublicKey(SOL_MINT),
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
      inputMint: TOKEN_MINT,
      outputMint: new PublicKey(SOL_MINT),
    });

    const inputTokenStr = TOKEN_MINT.toBase58();
    const outputTokenStr = SOL_MINT;
    const tokenAmountToSell = Math.floor(
      parseFloat(order.token_amount) *
        Math.pow(10, mintInfos[inputTokenStr].decimals)
    );

    // Calculate best route
    const swapRoutes = raydium.tradeV2.getAllRouteComputeAmountOut({
      inputTokenAmount: new TokenAmount(
        new Token({
          mint: inputTokenStr,
          decimals: mintInfos[inputTokenStr].decimals,
        }),
        tokenAmountToSell.toString()
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
        ...mintInfos[outputTokenStr],
        address: outputTokenStr,
      },
      chainTime: Math.floor(Date.now() / 1000),
      slippage: 0.01,
      epochInfo: await connection.getEpochInfo(),
    });

    const targetRoute = swapRoutes[0];
    if (!targetRoute) {
      return res.status(400).json({
        success: false,
        error: "No sell routes found",
      });
    }

    console.log("Best sell route found:", {
      input: targetRoute.amountIn.amount.toExact(),
      output: targetRoute.amountOut.amount.toExact(),
      minimumOut: targetRoute.minAmountOut.amount.toExact(),
    });

    // Fetch pool keys
    const poolKeys = await raydium.tradeV2.computePoolToPoolKeys({
      pools: targetRoute.poolInfoList,
    });

    // Build swap transaction
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

    // Calculate fees
    let totalFees = 0;
    for (const tx of transactions) {
      const baseFee = 0.000005;
      const computeFee = ((465915 / 1e6) * 600000) / 1e9;
      totalFees += baseFee + computeFee;
    }

    console.log(`💰 Estimated sell fees: ${totalFees.toFixed(9)} SOL`);

    // Execute sell
    const { txIds } = await execute({ sequentially: true });
    console.log("Sell successful! TX IDs:", txIds);

    const solReceived = parseFloat(targetRoute.amountOut.amount.toExact());
    const netProceeds = solReceived - totalFees;

    // Calculate sold_at_price (SOL per token)
    const soldAtPrice = solReceived / parseFloat(order.token_amount);

    // Update order status with sold_at_price, sold_at, and sell_fees
    await query(
      `UPDATE orders
       SET status = 'sold',
           closed_at = NOW(),
           sold_at = NOW(),
           sold_at_price = $2,
           sell_fees = $3
       WHERE order_id = $1`,
      [order_id, soldAtPrice, totalFees]
    );

    // Distribute SOL to participants
    const distributions = [];

    for (const participant of participants) {
      try {
        const userShare =
          parseFloat(participant.tokens_allocated) /
          parseFloat(order.token_amount);
        const userProceeds = netProceeds * userShare;
        const userFees = totalFees * userShare;

        // Transfer SOL to user's custodial wallet
        const transferTx = new Transaction().add(
          SystemProgram.transfer({
            fromPubkey: groupKeypair.publicKey,
            toPubkey: new PublicKey(participant.custodial_pkey),
            lamports: Math.floor(userProceeds * LAMPORTS_PER_SOL),
          })
        );

        const signature = await connection.sendTransaction(
          transferTx,
          [groupKeypair],
          { skipPreflight: false }
        );

        await connection.confirmTransaction(signature, "confirmed");

        // Calculate P&L
        const totalCost =
          parseFloat(participant.amount) + parseFloat(participant.fees);
        const profitLoss = userProceeds - totalCost;

        // Update user_order with P&L
        await query(
          `UPDATE user_orders
           SET status = 'sold',
               profit_loss = $1,
               sold_at = NOW()
           WHERE order_id = $2 AND utgid = $3`,
          [profitLoss, order_id, participant.utgid]
        );

        // Update user's total_pnl
        const userPnlResult = await query(
          `SELECT COALESCE(SUM(profit_loss), 0) as total_pnl
           FROM user_orders
           WHERE utgid = $1`,
          [participant.utgid]
        );

        await query(
          `UPDATE users
           SET total_pnl = $1
           WHERE utgid = $2`,
          [userPnlResult.rows[0].total_pnl, participant.utgid]
        );

        distributions.push({
          username: participant.username,
          tokensAllocated: parseFloat(participant.tokens_allocated),
          solReceived: userProceeds,
          fees: userFees,
          profitLoss: profitLoss,
          signature: signature,
        });

        console.log(
          `✅ Distributed ${userProceeds.toFixed(4)} SOL to ${
            participant.username
          } (P&L: ${profitLoss >= 0 ? "+" : ""}${profitLoss.toFixed(4)} SOL)`
        );
      } catch (distError) {
        console.error(
          `❌ Failed to distribute to ${participant.username}:`,
          distError.message
        );
      }
    }

    // Update group's total_pnl after all distributions
    const groupPnlResult = await query(
      `SELECT COALESCE(SUM(
        (o.sold_at_price - o.bought_at_price) * o.token_amount - o.fees - COALESCE(o.sell_fees, 0)
      ), 0) as total_pnl
       FROM orders o
       JOIN proposals p ON o.proposal_id = p.proposal_id
       WHERE p.tgid = $1 AND o.sold_at_price IS NOT NULL`,
      [tgid]
    );

    await query(
      `UPDATE groups
       SET total_pnl = $1
       WHERE tgid = $2`,
      [groupPnlResult.rows[0].total_pnl, tgid]
    );

    console.log(`✅ Updated group ${tgid} total P&L: ${groupPnlResult.rows[0].total_pnl} SOL`);

    res.json({
      success: true,
      data: {
        tokensSold: parseFloat(order.token_amount),
        solReceived: solReceived,
        fees: totalFees,
        netProceeds: netProceeds,
        distributions: distributions,
        txSignature: txIds[0],
      },
    });
  } catch (error) {
    console.error("Execute sell error:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});



// Update proposal
router.put("/:proposal_id", async (req, res) => {
  try {
    const { proposal_id } = req.params;
    const { status, ended_at, participants } = req.body;

    const result = await query(
      `UPDATE proposals 
       SET status = COALESCE($1, status),
           ended_at = COALESCE($2, ended_at),
           participants = COALESCE($3, participants)
       WHERE proposal_id = $4
       RETURNING *`,
      [status, ended_at, participants, proposal_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: "Proposal not found",
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

// Get proposal votes
router.get("/:proposal_id/votes", async (req, res) => {
  try {
    const { proposal_id } = req.params;
    const result = await query(
      `SELECT v.*, u.custodial_pkey, u.main_pkey
       FROM votes v
       JOIN users u ON v.utgid = u.utgid
       WHERE v.proposal_id = $1
       ORDER BY v.created_at DESC`,
      [proposal_id]
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

// Get proposal results
router.get("/:proposal_id/results", async (req, res) => {
  try {
    const { proposal_id } = req.params;
    const result = await query(
      `SELECT 
        vote_type,
        COUNT(*) as vote_count,
        SUM(amount) as total_amount,
        SUM(weight) as total_weight
       FROM votes
       WHERE proposal_id = $1
       GROUP BY vote_type`,
      [proposal_id]
    );

    const yesVotes = result.rows.find((r) => r.vote_type === "yes") || {
      vote_count: 0,
      total_amount: 0,
      total_weight: 0,
    };
    const noVotes = result.rows.find((r) => r.vote_type === "no") || {
      vote_count: 0,
      total_amount: 0,
      total_weight: 0,
    };

    res.json({
      success: true,
      data: {
        proposal_id,
        yes: {
          count: parseInt(yesVotes.vote_count),
          amount: parseFloat(yesVotes.total_amount),
          weight: parseFloat(yesVotes.total_weight),
        },
        no: {
          count: parseInt(noVotes.vote_count),
          amount: parseFloat(noVotes.total_amount),
          weight: parseFloat(noVotes.total_weight),
        },
        total_votes:
          parseInt(yesVotes.vote_count) + parseInt(noVotes.vote_count),
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});


// Get proposals a user participated in (via votes)
router.get("/participated/:utgid", async (req, res) => {
  try {
    const { utgid } = req.params;
    const result = await query(
      `SELECT p.*
         FROM proposals p
         JOIN votes v ON p.proposal_id = v.proposal_id
        WHERE v.utgid = $1
        ORDER BY p.created_at DESC`,
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
module.exports = router;
