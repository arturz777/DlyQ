const sequelize = require("../db");
const { DataTypes } = require("sequelize");

const User = sequelize.define("user", {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  email: { type: DataTypes.STRING, unique: true },
  password: { type: DataTypes.STRING },
  role: { type: DataTypes.STRING, defaultValue: "USER" },
  firstName: { type: DataTypes.STRING },
  lastName: { type: DataTypes.STRING },
  phone: { type: DataTypes.STRING },
});

const Basket = sequelize.define("basket", {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
});

const BasketDevice = sequelize.define("basket_device", {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  selectedOptions: { type: DataTypes.JSONB, allowNull: true },
});

const Device = sequelize.define("device", {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  name: { type: DataTypes.STRING, unique: true, allowNull: false },
  price: { type: DataTypes.INTEGER, allowNull: false },
  rating: { type: DataTypes.INTEGER, defaultValue: 0 },
  img: { type: DataTypes.STRING, allowNull: false },
  thumbnails: { type: DataTypes.JSONB, allowNull: true, defaultValue: [] },
  subtypeId: { type: DataTypes.INTEGER, allowNull: true },
  options: { type: DataTypes.JSONB, allowNull: true, defaultValue: [] },
  quantity: { type: DataTypes.INTEGER, defaultValue: 0 },
});

const Type = sequelize.define("type", {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  name: { type: DataTypes.STRING, unique: true, allowNull: false },
  img: { type: DataTypes.STRING, allowNull: true },
});

const SubType = sequelize.define("subtype", {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  name: { type: DataTypes.STRING, unique: true, allowNull: false },
});

const Brand = sequelize.define("brand", {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  name: { type: DataTypes.STRING, unique: true, allowNull: false },
});

const Rating = sequelize.define("rating", {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  rate: { type: DataTypes.INTEGER, allowNull: false },
});

const DeviceInfo = sequelize.define("device_info", {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  title: { type: DataTypes.STRING, allowNull: false },
  description: { type: DataTypes.STRING, allowNull: false },
});

const TypeBrand = sequelize.define("type_brand", {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
});

const Order = sequelize.define(
  "order",
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    userId: { type: DataTypes.INTEGER, allowNull: true },
    totalPrice: { type: DataTypes.NUMERIC(10, 2), allowNull: false },
    status: { type: DataTypes.STRING, defaultValue: "Pending" },
    warehouseStatus: { type: DataTypes.STRING, defaultValue: "pending" },
    processingTime: { type: DataTypes.STRING, allowNull: true },
    formData: { type: DataTypes.JSON, allowNull: true },
    orderDetails: { type: DataTypes.JSON, allowNull: true },
    courierId: { type: DataTypes.INTEGER, allowNull: true },
    deliveryLat: { type: DataTypes.FLOAT, allowNull: true },
    deliveryLng: { type: DataTypes.FLOAT, allowNull: true },
    deliveryAddress: { type: DataTypes.STRING, allowNull: false },
    deviceImage: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: "https://example.com/placeholder.png",
    },
    productName: { type: DataTypes.STRING, allowNull: false },
  },
  {
    timestamps: true,
    createdAt: "createdAt", 
  updatedAt: "updatedAt",
  }
);

const Courier = sequelize.define("courier", {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  name: { type: DataTypes.STRING, allowNull: false },
  status: { type: DataTypes.STRING, defaultValue: "offline" },
});

const Warehouse = sequelize.define("warehouse", {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  name: { type: DataTypes.STRING, allowNull: false },
  status: { type: DataTypes.STRING, defaultValue: "offline" },
});

const Translation = sequelize.define("translation", {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  key: { type: DataTypes.STRING, allowNull: false },
  lang: { type: DataTypes.STRING(10), allowNull: false },
  text: { type: DataTypes.TEXT, allowNull: false },
}, {
  indexes: [{ unique: true, fields: ["key", "lang"] }]
});

Warehouse.hasMany(Order);
Order.belongsTo(Warehouse);

Courier.hasMany(Order);
Order.belongsTo(Courier);

User.hasMany(Order);
Order.belongsTo(User);

User.hasOne(Basket);
Basket.belongsTo(User);

User.hasMany(Rating);
Rating.belongsTo(User);

Basket.hasMany(BasketDevice);
BasketDevice.belongsTo(Basket);

Type.hasMany(Device);
Device.belongsTo(Type);

SubType.hasMany(Device, { foreignKey: "subtypeId", as: "devices" });
Device.belongsTo(SubType, { foreignKey: "subtypeId", as: "subtype" });

Brand.hasMany(Device);
Device.belongsTo(Brand);

Device.hasMany(Rating);
Rating.belongsTo(Device);

Device.hasMany(BasketDevice);
BasketDevice.belongsTo(Device);

Device.hasMany(DeviceInfo, { as: "info" });
DeviceInfo.belongsTo(Device);

Type.belongsToMany(Brand, { through: TypeBrand });
Brand.belongsToMany(Type, { through: TypeBrand });

Type.hasMany(SubType, { foreignKey: "typeId", as: "subtypes" });
SubType.belongsTo(Type, { foreignKey: "typeId", as: "type" });

module.exports = {
  User,
  Basket,
  BasketDevice,
  Device,
  Type,
  SubType,
  Brand,
  Rating,
  TypeBrand,
  DeviceInfo,
  Order,
  Courier,
  Warehouse,
  Translation,
};
