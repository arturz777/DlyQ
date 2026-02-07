import React, { useEffect, useMemo, useState } from "react";
import styles from "./AdminCouriers.module.css";
import {
  adminSearchUsers,
  adminMakeCourier,
  adminRemoveCourier,
  adminUpdateCourierProfile,
  adminResetCourierPushToken,
  adminToggleUserBlock,
} from "../http/courierAPI";

const emptyEdit = (u) => ({
  firstName: u.firstName || "",
  lastName: u.lastName || "",
  email: u.email || "",
  phone: u.phone || "",
  iban: u.courier?.iban || "",
});

const AdminCouriers = () => {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [rows, setRows] = useState([]);

  const [editingId, setEditingId] = useState(null);
  const [edit, setEdit] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    iban: "",
  });

  const [roleFilter, setRoleFilter] = useState("COURIER");

  const ask = (text) => window.confirm(text);

  const visibleRows = useMemo(() => {
    const list = rows || [];
    if (roleFilter === "ALL") return list;

    if (roleFilter === "COURIER") {
      return list.filter(
        (u) => String(u.role || "").toUpperCase() === "COURIER",
      );
    }

    if (roleFilter === "USER") {
      return list.filter((u) => String(u.role || "").toUpperCase() === "USER");
    }

    return list;
  }, [rows, roleFilter]);

  const load = async (q = query) => {
    setLoading(true);
    setErr("");
    try {
      const data = await adminSearchUsers({ query: q });
      setRows(Array.isArray(data?.items) ? data.items : []);
    } catch (e) {
      console.error(e);
      setErr("Не удалось загрузить список пользователей");
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load("");
  }, []);

  const startEdit = (u) => {
    setEditingId(u.id);
    setEdit(emptyEdit(u));
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEdit({ firstName: "", lastName: "", email: "", phone: "", iban: "" });
  };

  const saveEdit = async (u) => {
    if (!ask(`Сохранить изменения для #${u.id} (${u.email})?`)) return;
    setLoading(true);
    setErr("");
    try {
      await adminUpdateCourierProfile(u.id, {
        firstName: edit.firstName,
        lastName: edit.lastName,
        phone: edit.phone,
        iban: edit.iban,
      });
      cancelEdit();
      await load(query);
    } catch (e) {
      console.error(e);
      setErr("Не удалось сохранить изменения");
    } finally {
      setLoading(false);
    }
  };

  const makeCourier = async (u) => {
    if (!ask(`Сделать пользователя #${u.id} (${u.email}) курьером?`)) return;

    setLoading(true);
    setErr("");
    try {
      await adminMakeCourier(u.id);
      await load(query);
    } catch (e) {
      console.error(e);
      setErr("Не удалось сделать курьером");
    } finally {
      setLoading(false);
    }
  };

  const removeCourier = async (u) => {
    if (!ask(`Убрать курьера #${u.id} (${u.email}) и вернуть роль USER?`))
      return;

    setLoading(true);
    setErr("");
    try {
      await adminRemoveCourier(u.id);
      await load(query);
    } catch (e) {
      console.error(e);
      setErr("Не удалось убрать роль курьера");
    } finally {
      setLoading(false);
    }
  };

  const resetPush = async (u) => {
    if (!ask(`Сбросить pushToken у курьера #${u.id} (${u.email})?`)) return;

    setLoading(true);
    setErr("");
    try {
      await adminResetCourierPushToken(u.id);
      await load(query);
    } catch (e) {
      console.error(e);
      setErr("Не удалось сбросить pushToken");
    } finally {
      setLoading(false);
    }
  };

  const toggleBlock = async (u) => {
    const next = !u.isBlocked;
    const actionText = next ? "Заблокировать" : "Разблокировать";

    if (!ask(`${actionText} пользователя #${u.id} (${u.email})?`)) return;

    setLoading(true);
    setErr("");
    try {
      await adminToggleUserBlock(u.id, next);
      await load(query);
    } catch (e) {
      console.error(e);
      setErr("Не удалось изменить блокировку");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.wrap}>
      <div className={styles.headerRow}>
        <div>
          <h3 className={styles.title}>🛵 Курьеры</h3>
          <div className={styles.subtitle}>
            Поиск по email / имени / телефону. Тут же назначаем роль COURIER и
            редактируем IBAN.
          </div>
        </div>

        <div className={styles.filters}>
          <button
            className={`${styles.filterBtn} ${roleFilter === "COURIER" ? styles.filterActive : ""}`}
            onClick={() => setRoleFilter("COURIER")}
            type="button"
          >
            Курьеры
          </button>
          <button
            className={`${styles.filterBtn} ${roleFilter === "USER" ? styles.filterActive : ""}`}
            onClick={() => setRoleFilter("USER")}
            type="button"
          >
            Юзеры
          </button>
          <button
            className={`${styles.filterBtn} ${roleFilter === "ALL" ? styles.filterActive : ""}`}
            onClick={() => setRoleFilter("ALL")}
            type="button"
          >
            Все
          </button>
        </div>

        <div className={styles.searchBox}>
          <input
            className={styles.input}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Поиск: email / имя / телефон…"
          />
          <button
            className={styles.btn}
            onClick={() => load(query)}
            disabled={loading}
            type="button"
          >
            {loading ? "..." : "Найти"}
          </button>
          <button
            className={styles.btnGhost}
            onClick={() => {
              setQuery("");
              load("");
            }}
            disabled={loading}
            type="button"
          >
            Сброс
          </button>
        </div>
      </div>

      {err ? <div className={styles.error}>{err}</div> : null}

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>ID</th>
              <th>Имя</th>
              <th>Фамилия</th>
              <th>Email</th>
              <th>Телефон</th>
              <th>IBAN</th>
              <th>Роль</th>
              <th>Онлайн</th>
              <th>Push</th>
              <th>Блок</th>
              <th className={styles.actionsCol}>Действия</th>
            </tr>
          </thead>

          <tbody>
            {visibleRows.length === 0 && !loading ? (
              <tr>
                <td colSpan={11} className={styles.empty}>
                  Ничего не найдено
                </td>
              </tr>
            ) : (
              visibleRows.map((u) => {
                const isCourier =
                  String(u.role || "").toUpperCase() === "COURIER";
                const isEditing = editingId === u.id;

                const courierStatus = u.courier?.status || "—";
                const isOnline = courierStatus === "online";

                const missingPhone = !String(u.phone || "").trim();
                const missingIban =
                  isCourier && !String(u.courier?.iban || "").trim();

                return (
                  <tr key={u.id} className={isCourier ? styles.rowCourier : ""}>
                    <td>{u.id}</td>

                    <td>
                      {isEditing ? (
                        <input
                          className={styles.cellInput}
                          value={edit.firstName}
                          onChange={(e) =>
                            setEdit((p) => ({
                              ...p,
                              firstName: e.target.value,
                            }))
                          }
                        />
                      ) : (
                        <span className={styles.cellText}>
                          {u.firstName || "—"}
                        </span>
                      )}
                    </td>

                    <td>
                      {isEditing ? (
                        <input
                          className={styles.cellInput}
                          value={edit.lastName}
                          onChange={(e) =>
                            setEdit((p) => ({ ...p, lastName: e.target.value }))
                          }
                        />
                      ) : (
                        <span className={styles.cellText}>
                          {u.lastName || "—"}
                        </span>
                      )}
                    </td>

                    <td>
                      <span className={styles.cellText}>{u.email || "—"}</span>
                    </td>

                    <td>
                      {isEditing ? (
                        <input
                          className={`${styles.cellInput} ${styles.cellInputWide} ${missingPhone ? styles.warn : ""}`}
                          value={edit.phone}
                          onChange={(e) =>
                            setEdit((p) => ({ ...p, phone: e.target.value }))
                          }
                          placeholder={missingPhone ? "нужен телефон" : ""}
                        />
                      ) : (
                        <span
                          className={`${styles.cellText} ${missingPhone ? styles.warnText : ""}`}
                        >
                          {u.phone || "—"}
                        </span>
                      )}
                    </td>

                    <td>
                      {isEditing ? (
                        <input
                          className={`${styles.cellInput} ${styles.cellInputWide} ${missingIban ? styles.warn : ""}`}
                          value={edit.iban}
                          onChange={(e) =>
                            setEdit((p) => ({ ...p, iban: e.target.value }))
                          }
                          placeholder={missingIban ? "нужен IBAN" : ""}
                        />
                      ) : (
                        <span
                          className={`${styles.cellText} ${missingIban ? styles.warnText : ""}`}
                        >
                          {u.courier?.iban || "—"}
                        </span>
                      )}
                    </td>

                    <td>
                      <span
                        className={`${styles.badge} ${isCourier ? styles.badgeCourier : styles.badgeUser}`}
                      >
                        {u.role || "USER"}
                      </span>
                    </td>

                    <td>
                      <span
                        className={`${styles.badge} ${isOnline ? styles.badgeOn : styles.badgeOff}`}
                      >
                        {isCourier ? courierStatus : "—"}
                      </span>
                    </td>

                    <td>
                      <span
                        className={`${styles.badge} ${u.courier?.expoPushToken ? styles.badgeOn : styles.badgeOff}`}
                      >
                        {isCourier
                          ? u.courier?.expoPushToken
                            ? "есть"
                            : "нет"
                          : "—"}
                      </span>
                    </td>

                    <td>
                      <span
                        className={`${styles.badge} ${u.isBlocked ? styles.badgeBlocked : styles.badgeOk}`}
                      >
                        {u.isBlocked ? "blocked" : "ok"}
                      </span>
                    </td>

                    <td className={styles.actionsCol}>
                      <div className={styles.actions}>
                        {!isCourier ? (
                          <button
                            className={styles.btnPrimary}
                            onClick={() => makeCourier(u)}
                            disabled={loading}
                            type="button"
                          >
                            Сделать курьером
                          </button>
                        ) : (
                          <button
                            className={styles.btnDanger}
                            onClick={() => removeCourier(u)}
                            disabled={loading}
                            type="button"
                          >
                            Убрать курьера
                          </button>
                        )}

                        {isCourier ? (
                          <button
                            className={styles.btn}
                            onClick={() => resetPush(u)}
                            disabled={loading}
                            type="button"
                            title="Сбросит expoPushToken — курьер заново зарегистрирует токен при следующем запуске приложения"
                          >
                            Сброс push
                          </button>
                        ) : null}

                        {!isEditing ? (
                          <button
                            className={styles.btn}
                            onClick={() => startEdit(u)}
                            disabled={loading}
                            type="button"
                          >
                            Редактировать
                          </button>
                        ) : (
                          <>
                            <button
                              className={styles.btnPrimary}
                              onClick={() => saveEdit(u)}
                              disabled={loading}
                              type="button"
                            >
                              Сохранить
                            </button>
                            <button
                              className={styles.btnGhost}
                              onClick={cancelEdit}
                              disabled={loading}
                              type="button"
                            >
                              Отмена
                            </button>
                          </>
                        )}

                        <button
                          className={
                            u.isBlocked ? styles.btnPrimary : styles.btnGhost
                          }
                          onClick={() => toggleBlock(u)}
                          disabled={loading}
                          type="button"
                          title="Блокировка пользователя (нужно поле isBlocked в Users и проверка в auth middleware)"
                        >
                          {u.isBlocked ? "Разблок." : "Заблок."}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AdminCouriers;
