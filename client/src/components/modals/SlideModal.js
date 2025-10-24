import React, { useEffect, useRef } from "react";
import { observer } from "mobx-react-lite";
import { createPortal } from "react-dom";
import { motion, AnimatePresence, useDragControls } from "framer-motion";
import appStore from "../../store/appStore";
import styles from "./SlideModal.module.css";

const SlideModal = observer(({ children, onClose }) => {
  const dragControls = useDragControls();
  const containerRef = useRef(null);  // внешний motion.div
  const scrollRef = useRef(null);     // внутренний скроллер
  const startYRef = useRef(0);

  const isTouchDevice =
    typeof window !== "undefined" && matchMedia("(pointer: coarse)").matches;

  useEffect(() => {
    const body = document.body;
    const html = document.documentElement;
    const y = window.scrollY || 0;

    const app = document.querySelector("#root");
    const prevAppOverflow = app?.style.overflow;

    const prevHtml = {
      overflow: html.style.overflow,
      overscrollBehaviorY: html.style.overscrollBehaviorY,
    };

    const prevBody = {
      position: body.style.position,
      top: body.style.top,
      width: body.style.width,
      overflow: body.style.overflow,
      overscrollBehaviorY: body.style.overscrollBehaviorY,
    };

    // Лочим фон
    body.style.position = "fixed";
    body.style.top = `-${y}px`;
    body.style.width = "100%";
    body.style.overflow = "hidden";
    body.style.overscrollBehaviorY = "none";
    html.style.overflow = "hidden";
    html.style.overscrollBehaviorY = "none";
    if (app) app.style.overflow = "hidden";

    // Глобально душим touchmove вне модалки + на краях скролла
    const onTouchStartCap = (e) => {
      startYRef.current = e.touches?.[0]?.clientY ?? 0;
    };

    const onTouchMoveCap = (e) => {
      const cont = containerRef.current;
      const sc = scrollRef.current;
      if (!cont) {
        // на всякий случай
        if (e.cancelable) e.preventDefault();
        return;
      }

      const inContainer = cont.contains(e.target);
      if (!inContainer) {
        // тач не в модалке → не отдаём вьюпорту
        if (e.cancelable) e.preventDefault();
        return;
      }

      // внутри модалки, но вне скролл-зоны (хэндл/паддинги) — не мешаем (пусть drag работает)
      const inScroll = sc && sc.contains(e.target);
      if (!inScroll) return;

      // если скролл на краю и тянут наружу — блокируем, чтобы не пробросить в фон
      const atTop = sc.scrollTop <= 0;
      const atBot = sc.scrollTop + sc.clientHeight >= sc.scrollHeight;
      const t = e.touches && e.touches[0];
      if (!t) return;
      const dy = t.clientY - startYRef.current;
      if ((atTop && dy > 0) || (atBot && dy < 0)) {
        if (e.cancelable) e.preventDefault();
      }
    };

    document.addEventListener("touchstart", onTouchStartCap, {
      passive: false,
      capture: true,
    });
    document.addEventListener("touchmove", onTouchMoveCap, {
      passive: false,
      capture: true,
    });

    return () => {
      document.removeEventListener("touchstart", onTouchStartCap, true);
      document.removeEventListener("touchmove", onTouchMoveCap, true);

      body.style.position = prevBody.position;
      body.style.top = prevBody.top;
      body.style.width = prevBody.width;
      body.style.overflow = prevBody.overflow;
      body.style.overscrollBehaviorY = prevBody.overscrollBehaviorY;

      html.style.overflow = prevHtml.overflow;
      html.style.overscrollBehaviorY = prevHtml.overscrollBehaviorY;

      if (app) app.style.overflow = prevAppOverflow || "";
      window.scrollTo(0, y);
    };
  }, []);

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  // На десктопе можно оставить ограничение "только с вершины"
  const canStartDrag = () => (scrollRef.current?.scrollTop ?? 0) <= 2;

  const handlePointerDown = (e) => {
    // Десктоп: тянем только с вершины
    if (!isTouchDevice && canStartDrag()) dragControls.start(e);
  };

  const handleTouchStart = (e) => {
    startYRef.current = e.touches[0].clientY;
    // Мобилка: тянуть можно с ЛЮБОЙ точки → стартуем drag
    // И временно отключаем скролл контента (чтобы жест не уехал в скролл)
    if (scrollRef.current) {
      scrollRef.current.style.overflow = "hidden";
      scrollRef.current.style.touchAction = "none";
    }
    dragControls.start(e);
  };

  const restoreScroll = () => {
    if (scrollRef.current) {
      scrollRef.current.style.overflow = "";
      scrollRef.current.style.touchAction = "";
    }
  };

  return createPortal(
    <div className={styles.modalOverlay} onClick={onClose}>
      <AnimatePresence>
        <motion.div
          ref={containerRef}
          className={styles.modalContent}
          onClick={(e) => e.stopPropagation()}
          onPointerDownCapture={handlePointerDown}
          onTouchStartCapture={handleTouchStart}
          onTouchEnd={restoreScroll}
          initial={{ y: "100%" }}
          animate={{ y: 0 }}
          exit={{ y: "100%" }}
          transition={{ duration: 0.3, ease: "easeInOut" }}
          drag="y"
          dragDirectionLock
          dragPropagation={false}
          dragControls={dragControls}
          dragListener={false}
          dragConstraints={{ top: 0 }}
          dragElastic={{ top: 0, bottom: 0.5 }}
          dragMomentum={false}
          onDragEnd={(event, info) => {
            const h = containerRef.current?.getBoundingClientRect().height || 0;
            const shouldClose =
              info.offset.y > Math.max(120, h * 0.24) || info.velocity.y > 800;
            if (shouldClose) onClose();
            restoreScroll();
          }}
        >
          <div className={styles.dragHandle} />
          <div className={styles.modalScroll} ref={scrollRef}>
            <div
              className={appStore.isLoading ? styles.hiddenContent : undefined}
            >
              {children}
            </div>
            {appStore.isLoading && (
              <div className={styles.spinnerOverlay}>
                <div className={styles.spinner} />
              </div>
            )}
          </div>
        </motion.div>
      </AnimatePresence>
    </div>,
    document.body
  );
});

export default SlideModal;
