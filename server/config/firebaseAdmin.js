// config/firebaseAdmin.js
const admin = require('firebase-admin');

if (!admin.apps.length) {
  // Я предлагаю хранить JSON ключ в переменной окружения
  // FIREBASE_SERVICE_ACCOUNT_JSON (прямо весь JSON как строку)
  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;

  if (!serviceAccountJson) {
    throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON is not set');
  }

  const serviceAccount = JSON.parse(serviceAccountJson);

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

module.exports = admin;
