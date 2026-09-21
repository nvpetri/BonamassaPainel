import { z } from "zod";
import { COOKIE, config, panelRole, sameOrigin, seal } from "@/server/session";
import { failure, forward, HttpError, json, readJson, upstream } from "@/server/http";

export const runtime = "nodejs";

const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("verify-request"), email: z.email().max(254) }),
  z.object({ action: z.literal("verify-confirm"), email: z.email().max(254), code: z.string().regex(/^\d{6}$/) }),
  z.object({ action: z.literal("reset-request"), email: z.email().max(254) }),
  z.object({ action: z.literal("reset-confirm"), email: z.email().max(254), code: z.string().regex(/^\d{6}$/), newPassword: z.string().min(12).max(128) }),
]);

export async function POST(request: Request) {
  try {
    if (!sameOrigin(request)) throw new HttpError(403, "Origem não permitida.");
    const parsed = schema.safeParse(await readJson(request, 4096));
    if (!parsed.success) throw new HttpError(400, "Confira os dados informados.");
    const { action, ...data } = parsed.data;
    const paths = {
      "verify-request": "auth/email-verification/request",
      "verify-confirm": "auth/email-verification/confirm",
      "reset-request": "auth/password-reset/request",
      "reset-confirm": "auth/password-reset/confirm",
    } as const;
    const response = await upstream(paths[action], {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...data, storeSlug: config().slug }),
    });
    if (!response.ok || action !== "verify-confirm") return forward(response);
    const session = await response.json();
    if (!panelRole.safeParse(session.user?.role).success) {
      if (typeof session.accessToken === "string")
        await upstream("sessions/current", { method: "DELETE" }, session.accessToken);
      throw new HttpError(403, "Esta conta não tem acesso ao painel.");
    }
    const expires = Date.parse(session.expiresAt);
    if (!Number.isFinite(expires) || typeof session.accessToken !== "string")
      throw new HttpError(502, "Sessão inválida retornada pela API.");
    const result = json({ user: session.user });
    result.cookies.set(COOKIE, seal(session.accessToken, expires), {
      httpOnly: true, sameSite: "strict", secure: config().secure, path: "/", expires: new Date(expires),
    });
    return result;
  } catch (error) {
    return failure(error);
  }
}
