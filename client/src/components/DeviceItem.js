import React, { useContext, useState, useEffect, useRef } from "react";
import { Card } from "react-bootstrap";
import Image from "react-bootstrap/Image";
import { useNavigate } from "react-router-dom";
import { Context } from "../index";
import { fetchOneDeviceCached } from "../http/deviceAPI";
import { toast } from "react-toastify";
import { useTranslation } from "react-i18next";
import { isShopOpenNow } from "../utils/workHours";
import styles from "./DeviceItem.module.css";

const DeviceItem = ({ device, onClick }) => {
  const { basket } = useContext(Context);
  const navigate = useNavigate();
  const [availableQuantity, setAvailableQuantity] = useState(device.quantity);
  const [isPreorder, setIsPreorder] = useState(false);
  const { t, i18n } = useTranslation();
  const cardRef = useRef(null);
  const prefetchedRef = useRef(false);
  const currentLang = i18n.language || "en";
  const deviceName = device.translations?.name?.[currentLang] || device.name;

  const parseMaybeJSON = (v) => {
    if (typeof v === "string") {
      try {
        return JSON.parse(v);
      } catch {
        return v;
      }
    }
    return v;
  };
  const optionsArr = parseMaybeJSON(device.options) || [];
  const variantsArr = parseMaybeJSON(device.variants) || [];

  const hasOptions = Array.isArray(optionsArr) && optionsArr.length > 0;
  const hasVariants = Array.isArray(variantsArr) && variantsArr.length > 0;

  const goToDevicePage = () =>
    typeof onClick === "function"
      ? onClick(device.id)
      : navigate(`/device/${device.id}`);

  const prefetchDetails = () => {
    if (prefetchedRef.current) return;
    prefetchedRef.current = true;
    fetchOneDeviceCached(device.id).catch(() => {});
  };

  useEffect(() => {
    if (!("IntersectionObserver" in window)) return;
    const el = cardRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            prefetchDetails();
            io.disconnect();
            break;
          }
        }
      },
      { rootMargin: "200px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const toNum = (v) => {
    const n = parseFloat(String(v ?? "").replace(",", "."));
    return Number.isFinite(n) ? n : 0;
  };

  const oldPrice = toNum(device.oldPrice);
  const newPrice = toNum(device.price);
  const hasDiscount = oldPrice > 0 && newPrice > 0 && oldPrice > newPrice;
  const discountPercentage = hasDiscount
    ? Math.max(1, Math.round(((oldPrice - newPrice) / oldPrice) * 100))
    : null;

  useEffect(() => {
    const itemsInBasket = basket.items.filter((item) => item.id === device.id);
    const totalInBasket = itemsInBasket.reduce(
      (sum, item) => sum + (item.count || 0),
      0
    );
    setAvailableQuantity(Math.max(0, device.quantity - totalInBasket));
  }, [basket.items, device.quantity]);

  const checkStock = async (deviceId, quantity) => {
    try {
      const res = await fetch(
        `${process.env.REACT_APP_API_URL}api/device/check-stock`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ deviceId, quantity }),
        }
      );
      const data = await res.json();
      return res.ok && data.quantity >= quantity;
    } catch {
      return false;
    }
  };

  const handleAddToBasket = async (e) => {
    e.stopPropagation();

    if (hasOptions || hasVariants) {
      goToDevicePage();
      return;
    }

    if (!isShopOpenNow() && !isPreorder) {
      toast.error(
        t("the shop is closed. Click again to add to the cart", {
          ns: "deviceItem",
        })
      );
      setIsPreorder(true);
      return;
    }

    const itemsInBasket = basket.items.filter((item) => item.id === device.id);
    const totalInBasket = itemsInBasket.reduce(
      (s, it) => s + (it.count || 0),
      0
    );
    const newCount = totalInBasket + 1;

    const isAvailable = await checkStock(device.id, newCount);
    const isThisPreorder = !isAvailable;

    if (basket.items.some((it) => it.isPreorder) && !isThisPreorder) {
      toast.error(
        `❌ ${t("you cannot add a regular item to the cart with a pre-order", {
          ns: "deviceItem",
        })}`
      );
      return;
    }
    if (basket.items.some((it) => !it.isPreorder) && isThisPreorder) {
      toast.error(
        `❌ ${t("you cannot add a pre-order to the cart with regular items", {
          ns: "deviceItem",
        })}`
      );
      return;
    }
    if (!isAvailable) {
      toast.error(
        `❗ ${t(
          "product is out of stock, but has been added to the cart as a pre-order",
          { ns: "deviceItem" }
        )}`
      );
    }

    basket.addItem({
      ...device,
      selectedOptions: {},
      isPreorder: isThisPreorder || !isShopOpenNow(),
      stockQuantity: Math.max(0, device.quantity - totalInBasket),
    });

    toast.success(
      <>
        <strong className={styles.toastTitle}>{deviceName}</strong>
        <span className={styles.toastSubtitle}>
          {t("Added to cart!", { ns: "devicePage" })}
        </span>
      </>,
      { style: { maxWidth: "400px" } }
    );

    setAvailableQuantity((prev) => Math.max(0, prev - 1));
  };

  return (
    <div
      ref={cardRef}
      onClick={goToDevicePage}
      onMouseEnter={prefetchDetails}
      onFocus={prefetchDetails}
      onTouchStart={prefetchDetails}
    >
      <Card className={styles.card}>
        {discountPercentage !== null && (
          <div className={styles.discountBadge}>-{discountPercentage}%</div>
        )}

        <div className={styles.imageWrapper}>
          <Image
            className={styles.image}
            src={device.img}
            alt={deviceName}
            loading="lazy"
            decoding="async"
          />
          <div className={styles.addButton} onClick={handleAddToBasket}>
            +
          </div>
        </div>

        <div className={styles.info}>
          <div className={styles.priceBlock}>
            {hasDiscount ? (
              <>
                <span className={styles.oldPrice}>{device.oldPrice} €</span>
                <span className={styles.newPrice}>{device.price} €</span>
              </>
            ) : (
              <span className={styles.regularPrice}>{device.price} €</span>
            )}
          </div>
          <p className={styles.name}>{deviceName}</p>
        </div>

        {availableQuantity <= 0 && (
          <p className={styles.preorderText}>
            {t("pre-order only", { ns: "deviceItem" })}
          </p>
        )}
      </Card>
    </div>
  );
};

export default DeviceItem;
