const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'margo310507@gmail.com', 
    pass: 'xbiw laxs btvo khhr', 
  },
  tls: {
    rejectUnauthorized: false, 
  },
});

const sendEmail = async (to, subject, html, attachments = []) => {
  try {
    await transporter.sendMail({
      from: '"DlyQ" <margo310507@gmail.com>',
      to,
      subject,
      html,
      attachments,
    });
    console.log("✅ Письмо отправлено на:", to);
  } catch (error) {
    console.error("❌ Ошибка отправки письма:", error);
  }
};


module.exports = sendEmail;
