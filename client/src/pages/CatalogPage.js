import React, {
  useEffect,
  useContext,
  useRef,
  useState,
  useCallback,
  useMemo,
} from "react";
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
import SearchBar from "../components/SearchBar";
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
  const { t, i18n } = useTranslation();
  const currentLang = i18n.language || "en";

  const [searchParams, setSearchParams] = useSearchParams();
  const typeIdFromUrl = searchParams.get("typeId");
  const shouldScrollOnEnter = searchParams.get("scroll") === "1";

  const [selectedDeviceId, setSelectedDeviceId] = useState(null);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  const [showScrollTop, setShowScrollTop] = useState(false);

  const [feedTypeIndex, setFeedTypeIndex] = useState(0);
  const [typeCursors, setTypeCursors] = useState({});
  const [typeHasMore, setTypeHasMore] = useState({});

  const bottomRef = useRef(null);
  const mobileTypesRowRef = useRef(null);
  const swipeRef = useRef({ x: 0, y: 0 });
  const mobileFixedNavRef = useRef(null);

  const subtypesReqId = useRef(0);
  const subtypeAnchorRef = useRef(null);
  const [showStickySubtypes, setShowStickySubtypes] = useState(false);
  const ignoreNextIO = useRef(false);
  const [activeSubtypeId, setActiveSubtypeId] = useState(null);
  const programmaticSubtypeScrollRef = useRef(false);
  const programmaticSubtypeTimerRef = useRef(null);
  const didAutoScrollRef = useRef(false);

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

  const selectedTypeLabel = useMemo(() => {
    return (
      device.selectedType?.translations?.name?.[currentLang] ||
      device.selectedType?.name ||
      ""
    );
  }, [device.selectedType, currentLang]);

  const isAutoType = useMemo(() => {
    return /авто/i.test(selectedTypeLabel) || /auto/i.test(selectedTypeLabel);
  }, [selectedTypeLabel]);

  const getCompatMode = useCallback(() => {
    return device.selectedMake?.id || device.selectedModel?.id
      ? "strict"
      : undefined;
  }, [device.selectedMake?.id, device.selectedModel?.id]);

  const ensureTypeVisible = useCallback((id, behavior = "auto") => {
    const row = mobileTypesRowRef.current;
    if (!row || !id) return;

    const pill = row.querySelector(`[data-type-pill="${id}"]`);
    if (!pill) return;

    const targetLeft =
      pill.offsetLeft - (row.clientWidth / 2 - pill.clientWidth / 2);

    const maxLeft = row.scrollWidth - row.clientWidth;
    const clamped = Math.max(0, Math.min(targetLeft, maxLeft));

    row.scrollTo({ left: clamped, behavior });
  }, []);

  const scrollToSubtypeSection = useCallback(
    (subtypeId) => {
      if (!subtypeId) return;

      const fixed = mobileFixedNavRef.current;
      const offset = fixed ? fixed.offsetHeight + 10 : 10;

      if (device.selectedModel?.id) {
        const make =
          device.selectedMake?.name ||
          device.selectedMake?.translations?.name?.[currentLang] ||
          "";
        const model =
          device.selectedModel?.name ||
          device.selectedModel?.translations?.name?.[currentLang] ||
          "";

        const safeId = (s) => String(s).replace(/[^a-zA-Z0-9_-]/g, "_");
        const mmId = `mm-${safeId(make)}-${safeId(model)}-${subtypeId}`;

        const mmEl = document.getElementById(mmId);
        if (mmEl) {
          const y = mmEl.getBoundingClientRect().top + window.scrollY - offset;
          window.scrollTo({ top: y, behavior: "smooth" });
          return;
        }
      }

      const el = document.getElementById(`subtype-${subtypeId}`);
      if (!el) return;
      const y = el.getBoundingClientRect().top + window.scrollY - offset;
      window.scrollTo({ top: y, behavior: "smooth" });
    },
    [
      device.selectedModel?.id,
      device.selectedMake,
      device.selectedModel,
      currentLang,
    ],
  );

  const onPickSubtype = useCallback(
    (subtypeId) => {
      if (!subtypeId) return;

      setActiveSubtypeId(String(subtypeId));

      programmaticSubtypeScrollRef.current = true;
      if (programmaticSubtypeTimerRef.current) {
        clearTimeout(programmaticSubtypeTimerRef.current);
      }

      scrollToSubtypeSection(subtypeId);

      programmaticSubtypeTimerRef.current = setTimeout(() => {
        programmaticSubtypeScrollRef.current = false;
      }, 700);
    },
    [scrollToSubtypeSection],
  );

  useEffect(() => {
    if (!isMobile) return;
    if (!device.selectedType?.id) return;

    const mql = window.matchMedia("(max-width: 768px)");

    const getTopOffset = () => {
      const fixed = mobileFixedNavRef.current;
      const h = fixed ? fixed.offsetHeight : 0;
      return (mql.matches ? h : 0) + 10;
    };

    const extractSubtypeIdFromElId = (id) => {
      if (!id) return null;

      if (id.startsWith("subtype-")) return id.replace("subtype-", "");

      if (id.startsWith("mm-")) {
        const last = id.split("-").pop();
        if (!last) return null;
        return /^\d+$/.test(last) ? last : null;
      }

      return null;
    };

    let raf = 0;

    const updateActive = () => {
      if (programmaticSubtypeScrollRef.current) return;

      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const offset = getTopOffset();

        const elements = Array.from(
          document.querySelectorAll('[id^="subtype-"], [id^="mm-"]'),
        ).sort(
          (a, b) =>
            a.getBoundingClientRect().top - b.getBoundingClientRect().top,
        );

        if (!elements.length) return;

        let current = elements[0];
        for (const el of elements) {
          const top = el.getBoundingClientRect().top;
          if (top - offset <= 2) current = el;
          else break;
        }

        const sid = extractSubtypeIdFromElId(current.id);
        if (sid) setActiveSubtypeId(String(sid));
      });
    };

    window.addEventListener("scroll", updateActive, { passive: true });
    window.addEventListener("resize", updateActive);
    if (mql.addEventListener) mql.addEventListener("change", updateActive);
    else mql.addListener(updateActive);

    updateActive();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", updateActive);
      window.removeEventListener("resize", updateActive);
      if (mql.removeEventListener)
        mql.removeEventListener("change", updateActive);
      else mql.removeListener(updateActive);
    };
  }, [isMobile, device.selectedType?.id]);

  useEffect(() => {
    setActiveSubtypeId(null);
  }, [device.selectedType?.id]);

  const resetDevicesFeed = useCallback(() => {
    device.setDevices?.([]);
    device.setCursor?.(null);
    device.setHasMore?.(true);
  }, [device]);

  const setType = useCallback(
    (id, { scrollTop = true } = {}) => {
      const currentId = Number(device.selectedType?.id || 0);
      const nextId = Number(id || 0);

      if (currentId && currentId === nextId) {
        requestAnimationFrame(() => ensureTypeVisible(nextId, "auto"));
        return;
      }

      const next = new URLSearchParams(searchParams);
      next.set("typeId", String(nextId));
      next.delete("scroll");
      setSearchParams(next);

      device.clearSelectedSubType?.();
      device.setSelectedMake?.({});
      device.setSelectedModel?.({});

      const found = device.types?.find((t) => Number(t.id) === nextId);
      if (found) device.setSelectedType(found);

      resetDevicesFeed();

      if (scrollTop) window.scrollTo({ top: 0, behavior: "auto" });
      requestAnimationFrame(() => ensureTypeVisible(nextId, "auto"));
    },
    [
      searchParams,
      setSearchParams,
      device,
      ensureTypeVisible,
      resetDevicesFeed,
    ],
  );

  const onTouchStart = useCallback((e) => {
    const t = e.touches?.[0];
    if (!t) return;
    swipeRef.current = { x: t.clientX, y: t.clientY };
  }, []);

  const onTouchEnd = useCallback(
    (e) => {
      const t = e.changedTouches?.[0];
      if (!t) return;

      const dx = t.clientX - swipeRef.current.x;
      const dy = t.clientY - swipeRef.current.y;

      if (Math.abs(dx) < 60) return;
      if (Math.abs(dx) < Math.abs(dy) * 1.2) return;

      const ids = orderedTypeIds;
      if (!ids.length) return;

      const curId = Number(device.selectedType?.id);
      const idx = ids.indexOf(curId);
      if (idx === -1) return;

      const nextIdx = dx < 0 ? idx + 1 : idx - 1;
      const clamped = Math.max(0, Math.min(nextIdx, ids.length - 1));
      if (clamped === idx) return;

      setType(ids[clamped], { scrollTop: false });
    },
    [orderedTypeIds, device.selectedType?.id, setType],
  );

  useEffect(() => {
    return () => {
      if (programmaticSubtypeTimerRef.current) {
        clearTimeout(programmaticSubtypeTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    const handleScroll = () => setShowScrollTop(window.scrollY > 300);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const [typesData, subtypesData, brandsData, makesData] =
          await Promise.all([
            fetchTypes(),
            fetchSubtypes(),
            fetchBrands(),
            fetchMakes(),
          ]);

        if (cancelled) return;

        device.setTypes(
          (typesData || []).map((type) => ({
            ...type,
            translations: type.translations || {},
          })),
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
            }),
        );

        device.setBrands(brandsData || []);
        device.setMakes(makesData || []);
      } catch (error) {
        console.error("Error loading initial data:", error);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [device]);

  useEffect(() => {
    const id = Number(typeIdFromUrl);
    if (!id) return;

    const found = (device.types || []).find((t) => Number(t.id) === id);
    const cur = Number(device.selectedType?.id || 0);

    if (found && cur !== id) {
      device.setSelectedType(found);
      resetDevicesFeed();
      requestAnimationFrame(() => ensureTypeVisible(id, "auto"));
    }
  }, [typeIdFromUrl, device.types, resetDevicesFeed, ensureTypeVisible]);

  useEffect(() => {
    if (isMobile) return;

    const id = Number(device.selectedType?.id) || 0;
    const urlId = Number(typeIdFromUrl) || 0;

    if (id && id !== urlId) {
      const next = new URLSearchParams(searchParams);
      next.set("typeId", String(id));
      next.delete("scroll");
      setSearchParams(next);
    }

    if (!id && urlId) {
      const next = new URLSearchParams(searchParams);
      next.delete("typeId");
      next.delete("scroll");
      setSearchParams(next);
    }
  }, [
    isMobile,
    device.selectedType?.id,
    typeIdFromUrl,
    searchParams,
    setSearchParams,
  ]);

  useEffect(() => {
    if (!isMobile) return;
    const id = device.selectedType?.id;
    if (!id) return;
    requestAnimationFrame(() => ensureTypeVisible(id, "auto"));
  }, [isMobile, device.selectedType?.id, ensureTypeVisible]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      if (!device.selectedType?.id) return;

      try {
        const modelId = device.selectedModel?.id ?? undefined;
        const makeId = !modelId
          ? (device.selectedMake?.id ?? undefined)
          : undefined;

        const data = await fetchFilter(
          device.selectedType.id,
          undefined,
          device.selectedBrand?.id ?? undefined,
          1,
          1,
          makeId,
          modelId,
        );

        if (cancelled) return;

        device.setFacets({
          subtypes: data?.facets?.subtypes ?? [],
          brands: data?.facets?.brands ?? [],
          mmSubtypeIdsAll: data?.facets?.mmSubtypeIdsAll ?? [],
          mmOnlySubtypeIds: data?.facets?.mmOnlySubtypeIds ?? [],
          universalSubtypeIds: data?.facets?.universalSubtypeIds ?? [],
        });
      } catch (e) {
        if (!cancelled) console.error("facets load error", e);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    device.selectedType?.id,
    device.selectedBrand?.id,
    device.selectedMake?.id,
    device.selectedModel?.id,
    device,
  ]);

  useEffect(() => {
    const reqId = ++subtypesReqId.current;
    device.setLoading?.("subtypes", true);

    (async () => {
      try {
        const subtypesData = device.selectedType?.id
          ? await fetchSubtypesByType(device.selectedType.id)
          : await fetchSubtypes();

        if (reqId !== subtypesReqId.current) return;

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
            }),
        );
      } catch (err) {
        if (reqId === subtypesReqId.current) {
          console.error("Error loading subtypes:", err);
        }
      } finally {
        if (reqId === subtypesReqId.current)
          device.setLoading?.("subtypes", false);
      }
    })();
  }, [device.selectedType?.id, currentLang, device]);

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
        console.error("Error loading models:", e);
      }
    };
    loadModels();
  }, [device.selectedMake?.id, device]);

  useEffect(() => {
    setFeedTypeIndex(0);
    setTypeCursors({});
    setTypeHasMore({});
  }, [
    device.selectedType?.id,
    device.selectedSubType?.id,
    device.selectedBrand?.id,
    device.selectedMake?.id,
    device.selectedModel?.id,
    device.sort,
    currentLang,
  ]);

  useEffect(() => {
    if (isMobile) return;
    resetDevicesFeed();
  }, [
    isMobile,
    device.selectedType?.id,
    device.selectedSubType?.id,
    device.selectedBrand?.id,
    device.selectedMake?.id,
    device.selectedModel?.id,
    device.sort,
    currentLang,
    resetDevicesFeed,
  ]);

  useEffect(() => {
    if (!isMobile) return;
    resetDevicesFeed();
  }, [
    isMobile,
    device.selectedType?.id,
    device.sort,
    currentLang,
    resetDevicesFeed,
  ]);

  const loadMore = useCallback(async () => {
    if (device.loading?.devices || !device.hasMore) return;

    if (device.selectedType?.id) {
      device.setLoading?.("devices", true);
      try {
        const mobile = isMobile;

        const compatMode = mobile ? undefined : getCompatMode();
        const modelId = mobile
          ? undefined
          : (device.selectedModel?.id ?? undefined);
        const makeId = mobile
          ? undefined
          : modelId
            ? undefined
            : (device.selectedMake?.id ?? undefined);

        const subtypeId = mobile
          ? undefined
          : (device.selectedSubType?.id ?? undefined);

        const data = await fetchCatalogCursor({
          typeId: device.selectedType?.id ?? undefined,
          subtypeId,
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

        device.appendDevices?.(data.items || []);
        device.setCursor?.(data.nextCursor);
        device.setHasMore?.(!!data.hasMore);
      } catch (e) {
        console.error("cursor load error", e);
        device.setHasMore?.(false);
      } finally {
        device.setLoading?.("devices", false);
      }
      return;
    }

    if (!orderedTypeIds.length) return;

    const typeIds = orderedTypeIds.slice();
    let idx = feedTypeIndex;

    while (idx < typeIds.length) {
      const tid = typeIds[idx];

      if (typeHasMore[tid] === false) {
        idx++;
        continue;
      }

      device.setLoading?.("devices", true);
      try {
        const data = await fetchCatalogCursor({
          typeId: tid,
          subtypeId: device.selectedSubType?.id ?? undefined,
          brandId: device.selectedBrand?.id ?? undefined,
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

        device.appendDevices?.(items);

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
        console.error("cursor per-type load error", e);
        setTypeHasMore((prev) => ({ ...prev, [tid]: false }));
        idx++;
      } finally {
        device.setLoading?.("devices", false);
      }
    }

    device.setHasMore?.(false);
  }, [
    device,
    currentLang,
    orderedTypeIds,
    feedTypeIndex,
    typeCursors,
    typeHasMore,
    getCompatMode,
    isMobile,
  ]);

  useEffect(() => {
    if (
      device.devices?.length === 0 &&
      device.hasMore &&
      !device.loading?.devices
    ) {
      loadMore();
    }
  }, [
    device.devices?.length,
    device.hasMore,
    device.loading?.devices,
    loadMore,
  ]);

  useEffect(() => {
    const el = bottomRef.current;
    if (!el) return;

    const io = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (entry.isIntersecting) loadMore();
      },
      { rootMargin: "600px 0px" },
    );

    io.observe(el);
    return () => io.disconnect();
  }, [loadMore]);

  useEffect(() => {
    const onOpenDevice = (e) => {
      const id = e?.detail?.id;
      if (id) setSelectedDeviceId(id);
    };
    window.addEventListener("openDeviceModal", onOpenDevice);
    return () => window.removeEventListener("openDeviceModal", onOpenDevice);
  }, []);

  const scrollToTop = () => window.scrollTo({ top: 0, behavior: "smooth" });

  useEffect(() => {
    didAutoScrollRef.current = false;
  }, [typeIdFromUrl, shouldScrollOnEnter]);

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

        if (top > TRIGGER_PX) setShowStickySubtypes(false);
        else setShowStickySubtypes(true);
      },
      { threshold: 0 },
    );

    io.observe(el);
    return () => io.disconnect();
  }, [device.selectedType?.id]);

  useEffect(() => {
    if (!shouldScrollOnEnter) return;

    const id = Number(typeIdFromUrl);
    if (!id) return;
    if (device.selectedType?.id !== id) return;
    if (didAutoScrollRef.current) return;

    didAutoScrollRef.current = true;

    const targetId = isAutoType ? "make-filter" : "subtype-filter";

    let tries = 0;
    const run = () => {
      const el = document.getElementById(targetId);

      if (!el && tries < 20) {
        tries++;
        requestAnimationFrame(run);
        return;
      }
      if (!el) return;

      const fixed = document.querySelector(
        ".mobileFixedNav, .mobileStickyFilter",
      );
      const offset = fixed ? fixed.offsetHeight + 10 : 10;

      const y = el.getBoundingClientRect().top + window.scrollY - offset;

      window.scrollTo({ top: y, behavior: "smooth" });
      window.dispatchEvent(new CustomEvent("catalog:reached-subtype"));
    };

    requestAnimationFrame(run);
  }, [shouldScrollOnEnter, typeIdFromUrl, device.selectedType?.id, isAutoType]);

  useEffect(() => {
    if (!isMobile) return;
    if (!device.selectedType?.id) return;
    if (device.selectedSubType?.id) device.setSelectedSubType?.({});
  }, [isMobile, device.selectedType?.id, device.selectedSubType?.id]);

  if (isMobile && !typeIdFromUrl) {
    return (
      <div className={catalogStyles.catalogWrapper}>
        <div className={catalogStyles.catalogContent}>
          <div className={catalogStyles.catalogSearch}>
            <SearchBar />
          </div>
          <p className={catalogStyles.catalogTitle}>
            {t("product Catalog", { ns: "deviceList" })}
          </p>

          <div className={catalogStyles.mobileTypesGrid}>
            {(device.types || []).map((type) => {
              const label =
                type.translations?.name?.[currentLang] || type.name || "";

              return (
                <button
                  key={type.id}
                  type="button"
                  className={catalogStyles.mobileTypeCard}
                  onClick={() => setType(type.id, { scrollTop: true })}
                >
                  <div className={catalogStyles.typeCardImgWrap}>
                    <img
                      src={type.img}
                      alt=""
                      className={catalogStyles.typeCardImg}
                    />
                  </div>
                  <div className={catalogStyles.typeCardLabel}>{label}</div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={catalogStyles.catalogWrapper}>
      <div className={catalogStyles.catalogContent}>
        <p className={catalogStyles.catalogTitle}>
          {t("product Catalog", { ns: "deviceList" })}
        </p>

        {!isMobile && (
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
        )}

        {isMobile && device.selectedType?.id ? (
          <div
            ref={mobileFixedNavRef}
            className={catalogStyles.mobileFixedNav}
            style={{ top: "env(safe-area-inset-top)" }}
          >
            <div
              className={catalogStyles.mobileTypesRow}
              ref={mobileTypesRowRef}
            >
              {(device.types || []).map((type) => {
                const isActive = type.id === device.selectedType?.id;
                const label =
                  type.translations?.name?.[currentLang] || type.name || "";

                return (
                  <button
                    key={type.id}
                    data-type-pill={type.id}
                    type="button"
                    className={
                      isActive
                        ? catalogStyles.typePillActive
                        : catalogStyles.typePill
                    }
                    onClick={() => setType(type.id, { scrollTop: false })}
                  >
                    <span className={catalogStyles.typePillText}>{label}</span>
                  </button>
                );
              })}
            </div>

            <div className={catalogStyles.mobileFixedSubRow}>
              {isAutoType ? (
                <>
                  <div className={catalogStyles.mobileFilterRow}>
                    <SubTypeBar
                      variant="universal"
                      onPick={onPickSubtype}
                      activeId={activeSubtypeId}
                    />
                  </div>

                  <div
                    id="make-filter"
                    className={catalogStyles.mobileFilterRow}
                  >
                    <MakeBar />
                  </div>

                  <div className={catalogStyles.mobileFilterRow}>
                    <ModelBar />
                  </div>

                  {device.selectedModel?.id ? (
                    <div className={catalogStyles.mobileFilterRow}>
                      <SubTypeBar
                        onPick={onPickSubtype}
                        activeId={activeSubtypeId}
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
                  <SubTypeBar
                    onPick={onPickSubtype}
                    activeId={activeSubtypeId}
                  />
                </div>
              )}
            </div>
          </div>
        ) : null}

        <div
          className={`${catalogStyles.deviceContainer} ${
            isMobile && device.selectedType?.id
              ? catalogStyles.withFixedNav
              : ""
          }`}
          onTouchStart={isMobile ? onTouchStart : undefined}
          onTouchEnd={isMobile ? onTouchEnd : undefined}
          style={{ opacity: device.loading?.devices ? 0.3 : 1 }}
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
