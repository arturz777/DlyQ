// services/emailService.js
const fs = require('fs').promises;
const path = require('path');

const BREVO_API_KEY = process.env.BREVO_API_KEY;
const FROM_EMAIL = process.env.FROM_EMAIL || 'info@dlyq.ee';
const FROM_NAME  = process.env.FROM_NAME  || 'DlyQ';

const BREVO_URL = 'https://api.brevo.com/v3/smtp/email';

function maskKey(k) {
  if (!k) return 'MISSING';
  return `${k.slice(0,6)}...${k.slice(-4)} (len=${k.length})`;
}

async function sendEmail(to, subject, html, attachments = []) {
  // Диагностика наличия ключа
  console.log('[mail][brevo] key:', maskKey(BREVO_API_KEY));
  if (!BREVO_API_KEY) {
    throw new Error('BREVO_API_KEY is not configured in environment');
  }

  const payload = {
    sender: { email: FROM_EMAIL, name: FROM_NAME },
    to: (Array.isArray(to) ? to : [to]).map(email => ({ email })),
    subject,
    htmlContent: html,
  };

  // Поддержка вложений (если вдруг понадобится)
  if (attachments && attachments.length) {
    payload.attachment = await Promise.all(attachments.map(async (a) => {
      if (a?.path) {
        const content = await fs.readFile(a.path, { encoding: 'base64' });
        return { name: a.filename || path.basename(a.path), content };
      }
      if (a?.content) {
        const buf = Buffer.isBuffer(a.content) ? a.content : Buffer.from(a.content);
        return { name: a.filename || 'attachment', content: buf.toString('base64') };
      }
      return null;
    })).then(list => list.filter(Boolean));
  }

  console.log('[mail][brevo] sending:', {
    from: `${FROM_NAME} <${FROM_EMAIL}>`,
    to: payload.to.map(x => x.email),
    subject
  });

  const res = await fetch(BREVO_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      // ОБЯЗАТЕЛЬНО именно 'api-key'
      'api-key': BREVO_API_KEY,
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error('[mail][brevo] send error:', text);
    throw new Error(`Brevo API ${res.status}: ${text}`);
  }

  const data = await res.json();
  console.log('[mail][brevo] ok:', data && data.messageId ? data.messageId : data);
  return data;
}

module.exports = sendEmail;
