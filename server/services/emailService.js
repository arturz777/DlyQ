// services/emailService.js
const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: 'gmail',
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
  logger: true, // печатает служебные логи нодемайлера
});

const sendEmail = async (to, subject, html, attachments = []) => {
  try {
    console.log('[mail] Gmail(service) verify...');
    await transporter.verify();
    console.log('[mail] Gmail(service) verified OK');

    const info = await transporter.sendMail({
      from: '"DlyQ" <margo310507@gmail.com>',
      to,
      subject,
      html,
      attachments,
    });

    console.log('[mail] sent via Gmail(service) →', to, info.messageId || '');
  } catch (error) {
    console.error('[mail] Gmail(service) error:', {
      message: error.message,
      code: error.code,
      command: error.command,
      response: error.response,
    });
    throw error;
  }
};

module.exports = sendEmail;
