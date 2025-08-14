import React from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence, useDragControls } from "framer-motion";
import styles from "./SlideModal.module.css";

const SlideModal = ({ children, onClose }) => {
  const dragControls = useDragControls();

  const handlePointerDown = (e) => {
    dragControls.start(e);
  };

  return createPortal(
    <div className={styles.modalOverlay} onClick={onClose}>
      <AnimatePresence>
        <motion.div
          className={styles.modalContent}
          onClick={(e) => e.stopPropagation()}
          initial={false} 
          animate={{ y: 0 }}
          exit={{ y: "100%" }}
          transition={{ duration: 0.3, ease: "easeInOut" }}
          
          drag="y"
          dragControls={dragControls}
          dragListener={false}
          dragConstraints={{ top: 0 }}
          dragElastic={{ top: 0, bottom: 0.5 }}
          onDragEnd={(event, info) => {
            if (info.offset.y > 300) onClose();
          }}
        >
          <div
            className={styles.dragHandle}
            onPointerDown={handlePointerDown}
          />
          {children}
        </motion.div>
      </AnimatePresence>
    </div>,
    document.body
  );
};

export default SlideModal;
