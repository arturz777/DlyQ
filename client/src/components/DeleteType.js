import React from "react";
import { Button } from "react-bootstrap";
import { deleteType } from "../http/deviceAPI";

const DeleteType = ({ typeId, onDelete }) => {
  const handleDelete = () => {
    deleteType(typeId).then(() => {
      onDelete(typeId);
    });
  };

  return (
    <Button variant="danger" onClick={handleDelete}>
      Удалить
    </Button>
  );
};

export default DeleteDevice;