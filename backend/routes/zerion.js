const express = require("express");
const router = express.Router();
const axios = require("axios");
const { query } = require("../db/queries");

const ZERION_API_KEY = process.env.ZERION_API_KEY || "";
const ZERION_BASE_URL = "https://api.zerion.io/v1";

/**
 * Helper function for Zerion API calls
 */
async function zerionRequest(endpoint, params = {}) {
  if (!ZERION_API_KEY) {
    throw new Error("Zerion API key not configured. Please add ZERION_API_KEY to your .env file");
  }
  
  const auth = Buffer.from(`${ZERION_API_KEY}:`).toString("base64");
  
  try {
    const response = await axios.get(`${ZERION_BASE_URL}${endpoint}`, {
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/json",
      },
      params,
      timeout: 10000,
    });
    
    return response.data;
  } catch (error) {
    if (error.response) {
      throw new Error(`Zerion API Error: ${error.response.status} - ${error.response.data?.errors?.[0]?.title || error.message}`);
    }
    throw new Error(`Zerion Request Error: ${error.message}`);
  }
}

/**
 * Health check for Zerion integration
 * GET /api/zerion/health
 */
router.get("/health", async (req, res) => {
  try {
    if (!ZERION_API_KEY) {
      return res.status(503).json({
        success: false,
        configured: false,
        message: "Zerion API key not configured",
      });
    }
    
    // Test API connection with chains endpoint
    await zerionRequest("/chains/", { "page[size]": 1 });
    
    res.json({
      success: true,
      configured: true,
      message: "Zerion integration is healthy",
      api_url: ZERION_BASE_URL,
    });
  } catch (error) {
    res.status(503).json({
      success: false,
      configured: true,
      message: "Zerion API connection failed",
      error: error.message,
    });
  }
});

/**
 * Supported Chains List
 * GET /api/zerion/chains
 */
router.get("/chains", async (req, res) => {
  try {
    const response = await zerionRequest("/chains/");
    
    const chains = [];
    if (response.data && Array.isArray(response.data)) {
      for (const chain of response.data) {
        const attrs = chain.attributes || {};
        chains.push({
          id: chain.id,
          name: attrs.name,
          is_testnet: attrs.flags?.is_testnet || false,
          icon: attrs.icon?.url || null,
          explorer_url: attrs.external_explorer_url || null,
        });
      }
    }
    
    res.json({
      success: true,
      data: {
        total_chains: chains.length,
        chains: chains,
      },
    });
  } catch (error) {
    console.error("Zerion chains error:", error.message);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * FEATURE 1: Multi-Chain Token Balances with Real-time USD Valuations
 * GET /api/zerion/tokens/:identifier
 * Query params:
 *   - chain: Filter by specific chain (ethereum, polygon, solana, etc.)
 *   - minValue: Minimum USD value to include (default: 0.01)
 */
router.get("/tokens/:identifier", async (req, res) => {
  try {
    const { identifier } = req.params;
    const { chain, minValue = 0.01 } = req.query;
    
    // Get user's main wallet address
    const result = await query(
      "SELECT main_pkey, username FROM users WHERE utgid = $1 OR username = $1",
      [identifier]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: "User not found",
      });
    }
    
    const user = result.rows[0];
    const walletAddress = user.main_pkey;
    
    // Build Zerion API params
    const params = {
      currency: "usd",
      "filter[positions]": "only_simple",
      "filter[trash]": "only_non_trash",
    };
    
    if (chain) {
      params["filter[chain_ids]"] = chain;
    }
    
    const response = await zerionRequest(
      `/wallets/${walletAddress}/positions/`,
      params
    );
    
    // Process and format token data
    const tokens = [];
    let totalValue = 0;
    
    if (response.data && Array.isArray(response.data)) {
      for (const position of response.data) {
        const attrs = position.attributes || {};
        const fungibleInfo = attrs.fungible_info || {};
        const quantity = attrs.quantity?.float || 0;
        const value = parseFloat(attrs.value || 0);
        const price = parseFloat(attrs.price || 0);
        
        // Filter by minimum value
        if (value < parseFloat(minValue)) continue;
        
        const token = {
          symbol: fungibleInfo.symbol || "UNKNOWN",
          name: fungibleInfo.name || "Unknown Token",
          quantity: quantity,
          value_usd: value.toFixed(2),
          price_usd: price.toFixed(6),
          chain: position.relationships?.chain?.data?.id || "unknown",
          logo: fungibleInfo.icon?.url || null,
          address: fungibleInfo.implementations?.[0]?.address || null,
          decimals: fungibleInfo.implementations?.[0]?.decimals || null,
          change_24h: attrs.changes?.percent_1d || null,
        };
        
        tokens.push(token);
        totalValue += value;
      }
    }
    
    // Sort tokens by value (highest first)
    tokens.sort((a, b) => parseFloat(b.value_usd) - parseFloat(a.value_usd));
    
    res.json({
      success: true,
      data: {
        user: {
          username: user.username,
          wallet: walletAddress,
        },
        chain_filter: chain || "all",
        total_value_usd: totalValue.toFixed(2),
        token_count: tokens.length,
        tokens: tokens,
      },
    });
  } catch (error) {
    console.error("Zerion tokens error:", error.message);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * FEATURE 2: Complete Portfolio with Total Value
 * GET /api/zerion/portfolio/:identifier
 */
router.get("/portfolio/:identifier", async (req, res) => {
  try {
    const { identifier } = req.params;
    
    const result = await query(
      "SELECT main_pkey, username FROM users WHERE utgid = $1 OR username = $1",
      [identifier]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: "User not found",
      });
    }
    
    const user = result.rows[0];
    const walletAddress = user.main_pkey;
    
    const portfolio = await zerionRequest(
      `/wallets/${walletAddress}/positions/`,
      {
        currency: "usd",
        "filter[positions]": "only_simple",
        "filter[trash]": "only_non_trash",
      }
    );
    
    // Calculate totals and group by chain
    let totalValue = 0;
    const assetsByChain = {};
    const topAssets = [];
    
    if (portfolio.data && Array.isArray(portfolio.data)) {
      for (const position of portfolio.data) {
        const attrs = position.attributes || {};
        const value = parseFloat(attrs.value || 0);
        const fungibleInfo = attrs.fungible_info || {};
        
        totalValue += value;
        
        // Group by chain
        const chain = position.relationships?.chain?.data?.id || "unknown";
        if (!assetsByChain[chain]) {
          assetsByChain[chain] = {
            count: 0,
            value: 0,
            name: chain,
          };
        }
        assetsByChain[chain].count++;
        assetsByChain[chain].value += value;
        
        // Collect top assets
        if (value > 0.01) {
          topAssets.push({
            symbol: fungibleInfo.symbol,
            name: fungibleInfo.name,
            value: value,
            logo: fungibleInfo.icon?.url,
          });
        }
      }
    }
    
    // Sort top assets
    topAssets.sort((a, b) => b.value - a.value);
    const top10Assets = topAssets.slice(0, 10);
    
    res.json({
      success: true,
      data: {
        user: {
          username: user.username,
          wallet: walletAddress,
        },
        total_value_usd: totalValue.toFixed(2),
        total_positions: portfolio.data?.length || 0,
        chains: Object.values(assetsByChain).map(chain => ({
          ...chain,
          value: chain.value.toFixed(2),
          percentage: ((chain.value / totalValue) * 100).toFixed(2),
        })),
        top_assets: top10Assets.map(asset => ({
          ...asset,
          value: asset.value.toFixed(2),
          percentage: ((asset.value / totalValue) * 100).toFixed(2),
        })),
      },
    });
  } catch (error) {
    console.error("Zerion portfolio error:", error.message);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * FEATURE 3: NFT Collections Across All Chains
 * GET /api/zerion/nfts/:identifier
 */
router.get("/nfts/:identifier", async (req, res) => {
  try {
    const { identifier } = req.params;
    const { chain, limit = 50 } = req.query;
    
    const result = await query(
      "SELECT main_pkey, username FROM users WHERE utgid = $1 OR username = $1",
      [identifier]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: "User not found",
      });
    }
    
    const user = result.rows[0];
    const walletAddress = user.main_pkey;
    
    const params = {
      currency: "usd",
      "filter[trash]": "only_non_trash",
      "page[size]": parseInt(limit),
    };
    
    if (chain) {
      params["filter[chain_ids]"] = chain;
    }
    
    const response = await zerionRequest(
      `/wallets/${walletAddress}/nft-positions/`,
      params
    );
    
    // Process NFT data
    const nfts = [];
    const collections = {};
    let totalFloorValue = 0;
    
    if (response.data && Array.isArray(response.data)) {
      for (const nft of response.data) {
        const attrs = nft.attributes || {};
        const nftInfo = attrs.nft_info || {};
        const collectionInfo = attrs.collection_info || {};
        const floorPrice = parseFloat(attrs.floor_price || 0);
        
        totalFloorValue += floorPrice;
        
        const collectionName = collectionInfo.name || "Unknown Collection";
        if (!collections[collectionName]) {
          collections[collectionName] = {
            name: collectionName,
            count: 0,
            floor_value: 0,
            chain: nft.relationships?.chain?.data?.id,
          };
        }
        collections[collectionName].count++;
        collections[collectionName].floor_value += floorPrice;
        
        nfts.push({
          name: nftInfo.name || "Unnamed NFT",
          collection: collectionName,
          description: nftInfo.description || null,
          image: nftInfo.content?.preview?.url || nftInfo.content?.detail?.url || null,
          floor_price_usd: floorPrice > 0 ? floorPrice.toFixed(2) : null,
          chain: nft.relationships?.chain?.data?.id || "unknown",
          token_id: nftInfo.interface?.id || null,
          contract_address: nftInfo.contract?.address || null,
        });
      }
    }
    
    res.json({
      success: true,
      data: {
        user: {
          username: user.username,
          wallet: walletAddress,
        },
        total_nfts: nfts.length,
        total_collections: Object.keys(collections).length,
        total_floor_value_usd: totalFloorValue.toFixed(2),
        collections: Object.values(collections).map(c => ({
          ...c,
          floor_value: c.floor_value.toFixed(2),
        })),
        nfts: nfts,
      },
    });
  } catch (error) {
    console.error("Zerion NFTs error:", error.message);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * FEATURE 4: Asset Allocation Breakdown
 * GET /api/zerion/allocation/:identifier
 */
router.get("/allocation/:identifier", async (req, res) => {
  try {
    const { identifier } = req.params;
    
    const result = await query(
      "SELECT main_pkey, username FROM users WHERE utgid = $1 OR username = $1",
      [identifier]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: "User not found",
      });
    }
    
    const user = result.rows[0];
    const walletAddress = user.main_pkey;
    
    const portfolio = await zerionRequest(
      `/wallets/${walletAddress}/positions/`,
      {
        currency: "usd",
        "filter[positions]": "only_simple",
        "filter[trash]": "only_non_trash",
      }
    );
    
    let totalValue = 0;
    const allocations = [];
    const chainAllocations = {};
    
    if (portfolio.data && Array.isArray(portfolio.data)) {
      for (const position of portfolio.data) {
        const attrs = position.attributes || {};
        const fungibleInfo = attrs.fungible_info || {};
        const value = parseFloat(attrs.value || 0);
        
        totalValue += value;
        
        // Asset allocation
        allocations.push({
          symbol: fungibleInfo.symbol || "UNKNOWN",
          name: fungibleInfo.name || "Unknown",
          value: value,
          logo: fungibleInfo.icon?.url,
          chain: position.relationships?.chain?.data?.id,
        });
        
        // Chain allocation
        const chain = position.relationships?.chain?.data?.id || "unknown";
        if (!chainAllocations[chain]) {
          chainAllocations[chain] = { name: chain, value: 0 };
        }
        chainAllocations[chain].value += value;
      }
    }
    
    // Calculate percentages
    const assetAllocation = allocations
      .map(asset => ({
        ...asset,
        value: asset.value.toFixed(2),
        percentage: totalValue > 0 ? ((asset.value / totalValue) * 100).toFixed(2) : "0.00",
      }))
      .sort((a, b) => parseFloat(b.value) - parseFloat(a.value));
    
    const chainAllocation = Object.values(chainAllocations)
      .map(chain => ({
        chain: chain.name,
        value: chain.value.toFixed(2),
        percentage: totalValue > 0 ? ((chain.value / totalValue) * 100).toFixed(2) : "0.00",
      }))
      .sort((a, b) => parseFloat(b.value) - parseFloat(a.value));
    
    res.json({
      success: true,
      data: {
        user: {
          username: user.username,
          wallet: walletAddress,
        },
        total_value_usd: totalValue.toFixed(2),
        allocation_by_asset: assetAllocation,
        allocation_by_chain: chainAllocation,
      },
    });
  } catch (error) {
    console.error("Zerion allocation error:", error.message);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * FEATURE 5: Token Metadata (with logos)
 * GET /api/zerion/token-info/:tokenAddress
 * Query params:
 *   - chain: Chain ID (ethereum, polygon, etc.)
 */
router.get("/token-info/:tokenAddress", async (req, res) => {
  try {
    const { tokenAddress } = req.params;
    const { chain = "ethereum" } = req.query;
    
    // Note: Zerion's fungibles endpoint provides token metadata
    const response = await zerionRequest(
      `/fungibles/${tokenAddress}`,
      {
        "filter[chain_ids]": chain,
      }
    );
    
    if (!response.data) {
      return res.status(404).json({
        success: false,
        error: "Token not found",
      });
    }
    
    const data = response.data;
    const attrs = data.attributes || {};
    
    res.json({
      success: true,
      data: {
        address: tokenAddress,
        chain: chain,
        symbol: attrs.symbol || "UNKNOWN",
        name: attrs.name || "Unknown Token",
        decimals: attrs.implementations?.[0]?.decimals || null,
        logo: attrs.icon?.url || null,
        description: attrs.description || null,
        market_cap_usd: attrs.market_cap || null,
        total_supply: attrs.total_supply || null,
        circulating_supply: attrs.circulating_supply || null,
        price_usd: attrs.market_data?.price || null,
        change_24h: attrs.market_data?.changes_percentage?.day || null,
      },
    });
  } catch (error) {
    console.error("Zerion token info error:", error.message);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * DEFI FEATURE 1: Staking Positions
 * GET /api/zerion/staking/:identifier
 */
router.get("/staking/:identifier", async (req, res) => {
  try {
    const { identifier } = req.params;
    const { chain } = req.query;
    
    const result = await query(
      "SELECT main_pkey, username FROM users WHERE utgid = $1 OR username = $1",
      [identifier]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: "User not found",
      });
    }
    
    const user = result.rows[0];
    const walletAddress = user.main_pkey;
    
    const params = {
      currency: "usd",
      "filter[position_types]": "staked",
      "filter[trash]": "only_non_trash",
    };
    
    if (chain) {
      params["filter[chain_ids]"] = chain;
    }
    
    const response = await zerionRequest(
      `/wallets/${walletAddress}/positions/`,
      params
    );
    
    const stakingPositions = [];
    let totalStaked = 0;
    let totalRewards = 0;
    
    if (response.data && Array.isArray(response.data)) {
      for (const position of response.data) {
        const attrs = position.attributes || {};
        const fungibleInfo = attrs.fungible_info || {};
        const value = parseFloat(attrs.value || 0);
        const apy = parseFloat(attrs.yield_percentage || 0);
        const quantity = parseFloat(attrs.quantity?.float || 0);
        
        totalStaked += value;
        totalRewards += (value * apy) / 100;
        
        stakingPositions.push({
          protocol: attrs.protocol || "Unknown",
          chain: position.relationships?.chain?.data?.id || "unknown",
          asset: {
            symbol: fungibleInfo.symbol || "UNKNOWN",
            name: fungibleInfo.name || "Unknown",
            logo: fungibleInfo.icon?.url,
            quantity: quantity,
            value_usd: value.toFixed(2),
          },
          apy: apy > 0 ? apy.toFixed(2) + "%" : "N/A",
          annual_rewards_usd: ((value * apy) / 100).toFixed(2),
          daily_rewards_usd: ((value * apy) / 100 / 365).toFixed(4),
          status: attrs.status || "active",
        });
      }
    }
    
    res.json({
      success: true,
      data: {
        user: {
          username: user.username,
          wallet: walletAddress,
        },
        summary: {
          total_staked_usd: totalStaked.toFixed(2),
          estimated_annual_rewards_usd: totalRewards.toFixed(2),
          estimated_daily_rewards_usd: (totalRewards / 365).toFixed(4),
          avg_apy: totalStaked > 0 ? ((totalRewards / totalStaked) * 100).toFixed(2) + "%" : "0%",
          positions_count: stakingPositions.length,
        },
        positions: stakingPositions,
      },
    });
  } catch (error) {
    console.error("Zerion staking error:", error.message);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * DEFI FEATURE 2: Liquidity Pool Positions
 * GET /api/zerion/liquidity-pools/:identifier
 */
router.get("/liquidity-pools/:identifier", async (req, res) => {
  try {
    const { identifier } = req.params;
    const { chain } = req.query;
    
    const result = await query(
      "SELECT main_pkey, username FROM users WHERE utgid = $1 OR username = $1",
      [identifier]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: "User not found",
      });
    }
    
    const user = result.rows[0];
    const walletAddress = user.main_pkey;
    
    const params = {
      currency: "usd",
      "filter[position_types]": "locked",
      "filter[trash]": "only_non_trash",
    };
    
    if (chain) {
      params["filter[chain_ids]"] = chain;
    }
    
    const response = await zerionRequest(
      `/wallets/${walletAddress}/positions/`,
      params
    );
    
    const lpPositions = [];
    let totalLpValue = 0;
    
    if (response.data && Array.isArray(response.data)) {
      for (const position of response.data) {
        const attrs = position.attributes || {};
        const fungibleInfo = attrs.fungible_info || {};
        const value = parseFloat(attrs.value || 0);
        const quantity = parseFloat(attrs.quantity?.float || 0);
        const protocol = attrs.protocol || "Unknown";
        
        // Check if it's a liquidity pool position
        const isLpPosition = 
          protocol.toLowerCase().includes("uniswap") ||
          protocol.toLowerCase().includes("curve") ||
          protocol.toLowerCase().includes("raydium") ||
          protocol.toLowerCase().includes("orca") ||
          protocol.toLowerCase().includes("sushiswap") ||
          protocol.toLowerCase().includes("pancake") ||
          fungibleInfo.symbol?.includes("LP") ||
          fungibleInfo.name?.toLowerCase().includes("liquidity");
        
        if (isLpPosition) {
          totalLpValue += value;
          
          lpPositions.push({
            protocol: protocol,
            chain: position.relationships?.chain?.data?.id || "unknown",
            pool: {
              name: fungibleInfo.name || "Unknown Pool",
              symbol: fungibleInfo.symbol || "LP",
              logo: fungibleInfo.icon?.url,
            },
            position: {
              quantity: quantity,
              value_usd: value.toFixed(2),
            },
            apy: attrs.yield_percentage ? 
              parseFloat(attrs.yield_percentage).toFixed(2) + "%" : 
              "Check protocol",
            fees_earned: "Track on protocol dashboard",
          });
        }
      }
    }
    
    res.json({
      success: true,
      data: {
        user: {
          username: user.username,
          wallet: walletAddress,
        },
        summary: {
          total_lp_value_usd: totalLpValue.toFixed(2),
          positions_count: lpPositions.length,
          note: "Fee earnings are tracked on individual protocol dashboards",
        },
        positions: lpPositions,
      },
    });
  } catch (error) {
    console.error("Zerion LP error:", error.message);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * DEFI FEATURE 3: All DeFi Positions (Combined)
 * GET /api/zerion/defi-positions/:identifier
 */
router.get("/defi-positions/:identifier", async (req, res) => {
  try {
    const { identifier } = req.params;
    const { chain } = req.query;
    
    const result = await query(
      "SELECT main_pkey, username FROM users WHERE utgid = $1 OR username = $1",
      [identifier]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: "User not found",
      });
    }
    
    const user = result.rows[0];
    const walletAddress = user.main_pkey;
    
    // Get all position types
    const params = {
      currency: "usd",
      "filter[trash]": "only_non_trash",
    };
    
    if (chain) {
      params["filter[chain_ids]"] = chain;
    }
    
    const response = await zerionRequest(
      `/wallets/${walletAddress}/positions/`,
      params
    );
    
    const positions = {
      staking: [],
      liquidity_pools: [],
      lending: [],
      borrowing: [],
      other: [],
    };
    
    let totalValueLocked = 0;
    let totalEstimatedYield = 0;
    
    if (response.data && Array.isArray(response.data)) {
      for (const position of response.data) {
        const attrs = position.attributes || {};
        const fungibleInfo = attrs.fungible_info || {};
        const value = parseFloat(attrs.value || 0);
        const positionType = attrs.position_type || "unknown";
        const protocol = attrs.protocol || "Unknown";
        const apy = parseFloat(attrs.yield_percentage || 0);
        
        // Skip simple wallet holdings
        if (positionType === "wallet" || !protocol || protocol === "Unknown") {
          continue;
        }
        
        totalValueLocked += value;
        totalEstimatedYield += (value * apy) / 100;
        
        const positionData = {
          protocol: protocol,
          chain: position.relationships?.chain?.data?.id || "unknown",
          asset: {
            symbol: fungibleInfo.symbol || "UNKNOWN",
            name: fungibleInfo.name || "Unknown",
            logo: fungibleInfo.icon?.url,
            quantity: parseFloat(attrs.quantity?.float || 0),
            value_usd: value.toFixed(2),
          },
          apy: apy > 0 ? apy.toFixed(2) + "%" : "N/A",
          annual_yield_usd: ((value * apy) / 100).toFixed(2),
          position_type: positionType,
        };
        
        // Categorize positions
        if (positionType === "staked") {
          positions.staking.push(positionData);
        } else if (positionType === "locked" || 
                   protocol.toLowerCase().includes("uniswap") ||
                   protocol.toLowerCase().includes("raydium")) {
          positions.liquidity_pools.push(positionData);
        } else if (positionType === "deposit") {
          positions.lending.push(positionData);
        } else if (positionType === "loan") {
          positions.borrowing.push(positionData);
        } else {
          positions.other.push(positionData);
        }
      }
    }
    
    res.json({
      success: true,
      data: {
        user: {
          username: user.username,
          wallet: walletAddress,
        },
        summary: {
          total_value_locked_usd: totalValueLocked.toFixed(2),
          estimated_annual_yield_usd: totalEstimatedYield.toFixed(2),
          estimated_daily_yield_usd: (totalEstimatedYield / 365).toFixed(4),
          avg_apy: totalValueLocked > 0 ? 
            ((totalEstimatedYield / totalValueLocked) * 100).toFixed(2) + "%" : 
            "0%",
          breakdown: {
            staking: positions.staking.length,
            liquidity_pools: positions.liquidity_pools.length,
            lending: positions.lending.length,
            borrowing: positions.borrowing.length,
            other: positions.other.length,
          },
          total_positions: 
            positions.staking.length + 
            positions.liquidity_pools.length + 
            positions.lending.length + 
            positions.borrowing.length +
            positions.other.length,
        },
        positions: positions,
      },
    });
  } catch (error) {
    console.error("Zerion DeFi positions error:", error.message);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * FEATURE 6: Cross-Chain Transaction History
 * GET /api/zerion/transactions/:identifier
 * Query params:
 *   - chain: Filter by specific chain
 *   - limit: Number of transactions (default: 20, max: 100)
 *   - page: Pagination cursor (from previous response)
 */
router.get("/transactions/:identifier", async (req, res) => {
  try {
    const { identifier } = req.params;
    const { chain, limit = 20, page } = req.query;
    
    const result = await query(
      "SELECT main_pkey, username FROM users WHERE utgid = $1 OR username = $1",
      [identifier]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: "User not found",
      });
    }
    
    const user = result.rows[0];
    const walletAddress = user.main_pkey;
    
    const params = {
      currency: "usd",
      "page[size]": Math.min(parseInt(limit), 100),
    };
    
    if (chain) {
      params["filter[chain_ids]"] = chain;
    }
    
    if (page) {
      params["page[after]"] = page;
    }
    
    const response = await zerionRequest(
      `/wallets/${walletAddress}/transactions/`,
      params
    );
    
    // Process transaction data
    const transactions = [];
    
    if (response.data && Array.isArray(response.data)) {
      for (const tx of response.data) {
        const attrs = tx.attributes || {};
        const operation = attrs.operation_type || "unknown";
        const transfers = attrs.transfers || [];
        
        // Categorize transaction type
        let category = "transfer";
        if (operation.includes("swap") || operation.includes("trade")) {
          category = "swap";
        } else if (operation.includes("approve") || operation.includes("authorization")) {
          category = "approval";
        } else if (operation.includes("deposit") || operation.includes("stake")) {
          category = "deposit";
        } else if (operation.includes("withdraw") || operation.includes("unstake")) {
          category = "withdrawal";
        } else if (operation.includes("mint")) {
          category = "mint";
        } else if (operation.includes("burn")) {
          category = "burn";
        }
        
        // Calculate total value and get transfer details
        let totalValueUSD = 0;
        const transferDetails = [];
        
        for (const transfer of transfers) {
          const fungible = transfer.fungible_info || {};
          const nft = transfer.nft_info || {};
          const quantity = parseFloat(transfer.quantity?.float || 0);
          const price = parseFloat(transfer.price || 0);
          const value = parseFloat(transfer.value || 0);
          
          totalValueUSD += value;
          
          if (fungible.symbol || fungible.name) {
            transferDetails.push({
              type: "token",
              symbol: fungible.symbol || "UNKNOWN",
              name: fungible.name || "Unknown Token",
              quantity: quantity,
              value_usd: value.toFixed(2),
              direction: transfer.direction || "out",
              logo: fungible.icon?.url || null,
            });
          } else if (nft.name) {
            transferDetails.push({
              type: "nft",
              name: nft.name,
              collection: nft.collection?.name || null,
              direction: transfer.direction || "out",
              image: nft.content?.preview?.url || null,
            });
          }
        }
        
        // Get fee information
        const fee = attrs.fee || {};
        const feeValue = parseFloat(fee.value || 0);
        const feeToken = fee.fungible_info?.symbol || "ETH";
        
        transactions.push({
          hash: attrs.hash || tx.id,
          category: category,
          operation_type: operation,
          status: attrs.status || "confirmed",
          timestamp: attrs.mined_at || attrs.sent_at || null,
          block_number: attrs.mined_at_block || null,
          chain: tx.relationships?.chain?.data?.id || "unknown",
          total_value_usd: totalValueUSD.toFixed(2),
          transfers: transferDetails,
          fee: {
            amount: parseFloat(fee.quantity?.float || 0),
            token: feeToken,
            value_usd: feeValue.toFixed(2),
          },
          from: attrs.sent_from || null,
          to: attrs.sent_to || null,
        });
      }
    }
    
    // Get pagination info
    const nextPage = response.links?.next ? 
      new URL(response.links.next).searchParams.get("page[after]") : null;
    
    res.json({
      success: true,
      data: {
        user: {
          username: user.username,
          wallet: walletAddress,
        },
        chain_filter: chain || "all",
        transaction_count: transactions.length,
        transactions: transactions,
        pagination: {
          next_page: nextPage,
          has_more: !!nextPage,
        },
      },
    });
  } catch (error) {
    console.error("Zerion transactions error:", error.message);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * FEATURE 7: Single Transaction Details
 * GET /api/zerion/transaction/:identifier/:hash
 * Get detailed information about a specific transaction
 */
router.get("/transaction/:identifier/:hash", async (req, res) => {
  try {
    const { identifier, hash } = req.params;
    
    const result = await query(
      "SELECT main_pkey, username FROM users WHERE utgid = $1 OR username = $1",
      [identifier]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: "User not found",
      });
    }
    
    const user = result.rows[0];
    const walletAddress = user.main_pkey;
    
    // Get transaction details
    const response = await zerionRequest(
      `/wallets/${walletAddress}/transactions/${hash}`,
      { currency: "usd" }
    );
    
    if (!response.data) {
      return res.status(404).json({
        success: false,
        error: "Transaction not found",
      });
    }
    
    const tx = response.data;
    const attrs = tx.attributes || {};
    const transfers = attrs.transfers || [];
    
    // Process transfers
    const transferDetails = [];
    let totalValueUSD = 0;
    
    for (const transfer of transfers) {
      const fungible = transfer.fungible_info || {};
      const nft = transfer.nft_info || {};
      const quantity = parseFloat(transfer.quantity?.float || 0);
      const value = parseFloat(transfer.value || 0);
      
      totalValueUSD += value;
      
      if (fungible.symbol) {
        transferDetails.push({
          type: "token",
          symbol: fungible.symbol,
          name: fungible.name || "Unknown Token",
          quantity: quantity,
          value_usd: value.toFixed(2),
          price_usd: parseFloat(transfer.price || 0).toFixed(6),
          direction: transfer.direction,
          logo: fungible.icon?.url,
          address: fungible.implementations?.[0]?.address,
        });
      } else if (nft.name) {
        transferDetails.push({
          type: "nft",
          name: nft.name,
          collection: nft.collection?.name,
          direction: transfer.direction,
          image: nft.content?.preview?.url,
          token_id: nft.interface?.id,
        });
      }
    }
    
    // Get fee
    const fee = attrs.fee || {};
    const feeValue = parseFloat(fee.value || 0);
    
    res.json({
      success: true,
      data: {
        hash: attrs.hash || tx.id,
        status: attrs.status,
        operation_type: attrs.operation_type,
        timestamp: attrs.mined_at || attrs.sent_at,
        block_number: attrs.mined_at_block,
        chain: tx.relationships?.chain?.data?.id,
        from: attrs.sent_from,
        to: attrs.sent_to,
        nonce: attrs.nonce,
        total_value_usd: totalValueUSD.toFixed(2),
        transfers: transferDetails,
        fee: {
          amount: parseFloat(fee.quantity?.float || 0),
          token: fee.fungible_info?.symbol || "ETH",
          value_usd: feeValue.toFixed(2),
        },
        explorer_url: `https://${tx.relationships?.chain?.data?.id === "ethereum" ? "etherscan.io" : "explorer.com"}/tx/${attrs.hash}`,
      },
    });
  } catch (error) {
    console.error("Zerion transaction detail error:", error.message);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * FEATURE 8: Transaction Statistics
 * GET /api/zerion/transaction-stats/:identifier
 * Get transaction statistics and summary
 */
router.get("/transaction-stats/:identifier", async (req, res) => {
  try {
    const { identifier } = req.params;
    const { days = 30 } = req.query;
    
    const result = await query(
      "SELECT main_pkey, username FROM users WHERE utgid = $1 OR username = $1",
      [identifier]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: "User not found",
      });
    }
    
    const user = result.rows[0];
    const walletAddress = user.main_pkey;
    
    // Get recent transactions
    const response = await zerionRequest(
      `/wallets/${walletAddress}/transactions/`,
      {
        currency: "usd",
        "page[size]": 100,
      }
    );
    
    // Calculate statistics
    const stats = {
      total_transactions: 0,
      by_category: {
        swaps: 0,
        transfers: 0,
        approvals: 0,
        deposits: 0,
        withdrawals: 0,
        other: 0,
      },
      by_chain: {},
      total_fees_usd: 0,
      total_volume_usd: 0,
      date_range: {
        from: null,
        to: null,
      },
    };
    
    if (response.data && Array.isArray(response.data)) {
      stats.total_transactions = response.data.length;
      
      for (const tx of response.data) {
        const attrs = tx.attributes || {};
        const operation = attrs.operation_type || "unknown";
        const transfers = attrs.transfers || [];
        const chain = tx.relationships?.chain?.data?.id || "unknown";
        
        // Categorize
        if (operation.includes("swap")) {
          stats.by_category.swaps++;
        } else if (operation.includes("approve")) {
          stats.by_category.approvals++;
        } else if (operation.includes("deposit")) {
          stats.by_category.deposits++;
        } else if (operation.includes("withdraw")) {
          stats.by_category.withdrawals++;
        } else if (operation.includes("transfer") || operation.includes("send")) {
          stats.by_category.transfers++;
        } else {
          stats.by_category.other++;
        }
        
        // Count by chain
        if (!stats.by_chain[chain]) {
          stats.by_chain[chain] = 0;
        }
        stats.by_chain[chain]++;
        
        // Calculate fees
        const fee = attrs.fee || {};
        const feeValue = parseFloat(fee.value || 0);
        stats.total_fees_usd += feeValue;
        
        // Calculate volume
        for (const transfer of transfers) {
          const value = parseFloat(transfer.value || 0);
          stats.total_volume_usd += value;
        }
        
        // Track date range
        const txDate = attrs.mined_at || attrs.sent_at;
        if (txDate) {
          if (!stats.date_range.from || txDate > stats.date_range.from) {
            stats.date_range.from = txDate;
          }
          if (!stats.date_range.to || txDate < stats.date_range.to) {
            stats.date_range.to = txDate;
          }
        }
      }
    }
    
    res.json({
      success: true,
      data: {
        user: {
          username: user.username,
          wallet: walletAddress,
        },
        statistics: {
          ...stats,
          total_fees_usd: stats.total_fees_usd.toFixed(2),
          total_volume_usd: stats.total_volume_usd.toFixed(2),
        },
      },
    });
  } catch (error) {
    console.error("Zerion transaction stats error:", error.message);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// ==================== ANALYTICS ENDPOINTS ====================

/**
 * PORTFOLIO PERFORMANCE OVER TIME
 * GET /api/zerion/analytics/portfolio-performance/:identifier
 * 
 * Returns historical portfolio value over different time periods
 */
router.get("/analytics/portfolio-performance/:identifier", async (req, res) => {
  try {
    const { identifier } = req.params;
    const { period = "30d" } = req.query; // 24h, 7d, 30d, 90d, 1y, all
    
    // Get wallet address
    const result = await query(
      "SELECT main_pkey, username FROM users WHERE utgid = $1 OR username = $1",
      [identifier]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: "User not found",
      });
    }
    
    const user = result.rows[0];
    const walletAddress = user.main_pkey;
    
    // Get current portfolio
    const portfolioData = await zerionRequest(
      `/wallets/${walletAddress}/portfolio`,
      { currency: "usd" }
    );
    
    // Get portfolio chart data (historical values)
    const chartData = await zerionRequest(
      `/wallets/${walletAddress}/charts/portfolio`,
      { 
        currency: "usd",
        charts_type: "portfolio",
        period: period
      }
    );
    
    const currentValue = parseFloat(portfolioData.data?.attributes?.total?.value || 0);
    const chartPoints = chartData.data?.attributes?.points || [];
    
    // Calculate changes
    let startValue = 0;
    let highestValue = currentValue;
    let lowestValue = currentValue;
    
    if (chartPoints.length > 0) {
      startValue = parseFloat(chartPoints[0].value || 0);
      
      chartPoints.forEach(point => {
        const val = parseFloat(point.value || 0);
        if (val > highestValue) highestValue = val;
        if (val < lowestValue) lowestValue = val;
      });
    }
    
    const absoluteChange = currentValue - startValue;
    const percentChange = startValue > 0 ? ((absoluteChange / startValue) * 100) : 0;
    
    // Format chart data
    const formattedChart = chartPoints.map(point => ({
      timestamp: point.timestamp,
      value: parseFloat(point.value || 0).toFixed(2),
      date: new Date(point.timestamp * 1000).toISOString(),
    }));
    
    res.json({
      success: true,
      data: {
        user: {
          username: user.username,
          wallet: walletAddress,
        },
        period: period,
        performance: {
          current_value_usd: currentValue.toFixed(2),
          start_value_usd: startValue.toFixed(2),
          absolute_change_usd: absoluteChange.toFixed(2),
          percent_change: percentChange.toFixed(2) + "%",
          highest_value_usd: highestValue.toFixed(2),
          lowest_value_usd: lowestValue.toFixed(2),
          data_points: chartPoints.length,
        },
        chart: formattedChart,
      },
    });
  } catch (error) {
    console.error("Portfolio performance error:", error.message);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * PORTFOLIO CHANGES (24h/7d/30d)
 * GET /api/zerion/analytics/portfolio-changes/:identifier
 * 
 * Returns portfolio value changes over multiple time periods
 */
router.get("/analytics/portfolio-changes/:identifier", async (req, res) => {
  try {
    const { identifier } = req.params;
    
    // Get wallet address
    const result = await query(
      "SELECT main_pkey, username FROM users WHERE utgid = $1 OR username = $1",
      [identifier]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: "User not found",
      });
    }
    
    const user = result.rows[0];
    const walletAddress = user.main_pkey;
    
    // Get portfolio data (includes 24h changes)
    const portfolioData = await zerionRequest(
      `/wallets/${walletAddress}/portfolio`,
      { currency: "usd" }
    );
    
    const currentValue = parseFloat(portfolioData.data?.attributes?.total?.value || 0);
    const changes24h = portfolioData.data?.attributes?.changes?.percent_1d || 0;
    
    // Fetch chart data for different periods
    const periods = ["24h", "7d", "30d"];
    const changesData = {};
    
    for (const period of periods) {
      try {
        const chartData = await zerionRequest(
          `/wallets/${walletAddress}/charts/portfolio`,
          { 
            currency: "usd",
            charts_type: "portfolio",
            period: period
          }
        );
        
        const points = chartData.data?.attributes?.points || [];
        if (points.length > 0) {
          const startValue = parseFloat(points[0].value || 0);
          const endValue = parseFloat(points[points.length - 1].value || currentValue);
          const absoluteChange = endValue - startValue;
          const percentChange = startValue > 0 ? ((absoluteChange / startValue) * 100) : 0;
          
          changesData[period] = {
            start_value_usd: startValue.toFixed(2),
            end_value_usd: endValue.toFixed(2),
            absolute_change_usd: absoluteChange.toFixed(2),
            percent_change: percentChange.toFixed(2) + "%",
            is_positive: absoluteChange >= 0,
          };
        }
      } catch (err) {
        console.log(`Error fetching ${period} data:`, err.message);
        changesData[period] = {
          error: "Data unavailable",
        };
      }
    }
    
    res.json({
      success: true,
      data: {
        user: {
          username: user.username,
          wallet: walletAddress,
        },
        current_portfolio_value_usd: currentValue.toFixed(2),
        changes: changesData,
        summary: {
          trending: 
            changesData["24h"]?.is_positive ? "up" : 
            changesData["24h"]?.is_positive === false ? "down" : 
            "neutral",
        },
      },
    });
  } catch (error) {
    console.error("Portfolio changes error:", error.message);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * TOKEN PRICE CHANGES
 * GET /api/zerion/analytics/token-prices/:identifier
 * 
 * Returns price changes for all tokens in portfolio
 */
router.get("/analytics/token-prices/:identifier", async (req, res) => {
  try {
    const { identifier } = req.params;
    
    // Get wallet address
    const result = await query(
      "SELECT main_pkey, username FROM users WHERE utgid = $1 OR username = $1",
      [identifier]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: "User not found",
      });
    }
    
    const user = result.rows[0];
    const walletAddress = user.main_pkey;
    
    // Get all tokens
    const positionsData = await zerionRequest(
      `/wallets/${walletAddress}/positions`,
      { 
        currency: "usd",
        "filter[positions]": "only_simple",
        "filter[trash]": "only_non_trash",
      }
    );
    
    const tokens = [];
    
    for (const position of positionsData.data || []) {
      const attributes = position.attributes;
      const fungible = attributes.fungible_info;
      
      if (fungible) {
        const price = parseFloat(fungible.price?.value || 0);
        const priceChange24h = fungible.price?.relative_change_24h || 0;
        const value = parseFloat(attributes.value || 0);
        
        tokens.push({
          symbol: fungible.symbol,
          name: fungible.name,
          chain: attributes.chain,
          quantity: parseFloat(attributes.quantity?.float || 0).toFixed(4),
          current_price_usd: price.toFixed(4),
          price_change_24h: (priceChange24h * 100).toFixed(2) + "%",
          value_usd: value.toFixed(2),
          value_change_24h_usd: (value * priceChange24h).toFixed(2),
          is_price_up: priceChange24h >= 0,
          logo: fungible.icon?.url || null,
        });
      }
    }
    
    // Sort by absolute price change
    tokens.sort((a, b) => {
      const changeA = Math.abs(parseFloat(a.price_change_24h));
      const changeB = Math.abs(parseFloat(b.price_change_24h));
      return changeB - changeA;
    });
    
    res.json({
      success: true,
      data: {
        user: {
          username: user.username,
          wallet: walletAddress,
        },
        total_tokens: tokens.length,
        tokens: tokens,
      },
    });
  } catch (error) {
    console.error("Token prices error:", error.message);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * BEST & WORST PERFORMING ASSETS
 * GET /api/zerion/analytics/performance-ranking/:identifier
 * 
 * Returns best and worst performing assets by 24h change
 */
router.get("/analytics/performance-ranking/:identifier", async (req, res) => {
  try {
    const { identifier } = req.params;
    const { limit = 5 } = req.query;
    
    // Get wallet address
    const result = await query(
      "SELECT main_pkey, username FROM users WHERE utgid = $1 OR username = $1",
      [identifier]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: "User not found",
      });
    }
    
    const user = result.rows[0];
    const walletAddress = user.main_pkey;
    
    // Get all tokens
    const positionsData = await zerionRequest(
      `/wallets/${walletAddress}/positions`,
      { 
        currency: "usd",
        "filter[positions]": "only_simple",
        "filter[trash]": "only_non_trash",
      }
    );
    
    const assets = [];
    
    for (const position of positionsData.data || []) {
      const attributes = position.attributes;
      const fungible = attributes.fungible_info;
      
      if (fungible) {
        const price = parseFloat(fungible.price?.value || 0);
        const priceChange24h = fungible.price?.relative_change_24h || 0;
        const value = parseFloat(attributes.value || 0);
        const valueChange24h = value * priceChange24h;
        
        assets.push({
          symbol: fungible.symbol,
          name: fungible.name,
          chain: attributes.chain,
          value_usd: value.toFixed(2),
          price_change_24h_percent: (priceChange24h * 100).toFixed(2),
          value_change_24h_usd: valueChange24h.toFixed(2),
          price_change_raw: priceChange24h,
          logo: fungible.icon?.url || null,
        });
      }
    }
    
    // Sort by performance
    const sortedAssets = [...assets].sort((a, b) => b.price_change_raw - a.price_change_raw);
    
    const bestPerformers = sortedAssets.slice(0, parseInt(limit));
    const worstPerformers = sortedAssets.slice(-parseInt(limit)).reverse();
    
    // Calculate totals
    const totalGains = assets
      .filter(a => a.price_change_raw > 0)
      .reduce((sum, a) => sum + parseFloat(a.value_change_24h_usd), 0);
    
    const totalLosses = assets
      .filter(a => a.price_change_raw < 0)
      .reduce((sum, a) => sum + parseFloat(a.value_change_24h_usd), 0);
    
    res.json({
      success: true,
      data: {
        user: {
          username: user.username,
          wallet: walletAddress,
        },
        summary: {
          total_assets: assets.length,
          gainers: assets.filter(a => a.price_change_raw > 0).length,
          losers: assets.filter(a => a.price_change_raw < 0).length,
          neutral: assets.filter(a => a.price_change_raw === 0).length,
          total_gains_24h_usd: totalGains.toFixed(2),
          total_losses_24h_usd: totalLosses.toFixed(2),
          net_change_24h_usd: (totalGains + totalLosses).toFixed(2),
        },
        best_performers: bestPerformers.map(a => ({
          symbol: a.symbol,
          name: a.name,
          chain: a.chain,
          value_usd: a.value_usd,
          change_24h: a.price_change_24h_percent + "%",
          gain_24h_usd: a.value_change_24h_usd,
          logo: a.logo,
        })),
        worst_performers: worstPerformers.map(a => ({
          symbol: a.symbol,
          name: a.name,
          chain: a.chain,
          value_usd: a.value_usd,
          change_24h: a.price_change_24h_percent + "%",
          loss_24h_usd: a.value_change_24h_usd,
          logo: a.logo,
        })),
      },
    });
  } catch (error) {
    console.error("Performance ranking error:", error.message);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

module.exports = router;
