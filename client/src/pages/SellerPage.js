import React, { useContext, useEffect, useMemo, useState } from "react";
import { useLocation, useParams } from "react-router-dom";
import { toast } from "react-toastify";
import { Context } from "../index";
import { fetchSellers } from "../http/sellerAPI";
import { fetchMenuCategories, fetchMenuItems } from "../http/menuAPI";
import SlideModal from "../components/modals/SlideModal";
import DishModal from "../components/DishModal";
import { useTranslation } from "react-i18next";
import styles from "./SellerPage.module.css";

const API_BASE = process.env.REACT_APP_API_URL;

const getMenuImgSrc = (img) => {
  if (!img) return null;

  const base = API_BASE;
  if (/^https?:\/\//i.test(img)) return img;
  if (img.startsWith("/")) return `${base}${img}`;
  return `${base}/${img}`;
};

const normUiLang = (l) => {
  const short = String(l || "ru")
    .toLowerCase()
    .split("-")[0];
  if (short === "et") return "est";
  return short;
};

const pickTr = (base, map, lang) => {
  if (!map || typeof map !== "object") return base;
  const v = map[lang];
  return typeof v === "string" && v.trim() ? v : base;
};

const SellerPage = () => {
  const { idOrSlug } = useParams();
  const location = useLocation();
  const { basket } = useContext(Context);

  const [seller, setSeller] = useState(location.state?.seller || null);
  const [categories, setCategories] = useState([]);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [menuLoading, setMenuLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedItemId, setSelectedItemId] = useState(null);

  const { t, i18n } = useTranslation();
  const uiLang = normUiLang(i18n.language);

  const selectedItem = useMemo(
    () => items.find((x) => String(x.id) === String(selectedItemId)) || null,
    [items, selectedItemId],
  );

  const selectedTitle = useMemo(() => {
    if (!selectedItem) return "";
    return pickTr(selectedItem.name, selectedItem.translations?.name, uiLang);
  }, [selectedItem, uiLang]);

  const itemsByCategory = useMemo(() => {
    const map = {};
    for (const item of items) {
      const cid = item.categoryId || "no-cat";
      if (!map[cid]) map[cid] = [];
      map[cid].push(item);
    }
    return map;
  }, [items]);

  useEffect(() => {
    const loadSellerAndMenu = async () => {
      try {
        setLoading(true);
        setMenuLoading(true);
        setError(null);

        let currentSeller = seller;

        if (!currentSeller) {
          const all = await fetchSellers();
          currentSeller =
            all.find(
              (s) =>
                String(s.id) === String(idOrSlug) ||
                (s.slug && s.slug === idOrSlug),
            ) || null;

          if (!currentSeller) {
            setError(t("store not found", { ns: "sellerPage" }));
            setLoading(false);
            setMenuLoading(false);
            return;
          }

          setSeller(currentSeller);
        }

        setLoading(false);

        const sellerId = currentSeller.id;

        const [catsJson, itemsJson] = await Promise.all([
          fetchMenuCategories(sellerId),
          fetchMenuItems(sellerId),
        ]);

        setCategories(catsJson || []);
        setItems(itemsJson || []);
        setMenuLoading(false);
      } catch (e) {
        console.error(e);
        setError(e.message || t("data loading error", { ns: "sellerPage" }));
        setLoading(false);
        setMenuLoading(false);
      }
    };

    loadSellerAndMenu();
  }, [idOrSlug]);

  const ensureSingleSeller = (rawNewSellerId) => {
    const normalizeSellerId = (sid) => {
      const n = Number(sid);
      return Number.isFinite(n) && n > 0 ? n : null;
    };

    const newSellerId = normalizeSellerId(rawNewSellerId);

    const sellerIds = basket.items.map((it) =>
      typeof basket.getItemSellerId === "function"
        ? basket.getItemSellerId(it)
        : normalizeSellerId(it.sellerId),
    );

    if (sellerIds.length === 0) return true;

    const unique = Array.from(new Set(sellerIds));

    if (unique.length === 1 && unique[0] === newSellerId) {
      return true;
    }

    const ok = window.confirm(
      t(
        "cart contains items from another seller. clear cart and add this item?",
        { ns: "sellerPage" },
      ),
    );

    if (!ok) return false;

    if (typeof basket.clearAll === "function") {
      basket.clearAll();
    } else {
      basket.items.slice().forEach((it) => {
        if (typeof basket.removeItem === "function" && it.uniqueKey) {
          basket.removeItem(it.uniqueKey);
        }
      });
    }

    return true;
  };

  const buildVariantKey = (sel) => {
    const keys = Object.keys(sel || {}).sort((a, b) => Number(a) - Number(b));
    return keys
      .map((k) => {
        const v = sel[k];
        if (Array.isArray(v)) return `${k}=${v.slice().sort().join(",")}`;
        return `${k}=${String(v)}`;
      })
      .join("|");
  };

  const addToBasketConfigured = (
    item,
    unitPrice,
    selectedOptions,
    selectedOptionsMeta,
  ) => {
    const itemName = pickTr(item.name, item.translations?.name, uiLang);

    const newSellerId = seller?.id ? Number(seller.id) : null;
    if (!ensureSingleSeller(newSellerId)) return;

    const basketItem = {
      id: item.id,
      name: item.name,
      translations: item.translations,
      price: Number(unitPrice) || Number(item.price) || 0, // ВАЖНО: финальная цена за 1 шт
      img: item.img || null,
      sellerId: newSellerId,
      isRestaurantItem: true,
      isPreorder: false,
      defaultSelected: true,

      selectedOptions: selectedOptions || {},
      selectedOptionsMeta: selectedOptionsMeta || [],
      variantKey: buildVariantKey(selectedOptions),

      stockQuantity:
        typeof item.stockQuantity === "number"
          ? item.stockQuantity
          : typeof item.quantity === "number"
            ? item.quantity
            : 999999,
    };

    basket.addItem(basketItem);

    toast.success(
      <>
        <strong>{itemName}</strong>
        <div>{t("added to cart", { ns: "sellerPage" })}</div>
      </>,
    );
  };

  if (loading && !seller) {
    return (
      <div className={styles.pageWrapper}>
        <div className={styles.center}>
          {t("loading store...", { ns: "sellerPage" })}
        </div>
      </div>
    );
  }

  if (error && !seller) {
    return (
      <div className={styles.pageWrapper}>
        <div className={styles.error}>{error}</div>
      </div>
    );
  }

  return (
    <div className={styles.pageWrapper}>
      {seller && (
        <header className={styles.hero}>
          <div className={styles.heroMedia}>
            {seller.img ? (
              <img
                src={getMenuImgSrc(seller.img)}
                alt={seller.name}
                className={styles.heroImg}
                onError={(e) => (e.currentTarget.style.display = "none")}
              />
            ) : (
              <div className={styles.heroStub} />
            )}

            <div className={styles.heroOverlay} />

            <div className={styles.heroTitleWrap}>
              <h1 className={styles.heroTitle}>{seller.name}</h1>
            </div>
          </div>
        </header>
      )}

      {error && seller && <div className={styles.error}>{error}</div>}

      {menuLoading ? (
        <div className={styles.center}>
          {t("loading menu...", { ns: "sellerPage" })}
        </div>
      ) : (
        <div className={styles.menuWrapper}>
          {categories.length > 0 && (
            <nav className={styles.categoriesNav}>
              {categories.map((cat) => {
                const catName = pickTr(
                  cat.name,
                  cat.translations?.name,
                  uiLang,
                );

                return (
                  <button
                    key={cat.id}
                    type="button"
                    className={styles.categoryChip}
                    onClick={() => {
                      const el = document.getElementById(`cat-${cat.id}`);
                      if (el)
                        el.scrollIntoView({
                          behavior: "smooth",
                          block: "start",
                        });
                    }}
                  >
                    {catName}
                  </button>
                );
              })}
            </nav>
          )}

          {categories.map((cat) => {
            const catTitle = pickTr(cat.name, cat.translations?.name, uiLang);
            const catItems = itemsByCategory[cat.id] || [];

            return (
              <section
                key={cat.id}
                id={`cat-${cat.id}`}
                className={styles.categorySection}
              >
                <div className={styles.categoryHeader}>
                  {cat.img && (
                    <img
                      src={getMenuImgSrc(cat.img)}
                      alt={catTitle}
                      className={styles.categoryImg}
                      onError={(e) => {
                        e.currentTarget.style.display = "none";
                      }}
                    />
                  )}
                  <h2 className={styles.categoryTitle}>{catTitle}</h2>
                </div>

                {catItems.length === 0 ? (
                  <div className={styles.emptyCategory}>
                    {t("no dishes yet", { ns: "sellerPage" })}
                  </div>
                ) : (
                  <div className={styles.itemsList}>
                    {catItems.map((item) => {
                      const imgSrc = getMenuImgSrc(item.img);
                      const itemName = pickTr(
                        item.name,
                        item.translations?.name,
                        uiLang,
                      );
                      const itemDesc = pickTr(
                        item.description,
                        item.translations?.description,
                        uiLang,
                      );

                      return (
                        <div
                          key={item.id}
                          className={styles.itemCard}
                          onClick={() => setSelectedItemId(item.id)}
                          role="button"
                          tabIndex={0}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ")
                              setSelectedItemId(item.id);
                          }}
                        >
                          {imgSrc && (
                            <img
                              src={imgSrc}
                              alt={itemName}
                              className={styles.itemImg}
                              onError={(e) => {
                                e.currentTarget.style.display = "none";
                              }}
                            />
                          )}

                          <div className={styles.itemContent}>
                            <div className={styles.itemTopRow}>
                              <div>
                                <div className={styles.itemName}>
                                  {itemName}
                                </div>
                                {itemDesc && (
                                  <div className={styles.itemDesc}>
                                    {itemDesc}
                                  </div>
                                )}
                              </div>
                              <div className={styles.itemPrice}>
                                {Number(item.price || 0).toFixed(2)} €
                              </div>
                            </div>

                            <div className={styles.itemBottomRow}>
                              <span></span>

                              <button
                                type="button"
                                className={styles.addButton}
                                disabled={!item.isAvailable}
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  setSelectedItemId(item.id);
                                }}
                              >
                                {t("add", { ns: "sellerPage" })}
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>
            );
          })}

          {!categories.length && !error && (
            <div className={styles.emptyMenu}>
              {t("menu is empty for now", { ns: "sellerPage" })}
            </div>
          )}
        </div>
      )}

      {selectedItem && (
        <SlideModal
          title={selectedTitle}
          onClose={() => setSelectedItemId(null)}
        >
          <DishModal
            item={{
              ...selectedItem,
              name: pickTr(
                selectedItem.name,
                selectedItem.translations?.name,
                uiLang,
              ),
              description: pickTr(
                selectedItem.description,
                selectedItem.translations?.description,
                uiLang,
              ),
            }}
            seller={seller}
            getImgSrc={getMenuImgSrc}
            onAdd={({
              qty,
              unitPrice,
              selectedOptions,
              selectedOptionsMeta,
            }) => {
              for (let i = 0; i < qty; i++) {
                addToBasketConfigured(
                  selectedItem,
                  unitPrice,
                  selectedOptions,
                  selectedOptionsMeta,
                );
              }
              setSelectedItemId(null);
            }}
          />
        </SlideModal>
      )}
    </div>
  );
};

export default SellerPage;
