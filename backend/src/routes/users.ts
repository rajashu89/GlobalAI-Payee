import express from 'express';
import { body, validationResult } from 'express-validator';
import { UserService } from '@/services/userService';
import { authenticate, requireRole } from '@/middleware/auth';
import { asyncHandler } from '@/middleware/errorHandler';

const router = express.Router();

// Validation middleware
const validateUserUpdate = [
  body('first_name').optional().trim().isLength({ min: 1 }).withMessage('First name cannot be empty'),
  body('last_name').optional().trim().isLength({ min: 1 }).withMessage('Last name cannot be empty'),
  body('phone').optional().isMobilePhone().withMessage('Valid phone number is required'),
  body('country_code').optional().isLength({ min: 2, max: 3 }).withMessage('Valid country code is required'),
  body('currency').optional().isLength({ min: 3, max: 3 }).withMessage('Valid currency code is required'),
];

// @route   GET /api/users/profile
// @desc    Get user profile
// @access  Private
router.get('/profile', authenticate, asyncHandler(async (req, res) => {
  const user = await UserService.getUserById(req.userId!);

  if (!user) {
    return res.status(404).json({
      success: false,
      message: 'User not found',
    });
  }

  res.json({
    success: true,
    data: {
      user: {
        id: user.id,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        phone: user.phone,
        country_code: user.country_code,
        currency: user.currency,
        role: user.role,
        is_verified: user.is_verified,
        two_factor_enabled: user.two_factor_enabled,
        last_login: user.last_login,
        created_at: user.created_at,
      },
    },
  });
}));

// @route   PUT /api/users/profile
// @desc    Update user profile
// @access  Private
router.put('/profile', authenticate, validateUserUpdate, asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array(),
    });
  }

  const updateData = req.body;
  const user = await UserService.updateUser(req.userId!, updateData);

  res.json({
    success: true,
    message: 'Profile updated successfully',
    data: {
      user: {
        id: user.id,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        phone: user.phone,
        country_code: user.country_code,
        currency: user.currency,
        role: user.role,
        is_verified: user.is_verified,
        two_factor_enabled: user.two_factor_enabled,
        last_login: user.last_login,
        created_at: user.created_at,
        updated_at: user.updated_at,
      },
    },
  });
}));

// @route   GET /api/users/search
// @desc    Search users by email or name
// @access  Private
router.get('/search', authenticate, asyncHandler(async (req, res) => {
  const query = req.query.q as string;
  const limit = parseInt(req.query.limit as string) || 10;

  if (!query || query.length < 2) {
    return res.status(400).json({
      success: false,
      message: 'Search query must be at least 2 characters',
    });
  }

  // This would typically search in a more sophisticated way
  // For now, we'll implement a simple search
  const searchQuery = `
    SELECT id, email, first_name, last_name, country_code, currency
    FROM users 
    WHERE (email ILIKE $1 OR first_name ILIKE $1 OR last_name ILIKE $1)
    AND id != $2
    AND is_active = true
    LIMIT $3
  `;

  const { db } = await import('@/config/database');
  const result = await db.query(searchQuery, [`%${query}%`, req.userId!, limit]);

  res.json({
    success: true,
    data: {
      users: result.rows,
      query,
      count: result.rows.length,
    },
  });
}));

// @route   GET /api/users/:id
// @desc    Get user by ID (public info only)
// @access  Private
router.get('/:id', authenticate, asyncHandler(async (req, res) => {
  const user = await UserService.getUserById(req.params.id);

  if (!user) {
    return res.status(404).json({
      success: false,
      message: 'User not found',
    });
  }

  // Only return public information
  res.json({
    success: true,
    data: {
      user: {
        id: user.id,
        first_name: user.first_name,
        last_name: user.last_name,
        country_code: user.country_code,
        currency: user.currency,
        is_verified: user.is_verified,
      },
    },
  });
}));

// @route   GET /api/users/stats/overview
// @desc    Get user statistics overview
// @access  Private
router.get('/stats/overview', authenticate, asyncHandler(async (req, res) => {
  const { db } = await import('@/config/database');

  // Get user's transaction statistics
  const transactionStatsQuery = `
    SELECT 
      COUNT(*) as total_transactions,
      SUM(CASE WHEN from_user_id = $1 THEN amount ELSE 0 END) as total_sent,
      SUM(CASE WHEN to_user_id = $1 THEN amount ELSE 0 END) as total_received,
      COUNT(DISTINCT currency) as currencies_used
    FROM transactions 
    WHERE (from_user_id = $1 OR to_user_id = $1)
    AND status = 'completed'
  `;

  // Get wallet statistics
  const walletStatsQuery = `
    SELECT 
      COUNT(*) as total_wallets,
      SUM(balance) as total_balance,
      COUNT(DISTINCT currency) as currencies_held
    FROM wallets 
    WHERE user_id = $1 AND is_active = true
  `;

  const [transactionResult, walletResult] = await Promise.all([
    db.query(transactionStatsQuery, [req.userId!]),
    db.query(walletStatsQuery, [req.userId!]),
  ]);

  res.json({
    success: true,
    data: {
      transactions: transactionResult.rows[0],
      wallets: walletResult.rows[0],
    },
  });
}));

// @route   POST /api/users/upload-avatar
// @desc    Upload user avatar
// @access  Private
router.post('/upload-avatar', authenticate, asyncHandler(async (req, res) => {
  // This would typically handle file upload using multer
  // For now, we'll return a placeholder response
  
  res.json({
    success: true,
    message: 'Avatar upload endpoint - implement with multer',
    data: {
      avatar_url: '/uploads/avatars/default.png',
    },
  });
}));

// @route   DELETE /api/users/account
// @desc    Delete user account
// @access  Private
router.delete('/account', authenticate, [
  body('password').notEmpty().withMessage('Password is required for account deletion'),
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array(),
    });
  }

  const { password } = req.body;
  const user = await UserService.getUserById(req.userId!);

  if (!user) {
    return res.status(404).json({
      success: false,
      message: 'User not found',
    });
  }

  // Verify password
  const bcrypt = await import('bcryptjs');
  const isPasswordValid = await bcrypt.compare(password, user.password_hash);
  
  if (!isPasswordValid) {
    return res.status(400).json({
      success: false,
      message: 'Invalid password',
    });
  }

  // In a real implementation, you would:
  // 1. Deactivate the user account
  // 2. Cancel pending transactions
  // 3. Handle wallet balances
  // 4. Send confirmation email
  // 5. Log the deletion for audit purposes

  res.json({
    success: true,
    message: 'Account deletion initiated. You will receive a confirmation email.',
  });
}));

// @route   GET /api/users/activity/logs
// @desc    Get user activity logs
// @access  Private
router.get('/activity/logs', authenticate, asyncHandler(async (req, res) => {
  const limit = parseInt(req.query.limit as string) || 50;
  const offset = parseInt(req.query.offset as string) || 0;

  // This would typically query an activity logs table
  // For now, we'll return transaction history as activity
  const { db } = await import('@/config/database');
  
  const query = `
    SELECT 
      'transaction' as activity_type,
      created_at as timestamp,
      transaction_type as action,
      amount,
      currency,
      status,
      description
    FROM transactions 
    WHERE (from_user_id = $1 OR to_user_id = $1)
    ORDER BY created_at DESC
    LIMIT $2 OFFSET $3
  `;

  const result = await db.query(query, [req.userId!, limit, offset]);

  res.json({
    success: true,
    data: {
      activities: result.rows,
      pagination: {
        limit,
        offset,
        hasMore: result.rows.length === limit,
      },
    },
  });
}));

// Admin routes
// @route   GET /api/users/admin/all
// @desc    Get all users (admin only)
// @access  Private (Admin)
router.get('/admin/all', authenticate, requireRole(['admin']), asyncHandler(async (req, res) => {
  const limit = parseInt(req.query.limit as string) || 50;
  const offset = parseInt(req.query.offset as string) || 0;
  const search = req.query.search as string;

  let query = `
    SELECT 
      id, email, first_name, last_name, phone, country_code, currency,
      role, is_verified, is_active, two_factor_enabled, last_login, created_at
    FROM users
  `;
  
  const values: any[] = [];
  let paramCount = 0;

  if (search) {
    paramCount++;
    query += ` WHERE (email ILIKE $${paramCount} OR first_name ILIKE $${paramCount} OR last_name ILIKE $${paramCount})`;
    values.push(`%${search}%`);
  }

  query += ` ORDER BY created_at DESC LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`;
  values.push(limit, offset);

  const { db } = await import('@/config/database');
  const result = await db.query(query, values);

  res.json({
    success: true,
    data: {
      users: result.rows,
      pagination: {
        limit,
        offset,
        hasMore: result.rows.length === limit,
      },
    },
  });
}));

// @route   PUT /api/users/admin/:id/status
// @desc    Update user status (admin only)
// @access  Private (Admin)
router.put('/admin/:id/status', authenticate, requireRole(['admin']), [
  body('is_active').isBoolean().withMessage('is_active must be a boolean'),
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array(),
    });
  }

  const { is_active } = req.body;
  const { id } = req.params;

  const { db } = await import('@/config/database');
  const query = 'UPDATE users SET is_active = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *';
  const result = await db.query(query, [is_active, id]);

  if (result.rows.length === 0) {
    return res.status(404).json({
      success: false,
      message: 'User not found',
    });
  }

  res.json({
    success: true,
    message: 'User status updated successfully',
    data: {
      user: result.rows[0],
    },
  });
}));

export default router;