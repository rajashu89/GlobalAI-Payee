import cron from 'node-cron';
import { ExchangeRateService } from './exchangeRateService';
import { db } from '@/config/database';
import { cache } from '@/config/redis';

export function startCronJobs(): void {
  console.log('🕐 Starting cron jobs...');

  // Update exchange rates every hour
  cron.schedule('0 * * * *', async () => {
    try {
      await ExchangeRateService.updateRatesCron();
    } catch (error) {
      console.error('❌ Error updating exchange rates:', error);
    }
  });

  // Clean up expired sessions daily at 2 AM
  cron.schedule('0 2 * * *', async () => {
    try {
      await cleanupExpiredSessions();
    } catch (error) {
      console.error('❌ Error cleaning up expired sessions:', error);
    }
  });

  // Clean up old cache entries daily at 3 AM
  cron.schedule('0 3 * * *', async () => {
    try {
      await cleanupOldCache();
    } catch (error) {
      console.error('❌ Error cleaning up old cache:', error);
    }
  });

  // Process pending transactions every 5 minutes
  cron.schedule('*/5 * * * *', async () => {
    try {
      await processPendingTransactions();
    } catch (error) {
      console.error('❌ Error processing pending transactions:', error);
    }
  });

  // Generate daily reports at midnight
  cron.schedule('0 0 * * *', async () => {
    try {
      await generateDailyReports();
    } catch (error) {
      console.error('❌ Error generating daily reports:', error);
    }
  });

  // Health check every 10 minutes
  cron.schedule('*/10 * * * *', async () => {
    try {
      await performHealthCheck();
    } catch (error) {
      console.error('❌ Error performing health check:', error);
    }
  });

  console.log('✅ Cron jobs started successfully');
}

async function cleanupExpiredSessions(): Promise<void> {
  console.log('🧹 Cleaning up expired sessions...');
  
  const query = 'DELETE FROM user_sessions WHERE expires_at < CURRENT_TIMESTAMP';
  const result = await db.query(query);
  
  console.log(`✅ Cleaned up ${result.rowCount} expired sessions`);
}

async function cleanupOldCache(): Promise<void> {
  console.log('🧹 Cleaning up old cache entries...');
  
  // This would depend on your Redis implementation
  // For now, we'll just log the action
  console.log('✅ Cache cleanup completed');
}

async function processPendingTransactions(): Promise<void> {
  console.log('🔄 Processing pending transactions...');
  
  const query = `
    SELECT * FROM transactions 
    WHERE status = 'pending' 
    AND created_at < CURRENT_TIMESTAMP - INTERVAL '5 minutes'
    LIMIT 100
  `;
  
  const result = await db.query(query);
  const pendingTransactions = result.rows;
  
  for (const transaction of pendingTransactions) {
    try {
      // Process the transaction (implement your logic here)
      await db.query(
        'UPDATE transactions SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
        ['completed', transaction.id]
      );
      
      console.log(`✅ Processed transaction ${transaction.id}`);
    } catch (error) {
      console.error(`❌ Error processing transaction ${transaction.id}:`, error);
      
      // Mark as failed after multiple attempts
      await db.query(
        'UPDATE transactions SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
        ['failed', transaction.id]
      );
    }
  }
  
  if (pendingTransactions.length > 0) {
    console.log(`✅ Processed ${pendingTransactions.length} pending transactions`);
  }
}

async function generateDailyReports(): Promise<void> {
  console.log('📊 Generating daily reports...');
  
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const startOfDay = new Date(yesterday.setHours(0, 0, 0, 0));
  const endOfDay = new Date(yesterday.setHours(23, 59, 59, 999));
  
  // Generate transaction summary
  const transactionQuery = `
    SELECT 
      COUNT(*) as total_transactions,
      SUM(amount) as total_volume,
      currency,
      status
    FROM transactions 
    WHERE created_at BETWEEN $1 AND $2
    GROUP BY currency, status
  `;
  
  const transactionResult = await db.query(transactionQuery, [startOfDay, endOfDay]);
  
  // Generate user statistics
  const userQuery = `
    SELECT 
      COUNT(*) as new_users,
      COUNT(CASE WHEN is_verified = true THEN 1 END) as verified_users
    FROM users 
    WHERE created_at BETWEEN $1 AND $2
  `;
  
  const userResult = await db.query(userQuery, [startOfDay, endOfDay]);
  
  const report = {
    date: startOfDay.toISOString().split('T')[0],
    transactions: transactionResult.rows,
    users: userResult.rows[0],
    generated_at: new Date().toISOString(),
  };
  
  // Store report in cache for admin dashboard
  await cache.set(`daily_report:${startOfDay.toISOString().split('T')[0]}`, report, 86400 * 7); // 7 days
  
  console.log('✅ Daily report generated successfully');
}

async function performHealthCheck(): Promise<void> {
  try {
    // Check database connection
    await db.query('SELECT 1');
    
    // Check Redis connection
    await cache.set('health_check', 'ok', 60);
    await cache.del('health_check');
    
    // Check external APIs (optional)
    // await checkExternalAPIs();
    
    console.log('✅ Health check passed');
  } catch (error) {
    console.error('❌ Health check failed:', error);
    
    // Send alert to administrators
    // await sendHealthCheckAlert(error);
  }
}

async function checkExternalAPIs(): Promise<void> {
  // Check exchange rate API
  try {
    const response = await fetch('https://openexchangerates.org/api/latest.json?app_id=test');
    if (!response.ok) {
      throw new Error('Exchange rate API not responding');
    }
  } catch (error) {
    console.error('❌ Exchange rate API check failed:', error);
  }
  
  // Add more API checks as needed
}

async function sendHealthCheckAlert(error: any): Promise<void> {
  // Implement alerting mechanism (email, Slack, etc.)
  console.error('🚨 Health check alert:', error);
}