const sendEmail = require("../services/emailService");
const {
  Order,
  Device,
  MenuItem,
  Translation,
  Courier,
} = require("../models/models");
const { Op } = require("sequelize");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { t } = require("../utils/translations");
const getDistanceFromWarehouse = require("../utils/distance");
const { isShopOpenNow } = require("../utils/shopSchedule");
const generatePDFShiftBuffer = require("../services/generatePDFShiftBuffer");  // Proda (PDFShift)
const { supabase } = require("../config/supabaseClient");
const {
  sendOrderAssignedPush,
  sendNewOrderPushToWarehouse,
} = require("../services/pushService");
const {
  sendOrderToNextCourier,
} = require("../services/orderDistributionService");
const uuid = require("uuid");

const Stripe = require("stripe");
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

function mustEnv(name) {
  const v = (process.env[name] ?? "").trim();
  if (!v) throw new Error(`${name} is not set`);
  return v;
}

const PUBLIC_URL = mustEnv("PUBLIC_URL").replace(/\/+$/, "");
const COMPANY = {
  email: mustEnv("COMPANY_EMAIL"),
  site: (process.env.COMPANY_SITE || process.env.SITE_URL || "dlyq-staging.netlify.app").trim(),
};
const SUPABASE_IMAGE_BUCKET =
  process.env.SUPABASE_IMAGE_BUCKET || process.env.SUPABASE_BUCKET || "images";
const SUPABASE_URL = mustEnv("SUPABASE_URL");
const PLACEHOLDER_IMG =
  process.env.PLACEHOLDER_IMG || `${PUBLIC_URL}/static/placeholder.png`;

const calculateDeliveryBase = (distance) => {
  let baseCost = 2;
  let distanceCost = distance * 0.5;
  const deliveryCost = baseCost + distanceCost;
  return parseFloat(deliveryCost.toFixed(2));
};

const calculateDeliveryCost = (totalPrice, distance) => {
  const base = calculateDeliveryBase(distance);
  let discount = Math.floor(totalPrice / 30) * 2;
  const deliveryCost = Math.max(0, base - discount);
  return parseFloat(deliveryCost.toFixed(2));
};

const downloadReceipt = async (req, res) => {
  try {
    const orderId = req.params.id;
    const token = req.query.token;
    const order = await Order.findByPk(orderId);

    if (!order || order.downloadToken !== token) {
      return res.status(403).json({ message: "Нет доступа к чеку." });
    }

    const orderDetails = JSON.parse(order.orderDetails || "[]");
    const formData = JSON.parse(order.formData || "{}");

    const totalWithVAT = parseFloat(order.totalPrice) || 0;
    const deliveryPrice = parseFloat(order.deliveryPrice) || 0;
    const vatRate = 0.22;
    const priceWithoutVAT = totalWithVAT / (1 + vatRate);
    const vatAmount = totalWithVAT - priceWithoutVAT;

    const generateSummaryItems = (items) => {
      return items
        .map((item) => {
          const options =
            item.selectedOptions && Object.keys(item.selectedOptions).length > 0
              ? Object.entries(item.selectedOptions)
                  .map(([key, value]) => `${key}: ${value}`)
                  .join(", ")
              : "";
// Proda
          const qty = item.count ?? item.quantity ?? 1;
          const unitPrice = Number(item.price) || 0;
          const lineTotal = unitPrice * qty;
// Proda
// Proda
// Proda
// Proda
// Proda
// Proda
// Proda
// Proda
          return `
        <div style="display:flex; align-items:flex-start; justify-content:space-between; gap:12px; margin-bottom:12px;">
          <div style="flex:1; min-width:0;">
            ${item.name}
            ${
              options &&
              `<div style="font-size:0.85em; color:#777;">${options}</div>`
            }
          </div>
          <div style="width:60px; text-align:center; white-space:nowrap;">× ${qty}</div>
          <div style="white-space:nowrap;"><strong>${lineTotal.toFixed(
            2
          )} €</strong></div>
        </div>
      `;
        })
        .join("");
    };

    const receiptHTML = `
    <!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8" />
    <title>Receipt</title>
  </head>
  <body>
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
            ${COMPANY.email}<br>
            ${COMPANY.site}
          </div>
        </div>

            <div style="border-top:1px solid #ccc; padding-top:15px; margin-top:15px;">
              ${generateSummaryItems(orderDetails)}
            </div>

             <div style="border-top:1px solid #ccc; margin-top:20px; padding-top:10px; text-align:right;">
              <p><strong>Tarne maksumus:</strong> ${deliveryPrice.toFixed(
                2
              )} €</p>
              <p><strong>Kokku:</strong> ${priceWithoutVAT.toFixed(2)} €</p>
              <p><strong>KM (22%):</strong> ${vatAmount.toFixed(2)} €</p>
              <p><strong>Kokku koos KM-ga (EUR):</strong> ${totalWithVAT.toFixed(
                2
              )} €</p>
            </div>

            <div style="margin-top:30px; font-size:0.85em; color:#666;">
              See dokument tõendab makset ja on automaatselt koostatud.
            </div>
          </div>
        </body>
      </html>
    `;
    // Proda
    const buffer = await generatePDFShiftBuffer(receiptHTML); //Proda
//Proda
    res.setHeader("Content-Type", "application/pdf");  //proda
    res.setHeader("Content-Disposition", `attachment; filename="dlyq-receipt-${orderId}.pdf"`); //Proda
    res.send(buffer);  //Proda
  } catch (error) {  //Proda
    console.error("❌ Ошибка генерации PDF:", error);   //Proda
    res.status(500).json({ message: "Не удалось сгенерировать чек." });   //Proda
  }
};
//Proda
// Proda
// Proda
// Proda
//Proda
//Proda
const createOrder = async (req, res) => {
  try {
    const {
      formData,
      totalPrice,
      orderDetails,
      desiredDeliveryDate,
      paymentIntentId,
      language,
      deliveryCost = 0,
    } = req.body;
    const {
      firstName,
      lastName,
      phone,
      address,
      apartment,
      floor,
      entrance,
      comment,
      latitude,
      longitude,
    } = formData;

    if (!paymentIntentId) {
      return res.status(400).json({ message: "paymentIntentId is required" });
    }

    const pi = await stripe.paymentIntents.retrieve(paymentIntentId);

    if (!pi || !pi.id) {
      return res.status(400).json({ message: "PaymentIntent not found" });
    }

    const distanceForAmount = getDistanceFromWarehouse(latitude, longitude);
    const deliveryPriceServer = calculateDeliveryCost(
      totalPrice,
      distanceForAmount
    );
    const serverAmountCents = Math.round(
      (Number(totalPrice) + Number(deliveryPriceServer)) * 100
    );

    if (pi.amount !== serverAmountCents) {
      return res.status(400).json({
        message: "Amount mismatch",
        expected: serverAmountCents,
        actual: pi.amount,
      });
    }

    if ((pi.currency || "").toLowerCase() !== "eur") {
      return res.status(400).json({ message: "Unsupported currency" });
    }

    if (pi.status !== "succeeded") {
      return res
        .status(402)
        .json({ message: `Payment not completed: ${pi.status}` });
    }

    const existingByPI = await Order.findOne({
      where: { paymentIntentId: pi.id },
    }).catch(() => null);
    if (existingByPI) {
      return res.status(409).json({
        message: "Order already exists for this payment intent",
        orderId: existingByPI.id,
      });
    }

    let email = formData.email;
    if ((!email || email.trim() === "") && req.user && req.user.email) {
      email = req.user.email;
    }

    if (!orderDetails || orderDetails.length === 0) {
      throw new Error("orderDetails не может быть пустым");
    }

    const userId = req.user ? req.user.id : null;

   const distance = getDistanceFromWarehouse(latitude, longitude);
    const deliveryPrice = calculateDeliveryCost(totalPrice, distance);
    const courierFee = calculateDeliveryBase(distance);
    const isStoreClosedNow = !isShopOpenNow();

       let isPreorder = false;
    const devicesToUpdate = [];
    const sellerIds = new Set();

    for (const item of orderDetails) {
      if (item.isRestaurantItem) {
        const menuItemId = Number(item.menuItemId ?? item.itemId ?? item.id);
        const menuItem = await MenuItem.findByPk(menuItemId);
        if (!menuItem) {
          return res
            .status(400)
            .json({ message: `Блюдо не найдено (id: ${menuItemId})` });
        }
        if (menuItem.sellerId) sellerIds.add(menuItem.sellerId);
        continue;
      }
      
      const deviceId = item.deviceId ?? item.id;
      const device = await Device.findByPk(deviceId);
      if (!device) {
        return res
          .status(400)
          .json({ message: `Товар "${item.name}" не найден.` });
      }

      if (device.sellerId) sellerIds.add(device.sellerId);

      if (device.quantity < item.count && !item.isPreorder) {
        return res.status(400).json({
          message: `Недостаточно товара: ${item.name}. Осталось ${device.quantity} шт.`,
        });
      }

      if (device.quantity < item.count) isPreorder = true;

      if (device.quantity >= item.count)
        devicesToUpdate.push({ device, count: item.count });
    }

    if (sellerIds.size > 1) {
      return res.status(400).json({
        message: "Нельзя оформить заказ с товарами разных продавцов",
      });
    }

    const sellerId = sellerIds.size === 1 ? Array.from(sellerIds)[0] : null;

    const deliveryDateFromFirstItem = orderDetails[0]?.deliveryDate || null;
    const preferredTimeFromFirstItem = orderDetails[0]?.preferredTime || null;

    const hasShortagePreorder = isPreorder;

    const hasScheduledPreorder =
      !hasShortagePreorder &&
      Boolean(deliveryDateFromFirstItem || desiredDeliveryDate);

    let status =
  hasShortagePreorder || hasScheduledPreorder || isStoreClosedNow
    ? "preorder"
    : "Pending";

    let preorderReason = null;
    if (status === "preorder") {
      if (hasShortagePreorder) {
        preorderReason = "out_of_stock";
      } else if (isStoreClosedNow) {
        preorderReason = "store_closed";
      } else {
        preorderReason = "scheduled";
      }
    }

    let desiredDeliveryDateToStore = null;
    let preferredDeliveryCommentToStore = null;

    if (hasScheduledPreorder) {
      const rawDate = deliveryDateFromFirstItem || desiredDeliveryDate || null;
      desiredDeliveryDateToStore = rawDate ? new Date(rawDate) : null;
      preferredDeliveryCommentToStore = preferredTimeFromFirstItem || null;
    }
    
    let deviceImageUrl = orderDetails[0]?.image || PLACEHOLDER_IMG;

    if (
      deviceImageUrl?.startsWith("http") &&
      !deviceImageUrl.startsWith(SUPABASE_URL)
    ) {
      try {
        const response = await fetch(deviceImageUrl);
        if (!response.ok) throw new Error("Ошибка загрузки изображения с URL");
        const buffer = await response.arrayBuffer();

        const dot = deviceImageUrl.lastIndexOf(".");
        const ext = dot !== -1 ? deviceImageUrl.substring(dot) : ".jpg";
        const fileName = `orders/${uuid.v4()}${ext}`;

        const { error: upErr } = await supabase.storage
          .from(SUPABASE_IMAGE_BUCKET)
          .upload(fileName, Buffer.from(buffer), { contentType: "image/jpeg" });

        if (!upErr) {
          const { data: pub } = supabase.storage
            .from(SUPABASE_IMAGE_BUCKET)
            .getPublicUrl(fileName);
          if (pub?.publicUrl) deviceImageUrl = pub.publicUrl;
        } else {
          console.error("❌ Ошибка загрузки изображения в Supabase:", upErr);
        }
      } catch (err) {
        console.error("❌ Ошибка обработки изображения:", err);
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

  const orderData = {
    sellerId,
      userId,
      totalPrice: Number(totalPrice) + Number(deliveryPrice),
      deliveryPrice,
    courierFee, 
      status,
      warehouseStatus: "pending",
      courierId: null,
      deliveryLat: latitude,
      deliveryLng: longitude,
      downloadToken,
      deliveryAddress: address,
      deviceImage: deviceImageUrl,
      productName:
        orderDetails.length > 0 ? orderDetails[0].name : "Неизвестный товар",
      orderDetails: JSON.stringify(localizedOrderDetails),
     desiredDeliveryDate: desiredDeliveryDateToStore,
      preferredDeliveryComment: preferredDeliveryCommentToStore,
      formData: JSON.stringify(formData),
    preorderReason,
    };

    if (Order.rawAttributes?.paymentIntentId) orderData.paymentIntentId = pi.id;
    if (Order.rawAttributes?.paymentStatus) orderData.paymentStatus = pi.status;
    if (Order.rawAttributes?.currency)
      orderData.currency = (pi.currency || "eur").toUpperCase();
  if (Order.rawAttributes?.amountCents)
      orderData.amountCents = Math.round(
        (Number(totalPrice) + Number(deliveryPrice)) * 100
      );

    const order = await Order.create(orderData);

    try {
      await sendNewOrderPushToWarehouse(order);
    } catch (err) {
      console.error("push error (createOrder → warehouse):", err);
    }

    for (const { device, count } of devicesToUpdate) {
      await device.update({ quantity: device.quantity - count });
    }

    const io = req.app.get("io");
    io.emit("newOrder", order);

   const generateSummaryItems = (items) => {
  return items
    .map((item) => {
      const options =
        item.selectedOptions && Object.keys(item.selectedOptions).length > 0
          ? Object.entries(item.selectedOptions)
              .map(([k, v]) => `${k}: ${v}`)
              .join(", ")
          : "";

      const qty = Number(item.count ?? item.quantity ?? 1) || 1;

      const unitPrice =
            Number(
              typeof item.price === "string"
                ? item.price.replace(/[^\d.,-]/g, "").replace(",", ".")
                : item.price
            ) || 0;

      const lineTotal = unitPrice * qty;
      
       return `
        <div style="display:flex; align-items:flex-start; justify-content:space-between; gap:12px; margin-bottom:12px;">
          <div style="flex:1; min-width:0;">
            ${item.name}
            ${
              options &&
              `<div style="font-size:0.85em; color:#777;">${options}</div>`
            }
          </div>
          <div style="width:60px; text-align:center; white-space:nowrap;">× ${qty}</div>
          <div style="white-space:nowrap;"><strong>${lineTotal.toFixed(
            2
          )} €</strong></div>
        </div>
      `;
        })
        .join("");
    };

   const receiptUrl = `${PUBLIC_URL}/api/order/${order.id}/receipt?token=${downloadToken}`; //Proda
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
          <strong>${t("buyer", language)}</strong><br>
          ${formData.firstName || ""} ${formData.lastName || ""}<br>
          ${formData.email || ""}<br>
          ${formData.phone || ""}<br>
          ${t("address", language)}: ${formData.address || ""}<br>
          ${
            formData.apartment
              ? `${t("apartment", language)}: ${formData.apartment}<br>`
              : ""
          }
          ${
            formData.entrance
              ? `${t("entrance", language)}: ${formData.entrance}<br>`
              : ""
          }
          ${
            formData.floor
              ? `${t("floor", language)}: ${formData.floor}<br>`
              : ""
          }
          ${
            formData.comment
              ? `${t("comment", language)}: ${formData.comment}<br>`
              : ""
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
          <p style="font-size:1.2em;"><strong>${(
            Number(totalPrice) + deliveryPrice
          ).toFixed(2)} €</strong></p>
        </div>

        <hr style="margin-top:30px;">

<p style="font-size:0.9em; color:#666; line-height:1.6; margin:0;">
   DLYQ OÜ
</p>

<p style="font-size:0.9em; color:#666; line-height:1.6; margin:6px 0 0;">
  ${t("contacts", language)}
  <a href="mailto:${
    COMPANY.email
  }" style="color:#3366cc; text-decoration:none;">
    ${COMPANY.email}
  </a>
  &nbsp;•&nbsp;
  <a href="www.${
    COMPANY.site
  }" target="_blank" style="color:#3366cc; text-decoration:none;">
    ${COMPANY.site}
  </a>
</p>

<p style="font-size:0.9em; color:#666; line-height:1.6; margin:6px 0 0;">
  <a href="${receiptUrl}" target="_blank" style="color:#3366cc; text-decoration:none;">
    ${t("download_invoice", language)}
  </a>
</p>
      </div>
    `;

    const subtotal = parseFloat(totalPrice) || 0;
    const totalWithVAT = subtotal + deliveryPrice;
    const vatRate = 0.22;
    const priceWithoutVAT = totalWithVAT / (1 + vatRate);
    const vatAmount = totalWithVAT - priceWithoutVAT;

    const receiptHTML = `
  <!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8" />
    <title>Receipt</title>
  </head>
  <body>
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
            ${COMPANY.email}<br>
            ${COMPANY.site}
          </div>
        </div>

        <div style="border-top:1px solid #ccc; padding-top:15px; margin-top:15px;">
          ${generateSummaryItems(localizedOrderDetails)}
        </div>

        <div style="border-top:1px solid #ccc; margin-top:20px; padding-top:10px; text-align:right;">
          <p><strong>Tarne maksumus:</strong> ${deliveryPrice.toFixed(2)} €</p>
          <p><strong>Kokku:</strong> ${priceWithoutVAT.toFixed(2)} €</p>
          <p><strong>KM (22%):</strong> ${vatAmount.toFixed(2)} €</p>
          <p><strong>Kokku koos KM-ga (EUR):</strong> ${totalWithVAT.toFixed(
            2
          )} €</p>
        </div>

        <div style="margin-top:30px; font-size:0.85em; color:#666;">
          See dokument tõendab makset ja on automaatselt koostatud.
        </div>
      </div>
      </body>
</html>
    `;
 //Proda
    const subject = t("greetings", language);//Proda
//Proda
    //Proda
    //Proda
    //Proda
    //Proda
    //Proda
    //Proda
    //Proda
    //Proda
    await Promise.all([
   sendEmail("ms.margo07@mail.ru", "📥 Новый заказ", emailHTML),
   sendEmail(email, subject, emailHTML),
 ]);
 //Proda
    //Proda
    //Proda
    //Proda
    //Proda
  
    res.status(201).json({ message: "Заказ успешно оформлен" });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Ошибка при оформлении заказа", error: error.message });
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

   if (['Waiting for courier', 'Ready for pickup'].includes(order.status)) {
    const courierPayload = {
      id: order.id,
      status: order.status,
      deliveryLat: order.deliveryLat,
      deliveryLng: order.deliveryLng,
      deliveryAddress: order.deliveryAddress,
      deliveryPrice: order.deliveryPrice,
      courierFee: order.courierFee,
      courierId: order.courierId,
    };

    io.emit('warehouseOrder', courierPayload);

    try {
      await sendOrderToNextCourier(order);
    } catch (err) {
      console.error('push error (adminUpdateOrderStatus):', err);
    }
  }

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

     sendOrderAssignedPush(order).catch(err =>
      console.error("push error:", err),
    );

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
