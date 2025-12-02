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
import SlideModal from "../components/modals/SlideModal";
import DevicePage from "../pages/DevicePage";
import { useTranslation } from "react-i18next";
import styles from "./Basket.module.css";

const stripePromise = loadStripe(process.env.REACT_APP_STRIPE_PUBLIC_KEY);

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

const normalizeVariants = (item) => {
  const arr = parseMaybeJSON(item.variants) || [];
  return (arr || []).map((v) => {
    const sel = parseMaybeJSON(v.selected) || {};
    return { ...v, selected: sel, key: v.key || makeVariantKey(sel) };
  });
};

const Basket = observer(() => {
  const { basket } = useContext(Context);
  const navigate = useNavigate();
  const confirm = useConfirm();
  const [deliveryCost, setDeliveryCost] = useState(0);
  const [availableQuantities, setAvailableQuantities] = useState({});
  const [deliveryDate, setDeliveryDate] = useState("");
  const [isPreorder, setIsPreorder] = useState(false);
  const [preferredTime, setPreferredTime] = useState("");
  const [selectedDeviceId, setSelectedDeviceId] = useState(null);
  const { t, i18n } = useTranslation();

  const hasOnlyPreorders =
    basket.items.length > 0 && basket.items.every((item) => item.isPreorder);
  const hasOnlyStockItems =
    basket.items.length > 0 && basket.items.every((item) => !item.isPreorder);
  const hasMixedItems =
    basket.items.some((item) => item.isPreorder) &&
    basket.items.some((item) => !item.isPreorder);

  const disablePreorderCheckbox =
    hasOnlyPreorders ||
    basket.items.some((item) => item.stockQuantity === 0 || item.isStoreClosed);

  const checkStock = async (deviceId, quantity, selectedOptions) => {
    try {
      const response = await fetch(
        `${process.env.REACT_APP_API_URL}/device/check-stock`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ deviceId, quantity, selectedOptions }),
        }
      );

      const data = await response.json();

      if (data.status === "error") return false;

      if (typeof data.isEnough === "boolean") {
        return data.isEnough;
      }
      return Number(data.quantity || 0) >= Number(quantity || 0);
    } catch (e) {
      console.error("Ошибка при проверке наличия товара:", e);
      return false;
    }
  };

  useEffect(() => {
    const fetchQuantities = async () => {
      const newQuantities = {};

      for (const item of basket.items) {
        try {
          const response = await fetch(
            `${process.env.REACT_APP_API_URL}/device/check-stock`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                deviceId: item.id,
                selectedOptions: Object.fromEntries(
                  Object.entries(item.selectedOptions || {}).map(([k, v]) => [
                    k,
                    getVal(v),
                  ])
                ),
              }),
            }
          );

          const data = await response.json();

          if (response.ok) {
             newQuantities[item.uniqueKey] = Number(data.quantity);
          } else {
            newQuantities[item.uniqueKey] = 0;
          }
        } catch (error) {
          console.error("Ошибка при проверке наличия товара:", error);
          newQuantities[item.uniqueKey] = 0;
        }
      }

      setAvailableQuantities(newQuantities);
    };

    fetchQuantities();
  }, [basket.items]);

  useEffect(() => {
    const storeClosed = basket.items.some((item) => item.isStoreClosed);
    const allPreorders = hasOnlyPreorders;
    const anyOutOfStock = basket.items.some((item) => item.stockQuantity === 0);

    if (
      (allPreorders || storeClosed || anyOutOfStock) &&
      !hasMixedItems &&
      !isPreorder
    ) {
      setIsPreorder(true);
    }
  }, [basket.items, hasOnlyPreorders, hasMixedItems, isPreorder]);

  const handleIncrement = async (uniqueKey) => {
    const item = basket.items.find((i) => i.uniqueKey === uniqueKey);
    if (!item) return;

    const newCount = item.count + 1;

  const normalizedOptions = Object.fromEntries(
      Object.entries(item.selectedOptions || {}).map(([k, v]) => [k, getVal(v)])
    );
    const isAvailable = await checkStock(item.id, newCount, normalizedOptions);

    if (!isAvailable) {
      const hasStocks = basket.items.some(
        (i) => !i.isPreorder && i.uniqueKey !== uniqueKey
      );
      if (hasStocks) {
        toast.error(
          `❌ ${t("you cannot add a pre-order to the cart with regular items", {
            ns: "deviceItem",
          })}`
        );
        return;
      }
      item.isPreorder = true;
      setIsPreorder(true);
    }

    basket.updateItemCount(uniqueKey, newCount);
  };

  const handleDecrement = (uniqueKey) => {
    const currentCount = basket.getItemCount(uniqueKey);
    if (currentCount > 1) {
      basket.updateItemCount(uniqueKey, currentCount - 1);
    }
  };

  const handleRemove = (uniqueKey) => {
    basket.removeItem(uniqueKey);
  };

 const handlePaymentSuccess = async (payment, formData) => {
   const paymentIntentId =
     payment?.paymentIntentId || payment?.id || payment?.paymentIntent?.id;
   if (!paymentIntentId) {
     toast.error("Не удалось получить paymentIntentId");
     return;
   }

    const hasUnselectedOptions = basket.items.some(
      (item) =>
        item.selectedOptions &&
        Object.values(item.selectedOptions).some(
          (opt) =>
            opt.value === "__UNSELECTED__" ||
            opt.value === t("select an option", { ns: "basket" })
        )
    );

     const needDeliveryTime = isPreorder && hasOnlyStockItems && !hasMixedItems;

    if (needDeliveryTime) {
      if (!deliveryDate) {
        toast.error(t("please fill in all delivery fields", { ns: "basket" }));
        return;
      }
      if (!preferredTime || !preferredTime.trim()) {
        toast.error(t("please fill in all delivery fields", { ns: "basket" }));
        return;
      }
    }

    if (hasUnselectedOptions) {
      toast.error(t("select an option before payment", { ns: "basket" }));
      return;
    }

    const dataToSend = {
      formData,
      paymentIntentId,
      totalPrice: basket.getTotalPrice(),
      language: i18n.language,
      orderDetails: basket.items.map((item, index) => ({
        translations: item.translations,
        name: item.name,
        price: item.price,
        count: item.count,
        deviceId: item.id,
        image: item.img,
        selectedOptions: item.selectedOptions || {},
        isPreorder: item.isPreorder || isPreorder,
        preferredTime:
          index === 0 && (item.isPreorder || isPreorder) ? preferredTime : null,
        deliveryDate:
          index === 0 && (item.isPreorder || isPreorder) ? deliveryDate : null,
      })),
    };

    try {
      const response = await fetch(
        `${process.env.REACT_APP_API_URL}/order/create`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${localStorage.getItem("token") || ""}`,
          },
          body: JSON.stringify(dataToSend),
        }
      );

      const data = await response.json();

      if (response.ok) {
        toast.success(t("order placed successfully", { ns: "basket" }));
        window.dispatchEvent(new Event("orderUpdated"));
        basket.clearItems();
        navigate("/");
      } else {
        toast.error(
          data.message || t("order placement error", { ns: "basket" })
        );
      }
    } catch (error) {
      console.error(t("error creating order", { ns: "basket" }), error);
      toast.error(t("error creating order", { ns: "basket" }));
    }
  };

  const handleOptionChange = async (
    itemUniqueKey,
    optionName,
    selectedValue
  ) => {
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
      Object.entries(newOptions || {}).map(([k, v]) => [k, getVal(v)])
    );
    const isAvailable = await checkStock(
      item.id,
      item.count,
      normalizedOptions
    );
    const isThisPreorder = !isAvailable;
    item.isPreorder = isThisPreorder;

    const otherItems = basket.items.filter(
      (i) => i.uniqueKey !== itemUniqueKey
    );
    const hasPreorders = otherItems.some((i) => i.isPreorder);
    const hasStocks = otherItems.some((i) => !i.isPreorder);

    if (hasPreorders && !isThisPreorder) {
      toast.error(
        `❌ ${t("you cannot add a regular item to the cart with a pre-order", {
          ns: "deviceItem",
        })}`
      );
      return;
    }
    if (hasStocks && isThisPreorder) {
      toast.error(
        `❌ ${t("you cannot add a pre-order to the cart with regular items", {
          ns: "deviceItem",
        })}`
      );
      return;
    }

    basket.updateSelectedOption(itemUniqueKey, optionName, updatedOption);

    if (isThisPreorder) {
      setIsPreorder(true);
    }
  };

  const OptionPicker = ({ item, option, index }) => {
    const lang = i18n.language || "en";
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
        ])
      );
      partial[optName] = getVal(valueObj);

      return variantsActive.some((v) =>
        Object.entries(partial).every(
          ([k, val]) => (v.selected || {})[k] === val
        )
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
        ])
      );
      partial[optName] = getVal(valueObj);

      const exists = existsCombination(optName, valueObj);
      if (!exists) return false;

      const anyInStock = variantsActive.some(
        (v) =>
          Object.entries(partial).every(
            ([k, val]) => (v.selected || {})[k] === val
          ) && (Number(v.quantity) || 0) > 0
      );
      return !anyInStock;
    };

    const baseImages = [item.img, ...(item.thumbnails || [])].filter(Boolean);
    let firstOptionPreviewMap = {};
    if (isFirst) {
      for (const v of variants) {
        const val = v?.selected?.[option.name];
        if (!val || firstOptionPreviewMap[val]) continue;
        if (v.image && baseImages.includes(v.image)) {
          firstOptionPreviewMap[val] = v.image;
        }
      }
    }

    const labelOfOption = option.translations?.name?.[lang] || option.name;
    const valueLabel = (idx, valObj) =>
      option.translations?.values?.[idx]?.[lang] || valObj.value;

    const pick = (valObj) =>
      handleOptionChange(item.uniqueKey, option.name, valObj.value);

    if (isFirst && Object.keys(firstOptionPreviewMap).length > 0) {
      return (
        <div
          className={styles.OptionGroup}
          role="radiogroup"
          aria-label={labelOfOption}
        >
          <div className={styles.OptionLabel}>{labelOfOption}</div>
          <div className={styles.OptionThumbGrid}>
            {option.values.map((valObj, idx) => {
              const val = valObj.value;
              const isSelected = selected?.value === val;
              const exists = existsCombination(option.name, valObj);
              const oos = isOutOfStock(option.name, valObj);
              const imgUrl = firstOptionPreviewMap[val] || null;

              return (
                <button
                  key={idx}
                  type="button"
                  className={[
                    styles.OptionThumb,
                    isSelected ? styles.OptionThumbSelected : "",
                    !exists
                      ? styles.OptionThumbDisabled
                      : oos
                      ? styles.OptionThumbOut
                      : "",
                  ].join(" ")}
                  onClick={() => {
                    if (!exists) return;
                    pick(valObj);
                  }}
                  disabled={!exists}
                  aria-pressed={isSelected}
                  title={valueLabel(idx, valObj)}
                >
                  {imgUrl ? (
                    <img
                      alt=""
                      src={imgUrl}
                      className={styles.OptionThumbImg}
                    />
                  ) : (
                    <div className={styles.OptionThumbImgFallback}>
                      {valueLabel(idx, valObj)}
                    </div>
                  )}
                  <span className={styles.OptionThumbLabel}>
                    {valueLabel(idx, valObj)}
                  </span>
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

  return (
    <Container className={styles.container}>
      {basket.items.length === 0 ? (
        <h2 className={styles.basketEmpty}>
          {t("cart is empty", { ns: "basket" })}
        </h2>
      ) : (
        basket.items.map((item, index) => {
          const variants = normalizeVariants(item);
          const baseImages = [item.img, ...(item.thumbnails || [])].filter(
            Boolean
          );
          const selectedKey = makeVariantKey(
            Object.fromEntries(
              Object.entries(item.selectedOptions || {}).map(([k, v]) => [
                k,
                getVal(v),
              ])
            )
          );
          const selectedVariant =
            variants.find(
              (v) => (v.key || makeVariantKey(v.selected || {})) === selectedKey
            ) || null;

          const displayImg =
            selectedVariant?.image && baseImages.includes(selectedVariant.image)
              ? selectedVariant.image
              : item.img;

          const optionsArr = parseMaybeJSON(item.options) || [];

          return (
            <Card
              key={item.uniqueKey}
              className={`${styles.card} ${
                index === 0 ? styles.firstCard : styles.otherCards
              }`}
            >
              <div className={styles.cardContent}>
                <div className={styles.topRow}>
                  <Image
                    className={styles.image}
                    src={displayImg}
                    alt={item.translations?.name?.[i18n.language] || item.name}
                    onClick={() => setSelectedDeviceId(item.id)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ")
                        setSelectedDeviceId(item.id);
                    }}
                    style={{ cursor: "pointer" }}
                  />

                  <div className={styles.topInfo}>
                    <div className={styles.title}>
                      {item.translations?.name?.[i18n.language] || item.name}
                    </div>

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
                    <button onClick={() => handleDecrement(item.uniqueKey)}>
                      -
                    </button>
                    <span className={styles.count}>
                      {basket.getItemCount(item.uniqueKey)}
                    </span>
                    <button
                      onClick={() => handleIncrement(item.uniqueKey)}
                      disabled={
                      !item.isPreorder &&
                        availableQuantities[item.uniqueKey] != null &&
                        basket.getItemCount(item.uniqueKey) >=
                          availableQuantities[item.uniqueKey]
                      }
                    >
                      +
                    </button>
                  </div>

                  <div className={styles.price}>
                    €
                    {(
                      (item.price +
                        Object.values(item.selectedOptions || {}).reduce(
                          (sum, opt) => sum + (opt?.price || 0),
                          0
                        )) *
                      item.count
                    ).toFixed(2)}
                  </div>

                  <button
                    className={styles.buttonDelete}
                 onClick={async () => {
                      const ok = await confirm({
                        title: t("delete", { ns: "basket" }),
                        message: t(
                          "are you sure you want to delete this item",
                          { ns: "basket" }
                        ),
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
        })
      )}

      {basket.items.length > 0 && (
        <>
          <h3 className={styles.totalDeliverPrice}>
            {t("delivery", { ns: "basket" })}: {deliveryCost.toFixed(2)}€
          </h3>
          <h3 className={styles.totalPrice}>
            {t("total", { ns: "basket" })}:{" "}
            {(basket.getTotalPrice() + deliveryCost).toFixed(2)} €
          </h3>
        </>
      )}

      {basket.items.length > 0 && !hasMixedItems && (
        <Elements stripe={stripePromise}>
          <PaymentForm
            totalPrice={basket.getTotalPrice()}
            onPaymentSuccess={handlePaymentSuccess}
            onDeliveryCostChange={setDeliveryCost}
            preorder={{
              isPreorder,
              setIsPreorder,
              hasOnlyPreorders,
              hasOnlyStockItems,
              hasMixedItems,
              disablePreorderCheckbox,
              deliveryDate,
              setDeliveryDate,
              preferredTime,
              setPreferredTime,
            }}
          />
        </Elements>
      )}

      {selectedDeviceId && (
        <SlideModal onClose={() => setSelectedDeviceId(null)}>
          <DevicePage id={selectedDeviceId} />
        </SlideModal>
      )}
    </Container>
  );
});

export default Basket;
