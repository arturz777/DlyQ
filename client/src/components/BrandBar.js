import React, { useContext, useEffect, useMemo, useRef, useState } from "react";
import { observer } from "mobx-react-lite";
import { Context } from "../index";
import { useTranslation } from "react-i18next";
import styles from "./BrandBar.module.css";

const BrandBar = observer(() => {
  const { device } = useContext(Context);
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [highlight, setHighlight] = useState(0);

  const wrapperRef = useRef(null);
  const inputRef = useRef(null);
  const listRef = useRef(null);

  const items = useMemo(() => {
    const base = device.brands || [];
    const filtered = !search
      ? base
      : base.filter((b) => b.name.toLowerCase().includes(search.toLowerCase()));
    return [{ id: null, name: t("allBrands", { ns: "brandBar", defaultValue: "All brands" }), _all: true }, ...filtered];
  }, [device.brands, search, t]);

  const selectedId = device.selectedBrand?.id ?? null;
  const selectedIndex = items.findIndex((b) => b.id === selectedId);

  const select = (brand) => {
    if (brand?._all) {
      device.setSelectedBrand({});
    } else {
      device.setSelectedBrand(brand);
    }
    setOpen(false);
    setSearch("");
  };

  useEffect(() => {
    const onDoc = (e) => {
      if (!wrapperRef.current || wrapperRef.current.contains(e.target)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  useEffect(() => {
    if (open) {
      requestAnimationFrame(() => {
        inputRef.current?.focus();
        setHighlight(selectedIndex >= 0 ? selectedIndex : 0);
      });
    }
  }, [open, selectedIndex]);

  useEffect(() => {
    if (!open || !listRef.current) return;
    const el = listRef.current.querySelector(`[data-idx="${highlight}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [highlight, open]);

  const onHeaderKeyDown = (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      setOpen((v) => !v);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setHighlight(0);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  const onListKeyDown = (e) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((i) => Math.min(i + 1, items.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((i) => Math.max(i - 1, 0));
    } else if (e.key === "Home") {
      e.preventDefault();
      setHighlight(0);
    } else if (e.key === "End") {
      e.preventDefault();
      setHighlight(items.length - 1);
    } else if (e.key === "Enter") {
      e.preventDefault();
      select(items[highlight]);
    } else if (e.key === "Escape" || e.key === "Tab") {
      setOpen(false);
    }
  };

  return (
    <div className={styles.dropdownWrapper} ref={wrapperRef}>
      <button
        type="button"
        className={`${styles.dropdownHeader} ${selectedId ? styles.activeDropdown : ""}`}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={onHeaderKeyDown}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className={styles.dropdownText}>
          {device.selectedBrand?.name || t("chooseBrand", { ns: "brandBar", defaultValue: "Choose brand" })}
        </span>

        {selectedId && (
          <button
            type="button"
            className={styles.clearBtn}
            aria-label={t("clear", { ns: "brandBar", defaultValue: "Clear" })}
            onClick={(e) => {
              e.stopPropagation();
              device.setSelectedBrand({});
              setSearch("");
            }}
          >
            ✕
          </button>
        )}

        <svg className={`${styles.chevron} ${open ? styles.chevronOpen : ""}`} viewBox="0 0 24 24" aria-hidden="true">
          <path d="M7 10l5 5 5-5" fill="none" stroke="currentColor" strokeWidth="2" />
        </svg>
      </button>

      {open && (
        <div className={styles.dropdownMenu} role="listbox" aria-label={t("chooseBrand", { ns: "brandBar" })} onKeyDown={onListKeyDown}>
          <div className={styles.searchRow}>
            <svg className={styles.searchIcon} viewBox="0 0 24 24" aria-hidden="true">
              <path d="M11 18a7 7 0 100-14 7 7 0 000 14zm10 1l-4.35-4.35" fill="none" stroke="currentColor" strokeWidth="2" />
            </svg>
            <input
              ref={inputRef}
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setHighlight(0);
              }}
              placeholder={t("searchBrand", { ns: "brandBar", defaultValue: "Search brand…" })}
              className={styles.searchInput}
            />
          </div>

          <div className={styles.brandList} ref={listRef}>
            {items.length === 1 && !device.brands?.length ? (
              <div className={styles.empty}>{t("noBrands", { ns: "brandBar", defaultValue: "No brands" })}</div>
            ) : items.length === 0 ? (
              <div className={styles.empty}>{t("nothingFound", { ns: "brandBar", defaultValue: "Nothing found" })}</div>
            ) : (
              items.map((b, idx) => {
                const isSelected = b.id === selectedId || (b._all && selectedId === null);
                const isActive = idx === highlight;
                return (
                  <div
                    key={b.id ?? "all"}
                    data-idx={idx}
                    role="option"
                    aria-selected={isSelected}
                    className={`${styles.brandItem} ${isActive ? styles.brandItemActive : ""} ${isSelected ? styles.brandItemSelected : ""}`}
                    onMouseEnter={() => setHighlight(idx)}
                    onClick={() => select(b)}
                  >
                    <span className={styles.brandName}>{b.name}</span>
                    {isSelected && <span className={styles.tick}>✓</span>}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
});

export default BrandBar;
