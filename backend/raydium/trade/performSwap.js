const fs = require('fs');
const path = require('path');
const { Connection, clusterApiUrl, PublicKey } = require('@solana/web3.js');
const RaydiumPkg = require('@raydium-io/raydium-sdk-v2');

async function performSwap({ inputMint, outputMint, amountSol }) {
  // amountSol: number (e.g., 0.01)
  const connection = new Connection(process.env.SOLANA_RPC_URL || clusterApiUrl('devnet'), 'confirmed');

  // load admin keypair from file (must exist)
  const adminPath = path.join(process.cwd(), 'admin-keypair.json');
  if (!fs.existsSync(adminPath)) throw new Error('admin-keypair.json not found');
  const adminRaw = JSON.parse(fs.readFileSync(adminPath, 'utf8'));
  const adminKeypair = require('@solana/web3.js').Keypair.fromSecretKey(new Uint8Array(adminRaw));

  // Prepare Raydium SDK
  const { Raydium, TxVersion, toApiV3Token, TokenAmount, Token } = RaydiumPkg;

  const raydium = await Raydium.load({
    owner: adminKeypair,
    connection,
    cluster: 'devnet',
    disableFeatureCheck: true,
    disableLoadToken: false,
    blockhashCommitment: 'finalized',
    urlConfigs: {
      BASE_HOST: 'https://api-v3-devnet.raydium.io',
      OWNER_BASE_HOST: 'https://owner-v1-devnet.raydium.io',
      SWAP_HOST: 'https://transaction-v1-devnet.raydium.io',
      CPMM_LOCK: 'https://dynamic-ipfs-devnet.raydium.io/lock/cpmm/position',
    },
  });

  // Resolve mints to PublicKey
  const inMint = typeof inputMint === 'string' ? new PublicKey(inputMint) : inputMint;
  const outMint = typeof outputMint === 'string' ? new PublicKey(outputMint) : outputMint;

  // Load pool data (may take time)
  const poolData = await raydium.tradeV2.fetchRoutePoolBasicInfo({
    amm: RaydiumPkg.DEVNET_PROGRAM_ID.AMM_V4,
    clmm: RaydiumPkg.DEVNET_PROGRAM_ID.CLMM_PROGRAM_ID,
    cpmm: RaydiumPkg.DEVNET_PROGRAM_ID.CREATE_CPMM_POOL_PROGRAM,
  });

  const routes = raydium.tradeV2.getAllRoute({ inputMint: inMint, outputMint: outMint, ...poolData });

  const {
    routePathDict,
    mintInfos,
    ammPoolsRpcInfo,
    ammSimulateCache,
    clmmPoolsRpcInfo,
    computeClmmPoolInfo,
    computePoolTickData,
    computeCpmmData,
  } = await raydium.tradeV2.fetchSwapRoutesData({ routes, inputMint: inMint, outputMint: outMint });

  // Convert amountSol to raw amount string using decimals of input
  const inputMintStr = inMint.toBase58();
  const inputDecimals = mintInfos[inputMintStr].decimals;
  const inputAmountInteger = BigInt(Math.floor(amountSol * Math.pow(10, inputDecimals)));
  const inputAmountStr = inputAmountInteger.toString();

  const swapRoutes = raydium.tradeV2.getAllRouteComputeAmountOut({
    inputTokenAmount: new TokenAmount(
      new Token({ mint: inputMintStr, decimals: inputDecimals, isToken2022: mintInfos[inputMintStr].programId.equals(RaydiumPkg.TOKEN_2022_PROGRAM_ID) }),
      inputAmountStr
    ),
    directPath: routes.directPath.map(
      (p) => ammSimulateCache[p.id.toBase58()] || computeClmmPoolInfo[p.id.toBase58()] || computeCpmmData[p.id.toBase58()]
    ),
    routePathDict,
    simulateCache: ammSimulateCache,
    tickCache: computePoolTickData,
    mintInfos,
    outputToken: toApiV3Token({
      ...mintInfos[outMint.toBase58()],
      programId: mintInfos[outMint.toBase58()].programId.toBase58(),
      address: outMint.toBase58(),
    }),
    chainTime: Math.floor(raydium.chainTimeData?.chainTime ?? Date.now() / 1000),
    slippage: 0.005,
    epochInfo: await raydium.connection.getEpochInfo(),
  });

  const targetRoute = swapRoutes[0];
  if (!targetRoute) throw new Error('No swap route found');

  const poolKeys = await raydium.tradeV2.computePoolToPoolKeys({ pools: targetRoute.poolInfoList, ammRpcData: ammPoolsRpcInfo, clmmRpcData: clmmPoolsRpcInfo });

  const { execute } = await raydium.tradeV2.swap({
    routeProgram: new PublicKey('BVChZ3XFEwTMUk1o9i3HAf91H6mFxSwa5X2wFAWhYPhU'),
    txVersion: TxVersion.V0,
    swapInfo: targetRoute,
    swapPoolKeys: poolKeys,
    ownerInfo: { associatedOnly: true, checkCreateATAOwner: true },
    computeBudgetConfig: { units: 600000, microLamports: 465915 },
  });

  const { txIds } = await execute({ sequentially: true });
  return { txIds };
}

module.exports = { performSwap };
