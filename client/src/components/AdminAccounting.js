import React, { useState, useEffect, useMemo } from "react";
import { fetchDevices } from "../http/deviceAPI";
import {
  fetchCourierAccounting,
  fetchAdminOrders,
  fetchCourierIncomeOrders,
  fetchIncomeSellers,
  fetchIncomeShop,
  fetchPayoutStatuses,
  setPayoutStatus,
} from "../http/accountingAPI";
import InventoryReceipts from "./InventoryReceipts";
import styles from "./AdminAccounting.module.css";

const DONE_STATUSES = ["Delivered", "Completed"];

const MONTHS = [
  "Январь",
  "Февраль",
  "Март",
  "Апрель",
  "Май",
  "Июнь",
  "Июль",
  "Август",
  "Сентябрь",
  "Октябрь",
  "Ноябрь",
  "Декабрь",
];

const base = process.env.REACT_APP_API_URL.replace(/\/+$/, "");

const AdminAccounting = ({ devices }) => {
  const [activeTab, setActiveTab] = useState("all");
  const [soldDevices, setSoldDevices] = useState([]);
  const [devicesLocal, setDevicesLocal] = useState(devices || []);
  const [courierPeriod, setCourierPeriod] = useState("week");
  const [courierAnchor, setCourierAnchor] = useState(new Date());
  const [courierYear, setCourierYear] = useState(new Date().getFullYear());
  const [courierMonth, setCourierMonth] = useState(new Date().getMonth());
  const [courierRows, setCourierRows] = useState([]);
  const [courierLoading, setCourierLoading] = useState(false);
  const [courierError, setCourierError] = useState("");
  const [incomeTab, setIncomeTab] = useState("couriers");
  const [incomeLoading, setIncomeLoading] = useState(false);
  const [incomeError, setIncomeError] = useState("");
  const [incomeShop, setIncomeShop] = useState(null);
  const [incomeSellersRows, setIncomeSellersRows] = useState([]);
  const [courierWeekSpan, setCourierWeekSpan] = useState(1);
  const [courierPaidMap, setCourierPaidMap] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("courierPaidMap") || "{}");
    } catch {
      return {};
    }
  });

  const [sellerPaidMap, setSellerPaidMap] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("sellerPaidMap") || "{}");
    } catch {
      return {};
    }
  });

  useEffect(() => {
    localStorage.setItem("sellerPaidMap", JSON.stringify(sellerPaidMap));
  }, [sellerPaidMap]);

  useEffect(() => {
    localStorage.setItem("courierPaidMap", JSON.stringify(courierPaidMap));
  }, [courierPaidMap]);

  useEffect(() => {
    if (courierPeriod !== "week" && courierWeekSpan !== 1)
      setCourierWeekSpan(1);
  }, [courierPeriod]);

  async function toggleSellerPaid(rangeKey, sellerId) {
    const k = `${rangeKey}_${sellerId}`;
    const nextVal = !sellerPaidMap[k];

    setSellerPaidMap((prev) => ({ ...prev, [k]: nextVal }));

    try {
      const [from, to] = rangeKey.split("_");
      await setPayoutStatus({
        kind: "seller",
        entityId: sellerId,
        from,
        to,
        isPaid: nextVal,
      });
    } catch (e) {
      console.error("setPayoutStatus seller error:", e);
    }
  }

  async function togglePaid(rangeKey, courierId) {
    const k = `${rangeKey}_${courierId}`;
    const nextVal = !courierPaidMap[k];

    setCourierPaidMap((prev) => ({ ...prev, [k]: nextVal }));

    try {
      const [from, to] = rangeKey.split("_");
      await setPayoutStatus({
        kind: "courier",
        entityId: courierId,
        from,
        to,
        isPaid: nextVal,
      });
    } catch (e) {
      console.error("setPayoutStatus courier error:", e);
    }
  }

  const yearOptions = useMemo(() => {
    const y = new Date().getFullYear();
    const arr = [];
    for (let i = 0; i < 10; i++) arr.push(y - i);
    return arr;
  }, []);

  useEffect(() => {
    if (Array.isArray(devices)) setDevicesLocal(devices);
  }, [devices]);

  useEffect(() => {
    if (Array.isArray(devices)) return;
    fetchDevices(undefined, undefined, undefined, 1, 1000)
      .then((data) => setDevicesLocal(data?.rows || data || []))
      .catch(console.error);
  }, [devices]);

  function startOfWeek(d) {
    const x = new Date(d);
    const day = (x.getDay() + 6) % 7;
    x.setDate(x.getDate() - day);
    x.setHours(0, 0, 0, 0);
    return x;
  }
  function startOfMonth(d) {
    const x = new Date(d);
    x.setDate(1);
    x.setHours(0, 0, 0, 0);
    return x;
  }
  function startOfYear(d) {
    const x = new Date(d);
    x.setMonth(0, 1);
    x.setHours(0, 0, 0, 0);
    return x;
  }
  function addDays(d, n) {
    const x = new Date(d);
    x.setDate(x.getDate() + n);
    return x;
  }
  function addMonths(d, n) {
    const x = new Date(d);
    x.setMonth(x.getMonth() + n);
    return x;
  }
  function addYears(d, n) {
    const x = new Date(d);
    x.setFullYear(x.getFullYear() + n);
    return x;
  }
  function isoDate(d) {
    const x = new Date(d);
    return x.toISOString().slice(0, 10);
  }

  function getCourierRange() {
    let from;
    let to;

    if (courierPeriod === "week") {
      from = startOfWeek(courierAnchor);
      to = addDays(from, 7 * courierWeekSpan);
      return { from, to };
    }

    if (courierPeriod === "month") {
      from = startOfMonth(new Date(courierYear, courierMonth, 1));
      to = startOfMonth(addMonths(from, 1));
      return { from, to };
    }

    from = startOfYear(new Date(courierYear, 0, 1));
    to = startOfYear(addYears(from, 1));
    return { from, to };
  }

  const courierRangeLabel = useMemo(() => {
    const { from, to } = getCourierRange();
    const toShown = addDays(to, -1);
    return `${isoDate(from)} — ${isoDate(toShown)}`;
  }, [
    courierPeriod,
    courierAnchor,
    courierYear,
    courierMonth,
    courierWeekSpan,
  ]);

  async function loadCourierAccounting() {
    setCourierLoading(true);
    setCourierError("");
    try {
      const { from, to } = getCourierRange();

      const data = await fetchCourierAccounting({
        from: isoDate(from),
        to: isoDate(to),
      });

      setCourierRows(Array.isArray(data?.items) ? data.items : []);

      // вот тут подгружаем статусы "выплачено"
      const isoFrom = isoDate(from);
      const isoTo = isoDate(to);

      const payout = await fetchPayoutStatuses({
        kind: "courier",
        from: isoFrom,
        to: isoTo,
      });

      setCourierPaidMap((prev) => {
        const next = { ...prev };
        for (const [entityId, paid] of Object.entries(payout?.map || {})) {
          next[`${isoFrom}_${isoTo}_${entityId}`] = !!paid;
        }
        return next;
      });
    } catch (e) {
      console.error(e);
      setCourierRows([]);
      setCourierError("Не удалось загрузить данные по курьерам");
    } finally {
      setCourierLoading(false);
    }
  }

  async function loadIncome(tabOverride) {
    const tab = tabOverride || incomeTab;

    setIncomeLoading(true);
    setIncomeError("");

    try {
      const { from, to } = getCourierRange();
      const params = { from: isoDate(from), to: isoDate(to) };

      if (tab === "sellers") {
        const data = await fetchIncomeSellers(params);
        setIncomeSellersRows(Array.isArray(data?.items) ? data.items : []);

        try {
          const payout = await fetchPayoutStatuses({
            kind: "seller",
            from: params.from,
            to: params.to,
          });

          setSellerPaidMap((prev) => {
            const next = { ...prev };
            for (const [sellerId, paid] of Object.entries(payout?.map || {})) {
              next[`${params.from}_${params.to}_${sellerId}`] = !!paid;
            }
            return next;
          });
        } catch (e) {
          console.error("fetchPayoutStatuses seller error:", e);
        }
      }
    } catch (e) {
      console.error(e);
      setIncomeError("Не удалось загрузить доход за выбранный период");
      setIncomeShop(null);
      setIncomeSellersRows([]);
    } finally {
      setIncomeLoading(false);
    }
  }

  function courierPrev() {
    if (courierPeriod === "week") {
      setCourierAnchor((d) => addDays(d, -7));
    } else if (courierPeriod === "month") {
      const dt = new Date(courierYear, courierMonth, 1);
      const prev = addMonths(dt, -1);
      setCourierYear(prev.getFullYear());
      setCourierMonth(prev.getMonth());
    } else {
      setCourierYear((y) => y - 1);
    }
  }

  function courierNext() {
    if (courierPeriod === "week") {
      setCourierAnchor((d) => addDays(d, 7));
    } else if (courierPeriod === "month") {
      const dt = new Date(courierYear, courierMonth, 1);
      const next = addMonths(dt, 1);
      setCourierYear(next.getFullYear());
      setCourierMonth(next.getMonth());
    } else {
      setCourierYear((y) => y + 1);
    }
  }

  function courierToday() {
    const n = new Date();
    if (courierPeriod === "week") setCourierAnchor(n);
    if (courierPeriod === "month") {
      setCourierYear(n.getFullYear());
      setCourierMonth(n.getMonth());
    }
    if (courierPeriod === "year") setCourierYear(n.getFullYear());
  }

  useEffect(() => {
    if (activeTab !== "couriers" && activeTab !== "income") return;

    if (activeTab === "couriers") {
      loadCourierAccounting();
      return;
    }

    if (incomeTab === "couriers") loadCourierAccounting();
  }, [
    activeTab,
    incomeTab,
    courierPeriod,
    courierAnchor,
    courierYear,
    courierMonth,
    courierWeekSpan,
  ]);

  useEffect(() => {
    if (activeTab !== "income") return;
    if (incomeTab === "couriers") return;
    loadIncome();
  }, [
    activeTab,
    incomeTab,
    courierPeriod,
    courierAnchor,
    courierYear,
    courierMonth,
    courierWeekSpan,
  ]);

  useEffect(() => {
    if (activeTab !== "sellersPayout") return;
    setIncomeTab("sellers");
    loadIncome("sellers");
  }, [
    activeTab,
    courierPeriod,
    courierAnchor,
    courierYear,
    courierMonth,
    courierWeekSpan,
  ]);

  useEffect(() => {
    const fetchSoldDevices = async () => {
      try {
        const { from, to } = getCourierRange();
        const fromTime = from.getTime();
        const toTime = to.getTime();

        const orders = await fetchAdminOrders();
        const allSold = [];

        orders.forEach((order) => {
          if (order?.orderType !== "shop") return;
          if (order?.sellerId != null) return;
          if (!DONE_STATUSES.includes(order?.status)) return;

          const upd = new Date(
            order.updatedAt || order.createdAt || 0,
          ).getTime();
          if (!upd || upd < fromTime || upd >= toTime) return;

          let details = [];
          try {
            details =
              typeof order.orderDetails === "string"
                ? JSON.parse(order.orderDetails || "[]")
                : Array.isArray(order.orderDetails)
                  ? order.orderDetails
                  : [];
          } catch {
            details = [];
          }

          details.forEach((item) => {
            if (item?.isRestaurantItem) return;

            const deviceId = Number(item.deviceId ?? item.id);
            const sku = item.sku || item.variantSku || "";
            const key = `${deviceId}_${sku}`;

            const existing = allSold.find((d) => d._key === key);

            const deviceData = devicesLocal.find(
              (d) => Number(d.id) === deviceId,
            );
            if (!deviceData) return;

            const unitSell = Number(
              item.sellPriceAtSale ?? item.price ?? deviceData.price ?? 0,
            );

            const unitCost =
              item.purchasePriceAtSale != null
                ? Number(item.purchasePriceAtSale)
                : deviceData.purchasePrice != null
                  ? Number(deviceData.purchasePrice)
                  : null;

            const enrichedItem = {
              _key: key,
              deviceId,
              sku,
              quantity: Number(item.count ?? item.quantity ?? 1),
              price: unitSell,
              name: item.name || deviceData.name,
              purchasePrice: unitCost,
              purchaseHasVAT: Boolean(
                item.purchaseHasVATAtSale ?? deviceData.purchaseHasVAT,
              ),
            };

            if (existing) existing.quantity += enrichedItem.quantity;
            else allSold.push(enrichedItem);
          });
        });

        setSoldDevices(allSold);
      } catch (error) {
        console.error("Ошибка загрузки проданных товаров:", error);
      }
    };

    if (!devicesLocal.length) return;
    fetchSoldDevices();
  }, [
    devicesLocal,
    courierPeriod,
    courierAnchor,
    courierYear,
    courierMonth,
    courierWeekSpan,
  ]);

  const VAT_RATE = 0.24;
  const INCOME_TAX_RATE = 0.2;

  const format = (num) =>
    typeof num === "number"
      ? num.toLocaleString("et-EE", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })
      : "—";

  const currentDevices = activeTab === "sold" ? soldDevices : devicesLocal;

  const shopOrdersCount = soldDevices.reduce(
    (sum, d) => sum + Number(d.quantity || 0),
    0,
  );

  const shopGoodsRevenue = soldDevices.reduce(
    (sum, d) => sum + Number(d.price || 0) * Number(d.quantity || 0),
    0,
  );

  const shopGoodsProfit = soldDevices.reduce((sum, d) => {
    const qty = Number(d.quantity || 0);
    const sell = Number(d.price || 0);
    const cost = d.purchasePrice != null ? Number(d.purchasePrice) : null;
    if (cost == null) return sum;
    return sum + (sell - cost) * qty;
  }, 0);

  const totalQuantity = currentDevices.reduce(
    (sum, d) => sum + Number(d.quantity || 0),
    0,
  );
  const totalSalesSum = currentDevices.reduce(
    (sum, d) => sum + Number(d.price || 0) * Number(d.quantity || 0),
    0,
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

  const rangeKey = useMemo(() => {
    const { from, to } = getCourierRange();
    return `${isoDate(from)}_${isoDate(to)}`;
  }, [
    courierPeriod,
    courierAnchor,
    courierYear,
    courierMonth,
    courierWeekSpan,
  ]);

  return (
    <div className={styles.accWrap}>
      <h3 className={styles.accTitle}>📊 Бухгалтерия</h3>

      <div className={styles.accTabs}>
        {[
          { key: "all", label: "🗃 Все товары" },
          { key: "sold", label: `💸 Проданные (${soldDevices.length})` },
          { key: "receipts", label: "📦 Приход" },
          { key: "income", label: "💰 Доход" },
          { key: "couriers", label: "🛵 Вылата курьерам" },
          { key: "sellersPayout", label: "🏪 Выплата селлерам" },
          { key: "vat", label: "📄 Декларация по НДС" },
          { key: "other", label: "📑 Другая декларация" },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`${styles.accTabBtn} ${activeTab === tab.key ? styles.isActive : ""}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {(activeTab === "all" || activeTab === "sold") && (
        <table className={styles.goodsTable}>
          <thead className={styles.goodsThead}>
            <tr>
              <th className={styles.goodsTh}>№</th>
              <th className={`${styles.goodsTh} ${styles.left}`}>Название</th>
              <th className={styles.goodsTh}>Кол-во</th>
              <th className={styles.goodsTh}>Закуп. цена</th>
              <th className={styles.goodsTh}>Прибыль за 1 ед.</th>
              <th className={styles.goodsTh}>Общая прибыль</th>
              <th className={styles.goodsTh}>Продажа (с НДС)</th>
              <th className={styles.goodsTh}>НДС с продажи</th>
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
                  className={
                    index % 2 === 0 ? styles.goodsRowEven : styles.goodsRowOdd
                  }
                >
                  <td className={styles.goodsTd}>{index + 1}</td>
                  <td className={`${styles.goodsTd} ${styles.left}`}>
                    {device.name}
                  </td>
                  <td className={styles.goodsTd}>{quantity}</td>

                  <td className={styles.goodsTd}>
                    {purchase != null
                      ? `${format(purchase)} €${device.purchaseHasVAT ? " (НДС)" : ""}`
                      : "—"}
                  </td>

                  <td
                    className={`${styles.goodsTd} ${
                      diffPerUnit < 0 ? styles.goodsNeg : styles.goodsPos
                    }`}
                  >
                    {diffPerUnit != null ? format(diffPerUnit) : "—"}
                  </td>

                  <td className={styles.goodsTd}>
                    {totalProfit != null ? format(totalProfit) : "—"}
                  </td>

                  <td className={styles.goodsTd}>{format(sum)}</td>
                  <td className={styles.goodsTd}>{format(vat)}</td>
                </tr>
              );
            })}

            <tr className={styles.goodsTotalRow}>
              <td className={styles.goodsTd} colSpan={2}>
                Итого:
              </td>

              <td className={styles.goodsTd}>
                {format(
                  (activeTab === "sold" ? soldDevices : devicesLocal).reduce(
                    (sum, d) => sum + Number(d.quantity || 0),
                    0,
                  ),
                )}
              </td>

              <td className={styles.goodsTd}>
                {format(
                  (activeTab === "sold" ? soldDevices : devicesLocal).reduce(
                    (sum, d) => {
                      const quantity = Number(d.quantity || 0);
                      const pur =
                        d.purchasePrice != null
                          ? Number(d.purchasePrice)
                          : null;
                      return pur != null ? sum + pur * quantity : sum;
                    },
                    0,
                  ),
                )}
              </td>

              <td className={styles.goodsTd}>—</td>

              <td className={styles.goodsTd}>
                {format(
                  (activeTab === "sold" ? soldDevices : devicesLocal).reduce(
                    (sum, d) => {
                      const quantity = Number(d.quantity || 0);
                      const price = Number(d.price || 0);
                      const pur =
                        d.purchasePrice != null
                          ? Number(d.purchasePrice)
                          : null;
                      return pur != null ? sum + (price - pur) * quantity : sum;
                    },
                    0,
                  ),
                )}
              </td>

              <td className={styles.goodsTd}>
                {format(
                  (activeTab === "sold" ? soldDevices : devicesLocal).reduce(
                    (sum, d) =>
                      sum + Number(d.price || 0) * Number(d.quantity || 0),
                    0,
                  ),
                )}
              </td>

              <td className={styles.goodsTd}>
                {format(
                  (activeTab === "sold" ? soldDevices : devicesLocal).reduce(
                    (sum, d) => {
                      const total =
                        Number(d.price || 0) * Number(d.quantity || 0);
                      return sum + (total * VAT_RATE) / (1 + VAT_RATE);
                    },
                    0,
                  ),
                )}
              </td>
            </tr>
          </tbody>
        </table>
      )}

      {activeTab === "receipts" && (
        <InventoryReceipts
          devices={devicesLocal}
          onPatchDevices={(rows) => {
            setDevicesLocal((prev) => {
              const next = prev.map((d) => ({ ...d }));

              for (const r of rows) {
                const d = next.find((x) => Number(x.id) === Number(r.deviceId));
                if (!d) continue;

                const qty = Number(r.quantity || 0);

                if (r.variantId) {
                  const vars = Array.isArray(d.variants)
                    ? d.variants
                    : (() => {
                        try {
                          return JSON.parse(d.variants || "[]");
                        } catch {
                          return [];
                        }
                      })();

                  const vi = vars.find(
                    (v) => Number(v.id) === Number(r.variantId),
                  );
                  if (vi) {
                    vi.quantity = Number(vi.quantity || 0) + qty;
                    vi.purchasePrice = Number(r.purchasePrice);
                  }
                  d.variants = vars;
                } else {
                  d.quantity = Number(d.quantity || 0) + qty;
                  d.purchasePrice = Number(r.purchasePrice);
                  d.purchaseHasVAT = !!r.purchaseHasVAT;
                }
              }

              return next;
            });
          }}
        />
      )}

      {activeTab === "income" && (
        <div className={styles.accCard}>
          <div className={styles.incomeHeader}>
            <div className={styles.incomeTabs}>
              <button
                type="button"
                className={`${styles.accBtn} ${incomeTab === "couriers" ? styles.accBtnPrimary : ""}`}
                onClick={() => setIncomeTab("couriers")}
              >
                🛵 Комисия с курьеров
              </button>

              <button
                type="button"
                className={`${styles.accBtn} ${incomeTab === "sellers" ? styles.accBtnPrimary : ""}`}
                onClick={() => setIncomeTab("sellers")}
              >
                🏪 Комисия от Селеров
              </button>

              <button
                type="button"
                className={`${styles.accBtn} ${incomeTab === "shop" ? styles.accBtnPrimary : ""}`}
                onClick={() => setIncomeTab("shop")}
              >
                🛒 Доход DlyQ Store
              </button>
            </div>

            <div className={styles.incomePeriod}>
              <div className={styles.courierRange}>
                <div className={styles.courierRangeTop}>
                  <div className={styles.courierRangeLabel}>Период</div>

                  <div className={styles.courierRangeNav}>
                    <button
                      type="button"
                      className={styles.rangeNavBtn}
                      onClick={courierPrev}
                      title="Предыдущий период"
                    >
                      ◀
                    </button>
                    <button
                      type="button"
                      className={styles.rangeNavBtn}
                      onClick={courierNext}
                      title="Следующий период"
                    >
                      ▶
                    </button>
                  </div>
                </div>

                <div className={styles.courierRangeValue}>
                  {courierRangeLabel}
                </div>
              </div>

              <div className={styles.incomeControls}>
                <select
                  className={styles.accSelect}
                  value={courierPeriod}
                  onChange={(e) => setCourierPeriod(e.target.value)}
                >
                  <option value="week">Неделя</option>
                  <option value="month">Месяц</option>
                  <option value="year">Год</option>
                </select>

                {courierPeriod === "week" && (
                  <select
                    className={styles.accSelect}
                    value={courierWeekSpan}
                    onChange={(e) => setCourierWeekSpan(Number(e.target.value))}
                    title="Ширина периода"
                  >
                    <option value={1}>1 неделя</option>
                    <option value={2}>2 недели</option>
                    <option value={4}>4 недели</option>
                  </select>
                )}

                {(courierPeriod === "month" || courierPeriod === "year") && (
                  <select
                    className={styles.accSelect}
                    value={courierYear}
                    onChange={(e) => setCourierYear(Number(e.target.value))}
                  >
                    {yearOptions.map((y) => (
                      <option key={y} value={y}>
                        {y}
                      </option>
                    ))}
                  </select>
                )}

                {courierPeriod === "month" && (
                  <select
                    className={styles.accSelect}
                    value={courierMonth}
                    onChange={(e) => setCourierMonth(Number(e.target.value))}
                  >
                    {MONTHS.map((m, idx) => (
                      <option key={m} value={idx}>
                        {m}
                      </option>
                    ))}
                  </select>
                )}

                <button className={styles.accBtn} onClick={courierToday}>
                  Сегодня
                </button>

                <button
                  className={styles.accBtnPrimary}
                  onClick={() => {
                    if (incomeTab === "couriers") loadCourierAccounting();
                    else loadIncome();
                  }}
                  disabled={incomeLoading || courierLoading}
                >
                  {(incomeTab === "couriers" ? courierLoading : incomeLoading)
                    ? "Загрузка..."
                    : "Обновить"}
                </button>
              </div>
            </div>
          </div>

          {incomeError ? (
            <div className={styles.accError}>{incomeError}</div>
          ) : null}

          {incomeTab === "couriers" && (
            <>
              <div style={{ marginBottom: 10, fontWeight: 600 }}>
                Комиссия с доставок (за период, как в “Курьеры”)
              </div>

              <div className={styles.accTableWrap}>
                <table className={styles.accTable}>
                  <thead>
                    <tr>
                      <th className={styles.left}>Курьер</th>
                      <th>Заказов</th>
                      <th>Комиссия €</th>
                    </tr>
                  </thead>
                  <tbody>
                    {courierRows.length === 0 && !courierLoading ? (
                      <tr>
                        <td colSpan={3} className={styles.accEmpty}>
                          Нет данных за выбранный период
                        </td>
                      </tr>
                    ) : (
                      courierRows.map((r) => (
                        <tr key={r.courierId}>
                          <td className={styles.left}>
                            {r.courierName || `#${r.courierId}`}
                          </td>
                          <td>{r.ordersCount}</td>
                          <td>{format(Number(r.sumCommission || 0))}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              <div style={{ marginTop: 10, fontWeight: 700 }}>
                Итого комиссия:{" "}
                {format(
                  courierRows.reduce(
                    (s, r) => s + Number(r.sumCommission || 0),
                    0,
                  ),
                )}{" "}
                €
              </div>
            </>
          )}

          {incomeTab === "shop" && (
            <>
              <div style={{ marginBottom: 10, fontWeight: 600 }}>
                Доход DlyQ Store (проданные товары, без доставки)
              </div>

              {soldDevices.length === 0 && !incomeLoading ? (
                <div className={styles.accEmpty}>
                  Нет данных за выбранный период
                </div>
              ) : (
                <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                  <div className={styles.accMiniCard}>
                    <div className={styles.accMiniLabel}>Продано (шт.)</div>
                    <div className={styles.accMiniValue}>{shopOrdersCount}</div>
                  </div>

                  <div className={styles.accMiniCard}>
                    <div className={styles.accMiniLabel}>
                      Товары (Продажи товаров €) €
                    </div>
                    <div className={styles.accMiniValue}>
                      {format(shopGoodsRevenue)} €
                    </div>
                  </div>

                  <div className={styles.accMiniCard}>
                    <div className={styles.accMiniLabel}>Прибыль €</div>
                    <div className={styles.accMiniValue}>
                      {format(shopGoodsProfit)} €
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

          {incomeTab === "sellers" && (
            <>
              <div style={{ marginBottom: 10, fontWeight: 600 }}>
                Комиссия с селлеров (за период)
              </div>

              <div className={styles.accTableWrap}>
                <table className={styles.accTable}>
                  <thead>
                    <tr>
                      <th className={styles.left}>Ресторан</th>
                      <th>Заказов</th>
                      <th>Комиссия €</th>
                    </tr>
                  </thead>

                  <tbody>
                    {incomeSellersRows.length === 0 && !incomeLoading ? (
                      <tr>
                        <td colSpan={3} className={styles.accEmpty}>
                          Нет данных за выбранный период
                        </td>
                      </tr>
                    ) : (
                      incomeSellersRows.map((r) => (
                        <tr key={r.sellerId}>
                          <td className={styles.left}>
                            {r.sellerName || `#${r.sellerId}`}
                          </td>
                          <td>{Number(r.ordersCount || 0)}</td>
                          <td>{format(Number(r.sumSellerCommission || 0))}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              <div style={{ marginTop: 10, fontWeight: 700 }}>
                Итого комиссия:{" "}
                {format(
                  incomeSellersRows.reduce(
                    (s, r) => s + Number(r.sumSellerCommission || 0),
                    0,
                  ),
                )}{" "}
                €
              </div>
            </>
          )}
        </div>
      )}

      {activeTab === "couriers" && (
        <div className={styles.accCard}>
          <div className={styles.courierHeader}>
            <div className={styles.courierControls}>
              <select
                className={styles.accSelect}
                value={courierPeriod}
                onChange={(e) => setCourierPeriod(e.target.value)}
              >
                <option value="week">Неделя</option>
                <option value="month">Месяц</option>
                <option value="year">Год</option>
              </select>

              {courierPeriod === "week" && (
                <select
                  className={styles.accSelect}
                  value={courierWeekSpan}
                  onChange={(e) => setCourierWeekSpan(Number(e.target.value))}
                  title="Ширина периода"
                >
                  <option value={1}>1 неделя</option>
                  <option value={2}>2 недели</option>
                  <option value={4}>4 недели</option>
                </select>
              )}

              {(courierPeriod === "month" || courierPeriod === "year") && (
                <select
                  className={styles.accSelect}
                  value={courierYear}
                  onChange={(e) => setCourierYear(Number(e.target.value))}
                >
                  {yearOptions.map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
              )}

              {courierPeriod === "month" && (
                <select
                  className={styles.accSelect}
                  value={courierMonth}
                  onChange={(e) => setCourierMonth(Number(e.target.value))}
                >
                  {MONTHS.map((m, idx) => (
                    <option key={m} value={idx}>
                      {m}
                    </option>
                  ))}
                </select>
              )}

              <button className={styles.accBtn} onClick={courierPrev}>
                ◀
              </button>
              <button className={styles.accBtn} onClick={courierToday}>
                Сегодня
              </button>
              <button className={styles.accBtn} onClick={courierNext}>
                ▶
              </button>

              <button
                className={styles.accBtnPrimary}
                onClick={loadCourierAccounting}
                disabled={courierLoading}
              >
                {courierLoading ? "Загрузка..." : "Обновить"}
              </button>
            </div>

            <div className={styles.courierRange}>
              <div className={styles.courierRangeTop}>
                <div className={styles.courierRangeLabel}>Период</div>

                <div className={styles.courierRangeNav}>
                  <button
                    type="button"
                    className={styles.rangeNavBtn}
                    onClick={courierPrev}
                    title="Предыдущий период"
                  >
                    ◀
                  </button>

                  <button
                    type="button"
                    className={styles.rangeNavBtn}
                    onClick={courierNext}
                    title="Следующий период"
                  >
                    ▶
                  </button>
                </div>
              </div>

              <div className={styles.courierRangeValue}>
                {courierRangeLabel}
              </div>
            </div>
          </div>

          {courierError ? (
            <div className={styles.accError}>{courierError}</div>
          ) : null}

          <div className={styles.accTableWrap}>
            <table className={styles.accTable}>
              <thead>
                <tr>
                  <th className={styles.left}>Курьер</th>
                  <th>Заказов</th>
                  <th>Сумма с комиссией €</th>
                  <th>Снято комиссии €</th>
                  <th>Выплата курьеру €</th>
                  <th>Счёт</th>
                  <th>Статус</th>
                </tr>
              </thead>
              <tbody>
                {courierRows.length === 0 && !courierLoading ? (
                  <tr>
                    <td colSpan={7} className={styles.accEmpty}>
                      Нет данных за выбранный период
                    </td>
                  </tr>
                ) : (
                  courierRows.map((r) => (
                    <tr key={r.courierId}>
                      <td className={styles.left}>
                        {r.courierName || `#${r.courierId}`}
                      </td>
                      <td>{r.ordersCount}</td>
                      <td>
                        {format(
                          Number(r.sumCourierFee || 0) +
                            Number(r.sumCommission || 0),
                        )}
                      </td>

                      <td>{format(Number(r.sumCommission || 0))}</td>
                      <td>{format(Number(r.sumCourierFee || 0))}</td>
                      <td>{r.iban || "—"}</td>
                      <td>
                        <button
                          className={`${styles.payBtn} ${courierPaidMap[`${rangeKey}_${r.courierId}`] ? styles.payOk : styles.payNo}`}
                          onClick={() => togglePaid(rangeKey, r.courierId)}
                          type="button"
                        >
                          {courierPaidMap[`${rangeKey}_${r.courierId}`]
                            ? "Выплачено"
                            : "Не выплачено"}
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === "sellersPayout" && (
        <div className={styles.accCard}>
          <div className={styles.courierHeader}>
            <div className={styles.courierControls}>
              <select
                className={styles.accSelect}
                value={courierPeriod}
                onChange={(e) => setCourierPeriod(e.target.value)}
              >
                <option value="week">Неделя</option>
                <option value="month">Месяц</option>
                <option value="year">Год</option>
              </select>

              {courierPeriod === "week" && (
                <select
                  className={styles.accSelect}
                  value={courierWeekSpan}
                  onChange={(e) => setCourierWeekSpan(Number(e.target.value))}
                  title="Ширина периода"
                >
                  <option value={1}>1 неделя</option>
                  <option value={2}>2 недели</option>
                  <option value={4}>4 недели</option>
                </select>
              )}

              {(courierPeriod === "month" || courierPeriod === "year") && (
                <select
                  className={styles.accSelect}
                  value={courierYear}
                  onChange={(e) => setCourierYear(Number(e.target.value))}
                >
                  {yearOptions.map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
              )}

              {courierPeriod === "month" && (
                <select
                  className={styles.accSelect}
                  value={courierMonth}
                  onChange={(e) => setCourierMonth(Number(e.target.value))}
                >
                  {MONTHS.map((m, idx) => (
                    <option key={m} value={idx}>
                      {m}
                    </option>
                  ))}
                </select>
              )}

              <button className={styles.accBtn} onClick={courierPrev}>
                ◀
              </button>
              <button className={styles.accBtn} onClick={courierToday}>
                Сегодня
              </button>
              <button className={styles.accBtn} onClick={courierNext}>
                ▶
              </button>

              <button
                className={styles.accBtnPrimary}
                onClick={loadIncome}
                disabled={incomeLoading}
              >
                {incomeLoading ? "Загрузка..." : "Обновить"}
              </button>
            </div>

            <div className={styles.courierRange}>
              <div className={styles.courierRangeTop}>
                <div className={styles.courierRangeLabel}>Период</div>
                <div className={styles.courierRangeNav}>
                  <button
                    type="button"
                    className={styles.rangeNavBtn}
                    onClick={courierPrev}
                    title="Предыдущий период"
                  >
                    ◀
                  </button>
                  <button
                    type="button"
                    className={styles.rangeNavBtn}
                    onClick={courierNext}
                    title="Следующий период"
                  >
                    ▶
                  </button>
                </div>
              </div>

              <div className={styles.courierRangeValue}>
                {courierRangeLabel}
              </div>
            </div>
          </div>

          <div className={styles.accTableWrap}>
            <table className={styles.accTable}>
              <thead>
                <tr>
                  <th className={styles.left}>Селлер</th>
                  <th>Заказов</th>
                  <th>Сумма (с комиссией) €</th>
                  <th>Комиссия €</th>
                  <th>К выплате €</th>
                  <th>Счёт</th>
                  <th>Статус</th>
                </tr>
              </thead>
              <tbody>
                {incomeSellersRows.length === 0 && !incomeLoading ? (
                  <tr>
                    <td colSpan={7} className={styles.accEmpty}>
                      Нет данных за выбранный период
                    </td>
                  </tr>
                ) : (
                  incomeSellersRows.map((r) => (
                    <tr key={r.sellerId}>
                      <td className={styles.left}>
                        {r.sellerName || `#${r.sellerId}`}
                      </td>
                      <td>{Number(r.ordersCount || 0)}</td>
                      <td>{format(Number(r.sumGoods || 0))}</td>
                      <td>{format(Number(r.sumSellerCommission || 0))}</td>
                      <td>{format(Number(r.sumToSeller || 0))}</td>
                      <td>{r.iban || "—"}</td>
                      <td>
                        <button
                          className={`${styles.payBtn} ${sellerPaidMap[`${rangeKey}_${r.sellerId}`] ? styles.payOk : styles.payNo}`}
                          onClick={() => toggleSellerPaid(rangeKey, r.sellerId)}
                          type="button"
                        >
                          {sellerPaidMap[`${rangeKey}_${r.sellerId}`]
                            ? "Выплачено"
                            : "Не выплачено"}
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className={styles.payoutTotals}>
            <div className={styles.payoutTotalCard}>
              <div className={styles.payoutTotalLabel}>Сумма (с комиссией)</div>
              <div className={styles.payoutTotalValue}>
                {format(
                  incomeSellersRows.reduce(
                    (s, r) => s + Number(r.sumGoods || 0),
                    0,
                  ),
                )}{" "}
                €
              </div>
            </div>

            <div className={styles.payoutTotalCard}>
              <div className={styles.payoutTotalLabel}>Комиссия</div>
              <div className={styles.payoutTotalValue}>
                {format(
                  incomeSellersRows.reduce(
                    (s, r) => s + Number(r.sumSellerCommission || 0),
                    0,
                  ),
                )}{" "}
                €
              </div>
            </div>

            <div className={styles.payoutTotalCard}>
              <div className={styles.payoutTotalLabel}>К выплате</div>
              <div className={styles.payoutTotalValue}>
                {format(
                  incomeSellersRows.reduce(
                    (s, r) => s + Number(r.sumToSeller || 0),
                    0,
                  ),
                )}{" "}
                €
              </div>
            </div>
          </div>
        </div>
      )}

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

export default AdminAccounting;
