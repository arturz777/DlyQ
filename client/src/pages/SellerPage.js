import React, { useContext, useEffect, useMemo, useState } from "react";
import { useLocation, useParams } from "react-router-dom";
import { toast } from "react-toastify";
import { Context } from "../index";
import { fetchSellers } from "../http/sellerAPI";
import { fetchMenuCategories, fetchMenuItems } from "../http/menuAPI";
import SlideModal from "../components/modals/SlideModal";
import DishModal from "../components/DishModal";
import styles from "./SellerPage.module.css";

const API_BASE = process.env.REACT_APP_API_URL;

const getMenuImgSrc = (img) => {
  if (!img) return null;

  const base = API_BASE;
  if (/^https?:\/\//i.test(img)) return img;
  if (img.startsWith("/")) return `${base}${img}`;
  return `${base}/${img}`;
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

  const selectedItem = useMemo(
    () => items.find((x) => String(x.id) === String(selectedItemId)) || null,
    [items, selectedItemId]
  );

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
                (s.slug && s.slug === idOrSlug)
            ) || null;

          if (!currentSeller) {
            setError("Магазин не найден");
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
        setError(e.message || "Ошибка загрузки данных");
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
        : normalizeSellerId(it.sellerId)
    );

    if (sellerIds.length === 0) return true;

    const unique = Array.from(new Set(sellerIds));

    if (unique.length === 1 && unique[0] === newSellerId) {
      return true;
    }

    const ok = window.confirm(
      "В корзине уже есть товары другого продавца. Очистить корзину и добавить этот товар?"
    );

    if (!ok) {
      return false;
    }

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

  const addToBasket = (item, qty = 1) => {
    if (!item?.isAvailable) {
      toast.error("Блюдо сейчас недоступно");
      return;
    }

    const newSellerId = seller?.id ? Number(seller.id) : null;
    if (typeof ensureSingleSeller === "function") {
      if (!ensureSingleSeller(newSellerId)) return;
    }

    for (let i = 0; i < qty; i++) {
      const basketItem = {
        id: item.id,
        name: item.name,
        price: Number(item.price) || 0,
        img: item.img || null,
        sellerId: newSellerId,
        isRestaurantItem: true,
        isPreorder: false,
        defaultSelected: true,
        selectedOptions: {},
        variantKey: null,
        stockQuantity:
          typeof item.stockQuantity === "number"
            ? item.stockQuantity
            : typeof item.quantity === "number"
            ? item.quantity
            : 999999,
      };

      basket.addItem(basketItem);
    }

    toast.success(
      <>
        <strong>{item.name}</strong>
        <div>Добавлено в корзину</div>
      </>
    );
  };

  if (loading && !seller) {
    return (
      <div className={styles.pageWrapper}>
        <div className={styles.center}>Загружаем магазин…</div>
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
        <header className={styles.header}>
          <div className={styles.headerInfo}>
            {seller.img ? (
              <img
                src={getMenuImgSrc(seller.img)}
                alt={seller.name}
                className={styles.headerImg}
                onError={(e) => (e.currentTarget.style.display = "none")}
              />
            ) : (
              <div className={styles.headerStub} />
            )}

            <div className={styles.headerText}>
              <h1 className={styles.sellerName}>{seller.name}</h1>
              {seller.kind && (
                <div className={styles.sellerKind}>{seller.kind}</div>
              )}
            </div>

            <div className={styles.headerStub} aria-hidden="true" />
          </div>
        </header>
      )}

      {error && seller && <div className={styles.error}>{error}</div>}

      {menuLoading ? (
        <div className={styles.center}>Загружаем меню…</div>
      ) : (
        <div className={styles.menuWrapper}>
          {categories.length > 0 && (
            <nav className={styles.categoriesNav}>
              {categories.map((cat) => (
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
                  {cat.name}
                </button>
              ))}
            </nav>
          )}

          {categories.map((cat) => {
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
                      alt={cat.name}
                      className={styles.categoryImg}
                      onError={(e) => {
                        e.currentTarget.style.display = "none";
                      }}
                    />
                  )}
                  <h2 className={styles.categoryTitle}>{cat.name}</h2>
                </div>

                {catItems.length === 0 ? (
                  <div className={styles.emptyCategory}>Пока нет блюд</div>
                ) : (
                  <div className={styles.itemsList}>
                    {catItems.map((item) => {
                      const imgSrc = getMenuImgSrc(item.img);

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
                              alt={item.name}
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
                                  {item.name}
                                </div>
                                {item.description && (
                                  <div className={styles.itemDesc}>
                                    {item.description}
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
                                  addToBasket(item, 1);
                                }}
                              >
                                Добавить
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
            <div className={styles.emptyMenu}>Меню пока пустое</div>
          )}
        </div>
      )}
      {selectedItem && (
        <SlideModal
          title={selectedItem.name}
          onClose={() => setSelectedItemId(null)}
        >
          <DishModal
            item={selectedItem}
            seller={seller}
            getImgSrc={getMenuImgSrc}
            onAdd={(qty) => {
              addToBasket(selectedItem, qty);
            }}
          />
        </SlideModal>
      )}
    </div>
  );
};

export default SellerPage;
