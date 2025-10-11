// services/emailService.js
const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 587,              // можно попробовать 465 + secure:true, если 587 не пускает
  secure: false,
  requireTLS: true,
  auth: {
    user: 'margo310507@gmail.com',
    pass: 'xbiw laxs btvo khhr',
  },
  pool: true,
  maxConnections: 1,
  maxMessages: 50,
  connectionTimeout: 10000,
  greetingTimeout: 10000,
  socketTimeout: 15000,
  logger: true,
});

const sendEmail = async (to, subject, html, attachments = []) => {
  try {
    console.log('[mail] Gmail(smtp587) verify...');
    await transporter.verify();
    console.log('[mail] Gmail(smtp587) verified OK');

    const info = await transporter.sendMail({
      from: '"DlyQ" <margo310507@gmail.com>',
      to,
      subject,
      html,
      attachments,
    });

    console.log('[mail] sent via Gmail(smtp587) →', to, info.messageId || '');
  } catch (error) {
    console.error('[mail] Gmail(smtp587) error:', {
      message: error.message,
      code: error.code,
      command: error.command,
      response: error.response,
    });
    throw error;
  }
};

module.exports = sendEmail;
