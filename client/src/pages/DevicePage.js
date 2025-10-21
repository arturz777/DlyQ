import React, { useEffect, useState, useContext, useMemo } from "react";
import {
  fetchOneDeviceCached,
  fetchRecommendedDevices,
} from "../http/deviceAPI";
import { Context } from "../index";
import { toast } from "react-toastify";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "framer-motion";
import { isShopOpenNow } from "../utils/workHours";
import appStore from "../store/appStore";
import styles from "./DevicePage.module.css";

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

const DevicePage = ({ id }) => {
  const { basket, device: deviceStore } = useContext(Context);
  const [device, setDevice] = useState({
    info: [],
    options: [],
    thumbnails: [],
  });
  const [recommendedDevices, setRecommendedDevices] = useState([]);
  const [selectedOptions, setSelectedOptions] = useState({});
  const [selectedVariant, setSelectedVariant] = useState(null);
  const [finalPrice, setFinalPrice] = useState(0);
  const [activeIndex, setActiveIndex] = useState(0);
  const [availableQuantity, setAvailableQuantity] = useState(0);
  const [isPreorder, setIsPreorder] = useState(false);
  const { t, i18n } = useTranslation();
  const currentLang = i18n.language || "en";
  const deviceName = device.translations?.name?.[currentLang] || device.name;
  const isStoreClosed = !isShopOpenNow();
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  const [[page, direction], setPage] = useState([0, 0]);
  const imageIndex = activeIndex;

  const checkStock = async (deviceId, quantity, selectedOptions) => {
    try {
      const cleanSelected = {};
      Object.entries(selectedOptions || {}).forEach(([k, v]) => {
        cleanSelected[k] = getVal(v);
      });
      const variantKey =
        device.variants?.length && Object.keys(cleanSelected).length
          ? makeVariantKey(cleanSelected)
          : null;

      const response = await fetch(
        `${process.env.REACT_APP_API_URL}/device/check-stock`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            deviceId,
            quantity,
            selectedOptions: cleanSelected,
            variantKey,
          }),
        }
      );

      const data = await response.json();
      if (data.status === "error") {
        toast.error(`❌ ${data.message}`);
        return false;
      }
      return data.quantity >= quantity;
    } catch (error) {
      console.error("Ошибка при проверке наличия товара:", error);
      return false;
    }
  };

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const fetchData = async () => {
      const instant = deviceStore?.devices?.find?.((d) => d.id === id);
      if (instant) {
        setDevice({
          info: instant.info || [],
          options: Array.isArray(instant.options)
            ? instant.options
            : parseMaybeJSON(instant.options) || [],
          thumbnails: Array.isArray(instant.thumbnails)
            ? instant.thumbnails
            : parseMaybeJSON(instant.thumbnails) || [],
          variants: Array.isArray(instant.variants)
            ? instant.variants
            : parseMaybeJSON(instant.variants) || [],
          ...instant,
        });
        setFinalPrice(Number(instant.price) || 0);
        setActiveIndex(0);
      } else {
        appStore.startLoading();
      }

      try {
        const deviceData = await fetchOneDeviceCached(id);

        const normalizedVariants = (deviceData.variants || []).map((v) => {
          const sel = parseMaybeJSON(v.selected) || {};
          return {
            ...v,
            selected: sel,
            key: v.key || makeVariantKey(sel),
          };
        });

        const normalized = { ...deviceData, variants: normalizedVariants };
        if (cancelled) return;
        setDevice(normalized);
        setFinalPrice(Number(normalized.price) || 0);
        setActiveIndex(0);

        const itemInBasket = basket.items.find(
          (item) => item.id === normalized.id
        );
        const quantityInBasket = itemInBasket ? itemInBasket.count : 0;
        setAvailableQuantity(
          (Number(normalized.quantity) || 0) - quantityInBasket
        );

        setSelectedOptions({});

        const recommended = await fetchRecommendedDevices(normalized.type);
        if (!cancelled) setRecommendedDevices(recommended);
      } catch (error) {
        toast.error("❌ Ошибка загрузки устройства");
        console.error(error);
      } finally {
        if (!cancelled) appStore.stopLoading();
      }
    };
    fetchData();
    return () => {
      cancelled = true;
    };
  }, [id, basket.items, deviceStore?.devices]);

  useEffect(() => {
    const list = [device.img, ...(device.thumbnails || [])].filter(Boolean);
    list.forEach((src) => {
      const im = new Image();
      im.src = src;
    });
  }, [device.img, device.thumbnails]);

  useEffect(() => {
    if (
      (device.variants?.length || 0) > 0 &&
      (device.options?.length || 0) > 0
    ) {
      const haveAll = device.options.every(
        (o) => selectedOptions[o.name]?.value
      );
      if (haveAll) {
        const sel = {};
        device.options.forEach(
          (o) => (sel[o.name] = getVal(selectedOptions[o.name]))
        );
        const key = makeVariantKey(sel);
        const v =
          device.variants.find(
            (x) => (x.key || makeVariantKey(x.selected || {})) === key
          ) || null;

        setSelectedVariant(v);

        const base = Number(device.price) || 0;
        const add = Object.values(selectedOptions).reduce(
          (s, o) => s + (Number(o?.price) || 0),
          0
        );
        const price = v && v.price != null ? Number(v.price) : base + add;
        setFinalPrice(price);
        return;
      }
    }

    const add = Object.values(selectedOptions).reduce(
      (s, o) => s + (Number(o?.price) || 0),
      0
    );
    setSelectedVariant(null);
    setFinalPrice((Number(device.price) || 0) + add);
  }, [selectedOptions, device.price, device.options, device.variants]);

  useEffect(() => {
    if (!device) return;

    if (
      (device.variants?.length || 0) > 0 &&
      (device.options?.length || 0) > 0
    ) {
      const haveAll = device.options.every(
        (o) => selectedOptions[o.name]?.value
      );
      if (haveAll && selectedVariant) {
        const cleanSelected = Object.fromEntries(
          Object.entries(selectedOptions).map(([k, v]) => [k, getVal(v)])
        );
        const key = makeVariantKey(cleanSelected);
        const existingItem = basket.items.find(
          (item) => item.id === device.id && item.variantKey === key
        );

        const inCart = existingItem ? existingItem.count : 0;
        const variantQty = Number(selectedVariant.quantity) || 0;
        setAvailableQuantity(variantQty - inCart);
        return;
      }
    }

    const existingItem = basket.items.find((item) => item.id === device.id);
    const inCart = existingItem ? existingItem.count : 0;
    setAvailableQuantity((Number(device.quantity) || 0) - inCart);
  }, [device, selectedOptions, selectedVariant, basket.items]);

  const baseImages = useMemo(
    () => [device.img, ...(device.thumbnails || [])].filter(Boolean),
    [device.img, device.thumbnails]
  );

  const images = useMemo(() => {
    const vUrl = selectedVariant?.image || null;
    if (!vUrl) return baseImages;
    const idx = baseImages.indexOf(vUrl);
    if (idx === -1) return [vUrl, ...baseImages];
    return baseImages;
  }, [baseImages, selectedVariant?.image]);

  const firstOptionName = device.options?.[0]?.name || null;

  const firstOptionPreviewMap = useMemo(() => {
    if (!firstOptionName) return {};
    const map = {};
    (device.variants || []).forEach((v) => {
      const val = v?.selected?.[firstOptionName];
      if (!val || map[val]) return;
      if (v.image && baseImages.includes(v.image)) {
        map[val] = v.image;
      }
    });
    return map;
  }, [firstOptionName, device.variants, baseImages]);

  useEffect(() => {
    if (!selectedVariant?.image) return;
    const idx = images.indexOf(selectedVariant.image);
    setActiveIndex(idx !== -1 ? idx : 0);
  }, [selectedVariant?.image, images]);

  const hyphenLang = (() => {
    const l = (i18n.language || "ru").toLowerCase();
    if (l.startsWith("ru")) return "ru";
    if (l.startsWith("en")) return "en";
    if (l.startsWith("et") || l === "est") return "et";
    return "en";
  })();

  const handleNext = () => {
    setPage(([p]) => [p + 1, +1]);
    setActiveIndex((prev) => (prev + 1) % images.length);
  };

  const handlePrev = () => {
    setPage(([p]) => [p - 1, -1]);
    setActiveIndex((prev) => (prev - 1 + images.length) % images.length);
  };

  const paginate = (newDirection) => {
    setPage(([p]) => [p + newDirection, newDirection]);
    if (newDirection > 0) handleNext();
    else handlePrev();
  };

  const variants = {
    enter: (dir) => ({ x: dir > 0 ? 300 : -300, opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: (dir) => ({ x: dir > 0 ? -300 : 300, opacity: 0 }),
  };

  const handleThumbClick = (idx) => {
    if (idx === activeIndex) return;
    const dir = idx > activeIndex ? +1 : -1;
    setPage(([p]) => [p + dir, dir]);
    setActiveIndex(idx);
  };

  const swipeConfidenceThreshold = 800;
  const swipePower = (offset, velocity) => Math.abs(offset) * velocity;

  const handleOptionChange = (optionName, selectedValue) => {
    setSelectedOptions((prev) => ({
      ...prev,
      [optionName]: selectedValue,
    }));
  };

  const handleAddToBasket = async () => {
    if (!isShopOpenNow() && !isPreorder) {
      toast.error(
        t("the shop is closed. Click again to add to the cart", {
          ns: "deviceItem",
        })
      );
      setIsPreorder(true);
      return;
    }

    if ((device.variants?.length || 0) > 0) {
      if ((device.options?.length || 0) === 0) {
        toast.error("❌ Для товара с вариантами должны быть настроены опции.");
        return;
      }
      const allChosen = device.options.every(
        (o) => selectedOptions[o.name]?.value
      );
      if (!allChosen) {
        toast.error(`❌ ${t("Select product options!", { ns: "devicePage" })}`);
        return;
      }
      if (!selectedVariant) {
        toast.error("❌ Такой комбинации вариантов не существует.");
        return;
      }
    }

    const cleanSelected = Object.fromEntries(
      Object.entries(selectedOptions).map(([k, v]) => [k, getVal(v)])
    );
    const variantKey = device.variants?.length
      ? makeVariantKey(cleanSelected)
      : null;

    const existingItem = basket.items.find(
      (item) =>
        item.id === device.id &&
        ((variantKey && item.variantKey === variantKey) ||
          (!variantKey &&
            JSON.stringify(item.selectedOptions) ===
              JSON.stringify(selectedOptions)))
    );

    const newCount = (existingItem?.count || 0) + 1;

    const isAvailable = await checkStock(device.id, newCount, selectedOptions);
    const isThisPreorder = !isAvailable;

    if (basket.items.some((item) => item.isPreorder) && !isThisPreorder) {
      toast.error(
        `❌ ${t("you cannot add a regular item to the cart with a pre-order", {
          ns: "deviceItem",
        })}`
      );
      return;
    }

    if (basket.items.some((item) => !item.isPreorder) && isThisPreorder) {
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

    const newItem = {
      ...device,
      selectedOptions,
      variantKey,
      isPreorder: isThisPreorder,
      stockQuantity:
        selectedVariant && (device.variants?.length || 0) > 0
          ? Number(selectedVariant.quantity) || 0
          : Number(device.quantity) || 0,
      isStoreClosed,
    };

    basket.addItem(newItem);
    toast.success(
      <>
        <strong className={styles.toastTitle}>{deviceName}</strong>
        <span className={styles.toastSubtitle}>
          {t("Added to cart!", { ns: "devicePage" })}
        </span>
      </>,
      {
        style: {
          maxWidth: "400px",
        },
      }
    );

    setAvailableQuantity((prev) => prev - 1);
  };

  if (!device) return <p>{t("Loading...", { ns: "devicePage" })}</p>;

  const showOldPriceValue =
    selectedVariant && selectedVariant.oldPrice != null
      ? Number(selectedVariant.oldPrice)
      : device.oldPrice != null
      ? Number(device.oldPrice)
      : null;

  const showOld =
    showOldPriceValue != null ? showOldPriceValue > (finalPrice || 0) : false;

  const needToSelectAllOptions =
    (device.variants?.length || 0) > 0 &&
    (device.options?.length || 0) > 0 &&
    !device.options.every((o) => selectedOptions[o.name]?.value);

  const variantsActive = (device.variants || []).filter(
    (v) => v?.isActive !== false
  );

  const isValueAvailable = (optName, valueObj) => {
    if (!device.variants?.length) return true;

    const partial = Object.fromEntries(
      Object.entries(selectedOptions).map(([k, v]) => [k, getVal(v)])
    );
    partial[optName] = getVal(valueObj);

    return variantsActive.some((v) =>
      Object.entries(partial).every(([k, val]) => (v.selected || {})[k] === val)
    );
  };

  const isValueOutOfStock = (optName, valueObj) => {
    if (!device.variants?.length) {
      return (Number(valueObj.quantity) || 0) === 0;
    }
    const partial = Object.fromEntries(
      Object.entries(selectedOptions).map(([k, v]) => [k, getVal(v)])
    );
    partial[optName] = getVal(valueObj);

    const exists = variantsActive.some((v) =>
      Object.entries(partial).every(([k, val]) => (v.selected || {})[k] === val)
    );
    if (!exists) return false;

    const anyInStock = variantsActive.some(
      (v) =>
        Object.entries(partial).every(
          ([k, val]) => (v.selected || {})[k] === val
        ) && (Number(v.quantity) || 0) > 0
    );
    return !anyInStock;
  };

  const OptionSelector = ({ option, index }) => {
    const isFirst = index === 0;
    const selected = selectedOptions[option.name];

    if (isFirst && Object.keys(firstOptionPreviewMap).length > 0) {
      return (
        <div
          className={styles.OptionGroup}
          role="radiogroup"
          aria-label={option.name}
        >
          <div className={styles.OptionLabel}>
            {option.translations?.name?.[currentLang] || option.name}
          </div>

          <div className={styles.OptionThumbGrid}>
            {option.values.map((valueObj, idx) => {
              const val = valueObj.value;
              const isSelected = selected?.value === val;
              const available = isValueAvailable(option.name, valueObj);
              const oos = isValueOutOfStock(option.name, valueObj);
              const imgUrl = firstOptionPreviewMap[val] || null;

              return (
                <button
                  key={idx}
                  type="button"
                  className={[
                    styles.OptionThumb,
                    isSelected ? styles.OptionThumbSelected : "",
                    !available
                      ? styles.OptionThumbDisabled
                      : oos
                      ? styles.OptionThumbOut
                      : "",
                  ].join(" ")}
                  onClick={() => {
                    if (!available) return;
                    handleOptionChange(option.name, valueObj);
                    if (imgUrl) {
                      const i = baseImages.indexOf(imgUrl);
                      if (i !== -1) setActiveIndex(i);
                    }
                  }}
                  disabled={!available}
                  aria-pressed={isSelected}
                  title={
                    option.translations?.values?.[idx]?.[currentLang] || val
                  }
                >
                  {imgUrl ? (
                    <img
                      src={imgUrl}
                      alt=""
                      className={styles.OptionThumbImg}
                    />
                  ) : (
                    <div className={styles.OptionThumbImgFallback}>
                      {option.translations?.values?.[idx]?.[currentLang] || val}
                    </div>
                  )}
                  <span className={styles.OptionThumbLabel}>
                    {option.translations?.values?.[idx]?.[currentLang] || val}
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
        aria-label={option.name}
      >
        <div className={styles.OptionLabel}>
          {option.translations?.name?.[currentLang] || option.name}
        </div>

        <div className={styles.OptionGrid}>
          {option.values.map((valueObj, idx) => {
            const isSelected = selected?.value === valueObj.value;
            const available = isValueAvailable(option.name, valueObj);
            const oos = isValueOutOfStock(option.name, valueObj);
            return (
              <button
                key={idx}
                type="button"
                className={[
                  styles.OptionBtn,
                  isSelected ? styles.OptionBtnSelected : "",
                  !available
                    ? styles.OptionBtnDisabled
                    : oos
                    ? styles.OptionBtnOut
                    : "",
                ].join(" ")}
                onClick={() =>
                  available && handleOptionChange(option.name, valueObj)
                }
                disabled={!available}
                aria-pressed={isSelected}
              >
                {option.translations?.values?.[idx]?.[currentLang] ||
                  valueObj.value}
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className={styles.DevicePageContainer}>
      <div className={styles.DevicePageContent}>
        <div className={styles.DevicePageColImg}>
          <div className={styles.DevicePageImageWrapper}>
            {showOld && (
              <div className={styles.DevicePageDiscountBadge}>
                -
                {Math.round(
                  ((showOldPriceValue - finalPrice) / showOldPriceValue) * 100
                )}
                %
              </div>
            )}

            <div className={styles.ImageContainer}>
              <motion.div
                drag={isMobile && images.length > 1 ? "x" : false}
                dragConstraints={{ left: 0, right: 0 }}
                dragElastic={0.2}
                style={{
                  width: "100%",
                  height: "100%",
                  position: "relative",
                  touchAction: "pan-y",
                }}
                onDragEnd={(e, { offset, velocity }) => {
                  if (images.length <= 1) return;
                  const swipe = swipePower(offset.x, velocity.x);
                  if (swipe < -swipeConfidenceThreshold) paginate(+1);
                  else if (swipe > swipeConfidenceThreshold) paginate(-1);
                }}
              >
                <AnimatePresence custom={direction} mode="popLayout">
                  {images.map(
                    (img, index) =>
                      index === imageIndex && (
                        <motion.img
                          key={`${img}-${index}`}
                          src={img}
                          className={styles.DevicePageMainImage}
                          custom={direction}
                          variants={variants}
                          initial="enter"
                          animate="center"
                          exit="exit"
                          transition={{
                            x: { type: "spring", stiffness: 300, damping: 35 },
                            opacity: { duration: 0.18 },
                          }}
                        />
                      )
                  )}
                </AnimatePresence>
              </motion.div>
            </div>
            {images.length > 1 && (
              <div className={styles.ArrowButtons}>
                <button onClick={handlePrev} className={styles.PrevButton}>
                  ‹
                </button>
                <button onClick={handleNext} className={styles.NextButton}>
                  ›
                </button>
              </div>
            )}
          </div>
          {images.length > 1 && (
            <div className={styles.DevicePageThumbnailContainer}>
              {images.map((thumb, index) => (
                <img
                  key={index}
                  src={thumb}
                  className={`${styles.DevicePageThumbnail} ${
                    index === activeIndex ? styles.ActiveThumbnail : ""
                  }`}
                  onClick={() => handleThumbClick(index)}
                />
              ))}
            </div>
          )}
        </div>
        <div className={styles.DevicePageDetails}>
          <div className={styles.DevicePageCard}>
            <p className={styles.DevicePageTitle} lang={hyphenLang}>
              {device.translations?.["name"]?.[currentLang] || device.name}
            </p>

            {device.options?.length > 0 && (
              <div className={styles.DevicePageSelectedOptions}>
                {device.options?.map((option, optionIndex) => (
                  <OptionSelector
                    key={optionIndex}
                    option={option}
                    index={optionIndex}
                  />
                ))}
              </div>
            )}

            <hr className={styles.Separator} />
            <div className={styles.DevicePageBuyBlockDesktop}>
              {device.options?.map((option, optionIndex) => (
                <OptionSelector
                  key={optionIndex}
                  option={option}
                  index={optionIndex}
                />
              ))}

              <div className={styles.DevicePagePriceBlock}>
                {showOld ? (
                  <>
                    <span className={styles.DevicePageOldPrice}>
                      {showOldPriceValue.toFixed(2)} €
                    </span>
                    <span className={styles.DevicePageNewPrice}>
                      {finalPrice.toFixed(2)} €
                    </span>
                  </>
                ) : (
                  <span className={styles.DevicePageRegularPrice}>
                    {finalPrice.toFixed(2)} €
                  </span>
                )}
              </div>

              <button
                className={styles.DevicePageAddToCart}
                onClick={handleAddToBasket}
                disabled={needToSelectAllOptions}
              >
                {needToSelectAllOptions
                  ? t("Select product options!", { ns: "devicePage" })
                  : availableQuantity <= 0
                  ? t("out_of_stock", { ns: "devicePage" })
                  : t("add_to_cart", { ns: "devicePage" })}
              </button>
            </div>

            <div className={styles.DevicePageInfoMobile} lang={hyphenLang}>
              <p>{t("product photos are provided", { ns: "devicePage" })}</p>
            </div>

            <hr className={styles.Separator} />

            <div className={styles.DevicePageSpecsMobile}>
              {(device.translations?.description?.[currentLang] ||
                device.description) && (
                <>
                  <p className={styles.DevicePageDescription}>
                    {device.translations?.description?.[currentLang] ||
                      device.description}
                  </p>
                  <hr className={styles.Separator} />
                </>
              )}

              <p className={styles.DevicePageSpecsTitle}>
                {t("description", { ns: "devicePage" })}
              </p>

              <div className={styles.DevicePageSpecsCard}>
                {device.info.map((info) => (
                  <div key={info.id} className={styles.DevicePageSpecRow}>
                    <span className={styles.DevicePageSpecText}>
                      <strong>
                        {info.translations?.title?.[currentLang] || info.title}
                      </strong>
                      <span>
                        {info.translations?.description?.[currentLang] ||
                          info.description}
                      </span>
                    </span>
                  </div>
                ))}
                {device.expiryDate && (
                  <div className={styles.DevicePageSpecRow}>
                    <span className={styles.DevicePageSpecText}>
                      <strong>
                        {device.expiryKind === "use_by"
                          ? t("use_by", { ns: "devicePage" })
                          : device.expiryKind === "best_before"
                          ? t("best_before", { ns: "devicePage" })
                          : t("expiry_date", { ns: "devicePage" })}
                      </strong>
                      <span>
                        {new Date(device.expiryDate).toLocaleDateString(
                          "ru-RU"
                        )}
                      </span>
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className={styles.DevicePageInfoDesktop}>
        <hr className={styles.Separator} />
        <p>{t("product photos are provided", { ns: "devicePage" })}</p>
        <hr className={styles.Separator} />
      </div>
      <div className={styles.DevicePageSpecsDesktop}>
        {(device.translations?.description?.[currentLang] ||
          device.description) && (
          <>
            <p className={styles.DevicePageDescription}>
              {device.translations?.description?.[currentLang] ||
                device.description}
            </p>
            <hr className={styles.Separator} />
          </>
        )}

        <p className={styles.DevicePageSpecsTitle}>
          {t("description", { ns: "devicePage" })}
        </p>

        <div className={styles.DevicePageSpecsCard}>
          {device.info.map((info) => (
            <div key={info.id} className={styles.DevicePageSpecRow}>
              <span className={styles.DevicePageSpecText}>
                <strong>
                  {info.translations?.title?.[currentLang] || info.title}
                </strong>
                <span>
                  {info.translations?.description?.[currentLang] ||
                    info.description}
                </span>
              </span>
            </div>
          ))}
          {device.expiryDate && (
            <div className={styles.DevicePageSpecRow}>
              <span className={styles.DevicePageSpecText}>
                <strong>
                  {device.expiryKind === "use_by"
                    ? t("use_by", { ns: "devicePage" })
                    : device.expiryKind === "best_before"
                    ? t("best_before", { ns: "devicePage" })
                    : t("expiry_date", { ns: "devicePage" })}
                </strong>
                <span>
                  {new Date(device.expiryDate).toLocaleDateString("ru-RU")}
                </span>
              </span>
            </div>
          )}
        </div>
      </div>
      <div className={styles.DevicePageBuyBlockMobile}>
        <button
          className={styles.DevicePageAddButtonCompact}
          onClick={handleAddToBasket}
          disabled={needToSelectAllOptions}
        >
          <span className={styles.AddText}>
            {t("add_to_cart", { ns: "devicePage" })}
          </span>
          <span className={styles.AddPrice}>
            {showOld ? (
              <>
                <span className={styles.Strike}>
                  {showOldPriceValue.toFixed(2)} €
                </span>{" "}
                {finalPrice.toFixed(2)} €
              </>
            ) : (
              `${finalPrice.toFixed(2)} €`
            )}
          </span>
        </button>
      </div>
    </div>
  );
};

export default DevicePage;
