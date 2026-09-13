import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { COOKIE, config, unseal } from "./session";

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export const json = (body: unknown, status = 200) =>
  NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
export async function readJson(
  request: Request,
  limit = 400_000,
): Promise<unknown> {
  if (!request.headers.get("content-type")?.startsWith("application/json"))
    throw new HttpError(415, "Envie os dados como JSON.");
  const reader = request.body?.getReader();
  if (!reader) throw new HttpError(400, "Dados ausentes.");
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > limit) {
      await reader.cancel();
      throw new HttpError(413, "Dados maiores que o permitido.");
    }
    chunks.push(value);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString());
  } catch {
    throw new HttpError(400, "JSON inválido.");
  }
}
export async function session() {
  const value = unseal((await cookies()).get(COOKIE)?.value);
  if (!value) throw new HttpError(401, "Entre com sua conta da pizzaria.");
  return value;
}
export async function upstream(
  path: string,
  init: RequestInit = {},
  token?: string,
) {
  try {
    return await fetch(`${config().api}/v1/${path}`, {
      ...init,
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(20_000),
      headers: {
        ...init.headers,
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });
  } catch {
    throw new HttpError(
      503,
      "Não foi possível alcançar a API. Confira se ela está rodando e tente novamente.",
    );
  }
}
export async function forward(response: Response) {
  if (response.status === 204)
    return new NextResponse(null, {
      status: 204,
      headers: { "Cache-Control": "no-store" },
    });
  let data: unknown;
  try {
    data = await response.json();
  } catch {
    throw new HttpError(502, "A API retornou uma resposta inválida.");
  }
  const result = json(data, response.status);
  if (response.status === 401)
    result.cookies.set(COOKIE, "", { maxAge: 0, path: "/" });
  if (response.headers.has("retry-after"))
    result.headers.set("Retry-After", response.headers.get("retry-after")!);
  return result;
}
export function failure(error: unknown) {
  if (error instanceof HttpError)
    return json({ message: error.message }, error.status);
  return json(
    {
      message:
        "Não foi possível processar a solicitação. Confira a configuração do painel.",
    },
    500,
  );
}
