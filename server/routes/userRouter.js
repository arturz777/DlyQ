const Router = require('express')
const router = new Router()
const userController = require('../controllers/userController')
const authMiddleware = require('../middleware/authMiddleware')

router.post('/registration', userController.registration)
router.post('/login', userController.login)
router.get('/auth', authMiddleware, userController.check)
router.put('/profile', authMiddleware, userController.updateProfile);
router.get('/profile', authMiddleware, userController.getProfile);
router.put("/change-password", authMiddleware, userController.changePassword);
router.post('/refresh', userController.refresh);
router.post('/google-login', userController.googleLogin);

module.exports = router
