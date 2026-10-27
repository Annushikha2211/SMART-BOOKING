
import 'dotenv/config';
import nodemailer from 'nodemailer';

const emailUser = process.env.EMAIL_USER;
const emailPass = process.env.EMAIL_PASS;

if (!emailUser || !emailPass) {
  throw new Error('EMAIL_USER and EMAIL_PASS must be configured');
}

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: emailUser,
    pass: emailPass,
  },
});

export const sendOTPEmail = async (
  to: string,
  otp: string,
  purpose: 'SIGNUP' | 'FORGOT_PASSWORD'
) => {
  const isSignup = purpose === 'SIGNUP';

  await transporter.sendMail({
    from: `"RizzTix Support" <${emailUser}>`,
    to,
    subject: isSignup
      ? 'Verify your RizzTix Account'
      : 'Reset your RizzTix Password',
    text: `Your OTP is ${otp}. It expires in 5 minutes.`,
    html: `
      <div style="font-family:Arial;padding:20px">
        <h2>RizzTix Verification Code</h2>
        <p>Your verification code is:</p>
        <h1 style="letter-spacing:5px">${otp}</h1>
        <p>This code expires in 5 minutes.</p>
      </div>
    `,
  });
};
