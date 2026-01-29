import React, { useEffect, useState } from "react";

export default function OfflineBanner() {
  const [offline, setOffline] = useState(
    typeof navigator !== "undefined" ? !navigator.onLine : false,
  );

  useEffect(() => {
    const onOnline = () => setOffline(false);
    const onOffline = () => setOffline(true);

    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  if (!offline) return null;

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 2147483647,
        padding: "6px 10px",
        textAlign: "center",
        background: "#b00020",
        color: "#fff",
        fontSize: 13,
        fontWeight: 600,
        lineHeight: 1.2,
        letterSpacing: 0,
      }}
      role="status"
      aria-live="polite"
    >
      Проблема с интернетом. Проверьте подключение.{t("delete", { ns: "basket" })}
    </div>
  );
}
