import React, { useContext, useState, useRef, useEffect } from "react";
import { observer } from "mobx-react-lite";
import { Context } from "../index";
import styles from "./BrandBar.module.css";

const BrandBar = observer(() => {
  const { device } = useContext(Context);
  const [search, setSearch] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef(null);

  const filteredBrands = device.brands.filter((brand) =>
    brand.name.toLowerCase().includes(search.toLowerCase())
  );

  const handleBrandSelect = (brand) => {
    device.setSelectedBrand(brand);
    setIsOpen(false);
    setSearch("");
  };

  const handleClear = () => {
    device.setSelectedBrand({});
    setIsOpen(false);
    setSearch("");
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  return (
    <div className={styles.dropdownWrapper} ref={wrapperRef}>
      <div
        className={`${styles.dropdownHeader} ${
          device.selectedBrand.name ? styles.activeDropdown : ""
        }`}
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className={styles.dropdownText}>
          {device.selectedBrand.name || "Vali bränd"}
        </span>
        {device.selectedBrand.name && (
          <button
            className={styles.clearIcon}
            onClick={(e) => {
              e.stopPropagation();
              handleClear();
            }}
          >
            ✕
          </button>
        )}
      </div>

      {isOpen && (
        <div className={styles.dropdownMenu}>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Otsi brändi..."
            className={styles.searchInput}
          />
          <div className={styles.brandList}>
            {filteredBrands.map((brand) => (
              <div
                key={brand.id}
                className={styles.brandItem}
                onClick={() => handleBrandSelect(brand)}
              >
                {brand.name}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
});

export default BrandBar;
