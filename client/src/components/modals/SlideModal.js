import React, { useEffect, useState } from "react";
import { observer } from "mobx-react-lite";
import { Drawer } from "vaul";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import appStore from "../../store/appStore";
import styles from "./SlideModal.module.css";

const ANIM_MS = 280; 

const SlideModal = observer(({ children, onClose, title = "Modal" }) => {
  const [open, setOpen] = useState(false); 
  useEffect(() => {
    const id = requestAnimationFrame(() => {
      const id2 = requestAnimationFrame(() => setOpen(true));
      return () => cancelAnimationFrame(id2);
    });
    return () => cancelAnimationFrame(id);
  }, []);

  useEffect(() => {
    if (open) return;
    const t = setTimeout(() => onClose?.(), ANIM_MS);
    return () => clearTimeout(t);
  }, [open, onClose]);

  return (
    <Drawer.Root
      open={open}
      onOpenChange={setOpen}
      dismissible
      modal
      onOpenAutoFocus={(e) => e.preventDefault()} 
      onCloseAutoFocus={(e) => e.preventDefault()} 
    >
      <Drawer.Portal>
        <Drawer.Overlay className={styles.modalOverlay} />
        <Drawer.Content className={styles.modalContent}>
          <VisuallyHidden asChild>
            <Drawer.Title>{title}</Drawer.Title>
          </VisuallyHidden>

          <div className={styles.dragHandle} />
          <div className={styles.modalScroll}>
            <div className={appStore.isLoading ? styles.hiddenContent : undefined}>
              {children}
            </div>
            {appStore.isLoading && (
              <div className={styles.spinnerOverlay}>
                <div className={styles.spinner} />
              </div>
            )}
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
});

export default SlideModal;
