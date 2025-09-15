import nodemailer from 'nodemailer';

export class EmailService {
  private static transporter = nodemailer.createTransporter({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  static async sendVerificationEmail(email: string, userId: string): Promise<void> {
    const verificationUrl = `${process.env.FRONTEND_URL}/verify-email?token=${userId}`;
    
    const mailOptions = {
      from: process.env.SMTP_USER,
      to: email,
      subject: 'Verify Your GlobalAi Payee Account',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #2563eb;">Welcome to GlobalAi Payee!</h2>
          <p>Thank you for registering with GlobalAi Payee. Please verify your email address to complete your registration.</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${verificationUrl}" 
               style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
              Verify Email Address
            </a>
          </div>
          <p>If the button doesn't work, copy and paste this link into your browser:</p>
          <p style="word-break: break-all; color: #6b7280;">${verificationUrl}</p>
          <p>This link will expire in 24 hours.</p>
          <hr style="margin: 30px 0; border: none; border-top: 1px solid #e5e7eb;">
          <p style="color: #6b7280; font-size: 14px;">
            If you didn't create an account with GlobalAi Payee, please ignore this email.
          </p>
        </div>
      `,
    };

    await this.transporter.sendMail(mailOptions);
  }

  static async sendPasswordResetEmail(email: string, resetToken: string): Promise<void> {
    const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;
    
    const mailOptions = {
      from: process.env.SMTP_USER,
      to: email,
      subject: 'Reset Your GlobalAi Payee Password',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #2563eb;">Password Reset Request</h2>
          <p>You requested to reset your password for your GlobalAi Payee account.</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${resetUrl}" 
               style="background-color: #dc2626; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
              Reset Password
            </a>
          </div>
          <p>If the button doesn't work, copy and paste this link into your browser:</p>
          <p style="word-break: break-all; color: #6b7280;">${resetUrl}</p>
          <p>This link will expire in 1 hour.</p>
          <hr style="margin: 30px 0; border: none; border-top: 1px solid #e5e7eb;">
          <p style="color: #6b7280; font-size: 14px;">
            If you didn't request a password reset, please ignore this email.
          </p>
        </div>
      `,
    };

    await this.transporter.sendMail(mailOptions);
  }

  static async sendTransactionNotification(
    email: string, 
    transactionType: 'send' | 'receive', 
    amount: number, 
    currency: string,
    counterpartyName?: string
  ): Promise<void> {
    const isReceive = transactionType === 'receive';
    const subject = isReceive 
      ? `You received ${currency} ${amount}`
      : `You sent ${currency} ${amount}`;
    
    const mailOptions = {
      from: process.env.SMTP_USER,
      to: email,
      subject: `GlobalAi Payee - ${subject}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #2563eb;">Transaction Notification</h2>
          <div style="background-color: ${isReceive ? '#dcfce7' : '#fef3c7'}; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="margin: 0; color: ${isReceive ? '#166534' : '#92400e'};">
              ${isReceive ? '💰 Money Received' : '💸 Money Sent'}
            </h3>
            <p style="margin: 10px 0 0 0; font-size: 18px; font-weight: bold;">
              ${currency} ${amount.toFixed(2)}
            </p>
            ${counterpartyName ? `<p style="margin: 5px 0 0 0; color: #6b7280;">${isReceive ? 'From' : 'To'}: ${counterpartyName}</p>` : ''}
          </div>
          <p>Your transaction has been completed successfully.</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${process.env.FRONTEND_URL}/transactions" 
               style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
              View Transaction History
            </a>
          </div>
          <hr style="margin: 30px 0; border: none; border-top: 1px solid #e5e7eb;">
          <p style="color: #6b7280; font-size: 14px;">
            If you didn't make this transaction, please contact support immediately.
          </p>
        </div>
      `,
    };

    await this.transporter.sendMail(mailOptions);
  }

  static async sendFraudAlert(email: string, transactionDetails: any): Promise<void> {
    const mailOptions = {
      from: process.env.SMTP_USER,
      to: email,
      subject: '🚨 Fraud Alert - GlobalAi Payee',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #dc2626;">🚨 Fraud Alert</h2>
          <div style="background-color: #fef2f2; border: 1px solid #fecaca; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p style="color: #dc2626; font-weight: bold; margin: 0;">
              Suspicious activity detected on your account
            </p>
          </div>
          <p>We detected unusual activity on your GlobalAi Payee account:</p>
          <ul>
            <li><strong>Transaction ID:</strong> ${transactionDetails.id}</li>
            <li><strong>Amount:</strong> ${transactionDetails.currency} ${transactionDetails.amount}</li>
            <li><strong>Time:</strong> ${new Date(transactionDetails.created_at).toLocaleString()}</li>
            <li><strong>Location:</strong> ${transactionDetails.location_address || 'Unknown'}</li>
          </ul>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${process.env.FRONTEND_URL}/security" 
               style="background-color: #dc2626; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
              Review Security Settings
            </a>
          </div>
          <p><strong>If this was you:</strong> No action needed.</p>
          <p><strong>If this wasn't you:</strong> Please contact support immediately and change your password.</p>
          <hr style="margin: 30px 0; border: none; border-top: 1px solid #e5e7eb;">
          <p style="color: #6b7280; font-size: 14px;">
            This is an automated security alert. Please do not reply to this email.
          </p>
        </div>
      `,
    };

    await this.transporter.sendMail(mailOptions);
  }

  static async sendWelcomeEmail(email: string, firstName: string): Promise<void> {
    const mailOptions = {
      from: process.env.SMTP_USER,
      to: email,
      subject: 'Welcome to GlobalAi Payee! 🎉',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #2563eb;">Welcome to GlobalAi Payee, ${firstName}! 🎉</h2>
          <p>Thank you for joining the future of global payments. Your account is now ready to use.</p>
          
          <div style="background-color: #f0f9ff; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="color: #0369a1; margin-top: 0;">What you can do with GlobalAi Payee:</h3>
            <ul style="color: #0369a1;">
              <li>💳 Send and receive money globally</li>
              <li>🌍 Automatic currency conversion</li>
              <li>📱 QR code payments</li>
              <li>🔗 Blockchain integration</li>
              <li>🤖 AI-powered fraud protection</li>
              <li>📍 Location-based payments</li>
            </ul>
          </div>

          <div style="text-align: center; margin: 30px 0;">
            <a href="${process.env.FRONTEND_URL}/dashboard" 
               style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
              Get Started
            </a>
          </div>

          <p>Need help? Our AI assistant is available 24/7 to help you with any questions.</p>
          
          <hr style="margin: 30px 0; border: none; border-top: 1px solid #e5e7eb;">
          <p style="color: #6b7280; font-size: 14px;">
            GlobalAi Payee - Making global payments simple, secure, and smart.
          </p>
        </div>
      `,
    };

    await this.transporter.sendMail(mailOptions);
  }
}