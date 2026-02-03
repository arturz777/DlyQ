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

const SearchBar = ({ mode = "market", hideDropdown = false }) => {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [selectedDeviceId, setSelectedDeviceId] = useState(null);
  const [foodSellers, setFoodSellers] = useState([]);
  const [foodItems, setFoodItems] = useState([]);
  const [foodLoading, setFoodLoading] = useState(false);
  const [selectedFoodItem, setSelectedFoodItem] = useState(null);
  const dropdownRef = useRef(null);
  const location = useLocation();
  const searchRef = useRef(null);
  const { t, i18n } = useTranslation();
  const currentLang = i18n.language || "en";

  useEffect(() => {
    if (!hideDropdown) return;
    setResults([]);
    setFoodSellers([]);
    setFoodItems([]);
    setSelectedIndex(-1);
  }, [hideDropdown]);

  const navItems = React.useMemo(() => {
    const arr = [];

    if (mode === "market" || mode === "all") {
      results.slice(0, 6).forEach((d) => {
        arr.push({ type: "device", id: d.id, data: d });
      });
    }

    if (mode === "food-catalog" || mode === "all") {
      foodSellers.slice(0, 6).forEach((s) => {
        arr.push({ type: "seller", id: s.id, data: s });
      });

      foodItems.slice(0, 6).forEach((it) => {
        arr.push({ type: "dish", id: it.id, data: it });
      });
    }

    return arr;
  }, [mode, results, foodSellers, foodItems]);

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

      if (mode === "all") {
        setFoodLoading(true);
        const [food, devices] = await Promise.all([
          searchFood(value, 10),
          searchDevices(value),
        ]);

        setFoodSellers(Array.isArray(food?.sellers) ? food.sellers : []);
        setFoodItems(Array.isArray(food?.items) ? food.items : []);
        setResults(Array.isArray(devices) ? devices : []);
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

  const isKeyboardNav =
    mode === "market" || mode === "all" || mode === "food-catalog";

  const handleKeyDown = (e) => {
    if (!isKeyboardNav) return;
    if (!navItems.length && (e.key === "ArrowDown" || e.key === "ArrowUp"))
      return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) =>
        navItems.length ? (prev + 1) % navItems.length : -1,
      );
      return;
    }

    if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) =>
        navItems.length ? (prev - 1 + navItems.length) % navItems.length : -1,
      );
      return;
    }

    if (e.key === "Enter") {
      if (selectedIndex < 0 || !navItems[selectedIndex]) return;

      const picked = navItems[selectedIndex];

      if (picked.type === "device") {
        handleResultClick(picked.data.id);
        return;
      }

      if (picked.type === "seller") {
        const s = picked.data;
        const slugOrId = s.slug || s.id;
        setQuery("");
        setFoodSellers([]);
        setFoodItems([]);
        setResults([]);
        setSelectedIndex(-1);
        navigate(`/seller/${slugOrId}`, { state: { seller: s } });
        return;
      }

      if (picked.type === "dish") {
        const it = picked.data;
        setQuery("");
        setFoodSellers([]);
        setFoodItems([]);
        setResults([]);
        setSelectedIndex(-1);
        setSelectedDeviceId(null);
        setSelectedFoodItem(it);
        return;
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

  const devicesCount =
    mode === "market" || mode === "all" ? results.slice(0, 6).length : 0;
  const sellersOffset = devicesCount;
  const sellersCount =
    mode === "food-catalog" || mode === "all"
      ? foodSellers.slice(0, 6).length
      : 0;
  const dishesOffset = sellersOffset + sellersCount;

  useEffect(() => {
    const root = dropdownRef.current;
    if (!root) return;
    if (selectedIndex < 0) return;

    const el = root.querySelector(`[data-idx="${selectedIndex}"]`);
    if (!el) return;

    const rootRect = root.getBoundingClientRect();
    const elRect = el.getBoundingClientRect();

    const isAbove = elRect.top < rootRect.top;
    const isBelow = elRect.bottom > rootRect.bottom;

    if (isAbove || isBelow) {
      el.scrollIntoView({ block: "nearest" });
    }
  }, [selectedIndex]);

  return (
    <div className={styles.searchBarContainer} ref={searchRef}>
      <div className={styles.searchBarWrapper}>
        <input
          type="text"
          placeholder={
            mode === "market"
              ? t("search", { ns: "searchbar" })
              : t("search", {
                  ns: "searchbar",
                })
          }
          value={query}
          onChange={handleSearch}
          onKeyDown={handleKeyDown}
          className={styles.searchInput}
        />
        {(mode === "market" || mode === "food-catalog" || mode === "all") &&
          (results.length > 0 ||
            foodSellers.length > 0 ||
            foodItems.length > 0) && (
            <div className={styles.resultsDropdown} ref={dropdownRef}>
              {(mode === "market" || mode === "all") && results.length > 0 && (
                <>
                  {results.slice(0, 6).map((device, index) => (
                    <div
                      key={device.id}
                      data-idx={index}
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
                          {device.translations?.name?.[i18n.language] ||
                            device.name}
                        </div>
                        <div className={styles.resultPrice}>
                          {device.price} €
                        </div>
                      </div>
                    </div>
                  ))}
                </>
              )}

              {(mode === "food-catalog" || mode === "all") &&
                foodSellers.length > 0 && (
                  <>
                    {foodSellers.slice(0, 6).map((s, idx) => {
                      const globalIndex = sellersOffset + idx;
                      const slugOrId = s.slug || s.id;
                      const imgSrc = getMenuImgSrc(s.img);
                      return (
                        <div
                          key={`s-${s.id}`}
                          data-idx={globalIndex}
                          className={`${styles.resultLink} ${
                            globalIndex === selectedIndex ? styles.selected : ""
                          }`}
                          onClick={() => {
                            setQuery("");
                            setFoodSellers([]);
                            setFoodItems([]);
                            setResults([]);
                            navigate(`/seller/${slugOrId}`, {
                              state: { seller: s },
                            });
                          }}
                          role="button"
                          tabIndex={0}
                        >
                          {imgSrc ? (
                            <img
                              src={imgSrc}
                              alt={s.name}
                              className={styles.resultImage}
                              onError={(e) =>
                                (e.currentTarget.style.display = "none")
                              }
                            />
                          ) : (
                            <div className={styles.resultImageStub} />
                          )}
                          <div className={styles.resultInfo}>{s.name}</div>
                        </div>
                      );
                    })}
                  </>
                )}

              {(mode === "food-catalog" || mode === "all") &&
                foodItems.length > 0 && (
                  <>
                    {foodItems.slice(0, 6).map((it, idx) => {
                      const globalIndex = dishesOffset + idx;
                      const itName =
                        it.translations?.name?.[currentLang] || it.name;
                      const imgSrc = getMenuImgSrc(it.img);

                      return (
                        <div
                          key={`i-${it.id}`}
                          data-idx={globalIndex}
                          className={`${styles.resultLink} ${
                            globalIndex === selectedIndex ? styles.selected : ""
                          }`}
                          onClick={() => {
                            setQuery("");
                            setFoodSellers([]);
                            setFoodItems([]);
                            setResults([]);
                            setSelectedDeviceId(null);
                            setSelectedFoodItem(it);
                          }}
                          role="button"
                          tabIndex={0}
                        >
                          {imgSrc ? (
                            <img
                              src={imgSrc}
                              alt={itName}
                              className={styles.resultImage}
                              onError={(e) =>
                                (e.currentTarget.style.display = "none")
                              }
                            />
                          ) : (
                            <div className={styles.resultImageStub} />
                          )}
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
