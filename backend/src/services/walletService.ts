import { v4 as uuidv4 } from 'uuid';
import { db } from '@/config/database';
import { cache } from '@/config/redis';
import { createError } from '@/middleware/errorHandler';
import { EncryptionService } from './encryptionService';
import { ExchangeRateService } from './exchangeRateService';
import { emitToWallet } from '@/config/socket';
import QRCode from 'qrcode';

export interface Wallet {
  id: string;
  user_id: string;
  wallet_type: 'fiat' | 'crypto';
  currency: string;
  balance: number;
  address?: string;
  private_key_encrypted?: string;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface CreateWalletData {
  user_id: string;
  wallet_type: 'fiat' | 'crypto';
  currency: string;
}

export interface TransactionData {
  from_user_id: string;
  to_user_id: string;
  amount: number;
  currency: string;
  description?: string;
  location_lat?: number;
  location_lng?: number;
  location_address?: string;
}

export class WalletService {
  static async createWallet(walletData: CreateWalletData): Promise<Wallet> {
    const { user_id, wallet_type, currency } = walletData;
    const walletId = uuidv4();

    let address: string | undefined;
    let private_key_encrypted: string | undefined;

    // Generate blockchain address for crypto wallets
    if (wallet_type === 'crypto') {
      const walletInfo = await this.generateCryptoWallet(currency);
      address = walletInfo.address;
      private_key_encrypted = EncryptionService.encrypt(walletInfo.privateKey);
    }

    const query = `
      INSERT INTO wallets (id, user_id, wallet_type, currency, address, private_key_encrypted)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `;

    const values = [walletId, user_id, wallet_type, currency, address, private_key_encrypted];
    const result = await db.query(query, values);
    const wallet = result.rows[0];

    // Cache wallet data
    await cache.set(`wallet:${wallet.id}`, wallet, 3600);

    return wallet;
  }

  static async getUserWallets(userId: string): Promise<Wallet[]> {
    // Try cache first
    const cachedWallets = await cache.get(`user:${userId}:wallets`);
    if (cachedWallets) {
      return cachedWallets;
    }

    const query = 'SELECT * FROM wallets WHERE user_id = $1 AND is_active = true ORDER BY created_at DESC';
    const result = await db.query(query, [userId]);
    const wallets = result.rows;

    // Cache wallets
    await cache.set(`user:${userId}:wallets`, wallets, 1800);

    return wallets;
  }

  static async getWalletById(walletId: string): Promise<Wallet | null> {
    // Try cache first
    const cachedWallet = await cache.get(`wallet:${walletId}`);
    if (cachedWallet) {
      return cachedWallet;
    }

    const query = 'SELECT * FROM wallets WHERE id = $1';
    const result = await db.query(query, [walletId]);
    
    if (result.rows.length === 0) {
      return null;
    }

    const wallet = result.rows[0];
    
    // Cache wallet data
    await cache.set(`wallet:${wallet.id}`, wallet, 3600);
    
    return wallet;
  }

  static async getWalletBalance(walletId: string): Promise<number> {
    const wallet = await this.getWalletById(walletId);
    return wallet ? wallet.balance : 0;
  }

  static async updateBalance(walletId: string, newBalance: number): Promise<void> {
    const query = 'UPDATE wallets SET balance = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2';
    await db.query(query, [newBalance, walletId]);

    // Clear cache
    await cache.del(`wallet:${walletId}`);
    
    // Get wallet to clear user wallets cache
    const wallet = await this.getWalletById(walletId);
    if (wallet) {
      await cache.del(`user:${wallet.user_id}:wallets`);
      
      // Emit real-time update
      emitToWallet(wallet.user_id, 'balance_updated', {
        walletId,
        balance: newBalance,
        currency: wallet.currency,
      });
    }
  }

  static async transferFunds(transactionData: TransactionData): Promise<string> {
    const { from_user_id, to_user_id, amount, currency, description, location_lat, location_lng, location_address } = transactionData;

    // Get sender's wallet
    const fromWallets = await this.getUserWallets(from_user_id);
    const fromWallet = fromWallets.find(w => w.currency === currency && w.wallet_type === 'fiat');
    
    if (!fromWallet) {
      throw createError('Sender wallet not found for this currency', 404);
    }

    if (fromWallet.balance < amount) {
      throw createError('Insufficient balance', 400);
    }

    // Get or create recipient's wallet
    let toWallets = await this.getUserWallets(to_user_id);
    let toWallet = toWallets.find(w => w.currency === currency && w.wallet_type === 'fiat');
    
    if (!toWallet) {
      toWallet = await this.createWallet({
        user_id: to_user_id,
        wallet_type: 'fiat',
        currency,
      });
    }

    // Start transaction
    const client = await db.connect();
    try {
      await client.query('BEGIN');

      // Create transaction record
      const transactionId = uuidv4();
      const transactionQuery = `
        INSERT INTO transactions (
          id, from_user_id, to_user_id, from_wallet_id, to_wallet_id,
          amount, currency, transaction_type, status, description,
          location_lat, location_lng, location_address
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'send', 'processing', $8, $9, $10, $11)
        RETURNING id
      `;

      const transactionValues = [
        transactionId, from_user_id, to_user_id, fromWallet.id, toWallet.id,
        amount, currency, description, location_lat, location_lng, location_address
      ];

      const transactionResult = await client.query(transactionQuery, transactionValues);

      // Update balances
      await client.query(
        'UPDATE wallets SET balance = balance - $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
        [amount, fromWallet.id]
      );

      await client.query(
        'UPDATE wallets SET balance = balance + $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
        [amount, toWallet.id]
      );

      // Update transaction status
      await client.query(
        'UPDATE transactions SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
        ['completed', transactionId]
      );

      await client.query('COMMIT');

      // Clear caches
      await cache.del(`wallet:${fromWallet.id}`);
      await cache.del(`wallet:${toWallet.id}`);
      await cache.del(`user:${from_user_id}:wallets`);
      await cache.del(`user:${to_user_id}:wallets`);

      // Emit real-time updates
      emitToWallet(from_user_id, 'transaction_completed', {
        transactionId,
        type: 'send',
        amount,
        currency,
        toUserId: to_user_id,
      });

      emitToWallet(to_user_id, 'transaction_completed', {
        transactionId,
        type: 'receive',
        amount,
        currency,
        fromUserId: from_user_id,
      });

      return transactionId;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  static async generateQRCode(userId: string, amount: number, currency: string, description?: string): Promise<string> {
    const qrData = {
      userId,
      amount,
      currency,
      description,
      timestamp: new Date().toISOString(),
      type: 'payment_request',
    };

    const qrCodeString = JSON.stringify(qrData);
    const qrCodeImage = await QRCode.toDataURL(qrCodeString, {
      width: 300,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#FFFFFF',
      },
    });

    return qrCodeImage;
  }

  static async processQRPayment(qrData: string, payerUserId: string): Promise<string> {
    try {
      const paymentData = JSON.parse(qrData);
      
      if (paymentData.type !== 'payment_request') {
        throw createError('Invalid QR code type', 400);
      }

      // Check if QR code is not expired (5 minutes)
      const qrTimestamp = new Date(paymentData.timestamp);
      const now = new Date();
      const timeDiff = now.getTime() - qrTimestamp.getTime();
      
      if (timeDiff > 5 * 60 * 1000) { // 5 minutes
        throw createError('QR code has expired', 400);
      }

      // Process the payment
      const transactionId = await this.transferFunds({
        from_user_id: payerUserId,
        to_user_id: paymentData.userId,
        amount: paymentData.amount,
        currency: paymentData.currency,
        description: paymentData.description || 'QR Code Payment',
      });

      return transactionId;
    } catch (error) {
      if (error instanceof SyntaxError) {
        throw createError('Invalid QR code format', 400);
      }
      throw error;
    }
  }

  static async getWalletHistory(walletId: string, limit: number = 50, offset: number = 0): Promise<any[]> {
    const query = `
      SELECT 
        t.*,
        u1.first_name as from_first_name,
        u1.last_name as from_last_name,
        u2.first_name as to_first_name,
        u2.last_name as to_last_name
      FROM transactions t
      LEFT JOIN users u1 ON t.from_user_id = u1.id
      LEFT JOIN users u2 ON t.to_user_id = u2.id
      WHERE t.from_wallet_id = $1 OR t.to_wallet_id = $1
      ORDER BY t.created_at DESC
      LIMIT $2 OFFSET $3
    `;

    const result = await db.query(query, [walletId, limit, offset]);
    return result.rows;
  }

  static async convertCurrency(fromCurrency: string, toCurrency: string, amount: number): Promise<{ convertedAmount: number; rate: number }> {
    if (fromCurrency === toCurrency) {
      return { convertedAmount: amount, rate: 1 };
    }

    const rate = await ExchangeRateService.getExchangeRate(fromCurrency, toCurrency);
    const convertedAmount = amount * rate;

    return { convertedAmount, rate };
  }

  private static async generateCryptoWallet(currency: string): Promise<{ address: string; privateKey: string }> {
    // This is a simplified implementation
    // In production, use proper crypto libraries like ethers.js or web3.js
    
    const address = `0x${Math.random().toString(16).substr(2, 40)}`;
    const privateKey = `0x${Math.random().toString(16).substr(2, 64)}`;
    
    return { address, privateKey };
  }
}