import React, { useEffect, useState, useRef } from "react";
import { observer } from "mobx-react-lite";
import { Drawer } from "vaul";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import appStore from "../../store/appStore";
import styles from "./SlideModal.module.css";

const ANIM_MS = 280;

const SlideModal = observer(({ children, onClose, title = "Modal" }) => {
  const [open, setOpen] = useState(false);
  const startY = useRef(0);

  // Открываемся кадром позже — без дёрганья
  useEffect(() => {
    const id = requestAnimationFrame(() => {
      const id2 = requestAnimationFrame(() => setOpen(true));
      return () => cancelAnimationFrame(id2);
    });
    return () => cancelAnimationFrame(id);
  }, []);

  // Сообщаем родителю после анимации
  useEffect(() => {
    if (open) return;
    const t = setTimeout(() => onClose?.(), ANIM_MS);
    return () => clearTimeout(t);
  }, [open, onClose]);

  // ⬇️ БЛОКИРУЕМ PTR, пока модалка открыта
  useEffect(() => {
    if (!open) return;

    const onTouchStart = (e) => {
      startY.current = e.touches?.[0]?.clientY ?? 0;
    };

    const onTouchMove = (e) => {
      // Разрешаем жест только внутри скролл-контейнера модалки
      const scroller = e.target.closest?.(`.${styles.modalScroll}`);
      if (!scroller) {
        if (e.cancelable) e.preventDefault();
        return;
      }

      // Если на краю и тянем "наружу" — не отдаём вьюпорту (iOS PTR)
      const atTop = scroller.scrollTop <= 0;
      const atBot = scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight;
      const y = e.touches?.[0]?.clientY ?? 0;
      const dy = y - startY.current;

      if ((atTop && dy > 0) || (atBot && dy < 0)) {
        if (e.cancelable) e.preventDefault();
      }
    };

    document.addEventListener("touchstart", onTouchStart, { capture: true, passive: false });
    document.addEventListener("touchmove", onTouchMove, { capture: true, passive: false });

    return () => {
      document.removeEventListener("touchstart", onTouchStart, true);
      document.removeEventListener("touchmove", onTouchMove, true);
    };
  }, [open]);

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
