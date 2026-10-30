import { Worker } from 'bullmq';
import Redis from 'ioredis';
import nodemailer from 'nodemailer';

const connection = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: null,
});

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.mailtrap.io',
  port: Number(process.env.SMTP_PORT) || 2525,
  auth: {
    user: process.env.SMTP_USER || 'mock_user',
    pass: process.env.SMTP_PASS || 'mock_pass',
  },
});

export const startEmailWorker = () => {
  const worker = new Worker(
    'email-queue',
    async (job) => {
      const { email, bookingId, seats, totalAmount } = job.data;

      const mailOptions = {
        from: '"RizzTix Support" <support@rizztix.com>',
        to: email,
        subject: `Booking Confirmed! Reference ID: ${bookingId}`,
        html: `
          <h1>Your Ticket Booking is Confirmed! 🎉</h1>
          <p>Thank you for booking with RizzTix.</p>
          <p><strong>Booking Reference:</strong> ${bookingId}</p>
          <p><strong>Seats Booked:</strong> ${seats.join(', ')}</p>
          <p><strong>Total Paid:</strong> $${totalAmount}</p>
          <p>Enjoy your event!</p>
        `,
      };
await transporter.sendMail(mailOptions);
console.log(`Confirmation email successfully sent to ${email} for booking ${bookingId}`);
    },
    { connection }
  );

  worker.on('failed', (job, err) => {
    console.error(`❌ Email job failed for booking ${job?.data?.bookingId}:`, err);
  });
};