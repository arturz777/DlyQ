import React, { useEffect, useRef, useState } from "react";
import { observer } from "mobx-react-lite";
import { createPortal } from "react-dom";
import { motion, AnimatePresence, useDragControls } from "framer-motion";
import appStore from "../../store/appStore";
import styles from "./SlideModal.module.css";

const SlideModal = observer(({ children, onClose }) => {
  const dragControls = useDragControls();
  const contentRef = useRef(null);
  const scrollRef = useRef(null);

  const startYRef = useRef(0);
  const [isGesture, setIsGesture] = useState(false);

  useEffect(() => {
    const body = document.body;
    const y = window.scrollY || 0;

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

    return () => {
      body.style.position = prev.position;
      body.style.top = prev.top;
      body.style.width = prev.width;
      body.style.overflow = prev.overflow;
      body.style.overscrollBehaviorY = prev.overscrollBehaviorY;
      window.scrollTo(0, y);
    };
  }, []);

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const canStartDrag = () => (contentRef.current?.scrollTop ?? 0) <= 0;

  const handlePointerDown = (e) => {
    if (canStartDrag()) dragControls.start(e);
  };

  const handleTouchStart = (e) => {
    if (!canStartDrag()) return;
    startYRef.current = e.touches[0].clientY;
    setIsGesture(true);
    dragControls.start(e);
  };

  const handleTouchEnd = () => setIsGesture(false);

  useEffect(() => {
    const el = contentRef.current;
    if (!el) return;

    const onTouchMove = (e) => {
      if (!isGesture) return;
      const dy = e.touches[0].clientY - startYRef.current;
      if (dy > 0) {
        e.preventDefault();
      }
    };

    el.addEventListener("touchmove", onTouchMove, { passive: false });
    return () => el.removeEventListener("touchmove", onTouchMove);
  }, [isGesture]);

  return createPortal(
    <div className={styles.modalOverlay} onClick={onClose}>
      <AnimatePresence>
        <motion.div
          ref={contentRef}
          className={styles.modalContent}
          onClick={(e) => e.stopPropagation()}
          onPointerDown={handlePointerDown}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          onPointerDownCapture={handlePointerDown}
          onTouchStartCapture={handleTouchStart}
          initial={{ y: "100%" }}
          animate={{ y: 0 }}
          exit={{ y: "100%" }}
          transition={{ duration: 0.3, ease: "easeInOut" }}
          drag="y"
          dragControls={dragControls}
          dragListener={false}
          dragConstraints={{ top: 0 }}
          dragElastic={{ top: 0, bottom: 0.5 }}
          dragMomentum={false}
          onDragEnd={(event, info) => {
            if (info.offset.y > 120 || info.velocity.y > 800) onClose();
          }}
        >
          <div className={styles.dragHandle} />
          <div className={styles.modalScroll} ref={contentRef}>
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
