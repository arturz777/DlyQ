import React, { useContext, useState, useEffect } from "react";
import { Context } from "../index";
import { observer } from "mobx-react-lite";
import { Container, Image, Card, Form } from "react-bootstrap";
import { toast } from "react-toastify";
import PaymentForm from "../components/PaymentForm";
import { useConfirm } from "../components/modals/ConfirmProvider";
import { loadStripe } from "@stripe/stripe-js";
import { Elements } from "@stripe/react-stripe-js";
import { useNavigate } from "react-router-dom";
import { checkStock } from "../http/deviceAPI";
import { fetchSellerById } from "../http/sellerAPI";
import { fetchShopStatus } from "../http/shopAPI";
import { createOrder } from "../http/orderAPI";
import SlideModal from "../components/modals/SlideModal";
import DevicePage from "../pages/DevicePage";
import { useTranslation } from "react-i18next";
import styles from "./Basket.module.css";

const stripePromise = loadStripe(process.env.REACT_APP_STRIPE_PUBLIC_KEY).catch(
  () => null
);

const getVal = (x) =>
  x && typeof x === "object" && "value" in x ? x.value : x;

const makeVariantKey = (selected = {}) =>
  Object.keys(selected)
    .sort()
    .map((k) => `${k}:${String(getVal(selected[k]))}`)
    .join("|");

const parseMaybeJSON = (v) => {
  if (!v) return v;
  if (typeof v === "string") {
    try {
      return JSON.parse(v);
    } catch {
      return v;
    }
  }
  return v;
};

const formatSelectedOptionsMeta = (item) => {
  const meta =
    item?.selectedOptionsMeta || item?.optionsMeta || item?.selectedOptionsMeta;

  if (!Array.isArray(meta) || meta.length === 0) return [];

  return meta
    .map((g) => {
      const title = g?.groupTitle || g?.title || "";
      const chosenArr = Array.isArray(g?.chosen) ? g.chosen : [];
      const chosen = chosenArr
        .map((c) => {
          const t = c?.title || "";
          const d = Number(c?.priceDelta || 0);
          return d ? `${t} ` : t;
        })
        .filter(Boolean)
        .join(", ");

      if (!chosen) return null;
      return title ? `${title}: ${chosen}` : chosen;
    })
    .filter(Boolean);
};

const normalizeVariants = (item) => {
  const arr = parseMaybeJSON(item.variants) || [];
  return (arr || []).map((v) => {
    const sel = parseMaybeJSON(v.selected) || {};
    return { ...v, selected: sel, key: v.key || makeVariantKey(sel) };
  });
};

const isRestaurantItem = (item) => item?.isRestaurantItem === true;

const normUiLang = (l) => {
  const short = String(l || "ru")
    .toLowerCase()
    .split("-")[0];
  if (short === "et") return "est";
  return short;
};

const pickTr = (base, map, lang) => {
  if (!map || typeof map !== "object") return base;
  const v = map[lang];
  return typeof v === "string" && v.trim() ? v : base;
};

const pickItemName = (item, lang) => {
  if (!item) return "";
  const tr = item.translations;

  if (tr?.name && typeof tr.name === "object") {
    return pickTr(item.name, tr.name, lang);
  }

  if (tr && typeof tr === "object" && typeof tr[lang] === "string") {
    return tr[lang].trim() ? tr[lang] : item.name;
  }

  return item.name;
};

const Basket = observer(() => {
  const { basket, user } = useContext(Context);
  const navigate = useNavigate();
  const confirm = useConfirm();

  const [deliveryCost, setDeliveryCost] = useState(0);
  const [availableQuantities, setAvailableQuantities] = useState({});
  const [deliveryDate, setDeliveryDate] = useState("");
  const [isPreorder, setIsPreorder] = useState(false);
  const [storeClosed, setStoreClosed] = useState(false);
  const [preferredTime, setPreferredTime] = useState("");
  const [selectedDeviceId, setSelectedDeviceId] = useState(null);

  const [busyAction, setBusyAction] = useState({});

  const getSelectedSellerId = (basket) => {
    const list = basket.selectedItems || [];
    if (!list.length) return null;

    const ids = new Set(
      list
        .map((it) => Number(it?.sellerId ?? it?.device?.sellerId ?? null))
        .filter((x) => Number.isFinite(x) && x > 0),
    );

    return ids.size === 1 ? [...ids][0] : null;
  };

  const setBusy = (key, action) =>
    setBusyAction((prev) => ({ ...prev, [key]: action }));

  const { t, i18n } = useTranslation();
  const uiLang = normUiLang(i18n.language);

  const selectedItems = basket.selectedItems || [];
  const selectedTotal = basket.getSelectedTotalPrice
    ? basket.getSelectedTotalPrice()
    : 0;

  const isOOS = (item) =>
    isRestaurantItem(item)
      ? false
      : typeof basket.isOOS === "function"
        ? basket.isOOS(item)
        : Number(item.stockQuantity ?? item.quantity ?? 0) <
          Number(item.count || 1);

  const isOutOfStockItem = isOOS;

  const stockItems = basket.items.filter((i) => !isOutOfStockItem(i));
  const preorderItems = basket.items.filter((i) => isOutOfStockItem(i));

  const hasSelectedStock = selectedItems.some((i) => !isOOS(i));
  const hasSelectedOOS = selectedItems.some((i) => isOOS(i));

  const selectedHasOnlyPreorders =
    selectedItems.length > 0 && selectedItems.every((i) => isOOS(i));

  const selectedHasOnlyStockItems =
    selectedItems.length > 0 && selectedItems.every((i) => !isOOS(i));

  const selectedHasMixedItems =
    selectedItems.some((i) => isOOS(i)) && selectedItems.some((i) => !isOOS(i));

  const hasOnlyPreorders =
    basket.items.length > 0 && basket.items.every((item) => item.isPreorder);
  const hasMixedItems =
    basket.items.some((item) => item.isPreorder) &&
    basket.items.some((item) => !item.isPreorder);

  const disablePreorderCheckbox =
    selectedHasOnlyPreorders ||
    storeClosed ||
    selectedItems.some((item) => isOOS(item) || item.isStoreClosed);

  const fetchStockInfo = async (deviceId, quantity, selectedOptions) => {
    try {
      const data = await checkStock(deviceId, quantity, selectedOptions);

      if (data.status === "error") {
        return { isEnough: false, quantity: 0 };
      }

      const qty = Number(data.quantity ?? 0);
      const isEnough =
        typeof data.isEnough === "boolean"
          ? data.isEnough
          : qty >= Number(quantity || 0);

      return { isEnough, quantity: qty };
    } catch (e) {
      console.error("Error checking stock:", e);
      return { isEnough: false, quantity: 0 };
    }
  };

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const sellerId = getSelectedSellerId(basket);

        if (sellerId) {
          const s = await fetchSellerById(sellerId);
          if (!cancelled) setStoreClosed(!s?.isOpenNow);
          return;
        }

        const data = await fetchShopStatus();
        if (!cancelled) {
          setStoreClosed(
            typeof data.isStoreClosed === "boolean"
              ? data.isStoreClosed
              : !data.isOpen,
          );
        }
      } catch (e) {
        console.error(e);
        if (!cancelled) setStoreClosed(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [selectedItems.length, basket.selectedSellerId]);

  useEffect(() => {
    const fetchQuantities = async () => {
      const newQuantities = {};

      for (const item of basket.items) {
        if (isRestaurantItem(item)) {
          newQuantities[item.uniqueKey] = null;
          continue;
        }

        try {
          const normalizedOptions = Object.fromEntries(
            Object.entries(item.selectedOptions || {}).map(([k, v]) => [
              k,
              getVal(v),
            ]),
          );

          const data = await checkStock(item.id, item.count, normalizedOptions);
          newQuantities[item.uniqueKey] = Number(data.quantity ?? 0);
        } catch (error) {
          console.error("Error checking stock:", error);
          newQuantities[item.uniqueKey] = 0;
        }
      }

      setAvailableQuantities(newQuantities);
    };

    fetchQuantities();
  }, [basket.items]);

  useEffect(() => {
    const allPreorders = hasOnlyPreorders;
    const anyOutOfStock = basket.items.some((item) => item.stockQuantity === 0);

    if (
      (allPreorders || storeClosed || anyOutOfStock) &&
      !hasMixedItems &&
      !isPreorder
    ) {
      setIsPreorder(true);
    }
  }, [basket.items, hasOnlyPreorders, hasMixedItems, isPreorder, storeClosed]);

  const handleIncrement = async (uniqueKey) => {
    if (busyAction[uniqueKey]) return;
    const item = basket.items.find((i) => i.uniqueKey === uniqueKey);
    if (!item) return;

    const newCount = item.count + 1;

    if (isRestaurantItem(item)) {
      basket.updateItemCount(uniqueKey, newCount);
      return;
    }

    setBusy(uniqueKey, "inc");
    try {
      const normalizedOptions = Object.fromEntries(
        Object.entries(item.selectedOptions || {}).map(([k, v]) => [
          k,
          getVal(v),
        ]),
      );

      const info = await fetchStockInfo(item.id, newCount, normalizedOptions);

      item.stockQuantity = info.quantity;

      if (!info.isEnough) {
        item.isPreorder = true;
        basket.setSelected(item.uniqueKey, false);
      } else {
        item.isPreorder = false;
      }

      basket.updateItemCount(uniqueKey, newCount);
    } finally {
      setBusy(uniqueKey, null);
    }
  };

  const handleDecrement = async (uniqueKey) => {
    if (busyAction[uniqueKey]) return;
    const item = basket.items.find((i) => i.uniqueKey === uniqueKey);
    if (!item) return;

    const currentCount = basket.getItemCount(uniqueKey);
    if (currentCount <= 1) return;

    const newCount = currentCount - 1;

    if (isRestaurantItem(item)) {
      basket.updateItemCount(uniqueKey, newCount);
      return;
    }

    setBusy(uniqueKey, "dec");
    try {
      const normalizedOptions = Object.fromEntries(
        Object.entries(item.selectedOptions || {}).map(([k, v]) => [
          k,
          getVal(v),
        ]),
      );

      const info = await fetchStockInfo(item.id, newCount, normalizedOptions);

      item.stockQuantity = info.quantity;
      item.isPreorder = !info.isEnough;

      if (item.isPreorder) {
        basket.setSelected(item.uniqueKey, false);
      }

      basket.updateItemCount(uniqueKey, newCount);
    } finally {
      setBusy(uniqueKey, null);
    }
  };

  const handleRemove = (uniqueKey) => {
    basket.removeItem(uniqueKey);
  };

  const handlePaymentSuccess = async (payment, formData) => {
    const paymentIntentId =
      payment?.paymentIntentId || payment?.id || payment?.paymentIntent?.id;
    if (!paymentIntentId) {
      toast.error(t("failed to get paymentIntentId", { ns: "basket" }));
      return;
    }

    if (basket.hasSelectedDifferentSellers) {
      toast.error(
        t("you cannot place an order with items from different sellers", {
          ns: "basket",
        }),
      );
      return;
    }

    const hasUnselectedOptions = (basket.selectedItems || []).some(
      (item) =>
        item.selectedOptions &&
        Object.values(item.selectedOptions).some(
          (opt) =>
            opt.value === "__UNSELECTED__" ||
            opt.value === t("select an option", { ns: "basket" }),
        ),
    );

    if (hasUnselectedOptions) {
      toast.error(t("select an option before payment", { ns: "basket" }));
      return;
    }

    const dataToSend = {
      formData,
      paymentIntentId,
      totalPrice: basket.getSelectedTotalPrice(),
      language: uiLang,
      orderDetails: (basket.selectedItems || []).map((item, index) => {
        const isRest = item.isRestaurantItem === true;
        return {
          translations: item.translations,
          name: item.name,
          price: item.price,
          count: item.count,
          image: item.img,
          selectedOptions: item.selectedOptions || {},
          selectedOptionsMeta: item.selectedOptionsMeta || [],
          isPreorder: item.isPreorder || isPreorder,
          isRestaurantItem: isRest,
          ...(isRest ? { menuItemId: item.id } : { deviceId: item.id }),
          preferredTime:
            index === 0 && (item.isPreorder || isPreorder)
              ? preferredTime
              : null,
          deliveryDate:
            index === 0 && (item.isPreorder || isPreorder)
              ? deliveryDate
              : null,
        };
      }),
    };

    try {
      await createOrder(dataToSend);

      toast.success(t("order placed successfully", { ns: "basket" }));
      window.dispatchEvent(new Event("orderUpdated"));
      basket.removeSelectedItems();
      navigate("/");
    } catch (error) {
      const msg =
        error?.response?.data?.message ||
        t("error creating order", { ns: "basket" });

      console.error("createOrder error:", error);
      toast.error(msg);
    }
  };

  const handleOptionChange = async (
    itemUniqueKey,
    optionName,
    selectedValue,
  ) => {
    if (busyAction[itemUniqueKey]) return;
    const item = basket.items.find((i) => i.uniqueKey === itemUniqueKey);
    if (!item) return;

    const optionsArr = parseMaybeJSON(item.options) || [];
    const updatedOption = optionsArr
      ?.find((opt) => opt.name === optionName)
      ?.values.find((val) => val.value === selectedValue);

    if (!updatedOption) {
      basket.updateSelectedOption(itemUniqueKey, optionName, {
        value: t("select an option", { ns: "basket" }),
        price: 0,
      });
      return;
    }

    const newOptions = {
      ...item.selectedOptions,
      [optionName]: updatedOption,
    };

    const normalizedOptions = Object.fromEntries(
      Object.entries(newOptions || {}).map(([k, v]) => [k, getVal(v)]),
    );

    const info = await fetchStockInfo(item.id, item.count, normalizedOptions);

    const qtyText = `${info.quantity} ${t("unit_pcs_short", { ns: "basket" })}`;

    if (info.quantity > 0 && item.count > info.quantity) {
      toast.error(t("only_x_in_stock_reduce_qty", { ns: "basket", qtyText }));
    }

    const isThisPreorder = !info.isEnough;

    item.isPreorder = isThisPreorder;
    item.stockQuantity = info.quantity;

    if (isThisPreorder) {
      basket.setSelected(itemUniqueKey, false);
    }

    basket.updateSelectedOption(itemUniqueKey, optionName, updatedOption);

    if (isThisPreorder) {
      setIsPreorder(true);
    }
  };

  const OptionPicker = ({ item, option, index }) => {
    const lang = uiLang;
    const variants = normalizeVariants(item);
    const selected = item.selectedOptions?.[option.name];
    const isFirst = index === 0;

    const variantsActive = variants.filter((v) => v?.isActive !== false);

    const existsCombination = (optName, valueObj) => {
      if (!variants.length) return true;
      const partial = Object.fromEntries(
        Object.entries(item.selectedOptions || {}).map(([k, v]) => [
          k,
          getVal(v),
        ]),
      );
      partial[optName] = getVal(valueObj);

      return variantsActive.some((v) =>
        Object.entries(partial).every(
          ([k, val]) => (v.selected || {})[k] === val,
        ),
      );
    };

    const isOutOfStock = (optName, valueObj) => {
      if (!variants.length) {
        return (Number(valueObj.quantity) || 0) === 0;
      }
      const partial = Object.fromEntries(
        Object.entries(item.selectedOptions || {}).map(([k, v]) => [
          k,
          getVal(v),
        ]),
      );
      partial[optName] = getVal(valueObj);

      const exists = existsCombination(optName, valueObj);
      if (!exists) return false;

      const anyInStock = variantsActive.some(
        (v) =>
          Object.entries(partial).every(
            ([k, val]) => (v.selected || {})[k] === val,
          ) && (Number(v.quantity) || 0) > 0,
      );
      return !anyInStock;
    };

    const labelOfOption = option.translations?.name?.[lang] || option.name;
    const valueLabel = (idx, valObj) =>
      option.translations?.values?.[idx]?.[lang] || valObj.value;

    const pick = (valObj) =>
      handleOptionChange(item.uniqueKey, option.name, valObj.value);

    if (isFirst) {
      return (
        <div
          className={styles.OptionGroup}
          role="radiogroup"
          aria-label={labelOfOption}
        >
          <div className={styles.OptionLabel}>{labelOfOption}</div>
          <div className={styles.OptionGrid}>
            {option.values.map((valObj, idx) => {
              const isSelected = selected?.value === valObj.value;
              const exists = existsCombination(option.name, valObj);
              const oos = isOutOfStock(option.name, valObj);

              return (
                <button
                  key={idx}
                  type="button"
                  className={[
                    styles.OptionBtn,
                    isSelected ? styles.OptionBtnSelected : "",
                    !exists
                      ? styles.OptionBtnDisabled
                      : oos
                        ? styles.OptionBtnOut
                        : "",
                  ].join(" ")}
                  onClick={() => exists && pick(valObj)}
                  disabled={!exists}
                  aria-pressed={isSelected}
                >
                  {valueLabel(idx, valObj)}
                </button>
              );
            })}
          </div>
        </div>
      );
    }

    return (
      <div
        className={styles.OptionGroup}
        role="radiogroup"
        aria-label={labelOfOption}
      >
        <div className={styles.OptionLabel}>{labelOfOption}</div>
        <div className={styles.OptionGrid}>
          {option.values.map((valObj, idx) => {
            const isSelected = selected?.value === valObj.value;
            const exists = existsCombination(option.name, valObj);
            const oos = isOutOfStock(option.name, valObj);

            return (
              <button
                key={idx}
                type="button"
                className={[
                  styles.OptionBtn,
                  isSelected ? styles.OptionBtnSelected : "",
                  !exists
                    ? styles.OptionBtnDisabled
                    : oos
                      ? styles.OptionBtnOut
                      : "",
                ].join(" ")}
                onClick={() => exists && pick(valObj)}
                disabled={!exists}
                aria-pressed={isSelected}
              >
                {valueLabel(idx, valObj)}
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  const renderItem = (item, index, isFirstCard) => {
    const variants = normalizeVariants(item);

    const selectedKey = makeVariantKey(
      Object.fromEntries(
        Object.entries(item.selectedOptions || {}).map(([k, v]) => [
          k,
          getVal(v),
        ]),
      ),
    );

    const selectedVariant =
      variants.find(
        (v) => (v.key || makeVariantKey(v.selected || {})) === selectedKey,
      ) || null;

    const displayImg = selectedVariant?.image || item.img;
    const optionsArr = parseMaybeJSON(item.options) || [];

    const itemIsOOS = isOOS(item);

    const selectedSellerId = basket.selectedSellerId ?? null;
    const itemSellerId =
      typeof basket.getItemSellerId === "function"
        ? basket.getItemSellerId(item)
        : Number(item?.sellerId) || null;

    const disableBySeller =
      selectedSellerId && itemSellerId && selectedSellerId !== itemSellerId;

    const disableCheckbox =
      disableBySeller ||
      (itemIsOOS && hasSelectedStock) ||
      (!itemIsOOS && hasSelectedOOS);

    const title = pickItemName(item, uiLang);
    const action = busyAction[item.uniqueKey];
    const busy = !!action;

    return (
      <Card
        key={item.uniqueKey}
        className={`${styles.card} ${
          isFirstCard ? styles.firstCard : styles.otherCards
        }`}
      >
        <div className={styles.cardContent}>
          <div className={styles.topRow}>
            <Form.Check
              type="checkbox"
              className={styles.itemCheckbox}
              checked={basket.isSelected(item.uniqueKey)}
              onChange={() => basket.toggleSelect(item.uniqueKey)}
              disabled={disableCheckbox}
            />

            {!!displayImg && (
              <Image
                className={styles.image}
                src={displayImg}
                alt={title}
                onClick={() => {
                  if (!isRestaurantItem(item)) setSelectedDeviceId(item.id);
                }}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    if (!isRestaurantItem(item)) setSelectedDeviceId(item.id);
                  }
                }}
                style={{
                  cursor: isRestaurantItem(item) ? "default" : "pointer",
                }}
              />
            )}

            <div className={styles.topInfo}>
              <div className={styles.title}>{title}</div>

              {formatSelectedOptionsMeta(item).length > 0 && (
                <div className={styles.selectedMeta}>
                  {formatSelectedOptionsMeta(item).map((line, i) => (
                    <div key={i} className={styles.selectedMetaLine}>
                      • {line}
                    </div>
                  ))}
                </div>
              )}

              {optionsArr.map((opt, optIndex) => (
                <OptionPicker
                  key={`${item.uniqueKey}-opt-${optIndex}`}
                  item={item}
                  option={opt}
                  index={optIndex}
                />
              ))}
            </div>
          </div>

          <div className={styles.bottomRow}>
            <div className={styles.counter}>
              <button
                onClick={() => handleDecrement(item.uniqueKey)}
                aria-busy={action === "dec"}
              >
                {action === "dec" ? (
                  <span className={styles.miniSpinner} />
                ) : (
                  "-"
                )}
              </button>
              <span className={styles.count}>
                {basket.getItemCount(item.uniqueKey)}
              </span>
              <button
                onClick={() => handleIncrement(item.uniqueKey)}
                aria-busy={action === "dec"}
                disabled={
                  !item.isPreorder &&
                  availableQuantities[item.uniqueKey] != null &&
                  basket.getItemCount(item.uniqueKey) >=
                    availableQuantities[item.uniqueKey]
                }
              >
                {action === "inc" ? (
                  <span className={styles.miniSpinner} />
                ) : (
                  "+"
                )}
              </button>
            </div>

            <div className={styles.price}>
              €
              {(
                (item.price +
                  Object.values(item.selectedOptions || {}).reduce(
                    (sum, opt) => sum + (opt?.price || 0),
                    0,
                  )) *
                item.count
              ).toFixed(2)}
            </div>

            <button
              className={styles.buttonDelete}
              onClick={async () => {
                const ok = await confirm({
                  title: t("delete", { ns: "basket" }),
                  message: t("are you sure you want to delete this item", {
                    ns: "basket",
                  }),
                  confirmText: t("delete", { ns: "basket" }),
                  cancelText: t("cancel", { ns: "paymentForm" }),
                  confirmVariant: "danger",
                });
                if (ok) handleRemove(item.uniqueKey);
              }}
            >
              {t("delete", { ns: "basket" })}
            </button>
          </div>
        </div>
      </Card>
    );
  };

  return (
    <Container className={styles.container}>
      {basket.items.length === 0 ? (
        <h2 className={styles.basketEmpty}>
          {t("cart is empty", { ns: "basket" })}
        </h2>
      ) : (
        <>
          {stockItems.length > 0 && (
            <>
              <div className={styles.sectionBlock}>
                <h4 className={styles.sectionTitleCenter}>
                  {t("cart", { ns: "basket" })}
                </h4>

                <div className={styles.sectionSelectRow}>
                  <Form.Check
                    type="checkbox"
                    className={styles.sectionSelectAll}
                    checked={basket.allSelectedStockItems}
                    onChange={() => basket.toggleSelectAllStock()}
                    disabled={stockItems.length === 0}
                    label={t("select all", { ns: "basket" })}
                  />
                </div>
              </div>

              {stockItems.map((item, index) =>
                renderItem(item, index, index === 0),
              )}
            </>
          )}

          {preorderItems.length > 0 && (
            <>
              <div className={styles.sectionBlock}>
                <h4 className={styles.sectionTitleCenter}>
                  {t("out of stock items", { ns: "basket" })}
                </h4>

                <p className={styles.sectionSubCenter}>
                  {t("out-of-stock items must be paid for separately", {
                    ns: "basket",
                  })}
                </p>

                <div className={styles.sectionSelectRow}>
                  <Form.Check
                    type="checkbox"
                    className={styles.sectionSelectAll}
                    checked={basket.allSelectedOOSItems}
                    onChange={() => basket.toggleSelectAllOOS()}
                    disabled={preorderItems.length === 0}
                    label={t("select all", { ns: "basket" })}
                  />
                </div>
              </div>

              {preorderItems.map((item, index) =>
                renderItem(item, index, stockItems.length === 0 && index === 0),
              )}
            </>
          )}
        </>
      )}

      {basket.items.length > 0 && (
        <>
          <h3 className={styles.totalDeliverPrice}>
            {t("delivery", { ns: "basket" })}: {deliveryCost.toFixed(2)}€
          </h3>
          <h3 className={styles.totalPrice}>
            {t("total", { ns: "basket" })}:{" "}
            {(selectedTotal + deliveryCost).toFixed(2)} €
          </h3>
        </>
      )}

      {basket.hasSelectedDifferentSellers && (
        <div className={styles.sectionSubCenter}>
          {t(
            "you cannot select items from different sellers. please place separate orders",
            { ns: "basket" },
          )}
        </div>
      )}

      {selectedItems.length > 0 &&
        !selectedHasMixedItems &&
        !basket.hasSelectedDifferentSellers &&
        (user?.isAuth ? (
          <Elements stripe={stripePromise}>
            <PaymentForm
              totalPrice={selectedTotal}
              onPaymentSuccess={handlePaymentSuccess}
              onDeliveryCostChange={setDeliveryCost}
              preorder={{
                isPreorder,
                setIsPreorder,
                hasOnlyPreorders: selectedHasOnlyPreorders,
                hasOnlyStockItems: selectedHasOnlyStockItems,
                hasMixedItems: selectedHasMixedItems,
                disablePreorderCheckbox,
                deliveryDate,
                setDeliveryDate,
                preferredTime,
                setPreferredTime,
                isStoreClosed: storeClosed,
              }}
            />
          </Elements>
        ) : (
          <Card className={styles.authGateCard}>
            <Card.Body className={styles.authGateBody}>
              <div className={styles.authGateTitle}>
                {t("you need to sign in to place an order", {
                  ns: "basket",
                })}
              </div>
              <div className={styles.authGateText}>
                {t(
                  "sign in or register to proceed to payment and place your order",
                  {
                    ns: "basket",
                  },
                )}
              </div>

              <div className={styles.authGateBtns}>
                <button
                  type="button"
                  className={styles.authGateBtnPrimary}
                  onClick={() =>
                    navigate("/login", { state: { from: "/basket" } })
                  }
                >
                  {t("login", { ns: "auth" })}
                </button>

                <button
                  type="button"
                  className={styles.authGateBtnSecondary}
                  onClick={() =>
                    navigate("/registration", { state: { from: "/basket" } })
                  }
                >
                  {t("register", { ns: "auth" })}
                </button>
              </div>
            </Card.Body>
          </Card>
        ))}

      {selectedDeviceId && (
        <SlideModal onClose={() => setSelectedDeviceId(null)}>
          <DevicePage id={selectedDeviceId} />
        </SlideModal>
      )}
    </Container>
  );
});

export default Basket;
