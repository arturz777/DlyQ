const sendEmail = require("../services/emailService");
const { Order, Device, Translation, Courier } = require("../models/models");
const { Op } = require("sequelize");
const fs = require("fs");
const os = require("os");
const path = require("path");
const pdfPath = path.join(__dirname, "../temp/receipt.pdf");
const { t } = require("../utils/translations");
const getDistanceFromWarehouse = require("../utils/distance");
const generatePDFReceipt = require("../services/generatePDFReceipt");
const { supabase } = require("../config/supabaseClient");
const uuid = require("uuid");

const calculateDeliveryCost = (totalPrice, distance) => {
  let baseCost = 2;
  let distanceCost = distance * 0.5;
  let deliveryCost = baseCost + distanceCost;
  let discount = Math.floor(totalPrice / 30) * 2;

  deliveryCost = Math.max(0, deliveryCost - discount);
  return parseFloat(deliveryCost.toFixed(2));
};

const downloadReceipt = async (req, res) => {
  try {
    const orderId = req.params.id;
    const tokenFromQuery = req.query.token;

    const order = await Order.findByPk(orderId);
    if (!order) {
      return res.status(404).json({ message: "Заказ не найден." });
    }

    if (!tokenFromQuery || tokenFromQuery !== order.downloadToken) {
      return res.status(403).json({ message: "Нет доступа к чеку." });
    }

    const orderDetails = JSON.parse(order.orderDetails || "[]");
    const formData = JSON.parse(order.formData || "{}");
    const subtotal = parseFloat(order.totalPrice) || 0;
    const totalWithVAT = parseFloat(order.totalPrice);
    const vatRate = 0.22;
    const priceWithoutVAT = totalWithVAT / (1 + vatRate);
    const vatAmount = totalWithVAT - priceWithoutVAT;

    const generateSummaryItems = (items, orderDetails, language) => {
      return items
        .map((item) => {
          const options =
            item.selectedOptions && Object.keys(item.selectedOptions).length > 0
              ? Object.entries(item.selectedOptions)
                  .map(([key, value]) => `${key}: ${value}`)
                  .join(", ")
              : "Без опций";

          return `
            <div style="display:flex; justify-content:space-between; margin-bottom:12px;">
              <div>
                ${item.name}
                <div style="font-size:0.85em; color:#777;">${options}</div>
              </div>
                <div style="white-space:nowrap;"><strong>${item.price} €</strong></div>
            </div>
          `;
        })
        .join("");
    };

    const receiptHTML = `
      <div style="max-width:600px; margin:0 auto; font-family:Arial, sans-serif; font-size:14px; padding:20px; border:1px solid #ccc; border-radius:8px; background:#fff;">

  <h2 style="text-align:center; margin-bottom:30px; font-size:20px;">kviitung DlyQ</h2>

  <div style="display:flex; justify-content:space-between; margin-bottom:25px; line-height:1.6; font-size:14px;">
    <div style="width:48%;">
      <strong>Ostja:</strong><br>
      ${formData.firstName || ""} ${formData.lastName || ""}<br>
      ${formData.email || ""}<br>
      ${formData.phone || ""}<br>
      Адрес: ${formData.address || ""}, ${formData.apartment || ""}
    </div>
    <div style="width:48%; text-align:right;">
        <strong>Müüja:</strong><br>
      DLYQ OÜ<br>
      Kviitungi number: #${order.id}<br>
      Kuupäev: ${new Date(order.createdAt).toLocaleString("et-EE")}<br>
      Tallinn, Eesti<br>
      Registrikood: <strong>17268052</strong><br>
      KMKR: <strong>EE102873957</strong><br>
      info@dlyq.ee<br>
      dlyq.ee
    </div>
  </div>

  <div style="border-top:1px solid #ccc; padding-top:15px; margin-top:15px;">
    ${generateSummaryItems(localizedOrderDetails)}
  </div>

  <div style="border-top:1px solid #ccc; margin-top:20px; padding-top:10px; text-align:right;">
    <p><strong>Tarne maksumus:</strong> ${deliveryPrice.toFixed(2)} €</p>
    <p><strong>Kokku:</strong> ${priceWithoutVAT.toFixed(2)} €</p>
    <p><strong>KM (22%):</strong> ${vatAmount.toFixed(2)} €</p>
    <p><strong>Kokku koos KM-ga (EUR):</strong> ${totalWithVAT.toFixed(2)} €</p>
  </div>

  <div style="margin-top:30px; font-size:0.85em; color:#666;">
    See dokument tõendab makset ja on automaatselt koostatud.
  </div>

</div>
`;

    const tempDir = path.join(__dirname, "../temp");
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir);
    const tempPath = path.join(tempDir, `receipt-${orderId}.pdf`);
    await generatePDFReceipt(receiptHTML, tempPath);

    res.download(tempPath, `dlyq-receipt-${orderId}.pdf`, (err) => {
      fs.unlink(tempPath, () => {});
      if (err) console.error("Ошибка отправки чека:", err);
    });
  } catch (error) {
    console.error("Ошибка генерации PDF-чека:", error);
    res.status(500).json({ message: "Ошибка при скачивании чека" });
  }
};

const createOrder = async (req, res) => {
  try {
    let receiptUrl = null;
    const {
      formData,
      totalPrice,
      orderDetails,
      desiredDeliveryDate,
      paymentMethodId,
      language,
    } = req.body;
    const {
      firstName,
      lastName,
      phone,
      address,
      apartment,
      comment,
      latitude,
      longitude,
    } = formData;

    let email = formData.email;

    if ((!email || email.trim() === "") && req.user && req.user.email) {
      email = req.user.email;
    }

    if (!orderDetails || orderDetails.length === 0) {
      throw new Error("orderDetails не может быть пустым");
    }

    const userId = req.user ? req.user.id : null;
    let warehouseId = 1;

    const deliveryDateFromFirstItem = orderDetails[0]?.deliveryDate || null;
    const preferredTimeFromFirstItem = orderDetails[0]?.preferredTime || null;
    const distance = getDistanceFromWarehouse(latitude, longitude);
    const deliveryPrice = calculateDeliveryCost(totalPrice, distance);

    let isPreorder = false;
    const devicesToUpdate = [];

    for (const item of orderDetails) {
      const device = await Device.findByPk(item.deviceId);
      if (!device) {
        return res
          .status(400)
          .json({ message: `Товар "${item.name}" не найден.` });
      }

      if (device.quantity < item.count && !item.isPreorder) {
        return res.status(400).json({
          message: `Недостаточно товара: ${item.name}. Осталось ${device.quantity} шт.`,
        });
      }

      if (device.quantity < item.count) {
        isPreorder = true;
      }

      if (device.quantity >= item.count) {
        devicesToUpdate.push({ device, count: item.count });
      }
    }

    let status = "Pending";
    if (isPreorder || desiredDeliveryDate) {
      status = "preorder";
    }

    let deviceImageUrl =
      orderDetails[0]?.image || "https://example.com/placeholder.png";

    if (deviceImageUrl.startsWith("http")) {
      try {
        const response = await fetch(deviceImageUrl);
        if (!response.ok) throw new Error("Ошибка загрузки изображения с URL");
        const buffer = await response.arrayBuffer();
        const fileName = `orders/${uuid.v4()}${deviceImageUrl.substring(
          deviceImageUrl.lastIndexOf(".")
        )}`;

        const { data, error } = await supabase.storage
          .from("images")
          .upload(fileName, Buffer.from(buffer), {
            contentType: "image/jpeg",
          });

        if (error) {
          console.error("❌ Ошибка загрузки изображения в Supabase:", error);
        } else {
          deviceImageUrl = `https://ujsitjkochexlcqrwxan.supabase.co/storage/v1/object/public/images/${fileName}`;
        }
      } catch (error) {
        console.error("❌ Ошибка обработки изображения:", error);
      }
    }

    const downloadToken = uuid.v4();

    const localizedOrderDetails = orderDetails.map((item) => {
      const lang = language || "est";
      const translatedName = item.translations?.name?.[lang] || item.name;

      const localizedOptions = {};

      if (item.selectedOptions && Array.isArray(item.translations?.options)) {
        for (const [rawOptionKey, val] of Object.entries(
          item.selectedOptions
        )) {
          const optionTranslation = item.translations.options.find((opt) =>
            Object.values(opt.name || {}).includes(rawOptionKey)
          );

          const label = optionTranslation?.name?.[lang] || rawOptionKey;

          const valueToMatch = val.value?.trim();
          let matchedValue = null;

          for (const valObj of optionTranslation?.values || []) {
            const directMatch = valObj[lang]?.trim() === valueToMatch;
            const anyMatch = Object.values(valObj).some(
              (v) => v?.trim() === valueToMatch
            );
            if (directMatch || anyMatch) {
              matchedValue = valObj;
              break;
            }
          }

          const value = matchedValue?.[lang] || val.value;

          localizedOptions[label] = value;
        }
      }

      return {
        ...item,
        name: translatedName,
        selectedOptions: localizedOptions,
      };
    });

    const order = await Order.create({
      userId,
      totalPrice: totalPrice + deliveryPrice,
      deliveryPrice,
      status: "Pending",
      warehouseStatus: "pending",
      warehouseId,
      courierId: null,
      deliveryLat: latitude,
      deliveryLng: longitude,
      downloadToken,
      deliveryAddress: address,
      deviceImage: deviceImageUrl,
      productName:
        orderDetails.length > 0 ? orderDetails[0].name : "Неизвестный товар",
      orderDetails: JSON.stringify(localizedOrderDetails),
      desiredDeliveryDate: deliveryDateFromFirstItem
        ? new Date(deliveryDateFromFirstItem)
        : null,
      preferredDeliveryComment: preferredTimeFromFirstItem,
      formData: JSON.stringify(formData),
    });

    for (const { device, count } of devicesToUpdate) {
      await device.update({ quantity: device.quantity - count });
    }

    const io = req.app.get("io");
    io.emit("newOrder", order);

    const preorderAvailable = orderDetails.filter(
      (item) => item.isPreorder && item.desiredDeliveryDate && item.count > 0
    );

    const preorderOutOfStock = orderDetails.filter(
      (item) =>
        item.isPreorder && (!item.desiredDeliveryDate || item.count === 0)
    );

    const regularItems = orderDetails.filter((item) => !item.isPreorder);

    const generateSummaryItems = (items) => {
      return items
        .map((item) => {
          const options =
            item.selectedOptions && Object.keys(item.selectedOptions).length > 0
              ? Object.entries(item.selectedOptions)
                  .map(([key, value]) => `${key}: ${value}`)
                  .join(", ")
              : "Без опций";

          return `
        <div style="display:flex; justify-content:space-between; margin-bottom:10px;">
          <div>
            ${item.name}
            <div style="font-size:0.85em; color:#777;">${options}</div>
          </div>
          <div><strong>${item.price} €</strong></div>
        </div>
      `;
        })
        .join("");
    };

    const localReceiptUrl = `https://zang-4.onrender.com/static/receipts/receipt-${order.id}.pdf`;
    receiptUrl = localReceiptUrl;
    order.receiptUrl = receiptUrl;
    await order.save();

    const emailHTML = `
<div style="max-width:600px; margin:0 auto; font-family:Arial, sans-serif; padding:20px; border:1px solid #e0e0e0; border-radius:10px; background:#fff;">
  <div style="background:#f2f2f2; padding:15px 20px; border-radius:8px; display:flex; align-items:center;">
    <div style="flex:1;">
      <h2 style="margin:0; font-size:1.4em;">${t("hello", language)}, ${
      firstName || ""
    } ${lastName || ""}!</h2>
      <p style="margin:0; color:#777;">${t(
        "this_is_your_receipt",
        language
      )}</p>
    </div>
  </div>

  <div style="padding:20px 0;">
    <h3 style="margin:5px 0;">DlyQ</h3>
    <p style="margin:0; font-size:0.9em; color:#888;">${
      formData.address || ""
    }, ${formData.apartment || ""}</p>
    
  <strong>${t("buyer", language)}</strong><br>
      ${formData.firstName || ""} ${formData.lastName || ""}<br>
      ${formData.email || ""}<br>
      ${formData.phone || ""}<br>
      ${t("address", language)} ${formData.address || ""}, ${
      formData.apartment || ""
    }

  </div>

  <div style="border-top:1px solid #eee; padding-top:15px; margin-top:15px;">
    ${generateSummaryItems(localizedOrderDetails)}
  </div>

  <div style="border-top:1px solid #eee; margin-top:20px; padding-top:15px;">
    <p style="margin:5px 0; font-size:1em;"><strong>${t(
      "total_charged",
      language
    )}</strong></p>
    <p style="font-size:1.2em;"><strong>${(totalPrice + deliveryPrice).toFixed(
      2
    )} €</strong></p>
  </div>

  <hr style="margin-top:30px;">
  <p style="font-size:0.85em; color:#666; line-height:1.6;"
    💼 DLYQ OÜ<br>
    ${t("download_invoice", language)} info@dlyq.ee
  </p>
  <p style="margin-top:20px;">
<a href="${receiptUrl}" target="_blank">
  ${t("contacts", language)}
</a>
</div>
`;

    const subtotal = parseFloat(totalPrice) || 0;
    const totalWithVAT = subtotal + deliveryPrice;
    const vatRate = 0.22;
    const priceWithoutVAT = totalWithVAT / (1 + vatRate);
    const vatAmount = totalWithVAT - priceWithoutVAT;

    const receiptHTML = `
  <div style="max-width:600px; margin:0 auto; font-family:Arial, sans-serif; font-size:14px; padding:20px; border:1px solid #ccc; border-radius:8px; background:#fff;">

  <h2 style="text-align:center; margin-bottom:30px; font-size:20px;">Kviitung DlyQ</h2>

  <div style="display:flex; justify-content:space-between; margin-bottom:25px; line-height:1.6; font-size:14px;">
    <div style="width:48%;">
      <strong>Ostja:</strong><br>
      ${formData.firstName || ""} ${formData.lastName || ""}<br>
      ${formData.email || ""}<br>
      ${formData.phone || ""}<br>
      Aadress: ${formData.address || ""}, ${formData.apartment || ""}
    </div>
    <div style="width:48%; text-align:right;">
      <strong>Müüja:</strong><br>
      DLYQ OÜ<br>
      Kviitungi number: #${order.id}<br>
      Kuupäev: ${new Date(order.createdAt).toLocaleString("et-EE")}<br>
      Tallinn, Eesti<br>
      Registrikood: <strong>17268052</strong><br>
      KMKR:<strong>EE102873957</strong><br>
      info@dlyq.ee<br>
      dlyq.ee
    </div>
  </div>

  <div style="border-top:1px solid #ccc; padding-top:15px; margin-top:15px;">
    ${generateSummaryItems(localizedOrderDetails)}
  </div>

  <div style="border-top:1px solid #ccc; margin-top:20px; padding-top:10px; text-align:right;">
    <p><strong>Tarne maksumus:</strong> ${deliveryPrice.toFixed(2)} €</p>
    <p><strong>Kokku:</strong> ${priceWithoutVAT.toFixed(2)} €</p>
    <p><strong>KM (22%):</strong> ${vatAmount.toFixed(2)} €</p>
    <p><strong>Kokku koos KM-ga (EUR):</strong> ${totalWithVAT.toFixed(2)} €</p>
  </div>

  <div style="margin-top:30px; font-size:0.85em; color:#666;">
    See dokument tõendab makset ja on automaatselt koostatud.
  </div>

</div>
`;

    const tempPath = path.join(os.tmpdir(), `receipt-${order.id}.pdf`);
console.log("📄 Генерация PDF по пути:", tempPath);

try {
  await generatePDFReceipt(receiptHTML, tempPath);
  if (!fs.existsSync(tempPath)) {
    throw new Error("PDF-файл не был создан.");
  }
  console.log("✅ PDF-файл успешно создан:", tempPath);
} catch (pdfError) {
  console.error("❌ Ошибка генерации PDF:", pdfError.message);
}

try {
  if (fs.existsSync(tempPath)) {
    const buffer = fs.readFileSync(tempPath);
    const fileName = `receipts/receipt-${order.id}.pdf`;
    console.log("📤 Загрузка файла в Supabase:", fileName);

    const { data, error } = await supabase.storage
      .from("receipts")
      .upload(fileName, buffer, {
        contentType: "application/pdf",
        upsert: true,
      });

    if (error) {
      console.error("❌ Ошибка загрузки PDF в Supabase:", error.message);
    } else {
      receiptUrl = `https://ujsitjkochexlcqrwxan.supabase.co/storage/v1/object/public/receipts/${fileName}`;
      order.receiptUrl = receiptUrl;
      await order.save();
      console.log("✅ Ссылка на PDF сохранена в заказе:", receiptUrl);
    }
  }
} catch (uploadError) {
  console.error("❌ Ошибка при загрузке PDF в Supabase:", uploadError.message);
}


    const subject = t("greetings", language);
    const attachments = fs.existsSync(tempPath)
      ? [{ filename: "receipt.pdf", path: tempPath }]
      : [];

    try {
      console.log("📧 Отправка писем...");

      await Promise.all([
        sendEmail("ms.margo07@mail.ru", "📥 Новый заказ", emailHTML),
        sendEmail(email, subject, emailHTML, attachments),
      ]);

      console.log("✅ Письма успешно отправлены.");
    } catch (emailError) {
      console.error("❌ Ошибка при отправке писем:", emailError.message);
    }

    res.status(201).json({
      message: "Заказ успешно оформлен",
      receipt: receiptUrl || null,
    });
  } catch (error) {
    console.error("❌ Ошибка на этапе оформления заказа:", error.message);
    res.status(500).json({
      message: "Ошибка при оформлении заказа",
      error: error.message,
    });
  }
};

const getDeliveryCost = (req, res) => {
  const { totalPrice, lat, lon } = req.query;

  if (!totalPrice || !lat || !lon) {
    return res
      .status(400)
      .json({ message: "Нужно указать totalPrice, lat и lon" });
  }

  const distance = getDistanceFromWarehouse(parseFloat(lat), parseFloat(lon));
  const deliveryCost = calculateDeliveryCost(parseFloat(totalPrice), distance);

  res.json({ deliveryCost });
};

const updateOrderStatus = async (req, res) => {
  try {
    const { orderId, newStatus } = req.body;

    const order = await Order.findByPk(orderId);
    if (!order) {
      return res.status(404).json({ message: "Заказ не найден." });
    }

    order.status = newStatus;
    await order.save();

    res.json({ message: "Статус заказа обновлён!", order });
  } catch (error) {
    res.status(500).json({ message: "Ошибка сервера" });
  }
};

const getUserOrders = async (req, res) => {
  try {
    const userId = req.user.id;

    const orders = await Order.findAll({
      where: { userId },
      order: [["createdAt", "DESC"]],
    });

    const deviceIds = orders.flatMap((order) =>
      JSON.parse(order.orderDetails || "[]").map((d) => d.deviceId)
    );

    if (deviceIds.length > 0) {
      const translations = await Translation.findAll({
        where: {
          key: {
            [Op.or]: deviceIds.map((id) => `device_${id}.name`),
          },
        },
      });

      const translationMap = {};
      translations.forEach((t) => {
        const deviceId = t.key.replace("device_", "").replace(".name", "");
        if (!translationMap[deviceId]) translationMap[deviceId] = {};
        translationMap[deviceId][t.lang] = t.text;
      });

      orders.forEach((order) => {
        const orderDetails = JSON.parse(order.orderDetails || "[]");

        orderDetails.forEach((detail) => {
          const translations = translationMap[detail.deviceId] || {};
          detail.translations = { name: translations };

          const lang = "ru";
          if (translations[lang]) {
            detail.name = translations[lang];
          }
        });

        order.orderDetails = orderDetails;
      });
    }

    res.json(orders);
  } catch (error) {
    console.error("❌ Ошибка получения заказов:", error);
    res.status(500).json({ message: "Ошибка получения заказов" });
  }
};

const getActiveOrder = async (req, res) => {
  try {
    const userId = req.user ? req.user.id : null;

    const order = await Order.findOne({
      where: {
        userId,
        status: {
          [Op.in]: [
            "Pending",
            "Waiting for courier",
            "Ready for pickup",
            "Picked up",
            "Arrived at destination",
            "Delivered",
          ],
        },
      },
      order: [["createdAt", "DESC"]],
    });

    if (!order) {
      return res.json(null);
    }

    let orderItems = [];
    try {
      const parsedData = order.formData ? JSON.parse(order.formData) : {};
      orderItems = parsedData.orderDetails || [];
    } catch (error) {
      console.error("Ошибка парсинга formData:", error);
    }

    res.json({
      ...order.toJSON(),
      order_items: orderItems,
    });
  } catch (error) {
    console.error("Ошибка получения активного заказа:", error);
    res.status(500).json({ message: "Ошибка сервера при получении заказа." });
  }
};

const getAllOrdersForAdmin = async (req, res) => {
  try {
    const orders = await Order.findAll({
      order: [["createdAt", "DESC"]],
    });

    res.json(orders);
  } catch (error) {
    console.error("❌ Ошибка получения заказов админом:", error);
    res.status(500).json({ message: "Ошибка сервера" });
  }
};

const adminUpdateOrderStatus = async (req, res) => {
  const { id } = req.params;
  const { status, processingTime, estimatedTime } = req.body;

  const order = await Order.findByPk(id);
  if (!order) return res.status(404).json({ message: "Заказ не найден" });

  if (status) order.status = status;
  if (processingTime !== undefined) order.processingTime = processingTime;
  if (estimatedTime !== undefined) order.estimatedTime = estimatedTime;

  if (status === "Picked up") {
    order.pickupStartTime = new Date();
  }

  await order.save();

  const io = req.app.get("io");
  io.emit("orderStatusUpdate", order);

  return res.json({ message: "Обновлено", order });
};

const assignCourier = async (req, res) => {
  const { id } = req.params;
  const { courierId } = req.body;

  try {
    const order = await Order.findByPk(id);
    if (!order) return res.status(404).json({ message: "Заказ не найден" });

    const courier = await Courier.findByPk(courierId);
    if (!courier) return res.status(404).json({ message: "Курьер не найден" });

    order.courierId = courierId;
    await order.save();

    const io = req.app.get("io");
    io.emit("orderStatusUpdate", {
      id: order.id,
      status: order.status,
      courierId: order.courierId,
      deliveryLat: order.deliveryLat,
      deliveryLng: order.deliveryLng,
      deliveryAddress: order.deliveryAddress,
      orderDetails: order.orderDetails ? JSON.parse(order.orderDetails) : [],
    });

    res.json({ message: "Курьер назначен", order });
  } catch (error) {
    console.error("❌ Ошибка назначения курьера:", error);
    res.status(500).json({ message: "Ошибка сервера" });
  }
};

module.exports = {
  createOrder,
  getDeliveryCost,
  getUserOrders,
  getActiveOrder,
  updateOrderStatus,
  getAllOrdersForAdmin,
  adminUpdateOrderStatus,
  assignCourier,
  downloadReceipt,
};
