import React, { useContext, useState, useEffect, useRef } from "react";
import { Card } from "react-bootstrap";
import Image from "react-bootstrap/Image";
import { useNavigate } from "react-router-dom";
import { Context } from "../index";
import { fetchOneDevice } from "../http/deviceAPI";
import { toast } from "react-toastify";
import { useTranslation } from "react-i18next";
import styles from "./DeviceItem.module.css";

const DeviceItem = ({ device, onClick }) => {
  const { basket } = useContext(Context);
  const navigate = useNavigate();
  const [availableQuantity, setAvailableQuantity] = useState(device.quantity);
  const [isPreorder, setIsPreorder] = useState(false);
  const [isStoreClosed, setIsStoreClosed] = useState(false);
  const { t, i18n } = useTranslation();
  const cardRef = useRef(null);
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

  useEffect(() => {
    let cancelled = false;

    fetch(`${process.env.REACT_APP_API_URL}/shop/status`)
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled) {
          setIsStoreClosed(
            typeof data.isStoreClosed === "boolean"
              ? data.isStoreClosed
              : !data.isOpen
          );
        }
      })
      .catch((err) => {
        console.error("Error fetching store status:", err);
      });

    return () => {
      cancelled = true;
    };
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
        `${process.env.REACT_APP_API_URL}/device/check-stock`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ deviceId, quantity }),
        }
      );
      const data = await res.json();
      return res.ok && Number(data.quantity) >= quantity;
    } catch {
      return false;
    }
  };

  const ensureSingleSeller = (rawNewSellerId) => {
    const normalizeSellerId = (sid) => {
      const n = Number(sid);
      return Number.isFinite(n) && n > 0 ? n : null;
    };

    const newSellerId = normalizeSellerId(rawNewSellerId);

    const sellerIds = basket.items.map((it) =>
      typeof basket.getItemSellerId === "function"
        ? basket.getItemSellerId(it)
        : normalizeSellerId(it.sellerId)
    );

    if (sellerIds.length === 0) return true;

    const unique = Array.from(new Set(sellerIds));

    if (unique.length === 1 && unique[0] === newSellerId) {
      return true;
    }

     const ok = window.confirm(
      t("cart has items from another seller. clear cart and add this item?", {
        ns: "deviceItem",
      })
    );

    if (!ok) {
      return false;
    }

    if (typeof basket.clearAll === "function") {
      basket.clearAll();
    } else {
      basket.items.slice().forEach((it) => {
        if (typeof basket.removeItem === "function" && it.uniqueKey) {
          basket.removeItem(it.uniqueKey);
        }
      });
    }

    return true;
  };

  const handleAddToBasket = async (e) => {
    e.stopPropagation();

    const newSellerId =
      Number(device.sellerId || device.seller?.id || 0) || null;

    if (typeof ensureSingleSeller === "function") {
      if (!ensureSingleSeller(newSellerId)) {
        return;
      }
    }

    let full = device;
    try {
      const fetched = await fetchOneDevice(device.id);
      if (fetched) full = fetched;
    } catch {}

    const fullOptions = parseMaybeJSON(full.options) || [];
    const fullVariants = parseMaybeJSON(full.variants) || [];

    const fullHasOptions = Array.isArray(fullOptions) && fullOptions.length > 0;
    const fullHasVariants =
      Array.isArray(fullVariants) && fullVariants.length > 0;

    if (fullHasOptions || fullHasVariants) {
      goToDevicePage();
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

    const itemForBasket = {
      ...full,
      selectedOptions: {},
      variantKey: null,

      sellerId: full.sellerId ?? device.sellerId ?? newSellerId,

      isPreorder: isThisPreorder || isStoreClosed,
      stockQuantity: Math.max(0, (full.quantity ?? 0) - totalInBasket),
      isStoreClosed,
      defaultSelected: !(isThisPreorder || isStoreClosed),
    };

    basket.addItem(itemForBasket);

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
    <div ref={cardRef} onClick={goToDevicePage}>
      <Card className={styles.card}>
        {discountPercentage !== null && (
          <div className={styles.discountBadge}>-{discountPercentage}%</div>
        )}

        <div className={styles.imageWrapper}>
          <Image
            className={styles.image}
            src={device.img}
            loading="lazy"
            decoding="async"
            alt={deviceName}
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
