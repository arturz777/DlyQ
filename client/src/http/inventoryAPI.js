const baseRaw = process.env.REACT_APP_API_URL;
const base = baseRaw.replace(/\/+$/, "");

const j = async (url, opts = {}) => {
  const path = url.startsWith("/") ? url : `/${url}`;

  const res = await fetch(base + path, {
    headers: { "Content-Type": "application/json", ...(opts.headers || {}) },
    ...opts,
  });

  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.message || "Request failed");
  return data;
};

export const createReceipt = (payload) =>
  j("/inventory/receipts", {
    method: "POST",
    body: JSON.stringify(payload),
  });

export const createWriteoff = (payload) =>
  j("/inventory/writeoffs", {
    method: "POST",
    body: JSON.stringify(payload),
  });

export const fetchReceipts = (params = {}) => {
  const qs = new URLSearchParams(params).toString();
  return j("/inventory/receipts" + (qs ? `?${qs}` : ""));
};

export const fetchReceipt = (id) => j(`/inventory/receipts/${id}`);

export const deleteReceipt = (id) =>
  j(`/inventory/receipts/${id}`, { method: "DELETE" });
