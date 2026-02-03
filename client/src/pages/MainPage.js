import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { fetchSellers } from "../http/sellerAPI";
import { fetchShopStatus } from "../http/shopAPI";
import mainStoreImg from "../assets/main-store.png";
import parcelDeliveryImg from "../assets/parcel-delivery.png";
import { useTranslation } from "react-i18next";
import styles from "./MainPage.module.css";

const MAIN_SHOP_PATH = "/shop";

const MainPage = () => {
  const [sellers, setSellers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();
  const [shopStatus, setShopStatus] = useState(null);
  const { t } = useTranslation();

  useEffect(() => {
    const load = async () => {
      try {
        const [list, shop] = await Promise.all([
          fetchSellers(),
          fetchShopStatus(),
        ]);
        setSellers(list || []);
        setShopStatus(shop || null);
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

  const formatSellerHours = (s) => {
    const wh = s?.workHours;
    if (!wh) return null;

    const now = new Date();
    const day = now.getDay();

    const sched = day === 0 ? wh.sunday : day === 6 ? wh.saturday : wh.weekdays;

    if (!sched?.start || !sched?.end) return null;
    return `${sched.start}–${sched.end}`;
  };

  return (
    <div className={styles.wrapper}>
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

      <div className={styles.sectionHeader} style={{ marginTop: 18 }}></div>

      {error && <div className={styles.error}>{error}</div>}

      {loading && (
        <>
          <SkeletonList count={4} />
        </>
      )}

      {!loading && !error && sellers.length > 0 && (
        <div className={styles.bannerList}>
          {sellers.map((s) => {
            const src = getSellerImgSrc(s.img);

            return (
              <button
                key={s.id}
                className={`${styles.banner} ${!s.isOpenNow ? styles.closedBanner : ""}`}
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
                    {s.kind && <div className={styles.badge}></div>}
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
    </div>
  );
};

export default MainPage;
