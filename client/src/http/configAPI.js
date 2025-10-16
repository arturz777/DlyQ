export async function fetchMaintenance() {
  const res = await fetch("https://api.dlyq.ee//api/config/maintenance");
  if (!res.ok) throw new Error("Failed to fetch maintenance");
  return res.json();
}

export async function updateMaintenance(enabled) {
  const res = await fetch("https://api.dlyq.ee//api/config/maintenance", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ enabled }),
  });
  if (!res.ok) throw new Error("Failed to update maintenance");
  return res.json();
}
