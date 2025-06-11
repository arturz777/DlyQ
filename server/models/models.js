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
  oldPrice: { type: DataTypes.INTEGER, allowNull: true },
  rating: { type: DataTypes.INTEGER, defaultValue: 0 },
  img: { type: DataTypes.STRING, allowNull: false },
  thumbnails: { type: DataTypes.JSONB, allowNull: true, defaultValue: [] },
  subtypeId: { type: DataTypes.INTEGER, allowNull: true },
  options: { type: DataTypes.JSONB, allowNull: true, defaultValue: [] },
  quantity: { type: DataTypes.INTEGER, defaultValue: 0 },
  isNew: { type: DataTypes.BOOLEAN, defaultValue: false },
  discount: { type: DataTypes.BOOLEAN, defaultValue: false },
  recommended: { type: DataTypes.BOOLEAN, defaultValue: false },
  description: { type: DataTypes.TEXT, allowNull: true },
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
    desiredDeliveryDate: { type: DataTypes.DATE, allowNull: true },
    preferredDeliveryComment: { type: DataTypes.TEXT, allowNull: true },
    processingTime: { type: DataTypes.STRING, allowNull: true },
    formData: { type: DataTypes.JSON, allowNull: true },
    orderDetails: { type: DataTypes.JSON, allowNull: true },
    courierId: { type: DataTypes.INTEGER, allowNull: true },
    pickupStartTime: { type: DataTypes.DATE, allowNull: true },
    estimatedTime: { type: DataTypes.INTEGER, allowNull: true },
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
  currentLat: { type: DataTypes.FLOAT, allowNull: true },
  currentLng: { type: DataTypes.FLOAT, allowNull: true },
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

const Chat = sequelize.define("chat", {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  type: {
    type: DataTypes.ENUM("support", "delivery"),
    allowNull: false,
  },
  orderId: { type: DataTypes.INTEGER, allowNull: true },
});

const ChatParticipant = sequelize.define("chatParticipant", {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  userId: { type: DataTypes.INTEGER, allowNull: false },
  role: {
    type: DataTypes.ENUM("client", "courier", "admin", "warehouse"),
    allowNull: false,
  },
});

const ChatMessage = sequelize.define("chatMessage", {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  chatId: { type: DataTypes.INTEGER, allowNull: false },
  senderId: { type: DataTypes.INTEGER, allowNull: false },
  senderRole: {
    type: DataTypes.ENUM("client", "courier", "admin", "warehouse"),
    allowNull: false,
  },
  text: { type: DataTypes.TEXT, allowNull: false },
  isRead: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
  },
  }, {
  tableName: "chatMessages"
});

Chat.hasMany(ChatParticipant, { as: "participants" });
ChatParticipant.belongsTo(Chat);

Chat.hasMany(ChatMessage, { as: "messages" });
ChatMessage.belongsTo(Chat);

User.hasMany(ChatParticipant, { foreignKey: "userId" });
ChatParticipant.belongsTo(User, { foreignKey: "userId", as: "user" });

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
  Chat,
  ChatParticipant,
  ChatMessage,
};
