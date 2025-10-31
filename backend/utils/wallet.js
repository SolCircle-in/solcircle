const { Keypair } = require("@solana/web3.js");
const { encrypt, decrypt } = require("./crypto");
const bs58 = require("bs58");

/**
 * Create a new Solana custodial wallet
 * @returns {Object} - { publicKey, privateKey, secretKeyArray }
 */
function createCustodialWallet() {
  const keypair = Keypair.generate();

  return {
    publicKey: keypair.publicKey.toString(),
    privateKey: Buffer.from(keypair.secretKey).toString("base64"), // Use base64 instead
    secretKeyArray: Array.from(keypair.secretKey),
  };
}

/**
 * Encrypt wallet private key
 * @param {string} privateKey - Base64 encoded private key
 * @param {string} masterPassword - Master encryption password
 * @returns {string} - Encrypted private key
 */
function encryptPrivateKey(privateKey, masterPassword) {
  return encrypt(privateKey, masterPassword);
}

/**
 * Decrypt wallet private key
 * @param {string} encryptedKey - Encrypted private key
 * @param {string} masterPassword - Master encryption password
 * @returns {string} - Decrypted Base64 private key
 */
function decryptPrivateKey(encryptedKey, masterPassword) {
  return decrypt(encryptedKey, masterPassword);
}

/**
 * Get Keypair from encrypted private key
 * @param {string} encryptedKey - Encrypted private key
 * @param {string} masterPassword - Master encryption password
 * @returns {Keypair} - Solana Keypair object
 */
function getKeypairFromEncrypted(encryptedKey, masterPassword) {
  const privateKey = decryptPrivateKey(encryptedKey, masterPassword);
  const secretKey = Buffer.from(privateKey, "base64");
  return Keypair.fromSecretKey(secretKey);
}

module.exports = {
  createCustodialWallet,
  encryptPrivateKey,
  decryptPrivateKey,
  getKeypairFromEncrypted,
};
