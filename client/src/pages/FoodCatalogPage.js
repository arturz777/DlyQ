import React, { useContext, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { Context } from "../index";
import { searchFood } from "../http/foodCatalogAPI";
import { fetchSellers } from "../http/sellerAPI";
import SlideModal from "../components/modals/SlideModal";
import DishModal from "../components/DishModal";
import styles from "./FoodCatalogPage.module.css";
import { useTranslation } from "react-i18next";

const API_BASE = process.env.REACT_APP_API_URL;

const getImgSrc = (img) => {
  if (!img) return null;
  if (/^https?:\/\//i.test(img)) return img;
  if (img.startsWith("/")) return `${API_BASE}${img}`;
  return `${API_BASE}/${img}`;
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

const POPULAR_QUERIES = ["Пицца", "Суши", "Бургер", "Шаурма", "Паста", "Салат"];

const FoodCatalogPage = () => {
  const navigate = useNavigate();
  const { basket } = useContext(Context);

  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [sellers, setSellers] = useState([]);
  const [items, setItems] = useState([]);
  const [error, setError] = useState("");

  const [topSellers, setTopSellers] = useState([]);
  const [selectedItemId, setSelectedItemId] = useState(null);

  const debounceRef = useRef(null);
  const inputRef = useRef(null);
  const { t, i18n } = useTranslation();
  const uiLang = normUiLang(i18n.language);

  const selectedItem = useMemo(() => {
    return items.find((x) => String(x.id) === String(selectedItemId)) || null;
  }, [items, selectedItemId]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const list = await fetchSellers();
        if (cancelled) return;

        const active = (Array.isArray(list) ? list : []).filter(
          (s) => s?.isActive !== false
        );
        setTopSellers(active.slice(0, 12));
      } catch (e) {
        console.error("top sellers load error", e);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    inputRef.current?.focus?.();
  }, []);

  const ensureSingleSeller = (rawNewSellerId) => {
    const normalizeSellerId = (sid) => {
      const n = Number(sid);
      return Number.isFinite(n) && n > 0 ? n : null;
    };

    const newSellerId = normalizeSellerId(rawNewSellerId);

    const sellerIds = (basket.items || []).map((it) =>
      typeof basket.getItemSellerId === "function"
        ? basket.getItemSellerId(it)
        : normalizeSellerId(it.sellerId)
    );

    if (sellerIds.length === 0) return true;

    const unique = Array.from(new Set(sellerIds.filter(Boolean)));
    if (unique.length === 1 && unique[0] === newSellerId) return true;

    const ok = window.confirm(
      "В корзине товары другого ресторана. Очистить корзину и добавить этот товар?"
    );
    if (!ok) return false;

    if (typeof basket.clearAll === "function") basket.clearAll();
    else {
      (basket.items || []).slice().forEach((it) => {
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

    const sellerId = item?.seller?.id ?? item?.sellerId ?? null;
    if (!ensureSingleSeller(sellerId)) return;

    const itemName = pickTr(item.name, item.translations?.name, uiLang);

    for (let i = 0; i < qty; i++) {
      basket.addItem({
        id: item.id,
        name: item.name,
        translations: item.translations,
        price: Number(item.price) || 0,
        img: item.img || null,
        sellerId: Number(sellerId) || null,
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
      });
    }

    toast.success(
      <>
        <strong>{itemName}</strong>
        <div>Добавлено в корзину</div>
      </>
    );
  };

  useEffect(() => {
    setError("");
    if (debounceRef.current) clearTimeout(debounceRef.current);

    const q = query.trim();
    if (!q) {
      setSellers([]);
      setItems([]);
      setLoading(false);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      try {
        setLoading(true);
        const data = await searchFood(q, 30);
        setSellers(Array.isArray(data?.sellers) ? data.sellers : []);
        setItems(Array.isArray(data?.items) ? data.items : []);
      } catch (e) {
        console.error(e);
        setError("Ошибка поиска");
        setSellers([]);
        setItems([]);
      } finally {
        setLoading(false);
      }
    }, 250);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  const qTrim = query.trim();

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>Поиск</h1>
        <div className={styles.subtitle}>
          Рестораны и блюда (например: “пицца”, “суши”, “бургер”)
        </div>
      </div>

      <div className={styles.searchWrap}>
        <input
          ref={inputRef}
          className={styles.searchInput}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Начните вводить…"
          autoComplete="off"
        />
        {query && (
          <button
            type="button"
            className={styles.clearBtn}
            onClick={() => setQuery("")}
            aria-label="Очистить"
          >
            ✕
          </button>
        )}
      </div>

      {error ? <div className={styles.error}>{error}</div> : null}

      {!qTrim ? (
        <div className={styles.emptyState}>
          <div className={styles.block}>
            <div className={styles.blockTitle}>Популярные запросы</div>
            <div className={styles.chips}>
              {POPULAR_QUERIES.map((x) => (
                <button
                  key={x}
                  type="button"
                  className={styles.chip}
                  onClick={() => setQuery(x)}
                >
                  {x}
                </button>
              ))}
            </div>

            <div className={styles.hint}>
              Введите запрос, чтобы найти ресторан или блюдо.
            </div>
          </div>

          <div className={styles.block}>
            <div className={styles.blockTitle}>Популярные рестораны</div>

            {topSellers.length === 0 ? (
              <div className={styles.empty}>Пока пусто</div>
            ) : (
              <div className={styles.topSellersGrid}>
                {topSellers.map((s) => {
                  const slugOrId = s.slug || s.id;
                  const img = getImgSrc(s.img);

                  return (
                    <button
                      key={s.id}
                      type="button"
                      className={styles.topSellerCard}
                      onClick={() =>
                        navigate(`/seller/${slugOrId}`, {
                          state: { seller: s },
                        })
                      }
                    >
                      {img ? (
                        <img
                          src={img}
                          alt={s.name}
                          className={styles.topSellerImg}
                          onError={(e) =>
                            (e.currentTarget.style.display = "none")
                          }
                        />
                      ) : (
                        <div className={styles.topSellerImgStub} />
                      )}
                      <div className={styles.topSellerName}>{s.name}</div>
                      {s.kind ? (
                        <div className={styles.topSellerKind}>{s.kind}</div>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      ) : null}

      {loading && qTrim ? <div className={styles.loading}>Поиск…</div> : null}

      {!loading && qTrim ? (
        <div className={styles.grid}>
          <section className={styles.block}>
            <div className={styles.blockTitle}>Рестораны</div>

            {sellers.length === 0 ? (
              <div className={styles.empty}>Ничего не найдено</div>
            ) : (
              <div className={styles.sellersList}>
                {sellers.map((s) => {
                  const slugOrId = s.slug || s.id;
                  const img = getImgSrc(s.img);

                  return (
                    <button
                      key={s.id}
                      type="button"
                      className={styles.sellerCard}
                      onClick={() =>
                        navigate(`/seller/${slugOrId}`, {
                          state: { seller: s },
                        })
                      }
                    >
                      <div className={styles.sellerLeft}>
                        {img ? (
                          <img
                            src={img}
                            alt={s.name}
                            className={styles.sellerImg}
                            onError={(e) =>
                              (e.currentTarget.style.display = "none")
                            }
                          />
                        ) : (
                          <div className={styles.sellerImgStub} />
                        )}
                      </div>

                      <div className={styles.sellerInfo}>
                        <div className={styles.sellerName}>{s.name}</div>
                        {s.kind ? (
                          <div className={styles.sellerKind}>{s.kind}</div>
                        ) : null}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </section>

          <section className={styles.block}>
            <div className={styles.blockTitle}>Блюда</div>

            {items.length === 0 ? (
              <div className={styles.empty}>Ничего не найдено</div>
            ) : (
              <div className={styles.itemsList}>
                {items.map((it) => {
                  const img = getImgSrc(it.img);
                  const sellerTitle = it?.seller?.name || "Ресторан";
                  const sellerSlugOrId = it?.seller?.slug || it?.sellerId;
                  const itName = pickTr(it.name, it.translations?.name, uiLang);

                  return (
                    <div
                      key={it.id}
                      className={styles.itemCard}
                      role="button"
                      tabIndex={0}
                      onClick={() => setSelectedItemId(it.id)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ")
                          setSelectedItemId(it.id);
                      }}
                    >
                      {img ? (
                        <img
                          src={img}
                          alt={itName}
                          className={styles.itemImg}
                          onError={(e) =>
                            (e.currentTarget.style.display = "none")
                          }
                        />
                      ) : (
                        <div className={styles.itemImgStub} />
                      )}

                      <div className={styles.itemContent}>
                        <div className={styles.itemTop}>
                          <div className={styles.itemName}>{itName}</div>
                          <div className={styles.itemPrice}>
                            {Number(it.price || 0).toFixed(2)} €
                          </div>
                        </div>

                        <button
                          type="button"
                          className={styles.sellerLink}
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            if (sellerSlugOrId)
                              navigate(`/seller/${sellerSlugOrId}`);
                          }}
                          title={sellerTitle}
                        >
                          {sellerTitle}
                        </button>

                        {it?.category?.name ? (
                          <div className={styles.itemMeta}>
                            Категория: {it.category.name}
                          </div>
                        ) : null}

                        <div className={styles.itemBottom}>
                          <button
                            type="button"
                            className={styles.addBtn}
                            disabled={!it.isAvailable}
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              addToBasket(it, 1);
                            }}
                          >
                            {it.isAvailable ? "Добавить" : "Нет в наличии"}
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      ) : null}

      {selectedItem
        ? (() => {
            const title = pickTr(
              selectedItem.name,
              selectedItem.translations?.name,
              uiLang
            );
            const desc = pickTr(
              selectedItem.description,
              selectedItem.translations?.description,
              uiLang
            );

            return (
              <SlideModal title={title} onClose={() => setSelectedItemId(null)}>
                <DishModal
                  item={{ ...selectedItem, name: title, description: desc }}
                  seller={selectedItem?.seller || null}
                  getImgSrc={getImgSrc}
                  onAdd={(qty) => addToBasket(selectedItem, qty)}
                />
              </SlideModal>
            );
          })()
        : null}
    </div>
  );
};

export default FoodCatalogPage;
