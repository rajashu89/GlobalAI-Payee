import express from 'express';
import { body, validationResult } from 'express-validator';
import { WalletService } from '@/services/walletService';
import { authenticate, requireTwoFactor } from '@/middleware/auth';
import { asyncHandler } from '@/middleware/errorHandler';

const router = express.Router();

// Validation middleware
const validateTransfer = [
  body('to_user_id').isUUID().withMessage('Valid recipient user ID is required'),
  body('amount').isFloat({ min: 0.01 }).withMessage('Amount must be greater than 0'),
  body('currency').isLength({ min: 3, max: 3 }).withMessage('Valid currency code is required'),
  body('description').optional().isLength({ max: 500 }).withMessage('Description too long'),
];

const validateQRPayment = [
  body('qr_data').notEmpty().withMessage('QR code data is required'),
];

// @route   GET /api/wallet
// @desc    Get user's wallets
// @access  Private
router.get('/', authenticate, asyncHandler(async (req, res) => {
  const wallets = await WalletService.getUserWallets(req.userId!);

  res.json({
    success: true,
    data: {
      wallets: wallets.map(wallet => ({
        id: wallet.id,
        wallet_type: wallet.wallet_type,
        currency: wallet.currency,
        balance: wallet.balance,
        address: wallet.address,
        is_active: wallet.is_active,
        created_at: wallet.created_at,
      })),
    },
  });
}));

// @route   POST /api/wallet
// @desc    Create a new wallet
// @access  Private
router.post('/', authenticate, [
  body('wallet_type').isIn(['fiat', 'crypto']).withMessage('Wallet type must be fiat or crypto'),
  body('currency').isLength({ min: 3, max: 10 }).withMessage('Valid currency is required'),
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array(),
    });
  }

  const { wallet_type, currency } = req.body;

  const wallet = await WalletService.createWallet({
    user_id: req.userId!,
    wallet_type,
    currency,
  });

  res.status(201).json({
    success: true,
    message: 'Wallet created successfully',
    data: {
      wallet: {
        id: wallet.id,
        wallet_type: wallet.wallet_type,
        currency: wallet.currency,
        balance: wallet.balance,
        address: wallet.address,
        is_active: wallet.is_active,
        created_at: wallet.created_at,
      },
    },
  });
}));

// @route   GET /api/wallet/:id
// @desc    Get wallet details
// @access  Private
router.get('/:id', authenticate, asyncHandler(async (req, res) => {
  const wallet = await WalletService.getWalletById(req.params.id);

  if (!wallet) {
    return res.status(404).json({
      success: false,
      message: 'Wallet not found',
    });
  }

  // Check if user owns this wallet
  if (wallet.user_id !== req.userId) {
    return res.status(403).json({
      success: false,
      message: 'Access denied',
    });
  }

  res.json({
    success: true,
    data: {
      wallet: {
        id: wallet.id,
        wallet_type: wallet.wallet_type,
        currency: wallet.currency,
        balance: wallet.balance,
        address: wallet.address,
        is_active: wallet.is_active,
        created_at: wallet.created_at,
        updated_at: wallet.updated_at,
      },
    },
  });
}));

// @route   GET /api/wallet/:id/balance
// @desc    Get wallet balance
// @access  Private
router.get('/:id/balance', authenticate, asyncHandler(async (req, res) => {
  const wallet = await WalletService.getWalletById(req.params.id);

  if (!wallet) {
    return res.status(404).json({
      success: false,
      message: 'Wallet not found',
    });
  }

  // Check if user owns this wallet
  if (wallet.user_id !== req.userId) {
    return res.status(403).json({
      success: false,
      message: 'Access denied',
    });
  }

  res.json({
    success: true,
    data: {
      balance: wallet.balance,
      currency: wallet.currency,
    },
  });
}));

// @route   GET /api/wallet/:id/history
// @desc    Get wallet transaction history
// @access  Private
router.get('/:id/history', authenticate, asyncHandler(async (req, res) => {
  const wallet = await WalletService.getWalletById(req.params.id);

  if (!wallet) {
    return res.status(404).json({
      success: false,
      message: 'Wallet not found',
    });
  }

  // Check if user owns this wallet
  if (wallet.user_id !== req.userId) {
    return res.status(403).json({
      success: false,
      message: 'Access denied',
    });
  }

  const limit = parseInt(req.query.limit as string) || 50;
  const offset = parseInt(req.query.offset as string) || 0;

  const history = await WalletService.getWalletHistory(req.params.id, limit, offset);

  res.json({
    success: true,
    data: {
      transactions: history,
      pagination: {
        limit,
        offset,
        hasMore: history.length === limit,
      },
    },
  });
}));

// @route   POST /api/wallet/transfer
// @desc    Transfer funds between users
// @access  Private
router.post('/transfer', authenticate, requireTwoFactor, validateTransfer, asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array(),
    });
  }

  const { to_user_id, amount, currency, description, location_lat, location_lng, location_address } = req.body;

  const transactionId = await WalletService.transferFunds({
    from_user_id: req.userId!,
    to_user_id,
    amount,
    currency,
    description,
    location_lat,
    location_lng,
    location_address,
  });

  res.json({
    success: true,
    message: 'Transfer completed successfully',
    data: {
      transaction_id: transactionId,
    },
  });
}));

// @route   POST /api/wallet/generate-qr
// @desc    Generate QR code for payment
// @access  Private
router.post('/generate-qr', authenticate, [
  body('amount').isFloat({ min: 0.01 }).withMessage('Amount must be greater than 0'),
  body('currency').isLength({ min: 3, max: 3 }).withMessage('Valid currency code is required'),
  body('description').optional().isLength({ max: 500 }).withMessage('Description too long'),
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array(),
    });
  }

  const { amount, currency, description } = req.body;

  const qrCode = await WalletService.generateQRCode(req.userId!, amount, currency, description);

  res.json({
    success: true,
    data: {
      qr_code: qrCode,
      expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(), // 5 minutes
    },
  });
}));

// @route   POST /api/wallet/scan-qr
// @desc    Process QR code payment
// @access  Private
router.post('/scan-qr', authenticate, requireTwoFactor, validateQRPayment, asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array(),
    });
  }

  const { qr_data } = req.body;

  const transactionId = await WalletService.processQRPayment(qr_data, req.userId!);

  res.json({
    success: true,
    message: 'Payment processed successfully',
    data: {
      transaction_id: transactionId,
    },
  });
}));

// @route   POST /api/wallet/convert-currency
// @desc    Convert currency amount
// @access  Private
router.post('/convert-currency', authenticate, [
  body('from_currency').isLength({ min: 3, max: 3 }).withMessage('Valid from currency is required'),
  body('to_currency').isLength({ min: 3, max: 3 }).withMessage('Valid to currency is required'),
  body('amount').isFloat({ min: 0.01 }).withMessage('Amount must be greater than 0'),
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array(),
    });
  }

  const { from_currency, to_currency, amount } = req.body;

  const conversion = await WalletService.convertCurrency(from_currency, to_currency, amount);

  res.json({
    success: true,
    data: {
      original_amount: amount,
      converted_amount: conversion.convertedAmount,
      exchange_rate: conversion.rate,
      from_currency,
      to_currency,
    },
  });
}));

export default router;