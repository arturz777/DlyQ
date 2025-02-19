// server/tasks.js
const schedule = require('node-schedule');
const { Op } = require('sequelize');
const fs = require('fs');
const path = require('path');
const { Order } = require('./models/models'); // Подключаем модель Order

const setupCleanupTask = () => {
    // Удаление истории заказов минута- '* * * * *' 30 дней- '0 0 1 * *'
    schedule.scheduleJob('0 0 1 * *', async () => {
        try {
            const cutoffDate = new Date(new Date().getTime() - 30 * 24 * 60 * 60 * 1000); // // какие заказы считаются "старыми". старше 30 дней - 30 * 24 * 60 * 60 * 1000 , Старше минуты-  - 1 * 60 * 1000

            // Находим заказы старше 30 дней
            const ordersToDelete = await Order.findAll({
                where: {
                    createdAt: { [Op.lt]: cutoffDate },
                },
            });

            // Удаляем файлы изображений, связанные с заказами
            ordersToDelete.forEach((order) => {
                if (
                    order.deviceImage &&
                    !order.deviceImage.includes("placeholder.png") &&
                    order.deviceImage.startsWith("orders/") // ✅ Удаляем только фото заказов
                ) {
                    const filePath = path.resolve(__dirname, "static", order.deviceImage);
                    if (fs.existsSync(filePath)) {
                        console.log(`🗑 Удаляем изображение заказа: ${filePath}`);
                        fs.unlinkSync(filePath);
                    } else {
                        console.warn(`⚠️ Файл не найден: ${filePath}`);
                    }
                }
            });

            // Удаляем записи из базы данных
            const deletedCount = await Order.destroy({
                where: {
                    createdAt: { [Op.lt]: cutoffDate },
                },
            });

            console.log(`✅ Удалено заказов: ${deletedCount}`);
        } catch (error) {
            console.error("❌ Ошибка при удалении старых заказов:", error);
        }
    });
};

module.exports = setupCleanupTask;
