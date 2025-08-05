import React, { useEffect, useState } from "react";
import {
  fetchNewDevices,
  fetchDiscountedDevices,
  fetchRecommendedDevices,
  fetchTypes,
} from "../http/deviceAPI";
import { useTranslation } from "react-i18next";
import DeviceItem from "../components/DeviceItem";
import styles from "./HomePage.module.css";
import { Link } from "react-router-dom";
import OrderSidebar from "../components/OrderSidebar";

const HomePage = () => {
  const [newDevices, setNewDevices] = useState([]);
  const [discountedDevices, setDiscountedDevices] = useState([]);
  const [recommendedDevices, setRecommendedDevices] = useState([]);
  const [types, setTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAllTypes, setShowAllTypes] = useState(false);
  const [isDesktop, setIsDesktop] = useState(window.innerWidth >= 1024);
  const { t, i18n } = useTranslation();
  const currentLang = i18n.language || "en";
  const [isSidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [
          newDevicesData,
          discountedData,
          recommendedData,
          typesData,
        ] = await Promise.all([
          fetchNewDevices(),
          fetchDiscountedDevices(),
          fetchRecommendedDevices(),
          fetchTypes(),
        ]);

        setNewDevices(newDevicesData || []);
        setDiscountedDevices(discountedData || []);
        setRecommendedDevices(recommendedData || []);
        setTypes(Array.isArray(typesData) ? typesData : []);
        
      } catch (err) {
        console.error("❌ Ошибка при загрузке данных:", err);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  useEffect(() => {
    const handleResize = () => {
      setIsDesktop(window.innerWidth >= 1024);
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return (
    <div className={styles.homePage}>
    {loading && <div className={styles.loadingOverlay}>{t("loading", { ns: "homePage" })}</div>}
      <div className={styles.banner}>
        <h1>{t("fast delivery", { ns: "homePage" })}</h1>
        <p>{t("average delivery time: 15–30 minutes", { ns: "homePage" })}</p>
      </div>

      <div className={styles.categories}>
        {isDesktop && types.length > 6 ? (
          <>
            {types.slice(0, 5).map((type) => (
              <Link
                key={type.id}
                to={`/catalog?typeId=${type.id}`}
                className={styles.category}
              >
                {type.translations?.name?.[currentLang] || type.name}
              </Link>
            ))}
            <div className={styles.dropdownContainer}>
              <div
                className={`${styles.category} ${styles.moreButton}`}
                onClick={() => setShowAllTypes(!showAllTypes)}
              >
                {showAllTypes
                  ? t("hide", { ns: "homePage" })
                  : t("more", { ns: "homePage" })}
              </div>

              {showAllTypes && (
                <div className={styles.dropdownMenu}>
                  {types.slice(5).map((type) => (
                    <Link
                      key={type.id}
                      to={`/catalog?typeId=${type.id}`}
                      className={styles.dropdownItem}
                    >
                      {type.translations?.name?.[currentLang] || type.name}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </>
        ) : (
          types.map((type) => (
            <Link
              key={type.id}
              to={`/catalog?typeId=${type.id}`}
              className={styles.category}
            >
              {type.translations?.name?.[currentLang] || type.name}
            </Link>
          ))
        )}
      </div>

      <OrderSidebar
            isSidebarOpen={isSidebarOpen}
            setSidebarOpen={setSidebarOpen}
          />

      <section className={styles.section}>
        <h2>{t("new", { ns: "homePage" })}</h2>
        <div className={styles.deviceCarousel}>
          {newDevices.length > 0 ? (
            newDevices.map((device) => (
              <div key={device.id} className={styles.deviceItem}>
                <DeviceItem device={device} />
              </div>
            ))
          ) : (
            <p>{t("loading", { ns: "homePage" })}</p>
          )}
        </div>
      </section>

      <section className={styles.section}>
        <h2>{t("discounts", { ns: "homePage" })}</h2>
        <div className={styles.deviceCarousel}>
          {Array.isArray(discountedDevices) && discountedDevices.length > 0 ? (
            discountedDevices.map((device) => (
              <div key={device.id} className={styles.deviceItem}>
                <DeviceItem device={device} />
              </div>
            ))
          ) : (
            <p>{t("loading", { ns: "homePage" })}</p>
          )}
        </div>
      </section>

      <section className={styles.section}>
        <h2>{t("recommended", { ns: "homePage" })}</h2>
        <div className={styles.deviceCarousel}>
          {Array.isArray(recommendedDevices) &&
          recommendedDevices.length > 0 ? (
            recommendedDevices.map((device) => (
              <div key={device.id} className={styles.deviceItem}>
                <DeviceItem device={device} />
              </div>
            ))
          ) : (
            <p>{t("loading", { ns: "homePage" })}</p>
          )}
        </div>
      </section>
    </div>
  );
};

export default HomePage;
