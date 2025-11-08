import React, { useEffect, useContext, useRef, useState } from "react";
import { observer } from "mobx-react-lite";
import { Context } from "../index";
import { useSearchParams } from "react-router-dom";
import TypeBar from "../components/TypeBar";
import BrandBar from "../components/BrandBar";
import SubTypeBar from "../components/SubTypeBar";
import DeviceList from "../components/DeviceList";
import DevicePage from "../pages/DevicePage";
import SlideModal from "../components/modals/SlideModal";
import MakeBar from "../components/MakeBar";
import ModelBar from "../components/ModelBar";
import {
  fetchBrands,
  fetchTypes,
  fetchSubtypes,
  fetchSubtypesByType,
  fetchMakes,
  fetchModelsByMake,
  fetchCatalogCursor,
  fetchFilter,
} from "../http/deviceAPI";
import { useTranslation } from "react-i18next";
import catalogStyles from "./CatalogPage.module.css";

const CatalogPage = observer(() => {
  const { device } = useContext(Context);
  const [selectedDeviceId, setSelectedDeviceId] = useState(null);
  const subtypeAnchorRef = useRef(null);
  const [showStickySubtypes, setShowStickySubtypes] = useState(false);
  const ignoreNextIO = useRef(false);
  const [navbarHeight, setNavbarHeight] = useState(60);
  const [isNavbarVisible, setIsNavbarVisible] = useState(true);
  const lastScrollY = useRef(0);
  const { t, i18n } = useTranslation();
  const [searchParams] = useSearchParams();
  const typeIdFromUrl = searchParams.get("typeId");
  const currentLang = i18n.language || "en";

  const subtypesReqId = useRef(0);
  const bottomRef = useRef(null);
  const [showScrollTop, setShowScrollTop] = useState(false);

  const isAutoType =
    !!device.selectedType?.name && /авто/i.test(device.selectedType.name);

  const getCompatMode = () =>
    device.selectedMake?.id || device.selectedModel?.id ? "strict" : undefined;

  const stickyTop = isNavbarVisible ? navbarHeight : 0;

  useEffect(() => {
    const loadInitialData = async () => {
      try {
        const [typesData, subtypesData, brandsData, makesData] =
          await Promise.all([
            fetchTypes(),
            fetchSubtypes(),
            fetchBrands(),
            fetchMakes(),
          ]);

        device.setTypes(
          (typesData || []).map((type) => ({
            ...type,
            translations: type.translations || {},
          }))
        );

        device.setSubtypes(
          (subtypesData || [])
            .map((subtype) => ({
              ...subtype,
              translations: subtype.translations || {},
            }))
            .sort((a, b) => {
              const ao = Number(a.displayOrder ?? 0);
              const bo = Number(b.displayOrder ?? 0);
              return ao === bo ? a.id - b.id : ao - bo;
            })
        );

        device.setBrands(brandsData || []);
        device.setMakes(makesData || []);
      } catch (error) {
        console.error("Ошибка загрузки начальных данных:", error);
      }
    };

    loadInitialData();
  }, [currentLang, typeIdFromUrl, device]);

  useEffect(() => {
    const id = Number(typeIdFromUrl);
    if (!id) {
      device.setSelectedType({});
      return;
    }
    const found = device.types?.find((t) => t.id === id);
    if (found && device.selectedType?.id !== id) {
      device.setSelectedType(found);
    }
  }, [typeIdFromUrl, device.types, device]);

  useEffect(() => {
    return () => {
      device.setSelectedType({});
      device.setSelectedSubType({});
      device.setSelectedMake({});
      device.setSelectedModel({});
      device.setSelectedBrand({});
      device.resetFeed?.();
    };
  }, [device]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!device.hasMore || device.loading.devices) return;
      device.setLoading("devices", true);
      try {
        const compatMode = getCompatMode();
        const modelId = device.selectedModel?.id ?? undefined;
        const makeId = modelId
          ? undefined
          : device.selectedMake?.id ?? undefined;
        const data = await fetchCatalogCursor({
          typeId: device.selectedType?.id ?? undefined,
          subtypeId: device.selectedSubType?.id ?? undefined,
          brandId: device.selectedBrand?.id ?? undefined,
          makeId,
          modelId,
          compatMode,
          cursor: device.cursor ?? undefined,
          sort: device.sort,
          limit: device.limit,
          onlyVisible: true,
          lang: currentLang,
        });
        if (cancelled) return;
        device.appendDevices(data.items || []);
        device.setCursor(data.nextCursor);
        device.setHasMore(!!data.hasMore);
      } catch (e) {
        if (!cancelled) console.error("cursor load error", e);
        device.setHasMore(false);
      } finally {
        device.setLoading("devices", false);
      }
    };
    if (device.devices.length === 0) load();
    return () => {
      cancelled = true;
    };
  }, [
    device.selectedType?.id,
    device.selectedSubType?.id,
    device.selectedBrand?.id,
    device.selectedMake?.id,
    device.selectedModel?.id,
    device.sort,
    currentLang,
    device,
  ]);

  useEffect(() => {
    const el = bottomRef.current;
    if (!el) return;

    const io = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (entry.isIntersecting && device.hasMore && !device.loading.devices) {
          (async () => {
            try {
              device.setLoading("devices", true);

              const compatMode = getCompatMode();
              const modelId = device.selectedModel?.id ?? undefined;
              const makeId = modelId
                ? undefined
                : device.selectedMake?.id ?? undefined;

              const data = await fetchCatalogCursor({
                typeId: device.selectedType?.id ?? undefined,
                subtypeId: device.selectedSubType?.id ?? undefined,
                brandId: device.selectedBrand?.id ?? undefined,
                makeId,
                modelId,
                compatMode,
                cursor: device.cursor ?? undefined,
                sort: device.sort,
                limit: device.limit,
                onlyVisible: true,
                lang: currentLang,
              });

              device.appendDevices(data.items || []);
              device.setCursor(data.nextCursor);
              device.setHasMore(!!data.hasMore);
            } catch (e) {
              console.error("cursor load error", e);
              device.setHasMore(false);
            } finally {
              device.setLoading("devices", false);
            }
          })();
        }
      },
      { rootMargin: "600px 0px" }
    );

    io.observe(el);
    return () => io.disconnect();
  }, [
    bottomRef,
    device.hasMore,
    device.cursor,
    device.loading.devices,
    device.selectedType?.id,
    device.selectedSubType?.id,
    device.selectedBrand?.id,
    device.selectedMake?.id,
    device.selectedModel?.id,
    device.sort,
    currentLang,
    device,
  ]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!device.selectedType?.id) return;

      try {
        const data = await fetchFilter(
          device.selectedType.id,
          undefined,
          undefined,
          1,
          1
        );
        if (!cancelled) {
          device.setFacets({
            subtypes: data?.facets?.subtypes ?? [],
            brands: data?.facets?.brands ?? [],
            mmSubtypeIdsAll: data?.facets?.mmSubtypeIdsAll ?? [],
            mmOnlySubtypeIds: data?.facets?.mmOnlySubtypeIds ?? [],
            universalSubtypeIds: data?.facets?.universalSubtypeIds ?? [],
          });
        }
      } catch (e) {
        if (!cancelled) console.error("facets load error", e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [device.selectedType?.id, device]);

  useEffect(() => {
    const loadModels = async () => {
      try {
        if (device.selectedMake?.id) {
          const models = await fetchModelsByMake(device.selectedMake.id);
          device.setModels(models || []);
        } else {
          device.setModels([]);
        }
      } catch (e) {
        console.error("Ошибка загрузки моделей:", e);
      }
    };
    loadModels();
  }, [device.selectedMake?.id, device]);

  useEffect(() => {
    const id = ++subtypesReqId.current;
    device.setLoading("subtypes", true);
    device.setSubtypes([]);
    const loadSubtypes = async () => {
      try {
        const subtypesData = device.selectedType?.id
          ? await fetchSubtypesByType(device.selectedType.id)
          : await fetchSubtypes();
        if (id !== subtypesReqId.current) return;
        device.setSubtypes(
          (subtypesData || [])
            .map((subtype) => ({
              ...subtype,
              translations: subtype.translations || {},
            }))
            .sort((a, b) => {
              const ao = Number(a.displayOrder ?? 0);
              const bo = Number(b.displayOrder ?? 0);
              return ao === bo ? a.id - b.id : ao - bo;
            })
        );
      } catch (err) {
        if (id === subtypesReqId.current) {
          console.error("Ошибка при загрузке подтипов:", err);
        }
      } finally {
        if (id === subtypesReqId.current) device.setLoading("subtypes", false);
      }
    };
    loadSubtypes();
  }, [device.selectedType?.id, currentLang, device]);

  useEffect(() => {
    const handler = () => {
      ignoreNextIO.current = true;
      setShowStickySubtypes(true);
    };
    window.addEventListener("catalog:reached-subtype", handler);
    return () => window.removeEventListener("catalog:reached-subtype", handler);
  }, []);

  useEffect(() => {
    if (!device.selectedType?.id) {
      setShowStickySubtypes(false);
      return;
    }

    const el = subtypeAnchorRef.current;
    if (!el) return;

    const TRIGGER_PX = 10;

    const io = new IntersectionObserver(
      ([entry]) => {
        const top = entry.boundingClientRect.top;

        if (ignoreNextIO.current) {
          ignoreNextIO.current = false;
          return;
        }
        if (top > TRIGGER_PX) {
          setShowStickySubtypes(false);
        } else {
          setShowStickySubtypes(true);
        }
      },
      { threshold: 0 }
    );

    io.observe(el);
    return () => io.disconnect();
  }, [device.selectedType?.id]);

  useEffect(() => {
    const handleScroll = () => setShowScrollTop(window.scrollY > 300);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    const nav = document.querySelector(".NavBar");
    if (nav) {
      setNavbarHeight(nav.offsetHeight || 60);
    }

    lastScrollY.current = window.pageYOffset;

    const onScroll = () => {
      const current = window.pageYOffset;

      const goingUp = current < lastScrollY.current;

      setIsNavbarVisible(goingUp || current < 5);

      lastScrollY.current = current;
    };

    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const onOpenDevice = (e) => {
      const id = e?.detail?.id;
      if (id) setSelectedDeviceId(id);
    };
    window.addEventListener("openDeviceModal", onOpenDevice);
    window.__hasOpenDeviceModalListener = true;
    return () => {
      window.removeEventListener("openDeviceModal", onOpenDevice);
      window.__hasOpenDeviceModalListener = false;
    };
  }, []);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className={catalogStyles.catalogWrapper}>
      <div className={catalogStyles.catalogContent}>
        <p className={catalogStyles.catalogTitle}>
          {t("product Catalog", { ns: "deviceList" })}
        </p>

        <div className={catalogStyles.filters}>
          <div className={catalogStyles.brandFilter}>
            <BrandBar />
          </div>

          <div className={catalogStyles.typeFilter}>
            <TypeBar />
          </div>

          {isAutoType ? (
            <div
              className={showStickySubtypes ? catalogStyles.hideOnSticky : ""}
            >
              <div className={catalogStyles.subtypeFilter}>
                <SubTypeBar variant="universal" />
              </div>
              <div id="make-filter" className={catalogStyles.makeFilter}>
                <MakeBar />
              </div>
              <div className={catalogStyles.modelFilter}>
                <ModelBar />
              </div>
              <div className={catalogStyles.subtypeFilter}>
                {device.selectedModel?.id ? (
                  <SubTypeBar
                    key={`mm-${device.selectedType?.id}-${
                      device.selectedMake?.id ?? "no-make"
                    }-${device.selectedModel.id}`}
                    variant="mm"
                  />
                ) : null}
              </div>
            </div>
          ) : (
            <div className={catalogStyles.subtypeFilter}>
              {device.selectedType?.id ? <SubTypeBar /> : null}
            </div>
          )}

          <div
            id="subtype-filter"
            ref={subtypeAnchorRef}
            className={catalogStyles.subtypeAnchor}
          />
        </div>

        <div
          className={
            device.selectedType?.id
              ? `${catalogStyles.mobileStickyFilter} ${
                  showStickySubtypes ? catalogStyles.stickyVisible : ""
                }`
              : catalogStyles.mobileStickyFilter
          }
          style={{ top: stickyTop }}
        >
          {device.selectedType?.id ? (
            <>
              <div className={catalogStyles.mobileTypesRow}>
                {device.types.map((type) => {
                  const isActive = type.id === device.selectedType?.id;
                  const label =
                    type.translations?.name?.[currentLang] || type.name || "";
                  return (
                    <button
                      key={type.id}
                      type="button"
                      className={
                        isActive
                          ? catalogStyles.mobileTypePill
                          : catalogStyles.mobileTypePillInactive
                      }
                      onClick={() => {
                        if (device.selectedType?.id === type.id) return;

                        device.clearSelectedSubType?.();
                        device.setSelectedType(type);

                        setTimeout(() => {
                          const isAuto = /авто/i.test(label);
                          const targetId = isAuto
                            ? "make-filter"
                            : "subtype-filter";
                          const el = document.getElementById(targetId);
                          if (!el) return;

                          const fixed = document.querySelector(
                            ".mobileStickyFilter"
                          );
                          const offset = fixed ? fixed.offsetHeight + 10 : 10;
                          const y =
                            el.getBoundingClientRect().top +
                            window.scrollY -
                            offset;

                          window.scrollTo({ top: y, behavior: "smooth" });
                          window.dispatchEvent(
                            new CustomEvent("catalog:reached-subtype")
                          );
                        }, 50);
                      }}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>

              {isAutoType ? (
                <>
                  <div className={catalogStyles.mobileFilterRow}>
                    <SubTypeBar variant="universal" />
                  </div>

                  <div className={catalogStyles.mobileFilterRow}>
                    <MakeBar />
                  </div>

                  <div className={catalogStyles.mobileFilterRow}>
                    <ModelBar />
                  </div>

                  {device.selectedModel?.id ? (
                    <div className={catalogStyles.mobileFilterRow}>
                      <SubTypeBar
                        key={`mm-${device.selectedType?.id}-${
                          device.selectedMake?.id ?? "no-make"
                        }-${device.selectedModel.id}`}
                        variant="mm"
                      />
                    </div>
                  ) : null}
                </>
              ) : (
                <div className={catalogStyles.mobileFilterRow}>
                  <SubTypeBar />
                </div>
              )}
            </>
          ) : null}
        </div>

        <div
          className={`${catalogStyles.deviceContainer} ${
            showStickySubtypes
              ? isAutoType
                ? catalogStyles.withStickyAuto
                : catalogStyles.withSticky
              : ""
          }`}
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
            <DevicePage id={selectedDeviceId} />
          </SlideModal>
        )}
      </div>

      {device.isLoadingAnything && (
        <div className={catalogStyles.loadingOverlay}>
          {t("loading", { ns: "homePage" })}
        </div>
      )}
    </div>
  );
});

export default CatalogPage;
