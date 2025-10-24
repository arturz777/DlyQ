import React, { createContext, useCallback, useContext, useRef, useState } from "react";
import { Modal, Button } from "react-bootstrap";

const ConfirmCtx = createContext(null);

export function ConfirmProvider({ children }) {
  const [opts, setOpts] = useState(null);
  const resolverRef = useRef(null);
  const [busy, setBusy] = useState(false);

  const confirm = useCallback((options = {}) => {
    return new Promise((resolve) => {
      resolverRef.current = resolve;
      setOpts({
        title: options.title ?? "Confirm",
        message: options.message ?? "Are you sure?",
        confirmText: options.confirmText ?? "OK",
        cancelText: options.cancelText ?? "Cancel",
        confirmVariant: options.confirmVariant ?? "primary",
        onConfirm: options.onConfirm,
      });
    });
  }, []);

  const close = () => {
    if (busy) return;
    setOpts(null);
    resolverRef.current?.(false);
    resolverRef.current = null;
  };

  const doConfirm = async () => {
    if (!opts) return;
    try {
      setBusy(true);
      if (typeof opts.onConfirm === "function") {
        await opts.onConfirm();
      }
      setOpts(null);
      resolverRef.current?.(true);
    } finally {
      setBusy(false);
      resolverRef.current = null;
    }
  };

  return (
    <ConfirmCtx.Provider value={confirm}>
      {children}

      <Modal show={!!opts} onHide={close} centered backdrop="static" restoreFocus={false}>
        <Modal.Header closeButton>
          <Modal.Title>{opts?.title}</Modal.Title>
        </Modal.Header>
        <Modal.Body>{opts?.message}</Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={close} disabled={busy}>
            {opts?.cancelText}
          </Button>
          <Button variant={opts?.confirmVariant || "primary"} onClick={doConfirm} disabled={busy}>
            {busy ? "…" : opts?.confirmText}
          </Button>
        </Modal.Footer>
      </Modal>
    </ConfirmCtx.Provider>
  );
}

export function useConfirm() {
  const ctx = useContext(ConfirmCtx);
  if (!ctx) throw new Error("useConfirm must be used inside <ConfirmProvider>");
  return ctx;
}
