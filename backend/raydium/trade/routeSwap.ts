import {
  USDCMint,
  toFeeConfig,
  toApiV3Token,
  Router,
  TokenAmount,
  Token,
  DEVNET_PROGRAM_ID,
  printSimulate,
  setLoggerLevel,
  LogLevel,
} from "@raydium-io/raydium-sdk-v2";
import { PublicKey } from "@solana/web3.js";
import { NATIVE_MINT, TOKEN_2022_PROGRAM_ID } from "@solana/spl-token";
import { initSdk, txVersion } from "../config";
import { readCachePoolData, writeCachePoolData } from "../cache/utils";


const poolType: Record<number, string> = {
  4: "AMM",
  5: "AMM Stable",
  6: "CLMM",
  7: "CPMM",
};

setLoggerLevel("Raydium_tradeV2", LogLevel.Debug);

async function routeSwap() {
  const raydium = await initSdk();
  await raydium.fetchChainTime();

  // const inputAmount = '8000000'
  const inputAmount = "6599110";
  const SOL = NATIVE_MINT; // or WSOLMint
  // const [inputMint, outputMint] = [SOL, new PublicKey('7i5XE77hnx1a6hjWgSuYwmqdmLoDJNTU1rYA6Gqx7QiE')]
  // const [inputMint, outputMint] = [
  //   new PublicKey('So11111111111111111111111111111111111111112'), // SOL
  //   new PublicKey('H2FqRtjfzCHTdSHZF3fSfNEJh5xvTP3dnM9415N7g9GX'), // MALONEY
  // ]
  // allow symbol names instead of raw mint addresses
  const SYMBOL_MAP: Record<string, string> = {
    SOL: 'So11111111111111111111111111111111111111112',
    MALONEY: 'H2FqRtjfzCHTdSHZF3fSfNEJh5xvTP3dnM9415N7g9GX',
    USDC: 'Es9vMFrzaCERQKq6sD6U2fB8dZ5b1o4xC8y3zK1j6r4',
    BONK: 'DezJX5YATbQH6Z9uVxM4Qe1fAm1xQ9z5Y4b5k4WbP6d',
  };

  function resolveSymbolOrMint(v: string) {
    if (!v) return null;
    const up = v.toUpperCase();
    if (SYMBOL_MAP[up]) return new PublicKey(SYMBOL_MAP[up]);
    try {
      return new PublicKey(v);
    } catch (e) {
      throw new Error(`Invalid token symbol or mint: ${v}`);
    }
  }

  // you can pass symbol names here (e.g. 'MALONEY') or full base58 mints
  const [inputMint, outputMint] = [
    resolveSymbolOrMint('MALONEY'), // MALONEY symbol -> mint
    resolveSymbolOrMint('SOL'), // SOL symbol -> mint
  ];
  const [inputMintStr, outputMintStr] = [
    inputMint.toBase58(),
    outputMint.toBase58(),
  ];

  // strongly recommend cache all pool data, it will reduce lots of data fetching time
  // code below is a simple way to cache it, you can implement it with any other ways
  // let poolData = readCachePoolData() // initial cache time is 10 mins(1000 * 60 * 10), if wants to cache longer, set bigger number in milliseconds
  let poolData = readCachePoolData(1000 * 60 * 60 * 24 * 10); // example for cache 1 day
  console.log(
    poolData
      ? "loaded pool data from cache"
      : "no valid cache found for pool data"
  );
  if (poolData.ammPools.length === 0) {
    console.log(
      '**Please ensure you are using "paid" rpc node or you might encounter fetch data error due to pretty large pool data**'
    );
    console.log(
      "fetching all pool basic info, this might take a while (more than 1 minutes).."
    );
    poolData = await raydium.tradeV2.fetchRoutePoolBasicInfo({
      amm: DEVNET_PROGRAM_ID.AMM_V4,
      clmm: DEVNET_PROGRAM_ID.CLMM_PROGRAM_ID,
      cpmm: DEVNET_PROGRAM_ID.CREATE_CPMM_POOL_PROGRAM,
    });
    console.log(
      "Available AMM pools:",
      poolData.ammPools.map((p) => ({
        id: p.id.toBase58(),
      }))
    );
    console.log(poolData);
    writeCachePoolData(poolData);
  }

  console.log("computing swap route..");
  // route here also can cache for a time period by pair to reduce time
  // e.g.{inputMint}-${outputMint}'s routes, if poolData don't change, routes should be almost same
  const routes = raydium.tradeV2.getAllRoute({
    inputMint,
    outputMint,
    ...poolData,
  });

  // data here also can try to cache if you wants e.g. mintInfos
  // but rpc related info doesn't suggest to cache it for a long time, because base/quote reserve and pool price change by time
  const {
    routePathDict,
    mintInfos,
    ammPoolsRpcInfo,
    ammSimulateCache,

    clmmPoolsRpcInfo,
    computeClmmPoolInfo,
    computePoolTickData,

    computeCpmmData,
  } = await raydium.tradeV2.fetchSwapRoutesData({
    routes,
    inputMint,
    outputMint,
  });

  console.log("calculating available swap routes...");
  const swapRoutes = raydium.tradeV2.getAllRouteComputeAmountOut({
    inputTokenAmount: new TokenAmount(
      new Token({
        mint: inputMintStr,
        decimals: mintInfos[inputMintStr].decimals,
        isToken2022: mintInfos[inputMintStr].programId.equals(
          TOKEN_2022_PROGRAM_ID
        ),
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
    outputToken: toApiV3Token({
      ...mintInfos[outputMintStr],
      programId: mintInfos[outputMintStr].programId.toBase58(),
      address: outputMintStr,
      freezeAuthority: undefined,
      mintAuthority: undefined,
      extensions: {
        feeConfig: toFeeConfig(mintInfos[outputMintStr].feeConfig),
      },
    }),
    chainTime: Math.floor(
      raydium.chainTimeData?.chainTime ?? Date.now() / 1000
    ),
    slippage: 0.005, // range: 1 ~ 0.0001, means 100% ~ 0.01%
    epochInfo: await raydium.connection.getEpochInfo(),
  });

  // swapRoutes are sorted by out amount, so first one should be the best route
  const targetRoute = swapRoutes[0];
  if (!targetRoute) throw new Error("no swap routes were found");

  console.log("best swap route:", {
    input: targetRoute.amountIn.amount.toExact(),
    output: targetRoute.amountOut.amount.toExact(),
    minimumOut: targetRoute.minAmountOut.amount.toExact(),
    swapType: targetRoute.routeType,
    routes: targetRoute.poolInfoList
      .map((p) => `${poolType[p.version]} ${p.id} ${(p as any).status}`)
      .join(` -> `),
  });

  console.log("fetching swap route pool keys..");
  const poolKeys = await raydium.tradeV2.computePoolToPoolKeys({
    pools: targetRoute.poolInfoList,
    ammRpcData: ammPoolsRpcInfo,
    clmmRpcData: clmmPoolsRpcInfo,
  });

  console.log("build swap tx..");
  const { execute, transactions } = await raydium.tradeV2.swap({
    routeProgram: new PublicKey("BVChZ3XFEwTMUk1o9i3HAf91H6mFxSwa5X2wFAWhYPhU"),

    txVersion,
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

  // printSimulate(transactions)

  // printSimulateInfo()
  console.log("execute tx..");
  // sequentially should always to be true because first tx does initialize token accounts needed for swap
  try {
    const { txIds } = await execute({ sequentially: true });
    console.log("txIds:", txIds);
    txIds.forEach((txId) =>
      console.log(`https://explorer.solana.com/tx/${txId}?cluster=devnet`)
    );
  } catch (err) {
    console.error("Swap execution failed:", err);
  }

  process.exit(); // if you don't want to end up node execution, comment this line
}
/** uncomment code below to execute */
// routeSwap();
//live pnl
// Assume you have these from the buy
// const buyAmountSOL = 0.01
// const tokenBought = 6.59911
// const buyFee = 0.000005

// // Get current quote for selling tokenBought back to SOL
// const sellQuote = await raydium.tradeV2.getAllRouteComputeAmountOut({
//   inputTokenAmount: new TokenAmount(
//     new Token({ mint: tokenMint, decimals: tokenDecimals }),
//     tokenBought
//   ),
//   // ...other params as in your swap code...
// })
// const currentSellSOL = sellQuote[0]?.amountOut.amount.toExact() || 0
// const estimatedSellFee = 0.000005 // update if you have actual fee

// const livePnL = currentSellSOL - buyAmountSOL - buyFee - estimatedSellFee

// console.log({
//   buyAmountSOL,
//   tokenBought,
//   currentSellSOL,
//   buyFee,
//   estimatedSellFee,
//   livePnL
// })