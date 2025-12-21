import React, { useMemo, useState } from "react";
import deviceStyles from "../pages/DevicePage.module.css";
import { useTranslation } from "react-i18next";
import styles from "./DishModal.module.css";

const clamp = (n, a, b) => Math.max(a, Math.min(b, n));

const DishModal = ({ item, seller, getImgSrc, onAdd }) => {
  const [qty, setQty] = useState(1);
  const { t } = useTranslation();

  const imgSrc = useMemo(() => getImgSrc?.(item?.img), [getImgSrc, item?.img]);
  const price = Number(item?.price || 0);
  const total = price * qty;
  const isAvailable = !!item?.isAvailable;

  return (
    <div className={`${deviceStyles.DevicePageContainer} ${styles.container}`}>
      <div className={`${deviceStyles.DevicePageContent} ${styles.content}`}>
        <div className={deviceStyles.DevicePageColImg}>
          <div className={deviceStyles.DevicePageImageWrapper}>
            <div className={deviceStyles.ImageContainer}>
              {imgSrc ? (
                <img
                  src={imgSrc}
                  alt={item?.name || t("dish", { ns: "dishModal" })}
                  className={`${deviceStyles.DevicePageMainImage} ${styles.mainImg}`}
                  onError={(e) => (e.currentTarget.style.display = "none")}
                />
              ) : (
                <div className={styles.imgPlaceholder} />
              )}
            </div>
          </div>
        </div>

        <div className={deviceStyles.DevicePageDetails}>
          <div className={deviceStyles.DevicePageCard}>
            <p className={deviceStyles.DevicePageTitle}>{item?.name}</p>

            {seller?.name && (
              <div className={styles.sellerName}>{seller.name}</div>
            )}

            {item?.description && (
              <p className={styles.desc}>{item.description}</p>
            )}

            <div className={deviceStyles.DevicePagePriceBlock}>
              <span className={deviceStyles.DevicePageRegularPrice}>
                {price.toFixed(2)} €
              </span>
            </div>

            <div className={`${styles.bottomRow} ${styles.desktopOnly}`}>
              <div className={styles.qty}>
                <button
                  type="button"
                  className={styles.qtyBtn}
                  onClick={() => setQty((v) => clamp(v - 1, 1, 99))}
                  disabled={qty <= 1 || !isAvailable}
                >
                  −
                </button>
                <div className={styles.qtyVal}>{qty}</div>
                <button
                  type="button"
                  className={styles.qtyBtn}
                  onClick={() => setQty((v) => clamp(v + 1, 1, 99))}
                  disabled={!isAvailable}
                >
                  +
                </button>
              </div>
            </div>

            <button
              type="button"
              className={`${deviceStyles.DevicePageAddToCart} ${styles.desktopAdd}`}
              disabled={!isAvailable}
              onClick={() => onAdd?.(qty)}
            >
              {t("add", { ns: "dishModal" })} • {total.toFixed(2)} €
            </button>

            <div className={styles.mobileBar}>
              <div className={styles.mobileBarInner}>
                <div className={styles.mobileQty}>
                  <button
                    type="button"
                    className={styles.mobileQtyBtn}
                    onClick={() => setQty((v) => clamp(v - 1, 1, 99))}
                    disabled={qty <= 1 || !isAvailable}
                  >
                    −
                  </button>
                  <div className={styles.mobileQtyVal}>{qty}</div>
                  <button
                    type="button"
                    className={styles.mobileQtyBtn}
                    onClick={() => setQty((v) => clamp(v + 1, 1, 99))}
                    disabled={!isAvailable}
                  >
                    +
                  </button>
                </div>

                <button
                  type="button"
                  className={`${deviceStyles.DevicePageAddButtonCompact} ${styles.mobileAddBtn}`}
                  disabled={!isAvailable}
                  onClick={() => onAdd?.(qty)}
                >
                  <span className={deviceStyles.AddText}>
                  {isAvailable
                      ? t("add", { ns: "dishModal" })
                      : t("out of stock", { ns: "dishModal" })}
                  </span>
                  <span className={deviceStyles.AddPrice}>
                    {total.toFixed(2)} €
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DishModal;
