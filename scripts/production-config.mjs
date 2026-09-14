export function isHardened(env = process.env) {
  const name = env.APP_ENV ?? (env.NODE_ENV === "production" ? "production" : "development");
  if (!["development", "test", "staging", "production"].includes(name))
    throw new Error("APP_ENV inválido.");
  return name === "production" || name === "staging";
}

function httpsOrigin(value, field) {
  let url;
  try { url = new URL(value ?? ""); }
  catch { throw new Error(`${field} inválida.`); }
  if (url.protocol !== "https:" || url.username || url.password || url.pathname !== "/" || url.search || url.hash)
    throw new Error(`${field} deve conter somente uma origem HTTPS.`);
  return url.origin;
}

export function productionSettings(env = process.env) {
  if (env.NODE_ENV !== "production" || !isHardened(env))
    throw new Error("Use NODE_ENV=production e APP_ENV=production ou staging.");
  if (env.PANEL_MODE !== "api") throw new Error("Produção requer PANEL_MODE=api.");
  if (env.COOKIE_SECURE !== "true") throw new Error("Produção requer COOKIE_SECURE=true.");
  const secret = env.SESSION_SECRET ?? "";
  if (secret.length < 64 || new Set(secret).size < 10)
    throw new Error("Gere SESSION_SECRET com 32 bytes aleatórios em hexadecimal (64 caracteres).");
  const api = httpsOrigin(env.API_URL, "API_URL");
  const origin = httpsOrigin(env.PANEL_ORIGIN, "PANEL_ORIGIN");
  if (!/^[a-z0-9-]{1,60}$/.test(env.STORE_SLUG ?? ""))
    throw new Error("STORE_SLUG inválido.");
  return { api, origin };
}
