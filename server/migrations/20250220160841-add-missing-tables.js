'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('users', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      email: { type: Sequelize.STRING, unique: true },
      password: { type: Sequelize.STRING },
      role: { type: Sequelize.STRING, defaultValue: 'USER' },
      firstName: { type: Sequelize.STRING },
      lastName: { type: Sequelize.STRING },
      phone: { type: Sequelize.STRING },
    });

    await queryInterface.createTable('baskets', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
    });

    await queryInterface.createTable('basket_devices', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      selectedOptions: { type: Sequelize.JSONB, allowNull: true },
    });

    await queryInterface.createTable('devices', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      name: { type: Sequelize.STRING, unique: true, allowNull: false },
      price: { type: Sequelize.INTEGER, allowNull: false },
      rating: { type: Sequelize.INTEGER, defaultValue: 0 },
      img: { type: Sequelize.STRING, allowNull: false },
      thumbnails: { type: Sequelize.JSONB, allowNull: true, defaultValue: [] },
      subtypeId: { type: Sequelize.INTEGER, allowNull: true },
      options: { type: Sequelize.JSONB, allowNull: true, defaultValue: [] },
      quantity: { type: Sequelize.INTEGER, defaultValue: 0 },
    });

    await queryInterface.createTable('types', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      name: { type: Sequelize.STRING, unique: true, allowNull: false },
      img: { type: Sequelize.STRING, allowNull: true },
    });

    await queryInterface.createTable('subtypes', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      name: { type: Sequelize.STRING, unique: true, allowNull: false },
    });

    await queryInterface.createTable('brands', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      name: { type: Sequelize.STRING, unique: true, allowNull: false },
    });

    await queryInterface.createTable('ratings', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      rate: { type: Sequelize.INTEGER, allowNull: false },
    });

    await queryInterface.createTable('device_info', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      title: { type: Sequelize.STRING, allowNull: false },
      description: { type: Sequelize.STRING, allowNull: false },
    });

    await queryInterface.createTable('type_brands', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
    });

    await queryInterface.createTable('orders', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      userId: { type: Sequelize.INTEGER, allowNull: true },
      totalPrice: { type: Sequelize.NUMERIC(10, 2), allowNull: false },
      status: { type: Sequelize.STRING, defaultValue: 'Pending' },
      warehouseStatus: { type: Sequelize.STRING, defaultValue: 'pending' },
      processingTime: { type: Sequelize.STRING, allowNull: true },
      formData: { type: Sequelize.JSON, allowNull: true },
      orderDetails: { type: Sequelize.JSON, allowNull: true },
      courierId: { type: Sequelize.INTEGER, allowNull: true },
      deliveryLat: { type: Sequelize.FLOAT, allowNull: true },
      deliveryLng: { type: Sequelize.FLOAT, allowNull: true },
      deliveryAddress: { type: Sequelize.STRING, allowNull: false },
      deviceImage: { type: Sequelize.STRING, allowNull: false, defaultValue: 'https://example.com/placeholder.png' },
      productName: { type: Sequelize.STRING, allowNull: false },
      createdAt: { type: Sequelize.DATE, allowNull: false },
updatedAt: { type: Sequelize.DATE, allowNull: false },

    });

    await queryInterface.createTable('couriers', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      name: { type: Sequelize.STRING, allowNull: false },
      status: { type: Sequelize.STRING, defaultValue: 'offline' },
    });

    await queryInterface.createTable('warehouses', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      name: { type: Sequelize.STRING, allowNull: false },
      status: { type: Sequelize.STRING, defaultValue: 'offline' },
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('users');
    await queryInterface.dropTable('baskets');
    await queryInterface.dropTable('basket_devices');
    await queryInterface.dropTable('devices');
    await queryInterface.dropTable('types');
    await queryInterface.dropTable('subtypes');
    await queryInterface.dropTable('brands');
    await queryInterface.dropTable('ratings');
    await queryInterface.dropTable('device_info');
    await queryInterface.dropTable('type_brands');
    await queryInterface.dropTable('orders');
    await queryInterface.dropTable('couriers');
    await queryInterface.dropTable('warehouses');
  },
};
