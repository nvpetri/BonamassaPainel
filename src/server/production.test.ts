import { afterEach, describe, expect, it, vi } from "vitest";
import { isHardened, productionSettings } from "../../scripts/production-config.mjs";
import { config, sameOrigin } from "./session";

afterEach(() => vi.unstubAllEnvs());
const valid = {
  NODE_ENV: "production", APP_ENV: "production", PANEL_MODE: "api",
  COOKIE_SECURE: "true", STORE_SLUG: "bonamassa",
  API_URL: "https://api.example.com", PANEL_ORIGIN: "https://painel.example.com",
  SESSION_SECRET: "0123456789abcdef".repeat(4),
};

describe("pré-produção", () => {
  it("valida HTTPS, origem fixa e sessão forte", () => {
    expect(productionSettings(valid)).toEqual({ api: valid.API_URL, origin: valid.PANEL_ORIGIN });
    expect(isHardened({ NODE_ENV: "production" })).toBe(true);
    expect(isHardened({ NODE_ENV: "production", APP_ENV: "test" })).toBe(false);
  });
  it("recusa flags, URLs e segredos inadequados", () => {
    for (const patch of [
      { NODE_ENV: "development" }, { APP_ENV: "test" }, { APP_ENV: "unknown" },
      { PANEL_MODE: "demo" }, { COOKIE_SECURE: "false" },
      { API_URL: "http://api.example.com" }, { API_URL: "https://user:password@api.example.com" },
      { API_URL: "https://api.example.com/v1" }, { API_URL: "https://api.example.com?token=secret" },
      { PANEL_ORIGIN: "" }, { PANEL_ORIGIN: "http://painel.example.com" },
      { SESSION_SECRET: "short" }, { SESSION_SECRET: "a".repeat(64) }, { STORE_SLUG: "../other" },
    ]) expect(() => productionSettings({ ...valid, ...patch })).toThrow();
  });
  it("validação também ocorre ao usar a sessão, não apenas no script", () => {
    Object.entries(valid).forEach(([key, value]) => vi.stubEnv(key, value));
    expect(config().secure).toBe(true);
    vi.stubEnv("COOKIE_SECURE", "false");
    expect(() => config()).toThrow();
  });
  it("origem fixa de produção recusa HTTP, host forjado e origem cruzada", () => {
    Object.entries(valid).forEach(([key, value]) => vi.stubEnv(key, value));
    const make = (origin: string, host = "painel.example.com") =>
      new Request("https://painel.example.com/api/session", { headers: { origin, host } });
    expect(sameOrigin(make(valid.PANEL_ORIGIN))).toBe(true);
    expect(sameOrigin(make("http://painel.example.com"))).toBe(false);
    expect(sameOrigin(make("https://evil.example.com", "evil.example.com"))).toBe(false);
    expect(sameOrigin(make(valid.PANEL_ORIGIN, "evil.example.com"))).toBe(false);
  });
});
