const haversine = require("haversine");

const getDistanceFromWarehouse = (lat, lon) => {
  const latitude = Number(lat);
  const longitude = Number(lon);

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;

  const clientLocation = { latitude, longitude };
  const warehouseLocation = { latitude: 59.513720, longitude: 24.828888 };

  return haversine(warehouseLocation, clientLocation, { unit: "km" });
};

module.exports = getDistanceFromWarehouse;
