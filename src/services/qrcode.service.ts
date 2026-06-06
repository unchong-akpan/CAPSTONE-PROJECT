import QRCode from 'qrcode';
import crypto from 'crypto';
import { logger } from '../utils/logger';

export class QRCodeService {
  /**
   * Generates a cryptographically secure random token for verification
   */
  static generateVerificationToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Generates a QR Code image as a base64 Data URL
   */
  static async generateQRCode(text: string): Promise<string> {
    try {
      // Generates a base64 image URL: "data:image/png;base64,..."
      const dataUrl = await QRCode.toDataURL(text, {
        color: {
          dark: '#4F46E5', // Eventful branding color
          light: '#FFFFFF',
        },
        width: 300,
        margin: 2,
      });
      return dataUrl;
    } catch (error) {
      logger.error('Failed to generate QR Code data url:', error);
      throw new Error('QR Code generation failed');
    }
  }
}

export default QRCodeService;
