const Router = require('express');
const router = new Router();
const deviceController = require('../controllers/deviceController');
const makeController = require('../controllers/makeController');
const modelController = require('../controllers/modelController');


router.put("/updateNewStatus", deviceController.updateNewStatus);
router.get("/discounted", deviceController.getDiscountedDevices);
router.put("/updateDiscountStatus", deviceController.update);
router.post("/check-stock", deviceController.checkStock);
router.get('/search', deviceController.search);
router.get('/filter', deviceController.filter);

router.get('/make', makeController.getAll);
router.post('/make', makeController.create);
router.put('/make/:id', makeController.update);
router.delete('/make/:id', makeController.delete);

router.get('/model', modelController.getByMake);
router.post('/model', modelController.create);
router.put('/model/:id', modelController.update);
router.delete('/model/:id', modelController.delete);

router.post('/', deviceController.create)
router.get('/', deviceController.getAll)
router.post('/:id/stock', deviceController.adjustStock);
router.get('/:id', deviceController.getOne)
router.put('/:id', deviceController.update);
router.delete('/:id', deviceController.delete);

router.patch('/:id/visibility', deviceController.updateVisibility);

module.exports = router
