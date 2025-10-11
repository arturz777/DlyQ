// services/emailService.js
const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: 'smtp.zoho.eu',
  port: 465,             // SMTPS
  secure: true,          // на 465 всегда true
  auth: {
    user: 'info@dlyq.ee',
    pass: 'EDBdhGEtAnG0',
  }
});


const sendEmail = async (to, subject, html, attachments = []) => {
  try {
    await transporter.verify(); // быстрый чек соединения
    await transporter.sendMail({
      from: '"DLYQ OÜ" <info@dlyq.ee>',
      to,
      subject,
      html,
      attachments,
    });
    console.log('[mail][zoho587] sent ->', to);
  } catch (error) {
    console.error('[mail][zoho587] send error:', error);
  }
};

module.exports = sendEmail;
