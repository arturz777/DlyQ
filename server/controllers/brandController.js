const {Brand} = require('../models/models')
const ApiError = require('../error/ApiError')

class BrandController {
	async create(req, res) {
		const {name} = req.body
		const brand = await Brand.create({name})
		return res.json(brand)

	}
	async getAll(req, res) {
			const brands = await Brand.findAll()
			return res.json(brands)
	}

	async update(req, res) {
		try {
		  const { id } = req.params;
		  const { name } = req.body;
	  
		  // Проверка существования бренда
		  const brand = await Brand.findOne({ where: { id } });
		  if (!brand) {
			return res.status(404).json({ message: 'Бренд не найден' });
		  }
	  
		  // Обновление данных
		  await Brand.update({ name }, { where: { id } });
	  
		  const updatedBrand = await Brand.findOne({ where: { id } });
		  return res.status(200).json(updatedBrand);
		} catch (error) {
		  console.error(error);
		  return res.status(500).json({ message: 'Ошибка при обновлении бренда' });
		}
	  }

	async delete(req, res) {
		try {
		  const { id } = req.params; // Получаем ID из параметров
		  const brand = await Brand.findOne({ where: { id } }); // Проверяем, существует ли бренд
		  if (!brand) {
			return res.status(404).json({ message: 'Бренд не найден' });
		  }
	
		  await Brand.destroy({ where: { id } }); // Удаляем бренд
		  return res.status(200).json({ message: 'Бренд успешно удален' });
		} catch (error) {
		  console.error(error);
		  return res.status(500).json({ message: 'Ошибка при удалении бренда' });
		}
	  }
	
	
}

module.exports = new BrandController()