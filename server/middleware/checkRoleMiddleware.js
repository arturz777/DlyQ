const jwt = require('jsonwebtoken');

module.exports = function(role) {
    return function (req, res, next) {
        if (req.method === "OPTIONS") {
            next();
        }
        try {
            const token = req.headers.authorization.split(' ')[1]; // Bearer <token>
            if (!token) {
                return res.status(401).json({ message: "Не авторизован" });
            }
            const decoded = jwt.verify(token, process.env.SECRET_KEY);

            // ✅ Разрешаем доступ, если пользователь — АДМИН или КУРЬЕР
            if (decoded.role === "ADMIN" || decoded.role === role) {
                req.user = decoded;
                return next();
            }

            return res.status(403).json({ message: "Нет доступа" });
        } catch (e) {
            return res.status(401).json({ message: "Не авторизован" });
        }
    };
};
