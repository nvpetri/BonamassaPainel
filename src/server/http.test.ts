import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { forward } from "./http";
import { COOKIE, seal, unseal } from "./session";

beforeEach(() => {
  vi.stubEnv("APP_ENV", "test");
  vi.stubEnv("SESSION_SECRET", "session-renewal-test-key-at-least-32-characters");
  vi.stubEnv("API_URL", "http://127.0.0.1:3001");
  vi.stubEnv("STORE_SLUG", "bonamassa");
  vi.stubEnv("COOKIE_SECURE", "true");
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-09-22T12:00:00Z"));
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs(); });

describe("renovação da sessão pelo contrato da API", () => {
  const token = "opaque-session-never-exposed-to-browser-javascript";
  it("mantém o usuário ativo além da validade original do cookie", async () => {
    const original = seal(token, Date.now() + 1000);
    const expiry = new Date(Date.now() + 5 * 86_400_000).toISOString();
    const response = await forward(Response.json({ items: [] }, { headers: { "X-Session-Expires-At": expiry } }), token);
    const cookie = response.cookies.get(COOKIE)!;
    expect(cookie.httpOnly).toBe(true);
    expect(cookie.secure).toBe(true);
    expect(cookie.sameSite).toBe("strict");
    expect(cookie.value).not.toContain(token);
    expect(await response.json()).toEqual({ items: [] });
    vi.advanceTimersByTime(2000);
    expect(unseal(original)).toBeNull();
    expect(unseal(cookie.value)?.token).toBe(token);
    vi.setSystemTime(Date.parse(expiry));
    expect(unseal(cookie.value)).toBeNull();
  });
  it("não renova uma sessão revogada ou sem validade confirmada pela API", async () => {
    const future = new Date(Date.now() + 86_400_000).toISOString();
    const revoked = await forward(Response.json({ code: "SESSION_EXPIRED" }, { status: 401, headers: { "X-Session-Expires-At": future } }), token);
    expect(revoked.cookies.get(COOKIE)?.maxAge).toBe(0);
    for (const expiry of ["", "inválido", new Date(Date.now() - 1000).toISOString()]) {
      const response = await forward(Response.json({}, { headers: { "X-Session-Expires-At": expiry } }), token);
      expect(response.cookies.get(COOKIE)).toBeUndefined();
    }
  });
});
