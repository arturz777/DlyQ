import React, { useEffect, useContext, useState } from "react";
import { observer } from "mobx-react-lite";
import { Context } from "../index";
import { useSearchParams } from "react-router-dom";
import TypeBar from "../components/TypeBar";
import BrandBar from "../components/BrandBar";
import SubTypeBar from "..//components/SubTypeBar";
import DeviceList from "../components/DeviceList";
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
  const { t, i18n } = useTranslation();
  const [searchParams] = useSearchParams();
  const typeIdFromUrl = searchParams.get("typeId");
  const currentLang = i18n.language || "en";

  const [showScrollTop, setShowScrollTop] = useState(false);

  useEffect(() => {
    appStore.startLoading();

    Promise.all([
      fetchTypes(),
      fetchSubtypes(),
      fetchBrands(),
      fetchDevices(null, null, 1, device.limit),
    ])
      .then(([typesData, subtypesData, brandsData, devicesData]) => {
        const translatedTypes = typesData.map((type) => ({
          ...type,
          translations: type.translations || {},
        }));
        device.setTypes(translatedTypes);

        const translatedSubtypes = subtypesData.map((subtype) => ({
          ...subtype,
          translations: subtype.translations || {},
        }));
        device.setSubtypes(translatedSubtypes);

        device.setBrands(brandsData);
        device.setDevices(devicesData.rows);
        device.setTotalCount(devicesData.count);

        if (typeIdFromUrl) {
          const selectedType = typesData.find((type) => type.id === Number(typeIdFromUrl));
          if (selectedType) {
            device.setSelectedType(selectedType);
          }
        }
      })
      .finally(() => appStore.stopLoading());
  }, [currentLang]);

  useEffect(() => {
    fetchDevices(
      device.selectedType.id,
      device.selectedSubType?.id,
      device.selectedBrand.id,
      device.page,
      device.limit
    ).then((data) => {
      device.setDevices(data.rows);
      device.setTotalCount(data.count);
    });
  }, [
    device.page,
    device.selectedType,
    device.selectedSubType,
    device.selectedBrand,
  ]);

  useEffect(() => {
    const loadDevices = async () => {
      try {
        const devicesData = await fetchDevices(
          device.selectedType?.id || null,
          device.selectedSubType?.id || null,
          device.selectedBrand?.id || null,
          device.page,
          device.limit
        );

        device.setDevices(devicesData.rows);
        device.setTotalCount(devicesData.count);
      } catch (error) {
        console.error("Ошибка при фильтрации устройств:", error);
      }
    };

    loadDevices();
  }, [
    device.selectedType,
    device.selectedBrand,
    device.selectedSubType,
    device.page,
  ]);

  useEffect(() => {
    const loadSubtypes = async () => {
      try {
        let subtypesData;
        if (device.selectedType.id) {
          subtypesData = await fetchSubtypesByType(device.selectedType.id);
        } else {
          subtypesData = await fetchSubtypes();
        }

        const translatedSubtypes = subtypesData.map((subtype) => ({
          ...subtype,
          translations: subtype.translations || {},
        }));

        device.setSubtypes(translatedSubtypes);
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
          <div className={catalogStyles.subtypeFilter}>
            <SubTypeBar />
          </div>
        </div>

        {/* Блок устройств */}
        <div className={catalogStyles.deviceContainer}>
          <DeviceList />
        </div>
        {showScrollTop && (
          <button
            onClick={scrollToTop}
            className={catalogStyles.scrollToTopButton}
          >
            ↑
          </button>
        )}
      </div>
    </div>
  );
});

export default CatalogPage;

