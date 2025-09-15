import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { db } from '@/config/database';
import { cache } from '@/config/redis';
import { createError } from '@/middleware/errorHandler';
import { EncryptionService } from './encryptionService';
import { EmailService } from './emailService';
import { SmsService } from './smsService';

export interface User {
  id: string;
  email: string;
  password_hash: string;
  first_name: string;
  last_name: string;
  phone?: string;
  country_code: string;
  currency: string;
  role: string;
  is_verified: boolean;
  is_active: boolean;
  two_factor_enabled: boolean;
  two_factor_secret?: string;
  last_login?: Date;
  created_at: Date;
  updated_at: Date;
}

export interface CreateUserData {
  email: string;
  password: string;
  first_name: string;
  last_name: string;
  phone?: string;
  country_code?: string;
  currency?: string;
}

export class UserService {
  private static readonly SALT_ROUNDS = 12;
  private static readonly JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

  static async createUser(userData: CreateUserData): Promise<User> {
    const { email, password, first_name, last_name, phone, country_code = 'US', currency = 'USD' } = userData;

    // Check if user already exists
    const existingUser = await this.getUserByEmail(email);
    if (existingUser) {
      throw createError('User with this email already exists', 400);
    }

    // Hash password
    const password_hash = await bcrypt.hash(password, this.SALT_ROUNDS);

    // Generate user ID
    const userId = uuidv4();

    // Insert user into database
    const query = `
      INSERT INTO users (id, email, password_hash, first_name, last_name, phone, country_code, currency)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `;

    const values = [userId, email, password_hash, first_name, last_name, phone, country_code, currency];
    const result = await db.query(query, values);
    const user = result.rows[0];

    // Create default wallet for user
    await this.createDefaultWallet(userId, currency);

    // Send verification email
    await EmailService.sendVerificationEmail(email, user.id);

    // Cache user data
    await cache.set(`user:${user.id}`, user, 3600);

    return user;
  }

  static async getUserById(id: string): Promise<User | null> {
    // Try cache first
    const cachedUser = await cache.get(`user:${id}`);
    if (cachedUser) {
      return cachedUser;
    }

    const query = 'SELECT * FROM users WHERE id = $1';
    const result = await db.query(query, [id]);
    
    if (result.rows.length === 0) {
      return null;
    }

    const user = result.rows[0];
    
    // Cache user data
    await cache.set(`user:${user.id}`, user, 3600);
    
    return user;
  }

  static async getUserByEmail(email: string): Promise<User | null> {
    const query = 'SELECT * FROM users WHERE email = $1';
    const result = await db.query(query, [email]);
    
    if (result.rows.length === 0) {
      return null;
    }

    return result.rows[0];
  }

  static async authenticateUser(email: string, password: string): Promise<{ user: User; token: string }> {
    const user = await this.getUserByEmail(email);
    
    if (!user) {
      throw createError('Invalid email or password', 401);
    }

    if (!user.is_active) {
      throw createError('Account is deactivated', 401);
    }

    const isPasswordValid = await bcrypt.compare(password, user.password_hash);
    if (!isPasswordValid) {
      throw createError('Invalid email or password', 401);
    }

    // Update last login
    await this.updateLastLogin(user.id);

    // Generate JWT token
    const token = jwt.sign(
      { userId: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET!,
      { expiresIn: this.JWT_EXPIRES_IN }
    );

    return { user, token };
  }

  static async updateLastLogin(userId: string): Promise<void> {
    const query = 'UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = $1';
    await db.query(query, [userId]);
    
    // Update cache
    const user = await this.getUserById(userId);
    if (user) {
      await cache.set(`user:${userId}`, user, 3600);
    }
  }

  static async updateUser(userId: string, updateData: Partial<User>): Promise<User> {
    const allowedFields = ['first_name', 'last_name', 'phone', 'country_code', 'currency'];
    const updates: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    for (const [key, value] of Object.entries(updateData)) {
      if (allowedFields.includes(key) && value !== undefined) {
        updates.push(`${key} = $${paramCount}`);
        values.push(value);
        paramCount++;
      }
    }

    if (updates.length === 0) {
      throw createError('No valid fields to update', 400);
    }

    updates.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(userId);

    const query = `
      UPDATE users 
      SET ${updates.join(', ')} 
      WHERE id = $${paramCount}
      RETURNING *
    `;

    const result = await db.query(query, values);
    const user = result.rows[0];

    // Update cache
    await cache.set(`user:${userId}`, user, 3600);

    return user;
  }

  static async updateUserLocation(userId: string, location: { lat: number; lng: number; address?: string }): Promise<void> {
    // This would typically update a user_locations table
    // For now, we'll just cache the location
    await cache.set(`user:${userId}:location`, location, 1800); // 30 minutes
  }

  static async enableTwoFactor(userId: string): Promise<{ secret: string; qrCode: string }> {
    const secret = this.generateTwoFactorSecret();
    
    const query = 'UPDATE users SET two_factor_secret = $1, two_factor_enabled = true WHERE id = $2';
    await db.query(query, [secret, userId]);

    // Generate QR code for authenticator app
    const qrCode = await this.generateTwoFactorQRCode(userId, secret);

    // Update cache
    const user = await this.getUserById(userId);
    if (user) {
      await cache.set(`user:${userId}`, user, 3600);
    }

    return { secret, qrCode };
  }

  static async verifyTwoFactorToken(userId: string, token: string): Promise<boolean> {
    const user = await this.getUserById(userId);
    if (!user || !user.two_factor_secret) {
      return false;
    }

    // Implement TOTP verification (simplified)
    // In production, use a proper TOTP library like 'speakeasy'
    const expectedToken = this.generateTOTP(user.two_factor_secret);
    return token === expectedToken;
  }

  static async changePassword(userId: string, currentPassword: string, newPassword: string): Promise<void> {
    const user = await this.getUserById(userId);
    if (!user) {
      throw createError('User not found', 404);
    }

    const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password_hash);
    if (!isCurrentPasswordValid) {
      throw createError('Current password is incorrect', 400);
    }

    const newPasswordHash = await bcrypt.hash(newPassword, this.SALT_ROUNDS);
    
    const query = 'UPDATE users SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2';
    await db.query(query, [newPasswordHash, userId]);

    // Clear cache
    await cache.del(`user:${userId}`);
  }

  static async resetPassword(email: string): Promise<void> {
    const user = await this.getUserByEmail(email);
    if (!user) {
      // Don't reveal if email exists
      return;
    }

    const resetToken = uuidv4();
    const resetExpiry = new Date(Date.now() + 3600000); // 1 hour

    // Store reset token (in production, use a separate table)
    await cache.set(`password_reset:${resetToken}`, user.id, 3600);

    // Send reset email
    await EmailService.sendPasswordResetEmail(email, resetToken);
  }

  static async confirmPasswordReset(token: string, newPassword: string): Promise<void> {
    const userId = await cache.get(`password_reset:${token}`);
    if (!userId) {
      throw createError('Invalid or expired reset token', 400);
    }

    const newPasswordHash = await bcrypt.hash(newPassword, this.SALT_ROUNDS);
    
    const query = 'UPDATE users SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2';
    await db.query(query, [newPasswordHash, userId]);

    // Clear reset token and user cache
    await cache.del(`password_reset:${token}`);
    await cache.del(`user:${userId}`);
  }

  static async verifyEmail(userId: string): Promise<void> {
    const query = 'UPDATE users SET is_verified = true, updated_at = CURRENT_TIMESTAMP WHERE id = $1';
    await db.query(query, [userId]);

    // Update cache
    const user = await this.getUserById(userId);
    if (user) {
      await cache.set(`user:${userId}`, user, 3600);
    }
  }

  private static async createDefaultWallet(userId: string, currency: string): Promise<void> {
    const walletId = uuidv4();
    const query = `
      INSERT INTO wallets (id, user_id, wallet_type, currency, balance)
      VALUES ($1, $2, 'fiat', $3, 0)
    `;
    await db.query(query, [walletId, userId, currency]);
  }

  private static generateTwoFactorSecret(): string {
    // Generate a random secret for TOTP
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  }

  private static generateTwoFactorQRCode(userId: string, secret: string): string {
    // Generate QR code data for authenticator app
    const issuer = 'GlobalAi Payee';
    const accountName = userId;
    const qrData = `otpauth://totp/${issuer}:${accountName}?secret=${secret}&issuer=${issuer}`;
    return qrData;
  }

  private static generateTOTP(secret: string): string {
    // Simplified TOTP generation (use proper library in production)
    const time = Math.floor(Date.now() / 1000 / 30);
    const hash = require('crypto').createHmac('sha1', secret).update(time.toString()).digest('hex');
    const offset = parseInt(hash.slice(-1), 16);
    const code = (parseInt(hash.substr(offset * 2, 8), 16) & 0x7fffffff) % 1000000;
    return code.toString().padStart(6, '0');
  }
}