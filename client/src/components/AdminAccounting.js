import React, { useState, useEffect } from "react";

const AdminAccounting = ({ devices }) => {
  const [activeTab, setActiveTab] = useState("all");
  const [soldDevices, setSoldDevices] = useState([]);

  useEffect(() => {
  const fetchSoldDevices = async () => {
    try {
      const response = await fetch("/api/order/all");
      const orders = await response.json();

      const allSold = [];

      orders.forEach((order) => {
  const details = JSON.parse(order.orderDetails || "[]");
  details.forEach((item) => {
    const existing = allSold.find((d) => d.deviceId === item.deviceId);
    const deviceData = devices.find((d) => d.id === item.deviceId);

    if (!deviceData) return; // Если устройство не найдено — пропускаем

    const enrichedItem = {
      deviceId: item.deviceId,
      quantity: Number(item.count),
      price: deviceData.price,
      name: deviceData.name,
      purchasePrice: deviceData.purchasePrice,
      purchaseHasVAT: deviceData.purchaseHasVAT,
    };

    if (existing) {
      existing.quantity += enrichedItem.quantity;
    } else {
      allSold.push(enrichedItem);
    }
  });
});


      setSoldDevices(allSold);
    } catch (error) {
      console.error("Ошибка загрузки проданных товаров:", error);
    }
  };

  fetchSoldDevices();
}, []);

  const VAT_RATE = 0.24;
  const INCOME_TAX_RATE = 0.2;

  const format = (num) =>
    typeof num === "number"
      ? num.toLocaleString("et-EE", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })
      : "—";
	  
  const currentDevices = activeTab === "sold" ? soldDevices : devices;

  const totalQuantity = currentDevices.reduce(
    (sum, d) => sum + Number(d.quantity || 0),
    0
  );
  const totalSalesSum = currentDevices.reduce(
    (sum, d) => sum + Number(d.price || 0) * Number(d.quantity || 0),
    0
  );
  const totalProfitWithVAT = currentDevices.reduce((sum, d) => {
    const qty = Number(d.quantity || 0);
    const price = Number(d.price || 0);
    const pur = d.purchasePrice != null ? Number(d.purchasePrice) : null;
    return pur != null ? sum + (price - pur) * qty : sum;
  }, 0);

  const totalProfitWithoutVAT = currentDevices.reduce((sum, d) => {
    const qty = Number(d.quantity || 0);
    const priceWithVAT = Number(d.price || 0);
    const purchaseWithVAT =
      d.purchasePrice != null ? Number(d.purchasePrice) : null;

    if (purchaseWithVAT != null) {
      const priceNet = priceWithVAT / (1 + VAT_RATE);
      const purchaseNet = d.purchaseHasVAT
        ? purchaseWithVAT / (1 + VAT_RATE)
        : purchaseWithVAT;
      return sum + (priceNet - purchaseNet) * qty;
    }
    return sum;
  }, 0);

  const incomeTaxToPay = totalProfitWithoutVAT * (20 / 80);
  const netProfit = totalProfitWithoutVAT - incomeTaxToPay;

  const totalSalesVAT = (totalSalesSum * VAT_RATE) / (1 + VAT_RATE);
  const totalPurchaseVAT = currentDevices.reduce((sum, d) => {
    if (!d.purchaseHasVAT) return sum;
    const purchase = Number(d.purchasePrice || 0);
    const qty = Number(d.quantity || 0);
    const totalWithVAT = purchase * qty;
    const vat = (totalWithVAT * VAT_RATE) / (1 + VAT_RATE);
    return sum + vat;
  }, 0);

  const vatToPay = totalSalesVAT - totalPurchaseVAT;

  return (
    <div style={{ paddingBottom: "40px" }}>
      <h3 className="text-xl font-semibold mb-4">📊 Бухгалтерия</h3>

      {/* Tabs */}
      <div style={{ marginBottom: "16px" }}>
        {[
          { key: "all", label: "🗃 Все товары" },
          { key: "sold", label: `💸 Проданные (${soldDevices.length})` },
          { key: "vat", label: "📄 Декларация по НДС" },
          { key: "other", label: "📑 Другая декларация" },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            style={{
              padding: "8px 16px",
              marginRight: "8px",
              borderRadius: "6px",
              border: "1px solid #ccc",
              background: activeTab === tab.key ? "#dbeafe" : "#f9fafb",
              fontWeight: activeTab === tab.key ? "bold" : "normal",
              cursor: "pointer",
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Таблица (для вкладок all) */}
      {activeTab === "all" && (
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            fontSize: "14px",
            marginBottom: "20px",
            boxShadow: "0 0 10px rgba(0,0,0,0.05)",
          }}
        >
          <thead style={{ background: "#f8f9fa" }}>
            <tr>
              <th style={thStyle}>№</th>
              <th style={thStyle}>Название</th>
              <th style={thStyle}>Кол-во</th>
              <th style={thStyle}>Закуп. цена</th>
              <th style={thStyle}>Прибыль за 1 ед.</th>
              <th style={thStyle}>Общая прибыль</th>
              <th style={thStyle}>Продажа (с НДС)</th>
              <th style={thStyle}>НДС с продажи</th>
            </tr>
          </thead>
          <tbody>
            {currentDevices.map((device, index) => {
              const quantity = Number(device.quantity || 0);
              const priceWithVAT = Number(device.price || 0);
              const purchase =
                device.purchasePrice != null
                  ? Number(device.purchasePrice)
                  : null;
              const diffPerUnit =
                purchase != null ? priceWithVAT - purchase : null;
              const totalProfit =
                diffPerUnit != null ? diffPerUnit * quantity : null;
              const sum = priceWithVAT * quantity;
              const vat = (sum * VAT_RATE) / (1 + VAT_RATE);

              return (
                <tr
                  key={device.id}
                  style={{ background: index % 2 === 0 ? "#fff" : "#f9f9f9" }}
                >
                  <td style={tdStyle}>{index + 1}</td>
                  <td style={{ ...tdStyle, textAlign: "left" }}>
                    {device.name}
                  </td>
                  <td style={tdStyle}>{quantity}</td>
                  <td style={tdStyle}>
                    {purchase != null
                      ? `${format(purchase)} €${
                          device.purchaseHasVAT ? " (НДС)" : ""
                        }`
                      : "—"}
                  </td>
                  <td
                    style={{
                      ...tdStyle,
                      color: diffPerUnit < 0 ? "red" : "green",
                    }}
                  >
                    {diffPerUnit != null ? format(diffPerUnit) : "—"}
                  </td>
                  <td style={tdStyle}>
                    {totalProfit != null ? format(totalProfit) : "—"}
                  </td>
                  <td style={tdStyle}>{format(sum)}</td>
                  <td style={tdStyle}>{format(vat)}</td>
                </tr>
              );
            })}

            {/* ИТОГО */}
            <tr style={{ fontWeight: "bold", background: "#eef2f7" }}>
              <td colSpan={2} style={tdStyle}>
                Итого:
              </td>

              <td style={tdStyle}>
                {format(
                  devices.reduce((sum, d) => sum + Number(d.quantity || 0), 0)
                )}
              </td>

              <td style={tdStyle}>
                {format(
                  devices.reduce((sum, d) => {
                    const quantity = Number(d.quantity || 0);
                    const pur =
                      d.purchasePrice != null ? Number(d.purchasePrice) : null;
                    return pur != null ? sum + pur * quantity : sum;
                  }, 0)
                )}
              </td>

              <td style={tdStyle}>—</td>

              <td style={tdStyle}>
                {format(
                  devices.reduce((sum, d) => {
                    const quantity = Number(d.quantity || 0);
                    const price = Number(d.price || 0);
                    const pur =
                      d.purchasePrice != null ? Number(d.purchasePrice) : null;
                    return pur != null ? sum + (price - pur) * quantity : sum;
                  }, 0)
                )}
              </td>

              <td style={tdStyle}>
                {format(
                  devices.reduce((sum, d) => {
                    return sum + Number(d.price || 0) * Number(d.quantity || 0);
                  }, 0)
                )}
              </td>

              <td style={tdStyle}>
                {format(
                  devices.reduce((sum, d) => {
                    const total =
                      Number(d.price || 0) * Number(d.quantity || 0);
                    return sum + (total * VAT_RATE) / (1 + VAT_RATE);
                  }, 0)
                )}
              </td>
            </tr>
          </tbody>
        </table>
      )}
	  
      {/* Таблица (для вкладок sold) */}
      {activeTab === "sold" && (
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            fontSize: "14px",
            marginBottom: "20px",
            boxShadow: "0 0 10px rgba(0,0,0,0.05)",
          }}
        >
          <thead style={{ background: "#f8f9fa" }}>
            <tr>
              <th style={thStyle}>№</th>
              <th style={thStyle}>Название</th>
              <th style={thStyle}>Кол-во</th>
              <th style={thStyle}>Закуп. цена</th>
              <th style={thStyle}>Прибыль за 1 ед.</th>
              <th style={thStyle}>Общая прибыль</th>
              <th style={thStyle}>Продажа (с НДС)</th>
              <th style={thStyle}>НДС с продажи</th>
            </tr>
          </thead>
          <tbody>
            {soldDevices.map((device, index) => {
              const quantity = Number(device.quantity || 0);
              const priceWithVAT = Number(device.price || 0);
              const purchase =
                device.purchasePrice != null
                  ? Number(device.purchasePrice)
                  : null;
              const diffPerUnit =
                purchase != null ? priceWithVAT - purchase : null;
              const totalProfit =
                diffPerUnit != null ? diffPerUnit * quantity : null;
              const sum = priceWithVAT * quantity;
              const vat = (sum * VAT_RATE) / (1 + VAT_RATE);

              return (
                <tr
                  key={device.id}
                  style={{ background: index % 2 === 0 ? "#fff" : "#f9f9f9" }}
                >
                  <td style={tdStyle}>{index + 1}</td>
                  <td style={{ ...tdStyle, textAlign: "left" }}>
                    {device.name}
                  </td>
                  <td style={tdStyle}>{quantity}</td>
                  <td style={tdStyle}>
                    {purchase != null
                      ? `${format(purchase)} €${
                          device.purchaseHasVAT ? " (НДС)" : ""
                        }`
                      : "—"}
                  </td>
                  <td
                    style={{
                      ...tdStyle,
                      color: diffPerUnit < 0 ? "red" : "green",
                    }}
                  >
                    {diffPerUnit != null ? format(diffPerUnit) : "—"}
                  </td>
                  <td style={tdStyle}>
                    {totalProfit != null ? format(totalProfit) : "—"}
                  </td>
                  <td style={tdStyle}>{format(sum)}</td>
                  <td style={tdStyle}>{format(vat)}</td>
                </tr>
              );
            })}

            {/* ИТОГО */}
            <tr style={{ fontWeight: "bold", background: "#eef2f7" }}>
              <td colSpan={2} style={tdStyle}>
                Итого:
              </td>

              <td style={tdStyle}>
                {format(
                  soldDevices.reduce((sum, d) => sum + Number(d.quantity || 0), 0)
                )}
              </td>

              <td style={tdStyle}>
                {format(
                  soldDevices.reduce((sum, d) => {
                    const quantity = Number(d.quantity || 0);
                    const pur =
                      d.purchasePrice != null ? Number(d.purchasePrice) : null;
                    return pur != null ? sum + pur * quantity : sum;
                  }, 0)
                )}
              </td>

              <td style={tdStyle}>—</td>

              <td style={tdStyle}>
                {format(
                  soldDevices.reduce((sum, d) => {
                    const quantity = Number(d.quantity || 0);
                    const price = Number(d.price || 0);
                    const pur =
                      d.purchasePrice != null ? Number(d.purchasePrice) : null;
                    return pur != null ? sum + (price - pur) * quantity : sum;
                  }, 0)
                )}
              </td>

              <td style={tdStyle}>
                {format(
                  soldDevices.reduce((sum, d) => {
                    return sum + Number(d.price || 0) * Number(d.quantity || 0);
                  }, 0)
                )}
              </td>

              <td style={tdStyle}>
                {format(
                  soldDevices.reduce((sum, d) => {
                    const total =
                      Number(d.price || 0) * Number(d.quantity || 0);
                    return sum + (total * VAT_RATE) / (1 + VAT_RATE);
                  }, 0)
                )}
              </td>
            </tr>
          </tbody>
        </table>
      )}

      {/* Декларация по НДС */}
      {activeTab === "vat" && (
        <div
          style={{
            padding: "20px",
            background: "#fff7e6",
            border: "1px solid #ffd580",
            borderRadius: "10px",
          }}
        >
          <h4 style={{ marginBottom: "10px" }}>📄 Декларация по НДС</h4>
          <p>
            🔸 <strong>НДС с продаж:</strong> {format(totalSalesVAT)} €
          </p>
          <p>
            🔹 <strong>НДС с закупок (где включён):</strong>{" "}
            {format(totalPurchaseVAT)} €
          </p>
          <p style={{ marginTop: "8px" }}>
            📤 <strong>К уплате государству:</strong> {format(vatToPay)} €
          </p>
        </div>
      )}

      {/* Другая декларация */}
      {activeTab === "other" && (
        <div
          style={{
            padding: "20px",
            background: "#f1f5f9",
            border: "1px dashed #94a3b8",
            borderRadius: "10px",
          }}
        >
          <h4>📑 Другая декларация</h4>
          <p>Пока не реализована. Здесь появится расчёт налога с прибыли.</p>
        </div>
      )}
    </div>
  );
};

const thStyle = {
  padding: "8px",
  textAlign: "center",
  borderBottom: "1px solid #ccc",
};

const tdStyle = {
  padding: "8px",
  textAlign: "center",
  borderBottom: "1px solid #eee",
};

export default AdminAccounting;
