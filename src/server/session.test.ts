import { afterEach, describe, expect, it, vi } from "vitest";
import { allowedRoute, sameOrigin, seal, unseal } from "./session";

afterEach(() => vi.unstubAllEnvs());
describe("sessão do painel", () => {
  it("autentica o cookie, expira e vincula à API/unidade", () => {
    vi.stubEnv(
      "SESSION_SECRET",
      "test-session-key-with-at-least-32-characters",
    );
    vi.stubEnv("API_URL", "http://127.0.0.1:3001");
    vi.stubEnv("STORE_SLUG", "bonamassa");
    const token = "opaque-token-which-must-never-reach-browser-javascript";
    const cookie = seal(token, Date.now() + 60000);
    expect(cookie).not.toContain(token);
    expect(unseal(cookie)?.token).toBe(token);
    expect(unseal(`x${cookie.slice(1)}`)).toBeNull();
    const expired = seal(token, Date.now() - 1000);
    expect(unseal(expired)).toBeNull();
    vi.stubEnv("STORE_SLUG", "outra-pizzaria");
    expect(unseal(cookie)).toBeNull();
  });
  it("rejeita origem externa, ausente ou opaca; aceita o host da LAN", () => {
    const make = (origin?: string) =>
      new Request("http://192.168.1.10:3000/api/backend/staff/orders", {
        headers: { host: "192.168.1.10:3000", ...(origin ? { origin } : {}) },
      });
    expect(sameOrigin(make("http://192.168.1.10:3000"))).toBe(true);
    expect(sameOrigin(make("https://outside.test"))).toBe(false);
    expect(sameOrigin(make("null"))).toBe(false);
    expect(sameOrigin(make())).toBe(false);
  });
  it("só permite os contratos do painel no proxy", () => {
    expect(allowedRoute("POST", "staff/orders/abc/accept")).toBe(true);
    expect(allowedRoute("PATCH", "staff/products/calabresa")).toBe(true);
    for (const path of [
      "driver/deliveries/abc/complete",
      "customers",
      "https://outside.test",
      "staff/orders/../../me",
      "staff/orders/abc/collect",
    ])
      expect(allowedRoute("POST", path)).toBe(false);
    expect(allowedRoute("DELETE", "staff/orders/abc")).toBe(false);
  });
});
