import twilio from 'twilio';

export class SmsService {
  private static client = twilio(
    process.env.TWILIO_ACCOUNT_SID,
    process.env.TWILIO_AUTH_TOKEN
  );

  static async sendVerificationSms(phoneNumber: string, verificationCode: string): Promise<void> {
    const message = `Your GlobalAi Payee verification code is: ${verificationCode}. This code expires in 10 minutes.`;
    
    await this.client.messages.create({
      body: message,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: phoneNumber,
    });
  }

  static async sendTransactionSms(
    phoneNumber: string,
    transactionType: 'send' | 'receive',
    amount: number,
    currency: string,
    counterpartyName?: string
  ): Promise<void> {
    const isReceive = transactionType === 'receive';
    const action = isReceive ? 'received' : 'sent';
    const message = `GlobalAi Payee: You ${action} ${currency} ${amount}${counterpartyName ? ` ${isReceive ? 'from' : 'to'} ${counterpartyName}` : ''}.`;
    
    await this.client.messages.create({
      body: message,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: phoneNumber,
    });
  }

  static async sendFraudAlertSms(phoneNumber: string, transactionId: string): Promise<void> {
    const message = `🚨 GlobalAi Payee Fraud Alert: Suspicious activity detected on your account. Transaction ID: ${transactionId}. Please contact support immediately if this wasn't you.`;
    
    await this.client.messages.create({
      body: message,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: phoneNumber,
    });
  }

  static async sendTwoFactorSms(phoneNumber: string, code: string): Promise<void> {
    const message = `Your GlobalAi Payee 2FA code is: ${code}. This code expires in 5 minutes.`;
    
    await this.client.messages.create({
      body: message,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: phoneNumber,
    });
  }
}