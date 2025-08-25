import React from "react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: require("leaflet/dist/images/marker-icon-2x.png"),
  iconUrl: require("leaflet/dist/images/marker-icon.png"),
  shadowUrl: require("leaflet/dist/images/marker-shadow.png"),
});

const CourierMap = ({ couriers }) => {
  const center = [59.437, 24.7536];

  return (
    <div style={{ height: "500px", width: "100%", marginTop: "20px" }}>
      <MapContainer
        center={center}
        zoom={12}
        style={{ height: "100%", width: "100%" }}
      >
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        {couriers
          .filter((c) => c.status === "online" && c.currentLat && c.currentLng)
          .map((courier) => (
            <Marker
              key={courier.id}
              position={[courier.currentLat, courier.currentLng]}
            >
              <Popup>{courier.name || `Курьер #${courier.id}`}</Popup>
            </Marker>
          ))}
      </MapContainer>
    </div>
  );
};

export default CourierMap;
