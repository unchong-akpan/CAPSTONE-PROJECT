import nodemailer from 'nodemailer';
import { ENV } from '../config/env';
import { logger } from '../utils/logger';

export class EmailService {
  private static transporter: nodemailer.Transporter | null = null;

  private static async getTransporter(): Promise<nodemailer.Transporter> {
    if (this.transporter) {
      return this.transporter;
    }

    // Check if configuration exists
    if (ENV.SMTP_USER && ENV.SMTP_PASS) {
      logger.info('Using configured SMTP settings for EmailService');
      this.transporter = nodemailer.createTransport({
        host: ENV.SMTP_HOST,
        port: ENV.SMTP_PORT,
        secure: ENV.SMTP_PORT === 465,
        auth: {
          user: ENV.SMTP_USER,
          pass: ENV.SMTP_PASS,
        },
      });
    } else {
      logger.info('No SMTP credentials found. Creating Ethereal Test Account...');
      try {
        const testAccount = await nodemailer.createTestAccount();
        logger.info(`Ethereal Test Account Created. User: ${testAccount.user}`);
        this.transporter = nodemailer.createTransport({
          host: 'smtp.ethereal.email',
          port: 587,
          secure: false,
          auth: {
            user: testAccount.user,
            pass: testAccount.pass,
          },
        });
      } catch (error) {
        logger.error('Failed to create Ethereal SMTP account. Falling back to log-only email transporter.', error);
        // Fallback log transporter
        this.transporter = nodemailer.createTransport({
          jsonTransport: true
        });
      }
    }

    return this.transporter;
  }

  /**
   * Sends a generic email
   */
  static async sendMail(options: { to: string; subject: string; html: string; text?: string }): Promise<boolean> {
    try {
      const transporter = await this.getTransporter();
      const mailOptions = {
        from: ENV.EMAIL_FROM,
        to: options.to,
        subject: options.subject,
        html: options.html,
        text: options.text || 'This email requires an HTML compatible viewer.',
      };

      const info = await transporter.sendMail(mailOptions);
      logger.info(`Email sent successfully: ${info.messageId}`);
      
      // If Ethereal, log the preview URL
      const previewUrl = nodemailer.getTestMessageUrl(info);
      if (previewUrl) {
        logger.info(`✉️ Email Preview URL: ${previewUrl}`);
      }
      
      return true;
    } catch (error) {
      logger.error('Failed to dispatch email:', error);
      return false;
    }
  }

  /**
   * Sends ticket confirmation with QR code
   */
  static async sendTicketEmail(email: string, name: string, event: { title: string; location: string; date: Date }, ticketId: string, qrCodeDataUrl: string): Promise<boolean> {
    const formattedDate = new Date(event.date).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 8px;">
        <h2 style="color: #4F46E5; text-align: center;">Your Event Ticket is Confirmed!</h2>
        <p>Hi ${name},</p>
        <p>Thank you for purchasing a ticket to <strong>${event.title}</strong> via Eventful. Your ticket details are provided below:</p>
        
        <div style="background-color: #F3F4F6; padding: 15px; border-radius: 6px; margin: 20px 0;">
          <p style="margin: 5px 0;"><strong>Event:</strong> ${event.title}</p>
          <p style="margin: 5px 0;"><strong>Date & Time:</strong> ${formattedDate}</p>
          <p style="margin: 5px 0;"><strong>Location:</strong> ${event.location}</p>
          <p style="margin: 5px 0;"><strong>Ticket Reference:</strong> ${ticketId}</p>
        </div>

        <div style="text-align: center; margin: 30px 0;">
          <p style="margin-bottom: 10px; font-weight: bold; color: #374151;">Present this QR Code at the entrance for scanning:</p>
          <img src="${qrCodeDataUrl}" alt="Ticket QR Code" style="width: 200px; height: 200px; border: 2px solid #4F46E5; padding: 5px; border-radius: 4px;"/>
        </div>

        <p style="font-size: 12px; color: #6B7280; text-align: center; margin-top: 40px;">
          This is an automated receipt from Eventful. If you have questions about the event, please contact the event organizer.
        </p>
      </div>
    `;

    return this.sendMail({
      to: email,
      subject: `Your Ticket for ${event.title} - Eventful`,
      html: htmlContent
    });
  }

  /**
   * Sends event reminder
   */
  static async sendReminderEmail(email: string, name: string, event: { title: string; location: string; date: Date }): Promise<boolean> {
    const formattedDate = new Date(event.date).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 8px;">
        <h2 style="color: #D97706; text-align: center;">Upcoming Event Reminder ⏰</h2>
        <p>Hi ${name},</p>
        <p>This is a quick reminder that the event you registered for is coming up soon!</p>
        
        <div style="background-color: #FEF3C7; border-left: 4px solid #D97706; padding: 15px; border-radius: 4px; margin: 20px 0;">
          <h3 style="margin-top: 0; color: #92400E;">${event.title}</h3>
          <p style="margin: 5px 0;"><strong>Date & Time:</strong> ${formattedDate}</p>
          <p style="margin: 5px 0;"><strong>Location:</strong> ${event.location}</p>
        </div>

        <p>Please make sure to have your ticket's QR Code ready at the venue entrance. You can find it in your registration confirmation email.</p>
        
        <p style="text-align: center; margin-top: 30px;">
          <a href="#" style="background-color: #4F46E5; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px; font-weight: bold;">View Event Details</a>
        </p>

        <p style="font-size: 12px; color: #6B7280; text-align: center; margin-top: 40px;">
          Sent to you by Eventful. To modify your reminder preferences, log into your profile on Eventful.
        </p>
      </div>
    `;

    return this.sendMail({
      to: email,
      subject: `Upcoming Event Reminder: ${event.title}`,
      html: htmlContent
    });
  }
}

export default EmailService;
