import { z } from "zod";
import { allowedRoute, sameOrigin } from "@/server/session";
import {
  failure,
  forward,
  HttpError,
  readJson,
  session,
  upstream,
} from "@/server/http";

export const runtime = "nodejs";
async function handle(
  request: Request,
  context: { params: Promise<{ path: string[] }> },
) {
  try {
    const path = (await context.params).path.join("/");
    if (!allowedRoute(request.method, path))
      throw new HttpError(404, "Recurso não disponível no painel.");
    if (request.method !== "GET" && !sameOrigin(request))
      throw new HttpError(403, "Origem não permitida.");
    const current = await session();
    const key = request.headers.get("idempotency-key");
    if (request.method !== "GET" && !/^[A-Za-z0-9_-]{16,100}$/.test(key || ""))
      throw new HttpError(400, "Identificador da operação ausente.");
    const headers: Record<string, string> = key
      ? { "Idempotency-Key": key }
      : {};
    let body: BodyInit | undefined;
    if (request.method !== "GET") {
      const data = await readJson(request);
      if (path === "staff/product-images") {
        const image = z
          .object({
            photo: z
              .string()
              .max(300_000)
              .regex(/^data:image\/(jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/),
          })
          .strict()
          .safeParse(data);
        if (!image.success)
          throw new HttpError(400, "Foto inválida. Escolha outra imagem.");
        const [meta, encoded] = image.data.photo.split(",");
        const type = meta.includes("webp") ? "image/webp" : "image/jpeg";
        const form = new FormData();
        form.set(
          "file",
          new Blob([Buffer.from(encoded, "base64")], { type }),
          type === "image/webp" ? "pizza.webp" : "pizza.jpg",
        );
        body = form;
      } else {
        headers["Content-Type"] = "application/json";
        body = JSON.stringify(data);
      }
    }
    const search = new URL(request.url).searchParams;
    if (
      [...search.keys()].some(
        (name) => !["status", "limit", "cursor"].includes(name),
      )
    )
      throw new HttpError(400, "Filtro inválido.");
    return forward(
      await upstream(
        `${path}${search.size ? `?${search}` : ""}`,
        { method: request.method, headers, body },
        current.token,
      ),
      current.token,
    );
  } catch (error) {
    return failure(error);
  }
}
export const GET = handle;
export const POST = handle;
export const PATCH = handle;
