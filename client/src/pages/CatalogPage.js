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
  fetchFilter,
} from "../http/deviceAPI";
import { useTranslation } from "react-i18next";
import catalogStyles from "./CatalogPage.module.css";

const CatalogPage = observer(() => {
  const { device } = useContext(Context);
  const [selectedDeviceId, setSelectedDeviceId] = useState(null);
  const { t, i18n } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const typeIdFromUrl = searchParams.get("typeId");
  const currentLang = i18n.language || "en";
  const devicesReqId = useRef(0);
  const subtypesReqId = useRef(0);

  const [showScrollTop, setShowScrollTop] = useState(false);

  const isAutoType =
    !!device.selectedType?.name && /авто/i.test(device.selectedType.name);

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
          typesData.map((type) => ({
            ...type,
            translations: type.translations || {},
          }))
        );

        device.setSubtypes(
          subtypesData
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

        device.setBrands(brandsData);
        device.setMakes(makesData);
      } catch (error) {
        console.error("Ошибка загрузки начальных данных:", error);
      }
    };

    loadInitialData();
  }, [currentLang, typeIdFromUrl]);

   useEffect(() => {
  const id = Number(typeIdFromUrl);
  if (!id) {
    device.setSelectedType({});
    return;
  }
  const found = device.types?.find((t) => t.id === id);
  if (found && device.selectedType?.id !== id) {
    device.setSelectedType(found);
    device.setPage(1);
  }
}, [typeIdFromUrl, device.types]);

  useEffect(() => {
    return () => {
      device.setSelectedType({});
      device.setSelectedSubType({});
      device.setSelectedMake({});
      device.setSelectedModel({});
      device.setSelectedBrand({});
      device.setPage(1);
    };
  }, []);

  useEffect(() => {
    const id = ++devicesReqId.current;
    device.setLoading("devices", true);

    device.setDevices([]);
device.setTotalCount(0);
device.setFacets({ subtypes: [], brands: [] });

    const load = async () => {
      try {
        const data = await fetchFilter(
          device.selectedType?.id || null,
          device.selectedSubType?.id ?? null,
          device.selectedBrand?.id || null,
          device.page,
          device.limit,
          device.selectedMake?.id || null,
          device.selectedModel?.id || null
        );
        if (id !== devicesReqId.current) return;
        device.setDevices(data.rows);
        device.setTotalCount(data.count);
        device.setFacets?.(data.facets);
      } catch (e) {
        if (id === devicesReqId.current) {
          console.error("Ошибка загрузки девайсов:", e);
        }
      } finally {
        if (id === devicesReqId.current) device.setLoading("devices", false);
      }
    };
    load();
  }, [
    device.selectedType?.id,
    device.selectedSubType?.id,
    device.selectedBrand?.id,
    device.selectedMake?.id,
    device.selectedModel?.id,
    device.page,
    device.limit,
  ]);

  useEffect(() => {
    const loadModels = async () => {
      try {
        if (device.selectedMake?.id) {
          const models = await fetchModelsByMake(device.selectedMake.id);
          device.setModels(models);
        } else {
          device.setModels([]);
        }
      } catch (e) {
        console.error("Ошибка загрузки моделей:", e);
      }
    };
    loadModels();
  }, [device.selectedMake?.id]);

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
          subtypesData
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
  }, [device.selectedType?.id, currentLang]);

  useEffect(() => {
    const handleScroll = () => {
      setShowScrollTop(window.scrollY > 300);
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
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

    // Прокрутка к подтипам при выборе типа c учётом фикс-хедера
useEffect(() => {
  if (!device.selectedType?.id) return;

  const HEADER_OFFSET = 90; // подгони под высоту твоей шапки
  // Даем разметке обновиться (подтипы уже вставятся в DOM)
  const r = requestAnimationFrame(() => {
    const el = document.getElementById("subtype-filter");
    if (!el) return;
    const y = el.getBoundingClientRect().top + window.scrollY - HEADER_OFFSET;
    window.scrollTo({ top: y, behavior: "smooth" });
  });
  return () => cancelAnimationFrame(r);
}, [device.selectedType?.id]);

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

 return (
    <div className={styles.DevicePageContainer}>
      <div className={styles.DevicePageContent}>
        <div className={styles.DevicePageColImg}>
          <div className={styles.DevicePageImageWrapper}>
            {device.oldPrice && device.oldPrice > device.price && (
              <div className={styles.DevicePageDiscountBadge}>
                -
                {Math.round(
                  ((device.oldPrice - device.price) / device.oldPrice) * 100
                )}
                %
              </div>
            )}

            <div className={styles.ImageContainer}>
              <AnimatePresence mode="wait">
                {images.map(
                  (img, index) =>
                    index === activeIndex && (
                      <motion.img
                        key={`${img}-${index}`}
                        src={img}
                        alt={device.name}
                        className={styles.DevicePageMainImage}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        onLoad={() => appStore.stopLoading(false)}
                        onError={() => appStore.startLoading(false)}
                      />
                    )
                )}
              </AnimatePresence>
            </div>
            {images.length > 1 && (
              <div className={styles.ArrowButtons}>
                <button onClick={handlePrev} className={styles.PrevButton}>
                  ‹
                </button>
                <button onClick={handleNext} className={styles.NextButton}>
                  ›
                </button>
              </div>
            )}
          </div>
          {images.length > 1 && (
            <div className={styles.DevicePageThumbnailContainer}>
              {images.map((thumb, index) => (
                <img
                  key={index}
                  src={thumb}
                  className={`${styles.DevicePageThumbnail} ${
                    index === activeIndex ? styles.ActiveThumbnail : ""
                  }`}
                  onClick={() => setActiveIndex(index)}
                />
              ))}
            </div>
          )}
        </div>
        <div className={styles.DevicePageDetails}>
          <div className={styles.DevicePageCard}>
            <p className={styles.DevicePageTitle} lang={hyphenLang}>
              {device.translations?.["name"]?.[currentLang] || device.name}
            </p>

            {device.options?.length > 0 && (
              <div className={styles.DevicePageSelectedOptions}>
                {device.options?.map((option, optionIndex) => (
                  <div key={optionIndex} className={styles.DevicePageOption}>
                    <select
                      value={selectedOptions[option.name]?.value || ""}
                      onChange={(e) => {
                        const selectedValue = option.values.find(
                          (v) => v.value === e.target.value
                        );
                        handleOptionChange(option.name, selectedValue);
                      }}
                      className={styles.DevicePageSelect}
                    >
                      <option value="" disabled hidden>
                        {t("Select", { ns: "devicePage" })}:{" "}
                        {option.translations?.name?.[currentLang] ||
                          option.name}
                      </option>
                      {option.values.map((valueObj, valueIndex) => (
                        <option key={valueIndex} value={valueObj.value}>
                          {option.translations?.values?.[valueIndex]?.[
                            currentLang
                          ] || valueObj.value}
                          {valueObj.quantity <= 0
                            ? ` (${t("out of stock (Pre-order)", {
                                ns: "devicePage",
                              })})`
                            : ""}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            )}

            <hr className={styles.Separator} />
            <div className={styles.DevicePageBuyBlockDesktop}>
              {device.options?.map((option, optionIndex) => (
                <div key={optionIndex} className={styles.DevicePageOption}>
                  <label>
                    {option.translations?.name?.[currentLang] || option.name}
                  </label>

                  <select
                    value={selectedOptions[option.name]?.value || ""}
                    onChange={(e) => {
                      const selectedValue = option.values.find(
                        (v) => v.value === e.target.value
                      );
                      handleOptionChange(option.name, selectedValue);
                    }}
                    className={styles.DevicePageSelect}
                  >
                    <option value="" disabled hidden>
                      {t("Select", { ns: "devicePage" })}:{" "}
                      {option.translations?.name?.[currentLang] || option.name}
                    </option>
                    {option.values.map((valueObj, valueIndex) => (
                      <option key={valueIndex} value={valueObj.value}>
                        {option.translations?.values?.[valueIndex]?.[
                          currentLang
                        ] || valueObj.value}
                        {valueObj.quantity <= 0
                          ? ` (${t("out of stock (Pre-order)", {
                              ns: "devicePage",
                            })})`
                          : ""}
                      </option>
                    ))}
                  </select>
                </div>
              ))}

              <div className={styles.DevicePagePriceBlock}>
                {device.oldPrice &&
                Number(device.oldPrice) > Number(device.price) ? (
                  <>
                    <span className={styles.DevicePageOldPrice}>
                      {(
                        Number(device.oldPrice) +
                        (finalPrice - (Number(device.price) || 0))
                      ).toFixed(2)}{" "}
                      €
                    </span>
                    <span className={styles.DevicePageNewPrice}>
                      {finalPrice.toFixed(2)} €
                    </span>
                  </>
                ) : (
                  <span className={styles.DevicePageRegularPrice}>
                    {finalPrice.toFixed(2)} €
                  </span>
                )}
              </div>

              <button
                className={styles.DevicePageAddToCart}
                onClick={handleAddToBasket}
              >
                {availableQuantity <= 0
                  ? t("out_of_stock", { ns: "devicePage" })
                  : t("add_to_cart", { ns: "devicePage" })}
              </button>
            </div>

            <div className={styles.DevicePageInfoMobile} lang={hyphenLang}>
              <p>{t("product photos are provided", { ns: "devicePage" })}</p>
            </div>

            <hr className={styles.Separator} />

            <div className={styles.DevicePageSpecsMobile}>
              {(device.translations?.description?.[currentLang] ||
                device.description) && (
                <>
                  <p className={styles.DevicePageDescription}>
                    {device.translations?.description?.[currentLang] ||
                      device.description}
                  </p>
                  <hr className={styles.Separator} />
                </>
              )}

              <p className={styles.DevicePageSpecsTitle}>
                {t("description", { ns: "devicePage" })}
              </p>

              <div className={styles.DevicePageSpecsCard}>
                {device.info.map((info, index) => (
                  <div key={info.id} className={styles.DevicePageSpecRow}>
                    <span className={styles.DevicePageSpecText}>
                      <strong>
                        {info.translations?.title?.[currentLang] || info.title}
                      </strong>
                      <span>
                        {info.translations?.description?.[currentLang] ||
                          info.description}
                      </span>
                    </span>
                  </div>
                ))}
                {device.expiryDate && (
                  <div className={styles.DevicePageSpecRow}>
                    <span className={styles.DevicePageSpecText}>
                      <strong>
                        {device.expiryKind === "use_by"
                          ? t("use_by", { ns: "devicePage" })
                          : device.expiryKind === "best_before"
                          ? t("best_before", { ns: "devicePage" })
                          : t("expiry_date", { ns: "devicePage" })}
                      </strong>
                      <span>
                        {new Date(device.expiryDate).toLocaleDateString(
                          "ru-RU"
                        )}
                      </span>
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className={styles.DevicePageInfoDesktop}>
        <hr className={styles.Separator} />
        <p>{t("product photos are provided", { ns: "devicePage" })}</p>
        <hr className={styles.Separator} />
      </div>
      <div className={styles.DevicePageSpecsDesktop}>
        {(device.translations?.description?.[currentLang] ||
          device.description) && (
          <>
            <p className={styles.DevicePageDescription}>
              {device.translations?.description?.[currentLang] ||
                device.description}
            </p>
            <hr className={styles.Separator} />
          </>
        )}

        <p className={styles.DevicePageSpecsTitle}>
          {t("description", { ns: "devicePage" })}
        </p>

        <div className={styles.DevicePageSpecsCard}>
          {device.info.map((info, index) => (
            <div key={info.id} className={styles.DevicePageSpecRow}>
              <span className={styles.DevicePageSpecText}>
                <strong>
                  {info.translations?.title?.[currentLang] || info.title}
                </strong>
                <span>
                  {info.translations?.description?.[currentLang] ||
                    info.description}
                </span>
              </span>
            </div>
          ))}
          {device.expiryDate && (
            <div className={styles.DevicePageSpecRow}>
              <span className={styles.DevicePageSpecText}>
                <strong>
                  {device.expiryKind === "use_by"
                    ? t("use_by", { ns: "devicePage" })
                    : device.expiryKind === "best_before"
                    ? t("best_before", { ns: "devicePage" })
                    : t("expiry_date", { ns: "devicePage" })}
                </strong>
                <span>
                  {new Date(device.expiryDate).toLocaleDateString("ru-RU")}
                </span>
              </span>
            </div>
          )}
        </div>
      </div>
      <div className={styles.DevicePageBuyBlockMobile}>
        <button
          className={styles.DevicePageAddButtonCompact}
          onClick={handleAddToBasket}
        >
          <span className={styles.AddText}>
            {t("add_to_cart", { ns: "devicePage" })}
          </span>
          <span className={styles.AddPrice}>
            {device.oldPrice &&
            Number(device.oldPrice) > Number(device.price) ? (
              <>
                <span className={styles.Strike}>
                  {(
                    Number(device.oldPrice) +
                    (finalPrice - (Number(device.price) || 0))
                  ).toFixed(2)}{" "}
                  €
                </span>{" "}
                {finalPrice.toFixed(2)} €
              </>
            ) : (
              `${finalPrice.toFixed(2)} €`
            )}
          </span>
        </button>
      </div>
    </div>
  );
};

export default DevicePage;

