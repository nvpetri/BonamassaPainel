import { z } from "zod";
import { COOKIE, config, panelRole, sameOrigin, seal } from "@/server/session";
import {
  failure,
  forward,
  HttpError,
  json,
  readJson,
  renewSession,
  session,
  upstream,
} from "@/server/http";

export const runtime = "nodejs";
export async function GET() {
  try {
    const current = await session();
    const response = await upstream("me", {}, current.token);
    if (!response.ok) return forward(response);
    const user = await response.json();
    if (!panelRole.safeParse(user.role).success)
      throw new HttpError(403, "Esta conta não tem acesso ao painel.");
    return renewSession(json({ user }), response, current.token);
  } catch (error) {
    return failure(error);
  }
}
export async function POST(request: Request) {
  try {
    if (!sameOrigin(request)) throw new HttpError(403, "Origem não permitida.");
    const body = z
      .object({
        email: z.email().max(160),
        password: z.string().min(1).max(128),
      })
      .strict()
      .safeParse(await readJson(request, 4096));
    if (!body.success)
      throw new HttpError(400, "Informe um e-mail válido e sua senha.");
    const c = config();
    const response = await upstream("sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...body.data, storeSlug: c.slug }),
    });
    if (!response.ok) return forward(response);
    const data = await response.json();
    if (!panelRole.safeParse(data.user?.role).success) {
      await upstream(
        "sessions/current",
        { method: "DELETE" },
        data.accessToken,
      );
      throw new HttpError(
        403,
        "Use uma conta de gerente, atendimento ou cozinha.",
      );
    }
    const expires = Date.parse(data.expiresAt);
    if (!Number.isFinite(expires) || typeof data.accessToken !== "string")
      throw new HttpError(502, "Sessão inválida retornada pela API.");
    const result = json({ user: data.user });
    result.cookies.set(COOKIE, seal(data.accessToken, expires), {
      httpOnly: true,
      sameSite: "strict",
      secure: c.secure,
      path: "/",
      expires: new Date(expires),
    });
    return result;
  } catch (error) {
    return failure(error);
  }
}
export async function DELETE(request: Request) {
  try {
    if (!sameOrigin(request)) throw new HttpError(403, "Origem não permitida.");
    const current = await session().catch(() => null);
    if (current) {
      const response = await upstream(
        "sessions/current",
        { method: "DELETE" },
        current.token,
      );
      if (!response.ok && response.status !== 401) return forward(response);
    }
    const result = json({ ok: true });
    result.cookies.set(COOKIE, "", { path: "/", maxAge: 0 });
    return result;
  } catch (error) {
    return failure(error);
  }
}
