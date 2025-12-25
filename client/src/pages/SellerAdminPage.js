import React, { useContext, useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { observer } from "mobx-react-lite";
import { Context } from "../index";
import {
  fetchMenuCategories,
  fetchMenuItems,
  deactivateMenuCategory,
  deactivateMenuItem,
  toggleMenuItemAvailability,
} from "../http/menuAPI";
import { checkSellerCanManage } from "../http/sellerAPI";
import { login } from "../http/userAPI";
import { useTranslation } from "react-i18next";

import Image from "react-bootstrap/Image";
import Accordion from "react-bootstrap/Accordion";
import Badge from "react-bootstrap/Badge";
import InputGroup from "react-bootstrap/InputGroup";
import Form from "react-bootstrap/Form";
import Button from "react-bootstrap/Button";

import CreateMenuCategory from "../components/modals/CreateMenuCategory";
import CreateMenuItem from "../components/modals/CreateMenuItem";
import styles from "./SellerAdminPage.module.css";

const API_BASE = process.env.REACT_APP_API_URL;

const getMenuImgSrc = (img) => {
  if (!img) return null;
  const base = API_BASE;

  if (/^https?:\/\//i.test(img)) return img;
  if (img.startsWith("/")) return `${base}${img}`;
  return `${base}/${img}`;
};

const SellerAdminPage = () => {
  const { sellerId } = useParams();
  const sid = Number(sellerId);

  const { user } = useContext(Context);
  const { t } = useTranslation();

  const [menuCategories, setMenuCategories] = useState([]);
  const [menuItems, setMenuItems] = useState([]);
  const [loading, setLoading] = useState(false);

  const [menuCategoryVisible, setMenuCategoryVisible] = useState(false);
  const [menuItemVisible, setMenuItemVisible] = useState(false);
  const [editableMenuCategory, setEditableMenuCategory] = useState(null);
  const [editableMenuItem, setEditableMenuItem] = useState(null);

  const [prefillCategoryId, setPrefillCategoryId] = useState(null);
  const [search, setSearch] = useState("");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState("");

  const [accessChecked, setAccessChecked] = useState(false);
  const [hasAccess, setHasAccess] = useState(false);
  const [accessError, setAccessError] = useState("");

  const [menuOpen, setMenuOpen] = useState(false);

  const reload = async () => {
    if (!sid) return;
    setLoading(true);
    try {
      const [cats, items] = await Promise.all([
        fetchMenuCategories(sid),
        fetchMenuItems(sid),
      ]);
      setMenuCategories(cats || []);
      setMenuItems(items || []);
    } catch (e) {
      console.error(e);
      alert(t("failed to load menu", { ns: "sellerAdminPage" }));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!sid || !user.isAuth) {
      setAccessChecked(false);
      setHasAccess(false);
      setAccessError("");
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        setAccessError("");
        await checkSellerCanManage(sid);
        if (cancelled) return;
        setHasAccess(true);
      } catch (e) {
        console.error(e);
        if (cancelled) return;
        setHasAccess(false);
        setAccessError(
          e?.response?.data?.message ||
            t("no access to this store", { ns: "sellerAdminPage" })
        );
      } finally {
        if (!cancelled) setAccessChecked(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [sid, user.isAuth, t]);

  useEffect(() => {
    if (!sid || !user.isAuth || !hasAccess) return;
    reload().catch(console.error);
  }, [sid, user.isAuth, hasAccess]);

  const sortedCategories = useMemo(() => {
    return [...(menuCategories || [])].sort(
      (a, b) =>
        (a.displayOrder ?? 0) - (b.displayOrder ?? 0) ||
        (a.id ?? 0) - (b.id ?? 0)
    );
  }, [menuCategories]);

  const filteredItemsByCategory = useMemo(() => {
    const q = search.trim().toLowerCase();

    const map = new Map();
    sortedCategories.forEach((c) => map.set(c.id, []));
    map.set("no", []);

    (menuItems || []).forEach((it) => {
      if (!it) return;

      if (q) {
        const hay = `${it.name || ""} ${it.description || ""}`.toLowerCase();
        if (!hay.includes(q)) return;
      }

      const key = it.categoryId || "no";
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(it);
    });

    for (const [k, arr] of map.entries()) {
      map.set(
        k,
        [...arr].sort(
          (a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0) || a.id - b.id
        )
      );
    }

    return map;
  }, [menuItems, sortedCategories, search]);

  const openCreateDish = (catId) => {
    setEditableMenuItem(null);
    setPrefillCategoryId(catId || null);
    setMenuItemVisible(true);
  };

  const handleToggleAvail = async (it) => {
    try {
      await toggleMenuItemAvailability(it.id, sid, !it.isAvailable);
      setMenuItems((prev) =>
        prev.map((x) =>
          x.id === it.id ? { ...x, isAvailable: !it.isAvailable } : x
        )
      );
    } catch (e) {
      console.error(e);
      alert(t("failed to change dish availability", { ns: "sellerAdminPage" }));
    }
  };

  const handleDeactivateItem = async (it) => {
    if (
      !window.confirm(
        t('deactivate dish "{{name}}"?', {
          ns: "sellerAdminPage",
          name: it.name,
        })
      )
    )
      return;
    try {
      await deactivateMenuItem(it.id, sid);
      await reload();
    } catch (e) {
      console.error(e);
      alert(t("failed to deactivate dish", { ns: "sellerAdminPage" }));
    }
  };

  const handleDeactivateCategory = async (cat) => {
    if (
      !window.confirm(
        t('deactivate category "{{name}}"?', {
          ns: "sellerAdminPage",
          name: cat.name,
        })
      )
    )
      return;
    try {
      await deactivateMenuCategory(cat.id, sid);
      await reload();
    } catch (e) {
      console.error(e);
      alert(t("failed to deactivate category", { ns: "sellerAdminPage" }));
    }
  };

  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    setAuthError("");

    if (!email.trim() || !password.trim()) {
      setAuthError(t("enter email and password", { ns: "sellerAdminPage" }));
      return;
    }

    try {
      setAuthLoading(true);
      const data = await login(email.trim(), password.trim());
      user.setUser(data);
      user.setIsAuth(true);
    } catch (err) {
      console.error(err);
      setAuthError(
        err?.response?.data?.message ||
          t("login error. please check your details.", {
            ns: "sellerAdminPage",
          })
      );
    } finally {
      setAuthLoading(false);
    }
  };

  const handleRelogin = () => {
    localStorage.removeItem("token");
    user.setUser({});
    user.setIsAuth(false);
  };

  const handleLogout = () => {
    setMenuOpen(false);
    localStorage.removeItem("token");
    user.setUser({});
    user.setIsAuth(false);
  };

  if (!sid) {
    return (
      <div style={{ padding: 20 }}>
        {t("sellerId was not found in the URL", { ns: "sellerAdminPage" })}
      </div>
    );
  }

  if (!user.isAuth) {
    return (
      <div className={styles.authWrapper}>
        <div className={styles.authBox}>
          <h2 className={styles.authTitle}>
            {t("restaurant admin login", { ns: "sellerAdminPage" })}
          </h2>

          {authError && <div className={styles.authError}>{authError}</div>}

          <form onSubmit={handleAuthSubmit} className={styles.authForm}>
            <label className={styles.authLabel}>
              {t("email", { ns: "sellerAdminPage" })}
              <input
                className={styles.authInput}
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t("email", { ns: "sellerAdminPage" })}
              />
            </label>

            <label className={styles.authLabel}>
              {t("password", { ns: "sellerAdminPage" })}
              <input
                className={styles.authInput}
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={t("password", { ns: "sellerAdminPage" })}
              />
            </label>

            <button
              type="submit"
              className={styles.authButton}
              disabled={authLoading}
            >
              {authLoading
                ? t("signing in...", { ns: "sellerAdminPage" })
                : t("sign in", { ns: "sellerAdminPage" })}
            </button>
          </form>
        </div>
      </div>
    );
  }

  if (user.isAuth && !accessChecked) {
    return (
      <div className={styles.authWrapper}>
        <div className={styles.authBox}>
          <h2 className={styles.authTitle}>
            {t("checking access...", { ns: "sellerAdminPage" })}
          </h2>
        </div>
      </div>
    );
  }

  if (user.isAuth && accessChecked && !hasAccess) {
    return (
      <div className={styles.authWrapper}>
        <div className={styles.authBox}>
          <h2 className={styles.authTitle}>
            {t("no access to this store", { ns: "sellerAdminPage" })}
          </h2>
          {accessError && (
            <p style={{ textAlign: "center", marginBottom: 8 }}>
              {accessError}
            </p>
          )}
          <button
            type="button"
            className={styles.authButton}
            onClick={handleRelogin}
          >
            {t("try signing in with another account", {
              ns: "sellerAdminPage",
            })}
          </button>
        </div>
      </div>
    );
  }

  const displayName =
    user.user?.email ||
    user.user?.name ||
    user.user?.phone ||
    t("user", { ns: "sellerAdminPage" });

  const renderItemRow = (it) => {
    const src = getMenuImgSrc(it.img);

    return (
      <div key={it.id} className={styles.item}>
        <div className={styles.itemLeft}>
          {src && (
            <Image
              src={src}
              alt={it.name}
              className={styles.itemImg}
              onError={(e) => {
                e.currentTarget.style.display = "none";
              }}
            />
          )}

          <div className={styles.itemText}>
            <div className={styles.itemTitle}>
              {it.name} <span className={styles.dot}>•</span> {it.price} €
            </div>
            {it.description && (
              <div className={styles.itemDesc}>{it.description}</div>
            )}
          </div>
        </div>

        <div className={styles.itemRight}>
          <Form.Check
            type="switch"
            id={`avail-${it.id}`}
            className={styles.availSwitch}
            label={
              it.isAvailable
                ? t("available", { ns: "sellerAdminPage" })
                : t("unavailable", { ns: "sellerAdminPage" })
            }
            checked={!!it.isAvailable}
            onChange={() => handleToggleAvail(it)}
          />

          <div className={styles.buttons}>
            <button
              className={styles.editButton}
              type="button"
              onClick={() => {
                setEditableMenuItem(it);
                setMenuItemVisible(true);
              }}
            >
              {t("edit", { ns: "sellerAdminPage" })}
            </button>

            <button
              className={styles.deleteButton}
              type="button"
              onClick={() => handleDeactivateItem(it)}
            >
              {t("deactivate", { ns: "sellerAdminPage" })}
            </button>
          </div>
        </div>
      </div>
    );
  };

  const totalItems = (menuItems || []).length;
  const totalCategories = (menuCategories || []).length;

  const defaultOpenKey =
    sortedCategories?.[0]?.id != null ? String(sortedCategories[0].id) : "no";

  return (
    <div className={styles.adminPageRoot}>
      <header className={styles.topBar}>
        <div className={styles.brandBlock}>
          <div className={styles.brandTitle}>
            {t("restaurant admin", { ns: "sellerAdminPage" })}
          </div>
          <div className={styles.brandSubtitle}>
            {t("manage menu and settings", { ns: "sellerAdminPage" })}
          </div>
        </div>

        <div className={styles.topRight}>
          <span className={styles.userName}>{displayName}</span>

          <button
            type="button"
            className={styles.burgerButton}
            onClick={() => setMenuOpen((v) => !v)}
          >
            <span className={styles.burgerLines} />
          </button>

          {menuOpen && (
            <div className={styles.menuDropdown}>
              <button
                type="button"
                className={styles.menuItemButton}
                onClick={() => setMenuOpen(false)}
              >
                {t("restaurant settings", { ns: "sellerAdminPage" })}
                <span className={styles.menuItemSoon}>
                  {t("soon", { ns: "sellerAdminPage" })}
                </span>
              </button>

              <button
                type="button"
                className={styles.menuItemButton}
                onClick={() => setMenuOpen(false)}
              >
                {t("working hours", { ns: "sellerAdminPage" })}
                <span className={styles.menuItemSoon}>
                  {t("soon", { ns: "sellerAdminPage" })}
                </span>
              </button>

              <button
                type="button"
                className={styles.menuItemButton}
                onClick={() => setMenuOpen(false)}
              >
                {t("delivery and pickup", { ns: "sellerAdminPage" })}
                <span className={styles.menuItemSoon}>
                  {t("soon", { ns: "sellerAdminPage" })}
                </span>
              </button>

              <button
                type="button"
                className={styles.menuItemButton}
                onClick={() => setMenuOpen(false)}
              >
                {t("payments and integrations", { ns: "sellerAdminPage" })}
                <span className={styles.menuItemSoon}>
                  {t("soon", { ns: "sellerAdminPage" })}
                </span>
              </button>

              <div className={styles.menuDivider} />

              <button
                type="button"
                className={`${styles.menuItemButton} ${styles.menuItemDanger}`}
                onClick={handleLogout}
              >
                {t("sign out", { ns: "sellerAdminPage" })}
              </button>
            </div>
          )}
        </div>
      </header>

      <div className={styles.adminPanelContainer}>
        <div className={styles.pageHeader}>
          <div>
            <h2 className={styles.pageTitle}>
              {t("menu", { ns: "sellerAdminPage" })}
            </h2>
            <div className={styles.pageMeta}>
              <span>
                {t("categories", { ns: "sellerAdminPage" })}:{" "}
                <b>{totalCategories}</b>
              </span>
              <span className={styles.metaDot}>•</span>
              <span>
                {t("dishes", { ns: "sellerAdminPage" })}: <b>{totalItems}</b>
              </span>
            </div>
          </div>

          <div className={styles.actionButtons}>
            <button
              className={styles.actionButton}
              type="button"
              onClick={() => {
                setEditableMenuCategory(null);
                setMenuCategoryVisible(true);
              }}
            >
              {t("+ category", { ns: "sellerAdminPage" })}
            </button>

            <button
              className={styles.actionButton}
              type="button"
              onClick={() => openCreateDish(null)}
            >
              {t("+ dish", { ns: "sellerAdminPage" })}
            </button>
          </div>
        </div>

        <div className={styles.searchRow}>
          <InputGroup>
            <Form.Control
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("search dishes...", { ns: "sellerAdminPage" })}
            />
            {search.trim() ? (
              <Button variant="outline-secondary" onClick={() => setSearch("")}>
                ✕
              </Button>
            ) : null}
          </InputGroup>
        </div>

        {loading && (
          <div className={styles.loadingRow}>
            {t("loading menu...", { ns: "sellerAdminPage" })}
          </div>
        )}

        <Accordion alwaysOpen defaultActiveKey={defaultOpenKey}>
          {sortedCategories.map((cat) => {
            const list = filteredItemsByCategory.get(cat.id) || [];
            const count = list.length;

            return (
              <Accordion.Item key={cat.id} eventKey={String(cat.id)}>
                <Accordion.Header>
                  <div className={styles.catHeader}>
                    <div className={styles.catTitleWrap}>
                      <span className={styles.catTitle}>{cat.name}</span>

                      <Badge
                        bg={cat.isActive ? "success" : "secondary"}
                        className={styles.badge}
                      >
                        {cat.isActive ? "active" : "off"}
                      </Badge>

                      <Badge bg="light" text="dark" className={styles.badge}>
                        {count}
                      </Badge>
                    </div>

                    <div
                      className={styles.catActions}
                      onClick={(e) => e.stopPropagation()}
                      onMouseDown={(e) => e.stopPropagation()}
                    >
                      <button
                        type="button"
                        className={styles.smallButton}
                        onClick={() => openCreateDish(cat.id)}
                      >
                        + {t("dish", { ns: "sellerAdminPage" })}
                      </button>

                      <button
                        type="button"
                        className={styles.smallButton}
                        onClick={() => {
                          setEditableMenuCategory(cat);
                          setMenuCategoryVisible(true);
                        }}
                      >
                        {t("edit", { ns: "sellerAdminPage" })}
                      </button>

                      <button
                        type="button"
                        className={styles.smallDanger}
                        onClick={() => handleDeactivateCategory(cat)}
                      >
                        {t("deactivate", { ns: "sellerAdminPage" })}
                      </button>
                    </div>
                  </div>
                </Accordion.Header>

                <Accordion.Body>
                  {count === 0 ? (
                    <div className={styles.emptyBlock}>
                      <div className={styles.emptyText}>
                        {t("no dishes yet", { ns: "sellerAdminPage" })}
                      </div>
                      <button
                        className={styles.actionButton}
                        type="button"
                        onClick={() => openCreateDish(cat.id)}
                      >
                        + {t("dish", { ns: "sellerAdminPage" })}
                      </button>
                    </div>
                  ) : (
                    <div className={styles.itemList}>
                      {list.map((it) => renderItemRow(it))}
                    </div>
                  )}
                </Accordion.Body>
              </Accordion.Item>
            );
          })}

          <Accordion.Item eventKey="no">
            <Accordion.Header>
              <div className={styles.catHeader}>
                <div className={styles.catTitleWrap}>
                  <span className={styles.catTitle}>
                    {t("uncategorized", { ns: "sellerAdminPage" })}
                  </span>
                  <Badge bg="light" text="dark" className={styles.badge}>
                    {(filteredItemsByCategory.get("no") || []).length}
                  </Badge>
                </div>
              </div>
            </Accordion.Header>

            <Accordion.Body>
              {(filteredItemsByCategory.get("no") || []).length === 0 ? (
                <div className={styles.emptyText}>
                  {t("empty", { ns: "sellerAdminPage" })}
                </div>
              ) : (
                <div className={styles.itemList}>
                  {(filteredItemsByCategory.get("no") || []).map((it) =>
                    renderItemRow(it)
                  )}
                </div>
              )}
            </Accordion.Body>
          </Accordion.Item>
        </Accordion>
      </div>

      <CreateMenuCategory
        show={menuCategoryVisible}
        sellerId={sid}
        editableCategory={editableMenuCategory}
        onHide={() => {
          setMenuCategoryVisible(false);
          setEditableMenuCategory(null);
        }}
        onSaved={async () => {
          const cats = await fetchMenuCategories(sid);
          setMenuCategories(cats || []);
        }}
      />

      <CreateMenuItem
        show={menuItemVisible}
        sellerId={sid}
        editableItem={editableMenuItem}
        categories={menuCategories}
        initialCategoryId={prefillCategoryId}
        onHide={() => {
          setMenuItemVisible(false);
          setEditableMenuItem(null);
          setPrefillCategoryId(null);
        }}
        onSaved={async () => {
          const items = await fetchMenuItems(sid);
          setMenuItems(items || []);
        }}
      />
    </div>
  );
};

export default observer(SellerAdminPage);
