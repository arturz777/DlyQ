// services/emailService.js
const nodemailer = require('nodemailer');

/**
 * SMTP 2525 (Brevo). Обычно порт 2525 открыт на PaaS.
 * ВСТАВЬ свои креды от Brevo ниже.
 */
const transporter = nodemailer.createTransport({
  host: 'smtp-relay.brevo.com',
  port: 2525,
  secure: false,
  auth: {
    user: 'margo310507@gmail.com',   // <-- вставь логин Brevo
    pass: 'xbiw laxs btvo khhr',       // <-- вставь SMTP Key (из Brevo)
  },
  pool: true,
  maxConnections: 1,
  maxMessages: 50,
  connectionTimeout: 10000,
  greetingTimeout: 10000,
  socketTimeout: 15000,
  logger: true,
});

async function sendEmail(to, subject, html, attachments = []) {
  const from = 'DlyQ <margo310507@gmail.com>'; // лучше в Brevo верифицировать отправителя/домен
  console.log('[mail][brevo2525] sending:', { to, subject, from });

  try {
    const info = await transporter.sendMail({
      from,
      to,
      subject,
      html,
      attachments, // Brevo нормально шлёт вложения по SMTP
    });
    console.log('[mail][brevo2525] sent ok:', info.messageId || '(no id)');
  } catch (error) {
    console.error('❌ [mail][brevo2525] send error:', {
      message: error.message,
      code: error.code,
      command: error.command,
      response: error.response,
    });
    throw error;
  }
}

module.exports = sendEmail;
