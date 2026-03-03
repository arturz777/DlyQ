import React, {
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
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

const getTodayHoursText = (workHours) => {
  if (!workHours || typeof workHours !== "object") return null;

  const day = new Date().getDay();
  const key = day === 0 ? "sunday" : day === 6 ? "saturday" : "weekdays";

  const v = workHours[key];
  if (!v) return null;

  if (v.closed) return "Закрыто";

  if (v.start && v.end) return `${v.start}–${v.end}`;

  return null;
};

const formatWorkHours = (workHours, t) => {
  if (!workHours || typeof workHours !== "object") return [];

  const rows = [];

  const map = [
    {
      key: "weekdays",
      label: t("weekdays", { ns: "sellerPage" }) || "Пн–Пт",
    },
    {
      key: "saturday",
      label: t("saturday", { ns: "sellerPage" }) || "Сб",
    },
    {
      key: "sunday",
      label: t("sunday", { ns: "sellerPage" }) || "Вс",
    },
  ];

  for (const { key, label } of map) {
    const v = workHours[key];
    if (!v) continue;

    if (v.closed) {
      rows.push({
        label,
        value: t("closed", { ns: "sellerPage" }) || "Закрыто",
      });
      continue;
    }

    if (v.start && v.end) {
      rows.push({ label, value: `${v.start} – ${v.end}` });
    }
  }

  return rows;
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
  const [showContacts, setShowContacts] = useState(false);
  const mobileCatsNavRef = useRef(null);
  const catsAnchorRef = useRef(null);
  const [catsSticky, setCatsSticky] = useState(false);
  const catsStickYRef = useRef(0);
  const [activeCatId, setActiveCatId] = useState(null);
  const catsRowRef = useRef(null);
  const [navOffset, setNavOffset] = useState(70);
  const [isDesktop, setIsDesktop] = useState(false);
  const programmaticScrollRef = useRef(false);
  const programmaticTimerRef = useRef(null);
  const freezeActiveUntilRef = useRef(0);
  const { t, i18n } = useTranslation();
  const uiLang = normUiLang(i18n.language);

  const selectedItem = useMemo(
    () => items.find((x) => String(x.id) === String(selectedItemId)) || null,
    [items, selectedItemId],
  );

  const measureStickY = () => {
    const mql = window.matchMedia("(max-width: 768px)");
    if (!mql.matches) {
      catsStickYRef.current = 0;
      return;
    }
    const anchor = catsAnchorRef.current;
    if (!anchor) return;

    catsStickYRef.current = anchor.getBoundingClientRect().top + window.scrollY;
  };

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
      const refreshed = await fetchSellers();
      const freshSeller =
        refreshed.find(
          (s) =>
            String(s.id) === String(idOrSlug) ||
            (s.slug && s.slug === idOrSlug),
        ) || null;

      if (freshSeller) setSeller(freshSeller);
    };

    loadSellerAndMenu();
  }, [idOrSlug]);

  useLayoutEffect(() => {
    if (!categories.length) return;
    measureStickY();
  }, [categories.length]);

  useEffect(() => {
    const mql = window.matchMedia("(max-width: 768px)");

    let raf = 0;

    const onScroll = () => {
      if (!mql.matches) {
        if (catsSticky) setCatsSticky(false);
        return;
      }

      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const y = window.scrollY;
        let stickY = catsStickYRef.current || 0;

        if (!stickY) {
          measureStickY();
          stickY = catsStickYRef.current || 0;
        }

        if (!stickY) {
          setCatsSticky(false);
          return;
        }

        setCatsSticky(y >= stickY - 1);
      });
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);

    window.addEventListener("resize", () => {
      measureStickY();
      onScroll();
    });

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [catsSticky]);

  useEffect(() => {
    const mql = window.matchMedia("(min-width: 769px)");
    const set = () => setIsDesktop(mql.matches);

    set();
    if (mql.addEventListener) mql.addEventListener("change", set);
    else mql.addListener(set);

    return () => {
      if (mql.removeEventListener) mql.removeEventListener("change", set);
      else mql.removeListener(set);
    };
  }, []);

  useEffect(() => {
    return () => {
      if (programmaticTimerRef.current) {
        clearTimeout(programmaticTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!isDesktop) return;

    let raf = 0;
    let followRaf = 0;
    let followUntil = 0;

    const read = () => {
      const navbar = document.querySelector("[data-navbar-inner]");
      if (!navbar) {
        setNavOffset(0);
        return;
      }
      const r = navbar.getBoundingClientRect();
      setNavOffset(Math.max(0, Math.round(r.bottom)));
    };

    const follow = (now) => {
      read();
      if (now < followUntil) {
        followRaf = requestAnimationFrame(follow);
      } else {
        followRaf = 0;
      }
    };

    const kickFollow = () => {
      followUntil = performance.now() + 500;
      if (!followRaf) followRaf = requestAnimationFrame(follow);
    };

    const update = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        read();
        kickFollow();
      });
    };

    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);

    const navbar = document.querySelector("[data-navbar-inner]");
    const onTransition = () => kickFollow();
    navbar?.addEventListener("transitionrun", onTransition);
    navbar?.addEventListener("transitionend", onTransition);

    read();

    return () => {
      cancelAnimationFrame(raf);
      if (followRaf) cancelAnimationFrame(followRaf);
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
      navbar?.removeEventListener("transitionrun", onTransition);
      navbar?.removeEventListener("transitionend", onTransition);
    };
  }, [isDesktop]);

  useEffect(() => {
    if (!categories.length) return;

    const mql = window.matchMedia("(max-width: 768px)");
    const getTopOffset = () => {
      const isMobile = mql.matches;
      const navH = mobileCatsNavRef.current?.offsetHeight || 0;
      return isMobile ? navH + 10 : navOffset + navH + 10;
    };

    const elements = categories
      .map((c) => document.getElementById(`cat-${c.id}`))
      .filter(Boolean);

    if (!elements.length) return;

    let raf = 0;

    const updateActive = () => {
      if (performance.now() < freezeActiveUntilRef.current) return;
      if (programmaticScrollRef.current) return;

      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const offset = getTopOffset();

        let current = elements[0];
        for (const el of elements) {
          const top = el.getBoundingClientRect().top;
          if (top - offset <= 10) current = el;
          else break;
        }

        const id = current.id.replace("cat-", "");
        setActiveCatId(id);
      });
    };
    //    начало !!!!!!!!!!!!!!!!!!!!!!!!!!!!!
    window.addEventListener("scroll", updateActive, { passive: true });
    window.addEventListener("resize", updateActive);
    if (mql.addEventListener) mql.addEventListener("change", updateActive);
    else mql.addListener(updateActive);

    updateActive();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", updateActive);
      window.removeEventListener("resize", updateActive);
      if (mql.removeEventListener)
        mql.removeEventListener("change", updateActive);
      else mql.removeListener(updateActive);
    };
  }, [categories, navOffset]);

  useEffect(() => {
    const row = catsRowRef.current;
    if (!row || !activeCatId) return;

    const pill = row.querySelector(`[data-cat-pill="${activeCatId}"]`);
    if (!pill) return;

    const targetLeft =
      pill.offsetLeft - (row.clientWidth / 2 - pill.clientWidth / 2);
    const maxLeft = row.scrollWidth - row.clientWidth;
    const clamped = Math.max(0, Math.min(targetLeft, maxLeft));

    row.scrollTo({ left: clamped, behavior: "smooth" });
  }, [activeCatId]);

  useEffect(() => {
    if (!categories.length) return;
    setActiveCatId((prev) => prev ?? categories[0].id);
  }, [categories.length]);

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
      price: Number(unitPrice) || Number(item.price) || 0,
      img: item.img || null,
      sellerId: newSellerId,
      isRestaurantItem: true,
      isPreorder: false,
      defaultSelected: true,
      isAgeRestricted: !!item.isAgeRestricted,
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

      <div className={styles.metaRow}>
        <span className={seller.isOpenNow ? styles.open : styles.closed}>
          {seller.isOpenNow
            ? t("open", { ns: "sellerPage" })
            : t("closed", { ns: "sellerPage" })}
        </span>

        {seller.workHours && (
          <span className={styles.metaHours}>
            <span className={styles.dot}>• Работает с</span>
            {getTodayHoursText(seller.workHours) || "—"} •{" "}
            <span
              className={styles.moreLink}
              role="button"
              tabIndex={0}
              onClick={() => setShowContacts(true)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") setShowContacts(true);
              }}
            >
              {t("more", { ns: "sellerPage" })}…
            </span>
          </span>
        )}
      </div>

      {error && seller && <div className={styles.error}>{error}</div>}

      {menuLoading ? (
        <div className={styles.center}>
          {t("loading menu...", { ns: "sellerPage" })}
        </div>
      ) : (
        <div className={styles.menuWrapper}>
          <div ref={catsAnchorRef} className={styles.catsAnchor} />
          {categories.length > 0 && (
            <nav
              ref={mobileCatsNavRef}
              className={`${styles.mobileCatsNav} ${
                catsSticky ? styles.mobileCatsNavFixed : ""
              }`}
              style={
                isDesktop
                  ? { top: `${navOffset}px` }
                  : catsSticky
                    ? { top: "env(safe-area-inset-top)" }
                    : undefined
              }
            >
              <div ref={catsRowRef} className={styles.mobileCatsRow}>
                {categories.map((cat) => {
                  const catName = pickTr(
                    cat.name,
                    cat.translations?.name,
                    uiLang,
                  );
                  const isActive = String(activeCatId) === String(cat.id);

                  return (
                    <button
                      key={cat.id}
                      data-cat-pill={cat.id}
                      type="button"
                      className={
                        isActive ? styles.catPillActive : styles.catPill
                      }
                      onClick={() => {
                        const el = document.getElementById(`cat-${cat.id}`);
                        if (!el) return;

                        setActiveCatId(cat.id);

                        freezeActiveUntilRef.current = performance.now() + 800;

                        const navH =
                          mobileCatsNavRef.current?.offsetHeight || 0;
                        const isMobile =
                          window.matchMedia("(max-width: 768px)").matches;

                        const offset = isMobile
                          ? navH + 10
                          : navOffset + navH + 10;

                        const top =
                          el.getBoundingClientRect().top + window.scrollY;
                        const y = Math.max(0, top - offset);

                        programmaticScrollRef.current = false;
                        if (programmaticTimerRef.current)
                          clearTimeout(programmaticTimerRef.current);

                        window.__lockNavbar = true;
                        programmaticScrollRef.current = true;

                        window.scrollTo({ top: y, behavior: "smooth" });

                        clearTimeout(programmaticTimerRef.current);
                        programmaticTimerRef.current = setTimeout(() => {
                          window.__lockNavbar = false;
                          programmaticScrollRef.current = false;
                        }, 900);
                      }}
                    >
                      <span className={styles.catPillText}>{catName}</span>
                    </button>
                  );
                })}
              </div>
            </nav>
          )}

          <div
            className={`${styles.menuContent} ${
              categories.length > 0 && catsSticky ? styles.withFixedCatsNav : ""
            }`}
          >
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
                                    {item.isAgeRestricted && (
                                      <span className={styles.ageBadge}>
                                        18+
                                      </span>
                                    )}
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
        </div>
      )}

      {seller && showContacts && (
        <SlideModal title="Больше" onClose={() => setShowContacts(false)}>
          <div className={styles.moreModalRoot}>
            <div className={styles.moreCard}>
              <h3 className={styles.moreTitle}>{seller.name}</h3>

              <div className={styles.stackList}>
                <div className={styles.stackLabel}>
                  Если у вас есть аллергия или диетические ограничения,
                  пожалуйста свяжитесь с рестораном для белее точной информацией
                  о блюдах.
                </div>
                <div className={styles.stackLabel}>
                  Партнер обязуеться предлогать только продукты или услуги
                  соответствующие действующиму законодательству.
                </div>
                <div className={styles.sectionTitle}>Контакты</div>
                <div className={styles.stackItem}>
                  <div className={styles.stackLabel}>Юр. название</div>
                  <div className={styles.stackValue}>
                    {seller.companyName || "—"}
                  </div>
                </div>

                <div className={styles.stackItem}>
                  <div className={styles.stackLabel}>Рег. номер</div>
                  <div className={styles.stackValue}>
                    {seller.registrationNumber || "—"}
                  </div>
                </div>

                <div className={styles.stackItem}>
                  <div className={styles.stackLabel}>Адрес</div>
                  <div className={styles.stackValue}>
                    {seller.address || "—"}
                  </div>
                </div>

                <div className={styles.stackItem}>
                  <div className={styles.stackLabel}>Телефон</div>
                  <div className={styles.stackValue}>
                    {seller.phone ? (
                      <a
                        href={`tel:${seller.phone}`}
                        className={styles.linkPill}
                      >
                        {seller.phone}
                      </a>
                    ) : (
                      "—"
                    )}
                  </div>
                </div>

                <div className={styles.stackItem}>
                  <div className={styles.stackLabel}>Сайт</div>
                  <div className={styles.stackValue}>
                    {seller.website ? (
                      <a
                        href={
                          seller.website.startsWith("http")
                            ? seller.website
                            : `https://${seller.website}`
                        }
                        target="_blank"
                        rel="noreferrer"
                        className={styles.linkPill}
                      >
                        {seller.website}
                      </a>
                    ) : (
                      "—"
                    )}
                  </div>
                </div>
              </div>

              <div className={styles.stackSection}>
                <div className={styles.sectionTitle}>Время работы</div>

                <div className={styles.stackList}>
                  {formatWorkHours(seller.workHours, t).map((row) => (
                    <div key={row.label} className={styles.stackItem}>
                      <div className={styles.stackLabel}>{row.label}</div>
                      <div className={styles.stackValue}>{row.value}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </SlideModal>
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
