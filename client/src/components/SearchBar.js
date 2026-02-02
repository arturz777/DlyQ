import React, { useState, useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { searchDevices } from "../http/deviceAPI";
import { searchFood } from "../http/foodCatalogAPI";
import { useTranslation } from "react-i18next";
import SlideModal from "../components/modals/SlideModal";
import DevicePage from "../pages/DevicePage";
import styles from "./NavBar.module.css";
import DishModal from "./DishModal";

const API_BASE = process.env.REACT_APP_API_URL;

const getMenuImgSrc = (img) => {
  if (!img) return null;
  if (/^https?:\/\//i.test(img)) return img;
  if (img.startsWith("/")) return `${API_BASE}${img}`;
  return `${API_BASE}/${img}`;
};

const SearchBar = ({ mode = "market" }) => {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [selectedDeviceId, setSelectedDeviceId] = useState(null);
  const [foodSellers, setFoodSellers] = useState([]);
  const [foodItems, setFoodItems] = useState([]);
  const [foodLoading, setFoodLoading] = useState(false);
  const [selectedFoodItem, setSelectedFoodItem] = useState(null);

  const location = useLocation();
  const searchRef = useRef(null);
  const { t, i18n } = useTranslation();
  const currentLang = i18n.language || "en";
  const isMarket = mode === "market";

  const handleSearch = async (e) => {
    const value = e.target.value;
    setQuery(value);

    if (!value.trim()) {
      setResults([]);
      setFoodSellers([]);
      setFoodItems([]);
      setSelectedIndex(-1);
      return;
    }

    try {
      setSelectedIndex(-1);

      if (mode === "market") {
        const devices = await searchDevices(value);

        const processed = devices.map((device) => ({
          ...device,
          name: device.translations?.name?.[currentLang] || device.name,
        }));

        setResults(processed);
        setFoodSellers([]);
        setFoodItems([]);
        return;
      }

      if (mode === "food-catalog") {
        setFoodLoading(true);
        const data = await searchFood(value, 12);

        setFoodSellers(Array.isArray(data?.sellers) ? data.sellers : []);
        setFoodItems(Array.isArray(data?.items) ? data.items : []);

        setResults([]);
        return;
      }
    } catch (err) {
      console.error("Search error:", err);
      setResults([]);
      setFoodSellers([]);
      setFoodItems([]);
    } finally {
      setFoodLoading(false);
    }
  };

  const handleKeyDown = async (e) => {
    if (!isMarket) return;
    if (!results.length && (e.key === "ArrowDown" || e.key === "ArrowUp"))
      return;

    if (e.key === "ArrowDown") {
      setSelectedIndex((prevIndex) =>
        results.length ? (prevIndex + 1) % results.length : -1,
      );
    } else if (e.key === "ArrowUp") {
      setSelectedIndex((prevIndex) =>
        results.length ? (prevIndex - 1 + results.length) % results.length : -1,
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
            console.log("No devices found");
          }
        } catch (err) {
          console.error("Search error on Enter:", err);
        }
      }
    }
  };

  const handleClickOutside = (e) => {
    if (searchRef.current && !searchRef.current.contains(e.target)) {
      setResults([]);
      setFoodSellers([]);
      setFoodItems([]);
      setSelectedIndex(-1);
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
    setSelectedFoodItem(null);
    setFoodSellers([]);
    setFoodItems([]);
    setSelectedIndex(-1);
  }, [location.pathname, mode]);

  return (
    <div className={styles.searchBarContainer} ref={searchRef}>
      <div className={styles.searchBarWrapper}>
        <input
          type="text"
          placeholder={
            mode === "market"
              ? t("search", { ns: "searchbar" })
              : t("search", {
                  ns: "searchbar"
                })
          }
          value={query}
          onChange={handleSearch}
          onKeyDown={handleKeyDown}
          className={styles.searchInput}
        />
        {mode === "market" && results.length > 0 && (
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

        {mode === "food-catalog" &&
          (foodSellers.length > 0 || foodItems.length > 0) && (
            <div className={styles.resultsDropdown}>
              {foodSellers.length > 0 && (
                <>
                  <div className={styles.dropdownSectionTitle}>
                    {t("restaurants", {
                      ns: "foodCatalogPage"
                    })}
                  </div>

                  {foodSellers.slice(0, 6).map((s) => {
                    const slugOrId = s.slug || s.id;

                    return (
                      <div
                        key={`s-${s.id}`}
                        className={styles.resultLink}
                        onClick={() => {
                          setQuery("");
                          setFoodSellers([]);
                          setFoodItems([]);
                          navigate(`/seller/${slugOrId}`, {
                            state: { seller: s },
                          });
                        }}
                        role="button"
                        tabIndex={0}
                      >
                        <div className={styles.resultInfo}>{s.name}</div>
                      </div>
                    );
                  })}
                </>
              )}

              {foodItems.length > 0 && (
                <>
                  <div className={styles.dropdownSectionTitle}>
                    {t("dishes", {
                      ns: "foodCatalogPage"
                    })}
                  </div>

                  {foodItems.slice(0, 6).map((it) => {
                    const itName =
                      it.translations?.name?.[currentLang] || it.name;

                    return (
                      <div
                        key={`i-${it.id}`}
                        className={styles.resultLink}
                        onClick={() => {
                          setQuery("");
                          setFoodSellers([]);
                          setFoodItems([]);
                          setSelectedDeviceId(null);
                          setSelectedFoodItem(it);
                        }}
                        role="button"
                        tabIndex={0}
                      >
                        <div>
                          <div className={styles.resultInfo}>{itName}</div>
                          <div className={styles.resultPrice}>
                            {Number(it.price || 0).toFixed(2)} €
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </>
              )}
            </div>
          )}
      </div>
      {selectedFoodItem && (
        <SlideModal
          title={
            selectedFoodItem.translations?.name?.[currentLang] ||
            selectedFoodItem.name
          }
          onClose={() => setSelectedFoodItem(null)}
        >
          <DishModal
            item={selectedFoodItem}
            seller={selectedFoodItem?.seller || null}
            getImgSrc={getMenuImgSrc}
          />
        </SlideModal>
      )}

      {selectedDeviceId && (
        <SlideModal onClose={() => setSelectedDeviceId(null)}>
          <DevicePage id={selectedDeviceId} />
        </SlideModal>
      )}
    </div>
  );
};

export default SearchBar;
