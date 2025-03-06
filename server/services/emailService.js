// server/services/emailService.js
const nodemailer = require('nodemailer');

// Настройка почтового клиента
const transporter = nodemailer.createTransport({
  service: 'gmail', // Можно использовать другой почтовый сервис (например, Mailgun, Yandex)
  auth: {
    user: 'margo310507@gmail.com', // Ваш email
    pass: 'xbiw laxs btvo khhr', // Пароль или "App Password" для Gmail
  },
  tls: {
    rejectUnauthorized: false, // Игнорировать самоподписанные сертификаты
  },
});

// Функция отправки письма
const sendMail = async (to, subject, htmlContent) => {
  try {
    await transporter.sendMail({
      from: '"Ваш магазин" <margo310507@gmail.com>', // От кого
	    to: "ms.margo07@mail.ru",
      subject,
      html: htmlContent,
    });
    console.log('Письмо отправлено!');
  } catch (error) {
    console.error('Ошибка отправки письма:', error);
  }
};

module.exports = sendMail;
