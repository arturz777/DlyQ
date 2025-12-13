import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { fetchSellers } from "../http/sellerAPI";
import styles from "./MainPage.module.css";

const MainPage = () => {
  const [sellers, setSellers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const load = async () => {
      try {
        const list = await fetchSellers();
        setSellers(list || []);
      } catch (e) {
        console.error(e);
        setError("Не удалось загрузить магазины");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  const getSellerImgSrc = (img) => {
    if (!img) return null;

    const base = process.env.REACT_APP_API_URL;
    if (/^https?:\/\//i.test(img)) return img;
    if (img.startsWith("/")) return `${base}${img}`;
    return `${base}/${img}`;
  };

  const handleOpenSeller = (s) => {
    const slugOrId = s.slug || s.id;
    navigate(`/seller/${slugOrId}`, { state: { seller: s } });
  };

  return (
    <div className={styles.wrapper}>
      <h1 className={styles.title}>Выберите магазин</h1>

      {loading && (
        <div className={styles.loading}>Загружаем списoк магазинов…</div>
      )}

      {error && <div className={styles.error}>{error}</div>}

      {!loading && !error && sellers.length === 0 && (
        <div className={styles.empty}>Пока нет доступных магазинов</div>
      )}

      {!loading && !error && sellers.length > 0 && (
        <div className={styles.grid}>
          {sellers.map((s) => {
            const src = getSellerImgSrc(s.img);

            return (
              <button
                key={s.id}
                className={styles.card}
                onClick={() => handleOpenSeller(s)}
                type="button"
              >
                {src ? (
                  <img src={src} alt={s.name} className={styles.img} />
                ) : (
                  <div className={styles.imgPlaceholder} />
                )}

                <div className={styles.cardBottom}>
                  <div className={styles.name}>{s.name}</div>
                  {s.kind && <div className={styles.kind}>{s.kind}</div>}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default MainPage;
