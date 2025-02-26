const {Type} = require('../models/models');
const ApiError = require('../error/ApiError');
const { supabase } = require('../config/supabaseClient');
const uuid = require('uuid');

class TypeController {
	
	async create(req, res, next) {
		try {
			const { name, img } = req.body;
	
			// Проверка, переданы ли обязательные параметры
			if (!name) {
				return res.status(400).json({ message: "Поле 'name' обязательно" });
			}
	
			let imgUrl = null;
			if (req.files && req.files.img) {
			  const { img } = req.files;
			  const fileName = `${uuid.v4()}${img.name.substring(img.name.lastIndexOf('.'))}`;
	  
			  const { error } = await supabase.storage
				.from('images')
				.upload(fileName, img.data, { contentType: img.mimetype });
	  
			  if (error) {
				throw new Error("Ошибка загрузки изображения в Supabase");
			  }
	  
			  imgUrl = `https://ujsitjkochexlcqrwxan.supabase.co/storage/v1/object/public/images/${fileName}`;
			}
	  
			const type = await Type.create({ name, img: imgUrl });
	  
			return res.status(201).json(type);
		  } catch (error) {
			console.error('Ошибка при создании типа:', error.message);
			next(ApiError.badRequest(error.message));
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

	  let imgUrl = type.img;

      if (req.files && req.files.img) {
        if (type.img) {
          const oldFileName = type.img.split("/").pop();
          await supabase.storage.from("images").remove([oldFileName]);
        }

        const { img } = req.files;
        const newFileName = `${uuid.v4()}${img.name.substring(img.name.lastIndexOf('.'))}`;

        const { error } = await supabase.storage
          .from('images')
          .upload(newFileName, img.data, { contentType: img.mimetype });

        if (error) {
          throw new Error("Ошибка загрузки нового изображения в Supabase");
        }

        imgUrl = `https://ujsitjkochexlcqrwxan.supabase.co/storage/v1/object/public/images/${newFileName}`;
      }

      await type.update({ name, img: imgUrl });

      return res.status(200).json(type);
    } catch (error) {
      console.error('Ошибка при редактировании типа:', error.message);
      next(ApiError.badRequest(error.message));
    }
  }


	async getAll(req, res) {
		const types = await Type.findAll()
		return res.json(types)

	}

	async delete(req, res) {
		try {
		  const { id } = req.params; 
		  const type = await Type.findOne({ where: { id } }); 

		  if (!type) {
			return res.status(404).json({ message: 'Тип не найден' });
		  }

		  if (type.img) {
			const fileName = type.img.split("/").pop();
			await supabase.storage.from('images').remove([fileName]);
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
