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
    return () => {
      device.setSelectedBrand({});
    };
  }, []);

  useEffect(() => {
    const id = ++devicesReqId.current;
    device.setLoading("devices", true);

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

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
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

          {isAutoType && (
            <>
              <div id="make-filter" className={catalogStyles.makeFilter}>
                <MakeBar />
              </div>

              <div className={catalogStyles.modelFilter}>
                <ModelBar />
              </div>
            </>
          )}
          <div id="subtype-filter" className={catalogStyles.subtypeFilter}>
            {device.selectedType?.id ? (
              isAutoType ? (
                device.selectedModel?.id ? (
                  <SubTypeBar />
                ) : null
              ) : (
                <SubTypeBar />
              )
            ) : null}
          </div>
        </div>

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
            <DevicePage id={selectedDeviceId} />
          </SlideModal>
        )}
      </div>
    </div>
  );
});

export default CatalogPage;
