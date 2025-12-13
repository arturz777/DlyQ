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
import Image from "react-bootstrap/Image";
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

  const [menuCategories, setMenuCategories] = useState([]);
  const [menuItems, setMenuItems] = useState([]);
  const [loading, setLoading] = useState(false);

  const [menuCategoryVisible, setMenuCategoryVisible] = useState(false);
  const [menuItemVisible, setMenuItemVisible] = useState(false);
  const [editableMenuCategory, setEditableMenuCategory] = useState(null);
  const [editableMenuItem, setEditableMenuItem] = useState(null);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState("");
  const [accessChecked, setAccessChecked] = useState(false);
  const [hasAccess, setHasAccess] = useState(false);
  const [accessError, setAccessError] = useState("");

  const [menuOpen, setMenuOpen] = useState(false);

  const handleRetryAsAnotherUser = () => {
    localStorage.removeItem("token");
    user.setUser({});
    user.setIsAuth(false);
  };

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
      alert("Не удалось загрузить меню");
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
          e?.response?.data?.message || "Нет доступа к этому магазину"
        );
      } finally {
        if (!cancelled) {
          setAccessChecked(true);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [sid, user.isAuth]);

  useEffect(() => {
    if (!sid || !user.isAuth || !hasAccess) return;
    reload().catch(console.error);
  }, [sid, user.isAuth, hasAccess]);

  const itemsByCategory = useMemo(() => {
    const map = new Map();
    (menuCategories || []).forEach((c) => map.set(c.id, []));
    map.set("no", []);

    (menuItems || []).forEach((it) => {
      const key = it.categoryId || "no";
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(it);
    });

    return map;
  }, [menuCategories, menuItems]);

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
      alert("Не удалось изменить доступность блюда");
    }
  };

  const handleDeactivateItem = async (it) => {
    if (!window.confirm(`Деактивировать блюдо "${it.name}"?`)) return;
    try {
      await deactivateMenuItem(it.id, sid);
      await reload();
    } catch (e) {
      console.error(e);
      alert("Не удалось деактивировать блюдо");
    }
  };

  const handleDeactivateCategory = async (cat) => {
    if (!window.confirm(`Деактивировать категорию "${cat.name}"?`)) return;
    try {
      await deactivateMenuCategory(cat.id, sid);
      const cats = await fetchMenuCategories(sid);
      setMenuCategories(cats || []);
      const items = await fetchMenuItems(sid);
      setMenuItems(items || []);
    } catch (e) {
      console.error(e);
      alert("Не удалось деактивировать категорию");
    }
  };

  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    setAuthError("");
    if (!email.trim() || !password.trim()) {
      setAuthError("Введите e-mail и пароль");
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
        err?.response?.data?.message || "Ошибка входа. Проверьте данные."
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

  if (!sid)
    return <div style={{ padding: 20 }}>sellerId не найден в адресе</div>;

  const role = String(user.user?.role || "").toUpperCase();

  if (!user.isAuth) {
    return (
      <div className={styles.authWrapper}>
        <div className={styles.authBox}>
          <h2 className={styles.authTitle}>Вход в админку ресторана</h2>
          {authError && <div className={styles.authError}>{authError}</div>}

          <form onSubmit={handleAuthSubmit} className={styles.authForm}>
            <label className={styles.authLabel}>
              E-mail
              <input
                className={styles.authInput}
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="email"
              />
            </label>

            <label className={styles.authLabel}>
              Пароль
              <input
                className={styles.authInput}
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Пароль"
              />
            </label>

            <button
              type="submit"
              className={styles.authButton}
              disabled={authLoading}
            >
              {authLoading ? "Входим…" : "Войти"}
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
          <h2 className={styles.authTitle}>Проверяем доступ…</h2>
        </div>
      </div>
    );
  }

  if (user.isAuth && accessChecked && !hasAccess) {
    return (
      <div className={styles.authWrapper}>
        <div className={styles.authBox}>
          <h2 className={styles.authTitle}>Нет доступа к этому магазину</h2>
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
            Попробовать войти другим аккаунтом
          </button>
        </div>
      </div>
    );
  }

  const displayName =
    user.user?.email || user.user?.name || user.user?.phone || "Пользователь";

  return (
    <div className={styles.adminPageRoot}>
      <header className={styles.topBar}>
        <div className={styles.brandBlock}>
          <div className={styles.brandTitle}>Админка ресторана</div>
          <div className={styles.brandSubtitle}>
            Управление меню и настройками
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
                onClick={() => {
                  setMenuOpen(false);
                }}
              >
                Настройки ресторана
                <span className={styles.menuItemSoon}>скоро</span>
              </button>

              <button
                type="button"
                className={styles.menuItemButton}
                onClick={() => {
                  setMenuOpen(false);
                }}
              >
                Время работы
                <span className={styles.menuItemSoon}>скоро</span>
              </button>

              <button
                type="button"
                className={styles.menuItemButton}
                onClick={() => {
                  setMenuOpen(false);
                }}
              >
                Доставка и самовывоз
                <span className={styles.menuItemSoon}>скоро</span>
              </button>

              <button
                type="button"
                className={styles.menuItemButton}
                onClick={() => {
                  setMenuOpen(false);
                }}
              >
                Оплата и интеграции
                <span className={styles.menuItemSoon}>скоро</span>
              </button>

              <div className={styles.menuDivider} />

              <button
                type="button"
                className={`${styles.menuItemButton} ${styles.menuItemDanger}`}
                onClick={handleLogout}
              >
                Выйти
              </button>
            </div>
          )}
        </div>
      </header>

      <div className={styles.adminPanelContainer}>
        <h2 style={{ marginBottom: 16 }}>Меню</h2>

        <div className={styles.actionButtons}>
          <button
            className={styles.actionButton}
            type="button"
            onClick={() => {
              setEditableMenuCategory(null);
              setMenuCategoryVisible(true);
            }}
          >
            + Категория
          </button>

          <button
            className={styles.actionButton}
            type="button"
            onClick={() => {
              setEditableMenuItem(null);
              setMenuItemVisible(true);
            }}
          >
            + Блюдо
          </button>
        </div>

        {loading && <p>Загрузка меню…</p>}

        {(menuCategories || []).map((cat) => {
          const list = itemsByCategory.get(cat.id) || [];
          return (
            <div key={cat.id} style={{ marginBottom: 24 }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 8,
                }}
              >
                <h3 style={{ margin: 0 }}>{cat.name}</h3>
                <div className={styles.buttons}>
                  <button
                    type="button"
                    className={styles.editButton}
                    onClick={() => {
                      setEditableMenuCategory(cat);
                      setMenuCategoryVisible(true);
                    }}
                  >
                    Редактировать
                  </button>
                  <button
                    type="button"
                    className={styles.deleteButton}
                    onClick={() => handleDeactivateCategory(cat)}
                  >
                    Деактивировать
                  </button>
                </div>
              </div>

              {list.length === 0 ? (
                <div style={{ color: "#666" }}>Пока нет блюд</div>
              ) : (
                <div className={styles.itemList}>
                  {list.map((it) => {
                    const src = getMenuImgSrc(it.img);
                    return (
                      <div key={it.id} className={styles.item}>
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 12,
                          }}
                        >
                          {src && (
                            <Image
                              src={src}
                              alt={it.name}
                              style={{
                                width: 64,
                                height: 64,
                                objectFit: "cover",
                                borderRadius: 6,
                              }}
                              onError={(e) => {
                                e.currentTarget.style.display = "none";
                              }}
                            />
                          )}
                          <div>
                            <div style={{ fontWeight: 600 }}>
                              {it.name} • {it.price} €
                            </div>
                            {it.description && (
                              <div style={{ color: "#666", marginTop: 2 }}>
                                {it.description}
                              </div>
                            )}
                          </div>
                        </div>

                        <div className={styles.buttons}>
                          <span
                            style={{
                              marginRight: 12,
                              color: it.isAvailable ? "green" : "red",
                            }}
                          >
                            {it.isAvailable ? "Доступно" : "Недоступно"}
                          </span>

                          <button
                            className={styles.editButton}
                            type="button"
                            onClick={() => {
                              setEditableMenuItem(it);
                              setMenuItemVisible(true);
                            }}
                          >
                            Редактировать
                          </button>

                          <button
                            className={styles.editButton}
                            type="button"
                            onClick={() => handleToggleAvail(it)}
                          >
                            {it.isAvailable ? "Скрыть" : "Показать"}
                          </button>

                          <button
                            className={styles.deleteButton}
                            type="button"
                            onClick={() => handleDeactivateItem(it)}
                          >
                            Деактивировать
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}

        <div style={{ marginBottom: 22 }}>
          <h3 style={{ marginBottom: 10 }}>Без категории</h3>
          {(itemsByCategory.get("no") || []).length === 0 ? (
            <div style={{ color: "#666" }}>Пусто</div>
          ) : (
            <div className={styles.itemList}>
              {(itemsByCategory.get("no") || []).map((it) => {
                const src = getMenuImgSrc(it.img);
                return (
                  <div key={it.id} className={styles.item}>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 12,
                      }}
                    >
                      {src && (
                        <Image
                          src={src}
                          alt={it.name}
                          style={{
                            width: 64,
                            height: 64,
                            objectFit: "cover",
                            borderRadius: 6,
                          }}
                          onError={(e) => {
                            e.currentTarget.style.display = "none";
                          }}
                        />
                      )}
                      <div>
                        <div style={{ fontWeight: 600 }}>
                          {it.name} • {it.price} €
                        </div>
                        {it.description && (
                          <div style={{ color: "#666", marginTop: 2 }}>
                            {it.description}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className={styles.buttons}>
                      <span
                        style={{
                          marginRight: 12,
                          color: it.isAvailable ? "green" : "red",
                        }}
                      >
                        {it.isAvailable ? "Доступно" : "Недоступно"}
                      </span>

                      <button
                        className={styles.editButton}
                        type="button"
                        onClick={() => {
                          setEditableMenuItem(it);
                          setMenuItemVisible(true);
                        }}
                      >
                        Редактировать
                      </button>

                      <button
                        className={styles.editButton}
                        type="button"
                        onClick={() => handleToggleAvail(it)}
                      >
                        {it.isAvailable ? "Скрыть" : "Показать"}
                      </button>

                      <button
                        className={styles.deleteButton}
                        type="button"
                        onClick={() => handleDeactivateItem(it)}
                      >
                        Деактивировать
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
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
        onHide={() => {
          setMenuItemVisible(false);
          setEditableMenuItem(null);
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
