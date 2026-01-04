const Router = require("express");
const fetch = require("node-fetch");
const router = new Router();

const NOMINATIM_HEADERS = {
  "User-Agent": "DlyQ (dlyq2025@gmail.com)",
  Accept: "application/json",
};

function cleanPoiName(name) {
  return String(name || "")
    .replace(/^Tallinna\s+/i, "")
    .replace(/\b(Lasteaed|OÜ|AS|MTÜ)\b/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function formatShortAddress(place) {
  const a = place.address || {};
  const poiRaw =
    place.namedetails?.name || place.name || a.building || a.amenity || a.shop;
  const poi = cleanPoiName(poiRaw);
  const street = a.road || a.pedestrian || a.residential || a.footway || a.path;
  const house = a.house_number;
  const district = a.city_district || a.suburb || a.neighbourhood;
  const city = a.city || a.town || a.village || a.municipality;

  const parts = [];
  if (poi) parts.push(poi);
  else if (street) parts.push(street);

  if (house) parts.push(house);
  if (district) parts.push(district);
  else if (city) parts.push(city);

  return parts.filter(Boolean).join(", ") || place.display_name || "";
}

router.get("/reverse", async (req, res) => {
  const { lat, lon } = req.query;
  if (!lat || !lon)
    return res.status(400).json({ error: "lat and lon required" });

  const fallback = `${Number(lat).toFixed(6)}, ${Number(lon).toFixed(6)}`;

  try {
    const url =
      `https://nominatim.openstreetmap.org/reverse?format=json` +
      `&addressdetails=1&namedetails=1&lat=${encodeURIComponent(
        lat
      )}&lon=${encodeURIComponent(lon)}`;
    const response = await fetch(url, { headers: NOMINATIM_HEADERS });

    const contentType = response.headers.get("content-type") || "";
    if (!contentType.includes("application/json")) {
      const text = await response.text();
      console.error("❌ Nominatim вернул HTML:", text.slice(0, 500));
      return res
        .status(502)
        .json({ error: "Invalid response from geocoding service" });
    }

    const data = await response.json();
    const short = formatShortAddress(data);

    res.json({
      ...data,
      display_name_original: data.display_name,
      display_name: short,
      short_display_name: short,
    });
  } catch (err) {
    console.error("Reverse geocoding failed:", err);
    return res.json({
      display_name: fallback,
      short_display_name: fallback,
      fallback: true,
    });
  }
});

router.get("/search", async (req, res) => {
  const { q } = req.query;
  if (!q) return res.status(400).json({ error: "q required" });

  try {
    const url =
      `https://nominatim.openstreetmap.org/search?format=json` +
      `&addressdetails=1&namedetails=1&limit=5&q=${encodeURIComponent(q)}`;
    const response = await fetch(url, { headers: NOMINATIM_HEADERS });

    const contentType = response.headers.get("content-type") || "";
    if (!contentType.includes("application/json")) {
      const text = await response.text();
      console.error("❌ Nominatim вернул HTML:", text.slice(0, 500));
      return res
        .status(502)
        .json({ error: "Invalid response from geocoding service" });
    }

    const data = await response.json();
    const withShort = data.map((p) => ({
      ...p,
      display_name_original: p.display_name,
      short_display_name: formatShortAddress(p),
    }));
    res.json(withShort);
  } catch (err) {
    console.error("Search failed:", err);
    res.status(500).json({ error: "Search failed" });
  }
});

module.exports = router;
