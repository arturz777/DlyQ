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
  stripeCustomerId: { type: DataTypes.STRING, allowNull: true },
});

const Basket = sequelize.define("basket", {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
});

const BasketDevice = sequelize.define("basket_device", {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  selectedOptions: { type: DataTypes.JSONB, allowNull: true },
  variantId: { type: DataTypes.INTEGER, allowNull: true },
});

const Device = sequelize.define("device", {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  name: { type: DataTypes.STRING, unique: true, allowNull: false },
  price: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
  oldPrice: { type: DataTypes.DECIMAL(10, 2), allowNull: true },
  purchasePrice: { type: DataTypes.DECIMAL(10, 2), allowNull: true },
  purchaseHasVAT: { type: DataTypes.BOOLEAN, defaultValue: false },
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
  expiryKind: { type: DataTypes.STRING, allowNull: true, defaultValue: null },
  expiryDate: { type: DataTypes.DATEONLY, allowNull: true },
  snoozeUntil: { type: DataTypes.DATEONLY, allowNull: true },
  isVisible: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
});

const DeviceVariant = sequelize.define(
  "device_variant",
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    deviceId: { type: DataTypes.INTEGER, allowNull: false },
    key: { type: DataTypes.STRING, allowNull: false },
    selected: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
    sku: { type: DataTypes.STRING, allowNull: true },
    price: { type: DataTypes.DECIMAL(10, 2), allowNull: true },
    oldPrice: { type: DataTypes.DECIMAL(10, 2), allowNull: true },
    quantity: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    image: { type: DataTypes.STRING, allowNull: true },
    isActive: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
  },
  {
    indexes: [
      { fields: ["deviceId"] },
      { unique: true, fields: ["deviceId", "key"] },
    ],
  }
);

const DeviceSubType = sequelize.define(
  "device_subtype",
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    deviceId: { type: DataTypes.INTEGER, allowNull: false },
    subtypeId: { type: DataTypes.INTEGER, allowNull: false },
    isPrimary: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
  },
  {
    indexes: [
      { fields: ["deviceId"] },
      { fields: ["subtypeId"] },
      { unique: true, fields: ["deviceId", "subtypeId"] },
      { fields: ["isPrimary"] },
    ],
  }
);

const DeviceType = sequelize.define(
  "device_type",
  {
    deviceId: { type: DataTypes.INTEGER, allowNull: false },
    typeId: { type: DataTypes.INTEGER, allowNull: false },
  },
  {
    indexes: [
      { fields: ["deviceId"] },
      { fields: ["typeId"] },
      { unique: true, fields: ["deviceId", "typeId"] },
    ],
  }
);

const Type = sequelize.define("type", {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  name: { type: DataTypes.STRING, unique: true, allowNull: false },
  img: { type: DataTypes.STRING, allowNull: true },
  displayOrder: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
});

const VehicleMake = sequelize.define(
  "vehicle_make",
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    name: { type: DataTypes.STRING, allowNull: false, unique: true },
    displayOrder: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
  },
  {
    indexes: [{ fields: ["displayOrder"] }, { unique: true, fields: ["name"] }],
  }
);

const VehicleModel = sequelize.define(
  "vehicle_model",
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    name: { type: DataTypes.STRING, allowNull: false },
  },
  {
    indexes: [{ unique: true, fields: ["makeId", "name"] }],
  }
);

const DeviceCompatibility = sequelize.define(
  "device_compatibility",
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    yearFrom: { type: DataTypes.INTEGER, allowNull: true },
    yearTo: { type: DataTypes.INTEGER, allowNull: true },
    isUniversal: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
  },
  {
    indexes: [
      { fields: ["deviceId"] },
      { fields: ["makeId", "modelId"] },
      { fields: ["isUniversal"] },
    ],
  }
);

const SubType = sequelize.define("subtype", {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  name: { type: DataTypes.STRING, unique: true, allowNull: false },
  displayOrder: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
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
    deliveryPrice: { type: DataTypes.NUMERIC(10, 2), allowNull: false, defaultValue: 0 },
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
    receiptUrl: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    downloadToken: {
      type: DataTypes.STRING,
      allowNull: true,
    },
  },
  {
    timestamps: true,
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

const Translation = sequelize.define(
  "translation",
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    key: { type: DataTypes.STRING, allowNull: false },
    lang: { type: DataTypes.STRING(10), allowNull: false },
    text: { type: DataTypes.TEXT, allowNull: false },
  },
  {
    indexes: [{ unique: true, fields: ["key", "lang"] }],
  }
);

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
});

const Setting = sequelize.define('setting', {
  key: { type: DataTypes.STRING, primaryKey: true },
  value: { type: DataTypes.JSONB, allowNull: true },
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

Device.hasMany(DeviceVariant, {
  as: "variants",
  foreignKey: "deviceId",
  onDelete: "CASCADE",
});
DeviceVariant.belongsTo(Device, { foreignKey: "deviceId" });

Type.belongsToMany(Brand, { through: TypeBrand });
Brand.belongsToMany(Type, { through: TypeBrand });

Type.hasMany(SubType, { foreignKey: "typeId", as: "subtypes" });
SubType.belongsTo(Type, { foreignKey: "typeId", as: "type" });

Device.belongsToMany(SubType, {
  through: DeviceSubType,
  as: "subtypes",
  foreignKey: "deviceId",
  otherKey: "subtypeId",
});

SubType.belongsToMany(Device, {
  through: DeviceSubType,
  as: "m2mDevices",
  foreignKey: "subtypeId",
  otherKey: "deviceId",
});

Device.belongsToMany(Type, {
  through: DeviceType,
  as: "types",
  foreignKey: "deviceId",
  otherKey: "typeId",
});

Type.belongsToMany(Device, {
  through: DeviceType,
  as: "devicesM2M",
  foreignKey: "typeId",
  otherKey: "deviceId",
});

VehicleMake.hasMany(VehicleModel, {
  as: "models",
  foreignKey: "makeId",
  onDelete: "CASCADE",
});

VehicleModel.belongsTo(VehicleMake, {
  as: "make",
  foreignKey: "makeId",
});

Device.hasMany(DeviceCompatibility, {
  as: "compat",
  foreignKey: "deviceId",
  onDelete: "CASCADE",
});
DeviceCompatibility.belongsTo(Device, {
  foreignKey: "deviceId",
});

VehicleMake.hasMany(DeviceCompatibility, {
  as: "compat",
  foreignKey: "makeId",
  onDelete: "CASCADE",
});
DeviceCompatibility.belongsTo(VehicleMake, {
  as: "make",
  foreignKey: "makeId",
});

VehicleModel.hasMany(DeviceCompatibility, {
  as: "compat",
  foreignKey: "modelId",
  onDelete: "CASCADE",
});
DeviceCompatibility.belongsTo(VehicleModel, {
  as: "model",
  foreignKey: "modelId",
});

module.exports = {
  User,
  Basket,
  BasketDevice,
  Device,
  DeviceVariant,
  DeviceSubType,
  Type,
  DeviceType,
  VehicleMake,
  VehicleModel,
  DeviceCompatibility,
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
  Setting,
};
