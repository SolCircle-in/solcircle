const { Connection, Transaction, VersionedTransaction } = require('@solana/web3.js');
const axios = require('axios');

/**
 * Sanctum Gateway Integration
 * Provides methods to send transactions through Sanctum's Gateway for improved reliability
 */

class SanctumGateway {
  constructor(config = {}) {
    this.apiKey = config.apiKey || process.env.SANCTUM_API_KEY;
    this.cluster = config.cluster || process.env.SANCTUM_CLUSTER || 'mainnet';
    this.baseUrl = 'https://tpg.sanctum.so/v1';
    
    if (!this.apiKey) {
      throw new Error('Sanctum API key is required. Set SANCTUM_API_KEY in environment or pass in config.');
    }
  }

  /**
   * Get the full Gateway endpoint URL
   */
  getEndpointUrl() {
    return `${this.baseUrl}/${this.cluster}?apiKey=${this.apiKey}`;
  }

  /**
   * Convert a transaction to base64 encoded wire format
   * @param {Transaction | VersionedTransaction} transaction - The transaction to encode
   * @returns {string} Base64 encoded transaction
   */
  getBase64EncodedWireTransaction(transaction) {
    if (transaction instanceof VersionedTransaction) {
      return Buffer.from(transaction.serialize()).toString('base64');
    } else if (transaction instanceof Transaction) {
      return transaction.serialize({ requireAllSignatures: false }).toString('base64');
    }
    throw new Error('Invalid transaction type');
  }

  /**
   * Build a Gateway transaction
   * This wraps your transaction with Gateway's delivery methods
   * @param {Transaction | VersionedTransaction} transaction - The transaction to build
   * @returns {Promise<Object>} The Gateway transaction response
   */
  async buildGatewayTransaction(transaction) {
    try {
      const base64Transaction = this.getBase64EncodedWireTransaction(transaction);
      
      const response = await axios.post(
        this.getEndpointUrl(),
        {
          method: 'buildGatewayTransaction',
          params: [base64Transaction],
        },
        {
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      return response.data;
    } catch (error) {
      console.error('Error building Gateway transaction:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Send a transaction through the Gateway
   * @param {Transaction | VersionedTransaction} transaction - The signed transaction to send
   * @param {Object} options - Additional options
   * @param {string[]} options.deliveryMethods - Specific delivery methods to use (optional)
   * @returns {Promise<Object>} Transaction response with signature
   */
  async sendTransaction(transaction, options = {}) {
    try {
      const base64Transaction = this.getBase64EncodedWireTransaction(transaction);
      
      const params = [base64Transaction];
      if (options.deliveryMethods && options.deliveryMethods.length > 0) {
        params.push({ deliveryMethods: options.deliveryMethods });
      }

      const response = await axios.post(
        this.getEndpointUrl(),
        {
          method: 'sendTransaction',
          params: params,
        },
        {
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      return response.data;
    } catch (error) {
      console.error('Error sending transaction through Gateway:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Send a raw transaction (already serialized)
   * @param {string} base64Transaction - Base64 encoded transaction
   * @param {Object} options - Additional options
   * @returns {Promise<Object>} Transaction response
   */
  async sendRawTransaction(base64Transaction, options = {}) {
    try {
      const params = [base64Transaction];
      if (options.deliveryMethods && options.deliveryMethods.length > 0) {
        params.push({ deliveryMethods: options.deliveryMethods });
      }

      const response = await axios.post(
        this.getEndpointUrl(),
        {
          method: 'sendTransaction',
          params: params,
        },
        {
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      return response.data;
    } catch (error) {
      console.error('Error sending raw transaction through Gateway:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Get transaction status
   * @param {string} signature - Transaction signature
   * @returns {Promise<Object>} Transaction status
   */
  async getTransactionStatus(signature) {
    try {
      const response = await axios.post(
        this.getEndpointUrl(),
        {
          method: 'getSignatureStatuses',
          params: [[signature]],
        },
        {
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      return response.data;
    } catch (error) {
      console.error('Error getting transaction status:', error.response?.data || error.message);
      throw error;
    }
  }
}

module.exports = SanctumGateway;
