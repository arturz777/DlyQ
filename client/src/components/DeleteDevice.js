import React from "react";
import { Button } from "react-bootstrap";
import { deleteDevice } from "../http/deviceAPI";

const DeleteDevice = ({ deviceId, onDelete }) => {
  const handleDelete = () => {
    deleteDevice(deviceId).then(() => {
      onDelete(deviceId);
    });
  };

  return (
    <Button variant="danger" onClick={handleDelete}>
      Удалить
    </Button>
  );
};

export default DeleteDevice;
