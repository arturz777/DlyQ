import React, { useEffect, useRef, useState } from "react";
import { observer } from "mobx-react-lite";
import { createPortal } from "react-dom";
import { motion, AnimatePresence, useDragControls } from "framer-motion";
import appStore from "../../store/appStore";
import styles from "./SlideModal.module.css";

const SlideModal = observer(({ children, onClose }) => {
  const dragControls = useDragControls();
  const containerRef = useRef(null);
  const scrollRef = useRef(null);
  const startYRef = useRef(0)

  const isTouchDevice = typeof window !== 'undefined' && matchMedia('(pointer: coarse)').matches;

  useEffect(() => {
    const body = document.body;
    const html = document.documentElement;
    const y = window.scrollY || 0;

    const app = document.querySelector('#root');
    const prevAppOverflow = app?.style.overflow;

    const prevHtml = {
      overflow: html.style.overflow,
      overscrollBehaviorY: html.style.overscrollBehaviorY,
    };

    const prev = {
      position: body.style.position,
      top: body.style.top,
      width: body.style.width,
      overflow: body.style.overflow,
      overscrollBehaviorY: body.style.overscrollBehaviorY,
    };

    body.style.position = "fixed";
    body.style.top = `-${y}px`;
    body.style.width = "100%";
    body.style.overflow = "hidden";
    body.style.overscrollBehaviorY = "none";
    html.style.overflow = "hidden";
    html.style.overscrollBehaviorY = "none";
    if (app) app.style.overflow = "hidden";

    return () => {
      body.style.position = prev.position;
      body.style.top = prev.top;
      body.style.width = prev.width;
      body.style.overflow = prev.overflow;
      body.style.overscrollBehaviorY = prev.overscrollBehaviorY;
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

  const canStartDrag = () => ((scrollRef.current?.scrollTop ?? 0) <= 2);

  const handlePointerDown = (e) => {
    if (canStartDrag()) dragControls.start(e);
  };

  const handleTouchStart = (e) => {
   startYRef.current = e.touches[0].clientY;
    if (isTouchDevice) {
     if (scrollRef.current) scrollRef.current.style.overflow = 'hidden';
     dragControls.start(e);
   } else if (canStartDrag()) {
     dragControls.start(e);
   }
 };

  const handleTouchEnd = () => {
   if (scrollRef.current) scrollRef.current.style.overflow = '';
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
          onTouchEnd={handleTouchEnd}
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
            if (scrollRef.current) scrollRef.current.style.overflow = '';
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
