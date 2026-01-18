import React, { useEffect, useMemo, useState } from "react";
import Modal from "react-bootstrap/Modal";
import Form from "react-bootstrap/Form";
import Button from "react-bootstrap/Button";
import styles from "./SellerWorkingHoursModal.module.css";
import { updateSellerHours } from "../../http/sellerAPI";

const DEFAULT_HOURS = {
  weekdays: { start: "10:00", end: "22:00" },
  saturday: { start: "10:00", end: "22:00" },
  sunday: { start: "10:00", end: "22:00" },
};

const normalizeHours = (h) => {
  const src = h && typeof h === "object" ? h : {};
  const pick = (key) => {
    const v = src[key] && typeof src[key] === "object" ? src[key] : {};
    const start =
      typeof v.start === "string" ? v.start : DEFAULT_HOURS[key].start;
    const end = typeof v.end === "string" ? v.end : DEFAULT_HOURS[key].end;
    return { start, end };
  };
  return {
    weekdays: pick("weekdays"),
    saturday: pick("saturday"),
    sunday: pick("sunday"),
  };
};

const isTime = (s) => /^\d{2}:\d{2}$/.test(String(s || "").trim());

const validate = (hours) => {
  for (const k of ["weekdays", "saturday", "sunday"]) {
    if (!isTime(hours[k]?.start) || !isTime(hours[k]?.end)) {
      return `Некорректное время в блоке: ${k}`;
    }
  }
  return null;
};

const Row = ({ label, value, onChange }) => (
  <div className={styles.row}>
    <div className={styles.label}>{label}</div>
    <div className={styles.inputs}>
      <Form.Control
        type="time"
        value={value.start}
        onChange={(e) => onChange({ ...value, start: e.target.value })}
      />
      <span className={styles.sep}>—</span>
      <Form.Control
        type="time"
        value={value.end}
        onChange={(e) => onChange({ ...value, end: e.target.value })}
      />
    </div>
  </div>
);

const SellerWorkingHoursModal = ({ show, seller, onHide, onSaved }) => {
  const [forceClosed, setForceClosed] = useState(false);
  const [hours, setHours] = useState(DEFAULT_HOURS);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (!show) return;
    setErr("");
    setForceClosed(Boolean(seller?.forceClosed));
    setHours(normalizeHours(seller?.workHours));
  }, [show, seller]);

  const preview = useMemo(() => {
    const fmt = (x) => `${x.start}–${x.end}`;
    return `Будни: ${fmt(hours.weekdays)} • Сб: ${fmt(hours.saturday)} • Вс: ${fmt(hours.sunday)}`;
  }, [hours]);

  const handleSave = async () => {
    setErr("");

    if (!seller?.id) {
      setErr("seller не загружен");
      return;
    }

    const vErr = validate(hours);
    if (vErr) {
      setErr(vErr);
      return;
    }

    try {
      setSaving(true);
      const updated = await updateSellerHours(seller.id, {
        workHours: hours,
        forceClosed,
      });
      onSaved?.(updated);
      onHide?.();
    } catch (e) {
      console.error(e);
      setErr(e?.response?.data?.message || "Не удалось сохранить");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal show={show} onHide={onHide} centered>
      <Modal.Header closeButton>
        <Modal.Title>Рабочие часы</Modal.Title>
      </Modal.Header>

      <Modal.Body>
        <Form.Check
          type="switch"
          id="forceClosed"
          label="Принудительно закрыт"
          checked={forceClosed}
          onChange={(e) => setForceClosed(e.target.checked)}
        />

        <div className={styles.block}>
          <Row
            label="Будни"
            value={hours.weekdays}
            onChange={(v) => setHours((p) => ({ ...p, weekdays: v }))}
          />
          <Row
            label="Суббота"
            value={hours.saturday}
            onChange={(v) => setHours((p) => ({ ...p, saturday: v }))}
          />
          <Row
            label="Воскресенье"
            value={hours.sunday}
            onChange={(v) => setHours((p) => ({ ...p, sunday: v }))}
          />
        </div>

        <div className={styles.preview}>{preview}</div>

        {err && <div className={styles.error}>{err}</div>}
      </Modal.Body>

      <Modal.Footer>
        <Button variant="secondary" onClick={onHide} disabled={saving}>
          Отмена
        </Button>
        <Button variant="primary" onClick={handleSave} disabled={saving}>
          {saving ? "Сохраняю..." : "Сохранить"}
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default SellerWorkingHoursModal;
