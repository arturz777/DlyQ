import React, { useEffect, useState, useMemo } from "react";
import { observer } from "mobx-react-lite";
import { Drawer } from "vaul";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import appStore from "../../store/appStore";
import styles from "./SlideModal.module.css";

const ANIM_MS = 280;
const DEFAULT_SNAP = 0.85;

const SlideModal = observer(({ children, onClose, title = "Modal" }) => {
  const [open, setOpen] = useState(false);

  const isDesktop = useMemo(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia("(min-width: 1024px)").matches;
  }, []);

  const [snap, setSnap] = useState(DEFAULT_SNAP);

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

  useEffect(() => {
    if (!open) setSnap(DEFAULT_SNAP);
  }, [open]);

  return (
    <Drawer.Root
      open={open}
      onOpenChange={setOpen}
      dismissible
      modal
      onOpenAutoFocus={(e) => e.preventDefault()}
      onCloseAutoFocus={(e) => e.preventDefault()}
      {...(!isDesktop
        ? {
            snapPoints: [DEFAULT_SNAP, 1],
            activeSnapPoint: snap,
            setActiveSnapPoint: setSnap,
          }
        : {})}
    >
      <Drawer.Portal>
        <Drawer.Overlay className={styles.modalOverlay} />
        <Drawer.Content className={styles.modalContent}>
          <VisuallyHidden asChild>
            <Drawer.Title>{title}</Drawer.Title>
          </VisuallyHidden>

          <div className={styles.dragHandle} />

          <div className={styles.modalScroll}>
            <div
              className={appStore.isLoading ? styles.hiddenContent : undefined}
            >
              {children}
            </div>

            <div
              className={`${styles.spinnerOverlay} ${
                appStore.isLoading ? styles.isVisible : ""
              }`}
            >
              <div className={styles.spinner} />
            </div>
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
});

export default SlideModal;
