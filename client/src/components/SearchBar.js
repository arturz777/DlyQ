import React, { useState, useEffect, useRef } from "react";
import { searchDevices } from "../http/deviceAPI";
import { useLocation } from "react-router-dom";
import styles from "./NavBar.module.css";
import { useTranslation } from "react-i18next";
import SlideModal from "../components/modals/SlideModal";
import DevicePage from "../pages/DevicePage";

const SearchBar = () => {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [selectedDeviceId, setSelectedDeviceId] = useState(null);
  const location = useLocation();
  const searchRef = useRef(null);
  const { t, i18n } = useTranslation();
  const currentLang = i18n.language || "en";

  const handleSearch = async (e) => {
    const value = e.target.value;
    setQuery(value);
    if (value.length > 0) {
      try {
        const devices = await searchDevices(value);

        const processedDevices = devices.map((device) => ({
          ...device,
          name: device.translations?.name?.[currentLang] || device.name,
        }));

        setResults(processedDevices);
        setSelectedIndex(-1);
      } catch (err) {
        console.error("Ошибка поиска:", err);
        setResults([]);
      }
    } else {
      setResults([]);
    }
  };

  const handleKeyDown = async (e) => {
    if (!results.length && (e.key === "ArrowDown" || e.key === "ArrowUp"))
      return;

    if (e.key === "ArrowDown") {
      setSelectedIndex((prevIndex) =>
        results.length ? (prevIndex + 1) % results.length : -1
      );
    } else if (e.key === "ArrowUp") {
      setSelectedIndex((prevIndex) =>
        results.length ? (prevIndex - 1 + results.length) % results.length : -1
      );
    } else if (e.key === "Enter") {
      if (selectedIndex >= 0 && results.length > 0) {
        handleResultClick(results[selectedIndex].id);
      } else if (query.length > 0) {
        try {
          const devices = await searchDevices(query);
          if (devices.length > 0) {
            handleResultClick(devices[0].id);
          } else {
            console.log("Устройства не найдены");
          }
        } catch (err) {
          console.error("Ошибка поиска при Enter:", err);
        }
      }
    }
  };

  const handleClickOutside = (e) => {
    if (searchRef.current && !searchRef.current.contains(e.target)) {
      setResults([]);
    }
  };

  useEffect(() => {
    document.addEventListener("click", handleClickOutside);
    return () => {
      document.removeEventListener("click", handleClickOutside);
    };
  }, []);

  const handleResultClick = (id) => {
    setQuery("");
    setResults([]);
    setSelectedIndex(-1);

     setSelectedDeviceId(id);
  };

  useEffect(() => {
    setResults([]);
    setQuery("");
    setSelectedDeviceId(null);
  }, [location.pathname]);

  return (
    <div className={styles.searchBarContainer} ref={searchRef}>
      <div className={styles.searchBarWrapper}>
        <input
          type="text"
          placeholder={t("search", { ns: "searchbar" })}
          value={query}
          onChange={handleSearch}
          onKeyDown={handleKeyDown}
          className={styles.searchInput}
        />
        {results.length > 0 && (
          <div className={styles.resultsDropdown}>
            {results.map((device, index) => (
              <div
                key={device.id}
                className={`${styles.resultLink} ${
                  index === selectedIndex ? styles.selected : ""
                }`}
                onClick={() => handleResultClick(device.id)}
                tabIndex={0}
              >
                <img
                  src={device.img}
                  alt={device.name}
                  className={styles.resultImage}
                />
                <div>
                  <div className={styles.resultInfo}>
                    {device.translations?.name?.[i18n.language] || device.name}
                  </div>
                  <div className={styles.resultPrice}>{device.price} €</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
        {selectedDeviceId && (
          <SlideModal onClose={() => setSelectedDeviceId(null)}>
            <DevicePage id={selectedDeviceId} />
          </SlideModal>
        )}
    </div>
  );
};

export default SearchBar;
