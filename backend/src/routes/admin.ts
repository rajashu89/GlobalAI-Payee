import express from 'express';
import { body, validationResult } from 'express-validator';
import { authenticate, requireRole } from '@/middleware/auth';
import { asyncHandler } from '@/middleware/errorHandler';
import { db } from '@/config/database';
import { cache } from '@/config/redis';

const router = express.Router();

// All admin routes require admin role
router.use(authenticate);
router.use(requireRole(['admin']));

// @route   GET /api/admin/dashboard/stats
// @desc    Get admin dashboard statistics
// @access  Private (Admin)
router.get('/dashboard/stats', asyncHandler(async (req, res) => {
  const period = req.query.period as string || '30'; // days
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - parseInt(period));

  // Total users
  const totalUsersQuery = 'SELECT COUNT(*) as total FROM users';
  const activeUsersQuery = 'SELECT COUNT(*) as active FROM users WHERE is_active = true';
  const newUsersQuery = 'SELECT COUNT(*) as new_users FROM users WHERE created_at >= $1';

  // Total transactions
  const totalTransactionsQuery = 'SELECT COUNT(*) as total FROM transactions';
  const completedTransactionsQuery = 'SELECT COUNT(*) as completed FROM transactions WHERE status = $1';
  const transactionVolumeQuery = `
    SELECT 
      currency,
      SUM(amount) as total_volume,
      COUNT(*) as transaction_count
    FROM transactions 
    WHERE created_at >= $1 AND status = 'completed'
    GROUP BY currency
  `;

  // Revenue (assuming platform fees)
  const revenueQuery = `
    SELECT 
      currency,
      SUM(amount * 0.01) as platform_fee -- 1% platform fee
    FROM transactions 
    WHERE created_at >= $1 AND status = 'completed'
    GROUP BY currency
  `;

  // Fraud detection stats
  const fraudQuery = `
    SELECT 
      COUNT(*) as total_fraud_attempts,
      COUNT(CASE WHEN fraud_score > 0.8 THEN 1 END) as high_risk_transactions
    FROM transactions 
    WHERE created_at >= $1 AND fraud_score IS NOT NULL
  `;

  const [
    totalUsersResult,
    activeUsersResult,
    newUsersResult,
    totalTransactionsResult,
    completedTransactionsResult,
    transactionVolumeResult,
    revenueResult,
    fraudResult,
  ] = await Promise.all([
    db.query(totalUsersQuery),
    db.query(activeUsersQuery),
    db.query(newUsersQuery, [startDate]),
    db.query(totalTransactionsQuery),
    db.query(completedTransactionsQuery, ['completed']),
    db.query(transactionVolumeQuery, [startDate]),
    db.query(revenueQuery, [startDate]),
    db.query(fraudQuery, [startDate]),
  ]);

  res.json({
    success: true,
    data: {
      period_days: parseInt(period),
      users: {
        total: parseInt(totalUsersResult.rows[0].total),
        active: parseInt(activeUsersResult.rows[0].active),
        new: parseInt(newUsersResult.rows[0].new_users),
      },
      transactions: {
        total: parseInt(totalTransactionsResult.rows[0].total),
        completed: parseInt(completedTransactionsResult.rows[0].completed),
        volume_by_currency: transactionVolumeResult.rows,
      },
      revenue: {
        by_currency: revenueResult.rows,
      },
      fraud: {
        total_attempts: parseInt(fraudResult.rows[0].total_fraud_attempts),
        high_risk: parseInt(fraudResult.rows[0].high_risk_transactions),
      },
    },
  });
}));

// @route   GET /api/admin/transactions
// @desc    Get all transactions with admin details
// @access  Private (Admin)
router.get('/transactions', asyncHandler(async (req, res) => {
  const limit = parseInt(req.query.limit as string) || 50;
  const offset = parseInt(req.query.offset as string) || 0;
  const status = req.query.status as string;
  const type = req.query.type as string;
  const currency = req.query.currency as string;
  const fraudScore = req.query.fraud_score as string;

  let query = `
    SELECT 
      t.*,
      u1.email as from_email,
      u1.first_name as from_first_name,
      u1.last_name as from_last_name,
      u2.email as to_email,
      u2.first_name as to_first_name,
      u2.last_name as to_last_name
    FROM transactions t
    LEFT JOIN users u1 ON t.from_user_id = u1.id
    LEFT JOIN users u2 ON t.to_user_id = u2.id
    WHERE 1=1
  `;

  const values: any[] = [];
  let paramCount = 0;

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

  if (fraudScore) {
    paramCount++;
    query += ` AND t.fraud_score >= $${paramCount}`;
    values.push(parseFloat(fraudScore));
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

// @route   PUT /api/admin/transactions/:id/status
// @desc    Update transaction status
// @access  Private (Admin)
router.put('/transactions/:id/status', [
  body('status').isIn(['pending', 'processing', 'completed', 'failed', 'cancelled']).withMessage('Invalid status'),
  body('reason').optional().isLength({ max: 500 }).withMessage('Reason too long'),
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array(),
    });
  }

  const { status, reason } = req.body;
  const { id } = req.params;

  const query = `
    UPDATE transactions 
    SET status = $1, updated_at = CURRENT_TIMESTAMP
    WHERE id = $2
    RETURNING *
  `;

  const result = await db.query(query, [status, id]);

  if (result.rows.length === 0) {
    return res.status(404).json({
      success: false,
      message: 'Transaction not found',
    });
  }

  // Log admin action
  console.log(`Admin ${req.userId} updated transaction ${id} status to ${status}. Reason: ${reason || 'No reason provided'}`);

  res.json({
    success: true,
    message: 'Transaction status updated successfully',
    data: {
      transaction: result.rows[0],
    },
  });
}));

// @route   GET /api/admin/fraud/reports
// @desc    Get fraud detection reports
// @access  Private (Admin)
router.get('/fraud/reports', asyncHandler(async (req, res) => {
  const limit = parseInt(req.query.limit as string) || 50;
  const offset = parseInt(req.query.offset as string) || 0;
  const minScore = parseFloat(req.query.min_score as string) || 0.5;

  const query = `
    SELECT 
      t.*,
      u1.email as from_email,
      u1.first_name as from_first_name,
      u1.last_name as from_last_name,
      u2.email as to_email,
      u2.first_name as to_first_name,
      u2.last_name as to_last_name
    FROM transactions t
    LEFT JOIN users u1 ON t.from_user_id = u1.id
    LEFT JOIN users u2 ON t.to_user_id = u2.id
    WHERE t.fraud_score >= $1
    ORDER BY t.fraud_score DESC, t.created_at DESC
    LIMIT $2 OFFSET $3
  `;

  const result = await db.query(query, [minScore, limit, offset]);

  res.json({
    success: true,
    data: {
      fraud_reports: result.rows,
      pagination: {
        limit,
        offset,
        hasMore: result.rows.length === limit,
      },
    },
  });
}));

// @route   POST /api/admin/fraud/:id/investigate
// @desc    Mark fraud case as investigated
// @access  Private (Admin)
router.post('/fraud/:id/investigate', [
  body('action').isIn(['approved', 'rejected', 'flagged']).withMessage('Invalid action'),
  body('notes').optional().isLength({ max: 1000 }).withMessage('Notes too long'),
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array(),
    });
  }

  const { action, notes } = req.body;
  const { id } = req.params;

  // Update transaction with investigation result
  const query = `
    UPDATE transactions 
    SET 
      fraud_score = CASE 
        WHEN $1 = 'approved' THEN 0.0
        WHEN $1 = 'rejected' THEN 1.0
        ELSE fraud_score
      END,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = $2
    RETURNING *
  `;

  const result = await db.query(query, [action, id]);

  if (result.rows.length === 0) {
    return res.status(404).json({
      success: false,
      message: 'Transaction not found',
    });
  }

  // Log investigation
  console.log(`Admin ${req.userId} investigated fraud case ${id}. Action: ${action}. Notes: ${notes || 'No notes'}`);

  res.json({
    success: true,
    message: 'Fraud case investigated successfully',
    data: {
      transaction: result.rows[0],
      investigation: {
        action,
        notes,
        investigated_by: req.userId,
        investigated_at: new Date().toISOString(),
      },
    },
  });
}));

// @route   GET /api/admin/users/analytics
// @desc    Get user analytics
// @access  Private (Admin)
router.get('/users/analytics', asyncHandler(async (req, res) => {
  const period = req.query.period as string || '30';

  // User registration trends
  const registrationTrendsQuery = `
    SELECT 
      DATE_TRUNC('day', created_at) as date,
      COUNT(*) as new_users
    FROM users 
    WHERE created_at >= CURRENT_DATE - INTERVAL '${period} days'
    GROUP BY DATE_TRUNC('day', created_at)
    ORDER BY date
  `;

  // User activity by country
  const countryStatsQuery = `
    SELECT 
      country_code,
      COUNT(*) as user_count,
      COUNT(CASE WHEN is_active = true THEN 1 END) as active_users
    FROM users 
    GROUP BY country_code
    ORDER BY user_count DESC
  `;

  // User verification status
  const verificationStatsQuery = `
    SELECT 
      is_verified,
      COUNT(*) as count
    FROM users 
    GROUP BY is_verified
  `;

  const [registrationResult, countryResult, verificationResult] = await Promise.all([
    db.query(registrationTrendsQuery),
    db.query(countryStatsQuery),
    db.query(verificationStatsQuery),
  ]);

  res.json({
    success: true,
    data: {
      period_days: parseInt(period),
      registration_trends: registrationResult.rows,
      country_stats: countryResult.rows,
      verification_stats: verificationResult.rows,
    },
  });
}));

// @route   GET /api/admin/system/health
// @desc    Get system health status
// @access  Private (Admin)
router.get('/system/health', asyncHandler(async (req, res) => {
  // Check database connection
  const dbHealth = await db.query('SELECT 1 as healthy');
  
  // Check Redis connection
  let redisHealth = false;
  try {
    await cache.set('health_check', 'ok', 10);
    await cache.del('health_check');
    redisHealth = true;
  } catch (error) {
    console.error('Redis health check failed:', error);
  }

  // Check external services
  const externalServices = {
    exchange_rates: false,
    blockchain_ethereum: false,
    blockchain_polygon: false,
    blockchain_bsc: false,
  };

  // Test exchange rates API
  try {
    const response = await fetch('https://openexchangerates.org/api/latest.json?app_id=test');
    externalServices.exchange_rates = response.ok;
  } catch (error) {
    console.error('Exchange rates API check failed:', error);
  }

  // Test blockchain RPC endpoints
  const blockchainTests = [
    { name: 'blockchain_ethereum', url: process.env.ETHEREUM_RPC_URL },
    { name: 'blockchain_polygon', url: process.env.POLYGON_RPC_URL },
    { name: 'blockchain_bsc', url: process.env.BSC_RPC_URL },
  ];

  for (const test of blockchainTests) {
    if (test.url) {
      try {
        const response = await fetch(test.url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0',
            method: 'eth_blockNumber',
            params: [],
            id: 1,
          }),
        });
        externalServices[test.name as keyof typeof externalServices] = response.ok;
      } catch (error) {
        console.error(`${test.name} health check failed:`, error);
      }
    }
  }

  const overallHealth = dbHealth.rows[0].healthy && redisHealth && 
    Object.values(externalServices).some(status => status);

  res.json({
    success: true,
    data: {
      overall_health: overallHealth ? 'healthy' : 'degraded',
      services: {
        database: dbHealth.rows[0].healthy ? 'healthy' : 'unhealthy',
        redis: redisHealth ? 'healthy' : 'unhealthy',
        external_services: externalServices,
      },
      timestamp: new Date().toISOString(),
    },
  });
}));

// @route   POST /api/admin/system/cache/clear
// @desc    Clear system cache
// @access  Private (Admin)
router.post('/system/cache/clear', asyncHandler(async (req, res) => {
  const { pattern } = req.body;

  if (pattern) {
    // Clear specific cache pattern
    const keys = await cache.getPattern(pattern);
    for (const key of keys) {
      await cache.del(key);
    }
  } else {
    // Clear all cache (implement based on your Redis setup)
    console.log('Clearing all cache...');
  }

  res.json({
    success: true,
    message: 'Cache cleared successfully',
    data: {
      pattern: pattern || 'all',
      cleared_at: new Date().toISOString(),
    },
  });
}));

// @route   GET /api/admin/audit/logs
// @desc    Get audit logs
// @access  Private (Admin)
router.get('/audit/logs', asyncHandler(async (req, res) => {
  const limit = parseInt(req.query.limit as string) || 100;
  const offset = parseInt(req.query.offset as string) || 0;
  const action = req.query.action as string;

  // This would typically query an audit logs table
  // For now, we'll return a placeholder
  res.json({
    success: true,
    message: 'Audit logs endpoint - implement audit logging system',
    data: {
      logs: [],
      pagination: {
        limit,
        offset,
        hasMore: false,
      },
    },
  });
}));

export default router;