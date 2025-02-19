const Router = require('express')
const router = new Router()
const brandController = require('../controllers/brandController')

router.post('/', brandController.create)
router.get('/', brandController.getAll)
router.delete('/:id', brandController.delete);
router.put('/:id', brandController.update);

module.exports = router