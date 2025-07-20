import React, { useContext, useState, useEffect } from "react";
import { Context } from "../index";
import { observer } from "mobx-react-lite";
import { Container, Button, Image, Card, Form } from "react-bootstrap";
import { toast } from "react-toastify";
import PaymentForm from "../components/PaymentForm";
import { loadStripe } from "@stripe/stripe-js";
import { Elements } from "@stripe/react-stripe-js";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import styles from "./Basket.module.css";

const stripePromise = loadStripe(process.env.REACT_APP_STRIPE_PUBLIC_KEY);

const Basket = observer(() => {
  const { basket } = useContext(Context);
  const navigate = useNavigate();
  const [deliveryCost, setDeliveryCost] = useState(0);
  const [availableQuantities, setAvailableQuantities] = useState({});
  const [deliveryDate, setDeliveryDate] = useState("");
  const [isPreorder, setIsPreorder] = useState(false);
  const [preferredTime, setPreferredTime] = useState("");
   const { t, i18n } = useTranslation();

   const hasOnlyPreorders =
    basket.items.length > 0 && basket.items.every((item) => item.isPreorder);
  const hasOnlyStockItems =
    basket.items.length > 0 && basket.items.every((item) => !item.isPreorder);
  const hasMixedItems =
    basket.items.some((item) => item.isPreorder) &&
    basket.items.some((item) => !item.isPreorder);

  const checkStock = async (deviceId, quantity, selectedOptions) => {
    try {
      const response = await fetch(
        `${process.env.REACT_APP_API_URL}/device/check-stock`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ deviceId, quantity, selectedOptions }),
        }
      );

        const data = await response.json();

       if (data.status === "error") {
        const translatedMessage = t(data.message, {
          ns: "cart",
          defaultValue: data.message,
        });
        toast.error(`❌ ${translatedMessage}`);
        return false;
      }

      return data.quantity >= quantity;
    } catch (error) {
      console.error("Ошибка при проверке наличия товара:", error);
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
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({ deviceId: item.id }),
            }
          );

          const data = await response.json();

          if (response.ok) {
            newQuantities[item.uniqueKey] = data.quantity;
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

    const isAvailable = await checkStock(
      item.id,
      newCount,
      item.selectedOptions
    );

    if (!isAvailable) {
      toast.error(t("not enough stock", { ns: "basket" }));
      return;
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

  const handlePaymentSuccess = async (paymentMethod, formData) => {
    const hasUnselectedOptions = basket.items.some(
      (item) =>
        item.selectedOptions &&
        Object.values(item.selectedOptions).some(
          (opt) =>
            opt.value === "__UNSELECTED__" ||
            opt.value === t("select an option", { ns: "basket" })
        )
    );

    if (isPreorder) {
      if (!deliveryDate || !preferredTime.trim()) {
        toast.error(t("please fill in all delivery fields", { ns: "basket" }));
        setLoading(false);
        return;
      }
    }

    if (hasUnselectedOptions) {
      toast.error(t("select an option before payment", { ns: "basket" }));
      return;
    }

   const dataToSend = {
      formData,
      paymentMethodId: paymentMethod.id,
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
      const response = await fetch(`${process.env.REACT_APP_API_URL}/order/create`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token") || ""}`,
        },
        body: JSON.stringify(dataToSend),
      });

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

    const updatedOption = item.options
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

     const isAvailable = await checkStock(item.id, item.count, newOptions);
  const isThisPreorder = !isAvailable;

    item.isPreorder = isThisPreorder;

     const otherItems = basket.items.filter((i) => {
    if (i.uniqueKey === itemUniqueKey) return false;
    return (
      i.selectedOptions &&
      Object.values(i.selectedOptions).every(
        (opt) => opt.value && opt.value !== "__UNSELECTED__"
      )
    );
  });

  const hasPreorders = otherItems.some((i) => i.isPreorder);
  const hasStocks = otherItems.some((i) => !i.isPreorder);

    if (hasPreorders && !isThisPreorder) {
       toast.error(`❌ ${t("you cannot add a regular item to the cart with a pre-order", { ns: "deviceItem" })}`);
      return;
    }





      if (hasStocks && isThisPreorder) {
      toast.error(`❌ ${t("you cannot add a pre-order to the cart with regular items", { ns: "deviceItem" })}`);
      return;
    }





    basket.updateSelectedOption(itemUniqueKey, optionName, updatedOption);

    if (!isAvailable) {
      toast.error(
        `${t(
          "product is out of stock, but has been added to the cart as a pre-order",
          {
            ns: "basket",
          }
        )}`
      );
    }
  };

 return (
    <Container className={styles.container}>
      {basket.items.length === 0 ? (
        <h2 className={styles.basketEmpty}>
          {t("cart is empty", { ns: "basket" })}
        </h2>
      ) : (
        basket.items.map((item, index) => (
          <Card
            key={item.uniqueKey}
            className={`${styles.card} ${
              index === 0 ? styles.firstCard : styles.otherCards
            }`}
          >
            <div className={styles.cardContent}>
              <div className={styles.topRow}>
                <Image className={styles.image} src={item.img} />
                <div className={styles.topInfo}>
                  <div className={styles.title}>
                    {item.translations?.name?.[i18n.language] || item.name}
                  </div>

                  {item.selectedOptions &&
                    Object.entries(item.selectedOptions).map(
                      ([key, option]) => (
                        <div
                          key={`${item.uniqueKey}-${key}`}
                          className={styles.optionRow}
                        >
                          <label className={styles.optionLabel}>
                            {(item.translations?.options &&
                              Object.values(item.translations.options).find(
                                (opt) => opt.name?.[i18n.language]
                              )?.name?.[i18n.language]) ||
                              key}
                            :
                          </label>
                          <select
                            value={option.value}
                            onChange={(e) =>
                              handleOptionChange(
                                item.uniqueKey,
                                key,
                                e.target.value
                              )
                            }
                            className={`${styles.select} ${
                              option.value === "__UNSELECTED__" ||
                              option.value ===
                                t("select an option", { ns: "basket" })
                                ? styles.unselectedOption
                                : ""
                            }`}
                          >
                            <option value="__UNSELECTED__" disabled hidden>
                              {t("select an option", { ns: "basket" })}
                            </option>
                            {item.options
                              .find((opt) => opt.name === key)
                              ?.values.map((valueObj) => {
                                const translated =
                                  item.translations?.options?.[
                                    Object.keys(item.translations?.options)[0]
                                  ]?.values?.find(
                                    (v) => v.ru === valueObj.value
                                  )?.[i18n.language] || valueObj.value;

                                const label =
                                  valueObj.quantity === 0
                                    ? `${translated} (${t(
                                        "Not in stock (Pre-order)",
                                        { ns: "basket" }
                                      )})`
                                    : translated;

                                return (
                                  <option
                                    key={`${key}-${valueObj.value}`}
                                    value={valueObj.value}
                                  >
                                    {label}
                                  </option>
                                );
                              })}
                          </select>
                        </div>
                      )
                    )}
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
                      basket.getItemCount(item.uniqueKey) >=
                      (availableQuantities[item.uniqueKey] || 0)
                    }
                  >
                    +
                  </button>
                </div>

                <div className={styles.price}>
                  €
                  {(item.price +
                    Object.values(item.selectedOptions || {}).reduce(
                      (sum, opt) => sum + (opt?.price || 0),
                      0
                    )) *
                    item.count}
                </div>

                <button
                  className={styles.buttonDelete}
                  variant="danger"
                   onClick={() => {
                    const confirmed = window.confirm(
                      t("are you sure you want to delete this item", { ns: "basket" })
                    );
                    if (confirmed) {
                      handleRemove(item.uniqueKey);
                    }
                  }}
                >
                  {t("delete", { ns: "basket" })}
                </button>
              </div>
            </div>
          </Card>
        ))
      )}

      {hasMixedItems && (
        <div className={styles.warningBox}>
          <p style={{ color: "red", fontWeight: "bold" }}>
            ❗{" "}
            {t("you cannot mix pre-orders and in-stock items in one order", {
              ns: "basket",
            })}
          </p>
        </div>
      )}

      {basket.items.length > 0 && (
        <>
          {(hasOnlyStockItems || hasOnlyPreorders) && !hasMixedItems && (
            <Form.Group className={styles.preorderSection}>
              <Form.Check
                type="checkbox"
                label={t("place order as a pre-order", { ns: "basket" })}
                checked={isPreorder}
                onChange={() => setIsPreorder(!isPreorder)}
                className={styles.preorderCheckbox}
                disabled={
                  hasOnlyPreorders ||
                  basket.items.some(
                    (item) => item.stockQuantity === 0 || item.isStoreClosed
                  )
                }
              />

              {isPreorder && (
                <>
                  <Form.Label>
                    {t("desired delivery datetime", { ns: "basket" })}
                  </Form.Label>
                  <Form.Control
                    type="datetime-local"
                    value={deliveryDate || ""}
                    onChange={(e) => setDeliveryDate(e.target.value)}
                    className={styles.dateInput}
                    required
                  />
                  <Form.Label>
                    {t("preferred delivery time comment", { ns: "basket" })}
                  </Form.Label>
                  <Form.Control
                    as="textarea"
                    rows={2}
                    value={preferredTime}
                    onChange={(e) => setPreferredTime(e.target.value)}
                    className={styles.commentInput}
                    required
                  />
                </>
              )}
            </Form.Group>
          )}

          <h3 className={styles.totalDeliverPrice}>
            {t("delivery", { ns: "basket" })}: {deliveryCost.toFixed(2)}€
          </h3>
          <h3 className={styles.totalPrice}>
            {t("total", { ns: "basket" })}:{" "}
            {(basket.getTotalPrice() + deliveryCost).toFixed(2)} €
          </h3>
        </>
      )}
      {!hasMixedItems && (
        <Elements stripe={stripePromise}>
          <PaymentForm
            totalPrice={basket.getTotalPrice()}
            onPaymentSuccess={handlePaymentSuccess}
            onDeliveryCostChange={setDeliveryCost}
          />
        </Elements>
      )}
    </Container>
  );
});

export default Basket;
