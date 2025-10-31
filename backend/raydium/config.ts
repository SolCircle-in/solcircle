import {
  Raydium,
  TxVersion,
  parseTokenAccountResp,
  DEV_API_URLS,
} from "@raydium-io/raydium-sdk-v2";
import { Connection, Keypair, clusterApiUrl } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID } from "@solana/spl-token";
import bs58 from "bs58";

export const owner: Keypair = Keypair.fromSecretKey(
  Uint8Array.from([
    78, 75, 159, 53, 228, 203, 89, 192, 43, 6, 20, 135, 40, 134, 183, 6, 31,
    219, 13, 223, 143, 72, 169, 112, 62, 77, 22, 234, 13, 120, 98, 91, 207, 126,
    49, 247, 1, 196, 147, 129, 139, 246, 218, 107, 176, 243, 207, 162, 142, 153,
    12, 129, 27, 21, 152, 49, 80, 93, 141, 110, 79, 15, 88, 52,
  ])
);
export const connection = new Connection("https://api.devnet.solana.com/"); //<YOUR_RPC_URL>
// export const connection = new Connection(clusterApiUrl('devnet')) //<YOUR_RPC_URL>
export const txVersion = TxVersion.V0; // or TxVersion.LEGACY
const cluster = "mainnet" as "mainnet" | "devnet"; // 'mainnet' | 'devnet'

let raydium: Raydium | undefined;
export const initSdk = async (params?: { loadToken?: boolean }) => {
  if (raydium) return raydium;
  if (connection.rpcEndpoint === clusterApiUrl("mainnet-beta"))
    console.warn(
      "using free rpc node might cause unexpected error, strongly suggest uses paid rpc node"
    );
  console.log(`connect to rpc ${connection.rpcEndpoint} in ${cluster}`);
  raydium = await Raydium.load({
    owner,
    connection,
    cluster,
    disableFeatureCheck: true,
    disableLoadToken: !params?.loadToken,
    blockhashCommitment: "finalized",
    ...(cluster === "devnet"
      ? {
          urlConfigs: {
            ...DEV_API_URLS,
            BASE_HOST: "https://api-v3-devnet.raydium.io",
            OWNER_BASE_HOST: "https://owner-v1-devnet.raydium.io",
            SWAP_HOST: "https://transaction-v1-devnet.raydium.io",
            CPMM_LOCK:
              "https://dynamic-ipfs-devnet.raydium.io/lock/cpmm/position",
          },
        }
      : {}),
  });

  /**
   * By default: sdk will automatically fetch token account data when need it or any sol balace changed.
   * if you want to handle token account by yourself, set token account data after init sdk
   * code below shows how to do it.
   * note: after call raydium.account.updateTokenAccount, raydium will not automatically fetch token account
   */

  /*  
  raydium.account.updateTokenAccount(await fetchTokenAccountData())
  connection.onAccountChange(owner.publicKey, async () => {
    raydium!.account.updateTokenAccount(await fetchTokenAccountData())
  })
  */

  return raydium;
};

export const fetchTokenAccountData = async () => {
  const solAccountResp = await connection.getAccountInfo(owner.publicKey);
  const tokenAccountResp = await connection.getTokenAccountsByOwner(
    owner.publicKey,
    { programId: TOKEN_PROGRAM_ID }
  );
  const token2022Req = await connection.getTokenAccountsByOwner(
    owner.publicKey,
    { programId: TOKEN_2022_PROGRAM_ID }
  );
  const tokenAccountData = parseTokenAccountResp({
    owner: owner.publicKey,
    solAccountResp,
    tokenAccountResp: {
      context: tokenAccountResp.context,
      value: [...tokenAccountResp.value, ...token2022Req.value],
    },
  });
  return tokenAccountData;
};

export const grpcUrl = "<YOUR_GRPC_URL>";
export const grpcToken = "<YOUR_GRPC_TOKEN>";
