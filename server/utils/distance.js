const haversine = require("haversine");

const getDistanceFromWarehouse = (lat, lon) => {
  const clientLocation = { latitude: lat, longitude: lon };
  const warehouseLocation = { latitude: 59.513720, longitude: 24.828888 }; // Координаты склада

  return haversine(warehouseLocation, clientLocation, { unit: "km" });
};

module.exports = getDistanceFromWarehouse;
