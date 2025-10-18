import React, { useEffect, useRef } from "react";
import { observer } from "mobx-react-lite";
import { createPortal } from "react-dom";
import { motion, AnimatePresence, useDragControls } from "framer-motion";
import appStore from "../../store/appStore";
import styles from "./SlideModal.module.css";

const SlideModal = observer(({ children, onClose }) => {
  const dragControls = useDragControls();
  const contentRef = useRef(null);

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const handlePointerDown = (e) => {
    const top = contentRef.current?.scrollTop ?? 0;
    if (top <= 0) dragControls.start(e);
  };

  return createPortal(
    <div className={styles.modalOverlay} onClick={onClose}>
      <AnimatePresence>
        <motion.div
          ref={contentRef}
          className={styles.modalContent}
          onClick={(e) => e.stopPropagation()}
          onPointerDown={handlePointerDown}
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
          onDragEnd={(e, info) => {
            if (info.offset.y > 120 || info.velocity.y > 800) onClose();
          }}
        >
          <div className={styles.dragHandle} />

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
        </motion.div>
      </AnimatePresence>
    </div>,
    document.body
  );
});

export default SlideModal;
