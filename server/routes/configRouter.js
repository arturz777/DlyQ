const Router = require('express');
const router = new Router();
const { getMaintenance, setMaintenance } = require('../controllers/configController');

router.get('/maintenance', getMaintenance);
router.post('/maintenance', setMaintenance);

module.exports = router;
