const { Router } = require("express");
const router = new Router();
const chatController = require("../controllers/chatController");
const authMiddleware = require("../middleware/authMiddleware");

router.get(
  "/delivery/:orderId",
  authMiddleware,
  chatController.getOrCreateDeliveryChat
);
router.get("/support", authMiddleware, chatController.getOrCreateSupportChat);
router.get(
  "/seller/:orderId",
  authMiddleware,
  chatController.getOrCreateSellerChat
);
router.get(
  "/support/me",
  authMiddleware,
  chatController.getOrCreateSupportChat
);

router.get("/user/:userId", chatController.getUserChats);
router.post("/", chatController.createChat);
router.get("/:chatId/messages", chatController.getMessages);
router.post("/:chatId/messages", chatController.sendMessage);
router.put("/:chatId/mark-read", chatController.markMessagesRead);
router.get("/:chatId", chatController.getOneChat);

module.exports = router;
