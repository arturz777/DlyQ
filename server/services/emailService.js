// services/emailService.js
const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'margo310507@gmail.com',
    pass: 'xbiw laxs btvo khhr',
  },
  tls: { rejectUnauthorized: false },
  logger: true,   // вкл. встроенный логгер Nodemailer (SMTP диалог)
  debug: true,    // подробный дебаг Nodemailer
});

// разовая проверка подключения при старте
transporter.verify((err, success) => {
  if (err) {
    console.error('[mail] transporter.verify error:', {
      message: err.message,
      code: err.code,
      command: err.command,
      stack: err.stack,
    });
  } else {
    console.log('[mail] transporter.verify ok:', success);
  }
});

const sendEmail = async (to, subject, html, attachments = []) => {
  console.log('[mail] sendEmail called:', {
    to,
    subject,
    from: 'DlyQ <margo310507@gmail.com>',
    attachmentsCount: attachments?.length || 0,
    htmlLength: html ? html.length : 0,
  });

  try {
    const info = await transporter.sendMail({
      from: '"DlyQ" <margo310507@gmail.com>',
      to,
      subject,
      html,
      attachments,
    });

    console.log('[mail] sendMail success:', {
      messageId: info.messageId,
      accepted: info.accepted,
      rejected: info.rejected,
      response: info.response,
      envelope: info.envelope,
    });

    return info;
  } catch (error) {
    console.error('[mail] sendMail error:', {
      message: error.message,
      code: error.code,
      command: error.command,
      response: error.response,
      stack: error.stack,
    });
    throw error; // важно пробрасывать, чтобы контроллер увидел ошибку
  }
};

module.exports = sendEmail;
