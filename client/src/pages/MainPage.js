import React, { lazy, Suspense, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { fetchSellers } from "../http/sellerAPI";
import { fetchShopStatus } from "../http/shopAPI";
import { fetchDiscountedDevices } from "../http/deviceAPI";
import mainStoreImg from "../assets/main-store.png";
import parcelDeliveryImg from "../assets/parcel-delivery.png";
import { useTranslation } from "react-i18next";
import styles from "./MainPage.module.css";

import DeviceItem from "../components/DeviceItem";
import SlideModal from "../components/modals/SlideModal";

const DevicePageLazy = lazy(() => import("../pages/DevicePage"));

const MAIN_SHOP_PATH = "/shop";

const MainPage = () => {
  const [sellers, setSellers] = useState([]);
  const [discountedDevices, setDiscountedDevices] = useState([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [shopStatus, setShopStatus] = useState(null);
  const carouselRef = useRef(null);
  const navigate = useNavigate();
  const { t } = useTranslation();

  const scrollCarousel = (dir) => {
    const el = carouselRef.current;
    if (!el) return;

    const amount = Math.max(320, Math.floor(el.clientWidth * 0.8));
    el.scrollBy({ left: dir * amount, behavior: "smooth" });
  };

  const isStoreClosed = shopStatus
    ? typeof shopStatus.isStoreClosed === "boolean"
      ? shopStatus.isStoreClosed
      : !shopStatus.isOpen
    : false;

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);

        const DISCOUNT_LIMIT = 24;

        const [list, shop, discounted] = await Promise.all([
          fetchSellers(),
          fetchShopStatus(),
          fetchDiscountedDevices(DISCOUNT_LIMIT),
        ]);

        setSellers(list || []);
        setShopStatus(shop || null);

        const devicesArr = Array.isArray(discounted)
          ? discounted
          : (discounted?.devices ?? []);
        setDiscountedDevices(devicesArr);
      } catch (e) {
        console.error(e);
        setError(t("failed to load restaurants", { ns: "mainPage" }));
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [t]);

  const getSellerImgSrc = (img) => {
    if (!img) return null;

    const base = process.env.REACT_APP_API_URL;
    if (/^https?:\/\//i.test(img)) return img;
    if (img.startsWith("/")) return `${base}${img}`;
    return `${base}/${img}`;
  };

  const handleOpenSeller = (s) => {
    const slugOrId = s.slug || s.id;
    navigate(`/seller/${slugOrId}`, { state: { seller: s } });
  };

  const handleOpenMainShop = () => {
    navigate(MAIN_SHOP_PATH);
  };

  const SkeletonList = ({ count = 4 }) => (
    <div className={styles.bannerList} aria-hidden="true">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className={`${styles.banner} ${styles.skeleton}`}>
          <div className={styles.skeletonImg} />
          <div className={styles.skeletonContent}>
            <div className={styles.skeletonLine} />
            <div className={styles.skeletonPill} />
          </div>
        </div>
      ))}
    </div>
  );

  const SkeletonCarousel = ({ count = 8 }) => (
    <div className={styles.deviceCarousel} aria-hidden="true">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className={styles.deviceItem}>
          <div className={styles.deviceSkeletonCard} />
        </div>
      ))}
    </div>
  );

  const formatHours = (h) => {
    if (!h) return "";
    const start = h?.start || "";
    const end = h?.end || "";
    if (!start || !end) return "";
    return `${start}–${end}`;
  };

  const pickDayKey = () => {
    const now = new Date();
    const talStr = now.toLocaleString("en-US", { timeZone: "Europe/Tallinn" });
    const tal = new Date(talStr);
    const day = tal.getDay();
    if (day === 0) return "sunday";
    if (day === 6) return "saturday";
    return "weekdays";
  };

  const getTodayHoursText = (workHours) => {
    if (!workHours) return "";
    const key = pickDayKey();
    return formatHours(workHours[key]);
  };

  return (
    <div className={styles.wrapper}>
      <button
        className={`${styles.banner} ${styles.mainStore} ${
          shopStatus && !shopStatus.isOpen ? styles.closedBanner : ""
        }`}
        onClick={handleOpenMainShop}
        type="button"
      >
        <img src={mainStoreImg} alt="DlyQ Store" className={styles.bannerImg} />

        <div
          className={`${styles.bannerOverlay} ${
            shopStatus && !shopStatus.isOpen ? styles.closedOverlay : ""
          }`}
        />

        <div className={styles.bannerContent}>
          <div className={styles.bannerTitle}>DlyQ Store</div>
        </div>

        {shopStatus && !shopStatus.isOpen && (
          <div className={styles.closedFull}>
            <div className={styles.closedFullTitle}>
              {t("CLOSED", { ns: "mainPage" })}
            </div>
            <div className={styles.closedFullSub}>
              {t("opening hours", { ns: "mainPage" })}{" "}
              {getTodayHoursText(shopStatus.workHours) || "—"}
            </div>
          </div>
        )}
      </button>

      <section className={styles.productSection} aria-label="Discounts">
        <div className={styles.sectionHead}>
          <div className={styles.sectionTitleRow}>
            <div className={styles.discountTitle}>
              {t("discounts", { ns: "homePage" })}
            </div>

            <span className={styles.storePill}>DlyQ Store</span>
          </div>
        </div>

        {loading ? (
          <SkeletonCarousel count={8} />
        ) : discountedDevices.length > 0 ? (
          <div className={styles.carouselWrap}>
            <button
              type="button"
              className={`${styles.carouselArrow} ${styles.left}`}
              onClick={() => scrollCarousel(-1)}
              aria-label="Scroll left"
            >
              ‹
            </button>

            <div ref={carouselRef} className={styles.deviceCarousel}>
              {discountedDevices.map((d) => (
                <div key={d.id} className={styles.deviceItem}>
                  <DeviceItem
                    device={d}
                    onClick={(id) => setSelectedDeviceId(id)}
                    isStoreClosed={isStoreClosed}
                  />
                </div>
              ))}
            </div>

            <button
              type="button"
              className={`${styles.carouselArrow} ${styles.right}`}
              onClick={() => scrollCarousel(1)}
              aria-label="Scroll right"
            >
              ›
            </button>
          </div>
        ) : (
          <div className={styles.emptyHint}>
            {t("no_discounts_yet", {
              ns: "mainPage",
              defaultValue: "Пока нет товаров со скидкой.",
            })}
          </div>
        )}
      </section>

      <button
        className={styles.banner}
        onClick={() => navigate("/parcel")}
        type="button"
      >
        <img
          src={parcelDeliveryImg}
          alt="Parcel delivery"
          className={styles.bannerImg}
        />
        <div className={styles.bannerOverlay} />

        <div className={styles.bannerContent}>
          <div className={styles.bannerTitle}>
            📦 {t("parcel delivery", { ns: "mainPage" })}
          </div>
        </div>
      </button>

      <div className={styles.sectionHeader} style={{ marginTop: 18 }} />

      {error && <div className={styles.error}>{error}</div>}

      {loading && <SkeletonList count={4} />}

      {!loading && !error && sellers.length === 0 && (
        <div className={styles.emptyHint}>
          {t("no_sellers_yet", {
            ns: "mainPage",
            defaultValue: "Пока нет продавцов. Скоро добавим!",
          })}
        </div>
      )}

      {!loading && !error && sellers.length > 0 && (
        <div className={styles.bannerList}>
          {sellers.map((s) => {
            const src = getSellerImgSrc(s.img);

            return (
              <button
                key={s.id}
                className={`${styles.banner} ${
                  !s.isOpenNow ? styles.closedBanner : ""
                }`}
                onClick={() => handleOpenSeller(s)}
                type="button"
              >
                {src ? (
                  <img src={src} alt={s.name} className={styles.bannerImg} />
                ) : (
                  <div className={styles.bannerImgPlaceholder} />
                )}

                <div className={styles.bannerOverlay} />

                <div className={styles.bannerContent}>
                  <div className={styles.bannerTitle}>{s.name}</div>
                  <div className={styles.badgeRow}>
                    {s.kind && <div className={styles.badge} />}
                  </div>
                </div>

                {!s.isOpenNow && (
                  <>
                    <div className={styles.closedOverlay} />
                    <div className={styles.closedFull}>
                      <div className={styles.closedFullTitle}>
                        {t("CLOSED", { ns: "mainPage" })}
                      </div>
                      <div className={styles.closedFullSub}>
                        {t("opening hours", { ns: "mainPage" })}{" "}
                        {getTodayHoursText(s.workHours) || "—"}
                      </div>
                    </div>
                  </>
                )}
              </button>
            );
          })}
        </div>
      )}

      {selectedDeviceId && (
        <SlideModal onClose={() => setSelectedDeviceId(null)}>
          <Suspense
            fallback={
              <div style={{ padding: 16 }}>
                {t("loading", { ns: "homePage", defaultValue: "Загрузка..." })}
              </div>
            }
          >
            <DevicePageLazy id={selectedDeviceId} />
          </Suspense>
        </SlideModal>
      )}
    </div>
  );
};

export default MainPage;
