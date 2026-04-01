import nodemailer from 'nodemailer';

export function createTransport() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT ?? 587),
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

export async function sendPasswordResetEmail(to: string, token: string): Promise<void> {
  const transport = createTransport();
  await transport.sendMail({
    from: process.env.EMAIL_FROM,
    to,
    subject: 'Password reset',
    text: `Your password reset token is:\n\n${token}\n\nIt expires in 1 hour.`,
  });
}
