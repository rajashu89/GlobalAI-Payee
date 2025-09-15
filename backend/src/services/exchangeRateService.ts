import axios from 'axios';
import { db } from '@/config/database';
import { cache } from '@/config/redis';

export class ExchangeRateService {
  private static readonly API_URL = 'https://openexchangerates.org/api';
  private static readonly CACHE_DURATION = 3600; // 1 hour

  static async getExchangeRate(fromCurrency: string, toCurrency: string): Promise<number> {
    if (fromCurrency === toCurrency) {
      return 1;
    }

    const cacheKey = `exchange_rate:${fromCurrency}:${toCurrency}`;
    
    // Try cache first
    const cachedRate = await cache.get(cacheKey);
    if (cachedRate) {
      return cachedRate;
    }

    try {
      // Try database first
      const dbRate = await this.getRateFromDatabase(fromCurrency, toCurrency);
      if (dbRate && this.isRateRecent(dbRate.timestamp)) {
        await cache.set(cacheKey, dbRate.rate, this.CACHE_DURATION);
        return dbRate.rate;
      }

      // Fetch from API
      const rate = await this.fetchRateFromAPI(fromCurrency, toCurrency);
      
      // Store in database and cache
      await this.storeRateInDatabase(fromCurrency, toCurrency, rate);
      await cache.set(cacheKey, rate, this.CACHE_DURATION);

      return rate;
    } catch (error) {
      console.error('Error fetching exchange rate:', error);
      
      // Fallback to database or default rate
      const dbRate = await this.getRateFromDatabase(fromCurrency, toCurrency);
      if (dbRate) {
        return dbRate.rate;
      }

      // Default fallback rate (this should be updated regularly)
      return this.getDefaultRate(fromCurrency, toCurrency);
    }
  }

  static async getAllRates(baseCurrency: string = 'USD'): Promise<Record<string, number>> {
    const cacheKey = `exchange_rates:${baseCurrency}`;
    
    // Try cache first
    const cachedRates = await cache.get(cacheKey);
    if (cachedRates) {
      return cachedRates;
    }

    try {
      const response = await axios.get(`${this.API_URL}/latest.json`, {
        params: {
          app_id: process.env.OPENEXCHANGE_API_KEY,
          base: baseCurrency,
        },
      });

      const rates = response.data.rates;
      
      // Store in cache
      await cache.set(cacheKey, rates, this.CACHE_DURATION);
      
      // Store individual rates in database
      await this.storeRatesInDatabase(baseCurrency, rates);

      return rates;
    } catch (error) {
      console.error('Error fetching all exchange rates:', error);
      
      // Fallback to database
      return await this.getRatesFromDatabase(baseCurrency);
    }
  }

  static async convertAmount(amount: number, fromCurrency: string, toCurrency: string): Promise<{
    originalAmount: number;
    convertedAmount: number;
    rate: number;
    fromCurrency: string;
    toCurrency: string;
  }> {
    const rate = await this.getExchangeRate(fromCurrency, toCurrency);
    const convertedAmount = amount * rate;

    return {
      originalAmount: amount,
      convertedAmount,
      rate,
      fromCurrency,
      toCurrency,
    };
  }

  static async getHistoricalRates(
    fromCurrency: string,
    toCurrency: string,
    days: number = 30
  ): Promise<Array<{ date: string; rate: number }>> {
    const cacheKey = `historical_rates:${fromCurrency}:${toCurrency}:${days}`;
    
    // Try cache first
    const cachedRates = await cache.get(cacheKey);
    if (cachedRates) {
      return cachedRates;
    }

    try {
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(endDate.getDate() - days);

      const response = await axios.get(`${this.API_URL}/time-series.json`, {
        params: {
          app_id: process.env.OPENEXCHANGE_API_KEY,
          start: startDate.toISOString().split('T')[0],
          end: endDate.toISOString().split('T')[0],
          base: fromCurrency,
          symbols: toCurrency,
        },
      });

      const rates = Object.entries(response.data.rates).map(([date, rateData]: [string, any]) => ({
        date,
        rate: rateData[toCurrency],
      }));

      // Cache for 1 hour
      await cache.set(cacheKey, rates, 3600);

      return rates;
    } catch (error) {
      console.error('Error fetching historical rates:', error);
      return [];
    }
  }

  private static async getRateFromDatabase(fromCurrency: string, toCurrency: string): Promise<{ rate: number; timestamp: Date } | null> {
    const query = `
      SELECT rate, timestamp 
      FROM exchange_rates 
      WHERE from_currency = $1 AND to_currency = $2 
      ORDER BY timestamp DESC 
      LIMIT 1
    `;
    
    const result = await db.query(query, [fromCurrency, toCurrency]);
    return result.rows[0] || null;
  }

  private static async storeRateInDatabase(fromCurrency: string, toCurrency: string, rate: number): Promise<void> {
    const query = `
      INSERT INTO exchange_rates (from_currency, to_currency, rate, timestamp)
      VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
      ON CONFLICT (from_currency, to_currency, timestamp) DO NOTHING
    `;
    
    await db.query(query, [fromCurrency, toCurrency, rate]);
  }

  private static async storeRatesInDatabase(baseCurrency: string, rates: Record<string, number>): Promise<void> {
    const values: any[] = [];
    const placeholders: string[] = [];
    let paramCount = 1;

    for (const [currency, rate] of Object.entries(rates)) {
      if (currency !== baseCurrency) {
        values.push(baseCurrency, currency, rate);
        placeholders.push(`($${paramCount}, $${paramCount + 1}, $${paramCount + 2}, CURRENT_TIMESTAMP)`);
        paramCount += 3;
      }
    }

    if (values.length > 0) {
      const query = `
        INSERT INTO exchange_rates (from_currency, to_currency, rate, timestamp)
        VALUES ${placeholders.join(', ')}
        ON CONFLICT (from_currency, to_currency, timestamp) DO NOTHING
      `;
      
      await db.query(query, values);
    }
  }

  private static async getRatesFromDatabase(baseCurrency: string): Promise<Record<string, number>> {
    const query = `
      SELECT DISTINCT ON (to_currency) to_currency, rate
      FROM exchange_rates
      WHERE from_currency = $1
      ORDER BY to_currency, timestamp DESC
    `;
    
    const result = await db.query(query, [baseCurrency]);
    
    const rates: Record<string, number> = { [baseCurrency]: 1 };
    result.rows.forEach(row => {
      rates[row.to_currency] = row.rate;
    });

    return rates;
  }

  private static isRateRecent(timestamp: Date): boolean {
    const now = new Date();
    const diffInMinutes = (now.getTime() - timestamp.getTime()) / (1000 * 60);
    return diffInMinutes < 60; // Consider rate recent if less than 1 hour old
  }

  private static getDefaultRate(fromCurrency: string, toCurrency: string): number {
    // Default rates (should be updated regularly)
    const defaultRates: Record<string, Record<string, number>> = {
      USD: { EUR: 0.85, GBP: 0.73, JPY: 110.0, INR: 75.0, CAD: 1.25, AUD: 1.35 },
      EUR: { USD: 1.18, GBP: 0.86, JPY: 129.0, INR: 88.0, CAD: 1.47, AUD: 1.59 },
      GBP: { USD: 1.37, EUR: 1.16, JPY: 150.0, INR: 102.0, CAD: 1.71, AUD: 1.85 },
      INR: { USD: 0.013, EUR: 0.011, GBP: 0.0098, JPY: 1.47, CAD: 0.017, AUD: 0.018 },
    };

    return defaultRates[fromCurrency]?.[toCurrency] || 1;
  }

  static async updateRatesCron(): Promise<void> {
    try {
      console.log('🔄 Updating exchange rates...');
      
      const currencies = ['USD', 'EUR', 'GBP', 'JPY', 'INR', 'CAD', 'AUD'];
      
      for (const baseCurrency of currencies) {
        const rates = await this.getAllRates(baseCurrency);
        console.log(`✅ Updated rates for ${baseCurrency}`);
      }
      
      console.log('✅ Exchange rates updated successfully');
    } catch (error) {
      console.error('❌ Error updating exchange rates:', error);
    }
  }
}