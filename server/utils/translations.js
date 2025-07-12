const translations = {
  total_charged: {
    en: "Total charged:",
    est: "Kokku tasutud:",
    ru: "Всего списано:"
  },
  hello: {
    en: "Hello",
    est: "Tere",
    ru: "Здравствуйте"
  },
  this_is_your_receipt: {
    en: "This is your receipt.",
    est: "See on teie kviitung.",
    ru: "Это ваша квитанция."
  },
  buyer: {
    en: "Buyer",
    est: "Ostja",
    ru: "Покупатель"
  },
  address: {
    en: "Address",
    est: "Aadress",
    ru: "Адрес"
  },
  contacts: {
    en: "📞 Contacts:",
    est: "📞 Kontaktid:",
    ru: "📞 Контакты:"
  },
  download_invoice: {
    en: "Download receipt (PDF)",
    est: "Laadi alla kviitung (PDF)",
    ru: "Скачать квитанцию (PDF)"
  },
  greetings: {
  en: "🧾 Order paid at dlyq.ee",
  est: "🧾 Tellimus on tasutud lehel dlyq.ee",
  ru: "🧾 Заказ оплачен в dlyq.ee",
  },
 
};

function t(key, lang = "est") {
  return translations[key]?.[lang] || key;
}

module.exports = { t };
