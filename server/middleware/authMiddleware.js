const jwt = require('jsonwebtoken');

module.exports = function (req, res, next) {
    if (req.method === "OPTIONS") {
        return next();
    }
    try {
        const authorizationHeader = req.headers.authorization;
        if (!authorizationHeader) {
            req.user = null; // Для неавторизованных пользователей
            return next(); // Позволяем продолжить запрос
        }

        const token = authorizationHeader.split(' ')[1]; // Bearer <token>
        if (!token) {
            req.user = null; // Токен отсутствует
            return next(); // Позволяем продолжить запрос
        }

        const decoded = jwt.verify(token, process.env.SECRET_KEY);
        req.user = decoded; // Данные пользователя из токена
        next();
    } catch (error) {
        console.error('Ошибка авторизации:', error);
        req.user = null; // Устанавливаем null для некорректного токена
        next(); // Позволяем продолжить запрос
    }
};
