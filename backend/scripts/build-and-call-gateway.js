#!/usr/bin/env node
require('dotenv').config();
const axios = require('axios');
const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  Keypair,
  Connection,
  clusterApiUrl,
  LAMPORTS_PER_SOL,
  SystemProgram,
  Transaction,
  PublicKey,
} = require('@solana/web3.js');

async function loadPayerKeypair() {
  const envSecret = process.env.SANCTUM_PAYER_SECRET;
  if (envSecret) {
    try {
      const arr = JSON.parse(envSecret);
      if (Array.isArray(arr)) return Keypair.fromSecretKey(Uint8Array.from(arr));
    } catch (e) {
      try {
        const buf = Buffer.from(envSecret, 'base64');
        return Keypair.fromSecretKey(new Uint8Array(buf));
      } catch (e2) {
        console.warn('SANCTUM_PAYER_SECRET provided but could not parse it');
      }
    }
  }

  const kpPath = process.env.SANCTUM_PAYER_KEYPAIR_PATH;
  if (kpPath && fs.existsSync(kpPath)) {
    try {
      const data = JSON.parse(fs.readFileSync(kpPath, 'utf8'));
      return Keypair.fromSecretKey(Uint8Array.from(data));
    } catch (e) {
      console.warn('Failed to load SANCTUM_PAYER_KEYPAIR_PATH:', e.message || e);
    }
  }

  const defaultPath = path.join(os.homedir(), '.config', 'solana', 'id.json');
  if (fs.existsSync(defaultPath)) {
    try {
      const data = JSON.parse(fs.readFileSync(defaultPath, 'utf8'));
      return Keypair.fromSecretKey(Uint8Array.from(data));
    } catch (e) {
      console.warn('Failed to load Solana CLI keypair:', e.message || e);
    }
  }

  // Use the hardcoded keypair with funds as fallback
  console.log('Using hardcoded funded keypair');
  const hardcodedSecret = [113,252,135,121,216,58,209,4,176,158,114,85,213,5,228,129,31,131,249,27,171,189,237,18,203,104,107,168,41,54,160,55,222,63,131,95,138,18,85,17,153,139,15,142,113,6,85,51,212,236,29,63,164,82,214,111,78,204,35,3,122,108,62,123];
  return Keypair.fromSecretKey(Uint8Array.from(hardcodedSecret));
}

async function main() {
  const cluster = process.env.SANCTUM_CLUSTER || 'devnet';
  const rpcUrl = process.env.SOLANA_RPC_URL || clusterApiUrl(cluster);
  const connection = new Connection(rpcUrl, 'confirmed');

  const payer = await loadPayerKeypair();
  const recipientPub = process.env.TX_RECIPIENT_PUBKEY ? new PublicKey(process.env.TX_RECIPIENT_PUBKEY) : Keypair.generate().publicKey;

  console.log('Cluster:', cluster);
  console.log('RPC URL:', rpcUrl);
  console.log('Payer:', payer.publicKey.toBase58());
  console.log('Recipient:', recipientPub.toBase58());

  // Check payer balance
  const balance = await connection.getBalance(payer.publicKey);
  console.log('Payer balance:', balance / LAMPORTS_PER_SOL, 'SOL');

  // Safety check for mainnet
  if (cluster === 'mainnet' || cluster === 'mainnet-beta') {
    const minBalance = 0.01 * LAMPORTS_PER_SOL; // Minimum 0.01 SOL required
    if (balance < minBalance) {
      console.error(`Insufficient balance for mainnet. Need at least 0.01 SOL, have ${balance / LAMPORTS_PER_SOL} SOL`);
      process.exit(1);
    }
  }

  // Build transfer tx
  // For devnet: 0.001 SOL is safe and avoids rent issues
  // For mainnet: consider using smaller amounts
  const lamports = Math.floor((cluster === 'mainnet' || cluster === 'mainnet-beta' ? 0.0001 : 0.001) * LAMPORTS_PER_SOL);
  const tx = new Transaction();
  tx.add(
    SystemProgram.transfer({
      fromPubkey: payer.publicKey,
      toPubkey: recipientPub,
      lamports,
    })
  );

  // Optionally add tip if SANCTUM_TIP_PUBKEY is present
  if (process.env.SANCTUM_TIP_PUBKEY) {
    const tipPub = new PublicKey(process.env.SANCTUM_TIP_PUBKEY);
    const tipLamports = parseInt(process.env.SANCTUM_TIP_LAMPORTS || '5000', 10);
    tx.add(
      SystemProgram.transfer({ fromPubkey: payer.publicKey, toPubkey: tipPub, lamports: tipLamports })
    );
    console.log('Added tip transfer to', tipPub.toBase58(), 'amount', tipLamports);
  }

  tx.feePayer = payer.publicKey;
  // Set a dummy blockhash - buildGatewayTransaction will replace it with the latest one
  tx.recentBlockhash = '11111111111111111111111111111111';

  // DO NOT sign yet - buildGatewayTransaction needs unsigned transaction
  // Serialize without signatures
  const base64 = tx.serialize({ requireAllSignatures: false, verifySignatures: false }).toString('base64');
  console.log('\nUnsigned Base64 transaction:\n', base64);

  // Build gateway endpoint
  const apiKey = process.env.SANCTUM_API_KEY;
  if (!apiKey) {
    console.error('SANCTUM_API_KEY is not set in .env');
    process.exit(1);
  }
  const endpoint = `https://tpg.sanctum.so/v1/${cluster}?apiKey=${apiKey}`;

  // POST to buildGatewayTransaction
  try {
    console.log('\nPosting to Sanctum buildGatewayTransaction...');
    const resp = await axios.post(
      endpoint,
      {
        id: 'solcircle',
        jsonrpc: '2.0',
        method: 'buildGatewayTransaction',
        params: [base64, {
          // Optional parameters to customize transaction building
          // encoding: "base64" (default)
          // skipSimulation: false (default - simulation helps estimate CU consumption)
          // skipPriorityFee: false (default - let Gateway set optimal priority fees)
          // deliveryMethodType: "rpc" - uses your configured delivery method from dashboard
          // Note: sanctum-sender only works on mainnet, not devnet
        }]
      },
      { headers: { 'Content-Type': 'application/json' }, timeout: 10000 }
    );
    console.log('Gateway response:', JSON.stringify(resp.data, null, 2));
    // If the gateway returned a built transaction, we need to sign it before sending
    const builtTxBase64 = resp?.data?.result?.transaction;
    if (builtTxBase64) {
      try {
        console.log('\nDeserializing built transaction...');
        // Deserialize the transaction returned by buildGatewayTransaction
        const builtTxBuffer = Buffer.from(builtTxBase64, 'base64');
        const builtTx = Transaction.from(builtTxBuffer);

        console.log('Signing transaction with payer...');
        // Now sign the built transaction
        builtTx.partialSign(payer);

        // Serialize the signed transaction
        const signedTxBase64 = builtTx.serialize().toString('base64');
        console.log('\nSending signed transaction via Sanctum sendTransaction...');

        const sendResp = await axios.post(
          endpoint,
          {
            id: 'solcircle',
            jsonrpc: '2.0',
            method: 'sendTransaction',
            params: [signedTxBase64]
          },
          { headers: { 'Content-Type': 'application/json' }, timeout: 10000 }
        );
        console.log('sendTransaction response:', JSON.stringify(sendResp.data, null, 2));

        // Check if there's an error in the response
        if (sendResp.data.error) {
          console.error('\nTransaction failed with error:', JSON.stringify(sendResp.data.error, null, 2));
          throw new Error(`sendTransaction error: ${sendResp.data.error.message}`);
        }

        // If a signature is returned, check it on devnet explorer
        const maybeSig = sendResp?.data?.result || sendResp?.data?.signature || null;
        if (maybeSig) {
          // normalize: result might be an object containing signature or the signature string
          const signature = typeof maybeSig === 'string' ? maybeSig : (maybeSig.signature || maybeSig);
          if (signature) {
            console.log('\nTransaction submitted successfully!');
            console.log('Signature:', signature);
            const explorerCluster = cluster === 'mainnet' ? '' : `?cluster=${cluster}`;
            console.log('View on Solana Explorer:', `https://explorer.solana.com/tx/${signature}${explorerCluster}`);

            // Wait a bit then check status directly via RPC
            console.log('\nWaiting 2 seconds before checking status...');
            await new Promise(resolve => setTimeout(resolve, 2000));

            try {
              const status = await connection.getSignatureStatus(signature);
              console.log('Transaction status:', JSON.stringify(status, null, 2));
            } catch (statusErr) {
              console.warn('Failed to fetch signature status:', statusErr.message || statusErr);
            }
          }
        }
      } catch (sendErr) {
        console.error('Error sending wrapped transaction:', sendErr.response?.data || sendErr.message || sendErr);
      }
    }
  } catch (err) {
    console.error('Gateway request failed:', err.response?.data || err.message || err);
    process.exit(1);
  }
}

main().catch((e) => {
  console.error('Unhandled error:', e);
  process.exit(1);
});
