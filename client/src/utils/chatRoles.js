export function normalizeChatRole(appRole) {
  const map = {
    user: "client",
    admin: "admin",
    courier: "courier",
    warehouse: "warehouse",
    client: "client",
  };

  const role = appRole?.toLowerCase?.();
  return map[role] || "client";
}
