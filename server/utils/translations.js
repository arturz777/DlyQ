const translations = {
  total_charged: {
    en: "Total charged:",
    est: "Kokku tasutud:",
    ru: "Всего списано:",
  },
  hello: {
    en: "Hello",
    est: "Tere",
    ru: "Здравствуйте",
  },
  this_is_your_receipt: {
    en: "This is your receipt.",
    est: "See on teie kviitung.",
    ru: "Это ваша квитанция.",
  },
  buyer: {
    en: "Buyer",
    est: "Ostja",
    ru: "Покупатель",
  },
  address: {
    en: "Address",
    est: "Aadress",
    ru: "Адрес",
  },
  apartment: {
    en: "Apartment",
    est: "Korter",
    ru: "Квартира",
  },
  entrance: {
    en: "Entrance",
    est: "Trepikoda",
    ru: "Подъезд",
  },
  floor: {
    en: "Floor",
    est: "Korrus",
    ru: "Этаж",
  },
  comment: {
    en: "Comment",
    est: "Märkus",
    ru: "Комментарий",
  },
  contacts: {
    en: "📞 Contacts:",
    est: "📞 Kontaktid:",
    ru: "📞 Контакты:",
  },
  download_invoice: {
    en: "Download receipt (PDF)",
    est: "Laadi alla kviitung (PDF)",
    ru: "Скачать квитанцию (PDF)",
  },
  greetings: {
    en: "🧾 Order paid at dlyq.ee",
    est: "🧾 Tellimus on tasutud lehel dlyq.ee",
    ru: "🧾 Заказ оплачен в dlyq.ee",
  },
  auth_invalid_input: {
    en: "Please enter email and password.",
    est: "Palun sisestage e-post ja parool.",
    ru: "Введите email и пароль.",
  },
  auth_user_exists: {
    en: "A user with this email already exists.",
    est: "Selle e-postiga kasutaja juba eksisteerib.",
    ru: "Пользователь с таким email уже существует.",
  },
  auth_invalid_credentials: {
    en: "Invalid email or password.",
    est: "Vale e-post või parool.",
    ru: "Неверный email или пароль.",
  },
  unauthorized: {
    en: "Unauthorized.",
    est: "Pole autoriseeritud.",
    ru: "Не авторизован.",
  },
  chat_closed_thanks: {
  en: "Chat is closed. Thank you!",
  est: "Vestlus on suletud. Aitäh!",
  ru: "Чат закрыт. Спасибо!",
},
  chat_reopened: {
  en: "Chat reopened",
  est: "Vestlus on uuesti avatud",
  ru: "Чат снова открыт",
},
};

const normLang = (lang) => {
  const l = String(lang || "est").toLowerCase().trim().split("-")[0];
  if (l === "et") return "est";
  if (l === "ru") return "ru";
  if (l === "en") return "en";
  if (l === "est") return "est";
  return "est";
};

function t(key, lang = "est") {
  const L = normLang(lang);
  return translations[key]?.[L] || translations[key]?.est || key;
}

module.exports = { t, normLang };
