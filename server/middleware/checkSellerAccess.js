const { SellerUser } = require("../models/models");

module.exports = function checkSellerAccess(options = {}) {
  const paramName = options.paramName || "sellerId";

  return async function (req, res, next) {
    try {
      const user = req.user;

      if (!user) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const role = String(user.role || "").toUpperCase();

      if (role === "ADMIN") {
        return next();
      }

      const sellerId =
        Number(req.body?.[paramName]) ||
        Number(req.query?.[paramName]) ||
        Number(req.params?.[paramName]);

      if (!sellerId) {
        return res.status(400).json({ message: "sellerId required" });
      }

      const link = await SellerUser.findOne({
        where: {
          sellerId,
          userId: user.id,
        },
      });

      if (!link) {
        return res.status(403).json({ message: "No access to this seller" });
      }

      return next();
    } catch (e) {
      return next(e);
    }
  };
};
