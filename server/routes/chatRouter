const Router = require("express");
const router = new Router();
const chatController = require("../controllers/chatController");

router.get("/delivery/:orderId", chatController.getOrCreateDeliveryChat);
router.get("/user/:userId", chatController.getUserChats);
router.post("/", chatController.createChat);
router.get("/:chatId/messages", chatController.getMessages);
router.post("/:chatId/messages", chatController.sendMessage);
router.put("/:chatId/mark-read", chatController.markMessagesRead);
router.get("/:chatId", chatController.getOneChat);

module.exports = router;
