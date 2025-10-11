// services/emailService.js
const fs = require('fs');
const path = require('path');
// Для Node 18+ глобальный fetch уже есть; для Node <18 подключим node-fetch на лету
const fetchFn = (...args) => (typeof fetch !== 'undefined' ? fetch(...args) : require('node-fetch')(...args));

const BREVO_API_KEY = process.env.BREVO_API_KEY;         // добавь в Render
const FROM_EMAIL    = process.env.MAIL_FROM || 'info@dlyq.ee';
const FROM_NAME     = process.env.MAIL_FROM_NAME || 'DlyQ OÜ';

async function sendEmail(to, subject, html, attachments = []) {
  if (!BREVO_API_KEY) throw new Error('BREVO_API_KEY не задан в окружении');

  const toArr = Array.isArray(to) ? to.map(email => ({ email })) : [{ email: to }];

  const attachment = attachments
    .filter(a => a && a.path)
    .map(a => {
      const full = path.resolve(a.path);
      const buf = fs.readFileSync(full);
      return {
        name: a.filename || path.basename(full),
        content: buf.toString('base64'),
      };
    });

  const payload = {
    sender: { email: FROM_EMAIL, name: FROM_NAME },
    to: toArr,
    subject,
    htmlContent: html,
  };
  if (attachment.length) payload.attachment = attachment;

  const res = await fetchFn('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'api-key': BREVO_API_KEY,
      'content-type': 'application/json',
      'accept': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Brevo API ${res.status}: ${text}`);
  }

  const data = await res.json().catch(() => ({}));
  console.log('[mail][brevo] sent ->', toArr.map(t => t.email).join(', '), 'messageId:', data?.messageId || data?.messageIds);
  return data;
}

module.exports = sendEmail;
