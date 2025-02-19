const Router = require('express'); // Подключаем express
const router = new Router(); // Создаем новый маршрутизатор
const subtypeController = require('../controllers/subtypeController'); // Подключаем контроллер

// Маршруты для работы с подтипами
router.post('/', subtypeController.create); // Создание подтипа
router.get('/', subtypeController.getAll); // Получение всех подтипов
router.get('/:typeId', subtypeController.getByType); // Получение подтипов по типу
router.put('/:id', subtypeController.update); // Обновление подтипа
router.delete('/:id', subtypeController.delete); // Удаление подтипа

module.exports = router; // Экспортируем маршрутизатор
