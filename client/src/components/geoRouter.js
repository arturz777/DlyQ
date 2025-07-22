const Router = require("express");
const fetch = require("node-fetch");
const router = new Router();

router.get("/reverse", async (req, res) => {
  const { lat, lon } = req.query;

  if (!lat || !lon) {
    return res.status(400).json({ error: "lat and lon required" });
  }

  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`,
      {
        headers: {
          "User-Agent": "DlyQ (dlyq2025@gmail.com)"
        }
      }
    );

	const contentType = response.headers.get("content-type");
  if (!contentType || !contentType.includes("application/json")) {
    const text = await response.text();
    console.error("❌ Nominatim вернул HTML:", text);
    return res.status(500).json({ error: "Invalid response from geocoding service" });
  }

    const data = await response.json();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: "Reverse geocoding failed" });
  }
});

router.get("/search", async (req, res) => {
  const { q } = req.query;

  if (!q) return res.status(400).json({ error: "q required" });

  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${q}`,
      {
        headers: {
          "User-Agent": "DlyQ (dlyq2025@gmail.com)"
        }
      }
    );

	const contentType = response.headers.get("content-type");
if (!contentType || !contentType.includes("application/json")) {
  const text = await response.text();
  console.error("❌ Nominatim вернул HTML:", text);
  return res.status(500).json({ error: "Invalid response from geocoding service" });
}

    const data = await response.json();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: "Search failed" });
  }
});

module.exports = router;
