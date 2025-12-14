const jwt = require("jsonwebtoken");

module.exports = function (...roles) {
  const allowed = roles.map((r) => String(r).toUpperCase());

  return function (req, res, next) {
    if (req.method === "OPTIONS") return next();

    try {
      const token = req.headers.authorization?.split(" ")[1];
      if (!token) return res.status(401).json({ message: "Не авторизован" });

      const decoded = jwt.verify(token, process.env.SECRET_KEY);
      const userRole = String(decoded.role || "").toUpperCase();

      if (userRole !== "ADMIN" && !allowed.includes(userRole)) {
        return res.status(403).json({ message: "Нет доступа" });
      }

      req.user = decoded;
      return next();
    } catch (e) {
      console.error("Ошибка проверки роли:", e);
      return res.status(401).json({ message: "Ошибка авторизации" });
    }
  };
};
