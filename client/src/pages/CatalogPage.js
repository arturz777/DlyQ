import React, { useEffect, useContext, useState } from "react";
import { observer } from "mobx-react-lite";
import { Context } from "../index";
import TypeBar from "../components/TypeBar";
import BrandBar from "../components/BrandBar";
import SubTypeBar from "..//components/SubTypeBar";
import DeviceList from "../components/DeviceList";
import { fetchBrands, fetchDevices, fetchTypes, fetchSubtypes, fetchSubtypesByType } from "../http/deviceAPI";
import catalogStyles from "./CatalogPage.module.css";

const CatalogPage = observer(() => {
  const { device } = useContext(Context);
  const [showScrollTop, setShowScrollTop] = useState(false);

  useEffect(() => {
    fetchTypes().then((data) => device.setTypes(data));
    fetchSubtypes().then((data) => device.setSubtypes(data));
    fetchBrands().then((data) => device.setBrands(data));
    fetchDevices(null, null, 1, device.limit).then((data) => {
      device.setDevices(data.rows);
      device.setTotalCount(data.count);
    });
  }, []);

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
  }, [device.page, device.selectedType, device.selectedSubType, device.selectedBrand]);

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
  }, [device.selectedType, device.selectedBrand, device.selectedSubType, device.page]);
  

  useEffect(() => {
    const loadSubtypes = async () => {
      try {
        if (device.selectedType.id) {
          // Загружаем подтипы для выбранного типа
          const subtypesData = await fetchSubtypesByType(device.selectedType.id);
          device.setSubtypes(subtypesData);
        } else {
          // Если фильтр типа снят, восстанавливаем все подтипы
          const allSubtypes = await fetchSubtypes();
          device.setSubtypes(allSubtypes);
        }
        device.setSelectedSubType({}); // Сбрасываем выбранный подтип
      } catch (error) {
        console.error("Ошибка при загрузке подтипов:", error);
      }
    };

    loadSubtypes();
  }, [device.selectedType]);

  // Логика кнопки "Вернуться наверх"
  useEffect(() => {
    const handleScroll = () => {
      setShowScrollTop(window.scrollY > 300); // Порог появления кнопки
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
        <h1 className={catalogStyles.catalogTitle}>Каталог товаров</h1>

        {/* Блок фильтров */}
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
