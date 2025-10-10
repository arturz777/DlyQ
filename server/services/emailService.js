const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: 'smtp.zoho.eu',
  port: 587,
  secure: false,
  requireTLS: true,
  auth: { user: process.env.MAIL_USER, pass: process.env.MAIL_PASS },
  tls: { rejectUnauthorized: false } 
});

const sendEmail = async (to, subject, html, attachments = []) => {
 
  try {
     if (!process.env.MAIL_USER || !process.env.MAIL_PASS) {
    throw new Error('MAIL_USER / MAIL_PASS не заданы в окружении');
  }
    await transporter.sendMail({
      from: `"DLYQ OÜ" <${process.env.MAIL_USER}>`,
      to,
      subject,
      html,
      attachments,
    });
  } catch (error) {
    console.error("❌ Ошибка отправки письма:", error);
  }
};


module.exports = sendEmail;
