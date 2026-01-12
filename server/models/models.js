const sequelize = require("../db");
const { DataTypes, literal } = require("sequelize");

const SellerUser = sequelize.define("seller_user", {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  sellerId: { type: DataTypes.INTEGER, allowNull: false },
  userId: { type: DataTypes.INTEGER, allowNull: false },
  roleInSeller: { type: DataTypes.STRING, defaultValue: "owner" },
});

const Seller = sequelize.define("seller", {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  name: { type: DataTypes.STRING, allowNull: false },
  slug: { type: DataTypes.STRING, allowNull: true, unique: true },
  kind: { type: DataTypes.STRING, allowNull: true },
  img: { type: DataTypes.STRING, allowNull: true },
  isActive: { type: DataTypes.BOOLEAN, defaultValue: true },
  address: { type: DataTypes.STRING, allowNull: true },
  pickupLat: { type: DataTypes.DOUBLE, allowNull: true },
  pickupLng: { type: DataTypes.DOUBLE, allowNull: true },
});

const MenuCategory = sequelize.define("menu_category", {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  sellerId: { type: DataTypes.INTEGER, allowNull: false },
  img: { type: DataTypes.STRING, allowNull: true },
  name: { type: DataTypes.STRING, allowNull: false },
  displayOrder: { type: DataTypes.INTEGER, defaultValue: 0 },
  isActive: { type: DataTypes.BOOLEAN, defaultValue: true },
});

const MenuItem = sequelize.define("menu_item", {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  sellerId: { type: DataTypes.INTEGER, allowNull: false },
  categoryId: { type: DataTypes.INTEGER, allowNull: true },

  name: { type: DataTypes.STRING, allowNull: false },
  description: { type: DataTypes.TEXT, allowNull: true },
  price: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
  img: { type: DataTypes.STRING, allowNull: true },

  isAvailable: { type: DataTypes.BOOLEAN, defaultValue: true },
  displayOrder: { type: DataTypes.INTEGER, defaultValue: 0 },
  isActive: { type: DataTypes.BOOLEAN, defaultValue: true },
});

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
  sellerId: { type: DataTypes.INTEGER, allowNull: true },
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
    purchasePrice: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: true,
      field: "purchasePrice",
      validate: { min: 0 },
    },

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
    sellerId: { type: DataTypes.INTEGER, allowNull: true },
    totalPrice: { type: DataTypes.NUMERIC(10, 2), allowNull: false },
    deliveryPrice: {
      type: DataTypes.NUMERIC(10, 2),
      allowNull: false,
      defaultValue: 0,
    },
    courierFee: {
      type: DataTypes.NUMERIC(10, 2),
      allowNull: true,
      defaultValue: 0,
    },
    courierFeeGross: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
      defaultValue: null,
    },

    courierCommission: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
      defaultValue: null,
    },

    courierCommissionRate: {
      type: DataTypes.DECIMAL(5, 4),
      allowNull: true,
      defaultValue: null,
    },
    status: { type: DataTypes.STRING, defaultValue: "Pending" },
    warehouseStatus: { type: DataTypes.STRING, defaultValue: "pending" },
    desiredDeliveryDate: { type: DataTypes.DATE, allowNull: true },
    preferredDeliveryComment: { type: DataTypes.TEXT, allowNull: true },
    processingTime: { type: DataTypes.STRING, allowNull: true },
    processingStartTime: { type: DataTypes.DATE, allowNull: true },
    formData: { type: DataTypes.JSON, allowNull: true },
    orderDetails: { type: DataTypes.JSON, allowNull: true },
    courierId: { type: DataTypes.INTEGER, allowNull: true },
    pickupStartTime: { type: DataTypes.DATE, allowNull: true },
    estimatedTime: { type: DataTypes.INTEGER, allowNull: true },
    deliveryLat: { type: DataTypes.FLOAT, allowNull: true },
    deliveryLng: { type: DataTypes.FLOAT, allowNull: true },
    deliveryAddress: { type: DataTypes.STRING, allowNull: false },
    deliveryChatId: { type: DataTypes.BIGINT, allowNull: true },
    sellerChatId: { type: DataTypes.INTEGER, allowNull: true },
    orderType: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: "shop",
    },
    pickupAddress: { type: DataTypes.STRING, allowNull: true },
    pickupLat: { type: DataTypes.FLOAT, allowNull: true },
    pickupLng: { type: DataTypes.FLOAT, allowNull: true },
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
    offerCourierId: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    offerExpiresAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    preorderReason: {
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
  expoPushToken: { type: DataTypes.STRING, allowNull: true },
  offersSent: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  offersAccepted: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
  },
});

const Warehouse = sequelize.define("warehouse", {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  name: { type: DataTypes.STRING, allowNull: false },
  status: { type: DataTypes.STRING, defaultValue: "offline" },
  expoPushToken: { type: DataTypes.STRING, allowNull: true },
  sellerId: { type: DataTypes.INTEGER, allowNull: true },
});

const OrderDecline = sequelize.define(
  "OrderDecline",
  {
    id: {
      type: DataTypes.BIGINT,
      autoIncrement: true,
      primaryKey: true,
    },
    orderId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: "orderId",
    },
    courierId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: "courierId",
    },
  },
  {
    tableName: "order_decline",
    timestamps: true,
    indexes: [
      {
        unique: true,
        fields: ["orderId", "courierId"],
      },
    ],
  }
);

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

const Chat = sequelize.define(
  "chat",
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    type: {
      type: DataTypes.ENUM(
        "support",
        "delivery",
        "restaurant",
        "seller",
        "warehouse"
      ),
      allowNull: false,
    },
    orderId: { type: DataTypes.INTEGER, allowNull: true },
    closedAt: { type: DataTypes.DATE, allowNull: true },
    supportKey: { type: DataTypes.STRING, allowNull: true },
  },
  {
    indexes: [
      { unique: true, fields: ["type", "orderId"] },
      { unique: true, fields: ["type", "supportKey"] },
    ],
  }
);

const ChatParticipant = sequelize.define(
  "chatParticipant",
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    chatId: { type: DataTypes.INTEGER, allowNull: false },
    userId: { type: DataTypes.INTEGER, allowNull: false },
    role: {
      type: DataTypes.ENUM("client", "courier", "admin", "warehouse"),
      allowNull: false,
    },
  },
  {
    indexes: [
      { unique: true, fields: ["chatId", "userId"] },
      { fields: ["userId"] },
    ],
  }
);

const ChatMessage = sequelize.define(
  "chatMessage",
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    chatId: { type: DataTypes.INTEGER, allowNull: false },
    senderId: { type: DataTypes.INTEGER, allowNull: false },
    senderRole: {
      type: DataTypes.ENUM("client", "courier", "admin", "warehouse"),
      allowNull: false,
    },
    text: { type: DataTypes.TEXT, allowNull: false },
    isRead: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  },
  {
    indexes: [{ fields: ["chatId"] }, { fields: ["chatId", "createdAt"] }],
  }
);

const Setting = sequelize.define("setting", {
  key: { type: DataTypes.STRING, primaryKey: true },
  value: { type: DataTypes.JSONB, allowNull: true },
});

const InventoryReceipt = sequelize.define(
  "inventory_receipt",
  {
    id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
    receiptAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
      field: "receipt_at",
    },
    dayKey: {
      type: DataTypes.DATEONLY,
      allowNull: false,
      field: "day_key",
      defaultValue: literal("CURRENT_DATE"),
    },
    kind: {
      type: DataTypes.STRING(10),
      allowNull: false,
      defaultValue: "IN",
      validate: { isIn: [["IN", "OUT"]] },
    },
    supplier: { type: DataTypes.STRING, allowNull: true },
    note: { type: DataTypes.TEXT, allowNull: true },
    createdBy: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: "created_by",
    },
  },
  {
    tableName: "inventory_receipts",
    timestamps: false,
    indexes: [{ fields: ["receipt_at"] }],
  }
);

const InventoryReceiptItem = sequelize.define(
  "inventory_receipt_item",
  {
    id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },

    receiptId: {
      type: DataTypes.BIGINT,
      allowNull: false,
      field: "receipt_id",
    },
    deviceId: { type: DataTypes.INTEGER, allowNull: false, field: "device_id" },
    variantId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: "variant_id",
    },

    quantity: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },

    purchasePrice: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      validate: { min: 0 },
      field: "purchase_price",
    },
    purchaseHasVAT: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      field: "purchase_has_vat",
    },
  },
  {
    tableName: "inventory_receipt_items",
    timestamps: false,
    indexes: [
      { fields: ["receipt_id"] },
      { fields: ["device_id"] },
      { fields: ["variant_id"] },
    ],
  }
);

InventoryReceipt.hasMany(InventoryReceiptItem, {
  as: "items",
  foreignKey: "receiptId",
  onDelete: "CASCADE",
});
InventoryReceiptItem.belongsTo(InventoryReceipt, {
  foreignKey: "receiptId",
  as: "receipt",
});

Device.hasMany(InventoryReceiptItem, {
  as: "receiptItems",
  foreignKey: "deviceId",
});
InventoryReceiptItem.belongsTo(Device, {
  foreignKey: "deviceId",
  as: "device",
});

DeviceVariant.hasMany(InventoryReceiptItem, {
  as: "receiptItems",
  foreignKey: "variantId",
});
InventoryReceiptItem.belongsTo(DeviceVariant, {
  foreignKey: "variantId",
  as: "variant",
});

Seller.hasMany(MenuCategory, { foreignKey: "sellerId", as: "menuCategories" });
MenuCategory.belongsTo(Seller, { foreignKey: "sellerId", as: "seller" });

Seller.hasMany(MenuItem, { foreignKey: "sellerId", as: "menuItems" });
MenuItem.belongsTo(Seller, { foreignKey: "sellerId", as: "seller" });

MenuCategory.hasMany(MenuItem, { foreignKey: "categoryId", as: "items" });
MenuItem.belongsTo(MenuCategory, {
  foreignKey: "categoryId",
  as: "category",
});

Chat.hasMany(ChatParticipant, {
  as: "participants",
  foreignKey: "chatId",
  onDelete: "CASCADE",
});
ChatParticipant.belongsTo(Chat, { foreignKey: "chatId" });

Chat.hasMany(ChatMessage, {
  as: "messages",
  foreignKey: "chatId",
  onDelete: "CASCADE",
});
ChatMessage.belongsTo(Chat, { foreignKey: "chatId" });

User.hasMany(ChatParticipant, { foreignKey: "userId" });
ChatParticipant.belongsTo(User, { foreignKey: "userId", as: "user" });

Order.belongsTo(Chat, { as: "deliveryChat", foreignKey: "deliveryChatId" });
Order.belongsTo(Chat, { as: "restaurantChat", foreignKey: "restaurantChatId" });

User.belongsToMany(Seller, {
  through: SellerUser,
  as: "sellers",
  foreignKey: "userId",
  otherKey: "sellerId",
});

Seller.belongsToMany(User, {
  through: SellerUser,
  as: "users",
  foreignKey: "sellerId",
  otherKey: "userId",
});

Seller.hasMany(SellerUser, {
  foreignKey: "sellerId",
  as: "members",
});

SellerUser.belongsTo(Seller, {
  foreignKey: "sellerId",
  as: "seller",
});

User.hasMany(SellerUser, {
  foreignKey: "userId",
  as: "sellerLinks",
});

SellerUser.belongsTo(User, {
  foreignKey: "userId",
  as: "user",
});

Warehouse.hasMany(Order);
Order.belongsTo(Warehouse);

Courier.hasMany(Order);
Order.belongsTo(Courier);

User.hasMany(Order);
Order.belongsTo(User);

Seller.hasMany(Order);
Order.belongsTo(Seller);

User.hasOne(Basket);
Basket.belongsTo(User);

User.hasMany(Rating);
Rating.belongsTo(User);

Basket.hasMany(BasketDevice);
BasketDevice.belongsTo(Basket);

Seller.hasMany(Device);
Device.belongsTo(Seller);

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
  OrderDecline,
  Seller,
  MenuCategory,
  MenuItem,
  SellerUser,
  InventoryReceipt,
  InventoryReceiptItem,
};
