import express from 'express';
import { body, validationResult } from 'express-validator';
import { db } from '@/config/database';
import { authenticate } from '@/middleware/auth';
import { asyncHandler } from '@/middleware/errorHandler';

const router = express.Router();

// @route   GET /api/transactions
// @desc    Get user's transactions
// @access  Private
router.get('/', authenticate, asyncHandler(async (req, res) => {
  const limit = parseInt(req.query.limit as string) || 50;
  const offset = parseInt(req.query.offset as string) || 0;
  const status = req.query.status as string;
  const type = req.query.type as string;
  const currency = req.query.currency as string;

  let query = `
    SELECT 
      t.*,
      u1.first_name as from_first_name,
      u1.last_name as from_last_name,
      u2.first_name as to_first_name,
      u2.last_name as to_last_name,
      w1.currency as from_currency,
      w2.currency as to_currency
    FROM transactions t
    LEFT JOIN users u1 ON t.from_user_id = u1.id
    LEFT JOIN users u2 ON t.to_user_id = u2.id
    LEFT JOIN wallets w1 ON t.from_wallet_id = w1.id
    LEFT JOIN wallets w2 ON t.to_wallet_id = w2.id
    WHERE (t.from_user_id = $1 OR t.to_user_id = $1)
  `;

  const values: any[] = [req.userId!];
  let paramCount = 1;

  if (status) {
    paramCount++;
    query += ` AND t.status = $${paramCount}`;
    values.push(status);
  }

  if (type) {
    paramCount++;
    query += ` AND t.transaction_type = $${paramCount}`;
    values.push(type);
  }

  if (currency) {
    paramCount++;
    query += ` AND t.currency = $${paramCount}`;
    values.push(currency);
  }

  query += ` ORDER BY t.created_at DESC LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`;
  values.push(limit, offset);

  const result = await db.query(query, values);

  res.json({
    success: true,
    data: {
      transactions: result.rows,
      pagination: {
        limit,
        offset,
        hasMore: result.rows.length === limit,
      },
    },
  });
}));

// @route   GET /api/transactions/:id
// @desc    Get transaction details
// @access  Private
router.get('/:id', authenticate, asyncHandler(async (req, res) => {
  const query = `
    SELECT 
      t.*,
      u1.first_name as from_first_name,
      u1.last_name as from_last_name,
      u1.email as from_email,
      u2.first_name as to_first_name,
      u2.last_name as to_last_name,
      u2.email as to_email,
      w1.currency as from_currency,
      w2.currency as to_currency
    FROM transactions t
    LEFT JOIN users u1 ON t.from_user_id = u1.id
    LEFT JOIN users u2 ON t.to_user_id = u2.id
    LEFT JOIN wallets w1 ON t.from_wallet_id = w1.id
    LEFT JOIN wallets w2 ON t.to_wallet_id = w2.id
    WHERE t.id = $1 AND (t.from_user_id = $2 OR t.to_user_id = $2)
  `;

  const result = await db.query(query, [req.params.id, req.userId!]);

  if (result.rows.length === 0) {
    return res.status(404).json({
      success: false,
      message: 'Transaction not found',
    });
  }

  res.json({
    success: true,
    data: {
      transaction: result.rows[0],
    },
  });
}));

// @route   GET /api/transactions/stats/summary
// @desc    Get transaction statistics
// @access  Private
router.get('/stats/summary', authenticate, asyncHandler(async (req, res) => {
  const period = req.query.period as string || '30'; // days
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - parseInt(period));

  // Total transactions
  const totalQuery = `
    SELECT COUNT(*) as total_count
    FROM transactions 
    WHERE (from_user_id = $1 OR to_user_id = $1) 
    AND created_at >= $2
  `;

  // Total volume
  const volumeQuery = `
    SELECT 
      currency,
      SUM(CASE WHEN from_user_id = $1 THEN -amount ELSE amount END) as net_amount,
      SUM(amount) as total_volume
    FROM transactions 
    WHERE (from_user_id = $1 OR to_user_id = $1) 
    AND created_at >= $2
    GROUP BY currency
  `;

  // Transaction types
  const typesQuery = `
    SELECT 
      transaction_type,
      COUNT(*) as count,
      SUM(amount) as total_amount
    FROM transactions 
    WHERE (from_user_id = $1 OR to_user_id = $1) 
    AND created_at >= $2
    GROUP BY transaction_type
  `;

  // Recent transactions
  const recentQuery = `
    SELECT 
      t.*,
      u1.first_name as from_first_name,
      u1.last_name as from_last_name,
      u2.first_name as to_first_name,
      u2.last_name as to_last_name
    FROM transactions t
    LEFT JOIN users u1 ON t.from_user_id = u1.id
    LEFT JOIN users u2 ON t.to_user_id = u2.id
    WHERE (t.from_user_id = $1 OR t.to_user_id = $1) 
    AND t.created_at >= $2
    ORDER BY t.created_at DESC
    LIMIT 10
  `;

  const [totalResult, volumeResult, typesResult, recentResult] = await Promise.all([
    db.query(totalQuery, [req.userId!, startDate]),
    db.query(volumeQuery, [req.userId!, startDate]),
    db.query(typesQuery, [req.userId!, startDate]),
    db.query(recentQuery, [req.userId!, startDate]),
  ]);

  res.json({
    success: true,
    data: {
      summary: {
        total_transactions: parseInt(totalResult.rows[0].total_count),
        period_days: parseInt(period),
        start_date: startDate.toISOString(),
        end_date: new Date().toISOString(),
      },
      volume_by_currency: volumeResult.rows,
      transactions_by_type: typesResult.rows,
      recent_transactions: recentResult.rows,
    },
  });
}));

// @route   GET /api/transactions/stats/monthly
// @desc    Get monthly transaction statistics
// @access  Private
router.get('/stats/monthly', authenticate, asyncHandler(async (req, res) => {
  const months = parseInt(req.query.months as string) || 12;

  const query = `
    SELECT 
      DATE_TRUNC('month', created_at) as month,
      COUNT(*) as transaction_count,
      SUM(amount) as total_volume,
      currency,
      transaction_type
    FROM transactions 
    WHERE (from_user_id = $1 OR to_user_id = $1) 
    AND created_at >= CURRENT_DATE - INTERVAL '${months} months'
    GROUP BY DATE_TRUNC('month', created_at), currency, transaction_type
    ORDER BY month DESC
  `;

  const result = await db.query(query, [req.userId!]);

  res.json({
    success: true,
    data: {
      monthly_stats: result.rows,
      period_months: months,
    },
  });
}));

// @route   POST /api/transactions/:id/cancel
// @desc    Cancel a pending transaction
// @access  Private
router.post('/:id/cancel', authenticate, asyncHandler(async (req, res) => {
  const query = `
    UPDATE transactions 
    SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP 
    WHERE id = $1 AND from_user_id = $2 AND status = 'pending'
    RETURNING *
  `;

  const result = await db.query(query, [req.params.id, req.userId!]);

  if (result.rows.length === 0) {
    return res.status(404).json({
      success: false,
      message: 'Transaction not found or cannot be cancelled',
    });
  }

  res.json({
    success: true,
    message: 'Transaction cancelled successfully',
    data: {
      transaction: result.rows[0],
    },
  });
}));

// @route   POST /api/transactions/:id/dispute
// @desc    Create a dispute for a transaction
// @access  Private
router.post('/:id/dispute', authenticate, [
  body('reason').notEmpty().withMessage('Dispute reason is required'),
  body('description').optional().isLength({ max: 1000 }).withMessage('Description too long'),
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array(),
    });
  }

  const { reason, description } = req.body;

  // Check if transaction exists and user is involved
  const transactionQuery = `
    SELECT * FROM transactions 
    WHERE id = $1 AND (from_user_id = $2 OR to_user_id = $2)
  `;

  const transactionResult = await db.query(transactionQuery, [req.params.id, req.userId!]);

  if (transactionResult.rows.length === 0) {
    return res.status(404).json({
      success: false,
      message: 'Transaction not found',
    });
  }

  const transaction = transactionResult.rows[0];

  // Create dispute record (you might want to create a separate disputes table)
  const disputeQuery = `
    INSERT INTO transaction_disputes (transaction_id, user_id, reason, description, status, created_at)
    VALUES ($1, $2, $3, $4, 'pending', CURRENT_TIMESTAMP)
    RETURNING *
  `;

  const disputeResult = await db.query(disputeQuery, [req.params.id, req.userId!, reason, description]);

  res.json({
    success: true,
    message: 'Dispute created successfully',
    data: {
      dispute: disputeResult.rows[0],
    },
  });
}));

// @route   GET /api/transactions/search
// @desc    Search transactions
// @access  Private
router.get('/search', authenticate, asyncHandler(async (req, res) => {
  const query = req.query.q as string;
  const limit = parseInt(req.query.limit as string) || 20;

  if (!query || query.length < 2) {
    return res.status(400).json({
      success: false,
      message: 'Search query must be at least 2 characters',
    });
  }

  const searchQuery = `
    SELECT 
      t.*,
      u1.first_name as from_first_name,
      u1.last_name as from_last_name,
      u2.first_name as to_first_name,
      u2.last_name as to_last_name
    FROM transactions t
    LEFT JOIN users u1 ON t.from_user_id = u1.id
    LEFT JOIN users u2 ON t.to_user_id = u2.id
    WHERE (t.from_user_id = $1 OR t.to_user_id = $1)
    AND (
      t.description ILIKE $2 OR
      u1.first_name ILIKE $2 OR
      u1.last_name ILIKE $2 OR
      u2.first_name ILIKE $2 OR
      u2.last_name ILIKE $2 OR
      t.id::text ILIKE $2
    )
    ORDER BY t.created_at DESC
    LIMIT $3
  `;

  const result = await db.query(searchQuery, [req.userId!, `%${query}%`, limit]);

  res.json({
    success: true,
    data: {
      transactions: result.rows,
      query,
      count: result.rows.length,
    },
  });
}));

export default router;