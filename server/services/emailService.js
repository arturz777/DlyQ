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
  const info = await transporter.sendMail({
    from: '"DlyQ" <margo310507@gmail.com>',
    to,
    subject,
    html,
    attachments,
  });
  console.log('Email accepted:', info.accepted, 'rejected:', info.rejected, 'response:', info.response);
  return info;
};

module.exports = sendEmail;
