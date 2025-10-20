import React, { lazy, Suspense, useEffect, useState, useContext } from "react";
import { Link } from "react-router-dom";
import { Context } from "../index";
import {
  fetchNewDevices,
  fetchDiscountedDevices,
  fetchRecommendedDevices,
  fetchTypes,
  fetchSubtypes,
  fetchFilter,
} from "../http/deviceAPI";
import { useTranslation } from "react-i18next";
import DeviceItem from "../components/DeviceItem";
import DeviceList from "../components/DeviceList";
import OrderSidebar from "../components/OrderSidebar";
import SlideModal from "../components/modals/SlideModal";
import styles from "./HomePage.module.css";
import catalogStyles from "./CatalogPage.module.css";
const DevicePageLazy = lazy(() => import("../pages/DevicePage"));

const HomePage = () => {
  const { device } = useContext(Context);
  const [newDevices, setNewDevices] = useState([]);
  const [discountedDevices, setDiscountedDevices] = useState([]);
  const [recommendedDevices, setRecommendedDevices] = useState([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState(null);
  const [types, setTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAllTypes, setShowAllTypes] = useState(false);
  const [isDesktop, setIsDesktop] = useState(window.innerWidth >= 1024);
  const { t, i18n } = useTranslation();
  const currentLang = i18n.language || "en";
  const [isSidebarOpen, setSidebarOpen] = useState(false);
  const [shouldLoadCatalog, setShouldLoadCatalog] = useState(false);
  const [showScrollTop, setShowScrollTop] = useState(false);

   useEffect(() => {
  if (!shouldLoadCatalog) return;
  if ((device.devices?.length ?? 0) > 0) return; 

  const LIMIT = 1000;
  (async () => {
    const data = await fetchFilter(null, null, null, 1, LIMIT, null, null);
    device.setDevices(prev => prev?.length ? prev : (data.rows || []));
    device.setTotalCount(data.count || 0);
    device.setFacets?.(data.facets ?? { subtypes: [], brands: [] });
  })();
}, [shouldLoadCatalog]);

  useEffect(() => {
    if (!shouldLoadCatalog) return;
    (async () => {
      const data = await fetchFilter(null, null, null, 1, 24, null, null);
      device.setDevices(data.rows || []);
      device.setTotalCount(data.count || 0);
      device.setFacets?.(data.facets ?? { subtypes: [], brands: [] });
    })();
  }, [shouldLoadCatalog]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        setLoading(true);
        const LIMIT = 1000;

        const [
          newDevicesData,
          discountedData,
          recommendedData,
          typesData,
          subtypesData,
          catalogData,
        ] = await Promise.all([
          fetchNewDevices(LIMIT),
          fetchDiscountedDevices(LIMIT),
          fetchRecommendedDevices(undefined, LIMIT),
          fetchTypes(),
          fetchSubtypes(),
          fetchFilter(null, null, null, 1, LIMIT, null, null),
        ]);

        if (cancelled) return;

        setNewDevices(
          Array.isArray(newDevicesData)
            ? newDevicesData
            : newDevicesData?.devices ?? []
        );
        setDiscountedDevices(
          Array.isArray(discountedData)
            ? discountedData
            : discountedData?.devices ?? []
        );
        setRecommendedDevices(
          Array.isArray(recommendedData)
            ? recommendedData
            : recommendedData?.devices ?? []
        );

        const typesEnriched = (Array.isArray(typesData) ? typesData : []).map(
          (t) => ({
            ...t,
            translations: t.translations || {},
          })
        );
        setTypes(typesEnriched);
        device.setTypes(typesEnriched);

        device.setSubtypes(
          (Array.isArray(subtypesData) ? subtypesData : []).map((s) => ({
            ...s,
            translations: s.translations || {},
          }))
        );

        device.setDevices(catalogData.rows || []);
        device.setTotalCount(catalogData.count || 0);
        device.setFacets?.(catalogData?.facets ?? { subtypes: [], brands: [] });
        device.setSelectedType({});
        device.setSelectedSubType({});
        device.setSelectedBrand({});
        device.setSelectedMake({});
        device.setSelectedModel({});
      } catch (err) {
        console.error("❌ Ошибка при загрузке данных:", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const handleResize = () => {
      setIsDesktop(window.innerWidth >= 1024);
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    const onOpenDevice = (e) => {
      const id = e?.detail?.id;
      if (id) {
        setSelectedDeviceId(id);
      }
    };
    window.addEventListener("openDeviceModal", onOpenDevice);
    return () => window.removeEventListener("openDeviceModal", onOpenDevice);
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      setShowScrollTop(window.scrollY > 300);
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  return (
    <div className={styles.homePage}>
      {loading && (
        <div className={styles.loadingOverlay}>
          {t("loading", { ns: "homePage" })}
        </div>
      )}
      <div className={styles.banner}>
        {/* <h1>{t("fast delivery", { ns: "homePage" })}</h1>  */}
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
        <h2>{t("discounts", { ns: "homePage" })}</h2>
        <div className={styles.deviceCarousel}>
          {Array.isArray(discountedDevices) && discountedDevices.length > 0 ? (
            discountedDevices.map((device) => (
              <div key={device.id} className={styles.deviceItem}>
                <DeviceItem
                  device={device}
                  onClick={(id) => setSelectedDeviceId(id)}
                />
              </div>
            ))
          ) : (
            <p>{t("loading", { ns: "homePage" })}</p>
          )}
        </div>
      </section>

      <section className={styles.section}>
        <h2>{t("new", { ns: "homePage" })}</h2>
        <div className={styles.deviceCarousel}>
          {newDevices.length > 0 ? (
            newDevices.map((device) => (
              <div key={device.id} className={styles.deviceItem}>
                <DeviceItem
                  device={device}
                  onClick={(id) => setSelectedDeviceId(id)}
                />
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
                <DeviceItem
                  device={device}
                  onClick={(id) => setSelectedDeviceId(id)}
                />
              </div>
            ))
          ) : (
            <p>{t("loading", { ns: "homePage" })}</p>
          )}
        </div>
      </section>
      <div className={catalogStyles.deviceContainer} id="catalog-devices">
        <DeviceList onDeviceClick={(id) => setSelectedDeviceId(id)} />
      </div>
      {showScrollTop && (
        <button
          onClick={scrollToTop}
          className={catalogStyles.scrollToTopButton}
        >
          ↑
        </button>
      )}
      {selectedDeviceId && (
        <SlideModal onClose={() => setSelectedDeviceId(null)}>
          <Suspense
            fallback={
              <div style={{ padding: 16 }}>
                {t("loading", { ns: "homePage" })}
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

export default HomePage;
