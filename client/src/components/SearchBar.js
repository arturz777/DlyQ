import React, { useState, useEffect, useRef } from "react";
import { searchDevices } from "../http/deviceAPI";
import { useLocation, useNavigate } from "react-router-dom";
import styles from "./NavBar.module.css";
import { useTranslation } from "react-i18next";

const SearchBar = () => {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const location = useLocation();
  const navigate = useNavigate();
  const searchRef = useRef(null);
  const { t, i18n } = useTranslation();
  const currentLang = i18n.language || "en";

  const handleSearch = async (e) => {
    const value = e.target.value;
    setQuery(value);
    if (value.length > 0) {
      const devices = await searchDevices(value);

      const processedDevices = devices.map((device) => ({
        ...device,
        name: device.translations?.name?.[currentLang] || device.name,
      }));

      setResults(processedDevices);
    } else {
      setResults([]);
    }
  };

  const handleKeyDown = async (e) => {
    if (e.key === "ArrowDown") {
      setSelectedIndex((prevIndex) => (prevIndex + 1) % results.length);
    } else if (e.key === "ArrowUp") {
      setSelectedIndex(
        (prevIndex) => (prevIndex - 1 + results.length) % results.length
      );
    } else if (e.key === "Enter") {
      if (selectedIndex >= 0 && results.length > 0) {
        handleResultClick(results[selectedIndex].id);
      } else if (query.length > 0) {
        const devices = await searchDevices(query);
        if (devices.length > 0) {
          handleResultClick(devices[0].id);
        } else {
          console.log("Устройства не найдены");
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
    navigate(`/device/${id}`, { replace: true });
  };

  useEffect(() => {
    setResults([]);
    setQuery("");
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
    </div>
  );
};

export default SearchBar;
