import React, { useEffect, useState } from "react";
import { Modal, Button, Form } from "react-bootstrap";
import { createSeller, updateSeller } from "../../http/sellerAPI";

const CreateSeller = ({ show, onHide, editableSeller = null, onSaved }) => {
  const isEdit = !!editableSeller?.id;

  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [kind, setKind] = useState("");
  const [img, setImg] = useState("");
  const [imgFile, setImgFile] = useState(null);
  const [isActive, setIsActive] = useState(true);
  const [address, setAddress] = useState("");
  const [pickupLat, setPickupLat] = useState("");
  const [pickupLng, setPickupLng] = useState("");
  const [kindRu, setKindRu] = useState("");
  const [kindEn, setKindEn] = useState("");
  const [kindEst, setKindEst] = useState("");
  const [ownerUserId, setOwnerUserId] = useState("");
  const [loading, setLoading] = useState(false);
  const [companyName, setCompanyName] = useState("");
  const [registrationNumber, setRegistrationNumber] = useState("");
  const [phone, setPhone] = useState("");
  const [website, setWebsite] = useState("");
  const [commissionPercent, setCommissionPercent] = useState(20);
  const [iban, setIban] = useState("");

  useEffect(() => {
    if (!show) return;

    if (isEdit) {
      setName(editableSeller?.name || "");
      setSlug(editableSeller?.slug || "");
      setKind(editableSeller?.kind || "");
      setImg(editableSeller?.img || "");
      setAddress(editableSeller?.address || "");
      setPickupLat(editableSeller?.pickupLat ?? "");
      setPickupLng(editableSeller?.pickupLng ?? "");
      setKindRu(
        editableSeller?.translations?.kind?.ru || editableSeller?.kind || "",
      );
      setKindEn(editableSeller?.translations?.kind?.en || "");
      setKindEst(editableSeller?.translations?.kind?.est || "");
      setCompanyName(editableSeller?.companyName || "");
      setRegistrationNumber(editableSeller?.registrationNumber || "");
      setPhone(editableSeller?.phone || "");
      setIban(editableSeller?.iban || "");
      setWebsite(editableSeller?.website || "");
      setCommissionPercent(editableSeller?.commissionPercent ?? 20);

      setIsActive(
        editableSeller?.isActive === undefined
          ? true
          : !!editableSeller.isActive,
      );

      setOwnerUserId(
        editableSeller?.ownerUserId ? String(editableSeller.ownerUserId) : "",
      );
    } else {
      setName("");
      setSlug("");
      setKind("");
      setImg("");
      setIsActive(true);
      setOwnerUserId("");
      setAddress("");
      setPickupLat("");
      setPickupLng("");
      setKindRu("");
      setKindEn("");
      setKindEst("");
      setCompanyName("");
      setRegistrationNumber("");
      setPhone("");
      setIban("");
      setWebsite("");
      setCommissionPercent(20);
    }
  }, [show, isEdit, editableSeller]);

  const handleClose = () => {
    if (loading) return;
    onHide?.();
  };

  const handleSubmit = async () => {
    if (!name.trim()) {
      alert("Введите название магазина");
      return;
    }

    const latNum = pickupLat === "" ? null : Number(pickupLat);
    const lngNum = pickupLng === "" ? null : Number(pickupLng);

    if (
      (pickupLat !== "" || pickupLng !== "") &&
      (!Number.isFinite(latNum) || !Number.isFinite(lngNum))
    ) {
      alert("pickupLat/pickupLng должны быть числами");
      return;
    }

    if ((latNum == null) !== (lngNum == null)) {
      alert(
        "Нужно указать и pickupLat, и pickupLng (или оставить оба пустыми)",
      );
      return;
    }

    const kindRuVal = kindRu.trim();
    const kindEnVal = kindEn.trim();
    const kindEstVal = kindEst.trim();

    const ownerIdNum = Number(ownerUserId);
    if (ownerUserId && !ownerIdNum) {
      alert("ownerUserId должен быть числом");
      return;
    }

    const cp = commissionPercent === "" ? 20 : Number(commissionPercent);
    if (!Number.isFinite(cp) || cp < 0 || cp > 100) {
      alert("Комиссия должна быть числом 0..100");
      return;
    }

    const fd = new FormData();
    fd.append("commissionPercent", String(cp));
    fd.append("name", name.trim());
    if (slug.trim()) fd.append("slug", slug.trim());

    fd.append("kind", kindRuVal || "");

    fd.append(
      "translations",
      JSON.stringify({
        kind: { ru: kindRuVal, en: kindEnVal, est: kindEstVal },
      }),
    );

    fd.append("isActive", String(isActive));

    if (address.trim()) fd.append("address", address.trim());
    if (latNum != null) fd.append("pickupLat", String(latNum));
    if (lngNum != null) fd.append("pickupLng", String(lngNum));
    if (companyName.trim()) fd.append("companyName", companyName.trim());
    if (registrationNumber.trim())
      fd.append("registrationNumber", registrationNumber.trim());
    if (phone.trim()) fd.append("phone", phone.trim());
    if (iban.trim()) fd.append("iban", iban.trim());
    if (website.trim()) fd.append("website", website.trim());
    if (ownerIdNum) fd.append("ownerUserId", String(ownerIdNum));
    if (imgFile) fd.append("img", imgFile);
    else if (img.trim()) fd.append("img", img.trim());
    else fd.append("img", "");

    setLoading(true);
    try {
      const saved = isEdit
        ? await updateSeller(editableSeller.id, fd)
        : await createSeller(fd);

      onSaved?.(saved);
      onHide?.();
    } catch (e) {
      console.error(e);
      alert(e?.response?.data?.message || "Ошибка сохранения магазина");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal show={show} onHide={handleClose} centered>
      <Modal.Header closeButton>
        <Modal.Title>
          {isEdit ? "Редактировать магазин" : "Добавить магазин"}
        </Modal.Title>
      </Modal.Header>

      <Modal.Body>
        <Form>
          <Form.Group className="mb-3">
            <Form.Label>Название магазина</Form.Label>
            <Form.Control
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Например: Pizza Boom"
            />
          </Form.Group>

          <Form.Group className="mb-3">
            <Form.Label>Slug (опционально)</Form.Label>
            <Form.Control
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              placeholder="pizzaboom (если пусто — сгенерируется из названия)"
            />
          </Form.Group>

          <Form.Group className="mb-3">
            <Form.Label>Тип / описание (kind)</Form.Label>

            <Form.Control
              value={kindRu}
              onChange={(e) => setKindRu(e.target.value)}
              placeholder="RU (например: Пиццерия)"
              className="mb-2"
            />

            <Form.Control
              value={kindEn}
              onChange={(e) => setKindEn(e.target.value)}
              placeholder="EN (например: Pizzeria)"
              className="mb-2"
            />

            <Form.Control
              value={kindEst}
              onChange={(e) => setKindEst(e.target.value)}
              placeholder="EST (например: Pitsarestoran)"
            />
          </Form.Group>

          <Form.Group className="mb-3">
            <Form.Label>Картинка ресторана</Form.Label>

            <Form.Control
              type="file"
              accept="image/*"
              onChange={(e) => setImgFile(e.target.files?.[0] || null)}
              className="mb-2"
            />
          </Form.Group>

          <Form.Group className="mb-3">
            <Form.Label>Юридическое название (название фирмы)</Form.Label>
            <Form.Control
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder="Например: OÜ Pizza Boom"
            />
          </Form.Group>

          <Form.Group className="mb-3">
            <Form.Label>Регистрационный номер</Form.Label>
            <Form.Control
              value={registrationNumber}
              onChange={(e) => setRegistrationNumber(e.target.value)}
              placeholder="Например: 12345678"
            />
          </Form.Group>

          <Form.Group className="mb-3">
            <Form.Label>IBAN (счёт для выплат)</Form.Label>
            <Form.Control
              value={iban}
              onChange={(e) => setIban(e.target.value)}
              placeholder="EE12 1234 1234 1234 1234"
            />
          </Form.Group>

          <Form.Group className="mb-3">
            <Form.Label>Адрес магазина</Form.Label>
            <Form.Control
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Город, улица, дом..."
            />
          </Form.Group>

          <Form.Group className="mb-3">
            <Form.Label>Телефон ресторана</Form.Label>
            <Form.Control
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+372 ..."
            />
          </Form.Group>

          <Form.Group className="mb-3">
            <Form.Label>Сайт (необязательно)</Form.Label>
            <Form.Control
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              placeholder="https://..."
            />
          </Form.Group>

          <Form.Group className="mb-3">
            <Form.Label>Координаты (для расчёта дистанции)</Form.Label>
            <div style={{ display: "flex", gap: 10 }}>
              <Form.Control
                value={pickupLat}
                onChange={(e) => setPickupLat(e.target.value)}
                placeholder="pickupLat (например 59.437)"
              />
              <Form.Control
                value={pickupLng}
                onChange={(e) => setPickupLng(e.target.value)}
                placeholder="pickupLng (например 24.753)"
              />
            </div>
            <Form.Text>
              Если lat/lon пустые — дистанция считаться не будет.
            </Form.Text>
          </Form.Group>

          <Form.Group className="mb-3">
            <Form.Label>ownerUserId (ID владельца, опционально)</Form.Label>
            <Form.Control
              value={ownerUserId}
              onChange={(e) => setOwnerUserId(e.target.value)}
              placeholder={
                isEdit
                  ? "ID пользователя, которого сделать (или добавить как) владельца магазина"
                  : "ID пользователя, который будет владельцем магазина"
              }
            />
          </Form.Group>

          <Form.Group className="mb-3">
            <Form.Label>Комиссия платформы (%)</Form.Label>
            <Form.Control
              type="number"
              min={0}
              max={100}
              value={commissionPercent}
              onChange={(e) => setCommissionPercent(e.target.value)}
              placeholder="20"
            />
            <Form.Text>
              По умолчанию 20%. Можно менять для каждого ресторана.
            </Form.Text>
          </Form.Group>

          <Form.Group>
            <Form.Check
              type="checkbox"
              label="Магазин активен"
              checked={!!isActive}
              onChange={(e) => setIsActive(e.target.checked)}
            />
          </Form.Group>
        </Form>
      </Modal.Body>

      <Modal.Footer>
        <Button variant="secondary" onClick={handleClose}>
          Отмена
        </Button>
        <Button variant="primary" disabled={loading} onClick={handleSubmit}>
          {loading ? "Сохранение..." : "Сохранить"}
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default CreateSeller;
