import dotenv from 'dotenv';
import path from 'path';

// Load environmental variables
dotenv.config();

export const ENV = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: parseInt(process.env.PORT || '5000', 10),
  DATABASE_URL: process.env.DATABASE_URL || '',
  JWT_SECRET: process.env.JWT_SECRET || 'eventful_secret_signing_key_2026',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '24h',
  REDIS_URL: process.env.REDIS_URL || '',
  PAYSTACK_SECRET_KEY: process.env.PAYSTACK_SECRET_KEY || 'mock',
  SMTP_HOST: process.env.SMTP_HOST || 'smtp.ethereal.email',
  SMTP_PORT: parseInt(process.env.SMTP_PORT || '587', 10),
  SMTP_USER: process.env.SMTP_USER || '',
  SMTP_PASS: process.env.SMTP_PASS || '',
  EMAIL_FROM: process.env.EMAIL_FROM || 'Eventful <noreply@eventful.app>',
};
