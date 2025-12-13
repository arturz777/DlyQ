const { SellerUser } = require("../models/models");
const ApiError = require("../error/ApiError");

module.exports = function checkSellerResourceAccess(Model, opts = {}) {
  const idParam = opts.idParam || "id";
  const sellerField = opts.sellerField || "sellerId";
  const notFoundMessage = opts.notFoundMessage || "Resource not found";

  return async function (req, res, next) {
    try {
      const user = req.user;
      if (!user) return res.status(401).json({ message: "Unauthorized" });

      if (String(user.role).toUpperCase() === "ADMIN") return next();

      const resourceId = Number(req.params[idParam]);
      if (!resourceId) {
        return res.status(400).json({ message: `${idParam} required` });
      }

      const entity = await Model.findByPk(resourceId);
      if (!entity) return next(ApiError.notFound(notFoundMessage));

      const sellerId = Number(entity[sellerField]);
      if (!sellerId) {
        return res.status(400).json({ message: "sellerId missing on entity" });
      }

      const link = await SellerUser.findOne({
        where: { sellerId, userId: user.id },
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
