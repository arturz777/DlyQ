// services/emailService.js
const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'margo310507@gmail.com',
    pass: 'xbiw laxs btvo khhr', // твой app password
  },
  tls: { rejectUnauthorized: false },
  pool: true,
  maxConnections: 1,
  maxMessages: 50,
  connectionTimeout: 10000,
  greetingTimeout: 10000,
  socketTimeout: 15000,
  logger: true,
});

const sendEmail = async (to, subject, html, attachments = []) => {
  console.log('[mail][gmail] sending:', { to, subject, from: 'DlyQ <margo310507@gmail.com>' });
  try {
    const info = await transporter.sendMail({
      from: 'DlyQ <margo310507@gmail.com>',
      to,
      subject,
      html,
      attachments,
    });
    console.log('[mail][gmail] sent ok:', info.messageId || '(no id)');
  } catch (error) {
    console.error('❌ [mail][gmail] send error:', {
      message: error.message,
      code: error.code,
      command: error.command,
      response: error.response,
    });
    throw error;
  }
};

module.exports = sendEmail;
