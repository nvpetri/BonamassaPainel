import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";
import { z } from "zod";
import {
  isHardened,
  productionSettings,
} from "../../scripts/production-config.mjs";

export const COOKIE = "bonamassa_panel";
export const panelRole = z.enum(["MANAGER", "ATTENDANT", "KITCHEN"]);
const sessionSchema = z.object({
  token: z.string().min(32).max(200),
  expires: z.number(),
  binding: z.string(),
});

export function config() {
  if (isHardened()) productionSettings();
  const api = new URL(process.env.API_URL || "http://127.0.0.1:3001");
  if (
    !/^https?:$/.test(api.protocol) ||
    api.username ||
    api.password ||
    api.pathname !== "/" ||
    api.search ||
    api.hash
  )
    throw new Error(
      "API_URL deve conter somente a origem da API, como http://127.0.0.1:3001.",
    );
  const slug = process.env.STORE_SLUG || "bonamassa";
  if (!/^[a-z0-9-]{1,60}$/.test(slug)) throw new Error("STORE_SLUG inválido.");
  const secret = process.env.SESSION_SECRET || "";
  if (secret.length < 32)
    throw new Error(
      "Execute npm run setup para configurar a sessão do painel.",
    );
  return {
    api: api.origin,
    slug,
    key: createHash("sha256").update(secret).digest(),
    secure: process.env.COOKIE_SECURE !== "false",
  };
}
export function seal(token: string, expires: number) {
  const c = config();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", c.key, iv);
  const data = Buffer.concat([
    cipher.update(
      JSON.stringify({ token, expires, binding: `${c.api}/${c.slug}` }),
    ),
    cipher.final(),
  ]);
  return Buffer.concat([iv, cipher.getAuthTag(), data]).toString("base64url");
}
export function unseal(value?: string) {
  if (!value) return null;
  try {
    const c = config();
    const raw = Buffer.from(value, "base64url");
    const decipher = createDecipheriv(
      "aes-256-gcm",
      c.key,
      raw.subarray(0, 12),
    );
    decipher.setAuthTag(raw.subarray(12, 28));
    const data = sessionSchema.parse(
      JSON.parse(
        Buffer.concat([
          decipher.update(raw.subarray(28)),
          decipher.final(),
        ]).toString(),
      ),
    );
    return data.expires > Date.now() && data.binding === `${c.api}/${c.slug}`
      ? data
      : null;
  } catch {
    return null;
  }
}

// No arbitrary URL, customer impersonation or driver commands through the panel.
export function allowedRoute(method: string, path: string) {
  const id = "[A-Za-z0-9_-]{1,100}";
  const routes: Record<string, RegExp[]> = {
    GET: [
      /^me$/,
      /^staff\/(catalog|promotions|users|drivers|dashboard)$/,
      new RegExp(`^staff/orders(?:/${id})?$`),
    ],
    POST: [
      /^orders\/quote$/,
      /^me\/password$/,
      /^staff\/(orders|products|promotions|users|product-images)$/,
      new RegExp(
        `^staff/orders/${id}/(accept|prepare|ready|cancel|assign|pickup-complete|return|record-payment)$`,
      ),
    ],
    PATCH: [
      /^staff\/store$/,
      new RegExp(`^staff/(products|promotions|users)/${id}$`),
      new RegExp(`^staff/drivers/${id}/availability$`),
    ],
  };
  return (routes[method] || []).some((r) => r.test(path));
}

export function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  if (!origin || origin === "null" || !host) return false;
  try {
    if (isHardened()) {
      const expected = productionSettings().origin;
      return origin === expected && host === new URL(expected).host && request.headers.get("sec-fetch-site") !== "cross-site";
    }
    return (
      new URL(origin).host === host &&
      /^https?:$/.test(new URL(origin).protocol) &&
      request.headers.get("sec-fetch-site") !== "cross-site"
    );
  } catch {
    return false;
  }
}
