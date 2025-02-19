const {Type} = require('../models/models')
const ApiError = require('../error/ApiError')
const fs = require('fs');
const path = require('path');

class TypeController {
	
	async create(req, res, next) {
		try {
			const { name, img } = req.body;
	
			// Проверка, переданы ли обязательные параметры
			if (!name) {
				return res.status(400).json({ message: "Поле 'name' обязательно" });
			}
	
			// Если требуется обработка изображения (например, загрузка файла)
			let imgFileName = null;
			if (req.files && req.files.img) {
				const { img } = req.files;
				const uuid = require('uuid');
				const path = require('path');
	
				imgFileName = uuid.v4() + path.extname(img.name); // Генерация уникального имени файла
				const staticPath = path.resolve(__dirname, '..', 'static', imgFileName);
	
				// Сохранение файла
				await img.mv(staticPath);
			}
	
			// Создание записи в таблице Type
			const type = await Type.create({ name, img: imgFileName });
	
			// Возвращение результата
			return res.status(201).json(type);
		} catch (error) {
			console.error('Ошибка при создании типа:', error.message);
			next(error); // Передача ошибки для обработки в middleware
		}
	}

 // Метод для редактирования типа
 async update(req, res) {
    try {
      const { id } = req.params; // Получаем ID типа из параметров
      const { name, img } = req.body;

      const type = await Type.findOne({ where: { id } });
      if (!type) {
        return res.status(404).json({ message: 'Тип не найден' });
      }

      // Обработка нового изображения
      let imgFileName = type.img; // Оставляем старое изображение, если новое не пришло
      if (req.files && req.files.img) {
        const { img } = req.files;
        const uuid = require('uuid');
        const path = require('path');

        imgFileName = uuid.v4() + path.extname(img.name); // Генерация нового имени файла
        const staticPath = path.resolve(__dirname, '..', 'static', imgFileName);

        // Сохранение нового изображения
        await img.mv(staticPath);
      }

      // Обновление записи в таблице Type
      const updatedType = await type.update({
        name: name || type.name, // Если имя не передано, оставляем старое
        img: imgFileName,
      });

      // Возвращаем обновленный тип
      return res.status(200).json(updatedType);
    } catch (error) {
      console.error('Ошибка при редактировании типа:', error.message);
      next(error); // Передача ошибки в middleware
    }
  }


	async getAll(req, res) {
		const types = await Type.findAll()
		return res.json(types)

	}

	async delete(req, res) {
		try {
		  const { id } = req.params; // Получаем ID из параметров

		  const type = await Type.findOne({ where: { id } }); // Проверяем, существует ли тип

		  if (!type) {
			return res.status(404).json({ message: 'Тип не найден' });
		  }

		  if (type.img) {
			const imagePath = path.resolve(__dirname, '..', 'static', type.img);

			fs.unlink(imagePath, (err) => {
				if (err) {
				  console.error('Ошибка при удалении изображения типа:', err);
				} else {
				  console.log('Изображение типа удалено:', imagePath);
				}
			  });
			}
	
		  await Type.destroy({ where: { id } }); // Удаляем тип

		  return res.status(200).json({ message: 'Тип успешно удален' });
		} catch (error) {
		  console.error(error);
		  return res.status(500).json({ message: 'Ошибка при удалении типа' });
		}
	  }
	
}

module.exports = new TypeController()