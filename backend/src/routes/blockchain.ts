import express from 'express';
import { body, validationResult } from 'express-validator';
import { BlockchainService } from '@/services/blockchainService';
import { authenticate, requireTwoFactor } from '@/middleware/auth';
import { asyncHandler } from '@/middleware/errorHandler';

const router = express.Router();

// Validation middleware
const validateAddress = [
  body('address').isEthereumAddress().withMessage('Valid Ethereum address is required'),
];

const validateTransaction = [
  body('to_address').isEthereumAddress().withMessage('Valid recipient address is required'),
  body('amount').isFloat({ min: 0.000001 }).withMessage('Amount must be greater than 0'),
  body('network').isIn(['ethereum', 'polygon', 'bsc']).withMessage('Valid network is required'),
];

// @route   GET /api/blockchain/networks
// @desc    Get supported blockchain networks
// @access  Public
router.get('/networks', asyncHandler(async (req, res) => {
  const networks = await BlockchainService.getSupportedNetworks();

  res.json({
    success: true,
    data: {
      networks,
    },
  });
}));

// @route   GET /api/blockchain/networks/:network
// @desc    Get network information
// @access  Public
router.get('/networks/:network', asyncHandler(async (req, res) => {
  const networkInfo = await BlockchainService.getNetworkInfo(req.params.network);

  res.json({
    success: true,
    data: {
      network: networkInfo,
    },
  });
}));

// @route   POST /api/blockchain/wallet/create
// @desc    Create a new blockchain wallet
// @access  Private
router.post('/wallet/create', authenticate, [
  body('network').isIn(['ethereum', 'polygon', 'bsc']).withMessage('Valid network is required'),
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array(),
    });
  }

  const { network } = req.body;

  const wallet = await BlockchainService.createWallet(network);

  res.status(201).json({
    success: true,
    message: 'Blockchain wallet created successfully',
    data: {
      wallet: {
        address: wallet.address,
        network,
        // Don't return private key in response
      },
    },
  });
}));

// @route   GET /api/blockchain/wallet/:address/balance
// @desc    Get wallet balance
// @access  Private
router.get('/wallet/:address/balance', authenticate, asyncHandler(async (req, res) => {
  const { address } = req.params;
  const { network } = req.query;

  if (!network || typeof network !== 'string') {
    return res.status(400).json({
      success: false,
      message: 'Network parameter is required',
    });
  }

  const balance = await BlockchainService.getBalance(address, network);

  res.json({
    success: true,
    data: {
      address,
      balance,
      network,
      currency: network === 'ethereum' ? 'ETH' : network === 'polygon' ? 'MATIC' : 'BNB',
    },
  });
}));

// @route   POST /api/blockchain/validate-address
// @desc    Validate blockchain address
// @access  Public
router.post('/validate-address', validateAddress, asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array(),
    });
  }

  const { address, network } = req.body;

  const isValid = await BlockchainService.validateAddress(address, network);

  res.json({
    success: true,
    data: {
      address,
      network,
      is_valid: isValid,
    },
  });
}));

// @route   POST /api/blockchain/transaction/send
// @desc    Send blockchain transaction
// @access  Private
router.post('/transaction/send', authenticate, requireTwoFactor, validateTransaction, asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array(),
    });
  }

  const { to_address, amount, network, gas_price } = req.body;

  // In a real implementation, you would get the private key from the user's encrypted wallet
  // For security, this should be handled client-side or with proper key management
  const fromPrivateKey = req.body.from_private_key; // This should be handled more securely

  if (!fromPrivateKey) {
    return res.status(400).json({
      success: false,
      message: 'Private key is required for transaction',
    });
  }

  const result = await BlockchainService.sendTransaction(
    fromPrivateKey,
    to_address,
    amount,
    network,
    gas_price
  );

  res.json({
    success: true,
    message: 'Transaction sent successfully',
    data: {
      transaction_hash: result.hash,
      status: result.status,
      network,
    },
  });
}));

// @route   GET /api/blockchain/transaction/:hash/status
// @desc    Get transaction status
// @access  Public
router.get('/transaction/:hash/status', asyncHandler(async (req, res) => {
  const { hash } = req.params;
  const { network } = req.query;

  if (!network || typeof network !== 'string') {
    return res.status(400).json({
      success: false,
      message: 'Network parameter is required',
    });
  }

  const transaction = await BlockchainService.getTransactionStatus(hash, network);

  res.json({
    success: true,
    data: {
      transaction,
    },
  });
}));

// @route   GET /api/blockchain/wallet/:address/history
// @desc    Get wallet transaction history
// @access  Private
router.get('/wallet/:address/history', authenticate, asyncHandler(async (req, res) => {
  const { address } = req.params;
  const { network } = req.query;
  const limit = parseInt(req.query.limit as string) || 50;

  if (!network || typeof network !== 'string') {
    return res.status(400).json({
      success: false,
      message: 'Network parameter is required',
    });
  }

  const history = await BlockchainService.getTransactionHistory(address, network, limit);

  res.json({
    success: true,
    data: {
      address,
      network,
      transactions: history,
      count: history.length,
    },
  });
}));

// @route   POST /api/blockchain/gas/estimate
// @desc    Estimate gas for transaction
// @access  Public
router.post('/gas/estimate', [
  body('from_address').isEthereumAddress().withMessage('Valid from address is required'),
  body('to_address').isEthereumAddress().withMessage('Valid to address is required'),
  body('amount').isFloat({ min: 0.000001 }).withMessage('Amount must be greater than 0'),
  body('network').isIn(['ethereum', 'polygon', 'bsc']).withMessage('Valid network is required'),
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array(),
    });
  }

  const { from_address, to_address, amount, network } = req.body;

  const gasEstimate = await BlockchainService.estimateGas(from_address, to_address, amount, network);

  res.json({
    success: true,
    data: {
      gas_estimate: gasEstimate,
      network,
    },
  });
}));

// @route   GET /api/blockchain/gas/price
// @desc    Get current gas price
// @access  Public
router.get('/gas/price', asyncHandler(async (req, res) => {
  const { network } = req.query;

  if (!network || typeof network !== 'string') {
    return res.status(400).json({
      success: false,
      message: 'Network parameter is required',
    });
  }

  const gasPrice = await BlockchainService.getCurrentGasPrice(network);

  res.json({
    success: true,
    data: {
      gas_price: gasPrice,
      network,
    },
  });
}));

// @route   POST /api/blockchain/contract/deploy
// @desc    Deploy smart contract
// @access  Private
router.post('/contract/deploy', authenticate, requireTwoFactor, [
  body('private_key').notEmpty().withMessage('Private key is required'),
  body('contract_bytecode').notEmpty().withMessage('Contract bytecode is required'),
  body('network').isIn(['ethereum', 'polygon', 'bsc']).withMessage('Valid network is required'),
  body('constructor_args').optional().isArray().withMessage('Constructor args must be an array'),
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array(),
    });
  }

  const { private_key, contract_bytecode, constructor_args = [], network } = req.body;

  const result = await BlockchainService.deployContract(
    private_key,
    contract_bytecode,
    constructor_args,
    network
  );

  res.json({
    success: true,
    message: 'Contract deployed successfully',
    data: {
      contract_address: result.contractAddress,
      transaction_hash: result.txHash,
      network,
    },
  });
}));

// @route   POST /api/blockchain/contract/call
// @desc    Call smart contract method
// @access  Public
router.post('/contract/call', [
  body('contract_address').isEthereumAddress().withMessage('Valid contract address is required'),
  body('abi').isArray().withMessage('ABI must be an array'),
  body('method_name').notEmpty().withMessage('Method name is required'),
  body('args').optional().isArray().withMessage('Args must be an array'),
  body('network').isIn(['ethereum', 'polygon', 'bsc']).withMessage('Valid network is required'),
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array(),
    });
  }

  const { contract_address, abi, method_name, args = [], network } = req.body;

  const result = await BlockchainService.callContractMethod(
    contract_address,
    abi,
    method_name,
    args,
    network
  );

  res.json({
    success: true,
    data: {
      result,
      contract_address,
      method_name,
      network,
    },
  });
}));

// @route   POST /api/blockchain/contract/transaction
// @desc    Send smart contract transaction
// @access  Private
router.post('/contract/transaction', authenticate, requireTwoFactor, [
  body('private_key').notEmpty().withMessage('Private key is required'),
  body('contract_address').isEthereumAddress().withMessage('Valid contract address is required'),
  body('abi').isArray().withMessage('ABI must be an array'),
  body('method_name').notEmpty().withMessage('Method name is required'),
  body('args').optional().isArray().withMessage('Args must be an array'),
  body('network').isIn(['ethereum', 'polygon', 'bsc']).withMessage('Valid network is required'),
  body('value').optional().isFloat({ min: 0 }).withMessage('Value must be non-negative'),
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array(),
    });
  }

  const { private_key, contract_address, abi, method_name, args = [], network, value } = req.body;

  const result = await BlockchainService.sendContractTransaction(
    private_key,
    contract_address,
    abi,
    method_name,
    args,
    network,
    value
  );

  res.json({
    success: true,
    message: 'Contract transaction sent successfully',
    data: {
      transaction_hash: result.hash,
      status: result.status,
      contract_address,
      method_name,
      network,
    },
  });
}));

export default router;