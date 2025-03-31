const jwt = require("jsonwebtoken");

module.exports = function (requiredRole) {
  return function (req, res, next) {
    if (req.method === "OPTIONS") {
      return next();
    }

    try {
      const token = req.headers.authorization?.split(" ")[1]; // Bearer <token>
      if (!token) {
        return res.status(401).json({ message: "Не авторизован" });
      }

      const decoded = jwt.verify(token, process.env.SECRET_KEY);
      if (decoded.role !== requiredRole) {
        return res.status(403).json({ message: "Нет доступа" });
      }

      req.user = decoded;
      next();
    } catch (error) {
      console.error("Ошибка проверки роли:", error);
      return res.status(401).json({ message: "Ошибка авторизации" });
    }
  };
};
