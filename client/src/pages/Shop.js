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
import { fetchShopStatus } from "../http/shopAPI";
import { useTranslation } from "react-i18next";
import DeviceItem from "../components/DeviceItem";
import DeviceList from "../components/DeviceList";
import SlideModal from "../components/modals/SlideModal";
import heroImg from "../assets/catalog-suggest.png";
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
  const [showInfo, setShowInfo] = useState(false);
  const [shopStatus, setShopStatus] = useState(null);

  const bottomRef = useRef(null);

  const [feedTypeIndex, setFeedTypeIndex] = useState(0);
  const [typeCursors, setTypeCursors] = useState({});
  const [typeHasMore, setTypeHasMore] = useState({});

  const getTodayHoursText = (workHours) => {
    if (!workHours || typeof workHours !== "object") return "—";

    const day = new Date().getDay();
    const key = day === 0 ? "sunday" : day === 6 ? "saturday" : "weekdays";

    const v = workHours[key];
    if (!v) return "—";
    if (v.closed) return "Закрыто";
    if (v.start && v.end) return `${v.start}–${v.end}`;
    return "—";
  };

  const formatWorkHours = (workHours) => {
    if (!workHours || typeof workHours !== "object") return [];
    const rows = [];
    const map = [
      { key: "weekdays", label: "Пн–Пт" },
      { key: "saturday", label: "Сб" },
      { key: "sunday", label: "Вс" },
    ];

    for (const { key, label } of map) {
      const v = workHours[key];
      if (!v) continue;
      if (v.closed) rows.push({ label, value: "Закрыто" });
      else if (v.start && v.end)
        rows.push({ label, value: `${v.start} – ${v.end}` });
    }
    return rows;
  };

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
      { rootMargin: "600px 0px" },
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
          shopStatusData,
        ] = await Promise.all([
          fetchNewDevices(LIMIT),
          fetchDiscountedDevices(LIMIT),
          fetchRecommendedDevices(undefined, LIMIT),
          fetchTypes(),
          fetchSubtypes(),
          fetchShopStatus(),
        ]);
        if (cancelled) return;

        setNewDevices(
          Array.isArray(newDevicesData)
            ? newDevicesData
            : (newDevicesData?.devices ?? []),
        );
        setDiscountedDevices(
          Array.isArray(discountedData)
            ? discountedData
            : (discountedData?.devices ?? []),
        );
        setRecommendedDevices(
          Array.isArray(recommendedData)
            ? recommendedData
            : (recommendedData?.devices ?? []),
        );

        setShopStatus(shopStatusData || null);

        const typesEnriched = (Array.isArray(typesData) ? typesData : []).map(
          (t) => ({ ...t, translations: t.translations || {} }),
        );
        setTypes(typesEnriched);
        device.setTypes(typesEnriched);

        device.setSubtypes(
          (Array.isArray(subtypesData) ? subtypesData : []).map((s) => ({
            ...s,
            translations: s.translations || {},
          })),
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

      <div className={styles.pageInner}>
        <header className={styles.hero}>
          <div className={styles.heroMedia}>
            {heroImg ? (
              <img
                src={heroImg}
                alt="Shop hero"
                className={styles.heroImg}
                onError={(e) => (e.currentTarget.style.display = "none")}
              />
            ) : (
              <div className={styles.heroStub} />
            )}

            <div className={styles.heroOverlay} />

            <div className={styles.heroTitleWrap}>
              <div className={styles.heroSubtitle}>
                {t("average delivery time: 15–30 minutes", { ns: "homePage" })}
              </div>
            </div>
          </div>
        </header>

        <div className={styles.metaRow}>
          <span className={shopStatus?.isOpen ? styles.open : styles.closed}>
            {shopStatus?.isOpen ? "Открыто" : "Закрыто"}
          </span>

          <span className={styles.metaHours}>
            <span className={styles.dot}>• Работает с</span>
            {getTodayHoursText(shopStatus?.workHours)} •{" "}
            <span
              className={styles.moreLink}
              role="button"
              tabIndex={0}
              onClick={() => setShowInfo(true)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") setShowInfo(true);
              }}
            >
              больше…
            </span>
          </span>
        </div>

        <div className={styles.categoriesShell}>
          <div className={styles.categories}>
            {(isDesktop ? types.slice(0, 5) : types).map((type) => (
              <Link
                key={type.id}
                to={`/catalog?typeId=${type.id}&scroll=1`}
                className={styles.category}
                title={type.translations?.name?.[currentLang] || type.name}
              >
                <span className={styles.categoryLabel}>
                  {type.translations?.name?.[currentLang] || type.name}
                </span>
              </Link>
            ))}

            {isDesktop && types.length > 5 && (
              <div className={styles.dropdownContainer}>
                <button
                  type="button"
                  className={`${styles.category} ${styles.moreButton}`}
                  onClick={() => setShowAllTypes((v) => !v)}
                >
                  <span className={styles.categoryLabel}>Ещё</span>
                </button>

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
            )}
          </div>
        </div>
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

      {showInfo && (
        <SlideModal title="Больше" onClose={() => setShowInfo(false)}>
          <div className={styles.moreModalRoot}>
            <div className={styles.moreCard}>
              <h3 className={styles.moreTitle}>DlyQ Market</h3>

              <div className={styles.stackList}>
                <div className={styles.stackItem}>
                  <div className={styles.stackValue}>
                    DlyQ OÜ • Registrikood 17268052 • KMKR EE102873957
                  </div>
                </div>

                <div className={styles.stackItem}>
                  <div className={styles.stackLabel}>Email</div>
                  <div className={styles.stackValue}>
                    <a className={styles.linkPill} href="mailto:info@dlyq.ee">
                      info@dlyq.ee
                    </a>
                  </div>
                </div>
              </div>

              <div className={styles.stackSection}>
                <div className={styles.sectionTitle}>Время работы</div>
                <div className={styles.stackList}>
                  {formatWorkHours(shopStatus?.workHours).map((row) => (
                    <div key={row.label} className={styles.stackItem}>
                      <div className={styles.stackLabel}>{row.label}</div>
                      <div className={styles.stackValue}>{row.value}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </SlideModal>
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
