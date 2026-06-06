import { ENV } from '../config/env';
import { logger } from '../utils/logger';

export interface PaystackInitResponse {
  authorization_url: string;
  access_code: string;
  reference: string;
}

export class PaymentService {
  private static readonly PAYSTACK_BASE_URL = 'https://api.paystack.co';

  /**
   * Initializes a Paystack transaction
   * @param email Customer email
   * @param amount Amount in NGN (e.g. 5000)
   * @param callbackUrl Redirect URL after payment completion
   * @returns Initialization payload
   */
  static async initializeTransaction(email: string, amount: number, callbackUrl: string): Promise<PaystackInitResponse> {
    const reference = `evt_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
    const amountInKobo = Math.round(amount * 100); // Paystack expects amount in Kobo

    // If key is mock, return a simulation object
    if (ENV.PAYSTACK_SECRET_KEY === 'mock' || ENV.NODE_ENV === 'test') {
      logger.info(`[PaymentService Mock] Initializing transaction for ${email} of ${amount} NGN`);
      return {
        authorization_url: `http://localhost:${ENV.PORT}/payments/mock-checkout?reference=${reference}&amount=${amount}`,
        access_code: `mock_code_${reference}`,
        reference,
      };
    }

    try {
      const response = await fetch(`${this.PAYSTACK_BASE_URL}/transaction/initialize`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${ENV.PAYSTACK_SECRET_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          amount: amountInKobo,
          callback_url: callbackUrl,
          reference,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        logger.error(`Paystack initialize API failed: ${response.status} - ${errorText}`);
        throw new Error('Paystack initialization failed');
      }

      const body = (await response.json()) as any;
      if (!body.status) {
        throw new Error(body.message || 'Transaction initialization failed');
      }

      return body.data as PaystackInitResponse;
    } catch (error) {
      logger.error('Error during Paystack initialize transaction:', error);
      throw error;
    }
  }

  /**
   * Verifies a Paystack transaction status
   * @param reference Paystack transaction reference
   * @returns Boolean indicating if payment succeeded
   */
  static async verifyTransaction(reference: string): Promise<{ success: boolean; amount: number; email: string }> {
    if (ENV.PAYSTACK_SECRET_KEY === 'mock' || ENV.NODE_ENV === 'test') {
      logger.info(`[PaymentService Mock] Verifying mock reference: ${reference}`);
      // Simple mock check
      if (reference.startsWith('evt_')) {
        return {
          success: true,
          amount: 5000, // standard mock amount
          email: 'mock_eventee@example.com',
        };
      }
      return { success: false, amount: 0, email: '' };
    }

    try {
      const response = await fetch(`${this.PAYSTACK_BASE_URL}/transaction/verify/${reference}`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${ENV.PAYSTACK_SECRET_KEY}`,
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        logger.error(`Paystack verify API failed: ${response.status} - ${errorText}`);
        return { success: false, amount: 0, email: '' };
      }

      const body = (await response.json()) as any;
      if (body.status && body.data && body.data.status === 'success') {
        const amountInNaira = body.data.amount / 100;
        return {
          success: true,
          amount: amountInNaira,
          email: body.data.customer.email,
        };
      }

      logger.warn(`Paystack verification returned non-success status for reference ${reference}:`, body);
      return { success: false, amount: 0, email: '' };
    } catch (error) {
      logger.error(`Error during Paystack verification for reference ${reference}:`, error);
      return { success: false, amount: 0, email: '' };
    }
  }
}

export default PaymentService;
