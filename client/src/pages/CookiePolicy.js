import React from "react";
import styles from "./CookiePolicy.module.css";

const CookiePolicy = () => {
  return (
    <div className={styles.container}>
      <h1>Политика использования cookies</h1>
      <p>Последнее обновление: 16 февраля 2025</p>

      <section>
        <h2>1. Что такое cookies?</h2>
        <p>
          Cookies — это небольшие текстовые файлы, которые сохраняются на вашем устройстве при посещении нашего сайта.  
          Они помогают улучшить работу сайта и предоставить персонализированный контент.
        </p>
      </section>

      <section>
        <h2>2. Какие cookies мы используем?</h2>
        <p>Мы используем следующие типы cookies:</p>
        <ul>
          <li><strong>Необходимые cookies</strong> — помогают сайту работать корректно.</li>
          <li><strong>Аналитические cookies</strong> — собирают данные о посещаемости (Google Analytics).</li>
          <li><strong>Маркетинговые cookies</strong> — используются для персонализированной рекламы.</li>
        </ul>
      </section>

      <section>
        <h2>3. Как отключить cookies?</h2>
        <p>
          Вы можете отключить cookies в настройках браузера. Однако это может повлиять на корректную работу сайта.
        </p>
      </section>

      <section>
        <h2>4. Кто имеет доступ к данным?</h2>
        <p>
          Мы не передаём данные третьим лицам, за исключением сервисов аналитики (Google, Facebook).
        </p>
      </section>

      <section>
        <h2>5. Контакты</h2>
        <p>
          Если у вас есть вопросы по cookies, свяжитесь с нами:  
          <strong> support@mycompany.com</strong>.
        </p>
      </section>
    </div>
  );
};

export default CookiePolicy;
