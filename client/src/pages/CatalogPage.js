import React, { useEffect, useContext, useState } from "react";
import { observer } from "mobx-react-lite";
import { Context } from "../index";
import { useSearchParams } from "react-router-dom";
import TypeBar from "../components/TypeBar";
import BrandBar from "../components/BrandBar";
import SubTypeBar from "..//components/SubTypeBar";
import DeviceList from "../components/DeviceList";
import DevicePage from "../pages/DevicePage";
import SlideModal from "../components/modals/SlideModal";
import appStore from "../store/appStore";
import {
  fetchBrands,
  fetchDevices,
  fetchTypes,
  fetchSubtypes,
  fetchSubtypesByType,
} from "../http/deviceAPI";
import { useTranslation } from "react-i18next";
import catalogStyles from "./CatalogPage.module.css";

const CatalogPage = observer(() => {
  const { device } = useContext(Context);
   const [selectedDeviceId, setSelectedDeviceId] = useState(null);
  const { t, i18n } = useTranslation();
  const [searchParams] = useSearchParams();
  const typeIdFromUrl = searchParams.get("typeId");
  const currentLang = i18n.language || "en";

  const [showScrollTop, setShowScrollTop] = useState(false);

  useEffect(() => {
    const loadInitialData = async () => {
      try {
        const [typesData, subtypesData, brandsData] = await Promise.all([
          fetchTypes(),
          fetchSubtypes(),
          fetchBrands(),
        ]);

        device.setTypes(
          typesData.map((type) => ({
            ...type,
            translations: type.translations || {},
          }))
        );

        device.setSubtypes(
          subtypesData.map((subtype) => ({
            ...subtype,
            translations: subtype.translations || {},
          }))
        );

        device.setBrands(brandsData);

        if (typeIdFromUrl) {
          const selectedType = typesData.find(
            (type) => type.id === Number(typeIdFromUrl)
          );
          if (selectedType) {
            device.setSelectedType(selectedType);
          }
        }
      } catch (error) {
        console.error("Ошибка загрузки начальных данных:", error);
      }
    };

    loadInitialData();
  }, [currentLang]);

  useEffect(() => {
  return () => {
    device.setSelectedBrand({});
  };
}, []);

  useEffect(() => {
    const loadDevices = async () => {
      try {
        const data = await fetchDevices(
          device.selectedType?.id || null,
          device.selectedSubType?.id || null,
          device.selectedBrand?.id || null,
          device.page,
          device.limit
        );

        device.setDevices(data.rows);
        device.setTotalCount(data.count);
      } catch (error) {
        console.error("Ошибка загрузки девайсов:", error);
      }
    };

    loadDevices();
  }, [
    device.selectedType,
    device.selectedSubType,
    device.selectedBrand,
    device.page,
  ]);

  useEffect(() => {
    const loadSubtypes = async () => {
      try {
        let subtypesData;
        if (device.selectedType?.id) {
          subtypesData = await fetchSubtypesByType(device.selectedType.id);
        } else {
          subtypesData = await fetchSubtypes();
        }

        device.setSubtypes(
          subtypesData.map((subtype) => ({
            ...subtype,
            translations: subtype.translations || {},
          }))
        );

        device.setSelectedSubType({});
      } catch (error) {
        console.error("Ошибка при загрузке подтипов:", error);
      }
    };

    loadSubtypes();
  }, [device.selectedType, currentLang]);

  useEffect(() => {
    const handleScroll = () => {
      setShowScrollTop(window.scrollY > 300);
    };

    window.addEventListener("scroll", handleScroll);
    return () => {
      window.removeEventListener("scroll", handleScroll);
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
        <h1 className={catalogStyles.catalogTitle}>
          {t("product Catalog", { ns: "deviceList" })}
        </h1>

        <div className={catalogStyles.filters}>
          <div className={catalogStyles.brandFilter}>
            <BrandBar />
          </div>
          <div className={catalogStyles.typeFilter}>
            <TypeBar />
          </div>
          <div id="subtype-filter" className={catalogStyles.subtypeFilter}>
            <SubTypeBar />
          </div>
        </div>

        <div className={catalogStyles.deviceContainer}>
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
