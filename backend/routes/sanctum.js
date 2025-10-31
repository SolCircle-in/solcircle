const express = require('express');
const router = express.Router();
const SanctumGateway = require('../utils/sanctum-gateway');

/**
 * Test endpoint for Sanctum Gateway integration
 */

// GET /api/sanctum/status - Check Gateway status
router.get('/status', async (req, res) => {
  try {
    const gateway = new SanctumGateway({
      apiKey: process.env.SANCTUM_API_KEY,
      cluster: process.env.SANCTUM_CLUSTER || 'devnet',
    });

    res.json({
      status: 'connected',
      endpoint: gateway.getEndpointUrl(),
      cluster: gateway.cluster,
      message: 'Sanctum Gateway is configured and ready',
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message,
    });
  }
});

// GET /api/sanctum/config - Get Gateway configuration
router.get('/config', (req, res) => {
  res.json({
    cluster: process.env.SANCTUM_CLUSTER || 'devnet',
    apiKeyConfigured: !!process.env.SANCTUM_API_KEY,
    endpoint: `https://tpg.sanctum.so/v1/${process.env.SANCTUM_CLUSTER || 'devnet'}`,
    deliveryMethods: {
      available: [
        'sanctum-sender (default)',
        'rpc',
        'jito-bundles',
        'astralane-sender',
        'helius-sender',
      ],
      description: 'Sanctum Sender is configured by default and provides the best reliability',
    },
  });
});

// POST /api/sanctum/transaction-status - Check transaction status
router.post('/transaction-status', async (req, res) => {
  try {
    const { signature } = req.body;

    if (!signature) {
      return res.status(400).json({
        error: 'Transaction signature is required',
      });
    }

    const gateway = new SanctumGateway({
      apiKey: process.env.SANCTUM_API_KEY,
      cluster: process.env.SANCTUM_CLUSTER || 'devnet',
    });

    const status = await gateway.getTransactionStatus(signature);

    res.json({
      signature,
      status,
    });
  } catch (error) {
    res.status(500).json({
      error: error.message,
    });
  }
});

module.exports = router;
