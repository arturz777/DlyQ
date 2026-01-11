import React, {
  lazy,
  Suspense,
  useEffect,
  useState,
  useContext,
  useRef,
  useCallback,
  useMemo,
} from "react";
import { Link } from "react-router-dom";
import { Context } from "../index";
import {
  fetchNewDevices,
  fetchDiscountedDevices,
  fetchRecommendedDevices,
  fetchTypes,
  fetchSubtypes,
  fetchCatalogCursor,
} from "../http/deviceAPI";
import { useTranslation } from "react-i18next";
import DeviceItem from "../components/DeviceItem";
import DeviceList from "../components/DeviceList";
import SlideModal from "../components/modals/SlideModal";
import styles from "./Shop.module.css";
import catalogStyles from "./CatalogPage.module.css";

const DevicePageLazy = lazy(() => import("../pages/DevicePage"));

const Shop = () => {
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
  const [showScrollTop, setShowScrollTop] = useState(false);

  const bottomRef = useRef(null);

  const [feedTypeIndex, setFeedTypeIndex] = useState(0);
  const [typeCursors, setTypeCursors] = useState({});
  const [typeHasMore, setTypeHasMore] = useState({});

  const orderedTypeIds = useMemo(() => {
    const types = Array.isArray(device.types) ? device.types : [];
    return types
      .slice()
      .sort((a, b) => {
        const ao = Number(a.displayOrder ?? 0);
        const bo = Number(b.displayOrder ?? 0);
        return ao === bo ? Number(a.id) - Number(b.id) : ao - bo;
      })
      .map((t) => Number(t.id))
      .filter(Boolean);
  }, [device.types]);

  useEffect(() => {
    device.resetFeed?.();
    device.setSelectedType({});
    device.setSelectedSubType({});
    device.setSelectedBrand({});
    device.setSelectedMake({});
    device.setSelectedModel({});
    setFeedTypeIndex(0);
    setTypeCursors({});
    setTypeHasMore({});
  }, [device]);

  const loadMore = useCallback(async () => {
    if (device.loading.devices || !device.hasMore) return;

    const typeIds = orderedTypeIds.slice();
    if (!typeIds.length) return;

    let idx = feedTypeIndex;

    while (idx < typeIds.length) {
      const tid = typeIds[idx];

      if (typeHasMore[tid] === false) {
        idx++;
        continue;
      }

      device.setLoading("devices", true);
      try {
        const data = await fetchCatalogCursor({
          typeId: tid,
          subtypeId: undefined,
          brandId: undefined,
          makeId: undefined,
          modelId: undefined,
          compatMode: undefined,
          cursor: typeCursors[tid] ?? undefined,
          sort: device.sort,
          limit: device.limit,
          onlyVisible: true,
          lang: currentLang,
        });

        const items = data.items || [];

        if (!items.length) {
          setTypeHasMore((prev) => ({ ...prev, [tid]: false }));
          idx++;
          continue;
        }

        device.appendDevices(items);

        setTypeCursors((prev) => ({
          ...prev,
          [tid]: data.nextCursor || null,
        }));
        setTypeHasMore((prev) => ({
          ...prev,
          [tid]: !!data.hasMore,
        }));

        setFeedTypeIndex(idx);

        return;
      } catch (e) {
        console.error("cursor load error on HomePage", e);
        setTypeHasMore((prev) => ({ ...prev, [tid]: false }));
        idx++;
      } finally {
        device.setLoading("devices", false);
      }
    }

    device.setHasMore(false);
  }, [
    device,
    orderedTypeIds,
    feedTypeIndex,
    typeCursors,
    typeHasMore,
    currentLang,
  ]);

  useEffect(() => {
    if (
      device.devices.length === 0 &&
      device.hasMore &&
      !device.loading.devices
    ) {
      loadMore();
    }
  }, [device.devices.length, device.hasMore, device.loading.devices, loadMore]);

  useEffect(() => {
    const el = bottomRef.current;
    if (!el) return;

    const io = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (entry.isIntersecting) {
          loadMore();
        }
      },
      { rootMargin: "600px 0px" }
    );

    io.observe(el);
    return () => io.disconnect();
  }, [bottomRef, loadMore]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const LIMIT = 50;

        const [
          newDevicesData,
          discountedData,
          recommendedData,
          typesData,
          subtypesData,
        ] = await Promise.all([
          fetchNewDevices(LIMIT),
          fetchDiscountedDevices(LIMIT),
          fetchRecommendedDevices(undefined, LIMIT),
          fetchTypes(),
          fetchSubtypes(),
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
          (t) => ({ ...t, translations: t.translations || {} })
        );
        setTypes(typesEnriched);
        device.setTypes(typesEnriched);

        device.setSubtypes(
          (Array.isArray(subtypesData) ? subtypesData : []).map((s) => ({
            ...s,
            translations: s.translations || {},
          }))
        );
      } catch (err) {
        console.error("❌ Error while loading data:", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [device]);

  useEffect(() => {
    const handleResize = () => setIsDesktop(window.innerWidth >= 1024);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    const onOpenDevice = (e) => {
      const id = e?.detail?.id;
      if (id) setSelectedDeviceId(id);
    };
    window.addEventListener("openDeviceModal", onOpenDevice);
    return () => window.removeEventListener("openDeviceModal", onOpenDevice);
  }, []);

  useEffect(() => {
    const handleScroll = () => setShowScrollTop(window.scrollY > 300);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const scrollToTop = () => window.scrollTo({ top: 0, behavior: "smooth" });

  return (
    <div className={styles.homePage}>
      {loading && (
        <div className={styles.loadingOverlay}>
          {t("loading", { ns: "homePage" })}
        </div>
      )}

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
                to={`/catalog?typeId=${type.id}&scroll=1`}
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
                      to={`/catalog?typeId=${type.id}&scroll=1`}
                      className={styles.dropdownItem}
                    >
                      <span className={styles.dropdownItemLabel}>
                        {type.translations?.name?.[currentLang] || type.name}
                      </span>
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
              to={`/catalog?typeId=${type.id}&scroll=1`}
              className={styles.category}
            >
              {type.translations?.name?.[currentLang] || type.name}
            </Link>
          ))
        )}
      </div>

      <section className={styles.section}>
        <h2>{t("discounts", { ns: "homePage" })}</h2>
        <div className={styles.deviceCarousel}>
          {Array.isArray(discountedDevices) && discountedDevices.length > 0 ? (
            discountedDevices.map((d) => (
              <div key={d.id} className={styles.deviceItem}>
                <DeviceItem
                  device={d}
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
            newDevices.map((d) => (
              <div key={d.id} className={styles.deviceItem}>
                <DeviceItem
                  device={d}
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
            recommendedDevices.map((d) => (
              <div key={d.id} className={styles.deviceItem}>
                <DeviceItem
                  device={d}
                  onClick={(id) => setSelectedDeviceId(id)}
                />
              </div>
            ))
          ) : (
            <p>{t("loading", { ns: "homePage" })}</p>
          )}
        </div>
      </section>

      <div
        className={catalogStyles.deviceContainer}
        id="catalog-devices"
        style={{ opacity: device.loading.devices ? 0.3 : 1 }}
      >
        <DeviceList onDeviceClick={(id) => setSelectedDeviceId(id)} />
      </div>

      <div ref={bottomRef} className={catalogStyles.ioSentinel} aria-hidden />

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

export default Shop;
