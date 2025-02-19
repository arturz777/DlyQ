import React from "react";
import { Button } from "react-bootstrap";
import { deleteBrand } from "../http/deviceAPI";

const DeleteBrand = ({ brandId, onDelete }) => {
  const handleDelete = () => {
    deleteBrand(brandId).then(() => {
      onDelete(brandId);
    });
  };

  return (
    <Button variant="danger" onClick={handleBrand}>
      Удалить
    </Button>
  );
};

export default DeleteBrand;