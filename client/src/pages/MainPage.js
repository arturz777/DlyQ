import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { fetchSellers } from "../http/sellerAPI";
import mainStoreImg from "../assets/main-store.png";
import styles from "./MainPage.module.css";

const MAIN_SHOP_PATH = "/shop";

const MainPage = () => {
  const [sellers, setSellers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const load = async () => {
      try {
        const list = await fetchSellers();
        setSellers(list || []);
      } catch (e) {
        console.error(e);
        setError("Не удалось загрузить рестораны");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

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

  return (
    <div className={styles.wrapper}>
      <button
        className={styles.banner}
        onClick={() => navigate("/parcel")}
        type="button"
      >
        <div className={styles.bannerOverlay} />
        <div className={styles.bannerContent}>
          <div className={styles.bannerTitle}>📦 Доставка посылки</div>
          <div className={styles.badge}>Из пункта A в пункт B</div>
        </div>
      </button>

      <button
        className={`${styles.banner} ${styles.mainStore}`}
        onClick={handleOpenMainShop}
        type="button"
      >
        <img
          src={mainStoreImg}
          alt="DlyQ Market"
          className={styles.bannerImg}
        />
        <div className={styles.bannerOverlay} />

        <div className={styles.bannerContent}>
          <div className={styles.bannerTitle}>DlyQ Market</div>
        </div>
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
                className={styles.banner}
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
                  {s.kind && <div className={styles.badge}>{s.kind}</div>}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default MainPage;
