// services/emailService.js
const nodemailer = require('nodemailer');

// ⚠️ ВСТАВЬ СЮДА СВОИ ДАННЫЕ ОТ BREVO:
const BREVO_USER = '990886001@smtp-brevo.com';   // логин в Brevo (обычно твой e-mail)
const BREVO_SMTP_KEY = 'H3V9n6Z2bNsw0zdc';  // SMTP key из Brevo → SMTP & API → SMTP

const transporter = nodemailer.createTransport({
  host: 'smtp-relay.brevo.com',
  port: 587,           // рекомендованный порт (обычно открыт)
  secure: false,        // STARTTLS
  auth: {
    user: BREVO_USER,
    pass: BREVO_SMTP_KEY,
  },
  pool: true,
  maxConnections: 2,
  maxMessages: 100,
  connectionTimeout: 10000,
  greetingTimeout: 10000,
  socketTimeout: 20000,
  logger: true,         // подробные логи в консоли
});

const sendEmail = async (to, subject, html, attachments = []) => {
  const from = 'DlyQ <margo310507@gmail.com>'; // твой текущий "From"
  console.log('[mail][brevo2525] sending:', { to, subject, from });

  try {
    // быстрая проверка соединения (можно один раз при старте вынести)
    await transporter.verify().catch(err => {
      console.error('[mail][brevo2525] verify error:', {
        message: err.message, code: err.code, command: err.command, response: err.response
      });
      throw err;
    });

    const info = await transporter.sendMail({
      from,
      to,
      subject,
      html,
      attachments,
    });

    console.log('[mail][brevo2525] sent ok:', info && (info.messageId || info.response));
    return info;
  } catch (error) {
    console.error('❌ [mail][brevo2525] send error:', {
      message: error.message,
      code: error.code,
      command: error.command,
      response: error.response,
    });
    throw error;
  }
};

module.exports = sendEmail;
