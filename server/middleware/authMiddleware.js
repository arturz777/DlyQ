const jwt = require("jsonwebtoken");
const { User } = require("../models/models");

module.exports = async function (req, res, next) {
  if (req.method === "OPTIONS") {
    return next();
  }

  try {
    const authorizationHeader = req.headers.authorization;

    if (!authorizationHeader) {
      req.user = null;
      return next();
    }

    const token = authorizationHeader.split(" ")[1];

    if (!token) {
      req.user = null;
      return next();
    }

    const decoded = jwt.verify(token, process.env.SECRET_KEY);

    const user = await User.findByPk(decoded.id, { attributes: ["id", "isBlocked"] });
    if (!user) {
      req.user = null;
      return next();
    }

    if (user.isBlocked) {
      return res.status(403).json({ message: "Пользователь заблокирован" });
    }

    req.user = decoded;
    return next();
  } catch (error) {
    req.user = null;
    return next();
  }
};
