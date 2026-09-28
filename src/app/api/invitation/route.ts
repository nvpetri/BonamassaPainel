import { z } from "zod";
import { sameOrigin } from "@/server/session";
import { failure, forward, HttpError, readJson, upstream } from "@/server/http";
export const runtime = "nodejs";
const token = z.string().regex(/^[A-Za-z0-9_-]{43}$/);
const schema = z.discriminatedUnion("action", [
  z.strictObject({ action: z.literal("inspect"), token }),
  z.strictObject({
    action: z.literal("accept"),
    token,
    password: z.string().min(12).max(128),
    phone: z.string().max(20).default(""),
  }),
]);
export async function POST(request: Request) {
  try {
    if (!sameOrigin(request)) throw new HttpError(403, "Origem não permitida.");
    const parsed = schema.safeParse(await readJson(request, 4096));
    if (!parsed.success)
      throw new HttpError(400, "Confira os dados do convite.");
    const { action, ...data } = parsed.data;
    return forward(
      await upstream(`auth/staff-invitations/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }),
    );
  } catch (error) {
    return failure(error);
  }
}
